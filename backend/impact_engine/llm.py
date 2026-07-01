import json
import os

import httpx
from dotenv import load_dotenv


GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
TRANSIENT_STATUS_CODES = {429, 502, 503, 504}


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _fake_response(prompt: str) -> str:
    prompt_lower = prompt.lower()

    classification = "new_application"
    score = 74
    evidence = ["Rule Gate가 저장소와 트렌드 사이의 구체적인 연결 근거를 찾았습니다."]
    next_actions = [
        "관련 파일을 기준으로 트렌드가 현재 구현에 영향을 주는 지점을 확인하세요.",
        "프로덕션 코드를 바꾸기 전에 작은 검증 작업으로 효과를 확인하세요.",
    ]
    related_files: list[str] = []

    if "rerank" in prompt_lower or "reranker" in prompt_lower:
        classification = "replacement_candidate"
        score = 82
        evidence = [
            "저장소 file_tree에 검색 로직과 연결되는 rag/retriever.py가 포함되어 있습니다.",
            "code_context에서 FAISS top-k 검색 이후 생성 단계로 넘어가는 흐름이 설명되어 있습니다.",
        ]
        next_actions = [
            "rag/retriever.py에서 FAISS 검색 결과 이후 reranking을 적용할 수 있는 위치를 확인하세요.",
            "샘플 PDF 질문으로 reranking 적용 전후의 답변 품질을 비교하세요.",
        ]
        related_files = ["rag/retriever.py"]
    elif "evaluation" in prompt_lower or "eval" in prompt_lower:
        classification = "new_application"
        score = 76
        evidence = [
            "저장소 meta_tags에 RAG가 포함되어 있어 검색 및 답변 품질 평가와 연결됩니다.",
            "트렌드는 RAG 검색 품질이나 답변 품질을 측정하는 평가 흐름을 다룹니다.",
        ]
        next_actions = [
            "현재 검색 결과를 기준으로 retrieval 품질을 점검하는 작은 평가 절차를 추가하세요.",
            "retriever 동작을 바꾸기 전에 기준 품질 지표를 먼저 기록하세요.",
        ]
    elif "langchain" in prompt_lower:
        classification = "impact"
        score = 88
        evidence = [
            "저장소 dependencies에 langchain이 포함되어 있습니다.",
            "README 또는 code_context가 RAG 기반 문서 질의응답 흐름을 설명합니다.",
        ]
        next_actions = [
            "LangChain 변경 사항이 현재 retriever 설정이나 RAG 흐름에 영향을 주는지 확인하세요.",
            "별도 브랜치에서 langchain 업데이트 후 기존 RAG 흐름을 실행해 회귀 여부를 점검하세요.",
        ]

    label_map = {
        "impact": "영향",
        "replacement_candidate": "대체후보",
        "new_application": "신규적용",
        "exclude": "제외",
    }

    return json.dumps(
        {
            "classification": classification,
            "classification_label": label_map[classification],
            "relevance_score": score,
            "display_decision": "show" if score >= 70 else "candidate",
            "evidence": evidence,
            "why_it_matters": "이 트렌드는 현재 저장소의 구현 방식과 연결되는 구체적 개선 가능성이 있습니다.",
            "next_actions": next_actions,
            "related_files": related_files,
        },
        ensure_ascii=False,
    )


async def call_llm(prompt: str, api_key: str | None = None) -> str:
    load_dotenv()

    if _env_flag("USE_FAKE_LLM", default=True):
        return _fake_response(prompt)

    provider = (os.getenv("LLM_PROVIDER") or "gemini").strip().lower()
    if provider == "openai":
        return await _call_openai(prompt, api_key)
    return await _call_gemini(prompt, api_key)


async def _call_openai(prompt: str, api_key: str | None = None) -> str:
    openai_api_key = api_key.strip() if api_key else os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is required when LLM_PROVIDER=openai and USE_FAKE_LLM is false"
        )

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {openai_api_key}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(2):
            try:
                response = await client.post(OPENAI_URL, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                break
            except httpx.HTTPStatusError as exc:
                if attempt == 0 and exc.response.status_code in TRANSIENT_STATUS_CODES:
                    continue
                raise
        else:
            raise RuntimeError("OpenAI request did not complete")

    try:
        generated_text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("OpenAI response did not contain generated text") from exc

    if not isinstance(generated_text, str) or not generated_text.strip():
        raise RuntimeError("OpenAI response text was empty")

    return generated_text


async def _call_gemini(prompt: str, api_key: str | None = None) -> str:
    gemini_api_key = api_key.strip() if api_key else os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required when USE_FAKE_LLM is false")

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(2):
            try:
                response = await client.post(
                    f"{GEMINI_URL}?key={gemini_api_key}",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                break
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                if attempt == 0 and status_code in TRANSIENT_STATUS_CODES:
                    continue
                raise
        else:
            raise RuntimeError("Gemini request did not complete")

    try:
        generated_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini response did not contain generated text") from exc

    if not isinstance(generated_text, str) or not generated_text.strip():
        raise RuntimeError("Gemini response text was empty")

    return generated_text


def extract_json(text: str) -> dict:
    try:
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError("JSON response must be an object")
        return data
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in LLM response")

    depth = 0
    in_string = False
    escaped = False

    for index in range(start, len(text)):
        char = text[index]

        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start : index + 1]
                try:
                    data = json.loads(candidate)
                except json.JSONDecodeError as exc:
                    raise ValueError("Extracted JSON object is invalid") from exc
                if not isinstance(data, dict):
                    raise ValueError("Extracted JSON response must be an object")
                return data

    raise ValueError("No complete JSON object found in LLM response")
