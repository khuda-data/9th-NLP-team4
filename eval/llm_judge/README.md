# llm_judge — ImpactCard 품질 자동 채점 (LLM-as-judge)

엔진이 만든 **ImpactCard**가 그 입력(repo_context + trend)에 비춰 "맞는 판단"인지 LLM이 채점한다.
사람이 카드 하나하나 검수하는 비용을 줄이면서, **판단의 신뢰도(reliability)** 를 최대한 끌어올리는 게 목표.

## 무엇을 채점하나 (4개 기준 분리)

한 덩어리 점수로 뭉치지 않고, 서로 다른 걸 재는 4개로 나눈다 (`rubric.py`).

| 기준 | 질문 |
| --- | --- |
| relevance | 이 트렌드가 이 repo에 실제로 의미 있나? |
| classification | 분류(영향/대체후보/신규적용/제외)가 근거상 맞나? |
| groundedness | 근거·주장이 repo_context에서 실제 확인되나? **지어낸 파일/사실은 없나?** |
| actionability | next_actions가 파일/함수 단위로 실행 가능한가? |

## 판단 신뢰도를 높이는 7가지 장치

단순히 "LLM아 점수 매겨줘"는 흔들린다. 그래서:

1. **앵커 있는 rubric** — 각 점수 구간의 뜻을 명시해 LLM의 임의 채점을 억제.
2. **구조화 JSON 강제** — `response_format=json_object`로 항상 파싱 가능한 고정 스키마.
3. **temperature 0** — 채점은 창의성이 아니라 일관성.
4. **self-consistency(다회 투표)** — 같은 입력을 K번 채점해 점수는 중앙값, 판정은 다수결로 집계. 분산이 작고 합의가 높을수록 `confidence`를 높게 준다. (`--samples 5`)
5. **근거 환각 검출** — 카드가 인용한 파일/의존성이 repo_context에 실제로 있는지 대조. 없으면 `hallucinated_evidence`로 잡고 groundedness를 크게 깎는다. (엔진이 지어내는 걸 정조준)
6. **judge ≠ generator 모델** — 자기편향 완화를 위해 judge 기본 모델은 `gpt-4o`(엔진은 `gpt-4o-mini`). `JUDGE_MODEL`로 변경.
7. **사람 gold로 judge 검증** — judge를 대량에 쓰기 전에, 사람이 매긴 소량 gold와의 일치율부터 잰다(`agreement.py`). 0.8 미만이면 "judge 보정 필요"로 표시.

추가로 **무비용 fake 모드**(규칙 기반 결정적 judge)를 제공한다. API 키 없이 동작 확인/CI가 가능하고, LLM judge와 교차검증하는 baseline 역할도 한다.

## 실행

```bash
# 무비용 규칙기반 (API 키 불필요)
python -m eval.llm_judge.run_judge --input eval/llm_judge/samples/sample_cards.json --fake

# 실제 OpenAI judge (backend/.env의 OPENAI_API_KEY 사용, self-consistency 5회)
python -m eval.llm_judge.run_judge --input eval/llm_judge/samples/sample_cards.json --samples 5 --output out.json
```

환경변수(선택): `JUDGE_MODEL`(기본 gpt-4o), `JUDGE_SAMPLES`, `JUDGE_FAKE=true`.

## 입력 형식

```json
[
  {
    "id": "샘플id",
    "repo_context": { ... },   // contracts/repo_context.schema.json
    "trend": { ... },          // contracts/trend.schema.json
    "impact_card": { ... },    // contracts/impact_card.schema.json
    "gold": { "verdict": "good|borderline|bad" }   // 선택: judge 검증용 사람 라벨
  }
]
```

`samples/sample_cards.json`에 3개 예시가 있다: 잘 만든 카드, **파일을 지어낸 카드(환각)**, **키워드만 겹치는 무관 카드**.

## fake 모드 데모 결과 (판단 신뢰도 확인)

```
판정 분포: {'good': 1, 'bad': 2}
[good_reranking]          good(78) ground=100 act=75
[hallucinated_file]       bad(21)  ground=0   [!]환각: rag/reranker.py, config/rerank.yaml
[irrelevant_keyword_only] bad(52)  act=10 ("논문 읽어보세요")
--- judge 검증(vs 사람 gold): exact_agreement 1.0 → judge 신뢰 가능 ---
```

지어낸 파일을 잡아내고, "읽어보세요" 식 카드를 걸러내며, 사람 라벨과 일치하는 걸 확인할 수 있다.

## 한계 (정직하게)

- fake(규칙) 모드는 **어휘 겹침 기반**이라 의미적 관련성은 약하게 본다. 진짜 판단은 LLM judge(실모드)가 한다. fake는 환각·비실행성 같은 "명백한 실패"를 잡는 baseline.
- LLM judge도 사람이 아니다. 그래서 **항상 사람 gold로 먼저 검증**한 뒤 신뢰 여부를 판단한다(장치 7).
