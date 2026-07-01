from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict


Source = Literal["arxiv", "hackernews", "github"]
TrendType = Literal["paper", "tool", "repo", "news", "benchmark"]


class TrendMetadata(TypedDict, total=False):
    source_score: float | None
    stars: int | None
    forks: int | None
    comments: int | None
    language: str | None
    categories: list[str]


class Trend(TypedDict, total=False):
    trend_id: str
    source: Source
    title: str
    summary: str
    url: str
    published_at: str
    authors_or_org: list[str]
    type: TrendType
    task_tags: list[str]
    dependency_tags: list[str]
    impact_tags: list[str]
    keyword_tags: list[str]
    raw_text: str
    embedding_text: str
    metadata: TrendMetadata


@dataclass
class PipelineState:
    raw_trends: list[dict[str, Any]] = field(default_factory=list)
    normalized_trends: list[Trend] = field(default_factory=list)
    labeled_trends: list[Trend] = field(default_factory=list)
    deduped_trends: list[Trend] = field(default_factory=list)
    duplicate_groups: list[list[str]] = field(default_factory=list)
    ingested_count: int = 0
    quality_report: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

