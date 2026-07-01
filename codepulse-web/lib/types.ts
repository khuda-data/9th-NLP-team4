// CodePulse 공용 타입

export type Trend = {
  id: string;
  source: string;
  title: string;
  url: string;
  published?: string;
  summary?: string;
  signal?: string;
  category?: string;
  discussion?: string;
};

export type Classification = "영향" | "대체후보" | "신규적용";

export type Match = {
  trend_id: string;
  title?: string;
  source?: string;
  url?: string;
  classification: Classification;
  relevance: number;
  why: string;
  grounding?: string;
  next_action: string;
  condition?: string;
};

export type RepoMeta = {
  repoName: string;
  tags: string[];
  languages: string[];
  dependencies: string[];
  counts: Record<string, number>;
};

export type AnalyzeResult = {
  repo: string;
  repoUrl: string;
  date: string;
  collected: number;
  meta: RepoMeta;
  matches: Match[];
};
