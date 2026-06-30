from __future__ import annotations

import re
from collections.abc import Iterable


def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def uniq(items: Iterable[str], limit: int) -> list[str]:
    out: list[str] = []
    for item in items:
        if item and item not in out:
            out.append(item)
        if len(out) >= limit:
            break
    return out


def has(text: str, pattern: str) -> bool:
    return re.search(pattern, text, flags=re.IGNORECASE) is not None


def infer_type(text: str, default: str = "news") -> str:
    if has(text, r"\barxiv|paper|method|architecture|study|benchmarking\b"):
        return "paper"
    if has(text, r"\bbenchmark|leaderboard|eval(uation)? suite\b"):
        return "benchmark"
    if has(text, r"\brepo|github|library|framework|sdk|toolkit|cli|open[- ]source\b"):
        return "tool"
    return default


def weak_label(text: str) -> dict[str, list[str]]:
    t = text.lower()
    task = [
        "RAG" if has(t, r"\brag|retrieval|embedding|vector search|vector db|rerank") else "",
        "Agent" if has(t, r"\bagent|tool use|workflow|langgraph|multi-agent") else "",
        "Inference" if has(t, r"\binference|latency|throughput|batching|quantization|compression") else "",
        "Fine-tuning" if has(t, r"\bfine-?tun|lora|adapter|post-training|distillation") else "",
        "Evaluation" if has(t, r"\bevaluation|benchmark|leaderboard|judge|audit") else "",
        "Multimodal" if has(t, r"\bmultimodal|vision-language|vlm|speech|audio|ocr|image") else "",
    ]
    deps = [
        "LangChain" if "langchain" in t else "",
        "LangGraph" if "langgraph" in t else "",
        "Chroma" if has(t, r"\bchroma|chromadb\b") else "",
        "FAISS" if "faiss" in t else "",
        "PyTorch" if has(t, r"\bpytorch|torch\b") else "",
        "Transformers" if has(t, r"\btransformers|hugging ?face\b") else "",
    ]
    impact = [
        "accuracy" if has(t, r"\baccuracy|quality|recall|precision|rerank|relevance") else "",
        "speed" if has(t, r"\blatency|throughput|speed|fast|batching|realtime") else "",
        "cost" if has(t, r"\bcost|cheap|efficient|compression|quantization") else "",
        "security" if has(t, r"\bsecurity|vulnerability|prompt injection|misalignment|safety") else "",
        "productivity" if has(t, r"\bproductivity|developer|workflow|automation|tool use") else "",
        "scalability" if has(t, r"\bscale|scaling|distributed|parallel") else "",
    ]
    keywords = [
        keyword
        for keyword in [
            "retrieval",
            "embedding",
            "vector search",
            "reranker",
            "benchmark",
            "quantization",
            "tool use",
            "workflow",
            "safety",
            "ocr",
            "agent workflow",
        ]
        if keyword in t
    ]
    return {
        "task_tags": uniq(task, 3),
        "dependency_tags": uniq(deps, 5),
        "impact_tags": uniq(impact, 2),
        "keyword_tags": uniq(keywords, 10),
    }


def embedding_text(title: str, summary: str, labels: dict[str, list[str]]) -> str:
    tags = labels["task_tags"] + labels["dependency_tags"] + labels["impact_tags"] + labels["keyword_tags"]
    return clean(f"{title}. {summary}. Tags: {', '.join(tags)}.")

