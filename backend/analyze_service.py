import json
import re
import secrets
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from impact_engine.impact_card import create_impact_card
from models import ImpactCard, RepoContext, TrendItem


PROJECT_ROOT = Path(__file__).resolve().parent.parent
A_TRACK_TRENDS_PATH = PROJECT_ROOT / "data_pipeline" / "output" / "trends.json"
SAMPLE_REQUEST_PATH = Path(__file__).parent / "sample_data" / "sample_request.json"


ERROR_MESSAGES = {
    "INVALID_REPO_URL": "올바른 GitHub 레포 URL 형식이 아닙니다.",
    "JOB_NOT_FOUND": "요청한 분석 작업을 찾을 수 없습니다.",
    "GEMINI_ERROR": "Gemini 호출 중 오류가 발생했습니다.",
    "INTERNAL_ERROR": "분석 중 오류가 발생했습니다.",
}


GITHUB_REPO_RE = re.compile(
    r"^(?:https://)?github\.com/"
    r"(?P<org>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)/?$"
)


class AnalyzeError(Exception):
    def __init__(self, code: str, status_code: int) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def make_job_id() -> str:
    return f"job_{secrets.token_hex(4)}"


def error_payload(code: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": ERROR_MESSAGES[code]}}


def normalize_repo_full_name(repo_url: str) -> str:
    if not repo_url or not repo_url.strip():
        raise AnalyzeError("INVALID_REPO_URL", 400)

    match = GITHUB_REPO_RE.match(repo_url.strip())
    if not match:
        raise AnalyzeError("INVALID_REPO_URL", 400)

    return f"{match.group('org')}/{match.group('repo')}"


def _load_sample_request() -> dict[str, Any]:
    with SAMPLE_REQUEST_PATH.open(encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise AnalyzeError("INTERNAL_ERROR", 500)
    return data


def build_repo_context_from_url(repo_url: str) -> RepoContext:
    repo_full_name = normalize_repo_full_name(repo_url)
    data = _load_sample_request()
    repo_data = dict(data.get("repo") or {})

    # TODO: Replace this placeholder with C-track GitHub repo context extraction.
    repo_data["repo_name"] = repo_full_name
    repo_data["repo_url"] = repo_url.strip()
    return RepoContext.model_validate(repo_data)


def load_trends() -> list[TrendItem]:
    if A_TRACK_TRENDS_PATH.exists():
        try:
            with A_TRACK_TRENDS_PATH.open(encoding="utf-8") as file:
                trends_data = json.load(file)
            if not isinstance(trends_data, list):
                raise ValueError("A-track trends output must be a JSON array")
            return [TrendItem.model_validate(trend) for trend in trends_data]
        except (OSError, ValueError, ValidationError) as exc:
            raise AnalyzeError("INTERNAL_ERROR", 500) from exc

    try:
        data = _load_sample_request()
        trends_data = data.get("trends")
        if not isinstance(trends_data, list):
            raise ValueError("sample request trends must be a JSON array")
        return [TrendItem.model_validate(trend) for trend in trends_data]
    except (OSError, ValueError, ValidationError) as exc:
        raise AnalyzeError("INTERNAL_ERROR", 500) from exc


def impact_card_to_result(card: ImpactCard, trend: TrendItem) -> dict[str, Any] | None:
    category_map = {
        "impact": "impact",
        "replacement_candidate": "replace",
        "new_application": "apply",
        "exclude": "exclude",
    }
    source_name_map = {
        "arxiv": "arXiv",
        "hackernews": "Hacker News",
        "github": "GitHub",
    }

    category = category_map[card.classification]
    if category == "exclude" or card.display_decision == "hide":
        return None

    return {
        "id": trend.trend_id,
        "category": category,
        "relevanceScore": card.relevance_score,
        "title": trend.title,
        "source": {
            "name": source_name_map[trend.source],
            "url": trend.url,
            "publishedAt": trend.published_at or "",
        },
        "reason": card.evidence[0] if card.evidence else "",
        "relatedFiles": card.related_files or [],
        "detail": card.why_it_matters,
        "recommendedAction": card.next_actions[0] if card.next_actions else "",
    }


def build_completed_result(
    job_id: str,
    repo_full_name: str,
    total_trends_scanned: int,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    visible_results = sorted(
        results,
        key=lambda result: result["relevanceScore"],
        reverse=True,
    )
    count_by_category = {
        "replace": sum(
            1 for result in visible_results if result["category"] == "replace"
        ),
        "apply": sum(1 for result in visible_results if result["category"] == "apply"),
        "impact": sum(
            1 for result in visible_results if result["category"] == "impact"
        ),
    }

    return {
        "jobId": job_id,
        "repoFullName": repo_full_name,
        "analyzedAt": datetime.now(UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "summary": {
            "totalTrendsScanned": total_trends_scanned,
            "matchedCount": len(visible_results),
            "countByCategory": count_by_category,
        },
        "results": visible_results,
    }


def classify_analyze_exception(exc: Exception) -> str:
    if isinstance(exc, AnalyzeError):
        return exc.code
    if isinstance(
        exc,
        (
            httpx.HTTPStatusError,
            httpx.RequestError,
            httpx.TimeoutException,
            RuntimeError,
            TimeoutError,
            ValueError,
            ValidationError,
        ),
    ):
        return "GEMINI_ERROR"
    return "INTERNAL_ERROR"


async def run_impact_analysis(
    repo: RepoContext,
    trends: list[TrendItem],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for trend in trends:
        card = await create_impact_card(
            repo,
            trend,
            suppress_llm_errors=False,
        )
        result = impact_card_to_result(card, trend)
        if result is not None:
            results.append(result)
    return results
