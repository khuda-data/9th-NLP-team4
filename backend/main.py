import json
import os
from collections.abc import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# 로컬 실행 시 backend/.env 를 읽어 os.environ 에 채운다.
# (배포 환경엔 .env 파일이 없고 env는 대시보드로 주입되므로 no-op)
load_dotenv()

from analyze_models import AnalyzeRequest
from analyze_service import (
    AnalyzeError,
    build_completed_result,
    build_repo_context_from_url,
    classify_analyze_exception,
    error_payload,
    fetch_user_repos,
    load_trends,
    make_job_id,
    normalize_repo_full_name,
    run_impact_analysis,
)
from impact_engine.impact_card import create_impact_card
from job_store import create_job, get_job, update_job
from models import ImpactBatchRequest, ImpactBatchResponse, ImpactCard, ImpactRequest


app = FastAPI(title="CodePulse Impact Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    # 배포된 프론트(Vercel)에서의 요청을 허용. *.vercel.app 프리뷰/프로덕션 도메인 매칭.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_response(code: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error_payload(code))


def _sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    if request.url.path == "/analyze":
        return _error_response("INVALID_REPO_URL", 400)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"status": "ok", "use_fake_llm": _env_flag("USE_FAKE_LLM", default=True)}


@app.get("/github/users/{username}/repos", response_model=None)
async def github_user_repos(username: str) -> JSONResponse:
    # 프론트의 레포 목록 조회를 서버 토큰(GITHUB_TOKEN)으로 프록시한다.
    # 인증 시 GitHub rate limit이 60/h → 5000/h 로 올라가고 토큰은 브라우저에 노출되지 않는다.
    try:
        repos = await fetch_user_repos(username)
    except AnalyzeError as exc:
        return _error_response(exc.code, exc.status_code)
    return JSONResponse(content=repos)


@app.post("/api/impact", response_model=ImpactCard)
async def impact(request: ImpactRequest) -> ImpactCard:
    return await create_impact_card(request.repo, request.trend)


@app.post("/api/impact/batch", response_model=ImpactBatchResponse)
async def impact_batch(request: ImpactBatchRequest) -> ImpactBatchResponse:
    cards = [
        await create_impact_card(request.repo, trend)
        for trend in request.trends
    ]
    visible_cards = [
        card for card in cards if card.display_decision != "hide"
    ]
    visible_cards.sort(key=lambda card: card.relevance_score, reverse=True)
    return ImpactBatchResponse(cards=visible_cards[:5])


@app.post("/analyze", response_model=None)
async def analyze(request: AnalyzeRequest) -> StreamingResponse | JSONResponse:
    try:
        repo_full_name = normalize_repo_full_name(request.repoUrl)
    except AnalyzeError as exc:
        return _error_response(exc.code, exc.status_code)

    job_id = make_job_id()
    create_job(job_id, repo_full_name)

    async def stream() -> AsyncIterator[str]:
        try:
            yield _sse_event(
                "job_created",
                {"jobId": job_id, "repoFullName": repo_full_name},
            )

            update_job(job_id, currentStep=0)
            yield _sse_event("step_update", {"stepIndex": 0, "status": "active"})
            repo = build_repo_context_from_url(request.repoUrl)
            yield _sse_event("step_update", {"stepIndex": 0, "status": "done"})

            update_job(job_id, currentStep=1)
            yield _sse_event("step_update", {"stepIndex": 1, "status": "active"})
            trends = load_trends()
            yield _sse_event("step_update", {"stepIndex": 1, "status": "done"})

            update_job(job_id, currentStep=2)
            yield _sse_event("step_update", {"stepIndex": 2, "status": "active"})
            results = await run_impact_analysis(repo, trends)
            yield _sse_event("step_update", {"stepIndex": 2, "status": "done"})

            update_job(job_id, currentStep=3)
            yield _sse_event("step_update", {"stepIndex": 3, "status": "active"})
            completed_result = build_completed_result(
                job_id,
                repo_full_name,
                len(trends),
                results,
            )
            update_job(job_id, status="completed", result=completed_result)
            yield _sse_event("step_update", {"stepIndex": 3, "status": "done"})
            yield _sse_event("completed", completed_result)
        except Exception as exc:
            code = classify_analyze_exception(exc)
            update_job(job_id, status="failed", error=error_payload(code)["error"])
            yield _sse_event("failed", error_payload(code)["error"])

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/analyze/{job_id}/results", response_model=None)
async def analyze_results(job_id: str) -> JSONResponse | dict:
    job = get_job(job_id)
    if job is None:
        return _error_response("JOB_NOT_FOUND", 404)

    if job["status"] == "analyzing":
        return JSONResponse(
            status_code=202,
            content={
                "jobId": job["jobId"],
                "status": "analyzing",
                "currentStep": job["currentStep"],
            },
        )

    if job["status"] == "completed":
        return job["result"]

    if job["status"] == "failed":
        error = job.get("error") or error_payload("INTERNAL_ERROR")["error"]
        status_code = 502 if error.get("code") == "GEMINI_ERROR" else 500
        return JSONResponse(status_code=status_code, content={"error": error})

    return _error_response("INTERNAL_ERROR", 500)
