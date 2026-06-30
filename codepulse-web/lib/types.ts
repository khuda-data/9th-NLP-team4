// CodePulse 공용 타입

export type Trend = {
  trend_id: string;
  source: "arxiv" | "hackernews" | "github";
  title: string;
  summary: string;
  url: string;
  published_at?: string;
  authors_or_org?: string[];
  type: "paper" | "tool" | "repo" | "news" | "benchmark";
  task_tags?: string[];
  dependency_tags?: string[];
  impact_tags?: string[];
  keyword_tags?: string[];
  raw_text?: string;
  embedding_text?: string;
  metadata?: {
    source_score?: number | null;
    stars?: number | null;
    forks?: number | null;
    comments?: number | null;
    language?: string | null;
    categories?: string[];
  };
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
