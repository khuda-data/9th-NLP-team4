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
-> Chroma Ingestion 또는 JSONL fallback
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

## 산출물

- `data_pipeline/output/trends.json`
  - `contracts/trend.schema.json`을 따르는 표준 Trend JSON 배열
- `data_pipeline/output/chroma/`
  - `chromadb`가 설치되어 있으면 Chroma persistent DB로 저장
- `data_pipeline/output/chroma/trends.jsonl`
  - `chromadb`가 없을 때 사용하는 JSONL fallback 저장소

## B트랙 전달 기준

B트랙은 A트랙 산출물을 다음 둘 중 하나로 읽으면 됩니다.

```text
1. data_pipeline/output/trends.json
2. Chroma collection: codepulse_trends
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

`graph.py`에는 `build_langgraph()`가 준비되어 있습니다.

다만 MVP는 `langgraph` 설치 없이도 `run_sequential()`로 실행됩니다. 같은 node 함수를 사용하므로,
추후 `langgraph`를 설치하면 순차 실행을 상태 기반 workflow로 자연스럽게 옮길 수 있습니다.

LangGraph는 LLM agent 호출용이 아니라, 다음과 같은 조건부 제어를 위한 workflow 엔진으로 사용합니다.

```text
필수 필드 누락 -> repair
task_tags 누락률 높음 -> rule 보정
적재 개수 부족 -> query expansion 후 재수집
중복률 높음 -> dedup threshold 조정
```
