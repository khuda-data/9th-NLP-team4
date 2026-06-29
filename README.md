# CodePulse — 내 코드를 아는 AI 트렌드 레이더

> KHUDA 9기 · 정기학술제 · NLP & AIE 4조

## 소개
쏟아지는 AI 트렌드 중 **"그게 내 GitHub 코드에 무슨 의미인가"** 를 짚어주는 서비스.
트렌드를 `[영향]/[대체후보]/[신규적용]`으로 분류하고, **코드 근거 + 다음 행동**까지 제시한다.

## 팀원 / 트랙
| 이름 | 트랙 / 역할 |
| :---: | :--- |
| 곽민서 | A. 데이터·수집 파이프라인 |
| 신정안 | B. 매칭·영향 엔진 |
| 이강훈 | B. 매칭·영향 엔진 / D. 평가·레포관리·PR리뷰(총괄) |
| 이수련 | C. 프론트엔드·통합 |
| 양경식 | (트랙 배정 TODO) |

## 📌 개발 시작 전 꼭 읽기

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — 브랜치/PR 규칙, 폴더 구조, 첫날 할 일
- **[contracts/](contracts/README.md)** — 트랙끼리 주고받는 JSON 스키마 (★ 여기가 출발점)
- **[api/openapi.yaml](api/openapi.yaml)** — API 명세서

## 🛠 스키마 · API 명세서는 "초안"입니다 — 여러분이 PR로 완성하세요

`contracts/`의 스키마와 `api/openapi.yaml`은 **두 설계 문서에서 옮겨온 DRAFT(초안)** 입니다.
**확정본이 아니라, 각 트랙 담당 개발자가 직접 채우고 바꿔야 하는 뼈대**예요.

- 필드가 부족하거나 이름이 맘에 안 들면 → **바꾸는 PR을 올리세요.** (그게 정상입니다)
- 새 엔드포인트(API)나 새 데이터 형식이 필요하면 → **추가하는 PR을 올리세요.**
- 자기 트랙이 생산/소비하는 JSON 형식은 **본인이 주인**입니다. 초안을 자유롭게 수정하세요.
- 단, 바뀌면 상대 트랙도 영향받으니 **PR 설명에 producer/consumer를 멘션**하고, 합의되면
  스키마 상단 `STATUS: DRAFT → AGREED`로 바꿔주세요. (자세한 절차는 `contracts/README.md`)

> 한 줄: **"건드리지 마라"가 아니라 "PR로 같이 고쳐 만들어라".** 초안은 깨지라고 있는 겁니다.

### PR 올리는 법 (요약)
```bash
git checkout main && git pull
git checkout -b feat/A-trend-schema      # <type>/<track>-<요약>
# ... 스키마/명세서/코드 수정 ...
git add . && git commit -m "feat(A): trend schema에 license 필드 추가"
git push -u origin feat/A-trend-schema
# → GitHub에서 Pull Request 생성 (템플릿 채우기) → 리뷰 → 머지
```

## 폴더 구조
```
contracts/        ★ 트랙 간 공통 스키마 (초안 → PR로 확정)
api/              API 명세서 (openapi.yaml, 초안)
codepulse-web/    C. 프론트 (Next.js, 데모 동작 중)
eval/             D. 평가 스크립트
docs/             설계·기획 문서
data_pipeline/    A. 코드 (예정)
backend/          B. FastAPI 엔진 (예정)
```

## 데이터 흐름
```
[A 수집] --trend.schema--> [B 엔진] --impact_card.schema--> [C 피드]
                              ↑
        [C 온보딩] --repo_context.schema--/
```
