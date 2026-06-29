# 기여 가이드 (CodePulse / KHUDA 9기 NLP 4조)

팀 협업 규칙. **처음 개발 시작하는 사람은 이 문서부터 읽는다.**

## 0. 황금 규칙 3개

1. **main에 직접 push 금지.** 항상 브랜치 → PR → 리뷰 → 머지.
2. **`contracts/`가 법이다.** 트랙끼리 주고받는 JSON은 전부 거기 스키마를 따른다. 계약을 바꾸려면 PR + 관련 트랙 동의.
3. **시크릿 커밋 금지.** API 키는 `.env`에만. (`.env`는 `.gitignore`에 있음)

## 1. 트랙 & 담당

| 트랙 | 범위 | 담당 |
| --- | --- | --- |
| A. 데이터·수집 파이프라인 | 수집·정규화·태깅·중복제거·Chroma 적재 | 곽민서 |
| B. 매칭·영향 엔진 | Rule Gate + LLM 판단 → Impact Card | 신정안, 이강훈 |
| C. 프론트엔드·통합 | 피드 웹앱, 온보딩, E2E 연결 | 이수련 |
| D. 평가·레포관리·PR리뷰 | 라벨·평가·베이스라인·발표, **PR 리뷰 총괄** | 이강훈 |

> 양경식: 트랙 배정 TODO (README 참고)

## 2. 폴더 구조 (계획)

```
contracts/        ★ 트랙 간 공통 스키마 (단일 진실 소스) — 모두 여기 맞춤
api/              API 명세서 (openapi.yaml)
data_pipeline/    A트랙 코드 (예정)
backend/          B트랙 FastAPI Impact Engine (예정)
codepulse-web/    C트랙 Next.js 프론트 (데모 동작 중)
eval/             D트랙 평가 스크립트 (threshold_finder 등)
docs/             설계·기획 문서
```

> 각자 자기 트랙 폴더 안에서 작업한다. 남의 트랙 폴더는 PR로만 건드린다.

## 3. 브랜치 규칙

```
<type>/<track>-<요약>
```
예) `feat/A-arxiv-collector`, `fix/B-gate-keyword-match`, `docs/contracts-trend-schema`

`type`: `feat`(기능) / `fix`(버그) / `docs`(문서) / `chore`(설정) / `refactor`

## 4. PR 규칙

1. 브랜치에서 작업 → push → GitHub에서 PR 생성 (`main` 대상).
2. PR 제목: `feat(A): arXiv collector 추가` 처럼 `<type>(<track>): 요약`.
3. PR 템플릿 체크리스트를 채운다 (계약 영향 여부 필수 표기).
4. **리뷰 1명 이상 승인 후 머지.** 리뷰어는 자동 지정됨(CODEOWNERS → 총괄 @lkh3409).
5. 작은 단위로 자주 올린다. 거대한 PR은 리뷰가 안 된다.

## 5. 커밋 메시지

- 한국어/영어 무관, 한 줄 요약 명확하게.
- Git 계정은 본인 계정으로. (이강훈은 `lkh3409` 계정 사용)

## 6. 계약(contracts) 바꿀 때

- 필드 **추가**(옵션): 비교적 안전. PR에 producer/consumer 트랙 멘션.
- 필드 **이름변경/삭제/타입변경**: breaking. 양쪽 트랙 동의 + 같은 PR에서 `examples/`도 수정.
- 합의되면 스키마 `$comment`의 `STATUS`를 `AGREED`로, `version` 올림.

## 7. 로컬 시작 (트랙별)

- **C 프론트(이미 동작)**: `cd codepulse-web && npm install && npm run dev`
- **B 백엔드(예정)**: `docs/수정2) FastAPI 버전` §18 개발 순서 참고.
- **A 파이프라인(예정)**: `docs/데이터·수집 파이프라인` §9 산출물 참고.
- **D 평가**: `node eval/threshold_finder.mjs eval/labels.example.json`

## 8. 첫날 해야 할 일 (제일 중요)

코드 짜기 **전에** 모여서 `contracts/`의 3개 스키마를 함께 확정한다.
(`trend.schema.json`, `repo_context.schema.json`, `impact_card.schema.json`)
→ 합의되면 STATUS를 AGREED로 바꾸는 PR을 올린다. 이게 모든 트랙의 출발점이다.
