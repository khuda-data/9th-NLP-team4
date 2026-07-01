from __future__ import annotations

import math
import re
from collections import Counter

from .models import Trend


TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_+-]{1,}")


def vectorize(text: str) -> Counter[str]:
    return Counter(token.lower() for token in TOKEN_RE.findall(text))


def cosine(a: Counter[str], b: Counter[str]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def trend_score(trend: Trend) -> float:
    meta = trend.get("metadata", {})
    source_score = float(meta.get("source_score") or 0)
    tag_score = len(trend.get("task_tags", [])) * 2 + len(trend.get("dependency_tags", []))
    return source_score + tag_score


def deduplicate(trends: list[Trend], threshold: float = 0.85) -> tuple[list[Trend], list[list[str]]]:
    kept: list[Trend] = []
    kept_vecs: list[Counter[str]] = []
    groups: list[list[str]] = []

    for trend in trends:
        vec = vectorize(trend.get("embedding_text") or f"{trend.get('title', '')} {trend.get('summary', '')}")
        best_i = -1
        best_sim = 0.0
        for i, existing in enumerate(kept_vecs):
            sim = cosine(vec, existing)
            if sim > best_sim:
                best_i = i
                best_sim = sim
        if best_i >= 0 and best_sim >= threshold:
            existing = kept[best_i]
            groups.append([existing["trend_id"], trend["trend_id"]])
            if trend_score(trend) > trend_score(existing):
                kept[best_i] = trend
                kept_vecs[best_i] = vec
        else:
            kept.append(trend)
            kept_vecs.append(vec)
    return kept, groups

