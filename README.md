# CodePulse — 내 코드를 아는 AI 트렌드 레이더

> KHUDA 9기 · 정기학술제 · NLP & AIE 4조

**🔗 배포 링크: https://9th-nlp-team4-git-main-hoon5.vercel.app/**

## 소개

매일 쏟아지는 AI 트렌드 속에서 정작 궁금한 건 하나입니다 — **"그래서 그게 내 GitHub 코드에 무슨 의미인데?"**

CodePulse는 GitHub 레포지토리를 분석해, 최신 AI 트렌드가 **내 코드에 어떤 영향을 주는지**를 짚어주는 서비스입니다.

- 트렌드를 자동 수집하고(arXiv · Hacker News · GitHub), 내 레포의 기술 스택과 매칭합니다.
- 각 트렌드를 **`[영향]` / `[대체후보]` / `[신규적용]`** 세 가지로 분류합니다.
- 단순 뉴스 나열이 아니라 **내 코드 속 근거(파일·의존성)** 와 **다음 행동 제안**까지 담은 *임팩트 카드*로 보여줍니다.

## 사용 방법

1. [배포 링크](https://9th-nlp-team4-git-main-hoon5.vercel.app/)에 접속합니다.
2. GitHub 사용자명 또는 레포 URL을 입력합니다.
3. 분석이 완료되면 트렌드별 임팩트 카드 피드를 확인합니다.

## 시스템 구성

```
[A. 데이터 파이프라인]                [B. 매칭·영향 엔진]              [C. 프론트엔드]
 arXiv/HN/GitHub 수집     trends.json    FastAPI + LLM    impact card    React (Vite)
 정규화·라벨링·중복제거  ───────────▶   레포 분석·매칭   ───────────▶   임팩트 카드 피드
                                            ▲
                                 repo_context (온보딩 입력)

                          [D. 평가] LLM judge · 품질 리포트
```

| 트랙 | 내용 | 기술 |
| :---: | :--- | :--- |
| **A. 데이터 파이프라인** (`data_pipeline/`) | 트렌드 수집 → 정규화 → 룰 기반 라벨링 → 의미 기반 중복제거 → 표준 Trend JSON 생성 | Python, LangGraph |
| **B. 매칭·영향 엔진** (`backend/`) | 레포 분석, 트렌드-코드 매칭, 근거 기반 관련도 산출, 임팩트 카드 생성 | FastAPI, OpenAI |
| **C. 프론트엔드** (`codepulse-web/`) | 온보딩·분석 진행(SSE)·임팩트 카드 피드 UI | React 18, TypeScript, Vite, styled-components |
| **D. 평가** (`eval/`) | LLM judge 기반 카드 품질 평가, 임계값 탐색, 품질 리포트 | Python |

### 배포

| 구성 | 플랫폼 |
| :--- | :--- |
| 프론트엔드 | Vercel — https://9th-nlp-team4-git-main-hoon5.vercel.app/ |
| 백엔드 (FastAPI) | Render (`render.yaml` Blueprint) |

## 주요 API

| 메서드 | 경로 | 설명 |
| :---: | :--- | :--- |
| `GET` | `/health` | 헬스 체크 |
| `GET` | `/github/users/{username}/repos` | 사용자 레포 목록 조회 (GitHub 프록시) |
| `POST` | `/analyze` | 레포 분석 시작 (SSE 스트리밍 진행 상황) |
| `GET` | `/analyze/{job_id}/results` | 분석 결과(임팩트 카드) 조회 |
| `POST` | `/api/impact` | 단일 트렌드 임팩트 카드 생성 |
| `POST` | `/api/impact/batch` | 트렌드 배치 임팩트 카드 생성 |

전체 명세: [api/openapi.yaml](api/openapi.yaml)

## 로컬 실행

### 백엔드

```bash
cd backend
pip install -r requirements.txt
# backend/.env 에 OPENAI_API_KEY, GITHUB_TOKEN 설정 (커밋 금지)
uvicorn main:app --reload
```

### 프론트엔드

```bash
cd codepulse-web
npm install
npm run dev   # http://localhost:5173
```

### 데이터 파이프라인

```bash
# 내장 샘플 데이터로 실행
python -m data_pipeline.run --sample

# 외부 소스(arXiv, Hacker News, GitHub)에서 수집
python -m data_pipeline.run --limit-per-source 20
```

산출물은 `data_pipeline/output/trends.json` (표준 Trend JSON, `contracts/trend.schema.json` 준수)에 저장됩니다.

## 폴더 구조

```
codepulse-web/    C. 프론트엔드 (React + Vite, Vercel 배포)
backend/          B. 매칭·영향 엔진 (FastAPI, Render 배포)
data_pipeline/    A. 트렌드 수집·정제 파이프라인
eval/             D. 평가 스크립트 (LLM judge, 품질 리포트)
contracts/        트랙 간 공통 JSON 스키마
api/              API 명세 (openapi.yaml)
docs/             설계·기획 문서
render.yaml       백엔드 Render 배포 설정
```

## 데이터 흐름

```
[A 수집] --trend.schema--> [B 엔진] --impact_card.schema--> [C 피드]
                              ↑
        [C 온보딩] --repo_context.schema--/
```

## 팀원

| 이름 | 트랙 / 역할 |
| :---: | :--- |
| 곽민서 | A. 데이터·수집 파이프라인 |
| 신정안 | B. 매칭·영향 엔진 |
| 이강훈 | B. 매칭·영향 엔진 / D. 평가·레포관리·PR리뷰(총괄) |
| 이수련 | C. 프론트엔드·통합 |
| 양경식 | (트랙 배정 TODO) |

## 개발 참여 가이드

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — 브랜치/PR 규칙, 폴더 구조
- **[contracts/](contracts/README.md)** — 트랙 간 JSON 스키마. 자기 트랙이 생산/소비하는 형식은 본인이 주인이며, 변경은 PR로 제안하고 producer/consumer 합의 후 `STATUS: DRAFT → AGREED`로 확정합니다.

```bash
git checkout main && git pull
git checkout -b feat/A-trend-schema      # <type>/<track>-<요약>
git add . && git commit -m "feat(A): trend schema에 license 필드 추가"
git push -u origin feat/A-trend-schema
# → GitHub에서 Pull Request 생성 → 리뷰 → 머지
```
