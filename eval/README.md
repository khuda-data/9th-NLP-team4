# eval/ — D트랙 평가 도구 모음

담당: 이강훈(D. 평가·레포관리·PR리뷰)

CodePulse가 "그냥 AI 요약"이 아니라 **키워드 매칭보다 낫다는 걸 숫자로 증명**하기 위한 도구들.

| 도구 | 무엇 | 실행 |
| --- | --- | --- |
| [`llm_judge/`](llm_judge/README.md) | ImpactCard 품질을 LLM-judge로 자동 채점 (관련도·근거충실성·실행가능성 + 환각 검출) | `python -m eval.llm_judge.run_judge --input eval/llm_judge/samples/sample_cards.json --fake` |
| `threshold_finder.mjs` | 엔진 점수 + 사람 yes/no 라벨 → 최적 노출 컷(threshold) 자동 산출 | `node eval/threshold_finder.mjs eval/labels.example.json` |

## 두 도구의 관계

```
엔진(ImpactCard 생성)
   │
   ├─ llm_judge   →  각 카드가 "맞는 판단"인지 채점 (품질/환각)
   └─ threshold_finder → 점수 어디서 끊어야 피드가 깔끔한지 결정
                          (사람 라벨 대비 Precision 최대화)
```

- `llm_judge`는 **카드 내용의 질**(근거가 진짜냐, 행동이 구체적이냐)을 본다.
- `threshold_finder`는 **몇 점부터 보여줄지**(노출 컷)를 정한다.
- 둘 다 **사람 라벨(gold)로 자기 자신을 검증**하는 걸 전제로 한다. 라벨 없이 나온 숫자는 믿지 않는다.

## 발표에서 쓰는 법

1. 레포 몇 개 × 트렌드로 엔진을 돌려 ImpactCard를 모은다.
2. 사람이 소량(20~30건) yes/no + good/bad 라벨을 단다.
3. `llm_judge`로 카드 품질 자동 채점 → judge↔사람 일치율로 judge 신뢰도 먼저 입증.
4. `threshold_finder`로 컷 결정 → "왜 이 점수가 컷인가"를 데이터로 답한다.
5. 키워드 매칭 baseline과 Precision@K 비교 그래프 1장 → 발표 핵심.
