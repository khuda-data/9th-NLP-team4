from pathlib import Path
import re

from models import GateResult, RepoContext, TrendItem


# 언어 이름은 "주제가 겹친다"는 근거로 치지 않는다.
# (파이썬 레포가 'python' 키워드를 가진 모든 AI 트렌드와 무조건 겹치는 착시 방지)
LANGUAGE_TAGS = {
    "python", "javascript", "typescript", "java", "c", "c++", "cpp", "c#",
    "csharp", "go", "golang", "rust", "ruby", "php", "kotlin", "swift",
    "scala", "objective-c", "dart", "r", "matlab", "html", "css", "scss",
    "shell", "bash", "powershell", "dockerfile", "makefile", "cmake",
    "jupyter notebook", "jupyter", "vue", "svelte",
}


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
    """저장소↔트렌드의 연결 근거를 판정한다.

    우연한 단일 매칭(파일명 하나, 흔한 단어 하나)으로 통과해 엉뚱한 추천이
    생기는 걸 막기 위해, 근거를 강/약으로 나누고 다음일 때만 통과시킨다:
      - 강한 근거(의존성 레벨 매칭)가 1개 이상, 또는
      - 서로 다른 종류의 약한 근거가 2개 이상.
    """
    trend_text = _trend_text(trend)
    repo_text = _repo_text(repo)

    repo_meta_tags = _normalized_set(repo.meta_tags)
    repo_dependencies = _normalized_set(repo.dependencies)
    task_tags = _normalized_set(trend.task_tags)
    impact_tags = _normalized_set(trend.impact_tags)
    keyword_tags = _normalized_set(trend.keyword_tags)
    dependency_tags = _normalized_set(trend.dependency_tags)

    strong_reasons: list[str] = []
    weak_reasons: list[str] = []
    weak_kinds: set[str] = set()

    # === 강한 근거: 의존성 레벨 ===
    for dependency in sorted(repo_dependencies.intersection(dependency_tags)):
        strong_reasons.append(
            f"저장소 dependency와 트렌드 dependency_tags가 겹칩니다: {dependency}"
        )
    for dependency in sorted(repo_dependencies):
        # 2글자 이하 의존성명은 흔한 단어와 충돌하므로 제외.
        if len(dependency) >= 3 and _contains_term(trend_text, dependency):
            strong_reasons.append(
                f"저장소 dependency가 트렌드 내용에 등장합니다: {dependency}"
            )

    # === 약한 근거 1: meta_tags ↔ 트렌드 태그(언어 이름 제외) ===
    tag_overlap = (
        repo_meta_tags.intersection(task_tags | impact_tags | keyword_tags)
        - LANGUAGE_TAGS
    )
    for tag in sorted(tag_overlap):
        weak_reasons.append(f"저장소 meta_tags와 트렌드 태그가 겹칩니다: {tag}")
        weak_kinds.add("tag")

    # === 약한 근거 2: 구체적 트렌드 태그가 README/code_context에 등장 ===
    specific_tags = (
        task_tags | dependency_tags | impact_tags | keyword_tags
    ) - LANGUAGE_TAGS
    for tag in sorted(specific_tags):
        # 4글자 미만의 짧은 태그는 흔한 단어와 충돌하므로 본문 매칭에서 제외.
        if len(tag) >= 4 and _contains_term(repo_text, tag):
            weak_reasons.append(
                f"트렌드 태그가 저장소 README 또는 code_context에 등장합니다: {tag}"
            )
            weak_kinds.add("text")

    # === 약한 근거 3: file_tree 파일명 매칭 (단독 통과 불가, 보강 신호로만) ===
    for file_path in repo.file_tree:
        reason = _related_file_reason(file_path, trend_text)
        if reason:
            weak_reasons.append(reason)
            weak_kinds.add("file")

    strong_reasons = list(dict.fromkeys(strong_reasons))
    weak_reasons = list(dict.fromkeys(weak_reasons))

    if strong_reasons or len(weak_kinds) >= 2:
        return GateResult(
            gate_result="pass",
            gate_reasons=(strong_reasons + weak_reasons)[:6],
        )

    fail_reasons = ["저장소 맥락과 트렌드 사이의 구체적인 연결 근거가 부족합니다."]
    if _looks_like_general_ai_news(trend):
        fail_reasons.append(
            "이 트렌드는 저장소별 근거가 없는 일반 AI 시장 뉴스로 보입니다."
        )

    return GateResult(gate_result="fail", gate_reasons=fail_reasons)
