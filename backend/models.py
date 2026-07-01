from typing import Literal

from pydantic import BaseModel, Field


class RepoContext(BaseModel):
    repo_name: str
    repo_url: str | None = None
    readme: str | None = None
    dependencies: list[str] = Field(default_factory=list)
    file_tree: list[str] = Field(default_factory=list)
    code_context: str | None = None
    meta_tags: list[str] = Field(default_factory=list)


class TrendMetadata(BaseModel):
    source_score: float | None = None
    stars: int | None = None
    forks: int | None = None
    comments: int | None = None
    language: str | None = None
    categories: list[str] = Field(default_factory=list)


class TrendItem(BaseModel):
    trend_id: str
    source: Literal["arxiv", "hackernews", "github"]
    title: str
    summary: str
    url: str
    type: Literal["paper", "tool", "repo", "news", "benchmark"]
    published_at: str | None = None
    authors_or_org: list[str] = Field(default_factory=list)
    task_tags: list[str] = Field(default_factory=list)
    dependency_tags: list[str] = Field(default_factory=list)
    impact_tags: list[str] = Field(default_factory=list)
    keyword_tags: list[str] = Field(default_factory=list)
    raw_text: str | None = None
    embedding_text: str | None = None
    metadata: TrendMetadata | None = None


class ImpactRequest(BaseModel):
    repo: RepoContext
    trend: TrendItem


class ImpactBatchRequest(BaseModel):
    repo: RepoContext
    trends: list[TrendItem] = Field(default_factory=list)


class GateResult(BaseModel):
    gate_result: Literal["pass", "fail"]
    gate_reasons: list[str] = Field(default_factory=list)


class ImpactCard(BaseModel):
    trend_id: str
    classification: Literal[
        "impact",
        "replacement_candidate",
        "new_application",
        "exclude",
    ]
    classification_label: Literal["영향", "대체후보", "신규적용", "제외"]
    relevance_score: int
    display_decision: Literal["show", "candidate", "hide"]
    evidence: list[str] = Field(default_factory=list)
    why_it_matters: str
    next_actions: list[str] = Field(default_factory=list)
    related_files: list[str] = Field(default_factory=list)


class ImpactBatchResponse(BaseModel):
    cards: list[ImpactCard] = Field(default_factory=list)
