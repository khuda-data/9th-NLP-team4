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
