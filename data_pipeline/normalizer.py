from __future__ import annotations

import re
from typing import Any

from .models import Trend
from .schema import complete_metadata
from .tagging import clean, embedding_text, infer_type, weak_label


def stable_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:80] or "unknown"


def normalize_raw(raw: dict[str, Any]) -> Trend:
    source = str(raw.get("source", "")).lower()
    if source in {"hn", "hacker-news", "hacker_news"}:
        source = "hackernews"
    if source not in {"arxiv", "hackernews", "github"}:
        raise ValueError(f"unsupported source: {source}")

    title = clean(raw.get("title"))
    summary = clean(raw.get("summary") or raw.get("description") or title)
    raw_text = clean(raw.get("raw_text") or raw.get("abstract") or raw.get("text") or summary)
    url = clean(raw.get("url"))
    published_at = clean(raw.get("published_at") or raw.get("published") or raw.get("created_at"))
    authors_or_org = raw.get("authors_or_org") or raw.get("authors") or raw.get("org") or []
    if isinstance(authors_or_org, str):
        authors_or_org = [authors_or_org]

    metadata = complete_metadata(raw.get("metadata"))
    if source == "arxiv":
        arxiv_id = raw.get("arxiv_id") or url.split("/abs/")[-1].replace("v1", "")
        trend_id = f"arxiv_{clean(arxiv_id)}"
        trend_type = "paper"
    elif source == "hackernews":
        object_id = raw.get("object_id") or raw.get("id") or stable_slug(title)
        trend_id = f"hackernews_{object_id}"
        trend_type = infer_type(title + " " + summary, "news")
    else:
        repo = raw.get("repo") or raw.get("full_name") or title
        trend_id = f"github_{stable_slug(str(repo))}"
        trend_type = "repo"

    labels = weak_label(f"{title} {summary} {raw_text}")
    trend: Trend = {
        "trend_id": trend_id,
        "source": source,  # type: ignore[typeddict-item]
        "title": title,
        "summary": summary,
        "url": url,
        "published_at": published_at,
        "authors_or_org": list(authors_or_org),
        "type": trend_type,  # type: ignore[typeddict-item]
        **labels,
        "raw_text": raw_text,
        "embedding_text": embedding_text(title, summary, labels),
        "metadata": metadata,
    }
    return trend

