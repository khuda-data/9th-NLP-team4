# contracts/ — 트랙 간 공통 계약 (Single Source of Truth)

> 이 폴더의 스키마는 **모든 트랙이 따라야 하는 "법"** 이다.
> A(데이터)·B(엔진)·C(프론트)가 주고받는 JSON의 모양을 여기서 한 곳으로 고정한다.
> 코드보다 이 계약이 먼저다. **계약을 바꾸려면 반드시 PR + 관련 트랙 동의가 필요하다.**

## ⚠️ 지금 이 파일들은 전부 "초안(DRAFT)"입니다 — 여러분이 PR로 채워주세요

여기 스키마는 두 설계 문서에서 옮겨온 **시작점일 뿐, 확정본이 아닙니다.**
**자기 트랙이 생산/소비하는 JSON 형식은 본인이 주인**이니, 부족하거나 어색한 부분은
망설이지 말고 **바꾸는/추가하는 PR**을 올리세요. 초안은 깨지라고 있는 겁니다.

- 필드 추가/이름변경/삭제, 새 스키마 파일 추가 — 전부 PR로 환영.
- 브랜치 예: `docs/contracts-trend-schema`, `feat/A-trend-schema`
- PR 설명에 영향받는 트랙(producer/consumer)을 멘션하고, 합의되면 STATUS를 `AGREED`로.
- (절차 자세히는 아래 "바꾸는 법" 참고)

## 왜 이게 제일 중요한가

트랙이 갈려 있으면 가장 흔한 사고가 **"A가 주는 JSON이랑 B가 기대하는 JSON이 다름"** 이다.
필드 이름 하나(`trend_id` vs `id`)만 어긋나도 전체가 안 붙는다.
그래서 **각자 코드를 짜기 전에 이 계약부터 합의**하고, 모두 이 파일을 import/참조한다.

## 데이터 흐름과 계약

```
[A. 수집 파이프라인]  --trend.schema.json-->   [B. Impact Engine]
                                                     ↑
[C/온보딩: repo 입력] --repo_context.schema.json--/
                                                     |
[B. Impact Engine]   --impact_card.schema.json-->  [C. 프론트 피드]
```

| 계약 파일 | 누가 만들고(producer) | 누가 받나(consumer) | 주 담당 |
| --- | --- | --- | --- |
| `trend.schema.json` | A 수집 파이프라인 | B 엔진 / C 피드 | 곽민서(A) |
| `repo_context.schema.json` | C 온보딩 / repo 패커 | B 엔진 | 이수련(C) ↔ 신정안/이강훈(B) |
| `impact_card.schema.json` | B 엔진 | C 프론트 | 신정안/이강훈(B) ↔ 이수련(C) |

`examples/` 에는 각 스키마를 만족하는 **실제 예시 JSON**이 들어간다. (테스트·목업·프론트 더미데이터로 사용)

## 상태 표기

각 스키마 파일 상단 `"$comment"` 에 `STATUS: DRAFT | AGREED` 를 표기한다.
- **DRAFT**: 초안. 두 설계 문서에서 옮겨온 상태. 담당이 검토·수정 필요.
- **AGREED**: 관련 트랙이 PR에서 합의 완료. 이제부터 마음대로 못 바꿈(바꾸려면 또 PR).

## 바꾸는 법 (Breaking Change 규칙)

1. 필드를 **추가**(옵션)하는 건 비교적 안전 → PR에 producer/consumer 둘 다 멘션.
2. 필드를 **이름변경/삭제/타입변경**(breaking)하는 건 위험 → 반드시 양쪽 트랙 동의 + 같은 PR에서 examples도 같이 수정.
3. 합의되면 `$comment`의 STATUS를 `AGREED`로, `version`을 올린다.

## 검증 (선택)

JSON Schema(draft 2020-12)라서 `ajv` 등으로 examples가 스키마를 만족하는지 검증할 수 있다.
```bash
npx -y ajv-cli validate -s contracts/trend.schema.json -d "contracts/examples/trend.example.json" --spec=draft2020
```

## api 명세
### 1. `POST /analyze`
레포 url을 전달하여 분석 진행 event와 status, 진행 결과를 전달받는 엔드포인트. fetch streaming 방식으로 서버로부터 데이터를 받는다.

*body*
```
{
    "repoUrl": string
}
```

*response*
아래 4종류의 이벤트가 순서대로 전송된다.

1. job_created
작업 생성
```
event: job_created
data: {
  "jobId": string,
  "repoFullName": string,
}
```

2. step_update
단계 진행(총 8회 발생)
```
event: step_update
data: {"stepIndex": 0, "status": "active"}

event: step_update
data: {"stepIndex": 0, "status": "done"}

event: step_update
data: {"stepIndex": 1, "status": "active"}

event: step_update
data: {"stepIndex": 1, "status": "done"}

event: step_update
data: {"stepIndex": 2, "status": "active"}

event: step_update
data: {"stepIndex": 2, "status": "done"}

event: step_update
data: {"stepIndex": 3, "status": "active"}

event: step_update
data: {"stepIndex": 3, "status": "done"}
```
- `stepIndex`들은 /analyzing 화면 내 `레포 클론/트렌드 수집/코드-트렌드 대조/분류 결과 생성` 단계에 대응된다.

3. completed
분석 완료(결과 전체 포함)
```
event: completed
data: {
  "jobId": "job_a1b2c3d4",
  "repoFullName": "khuda-team4/rag-chat-service",
  "analyzedAt": "2026-06-28T09:31:00Z",
  "summary": {
    "totalTrendsScanned": 142,
    "matchedCount": 8,
    "countByCategory": {
      "replace": 3,
      "apply": 3,
      "impact": 2
    }
  },
  "results": [
    {
      "id": "res_t1",
      "category": "replace",
      "relevanceScore": 94,
      "title": "vLLM 0.9 — 연속 배칭",
      "source": {
        "name": "GitHub Trending",
        "url": "https://github.com/vllm-project/vllm",
        "publishedAt": "2026-06-27"
      },
      "reason": "지금 transformers.pipeline()로 요청을 순차 추론 중 — vLLM 연속 배칭이면 같은 GPU에서 처리량이 크게 올라요.",
      "relatedFile": "api/inference.py",
      "detail": "inference.py의 동기 추론 루프가 요청을 한 건씩 처리하고 있어 GPU 점유율이 낮습니다. vLLM의 continuous batching과 PagedAttention으로 바꾸면 같은 하드웨어에서 동시 처리량이 수 배 늘고, OpenAI 호환 서버로 띄우면 클라이언트 코드 변경도 거의 없습니다.",
      "recommendedAction": "추론 서버를 vLLM OpenAI-compatible 엔드포인트로 교체"
    },
    {
      "id": "res_t2",
      "category": "apply",
      "relevanceScore": 91,
      "title": "Structured Outputs (JSON Schema)",
      "source": {
        "name": "GitHub",
        "url": "https://github.com/google-gemini/cookbook",
        "publishedAt": "2026-06-27"
      },
      "reason": "분류 결과 JSON을 정규식으로 파싱 중 — 스키마 강제 출력으로 파싱 실패를 없앨 수 있어요.",
      "relatedFile": "api/analyze/route.ts",
      "detail": "route.ts가 모델 응답에서 정규식으로 JSON을 긁어냅니다. 가끔 깨진 JSON으로 실패하죠. Gemini의 구조화 출력(responseSchema)으로 카테고리·근거 필드를 강제하면 파싱 단계를 통째로 제거할 수 있습니다.",
      "recommendedAction": "responseSchema로 분류 출력 스키마를 고정"
    }
  ]
}
```

4. failed
분석 실패
```
event: failed
data: {
  "code": string,
  "message": string,
}
```

### 2. `GET /analyze/:jobId/results`
분석 결과를 재조회하는 엔드포인트. SSE 연결이 끊겨 `completed` 이벤트를 수신하지 못한 경우, `jobId`로 결과를 다시 조회한다.

*response*
`completed` 이벤트의 `data`와 동일한 구조를 반환한다.
```
{
  "jobId": "job_a1b2c3d4",
  "repoFullName": "khuda-team4/rag-chat-service",
  "analyzedAt": "2026-06-28T09:31:00Z",
  "summary": {
    "totalTrendsScanned": 142,
    "matchedCount": 8,
    "countByCategory": {
      "replace": 3,
      "apply": 3,
      "impact": 2
    }
  },
  "results": [
    {
      "id": "res_t1",
      "category": "replace",
      "relevanceScore": 94,
      "title": "vLLM 0.9 — 연속 배칭",
      "source": {
        "name": "GitHub Trending",
        "url": "https://github.com/vllm-project/vllm",
        "publishedAt": "2026-06-27"
      },
      "reason": "지금 transformers.pipeline()로 요청을 순차 추론 중 — vLLM 연속 배칭이면 같은 GPU에서 처리량이 크게 올라요.",
      "relatedFile": "api/inference.py",
      "detail": "inference.py의 동기 추론 루프가 요청을 한 건씩 처리하고 있어 GPU 점유율이 낮습니다. vLLM의 continuous batching과 PagedAttention으로 바꾸면 같은 하드웨어에서 동시 처리량이 수 배 늘고, OpenAI 호환 서버로 띄우면 클라이언트 코드 변경도 거의 없습니다.",
      "recommendedAction": "추론 서버를 vLLM OpenAI-compatible 엔드포인트로 교체"
    },
    {
      "id": "res_t2",
      "category": "apply",
      "relevanceScore": 91,
      "title": "Structured Outputs (JSON Schema)",
      "source": {
        "name": "GitHub",
        "url": "https://github.com/google-gemini/cookbook",
        "publishedAt": "2026-06-27"
      },
      "reason": "분류 결과 JSON을 정규식으로 파싱 중 — 스키마 강제 출력으로 파싱 실패를 없앨 수 있어요.",
      "relatedFile": "api/analyze/route.ts",
      "detail": "route.ts가 모델 응답에서 정규식으로 JSON을 긁어냅니다. 가끔 깨진 JSON으로 실패하죠. Gemini의 구조화 출력(responseSchema)으로 카테고리·근거 필드를 강제하면 파싱 단계를 통째로 제거할 수 있습니다.",
      "recommendedAction": "responseSchema로 분류 출력 스키마를 고정"
    },
    {
      "id": "res_t3",
      "category": "replace",
      "relevanceScore": 88,
      "title": "BGE-M3 다국어 임베딩",
      "source": {
        "name": "arXiv",
        "url": "https://arxiv.org/abs/2402.03216",
        "publishedAt": "2026-06-26"
      },
      "reason": "ada-002로 한국어 문서를 임베딩 중 — BGE-M3가 다국어·롱컨텍스트 검색에서 더 좋은 회수율을 보여요.",
      "relatedFile": "lib/embeddings.ts",
      "detail": "embeddings.ts가 OpenAI text-embedding-ada-002를 호출합니다. 한국어가 섞인 사내 문서 검색에서는 BGE-M3가 회수율이 높고, 8192 토큰까지 한 번에 임베딩해 청크 경계 손실이 줄어듭니다. 자체 호스팅하면 임베딩 비용도 사라집니다.",
      "recommendedAction": "임베딩 모델을 BGE-M3로 교체하고 벡터 차원 마이그레이션"
    }
  ]
}
```