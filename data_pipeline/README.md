# A. 데이터·수집 파이프라인

CodePulse A트랙 MVP 구현입니다.

이 파이프라인의 목표는 단순 크롤링이 아니라, B트랙 매칭 엔진이 바로 사용할 수 있는
표준 `Trend JSON` 지식베이스를 만드는 것입니다.

기본 실행 경로에서는 LLM API를 호출하지 않습니다.

```text
Collector
-> Normalizer
-> Rule-based Weak Labeling
-> Semantic Deduplication
-> JSON 저장
-> Quality Check
-> Deterministic Repair
```

## 실행 방법

내장 샘플 데이터로 실행:

```bash
python3 -m data_pipeline.run --sample
```

외부 소스(arXiv, Hacker News, GitHub)에서 직접 수집:

```bash
python3 -m data_pipeline.run --limit-per-source 20
```

LangGraph workflow로 실행:

```bash
python3 -m data_pipeline.run --sample --langgraph
```

## 산출물

- `data_pipeline/output/trends.json`
  - `contracts/trend.schema.json`을 따르는 표준 Trend JSON 배열
- `data_pipeline/output/chroma/trends.jsonl`
  - 현재 MVP에서 사용하는 보조 JSONL 저장소
  - ChromaDB가 아직 준비되지 않은 환경에서도 수집 결과를 확인하기 위한 fallback입니다.

## ChromaDB 고려 사항

MVP에서는 수집 데이터가 많지 않기 때문에 `trends.json` 기반 전달을 기본으로 둡니다.

ChromaDB는 다음 조건이 필요해질 때 도입을 고려합니다.

```text
트렌드 데이터가 수백~수천 건으로 누적됨
repo와 의미적으로 가까운 trend top-k 검색이 필요함
B트랙에서 embedding similarity 기반 후보 검색을 사용하기로 확정됨
매일 수집한 트렌드를 누적 저장하고 검색해야 함
```

현재 코드는 ChromaDB가 없어도 동작하도록 JSONL fallback을 제공합니다.
실제 Chroma vector 저장/검색은 별도 PR에서 다음 항목을 함께 결정한 뒤 구현하는 것이 안전합니다.

```text
chromadb dependency 추가
local embedding model 선택
embedding_text -> vector 변환
collection metadata/filter 설계
search_trends(query, top_k) API 추가
```

## B트랙 전달 기준

B트랙은 MVP 단계에서 A트랙 산출물을 기본적으로 다음 파일에서 읽으면 됩니다.

```text
data_pipeline/output/trends.json
```

Trend 객체의 기준은 항상 `contracts/trend.schema.json`입니다.

핵심 키:

```text
trend_id
source
title
summary
url
type
task_tags
dependency_tags
impact_tags
keyword_tags
embedding_text
metadata
```

특히 B트랙은 `id`가 아니라 `trend_id`를 기준으로 join해야 합니다.

## LangGraph 사용 방식

`graph.py`에는 실제 LangGraph workflow가 구현되어 있습니다.

기본 MVP는 `langgraph` 설치 없이도 `run_sequential()`로 실행됩니다. `langgraph`를 설치한 환경에서는
`run_langgraph()` 또는 CLI의 `--langgraph` 옵션으로 같은 node들을 `StateGraph`로 실행할 수 있습니다.

LangGraph는 LLM agent 호출용이 아니라, 다음과 같은 조건부 제어를 위한 workflow 엔진으로 사용합니다.

```text
필수 필드 누락 -> repair
task_tags 누락률 높음 -> rule 보정
적재 개수 부족 -> query expansion 후 재수집
중복률 높음 -> dedup threshold 조정
```

필요 패키지:

```bash
pip install -r data_pipeline/requirements.txt
```
