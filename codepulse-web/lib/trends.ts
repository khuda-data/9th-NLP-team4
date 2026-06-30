// trends.ts — AI 트렌드 수집(arXiv + Hacker News + GitHub) + 디스크 캐시
// trend_collector.js(스파이크 CLI)의 핵심 로직을 함수로 이식.

import fs from "node:fs";
import path from "node:path";
import type { Trend } from "./types";

const N_ARXIV = 8, N_HN = 7, N_GH = 7;
const UA = "khuda-codepulse";
const CACHE_PATH = path.join(process.cwd(), "demo", "trends-cache.json");
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6시간

const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
const uniq = (items: string[], max: number) => Array.from(new Set(items.filter(Boolean))).slice(0, max);

function typeHint(text: string): Trend["type"] {
  const t = text.toLowerCase();
  if (/\bbenchmark|leaderboard|evaluation suite\b/.test(t)) return "benchmark";
  if (/\blibrary|framework|sdk|toolkit|cli|tool\b/.test(t)) return "tool";
  if (/\brelease|launch|policy|regulation|lawsuit|acquire|funding\b/.test(t)) return "news";
  return "paper";
}

function tagsFor(text: string) {
  const t = text.toLowerCase();
  const task = [
    /\brag|retrieval|embedding|vector\b/.test(t) ? "RAG" : "",
    /\bagent|tool use|workflow|langgraph\b/.test(t) ? "Agent" : "",
    /\binference|latency|throughput|quantization|compression\b/.test(t) ? "Inference" : "",
    /\bfine-?tun|lora|adapter\b/.test(t) ? "Fine-tuning" : "",
    /\bevaluation|benchmark|leaderboard\b/.test(t) ? "Evaluation" : "",
    /\bmultimodal|vision-language|vlm|speech|audio|ocr\b/.test(t) ? "Multimodal" : "",
  ];
  const deps = [
    /\blangchain\b/.test(t) ? "LangChain" : "",
    /\blanggraph\b/.test(t) ? "LangGraph" : "",
    /\bchroma|chromadb\b/.test(t) ? "Chroma" : "",
    /\bfaiss\b/.test(t) ? "FAISS" : "",
    /\bpytorch|torch\b/.test(t) ? "PyTorch" : "",
    /\btransformers|hugging ?face\b/.test(t) ? "Transformers" : "",
  ];
  const impact = [
    /\baccuracy|quality|recall|precision|rerank/.test(t) ? "accuracy" : "",
    /\blatency|throughput|speed|fast|batching/.test(t) ? "speed" : "",
    /\bcost|cheap|efficient|compression|quantization/.test(t) ? "cost" : "",
    /\bsecurity|vulnerability|prompt injection|misalignment|safety/.test(t) ? "security" : "",
    /\bproductivity|developer|workflow|automation/.test(t) ? "productivity" : "",
  ];
  const keywords = ["retrieval", "embedding", "vector search", "reranker", "benchmark", "quantization", "tool use", "workflow", "safety", "ocr"]
    .filter((kw) => t.includes(kw));
  return {
    task_tags: uniq(task, 3),
    dependency_tags: uniq(deps, 5),
    impact_tags: uniq(impact, 2),
    keyword_tags: uniq(keywords, 10),
  };
}

function embeddingText(t: Pick<Trend, "title" | "summary" | "task_tags" | "dependency_tags" | "impact_tags" | "keyword_tags">) {
  const tags = [...(t.task_tags || []), ...(t.dependency_tags || []), ...(t.impact_tags || []), ...(t.keyword_tags || [])];
  return clean(`${t.title}. ${t.summary}. Tags: ${tags.join(", ")}.`);
}

async function fetchArxiv(): Promise<Trend[]> {
  const url = "http://export.arxiv.org/api/query?search_query=" +
    encodeURIComponent("cat:cs.AI OR cat:cs.CL OR cat:cs.LG") +
    "&sortBy=submittedDate&sortOrder=descending&start=0&max_results=" + N_ARXIV;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => {
    const get = (tag: string) => { const m = e.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? clean(m[1]) : ""; };
    const link = clean((e.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || "");
    const title = get("title");
    const rawSummary = get("summary");
    const summary = truncate(rawSummary, 500);
    const authors = Array.from(e.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) => clean(m[1]));
    const categories = Array.from(e.matchAll(/<category term="([^"]+)"/g)).map((m) => clean(m[1]));
    const arxivId = link.split("/abs/")[1]?.replace(/v\d+$/, "") || title.toLowerCase().replace(/\W+/g, "_").slice(0, 60);
    const tags = tagsFor(title + " " + rawSummary);
    const trend: Trend = {
      trend_id: `arxiv_${arxivId}`,
      source: "arxiv",
      title,
      summary,
      url: link,
      published_at: (e.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || "",
      authors_or_org: authors,
      type: "paper",
      ...tags,
      raw_text: rawSummary,
      metadata: { source_score: null, stars: null, forks: null, comments: null, language: null, categories },
    };
    trend.embedding_text = embeddingText(trend);
    return trend;
  });
}

async function fetchHN(): Promise<Trend[]> {
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const url = "http://hn.algolia.com/api/v1/search_by_date?tags=story&query=" +
    encodeURIComponent("AI") +
    "&hitsPerPage=60&numericFilters=" + encodeURIComponent(`created_at_i>${since},points>20`);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const j = await res.json();
  const hits = ((j.hits || []) as any[]).sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, N_HN);
  return hits.map((h) => {
    const title = clean(h.title);
    const tags = tagsFor(title);
    const trend: Trend = {
      trend_id: `hackernews_${h.objectID}`,
      source: "hackernews",
      title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      published_at: h.created_at || "",
      summary: title,
      authors_or_org: h.author ? [h.author] : [],
      type: typeHint(title),
      ...tags,
      raw_text: title,
      metadata: { source_score: h.points || 0, stars: null, forks: null, comments: h.num_comments || 0, language: null, categories: [] },
    };
    trend.embedding_text = embeddingText(trend);
    return trend;
  });
}

async function fetchGitHub(): Promise<Trend[]> {
  const d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const q = `LLM pushed:>${d} stars:>50`;
  const url = "https://api.github.com/search/repositories?q=" + encodeURIComponent(q) +
    "&sort=stars&order=desc&per_page=" + N_GH;
  const headers: Record<string, string> = { "User-Agent": UA, "Accept": "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = "Bearer " + process.env.GITHUB_TOKEN;
  const res = await fetch(url, { headers });
  const j = await res.json();
  if (!j.items) throw new Error("GitHub 응답 이상: " + JSON.stringify(j).slice(0, 200));
  return (j.items as any[]).map((r) => {
    const title = clean(r.full_name);
    const summary = truncate(clean(r.description || title), 400);
    const tags = tagsFor(title + " " + summary + " " + (r.language || ""));
    const trend: Trend = {
      trend_id: `github_${String(r.full_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      source: "github",
      title,
      url: r.html_url,
      published_at: r.created_at || "",
      summary,
      authors_or_org: r.owner?.login ? [r.owner.login] : [],
      type: "repo",
      ...tags,
      raw_text: summary,
      metadata: { source_score: r.stargazers_count || 0, stars: r.stargazers_count || 0, forks: r.forks_count || 0, comments: null, language: r.language || null, categories: [] },
    };
    trend.embedding_text = embeddingText(trend);
    return trend;
  });
}

async function collectFresh(): Promise<Trend[]> {
  const results: Trend[] = [];
  for (const fn of [fetchArxiv, fetchHN, fetchGitHub]) {
    try {
      const items = await fn();
      results.push(...items);
    } catch (err) {
      console.error("trend source 실패:", (err as Error).message);
    }
  }
  return results;
}

function readCache(): { ts: number; trends: Trend[] } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    // 캐시 파일이 배열(스파이크 trends.json)일 수도, {ts,trends}일 수도 있음
    if (Array.isArray(raw)) return { ts: 0, trends: raw as Trend[] };
    if (raw && Array.isArray(raw.trends)) return raw;
  } catch {}
  return null;
}

function writeCache(trends: Trend[]) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ ts: Date.now(), trends }, null, 2), "utf8");
  } catch (err) {
    console.error("trends 캐시 쓰기 실패:", (err as Error).message);
  }
}

/**
 * 캐시가 신선하면 캐시, 아니면 새로 수집(후 캐시 갱신).
 * 수집이 모두 실패하면 가능한 캐시라도 반환.
 */
export async function loadOrCollectTrends(opts?: { force?: boolean }): Promise<Trend[]> {
  const cache = readCache();
  const fresh = cache && cache.ts && Date.now() - cache.ts < CACHE_MAX_AGE_MS;
  if (!opts?.force && fresh && cache!.trends.length) return cache!.trends;

  try {
    const collected = await collectFresh();
    if (collected.length) {
      writeCache(collected);
      return collected;
    }
  } catch (err) {
    console.error("트렌드 수집 실패, 캐시로 폴백:", (err as Error).message);
  }
  if (cache?.trends.length) return cache.trends;
  throw new Error("트렌드를 수집하지 못했고 캐시도 없습니다.");
}
