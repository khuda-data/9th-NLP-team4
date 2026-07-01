from __future__ import annotations

from typing import Any

from .models import Trend


REQUIRED = {"trend_id", "source", "title", "summary", "url", "type"}
SOURCES = {"arxiv", "hackernews", "github"}
TYPES = {"paper", "tool", "repo", "news", "benchmark"}
TAG_LIMITS = {
    "task_tags": 3,
    "dependency_tags": 5,
    "impact_tags": 2,
    "keyword_tags": 10,
}
METADATA_KEYS = {
    "source_score": None,
    "stars": None,
    "forks": None,
    "comments": None,
    "language": None,
    "categories": [],
}


def complete_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(METADATA_KEYS)
    if metadata:
        merged.update(metadata)
    if merged.get("categories") is None:
        merged["categories"] = []
    return merged


def validate_trend(trend: Trend) -> list[str]:
    errors: list[str] = []
    missing = sorted(k for k in REQUIRED if not trend.get(k))
    if missing:
        errors.append(f"missing required fields: {', '.join(missing)}")
    if trend.get("source") and trend["source"] not in SOURCES:
        errors.append(f"invalid source: {trend['source']}")
    if trend.get("type") and trend["type"] not in TYPES:
        errors.append(f"invalid type: {trend['type']}")
    for field, limit in TAG_LIMITS.items():
        values = trend.get(field, [])
        if not isinstance(values, list):
            errors.append(f"{field} must be a list")
        elif len(values) > limit:
            errors.append(f"{field} exceeds maxItems={limit}")
    return errors


def is_valid_trend(trend: Trend) -> bool:
    return not validate_trend(trend)

