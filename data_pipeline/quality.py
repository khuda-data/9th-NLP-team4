from __future__ import annotations

from .models import PipelineState, Trend
from .schema import TAG_LIMITS, validate_trend


def ratio(count: int, total: int) -> float:
    return round(count / total, 4) if total else 0.0


def quality_report(state: PipelineState) -> dict[str, object]:
    trends: list[Trend] = state.deduped_trends or state.labeled_trends
    total = len(trends)
    validation_errors = [err for t in trends for err in validate_trend(t)]
    report = {
        "total_raw": len(state.raw_trends),
        "normalized": len(state.normalized_trends),
        "labeled": len(state.labeled_trends),
        "deduped": len(state.deduped_trends),
        "ingested": state.ingested_count,
        "missing_required_fields": sum(1 for t in trends if validate_trend(t)),
        "empty_task_tag_ratio": ratio(sum(1 for t in trends if not t.get("task_tags")), total),
        "empty_dependency_tag_ratio": ratio(sum(1 for t in trends if not t.get("dependency_tags")), total),
        "empty_impact_tag_ratio": ratio(sum(1 for t in trends if not t.get("impact_tags")), total),
        "tag_limit_exceeded": sum(
            1
            for t in trends
            for field, limit in TAG_LIMITS.items()
            if len(t.get(field, [])) > limit
        ),
        "duplicate_ratio": ratio(len(state.duplicate_groups), len(state.labeled_trends)),
        "source_distribution": {
            source: sum(1 for t in trends if t.get("source") == source)
            for source in ["arxiv", "hackernews", "github"]
        },
        "validation_errors": validation_errors[:20],
    }
    return report

