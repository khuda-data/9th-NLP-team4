from __future__ import annotations

import json
from pathlib import Path

from .models import Trend


def write_json(path: str | Path, trends: list[Trend]) -> int:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(trends, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(trends)


def write_chroma_or_jsonl(path: str | Path, trends: list[Trend], collection_name: str = "codepulse_trends") -> int:
    """Store in Chroma when chromadb is installed; otherwise write JSONL fallback.

    Chroma is optional here so the A-track MVP remains runnable without network
    installs. The same Trend JSON contract is preserved in both modes.
    """
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        import chromadb  # type: ignore

        client = chromadb.PersistentClient(path=str(target))
        collection = client.get_or_create_collection(collection_name)
        collection.upsert(
            ids=[t["trend_id"] for t in trends],
            documents=[t.get("embedding_text", "") for t in trends],
            metadatas=[
                {
                    "source": t.get("source", ""),
                    "type": t.get("type", ""),
                    "task_tags": "|".join(t.get("task_tags", [])),
                    "dependency_tags": "|".join(t.get("dependency_tags", [])),
                    "impact_tags": "|".join(t.get("impact_tags", [])),
                    "published_at": t.get("published_at", ""),
                }
                for t in trends
            ],
        )
        return len(trends)
    except Exception:
        fallback = target if target.suffix == ".jsonl" else target / "trends.jsonl"
        fallback.parent.mkdir(parents=True, exist_ok=True)
        with fallback.open("w", encoding="utf-8") as f:
            for trend in trends:
                f.write(json.dumps(trend, ensure_ascii=False) + "\n")
        return len(trends)

