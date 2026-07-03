"""실제 레포 → 엔진(ImpactCard) → LLM-judge 품질 리포트 오케스트레이션.

흐름:
  1) 로컬 레포에서 RepoContext 생성 (기본: 이 CodePulse 레포 자신)
  2) data_pipeline/output/trends.json (실제 수집 트렌드) 로드
  3) 엔진(create_impact_card, gpt-4o-mini)으로 각 트렌드 → ImpactCard
  4) 노출(show/candidate) 카드를 LLM-judge(gpt-4o) 실모드로 채점
  5) 품질 리포트(md + json) 생성

사용:
  python -m eval.quality_report                       # 이 레포 자신
  python -m eval.quality_report --repo <경로>          # 다른 로컬 레포
  python -m eval.quality_report --limit 8              # 트렌드 개수 제한
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))                 # data_pipeline, eval
sys.path.insert(0, str(ROOT / "backend"))     # models, impact_engine

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "backend" / ".env")

from models import RepoContext, TrendItem, GateResult  # noqa: E402  (backend/models.py)
from impact_engine.impact_card import create_impact_card, normalize_impact_card  # noqa: E402
from impact_engine.prompt import build_impact_prompt  # noqa: E402
from impact_engine.llm import call_llm, extract_json  # noqa: E402
from eval.llm_judge.judge import judge_card  # noqa: E402

IGNORE = {".git", "node_modules", ".venv", "venv", "__pycache__", ".next", "dist",
          "build", "out", ".conda", "spike", "site-packages"}
CODE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx"}


def _read(path: Path, limit: int = 4000) -> str:
    try:
        return path.read_text(encoding="utf-8")[:limit]
    except Exception:
        return ""


def _git_remote(repo: Path) -> str:
    cfg = _read(repo / ".git" / "config", 8000)
    for line in cfg.splitlines():
        line = line.strip()
        if line.startswith("url = "):
            return line[len("url = "):].strip()
    return ""


def build_repo_context(repo: Path) -> RepoContext:
    # dependencies
    deps: list[str] = []
    for req in repo.rglob("requirements.txt"):
        if any(p in IGNORE for p in req.parts):
            continue
        for ln in _read(req).splitlines():
            ln = ln.strip()
            if ln and not ln.startswith("#"):
                deps.append(ln.split("=")[0].split(">")[0].split("<")[0].strip())
    for pkg in repo.rglob("package.json"):
        if any(p in IGNORE for p in pkg.parts):
            continue
        try:
            j = json.loads(_read(pkg, 20000))
            deps += list((j.get("dependencies") or {}).keys())
            deps += list((j.get("devDependencies") or {}).keys())
        except Exception:
            pass
    deps = sorted(set(d for d in deps if d))[:60]

    # file_tree
    files: list[str] = []
    for p in repo.rglob("*"):
        if p.is_dir() or any(part in IGNORE for part in p.parts):
            continue
        if p.suffix in CODE_EXT:
            files.append(str(p.relative_to(repo)).replace("\\", "/"))
    files = sorted(files)[:60]

    # code_context: 핵심 파일 몇 개 요약
    snippets = []
    for rel in ["backend/impact_engine/gate.py", "backend/impact_engine/llm.py",
                "data_pipeline/collectors.py", "codepulse-web/src/App.tsx"]:
        fp = repo / rel
        if fp.exists():
            snippets.append(f"# {rel}\n{_read(fp, 600)}")
    code_context = "\n\n".join(snippets)[:2500]

    # meta_tags: 의존성/파일 기반 간단 추론
    blob = (" ".join(deps) + " " + " ".join(files)).lower()
    tags = []
    for kw, tag in [("fastapi", "FastAPI"), ("uvicorn", "Backend/API"),
                    ("react", "React"), ("vite", "Frontend"),
                    ("httpx", "HTTP"), ("openai", "LLM"), ("gemini", "LLM"),
                    ("chroma", "RAG/VectorDB"), ("faiss", "RAG/VectorDB"),
                    ("langchain", "LLM")]:
        if kw in blob and tag not in tags:
            tags.append(tag)
    if "trend" in blob or "arxiv" in blob:
        tags.append("AI trends")

    readme = _read(repo / "README.md", 1500)
    return RepoContext(
        repo_name=repo.name,
        repo_url=_git_remote(repo),
        readme=readme,
        dependencies=deps,
        file_tree=files,
        code_context=code_context,
        meta_tags=tags,
    )


def load_trends(limit: int) -> list[TrendItem]:
    path = ROOT / "data_pipeline" / "output" / "trends.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return [TrendItem.model_validate(t) for t in data[:limit]]


async def _card_no_gate(repo: RepoContext, trend: TrendItem):
    """게이트를 우회하고 LLM 분류만 실행. (게이트가 실데이터를 100% 거를 때 카드 품질을 보기 위함)"""
    gate = GateResult(gate_result="pass", gate_reasons=["(평가용: gate 우회)"])
    prompt = build_impact_prompt(repo, trend, gate)
    llm_text = await call_llm(prompt)
    card_dict = extract_json(llm_text)
    return normalize_impact_card(card_dict, trend.trend_id)


async def run_engine(repo: RepoContext, trends: list[TrendItem], no_gate: bool = False):
    cards = []
    for t in trends:
        if no_gate:
            card = await _card_no_gate(repo, t)
        else:
            card = await create_impact_card(repo, t, suppress_llm_errors=True)
        cards.append((t, card))
    return cards


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(ROOT), help="분석할 로컬 레포 경로(기본: CodePulse 자신)")
    ap.add_argument("--limit", type=int, default=12, help="트렌드 개수 제한")
    ap.add_argument("--judge-samples", type=int, default=1, help="judge self-consistency 횟수")
    ap.add_argument("--no-gate", action="store_true",
                    help="Rule Gate를 우회하고 LLM 분류를 직접 실행(게이트가 전부 거를 때 카드 품질 확인용)")
    args = ap.parse_args()

    repo_path = Path(args.repo).resolve()
    print(f"[1/4] RepoContext 생성: {repo_path.name}")
    repo = build_repo_context(repo_path)
    print(f"      deps={len(repo.dependencies)} files={len(repo.file_tree)} tags={repo.meta_tags}")

    print("[2/4] 트렌드 로드")
    trends = load_trends(args.limit)
    print(f"      {len(trends)}건")

    mode = "gate 우회(LLM 직접)" if args.no_gate else "정상(Rule Gate 포함)"
    print(f"[3/4] 엔진 실행 (gpt-4o-mini, {mode}) — 트렌드별 ImpactCard 생성")
    cards = asyncio.run(run_engine(repo, trends, no_gate=args.no_gate))
    shown = [(t, c) for t, c in cards if c.display_decision in {"show", "candidate"}]
    if not shown:
        print(f"      노출 카드 0건. 전체 {len(cards)}건을 judge 대상으로 사용(엔진이 hide로 분류한 것 포함).")
        shown = cards
    else:
        print(f"      노출(show/candidate) {len(shown)} / 전체 {len(cards)}")

    print(f"[4/4] LLM-judge 실행 (gpt-4o, samples={args.judge_samples}) — 노출 카드 품질 채점")
    judged = []
    for t, c in shown:
        card_dict = c.model_dump()
        trend_dict = t.model_dump()
        verdict = judge_card(repo.model_dump(), trend_dict, card_dict,
                             n_samples=args.judge_samples, fake=False)
        judged.append({"trend": trend_dict, "card": card_dict,
                       "judge": {k: v for k, v in verdict.items() if k != "raw"}})
        j = judged[-1]["judge"]
        print(f"      [{t.trend_id}] {j['overall_verdict']}({j['overall_score']}) "
              f"rel={j['relevance']} ground={j['groundedness']} act={j['actionability']}"
              + (f"  [!]환각:{j['hallucinated_evidence']}" if j['hallucinated_evidence'] else ""))

    write_report(repo, cards, judged)


def write_report(repo: RepoContext, cards, judged) -> None:
    out_dir = ROOT / "eval" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()
    md_path = out_dir / f"quality_report_{repo.repo_name}_{stamp}.md"
    json_path = out_dir / f"quality_report_{repo.repo_name}_{stamp}.json"

    n = len(judged)
    dist: dict[str, int] = {}
    halluc = 0
    if n:
        for j in judged:
            v = j["judge"]["overall_verdict"]
            dist[v] = dist.get(v, 0) + 1
            if j["judge"]["hallucinated_evidence"]:
                halluc += 1
        avg = {k: round(sum(x["judge"][k] for x in judged) / n, 1)
               for k in ("relevance", "groundedness", "actionability", "overall_score")}
    else:
        avg = {}

    lines = [
        f"# 품질 리포트 — {repo.repo_name} ({stamp})",
        "",
        f"- 분석 레포: `{repo.repo_url or repo.repo_name}` (tags: {', '.join(repo.meta_tags)})",
        f"- 트렌드: {len(cards)}건 → 노출(show/candidate) {n}건이 judge 대상",
        f"- 엔진: gpt-4o-mini / judge: gpt-4o (실모드)",
        "",
        "## 종합",
        f"- judge 판정 분포: {dist}",
        f"- 평균 점수: {avg}",
        f"- 환각 근거 검출 카드: {halluc}건",
        "",
        "> 주의: 이 리포트에는 사람 gold 라벨이 없어 judge 자체의 신뢰도(일치율)는 미검증입니다. "
        "발표용으로는 소량 gold를 달아 judge를 먼저 검증한 뒤 수치를 인용하세요.",
        "",
        "## 카드별 상세",
    ]
    for item in sorted(judged, key=lambda x: x["judge"]["overall_score"], reverse=True):
        t, c, j = item["trend"], item["card"], item["judge"]
        lines += [
            f"### [{j['overall_verdict']}] {t['title']}  (score {j['overall_score']})",
            f"- trend: `{t['trend_id']}` ({t['source']}) — {t['url']}",
            f"- 엔진 분류: {c['classification_label']} / relevance {c['relevance_score']} / {c['display_decision']}",
            f"- judge: relevance={j['relevance']} groundedness={j['groundedness']} "
            f"actionability={j['actionability']} classification={j['classification_verdict']} conf={j['confidence']}",
        ]
        if j["hallucinated_evidence"]:
            lines.append(f"- ⚠ 환각 근거: {j['hallucinated_evidence']}")
        lines.append(f"- why: {c['why_it_matters']}")
        lines.append("")

    md_path.write_text("\n".join(lines), encoding="utf-8")
    json_path.write_text(json.dumps({
        "repo": repo.model_dump(), "summary": {"dist": dist, "avg": avg, "hallucination_cards": halluc},
        "judged": judged,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n리포트 저장:\n  {md_path}\n  {json_path}")


if __name__ == "__main__":
    main()
