# Impact Engine Manual Testing

## Run the server

From the `backend` directory:

```bash
cd backend
export USE_FAKE_LLM=true
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

Use `USE_FAKE_LLM=true` for deterministic local testing without calling Gemini.
Use `USE_FAKE_LLM=false` to call Gemini with the API key configured in your local
environment. Do not print or commit API keys.

Gemini can temporarily return service errors such as `503 Service Unavailable`.
When that happens, the server should not crash. A failed LLM analysis returns a
hidden fallback card for `/api/impact`, and `/api/impact/batch` excludes that
hidden card while continuing to return other visible cards.

## Trend JSON schema

The current Trend JSON schema is aligned with the A-track final schema.
`trend_id` is the shared trend identifier between A-track and B-track.
Allowed `source` values are `arxiv`, `hackernews`, and `github`.
Allowed `type` values are `paper`, `tool`, `repo`, `news`, and `benchmark`.
Only `trend_id`, `source`, `title`, `summary`, `url`, and `type` are required.
`published_at`, `authors_or_org`, tag arrays, `raw_text`, `embedding_text`, and
`metadata` are optional. `metadata` is supporting information and is not required
for the core impact judgment.

## Open Swagger docs

Open:

```text
http://127.0.0.1:8000/docs
```

Swagger can be used to test `/health`, `/api/impact`, and `/api/impact/batch`
from the browser.

## Test health

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Test batch impact

Use the included sample request:

```bash
curl -X POST http://127.0.0.1:8000/api/impact/batch \
  -H "Content-Type: application/json" \
  --data @sample_data/sample_request.json
```

A successful response has a `cards` array. Hidden cards are excluded from the
batch response, so the image generation and general AI market trends should not
appear when the Rule Gate hides them.

Each visible card should include:

```json
{
  "trend_id": "trend_001",
  "classification": "replacement_candidate",
  "classification_label": "대체후보",
  "relevance_score": 82,
  "display_decision": "show",
  "evidence": ["저장소 맥락에 근거한 한국어 설명"],
  "why_it_matters": "한국어 설명",
  "next_actions": ["한국어 액션 1", "한국어 액션 2"],
  "related_files": ["rag/retriever.py"]
}
```

Exact scores and wording can vary when `USE_FAKE_LLM=false`.

If you are testing batch sorting, filtering, and hidden-card behavior, prefer
`USE_FAKE_LLM=true` so Gemini service instability does not affect the result.

## Test C-track analyze SSE

`POST /analyze` is the final C-track integration wrapper path. It returns
`text/event-stream`, and the frontend is expected to consume it with fetch
streaming rather than `EventSource`.

Trend loading order for `/analyze`:

1. `data_pipeline/output/trends.json`
2. fallback to `backend/sample_data/sample_request.json`

If `data_pipeline/output/trends.json` exists, it must be a JSON array of Trend
JSON objects. The backend does not fall back to sample data when that file
exists but is invalid.

```bash
curl -N -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"repoUrl":"github.com/khuda-team4/rag-chat-service"}'
```

`/analyze` uses the server-side `GEMINI_API_KEY` configured in `.env` when
`USE_FAKE_LLM=false`. The frontend does not send Gemini API keys. Never commit
the `.env` key to Git.

```bash
curl -N -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"repoUrl":"https://github.com/khuda-team4/rag-chat-service"}'
```

The stream should emit:

```text
event: job_created
event: step_update
event: step_update
event: step_update
event: step_update
event: step_update
event: step_update
event: step_update
event: step_update
event: completed
```

There are four logical steps, and each step emits `active` and `done`.
The completed result uses the C-track schema. In each result item,
`relatedFiles` is always an array; do not use `relatedFile`.

Temporary integration behavior:

- RepoContext is currently placeholder/sample-based and built from
  `sample_data/sample_request.json`.
- Trend data is loaded from `data_pipeline/output/trends.json` when present, or
  from the `trends` list in `sample_data/sample_request.json` when absent.
- These placeholders will later be replaced by C-track GitHub repo extraction
  and the finalized A-track Trend JSON provider.

Invalid repo URLs return the common error response:

```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"not-github"}'
```

Expected shape:

```json
{
  "error": {
    "code": "INVALID_REPO_URL",
    "message": "올바른 GitHub 레포 URL 형식이 아닙니다."
  }
}
```

## Re-fetch C-track analyze results

Use the `jobId` from the `job_created` SSE event:

```bash
curl "http://localhost:8000/analyze/job_a1b2c3d4/results"
```

If the job is still running, the endpoint returns HTTP 202:

```json
{
  "jobId": "job_a1b2c3d4",
  "status": "analyzing",
  "currentStep": 2
}
```

If the job is completed, it returns the same payload as the `completed` SSE
event. Unknown jobs return `JOB_NOT_FOUND` in the common error format.

## Test single impact

`/api/impact` expects one `repo` and one `trend`. You can copy the `repo` object
and any single trend from `sample_data/sample_request.json` in Swagger, or use a
minimal request like this:

```bash
curl -X POST http://127.0.0.1:8000/api/impact \
  -H "Content-Type: application/json" \
  -d '{
    "repo": {
      "repo_name": "pdf-rag-assistant",
      "repo_url": "https://github.com/user/pdf-rag-assistant",
      "readme": "PDF RAG project using FAISS and LangChain for document question answering.",
      "dependencies": ["faiss-cpu", "langchain", "openai"],
      "file_tree": ["rag/retriever.py", "rag/generator.py", "rag/prompts.py", "requirements.txt"],
      "code_context": "retriever.py performs FAISS top-k search before generator.py calls the LLM.",
      "meta_tags": ["RAG", "LLM", "PDF"]
    },
    "trend": {
      "trend_id": "trend_001",
      "source": "arxiv",
      "title": "New reranking method improves RAG retrieval quality",
      "summary": "A method for improving RAG retrieval quality using reranking after initial vector search.",
      "url": "https://arxiv.org/example-reranking",
      "published_at": "2026-06-28",
      "authors_or_org": ["Jane Doe", "John Smith"],
      "type": "paper",
      "task_tags": ["RAG", "Evaluation"],
      "dependency_tags": [],
      "impact_tags": ["accuracy"],
      "keyword_tags": ["retrieval", "reranker", "late interaction"],
      "embedding_text": "New reranking method improves RAG retrieval quality. RAG 시스템에서 초기 검색 결과를 reranker로 재정렬해 답변 품질을 높이는 방법을 제안한다. Tags: RAG, Evaluation, retrieval, reranker, late interaction.",
      "metadata": {
        "source_score": null,
        "stars": null,
        "forks": null,
        "comments": null,
        "language": null,
        "categories": ["cs.CL", "cs.AI"]
      }
    }
  }'
```

A successful response is one Impact Card object with the same schema shown above.

## Gemini mode

To test the real Gemini API call:

```bash
cd backend
export USE_FAKE_LLM=false
uvicorn main:app --reload
```

Make sure your local environment has `GEMINI_API_KEY` configured before starting
the server. Do not print the key in logs, terminal output, or documentation.

If Gemini returns a transient `502`, `503`, or `504`, the backend retries once.
If the retry still fails, the affected trend is converted to the safe hidden
fallback card instead of returning `Internal Server Error`.
