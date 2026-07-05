export const BRAND = '#ff385c';

export type CatKey = 'replace' | 'apply' | 'impact';
export type StepStatus = 'idle' | 'active' | 'done';
export type FilterKey = 'all' | CatKey;

export interface CatConfig {
  label: string;
  accent: string;
  tint: string;
}

export interface StepConfig {
  n: string;
  label: string;
  sub: string;
}

export interface TrendSource {
  name: string;
  url: string;
  publishedAt: string;
}

export interface TrendItem {
  id: string;
  category: CatKey;
  relevanceScore: number;
  title: string;
  source: TrendSource;
  reason: string;
  relatedFiles: string[];
  detail: string;
  recommendedAction: string;
}

export const CATS: Record<CatKey, CatConfig> = {
  replace: { label: '대체후보', accent: '#e00b41', tint: '#ffeef2' },
  apply:   { label: '신규적용', accent: '#460479', tint: '#f1eaf8' },
  impact:  { label: '영향',     accent: '#92174d', tint: '#fbe7f0' },
};

export const STEPS: StepConfig[] = [
  { n: '1', label: '레포 정보 수집',      sub: 'GitHub API' },
  { n: '2', label: '트렌드 수집',         sub: 'arXiv · Hacker News · GitHub' },
  { n: '3', label: '코드 ↔ 트렌드 대조',  sub: 'LLM model' },
  { n: '4', label: '분류 결과 생성',       sub: '대체후보 · 신규적용 · 영향' },
];

export const DATA: TrendItem[] = [
  {
    id: 't1', category: 'replace', relevanceScore: 94,
    title: 'vLLM 0.9 — 연속 배칭',
    source: {
      name: 'GitHub Trending',
      url: 'https://github.com/vllm-project/vllm',
      publishedAt: '2026-06-27',
    },
    reason: '지금 transformers.pipeline()로 요청을 순차 추론 중 — vLLM 연속 배칭이면 같은 GPU에서 처리량이 크게 올라요.',
    relatedFiles: ['api/inference.py'],
    detail: 'inference.py의 동기 추론 루프가 요청을 한 건씩 처리하고 있어 GPU 점유율이 낮습니다. vLLM의 continuous batching과 PagedAttention으로 바꾸면 같은 하드웨어에서 동시 처리량이 수 배 늘고, OpenAI 호환 서버로 띄우면 클라이언트 코드 변경도 거의 없습니다.',
    recommendedAction: '추론 서버를 vLLM OpenAI-compatible 엔드포인트로 교체',
  },
  {
    id: 't2', category: 'replace', relevanceScore: 88,
    title: 'BGE-M3 다국어 임베딩',
    source: {
      name: 'arXiv',
      url: 'https://huggingface.co/BAAI/bge-m3',
      publishedAt: '2026-06-26',
    },
    reason: 'ada-002로 한국어 문서를 임베딩 중 — BGE-M3가 다국어·롱컨텍스트 검색에서 더 좋은 회수율을 보여요.',
    relatedFiles: ['lib/embeddings.ts'],
    detail: 'embeddings.ts가 OpenAI text-embedding-ada-002를 호출합니다. 한국어가 섞인 사내 문서 검색에서는 BGE-M3가 회수율이 높고, 8192 토큰까지 한 번에 임베딩해 청크 경계 손실이 줄어듭니다. 자체 호스팅하면 임베딩 비용도 사라집니다.',
    recommendedAction: '임베딩 모델을 BGE-M3로 교체하고 벡터 차원 마이그레이션',
  },
  {
    id: 't3', category: 'replace', relevanceScore: 82,
    title: 'Qdrant 1.12 하이브리드 검색',
    source: {
      name: 'Hacker News',
      url: 'https://github.com/qdrant/qdrant',
      publishedAt: '2026-06-25',
    },
    reason: '인메모리 코사인 검색을 쓰는데 — Qdrant 하이브리드(BM25+벡터)면 정확도와 영속성을 같이 얻어요.',
    relatedFiles: ['lib/vectorstore.py'],
    detail: 'vectorstore.py가 NumPy 배열로 코사인 유사도를 직접 계산합니다. 문서가 늘면 메모리와 지연이 같이 커지고 재시작 시 인덱스가 사라집니다. Qdrant 1.12의 하이브리드 검색으로 옮기면 키워드와 벡터를 함께 쓰고 디스크 영속성도 확보됩니다.',
    recommendedAction: '벡터 스토어를 Qdrant로 이전하고 하이브리드 쿼리 적용',
  },
  {
    id: 't4', category: 'apply', relevanceScore: 79,
    title: 'DSPy 2.6 — 프롬프트 컴파일',
    source: {
      name: 'arXiv',
      url: 'https://github.com/stanfordnlp/dspy',
      publishedAt: '2026-06-28',
    },
    reason: '프롬프트를 텍스트 파일로 하드코딩 중 — DSPy로 예시 기반 자동 최적화를 붙일 수 있어요.',
    relatedFiles: ['prompts/classify.txt'],
    detail: 'classify.txt의 분류 프롬프트가 수작업으로 다듬어져 있습니다. DSPy 2.6으로 옮기면 라벨링된 예시로 프롬프트를 컴파일·최적화해 분류 일관성을 끌어올릴 수 있고, 모델을 교체해도 재컴파일만 하면 됩니다.',
    recommendedAction: '분류 단계를 DSPy 모듈로 감싸고 few-shot 컴파일 도입',
  },
  {
    id: 't5', category: 'apply', relevanceScore: 91,
    title: 'Structured Outputs (JSON Schema)',
    source: {
      name: 'GitHub',
      url: 'https://ai.google.dev/gemini-api/docs/structured-output',
      publishedAt: '2026-06-27',
    },
    reason: '분류 결과 JSON을 정규식으로 파싱 중 — 스키마 강제 출력으로 파싱 실패를 없앨 수 있어요.',
    relatedFiles: ['api/analyze/route.ts'],
    detail: 'route.ts가 모델 응답에서 정규식으로 JSON을 긁어냅니다. 가끔 깨진 JSON으로 실패하죠. Gemini의 구조화 출력(responseSchema)으로 카테고리·근거 필드를 강제하면 파싱 단계를 통째로 제거할 수 있습니다.',
    recommendedAction: 'responseSchema로 분류 출력 스키마를 고정',
  },
  {
    id: 't6', category: 'apply', relevanceScore: 73,
    title: '시맨틱 캐싱 (GPTCache)',
    source: {
      name: 'Hacker News',
      url: 'https://github.com/zilliztech/GPTCache',
      publishedAt: '2026-06-24',
    },
    reason: '비슷한 질의가 반복돼요 — 시맨틱 캐시를 두면 Gemini 호출 수와 비용이 줄어요.',
    relatedFiles: ['lib/gemini.ts'],
    detail: 'gemini.ts가 매 요청마다 모델을 호출합니다. 같은 레포를 짧은 간격으로 다시 분석하면 동일·유사 질의가 반복됩니다. GPTCache 같은 시맨틱 캐시를 앞단에 두면 임베딩 유사도로 캐시 히트를 잡아 호출량을 줄입니다.',
    recommendedAction: 'Gemini 호출 앞단에 시맨틱 캐시 레이어 추가',
  },
  {
    id: 't7', category: 'impact', relevanceScore: 68,
    title: 'Next.js 15.3 — Turbopack 정식',
    source: {
      name: 'GitHub Release',
      url: 'https://nextjs.org/blog',
      publishedAt: '2026-06-26',
    },
    reason: '지금 webpack으로 빌드 중 — Turbopack 정식 전환으로 빌드가 빨라지지만 설정 변경이 필요해요.',
    relatedFiles: ['next.config.js'],
    detail: 'next.config.js가 커스텀 webpack 설정에 의존합니다. 15.3에서 Turbopack이 정식이 되며 일부 로더·플러그인 설정을 옮겨야 합니다. 빌드와 HMR 속도는 크게 개선되지만 마이그레이션 점검이 필요합니다.',
    recommendedAction: 'Turbopack 호환성 점검 후 빌드 파이프라인 전환',
  },
  {
    id: 't8', category: 'impact', relevanceScore: 76,
    title: 'LangChain 0.4 — 인터페이스 변경',
    source: {
      name: 'Hacker News',
      url: 'https://github.com/langchain-ai/langchain',
      publishedAt: '2026-06-23',
    },
    reason: '0.3 체인 API를 쓰는데 — 0.4에서 일부 인터페이스가 바뀌어 마이그레이션이 필요해요.',
    relatedFiles: ['lib/chain.ts'],
    detail: 'chain.ts가 LangChain 0.3의 체인 구성 API를 사용합니다. 0.4에서 일부 import 경로와 러너 인터페이스가 변경되어 그대로 업그레이드하면 빌드가 깨질 수 있습니다. 변경점을 확인하고 단계적으로 올리세요.',
    recommendedAction: '0.4 마이그레이션 가이드 기준으로 체인 코드 점검',
  },
];
