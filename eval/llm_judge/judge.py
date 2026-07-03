"""LLM-judge 코어 — OpenAI 호출 + self-consistency 집계 + 무비용 fake 모드.

판단 신뢰도(reliability)를 높이는 장치:
- temperature 0 (결정성)
- 구조화 JSON 강제 (response_format=json_object)
- self-consistency: 같은 입력을 K번 채점해 중앙값/다수결로 집계 + 분산으로 confidence 산출
- judge 모델 != generator 모델 (자기편향 완화): 기본 JUDGE_MODEL=gpt-4o (엔진은 gpt-4o-mini)
- fake 모드: repo_context 대조 규칙 기반의 결정적 judge (API 비용 0, CI/오프라인 검증용 + 교차검증 baseline)
"""

from __future__ import annotations

import json
import os
import statistics
from pathlib import Path
from typing import Any

import httpx

try:
    from dotenv import load_dotenv
except Exception:  # dotenv 없어도 동작하게
    def load_dotenv(*_args, **_kwargs):  # type: ignore
        return False

from .rubric import build_judge_prompt

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
TRANSIENT_STATUS_CODES = {429, 502, 503, 504}

# backend/.env 를 재사용 (프로젝트 루트 기준)
_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    load_dotenv(_ROOT / "backend" / ".env")
    load_dotenv(_ROOT / "eval" / ".env")


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# ------------------------- fake(규칙기반) judge -------------------------

def _repo_corpus(repo_context: dict[str, Any]) -> str:
    parts = [
        repo_context.get("readme") or "",
        " ".join(repo_context.get("dependencies", [])),
        " ".join(repo_context.get("file_tree", [])),
        repo_context.get("code_context") or "",
        " ".join(repo_context.get("meta_tags", [])),
        repo_context.get("repo_name") or "",
    ]
    return " ".join(p for p in parts if p).lower()


def _is_file_like(token: str) -> bool:
    return "/" in token or token.rsplit(".", 1)[-1] in {
        "py", "ts", "tsx", "js", "jsx", "yaml", "yml", "json", "toml", "md", "cfg", "ini"
    }


def _fake_judge(repo_context: dict[str, Any], trend: dict[str, Any], card: dict[str, Any]) -> dict[str, Any]:
    """API 없이 도는 결정적 judge. LLM judge의 교차검증 baseline 역할.
    핵심 신호: (a) 카드가 언급한 파일이 repo에 실제로 있는가(환각), (b) trend-repo 어휘 겹침, (c) 행동 구체성."""
    corpus = _repo_corpus(repo_context)
    file_tree = [f.lower() for f in repo_context.get("file_tree", [])]

    # 1) 근거 환각 검출: 카드가 언급한 '파일처럼 생긴' 토큰이 repo file_tree/corpus에 없으면 환각
    referenced_files = set(f.lower() for f in card.get("related_files", []))
    for ev in card.get("evidence", []):
        for t in _tokens(ev):
            if _is_file_like(t):
                referenced_files.add(t)
    hallucinated = sorted(
        rf for rf in referenced_files
        if rf not in file_tree and rf not in corpus and not any(rf in f for f in file_tree)
    )
    groundedness = max(0, 100 - 40 * len(hallucinated))
    # 근거가 아예 없거나 일반론뿐이면 상한을 낮춘다
    if not card.get("evidence"):
        groundedness = min(groundedness, 40)

    # 2) relevance: trend 용어가 repo corpus에 걸리는 정도
    trend_terms = _tokens(
        " ".join(
            [trend.get("title", ""), trend.get("summary", "")]
            + trend.get("task_tags", [])
            + trend.get("dependency_tags", [])
            + trend.get("keyword_tags", [])
        )
    )
    trend_terms = [t for t in trend_terms if len(t) > 2]
    overlap = sum(1 for t in set(trend_terms) if t in corpus or any(t in c for c in corpus.split()))
    relevance = max(0, min(100, 30 + overlap * 12))

    # 3) actionability: next_actions에 파일 언급/구체 동사 있으면 가점, 추상어면 감점
    actions = card.get("next_actions", [])
    act_score = 20
    for a in actions:
        al = a.lower()
        if any(f.split("/")[-1] in al for f in file_tree):
            act_score += 25
        if any(w in al for w in ["비교", "추가", "교체", "측정", "적용", "확인", "benchmark", "hit@", "mrr"]):
            act_score += 10
        if any(w in al for w in ["읽어", "검토", "고려", "살펴", "consider", "read"]):
            act_score -= 20
    actionability = max(0, min(100, act_score))

    disp = card.get("display_decision")
    cls = card.get("classification")

    overall_score = int(0.30 * relevance + 0.40 * groundedness + 0.30 * actionability)

    # 판정: 환각/무관/비실행성은 강한 bad 신호
    if cls == "exclude" and disp == "show":
        classification_verdict = "wrong"
    elif relevance < 45 and not hallucinated:
        classification_verdict = "borderline"
    else:
        classification_verdict = "correct"

    if hallucinated or (cls == "exclude" and disp == "show"):
        overall_verdict = "bad"
    elif actionability < 40 and relevance < 55:
        overall_verdict = "bad"
    elif groundedness >= 60 and actionability >= 55 and relevance >= 40:
        overall_verdict = "good"
    else:
        overall_verdict = "borderline"

    return {
        "relevance": {"score": relevance, "reason": f"trend-repo term overlap={overlap}"},
        "classification": {"verdict": classification_verdict, "reason": f"display={disp}, class={cls}"},
        "groundedness": {
            "score": groundedness,
            "hallucinated_evidence": hallucinated,
            "reason": f"hallucinated files={len(hallucinated)}, evidence={len(card.get('evidence', []))}",
        },
        "actionability": {"score": actionability, "reason": f"{len(actions)} actions"},
        "overall": {"verdict": overall_verdict, "score": overall_score, "reason": "rule-based fake judge"},
        "_engine": "fake",
    }


def _tokens(text: str) -> list[str]:
    out, cur = [], []
    for ch in (text or "").lower():
        if ch.isalnum() or ch in "_-.":
            cur.append(ch)
        else:
            if cur:
                out.append("".join(cur))
                cur = []
    if cur:
        out.append("".join(cur))
    return out


# ------------------------- OpenAI judge -------------------------

def _call_openai_judge(prompt: str) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 없음. backend/.env에 넣거나 JUDGE_FAKE=true로 실행하세요.")
    model = os.getenv("JUDGE_MODEL", "gpt-4o")  # 엔진(gpt-4o-mini)과 다른 모델 → 자기편향 완화
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=60.0) as client:
        for attempt in range(3):
            try:
                r = client.post(OPENAI_URL, json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
                break
            except httpx.HTTPStatusError as exc:
                if attempt < 2 and exc.response.status_code in TRANSIENT_STATUS_CODES:
                    continue
                raise
        else:
            raise RuntimeError("OpenAI judge 요청 실패")
    text = data["choices"][0]["message"]["content"]
    result = json.loads(text)
    result["_engine"] = model
    return result


# ------------------------- self-consistency 집계 -------------------------

def _aggregate(samples: list[dict[str, Any]]) -> dict[str, Any]:
    """K개 채점 결과를 중앙값/다수결로 합치고, 분산으로 confidence를 만든다."""
    def med(key: str) -> int:
        vals = [int(s[key]["score"]) for s in samples if key in s]
        return int(statistics.median(vals)) if vals else 0

    def spread(key: str) -> float:
        vals = [int(s[key]["score"]) for s in samples if key in s]
        return round(statistics.pstdev(vals), 1) if len(vals) > 1 else 0.0

    def majority(getter) -> tuple[str, float]:
        votes = [getter(s) for s in samples]
        top = max(set(votes), key=votes.count)
        return top, round(votes.count(top) / len(votes), 2)

    cls_verdict, cls_agree = majority(lambda s: s["classification"]["verdict"])
    overall_verdict, overall_agree = majority(lambda s: s["overall"]["verdict"])

    # confidence: 점수 분산이 작고 다수결 합의가 높을수록 높다
    score_spread = statistics.mean(
        [spread("relevance"), spread("groundedness"), spread("actionability"), spread("overall")]
    )
    confidence = round(max(0.0, min(1.0, (cls_agree + overall_agree) / 2 - score_spread / 100)), 2)

    hallucinated: list[str] = []
    for s in samples:
        hallucinated.extend(s.get("groundedness", {}).get("hallucinated_evidence", []) or [])

    return {
        "relevance": med("relevance"),
        "groundedness": med("groundedness"),
        "actionability": med("actionability"),
        "overall_score": med("overall"),
        "classification_verdict": cls_verdict,
        "overall_verdict": overall_verdict,
        "hallucinated_evidence": sorted(set(hallucinated)),
        "confidence": confidence,
        "n_samples": len(samples),
        "engine": samples[0].get("_engine", "?") if samples else "?",
        "raw": samples,
    }


def judge_card(
    repo_context: dict[str, Any],
    trend: dict[str, Any],
    card: dict[str, Any],
    *,
    n_samples: int | None = None,
    fake: bool | None = None,
) -> dict[str, Any]:
    """ImpactCard 하나를 채점. self-consistency K회 후 집계 결과 반환."""
    _load_env()
    if fake is None:
        fake = _env_flag("JUDGE_FAKE", default=False) or _env_flag("USE_FAKE_LLM", default=False)
    if n_samples is None:
        n_samples = int(os.getenv("JUDGE_SAMPLES", "1"))
    n_samples = max(1, n_samples)

    if fake:
        # 규칙기반은 결정적이라 1회면 충분(집계 로직은 동일 경로 사용)
        results = [_fake_judge(repo_context, trend, card)]
    else:
        prompt = build_judge_prompt(repo_context, trend, card)
        results = [_call_openai_judge(prompt) for _ in range(n_samples)]

    return _aggregate(results)
