from __future__ import annotations

import argparse
import json

from .graph import run_langgraph, run_sequential


SAMPLE_RAW = [
    {
        "source": "arxiv",
        "arxiv_id": "2406.12345",
        "title": "New reranking method improves RAG retrieval quality",
        "summary": "RAG systems can improve retrieval accuracy by applying a reranker to initial vector search results.",
        "url": "https://arxiv.org/abs/2406.12345",
        "published_at": "2026-06-28",
        "authors": ["Jane Doe", "John Smith"],
        "metadata": {"categories": ["cs.CL", "cs.AI"]},
    },
    {
        "source": "github",
        "repo": "example/langgraph-rag-eval",
        "title": "example/langgraph-rag-eval",
        "summary": "LangGraph based RAG agent evaluation toolkit with Chroma integration.",
        "url": "https://github.com/example/langgraph-rag-eval",
        "published_at": "2026-06-27",
        "metadata": {"stars": 3200, "forks": 180, "source_score": 3200, "language": "Python"},
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CodePulse A-track data pipeline")
    parser.add_argument("--sample", action="store_true", help="Use built-in sample rows instead of external APIs")
    parser.add_argument("--langgraph", action="store_true", help="Run through the LangGraph StateGraph workflow")
    parser.add_argument("--output-dir", default="data_pipeline/output")
    parser.add_argument("--limit-per-source", type=int, default=20)
    args = parser.parse_args()

    raw = SAMPLE_RAW if args.sample else None
    runner = run_langgraph if args.langgraph else run_sequential
    state = runner(raw_trends=raw, output_dir=args.output_dir, limit_per_source=args.limit_per_source)
    print(json.dumps(state.quality_report, ensure_ascii=False, indent=2))
    if state.errors:
        print(json.dumps({"errors": state.errors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
