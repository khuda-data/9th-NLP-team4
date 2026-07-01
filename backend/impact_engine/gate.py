from pathlib import Path
import re

from models import GateResult, RepoContext, TrendItem


def _normalize(value: str) -> str:
    return value.strip().lower()


def _normalized_set(values: list[str]) -> set[str]:
    return {_normalize(value) for value in values if value and value.strip()}


def _contains_term(text: str, term: str) -> bool:
    term = _normalize(term)
    if not term:
        return False

    text = _normalize(text)
    if len(term) <= 2:
        return re.search(rf"\b{re.escape(term)}\b", text) is not None

    compact_term = term.replace("-", "").replace("_", "")
    compact_text = text.replace("-", "").replace("_", "")
    return term in text or compact_term in compact_text


def _trend_text(trend: TrendItem) -> str:
    return " ".join(
        part
        for part in [
            trend.title,
            trend.summary,
            trend.raw_text or "",
            trend.embedding_text or "",
            " ".join(trend.task_tags),
            " ".join(trend.dependency_tags),
            " ".join(trend.impact_tags),
            " ".join(trend.keyword_tags),
        ]
        if part
    )


def _repo_text(repo: RepoContext) -> str:
    return " ".join(part for part in [repo.readme or "", repo.code_context or ""] if part)


def _related_file_reason(file_path: str, trend_text: str) -> str | None:
    filename = Path(file_path).name.lower()
    text = trend_text.lower()

    keyword_groups = {
        "retrieval": ["retriever", "retrieve", "retrieval", "rerank", "reranker"],
        "evaluation": ["eval", "evaluation", "benchmark", "metric"],
        "pdf": ["pdf"],
        "chain": ["chain", "langchain"],
        "agent": ["agent"],
        "embedding": ["embed", "embedding"],
    }

    for topic, keywords in keyword_groups.items():
        if any(keyword in filename for keyword in keywords) and any(
            keyword in text for keyword in keywords
        ):
            topic_labels = {
                "retrieval": "검색",
                "evaluation": "평가",
                "pdf": "PDF",
                "chain": "체인 구성",
                "agent": "에이전트",
                "embedding": "임베딩",
            }
            topic_label = topic_labels.get(topic, topic)
            return (
                f"저장소 file_tree에 {topic_label} 관련 파일인 "
                f"{file_path}가 포함되어 있습니다."
            )

    return None


def _looks_like_general_ai_news(trend: TrendItem) -> bool:
    text = _trend_text(trend).lower()
    general_terms = [
        "market",
        "funding",
        "valuation",
        "stock",
        "earnings",
        "revenue",
        "industry",
        "adoption",
        "regulation",
        "partnership",
        "survey",
    ]
    return any(term in text for term in general_terms)


def run_gate(repo: RepoContext, trend: TrendItem) -> GateResult:
    reasons: list[str] = []
    trend_text = _trend_text(trend)
    repo_text = _repo_text(repo)

    repo_meta_tags = _normalized_set(repo.meta_tags)
    task_tags = _normalized_set(trend.task_tags)
    impact_tags = _normalized_set(trend.impact_tags)
    keyword_tags = _normalized_set(trend.keyword_tags)

    task_overlap = repo_meta_tags.intersection(task_tags)
    impact_overlap = repo_meta_tags.intersection(impact_tags)
    keyword_overlap = repo_meta_tags.intersection(keyword_tags)
    for tag in sorted(task_overlap):
        reasons.append(f"저장소 meta_tags와 트렌드 task_tags가 겹칩니다: {tag}")
    for tag in sorted(impact_overlap):
        reasons.append(f"저장소 meta_tags와 트렌드 impact_tags가 겹칩니다: {tag}")
    for tag in sorted(keyword_overlap):
        reasons.append(f"저장소 meta_tags와 트렌드 keyword_tags가 겹칩니다: {tag}")

    repo_dependencies = _normalized_set(repo.dependencies)
    dependency_tags = _normalized_set(trend.dependency_tags)
    for dependency in sorted(repo_dependencies.intersection(dependency_tags)):
        reasons.append(
            f"저장소 dependency와 트렌드 dependency_tags가 겹칩니다: {dependency}"
        )

    for dependency in sorted(repo_dependencies):
        if _contains_term(trend_text, dependency):
            reasons.append(f"저장소 dependency가 트렌드 내용에 등장합니다: {dependency}")

    core_tags = task_tags.union(dependency_tags, impact_tags, keyword_tags)
    for tag in sorted(core_tags):
        if _contains_term(repo_text, tag):
            reasons.append(
                f"트렌드 태그가 저장소 README 또는 code_context에 등장합니다: {tag}"
            )

    for file_path in repo.file_tree:
        reason = _related_file_reason(file_path, trend_text)
        if reason:
            reasons.append(reason)

    # Keep the gate deterministic and concise.
    reasons = list(dict.fromkeys(reasons))

    if reasons:
        return GateResult(gate_result="pass", gate_reasons=reasons)

    fail_reasons = ["저장소 맥락과 트렌드 태그 사이의 구체적인 연결 근거를 찾지 못했습니다."]
    if _looks_like_general_ai_news(trend):
        fail_reasons.append(
            "이 트렌드는 저장소별 근거가 없는 일반 AI 시장 뉴스로 보입니다."
        )

    return GateResult(gate_result="fail", gate_reasons=fail_reasons)
