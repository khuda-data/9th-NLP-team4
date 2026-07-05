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
    if has(text, r"\bbenchmark|leaderboard|eval(uation)? suite\b"):
        return "benchmark"
    if has(text, r"\brepo|github|library|framework|sdk|toolkit|cli|open[- ]source|released?\b"):
        return "tool"
    if has(text, r"\barxiv|paper|method|architecture|study|benchmarking\b"):
        return "paper"
    return default


# ---------------------------------------------------------------------------
# 의존성(라이브러리) 태깅
#
# 핵심: dependency_tags 는 반드시 저장소의 requirements.txt / pyproject.toml /
# package.json 에 실제로 적히는 "정규 패키지명(소문자)"으로 내보낸다.
# 임팩트 게이트가 repo.dependencies ∩ trend.dependency_tags 를 강한 근거로
# 쓰기 때문에, 표시용 이름("PyTorch")이 아니라 설치명("torch")이어야 매칭된다.
#
# 값은 흔한 영어 단어와 충돌하지 않는 "구별 가능한" 라이브러리만 넣어 오탐을
# 억제한다. (예: "datasets", "accelerate" 같은 일반 단어 패키지는 제외)
# ---------------------------------------------------------------------------
DEPENDENCY_ALIASES: list[tuple[str, list[str]]] = [
    # LLM 오케스트레이션 / 에이전트
    ("langchain", [r"langchain"]),
    ("langgraph", [r"langgraph"]),
    ("llama-index", [r"llama[\s_-]?index", r"llamaindex", r"gpt[\s_-]?index"]),
    ("haystack", [r"\bhaystack\b"]),
    ("dspy", [r"\bdspy\b"]),
    ("litellm", [r"\blitellm\b"]),
    ("autogen", [r"\bautogen\b"]),
    ("crewai", [r"crew[\s_-]?ai"]),
    ("semantic-kernel", [r"semantic[\s_-]?kernel"]),
    ("instructor", [r"\binstructor\b"]),
    ("guardrails", [r"guardrails[\s_-]?ai"]),
    # LLM 제공자 SDK.
    #   주의: "gemini"/"mistral"/"claude" 같은 순수 모델명은 논문이 실험 대상으로
    #   언급만 해도 나오므로 의존성 신호로 쓰지 않는다(오탐 → 엉뚱한 강한 매칭).
    #   openai/anthropic/cohere 는 텍스트에 등장하면 해당 API를 쓴 신호로 본다.
    ("openai", [r"\bopenai\b"]),
    ("anthropic", [r"\banthropic\b"]),
    ("cohere", [r"\bcohere\b"]),
    ("google-generativeai", [r"generativeai"]),
    # 벡터 DB / 검색
    ("chromadb", [r"\bchroma(db)?\b"]),
    ("faiss", [r"\bfaiss\b"]),
    ("pinecone", [r"\bpinecone\b"]),
    ("weaviate", [r"\bweaviate\b"]),
    ("qdrant", [r"\bqdrant\b"]),
    ("milvus", [r"\bmilvus\b"]),
    ("pgvector", [r"\bpgvector\b"]),
    ("elasticsearch", [r"\belasticsearch\b"]),
    ("sentence-transformers", [r"sentence[\s_-]?transformers", r"\bsbert\b"]),
    ("rank-bm25", [r"\bbm25\b"]),
    # 서빙 / 추론
    ("vllm", [r"\bvllm\b"]),
    ("ollama", [r"\bollama\b"]),
    ("llama-cpp-python", [r"llama[\s._-]?cpp"]),
    ("tensorrt-llm", [r"tensorrt[\s_-]?llm", r"tensorrt"]),
    ("sglang", [r"\bsglang\b"]),
    ("text-generation-inference", [r"text[\s_-]generation[\s_-]inference", r"\btgi\b"]),
    ("onnxruntime", [r"\bonnxruntime\b"]),
    ("onnx", [r"\bonnx\b"]),
    ("openvino", [r"\bopenvino\b"]),
    ("triton", [r"triton[\s_-]?inference"]),
    # 학습 / 파인튜닝
    ("torch", [r"\bpytorch\b", r"\btorch\b"]),
    ("tensorflow", [r"\btensorflow\b", r"\bkeras\b"]),
    ("jax", [r"\bjax\b", r"\bflax\b"]),
    ("transformers", [r"\btransformers\b", r"hugging[\s_-]?face"]),
    ("diffusers", [r"\bdiffusers\b", r"stable[\s_-]diffusion"]),
    ("peft", [r"\bpeft\b", r"\bqlora\b", r"\blora\b"]),
    ("trl", [r"\btrl\b", r"\brlhf\b", r"\bdpo\b"]),
    ("unsloth", [r"\bunsloth\b"]),
    ("axolotl", [r"\baxolotl\b"]),
    ("deepspeed", [r"\bdeepspeed\b"]),
    ("bitsandbytes", [r"\bbitsandbytes\b"]),
    ("flash-attn", [r"flash[\s_-]?attention", r"flash[\s_-]?attn"]),
    ("xformers", [r"\bxformers\b"]),
    # 평가
    ("ragas", [r"\bragas\b"]),
    ("deepeval", [r"\bdeepeval\b"]),
    ("lm-eval", [r"lm[\s_-]?eval", r"lm[\s_-]evaluation[\s_-]harness"]),
    ("trulens", [r"\btrulens\b"]),
    # 멀티모달 / 음성
    ("openai-whisper", [r"\bwhisper\b"]),
    ("spacy", [r"\bspacy\b"]),
    # 앱 / 서비스 프레임워크
    ("fastapi", [r"\bfastapi\b"]),
    ("gradio", [r"\bgradio\b"]),
    ("streamlit", [r"\bstreamlit\b"]),
    ("chainlit", [r"\bchainlit\b"]),
    # 실험 추적 / 서빙 인프라
    ("mlflow", [r"\bmlflow\b"]),
    ("wandb", [r"\bwandb\b", r"weights[\s&_-]+biases"]),
    ("bentoml", [r"\bbentoml\b"]),
]


def detect_dependencies(text: str) -> list[str]:
    hits: list[str] = []
    for canonical, patterns in DEPENDENCY_ALIASES:
        if any(has(text, p) for p in patterns):
            hits.append(canonical)
    return hits


def weak_label(text: str) -> dict[str, list[str]]:
    t = text.lower()
    task = [
        "RAG" if has(t, r"\brag\b|retrieval[\s_-]augmented|retriever|reranker?|vector search|vector (db|database)|embedding") else "",
        "Agent" if has(t, r"\bagent(s|ic)?\b|tool[\s_-]use|function[\s_-]calling|workflow|langgraph|multi[\s_-]agent") else "",
        "Inference" if has(t, r"\binference|serving|latency|throughput|batching|quantization|kv[\s_-]cache|speculative decoding") else "",
        "Fine-tuning" if has(t, r"\bfine[\s_-]?tun|\blora\b|qlora|adapter|post[\s_-]training|distillation|rlhf|\bdpo\b|instruction[\s_-]tun") else "",
        "Evaluation" if has(t, r"\bevaluation|benchmark|leaderboard|llm[\s_-]judge|\beval\b|hallucination|red[\s_-]team") else "",
        "Multimodal" if has(t, r"\bmultimodal|vision[\s_-]language|\bvlm\b|speech|\baudio\b|\bocr\b|image|diffusion|text[\s_-]to[\s_-]") else "",
        "Safety" if has(t, r"\bsafety|guardrail|prompt injection|jailbreak|alignment|moderation|toxicity") else "",
    ]
    deps = detect_dependencies(t)
    impact = [
        "accuracy" if has(t, r"\baccuracy|quality|recall|precision|rerank|relevance|f1\b|state[\s_-]of[\s_-]the[\s_-]art|\bsota\b") else "",
        "speed" if has(t, r"\blatency|throughput|speed|faster|real[\s_-]?time|batching|acceleration") else "",
        "cost" if has(t, r"\bcost|cheaper|efficient|compression|quantization|token[\s_-]budget|memory footprint") else "",
        "security" if has(t, r"\bsecurity|vulnerabilit|prompt injection|jailbreak|misalignment|safety|privacy") else "",
        "productivity" if has(t, r"\bproductivity|developer|workflow|automation|tool use|copilot|assistant") else "",
        "scalability" if has(t, r"\bscale|scaling|distributed|parallel|throughput") else "",
    ]
    keyword_source = [
        ("retrieval", r"\bretrieval|retriever\b"),
        ("reranker", r"rerank"),
        ("embedding", r"embedding"),
        ("vector-search", r"vector (search|db|database)"),
        ("rag", r"\brag\b|retrieval[\s_-]augmented"),
        ("agent", r"\bagent"),
        ("tool-use", r"tool[\s_-]use|function[\s_-]calling"),
        ("quantization", r"quantization|\bgguf\b|\bawq\b|\bgptq\b"),
        ("fine-tuning", r"fine[\s_-]?tun|\blora\b|qlora"),
        ("benchmark", r"benchmark|leaderboard"),
        ("evaluation", r"\beval(uation)?\b|llm[\s_-]judge"),
        ("hallucination", r"hallucinat"),
        ("multimodal", r"multimodal|vision[\s_-]language|\bvlm\b"),
        ("ocr", r"\bocr\b"),
        ("speech", r"speech|\basr\b|\btts\b|whisper"),
        ("inference", r"inference|serving"),
        ("safety", r"safety|guardrail|jailbreak|prompt injection"),
        ("mcp", r"\bmcp\b|model context protocol"),
        ("prompt", r"prompt[\s_-]?(engineering|template|optim)"),
    ]
    keywords = [name for name, pat in keyword_source if has(t, pat)]
    # 감지된 라이브러리명도 키워드에 포함해 README/코드 본문 매칭 신호를 넓힌다.
    keywords = keywords + deps
    return {
        "task_tags": uniq(task, 3),
        "dependency_tags": uniq(deps, 5),
        "impact_tags": uniq(impact, 2),
        "keyword_tags": uniq(keywords, 10),
    }


# 저장소 코드와 대조할 실행 가능한 신호가 전혀 없는(순수 정책/오피니언/사건)
# 트렌드를 걸러내기 위한 잡음 신호. 태그가 하나도 없으면서 아래 단어가 보이면
# "일반 뉴스"로 보고 파이프라인에서 제외한다.
_POLICY_NOISE = re.compile(
    r"\b(lawsuit|patent|court|ruling|regulation|regulat|policy|ban(s|ned|ning)?|"
    r"congress|senate|antitrust|copyright|licens(e|ing) dispute|funding|"
    r"valuation|ipo|layoff|acquisition|earnings|stock|shares|stake|"
    r"government|white house|treasury|nationaliz|billion|investment|investor)\b",
    flags=re.IGNORECASE,
)


def is_actionable(trend: dict) -> bool:
    """코드↔트렌드 대조에 쓸 만한 실행 가능한 트렌드인지 판정.

    - 도구/레포/벤치마크는 그 자체로 대상이므로 유지.
    - 정책/시장/사건 뉴스는 (기업명이 라이브러리로 오탐돼 dependency_tags 가 붙어도)
      기술 신호인 task_tags 가 없으면 제외한다.
    - 나머지(논문 등)는 task_tags 나 dependency_tags 가 하나라도 있어야 유지.
    """
    if trend.get("type") in {"repo", "tool", "benchmark"}:
        return True
    text = f"{trend.get('title', '')} {trend.get('summary', '')}"
    if _POLICY_NOISE.search(text) and not trend.get("task_tags"):
        return False
    if trend.get("dependency_tags") or trend.get("task_tags"):
        return True
    # 태그도 없으면 대조할 근거가 없으므로 제외.
    return False


def embedding_text(title: str, summary: str, labels: dict[str, list[str]]) -> str:
    tags = labels["task_tags"] + labels["dependency_tags"] + labels["impact_tags"] + labels["keyword_tags"]
    return clean(f"{title}. {summary}. Tags: {', '.join(tags)}.")
