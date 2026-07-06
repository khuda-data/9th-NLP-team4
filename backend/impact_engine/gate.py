import math
import re
from pathlib import Path

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


# 의존성 파일에 섞여 들어오는 패키징/문서 잡음. 이런 이름은 트렌드 본문과의
# 매칭 근거로 쓰지 않는다. ("mit"이 "submitted"에 걸리는 식의 오탐 방지)
PACKAGING_NOISE = {
    "setuptools", "wheel", "pip", "hatchling", "hatchling.build", "poetry",
    "poetry-core", "flit", "flit_core", "build", "twine", "readme", "readme.md",
    "license", "mit", "src", "test", "tests", "docs", "main",
}


def _contains_dependency(text: str, dep: str) -> bool:
    """의존성명이 트렌드 본문에 '단어'로 등장하는지 판정한다.

    _contains_term의 부분문자열 매칭은 "mit" ⊂ "submitted" 같은 오탐을 내므로,
    의존성(강한 근거)에는 단어 경계를 요구한다. 하이픈/언더스코어 표기 차이는
    구분자 제거(compact) 후 같은 경계 규칙으로 흡수한다.
    """
    dep = _normalize(dep)
    if len(dep) < 3 or dep in PACKAGING_NOISE or dep in LANGUAGE_TAGS:
        return False

    text = _normalize(text)
    boundary = r"(?<![a-z0-9]){}(?![a-z0-9])"
    if re.search(boundary.format(re.escape(dep)), text):
        return True

    compact_dep = dep.replace("-", "").replace("_", "").replace(".", "")
    if compact_dep != dep and len(compact_dep) >= 4:
        compact_text = text.replace("-", "").replace("_", "").replace(".", "")
        return re.search(boundary.format(re.escape(compact_dep)), compact_text) is not None
    return False


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
    # 강한 근거의 '질'을 점수에 반영하기 위한 세부 신호.
    tag_matched_deps: set[str] = set()   # 패키지 태그 레벨 정합(가장 확실)
    title_matched_deps: set[str] = set()  # 트렌드 제목에 등장(트렌드가 그 라이브러리 자체에 관한 것)

    # === 강한 근거: 의존성 레벨 ===
    for dependency in sorted(repo_dependencies.intersection(dependency_tags)):
        strong_reasons.append(
            f"저장소 dependency와 트렌드 dependency_tags가 겹칩니다: {dependency}"
        )
        tag_matched_deps.add(dependency)
    for dependency in sorted(repo_dependencies):
        if _contains_dependency(trend_text, dependency):
            strong_reasons.append(
                f"저장소 dependency가 트렌드 내용에 등장합니다: {dependency}"
            )
            if _contains_dependency(trend.title, dependency):
                title_matched_deps.add(dependency)

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

    # 근거 강도로 점수를 결정적으로 매긴다(LLM의 85 쏠림 방지).
    #  - 강한 근거(저장소가 실제 쓰는 의존성과 직접 겹침): 85+ 대역.
    #  - 약한 근거(태그/본문/파일명 겹침)만 있으면: 그 종류 수·태그 겹침 수에 비례
    #    해 46~82 사이로 분산.
    # 같은 근거 강도라면 트렌드 자체의 주목도(GitHub 스타·HN 포인트)로 0~6점을
    # 가산해 미세하게 차등을 준다. 최소 근거(약한 2종)만 가진 항목들이 전부
    # 같은 점수로 벽을 이루는 것을 막는다.
    source_score = float((trend.metadata and trend.metadata.source_score) or 0)
    popularity_bonus = min(6, int(math.log10(source_score + 1) * 1.5))

    if strong_reasons:
        # 강한 대역 안에서도 근거의 질로 차등을 준다. "의존성 1개 + 약한 2종"
        # 패턴이 모두 같은 점수(92)로 몰리던 문제 방지:
        #  - 트렌드 제목에 그 라이브러리가 등장(트렌드가 라이브러리 자체 소식) +4
        #  - 패키지 태그 레벨 정합(dependency_tags 교집합) +4
        #  - 강한 근거 수(최대 3), 약한 종류 수, 주목도(0~3)로 미세 차등
        score = min(
            98,
            80
            + (4 if title_matched_deps else 0)
            + (4 if tag_matched_deps else 0)
            + 2 * min(len(strong_reasons), 3)
            + len(weak_kinds)
            + min(3, popularity_bonus),
        )
    else:
        # 약한 근거는 종류 수(넓이)와 총 근거 수(깊이)로 44~82 사이에 분산시켜,
        # 같은 '주제만 겹침' 항목들이 모두 같은 점수로 보이지 않게 한다.
        score = min(82, 44 + 4 * len(weak_kinds) + 5 * len(weak_reasons) + popularity_bonus)

    if strong_reasons or len(weak_kinds) >= 2:
        return GateResult(
            gate_result="pass",
            gate_reasons=(strong_reasons + weak_reasons)[:6],
            score=score,
            has_strong_dependency=bool(strong_reasons),
        )

    fail_reasons = ["저장소 맥락과 트렌드 사이의 구체적인 연결 근거가 부족합니다."]
    if _looks_like_general_ai_news(trend):
        fail_reasons.append(
            "이 트렌드는 저장소별 근거가 없는 일반 AI 시장 뉴스로 보입니다."
        )

    return GateResult(gate_result="fail", gate_reasons=fail_reasons, score=0)
