# 품질 리포트 — 8th-NLP-CoverLetter (2026-07-03)

- 분석 레포: `https://github.com/khuda-data/8th-NLP-CoverLetter.git` (tags: FastAPI, Backend/API, HTTP, LLM, RAG/VectorDB)
- 트렌드: 12건 → 노출(show/candidate) 6건이 judge 대상
- 엔진: gpt-4o-mini / judge: gpt-4o (실모드)

## 종합
- judge 판정 분포: {'bad': 3, 'borderline': 3}
- 평균 점수: {'relevance': 40.0, 'groundedness': 41.7, 'actionability': 40.0, 'overall_score': 39.2}
- 환각 근거 검출 카드: 4건

> 주의: 이 리포트에는 사람 gold 라벨이 없어 judge 자체의 신뢰도(일치율)는 미검증입니다. 발표용으로는 소량 gold를 달아 judge를 먼저 검증한 뒤 수치를 인용하세요.

## 카드별 상세
### [borderline] Online Safety Monitoring for LLMs  (score 65)
- trend: `arxiv_2607.02510` (arxiv) — http://arxiv.org/abs/2607.02510v1
- 엔진 분류: 신규적용 / relevance 75 / show
- judge: relevance=60 groundedness=80 actionability=50 classification=correct conf=1.0
- why: LLM의 안전성을 보장하는 것은 자소서 검증 시스템의 신뢰성을 높이는 데 필수적입니다.

### [borderline] Program-as-Weights: A Programming Paradigm for Fuzzy Functions  (score 50)
- trend: `arxiv_2607.02512` (arxiv) — http://arxiv.org/abs/2607.02512v1
- 엔진 분류: 신규적용 / relevance 75 / show
- judge: relevance=50 groundedness=60 actionability=40 classification=borderline conf=1.0
- why: 이 트렌드는 자연어 처리 작업을 더 효율적으로 수행할 수 있는 새로운 방법을 제시하며, 자소서 검증 시스템의 성능을 향상시킬 수 있습니다.

### [borderline] ollama/ollama  (score 40)
- trend: `github_ollama_ollama` (github) — https://github.com/ollama/ollama
- 엔진 분류: 신규적용 / relevance 75 / show
- judge: relevance=30 groundedness=40 actionability=50 classification=borderline conf=1.0
- ⚠ 환각 근거: ['ollama/ollama is not mentioned in the repo context']
- why: 다양한 모델을 활용하여 질문 생성 및 검증을 개선할 수 있는 기회를 제공합니다.

### [bad] LACUNA: A Testbed for Evaluating Localization Precision for LLM Unlearning  (score 30)
- trend: `arxiv_2607.02513` (arxiv) — http://arxiv.org/abs/2607.02513v1
- 엔진 분류: 신규적용 / relevance 75 / show
- judge: relevance=40 groundedness=30 actionability=20 classification=borderline conf=1.0
- ⚠ 환각 근거: ['LACUNA의 연구 결과는 LLM의 지식 삭제 및 검증과 관련된 중요한 통찰을 제공할 수 있습니다.']
- why: LACUNA는 LLM의 지식 삭제 정확성을 평가할 수 있는 테스트베드로, 자소서 검증 시스템의 신뢰성을 높이는 데 기여할 수 있습니다.

### [bad] Distributed Attacks in Persistent-State AI Control  (score 25)
- trend: `arxiv_2607.02514` (arxiv) — http://arxiv.org/abs/2607.02514v1
- 엔진 분류: 신규적용 / relevance 75 / show
- judge: relevance=30 groundedness=20 actionability=40 classification=wrong conf=1.0
- ⚠ 환각 근거: ['AI 코딩 에이전트의 자율성이 증가함에 따라 발생할 수 있는 새로운 공격 표면에 대한 연구가 필요합니다.']
- why: AI 코딩 에이전트의 자율성이 높아짐에 따라, 자소서 검증 시스템의 보안성을 강화할 필요성이 커지고 있습니다.

### [bad] Significant-Gravitas/AutoGPT  (score 25)
- trend: `github_significant_gravitas_autogpt` (github) — https://github.com/Significant-Gravitas/AutoGPT
- 엔진 분류: 신규적용 / relevance 75 / show
- judge: relevance=30 groundedness=20 actionability=40 classification=borderline conf=1.0
- ⚠ 환각 근거: ['AutoGPT가 자소서 검증 시스템의 질문 생성 및 사용자 인터페이스 개선에 기여할 수 있다는 주장']
- why: AutoGPT는 사용자가 AI를 쉽게 활용할 수 있도록 하여, 자소서 검증 시스템의 기능을 확장할 수 있는 가능성을 제공합니다.
