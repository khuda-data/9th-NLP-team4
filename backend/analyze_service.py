import json
import os
import re
import secrets
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from impact_engine.impact_card import create_impact_card
from models import ImpactCard, RepoContext, TrendItem


PROJECT_ROOT = Path(__file__).resolve().parent.parent
A_TRACK_TRENDS_PATH = PROJECT_ROOT / "data_pipeline" / "output" / "trends.json"
SAMPLE_REQUEST_PATH = Path(__file__).parent / "sample_data" / "sample_request.json"


ERROR_MESSAGES = {
    "INVALID_REPO_URL": "올바른 GitHub 레포 URL 형식이 아닙니다.",
    "JOB_NOT_FOUND": "요청한 분석 작업을 찾을 수 없습니다.",
    "GEMINI_ERROR": "Gemini 호출 중 오류가 발생했습니다.",
    "INTERNAL_ERROR": "분석 중 오류가 발생했습니다.",
}


GITHUB_REPO_RE = re.compile(
    r"^(?:https://)?github\.com/"
    r"(?P<org>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)/?$"
)


class AnalyzeError(Exception):
    def __init__(self, code: str, status_code: int) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def make_job_id() -> str:
    return f"job_{secrets.token_hex(4)}"


def error_payload(code: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": ERROR_MESSAGES[code]}}


def normalize_repo_full_name(repo_url: str) -> str:
    if not repo_url or not repo_url.strip():
        raise AnalyzeError("INVALID_REPO_URL", 400)

    match = GITHUB_REPO_RE.match(repo_url.strip())
    if not match:
        raise AnalyzeError("INVALID_REPO_URL", 400)

    return f"{match.group('org')}/{match.group('repo')}"


def _load_sample_request() -> dict[str, Any]:
    with SAMPLE_REQUEST_PATH.open(encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise AnalyzeError("INTERNAL_ERROR", 500)
    return data


GITHUB_API = "https://api.github.com"
# 코드 컨텍스트로 유용한 파일 확장자. 트리에서 이런 파일 위주로 남긴다.
_CODE_SUFFIXES = (
    ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".rb",
    ".cpp", ".c", ".cs", ".kt", ".swift", ".php", ".ipynb", ".toml",
    ".txt", ".md", ".yaml", ".yml", ".json",
)
_DEP_FILES = ("requirements.txt", "pyproject.toml", "package.json", "environment.yml")


def _github_headers() -> dict[str, str]:
    headers = {"Accept": "application/vnd.github+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_dependencies(filename: str, text: str) -> list[str]:
    deps: list[str] = []
    if filename == "requirements.txt" or filename == "environment.yml":
        for raw in text.splitlines():
            line = raw.strip().lstrip("- ").strip()
            if not line or line.startswith("#"):
                continue
            name = re.split(r"[<>=!~;\[ ]", line, maxsplit=1)[0].strip()
            if name and name.lower() not in {"dependencies:", "pip:", "name:"}:
                deps.append(name)
    elif filename == "package.json":
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return []
        for section in ("dependencies", "devDependencies"):
            deps.extend((data.get(section) or {}).keys())
    elif filename == "pyproject.toml":
        for match in re.findall(r'"([A-Za-z0-9_.-]+)[^"]*"', text):
            deps.append(match)
    # 중복 제거하되 순서 유지, 상위 40개로 제한.
    seen: set[str] = set()
    unique: list[str] = []
    for dep in deps:
        if dep not in seen:
            seen.add(dep)
            unique.append(dep)
    return unique[:40]


def _fetch_github_repo_context(repo_full_name: str, repo_url: str) -> RepoContext | None:
    """GitHub 공개 API로 실제 레포 메타데이터를 수집한다. 실패하면 None."""
    try:
        with httpx.Client(
            timeout=8.0, headers=_github_headers(), follow_redirects=True
        ) as client:
            info_resp = client.get(f"{GITHUB_API}/repos/{repo_full_name}")
            if info_resp.status_code != 200:
                return None
            info = info_resp.json()
            default_branch = info.get("default_branch") or "main"

            # 언어 + 토픽을 meta_tags로.
            meta_tags: list[str] = list(info.get("topics") or [])
            try:
                lang_resp = client.get(f"{GITHUB_API}/repos/{repo_full_name}/languages")
                if lang_resp.status_code == 200:
                    for lang in lang_resp.json():
                        if lang not in meta_tags:
                            meta_tags.append(lang)
            except httpx.HTTPError:
                pass
            if info.get("language") and info["language"] not in meta_tags:
                meta_tags.append(info["language"])

            # README (raw). 앞부분만 사용.
            readme = info.get("description") or ""
            try:
                readme_resp = client.get(
                    f"{GITHUB_API}/repos/{repo_full_name}/readme",
                    headers={**_github_headers(), "Accept": "application/vnd.github.raw"},
                )
                if readme_resp.status_code == 200 and readme_resp.text.strip():
                    readme = readme_resp.text[:4000]
            except httpx.HTTPError:
                pass

            # 파일 트리 (recursive). 코드성 파일 위주로 최대 300개.
            file_tree: list[str] = []
            dep_candidates: dict[str, str] = {}
            try:
                tree_resp = client.get(
                    f"{GITHUB_API}/repos/{repo_full_name}/git/trees/{default_branch}",
                    params={"recursive": "1"},
                )
                if tree_resp.status_code == 200:
                    for node in tree_resp.json().get("tree", []):
                        if node.get("type") != "blob":
                            continue
                        path = node.get("path", "")
                        base = path.rsplit("/", 1)[-1]
                        if base in _DEP_FILES and base not in dep_candidates:
                            dep_candidates[base] = path
                        if path.endswith(_CODE_SUFFIXES) and len(file_tree) < 300:
                            file_tree.append(path)
            except httpx.HTTPError:
                pass

            # 의존성 파일 하나를 골라 파싱 (requirements.txt 우선).
            dependencies: list[str] = []
            for dep_name in _DEP_FILES:
                if dep_name not in dep_candidates:
                    continue
                try:
                    dep_resp = client.get(
                        f"{GITHUB_API}/repos/{repo_full_name}/contents/{dep_candidates[dep_name]}",
                        headers={**_github_headers(), "Accept": "application/vnd.github.raw"},
                    )
                    if dep_resp.status_code == 200:
                        dependencies = _parse_dependencies(dep_name, dep_resp.text)
                        if dependencies:
                            break
                except httpx.HTTPError:
                    continue

            top_dirs = sorted(
                {p.split("/", 1)[0] for p in file_tree if "/" in p}
            )[:8]
            code_context = (
                f"주 언어: {info.get('language') or '알 수 없음'}. "
                f"파일 {len(file_tree)}개, 주요 디렉터리: {', '.join(top_dirs) or '루트'}."
            )

            return RepoContext(
                repo_name=repo_full_name,
                repo_url=repo_url.strip(),
                readme=readme or None,
                dependencies=dependencies,
                file_tree=file_tree,
                code_context=code_context,
                meta_tags=meta_tags[:20],
            )
    except httpx.HTTPError:
        return None


def build_repo_context_from_url(repo_url: str) -> RepoContext:
    repo_full_name = normalize_repo_full_name(repo_url)

    # 1) 실제 GitHub 레포 컨텍스트를 우선 시도.
    context = _fetch_github_repo_context(repo_full_name, repo_url)
    if context is not None:
        return context

    # 2) 실패(비공개/삭제/rate limit/네트워크) 시 샘플 데이터로 폴백해 흐름을 유지.
    data = _load_sample_request()
    repo_data = dict(data.get("repo") or {})
    repo_data["repo_name"] = repo_full_name
    repo_data["repo_url"] = repo_url.strip()
    return RepoContext.model_validate(repo_data)


def load_trends() -> list[TrendItem]:
    if A_TRACK_TRENDS_PATH.exists():
        try:
            with A_TRACK_TRENDS_PATH.open(encoding="utf-8") as file:
                trends_data = json.load(file)
            if not isinstance(trends_data, list):
                raise ValueError("A-track trends output must be a JSON array")
            return [TrendItem.model_validate(trend) for trend in trends_data]
        except (OSError, ValueError, ValidationError) as exc:
            raise AnalyzeError("INTERNAL_ERROR", 500) from exc

    try:
        data = _load_sample_request()
        trends_data = data.get("trends")
        if not isinstance(trends_data, list):
            raise ValueError("sample request trends must be a JSON array")
        return [TrendItem.model_validate(trend) for trend in trends_data]
    except (OSError, ValueError, ValidationError) as exc:
        raise AnalyzeError("INTERNAL_ERROR", 500) from exc


def impact_card_to_result(card: ImpactCard, trend: TrendItem) -> dict[str, Any] | None:
    category_map = {
        "impact": "impact",
        "replacement_candidate": "replace",
        "new_application": "apply",
        "exclude": "exclude",
    }
    source_name_map = {
        "arxiv": "arXiv",
        "hackernews": "Hacker News",
        "github": "GitHub",
    }

    category = category_map[card.classification]
    if category == "exclude" or card.display_decision == "hide":
        return None

    return {
        "id": trend.trend_id,
        "category": category,
        "relevanceScore": card.relevance_score,
        "title": trend.title,
        "source": {
            "name": source_name_map[trend.source],
            "url": trend.url,
            "publishedAt": trend.published_at or "",
        },
        "reason": card.evidence[0] if card.evidence else "",
        "relatedFiles": card.related_files or [],
        "detail": card.why_it_matters,
        "recommendedAction": card.next_actions[0] if card.next_actions else "",
    }


def build_completed_result(
    job_id: str,
    repo_full_name: str,
    total_trends_scanned: int,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    visible_results = sorted(
        results,
        key=lambda result: result["relevanceScore"],
        reverse=True,
    )
    count_by_category = {
        "replace": sum(
            1 for result in visible_results if result["category"] == "replace"
        ),
        "apply": sum(1 for result in visible_results if result["category"] == "apply"),
        "impact": sum(
            1 for result in visible_results if result["category"] == "impact"
        ),
    }

    return {
        "jobId": job_id,
        "repoFullName": repo_full_name,
        "analyzedAt": datetime.now(UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "summary": {
            "totalTrendsScanned": total_trends_scanned,
            "matchedCount": len(visible_results),
            "countByCategory": count_by_category,
        },
        "results": visible_results,
    }


def classify_analyze_exception(exc: Exception) -> str:
    if isinstance(exc, AnalyzeError):
        return exc.code
    if isinstance(
        exc,
        (
            httpx.HTTPStatusError,
            httpx.RequestError,
            httpx.TimeoutException,
            RuntimeError,
            TimeoutError,
            ValueError,
            ValidationError,
        ),
    ):
        return "GEMINI_ERROR"
    return "INTERNAL_ERROR"


async def run_impact_analysis(
    repo: RepoContext,
    trends: list[TrendItem],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for trend in trends:
        card = await create_impact_card(
            repo,
            trend,
            suppress_llm_errors=False,
        )
        result = impact_card_to_result(card, trend)
        if result is not None:
            results.append(result)
    return results
