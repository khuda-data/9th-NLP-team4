"""LLM-judge rubric — 채점 기준과 프롬프트 생성.

판단 신뢰도(reliability)를 높이기 위한 핵심 장치가 여기 있다.
- 기준을 하나로 뭉치지 않고 4개로 분리(각각 앵커 있는 척도).
- 각 근거(evidence)를 repo_context에 실제로 존재하는지 대조하도록 강제 → 환각 검출.
- 출력은 고정된 JSON 스키마만 허용.
"""

from __future__ import annotations

import json
from typing import Any


# 채점 기준 정의 (사람이 읽는 앵커 = LLM이 자유롭게 점수 매기는 걸 막는 장치)
CRITERIA = {
    "relevance": {
        "질문": "이 트렌드가 이 repo에 실제로 의미 있는가?",
        "anchors": {
            "90-100": "repo의 구체적 구현/의존성과 직접 맞닿음",
            "70-89": "관련성이 분명하고 사용자에게 보여줄 가치 있음",
            "50-69": "일부 관련되나 근거가 약함",
            "0-49": "키워드만 겹치거나 무관",
        },
    },
    "classification": {
        "질문": "분류(impact/replacement_candidate/new_application/exclude)가 repo 근거상 맞는가?",
        "verdicts": ["correct", "borderline", "wrong"],
    },
    "groundedness": {
        "질문": "evidence와 주장(why_it_matters)이 주어진 repo_context에서 실제로 확인되는가? 지어낸 파일/사실은 없는가?",
        "anchors": {
            "90-100": "모든 근거가 repo_context에서 그대로 확인됨",
            "70-89": "대부분 확인되나 사소한 확대 해석",
            "50-69": "일부 근거가 repo에 없음",
            "0-49": "핵심 근거가 지어냄(환각)",
        },
    },
    "actionability": {
        "질문": "next_actions가 파일/함수 단위로 구체적이고 실행 가능한가?",
        "anchors": {
            "90-100": "특정 파일/모듈 + 실험/검증 방법까지 제시",
            "70-89": "관련 모듈 수준의 구체적 행동",
            "50-69": "프로젝트 수준의 일반적 방향만",
            "0-49": "'읽어보세요' 수준의 추상적 제안",
        },
    },
}

SYSTEM_INSTRUCTION = (
    "You are a strict senior engineer acting as an evaluation judge for CodePulse, "
    "a tool that tells a developer how an AI trend affects THEIR GitHub repo. "
    "You grade one ImpactCard against the repo context and trend it was generated from. "
    "Be skeptical. Only credit claims you can verify from the provided repo_context. "
    "If the card cites a file, dependency, or fact that is NOT in repo_context, treat it as hallucination."
)

OUTPUT_SCHEMA_HINT = {
    "relevance": {"score": "0-100 int", "reason": "짧은 근거"},
    "classification": {"verdict": "correct|borderline|wrong", "reason": "짧은 근거"},
    "groundedness": {
        "score": "0-100 int",
        "hallucinated_evidence": ["repo_context에 없는데 카드가 주장한 항목들"],
        "reason": "짧은 근거",
    },
    "actionability": {"score": "0-100 int", "reason": "짧은 근거"},
    "overall": {"verdict": "good|borderline|bad", "score": "0-100 int", "reason": "한 줄 총평"},
}


def build_judge_prompt(repo_context: dict[str, Any], trend: dict[str, Any], card: dict[str, Any]) -> str:
    """judge 한 번 호출에 넣을 프롬프트. 입력을 JSON 그대로 박아 애매함을 줄인다."""
    criteria_block = "\n".join(
        f"- {name}: {spec['질문']}" for name, spec in CRITERIA.items()
    )
    return f"""{SYSTEM_INSTRUCTION}

[채점 기준]
{criteria_block}

[점수 앵커]
- relevance / groundedness / actionability: 0~100 (아래 카드 데이터 근거로만 판단)
- classification: correct / borderline / wrong

[repo_context]
{json.dumps(repo_context, ensure_ascii=False, indent=2)}

[trend]
{json.dumps(trend, ensure_ascii=False, indent=2)}

[평가 대상 ImpactCard]
{json.dumps(card, ensure_ascii=False, indent=2)}

[지시]
1. card.evidence의 각 항목이 repo_context(readme, dependencies, file_tree, code_context, meta_tags)에서 실제로 확인되는지 하나씩 대조하라.
2. repo_context에 없는데 카드가 주장한 파일/의존성/사실은 groundedness.hallucinated_evidence 에 넣고 점수를 크게 깎아라.
3. 키워드만 겹치는 경우 relevance를 낮게 줘라.
4. next_actions가 '읽어보세요' 수준이면 actionability를 낮게 줘라.
5. 아래 형식의 valid JSON만 출력하라. 설명 문장 금지.

[출력 JSON 형식]
{json.dumps(OUTPUT_SCHEMA_HINT, ensure_ascii=False, indent=2)}
"""
