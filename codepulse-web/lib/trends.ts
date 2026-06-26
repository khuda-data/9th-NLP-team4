// trends.ts — AI 트렌드 수집(arXiv + Hacker News + GitHub) + 디스크 캐시
// trend_collector.js(스파이크 CLI)의 핵심 로직을 함수로 이식.

import fs from "node:fs";
import path from "node:path";
import type { Trend } from "./types";

const N_ARXIV = 8, N_HN = 7, N_GH = 7;
const UA = "khuda-codepulse";
const CACHE_PATH = path.join(process.cwd(), "data", "trends-cache.json");
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6시간

const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

function categoryHint(text: string): string {
  const t = text.toLowerCase();
  if (/\b(release|launch|gpt-|claude|gemini|llama|mistral|model card|introducing)\b/.test(t)) return "모델 출시";
  if (/\b(agent|rag|retrieval|fine-?tun|benchmark|sota|architecture|method)\b/.test(t)) return "기법/연구";
  if (/\b(library|framework|sdk|open[- ]?source|toolkit|cli)\b/.test(t)) return "툴/라이브러리";
  if (/\b(funding|raises|policy|regulation|lawsuit|acquire)\b/.test(t)) return "산업/정책";
  return "기타";
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
    const link = (e.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || "";
    const title = get("title");
    const summary = get("summary");
    return {
      id: "", source: "arXiv", title, url: clean(link),
      published: (e.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || "",
      summary: truncate(summary, 400),
      signal: "최신 제출 (cs.AI/CL/LG)",
      category: categoryHint(title + " " + summary),
    } as Trend;
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
  return hits.map((h) => ({
    id: "", source: "HackerNews", title: clean(h.title),
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    published: h.created_at || "",
    summary: "",
    signal: `${h.points || 0} points · ${h.num_comments || 0} comments`,
    category: categoryHint(h.title || ""),
    discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
  }) as Trend);
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
  return (j.items as any[]).map((r) => ({
    id: "", source: "GitHub", title: r.full_name,
    url: r.html_url,
    published: r.created_at || "",
    summary: truncate(clean(r.description || ""), 300),
    signal: `★ ${r.stargazers_count} · ${r.language || "?"}`,
    category: "툴/라이브러리",
  }) as Trend);
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
  results.forEach((r, i) => (r.id = "T" + String(i + 1).padStart(2, "0")));
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
