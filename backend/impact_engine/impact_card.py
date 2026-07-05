import logging
from typing import Any

import httpx
from impact_engine.gate import run_gate
from impact_engine.llm import call_llm, extract_json
from impact_engine.prompt import build_impact_prompt
from models import ImpactCard, RepoContext, TrendItem
from pydantic import ValidationError


logger = logging.getLogger(__name__)


ALLOWED_CLASSIFICATIONS = {
    "impact",
    "replacement_candidate",
    "new_application",
    "exclude",
}

CLASSIFICATION_LABELS = {
    "impact": "영향",
    "replacement_candidate": "대체후보",
    "new_application": "신규적용",
    "exclude": "제외",
}

LLM_FAILURE_ERRORS = (
    httpx.HTTPStatusError,
    httpx.RequestError,
    httpx.TimeoutException,
    RuntimeError,
    TimeoutError,
    ValueError,
    ValidationError,
)


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None and str(item).strip()]


def _clamp_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        score = 0
    return max(0, min(100, score))


def _safe_llm_failure_card(trend_id: str) -> ImpactCard:
    return ImpactCard(
        trend_id=trend_id,
        classification="exclude",
        classification_label="제외",
        relevance_score=0,
        display_decision="hide",
        evidence=["LLM 호출 실패로 트렌드 분석을 완료하지 못했습니다."],
        why_it_matters="일시적인 LLM 서비스 오류로 인해 이 트렌드의 영향을 판단하지 못했습니다.",
        next_actions=["잠시 후 다시 분석을 실행하세요."],
        related_files=[],
    )


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code} from Gemini API"
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        return "LLM request timed out"

    message = str(exc).strip() or "LLM request failed"
    if "?key=" in message:
        message = message.split("?key=", 1)[0] + "?key=<redacted>"
    return message


def normalize_impact_card(card_dict: dict[str, Any], trend_id: str) -> ImpactCard:
    classification = str(card_dict.get("classification", "exclude"))
    if classification not in ALLOWED_CLASSIFICATIONS:
        classification = "exclude"

    relevance_score = _clamp_score(card_dict.get("relevance_score", 0))
    evidence = _as_string_list(card_dict.get("evidence"))
    next_actions = _as_string_list(card_dict.get("next_actions"))
    related_files = _as_string_list(card_dict.get("related_files"))

    if classification == "exclude":
        display_decision = "hide"
    elif relevance_score >= 70:
        display_decision = "show"
    elif relevance_score >= 50:
        display_decision = "candidate"
    else:
        display_decision = "hide"

    if not evidence:
        display_decision = "hide"

    if display_decision == "show" and not next_actions:
        display_decision = "candidate"

    return ImpactCard(
        trend_id=trend_id,
        classification=classification,
        classification_label=CLASSIFICATION_LABELS[classification],
        relevance_score=relevance_score,
        display_decision=display_decision,
        evidence=evidence,
        why_it_matters=str(card_dict.get("why_it_matters") or ""),
        next_actions=next_actions,
        related_files=related_files,
    )


def _apply_gate_signal(card: ImpactCard, gate: "GateResult") -> ImpactCard:
    """LLM 결과에 게이트의 결정적 신호를 반영한다.

    - 관련도 점수는 근거 강도로 계산한 gate.score 를 사용한다(LLM의 85 쏠림 방지).
    - '영향(impact)'은 저장소가 실제로 쓰는 의존성과 직접 겹칠 때만 인정한다.
      강한 의존성 근거가 없는데 LLM이 impact라 하면 '신규적용'으로 낮춘다.
    - 바뀐 점수/분류에 맞춰 노출 여부(display_decision)를 다시 계산한다.
    """
    classification = card.classification
    if classification == "impact" and not gate.has_strong_dependency:
        classification = "new_application"

    score = gate.score

    if classification == "exclude":
        display_decision = "hide"
    elif score >= 70:
        display_decision = "show"
    elif score >= 50:
        display_decision = "candidate"
    else:
        display_decision = "hide"
    if not card.evidence:
        display_decision = "hide"
    if display_decision == "show" and not card.next_actions:
        display_decision = "candidate"

    return card.model_copy(
        update={
            "classification": classification,
            "classification_label": CLASSIFICATION_LABELS[classification],
            "relevance_score": score,
            "display_decision": display_decision,
        }
    )


async def create_impact_card(
    repo: RepoContext,
    trend: TrendItem,
    api_key: str | None = None,
    suppress_llm_errors: bool = True,
) -> ImpactCard:
    gate = run_gate(repo, trend)

    if gate.gate_result == "fail":
        return ImpactCard(
            trend_id=trend.trend_id,
            classification="exclude",
            classification_label="제외",
            relevance_score=0,
            display_decision="hide",
            evidence=gate.gate_reasons,
            why_it_matters="현재 저장소와 연결되는 구체적 근거를 찾지 못했습니다.",
            next_actions=[],
            related_files=[],
        )

    prompt = build_impact_prompt(repo, trend, gate)
    try:
        llm_text = await call_llm(prompt, api_key=api_key)
        card_dict = extract_json(llm_text)
        card = normalize_impact_card(card_dict, trend.trend_id)
        return _apply_gate_signal(card, gate)
    except LLM_FAILURE_ERRORS as exc:
        if not suppress_llm_errors:
            raise
        logger.warning(
            "LLM failure trend_id=%s error_type=%s error=%s",
            trend.trend_id,
            type(exc).__name__,
            _safe_error_message(exc),
        )
        return _safe_llm_failure_card(trend.trend_id)
