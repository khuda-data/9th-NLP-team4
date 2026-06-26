#!/usr/bin/env node
/*
 * trend_collector.js — AI 트렌드 자동 수집 (arXiv + Hacker News + GitHub)
 *
 * 사용법:
 *   node trend_collector.js [출력폴더]
 *   (GitHub 인증: 환경변수 GITHUB_TOKEN 있으면 사용, 없으면 비인증 — rate limit 낮음)
 *
 * 결과물:
 *   <출력폴더>/trends.json  ← 통일된 Trend Item 배열
 *   <출력폴더>/trends.md    ← 사람이 읽기 좋은 + LLM에 넣을 형식
 */

const fs = require("fs");
const path = require("path");

const N_ARXIV = 8, N_HN = 7, N_GH = 7;
const outDir = process.argv[2] || process.cwd();

const UA = "khuda-codepulse-spike";
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const truncate = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

// 카테고리 힌트 (간단 키워드)
function categoryHint(text) {
  const t = text.toLowerCase();
  if (/\b(release|launch|gpt-|claude|gemini|llama|mistral|model card|introducing)\b/.test(t)) return "모델 출시";
  if (/\b(agent|rag|retrieval|fine-?tun|benchmark|sota|architecture|method)\b/.test(t)) return "기법/연구";
  if (/\b(library|framework|sdk|open[- ]?source|toolkit|cli)\b/.test(t)) return "툴/라이브러리";
  if (/\b(funding|raises|policy|regulation|lawsuit|acquire)\b/.test(t)) return "산업/정책";
  return "기타";
}

// ---------- arXiv ----------
async function fetchArxiv() {
  const url = "http://export.arxiv.org/api/query?search_query=" +
    encodeURIComponent("cat:cs.AI OR cat:cs.CL OR cat:cs.LG") +
    "&sortBy=submittedDate&sortOrder=descending&start=0&max_results=" + N_ARXIV;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => {
    const get = (tag) => { const m = e.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? clean(m[1]) : ""; };
    const link = (e.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || "";
    const title = get("title");
    const summary = get("summary");
    return {
      source: "arXiv", title, url: clean(link),
      published: (e.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || "",
      summary: truncate(summary, 400),
      signal: "최신 제출 (cs.AI/CL/LG)",
      category: categoryHint(title + " " + summary),
    };
  });
}

// ---------- Hacker News (Algolia) ----------
async function fetchHN() {
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 3600; // 최근 7일
  const url = "http://hn.algolia.com/api/v1/search_by_date?tags=story&query=" +
    encodeURIComponent("AI") +
    "&hitsPerPage=60&numericFilters=" + encodeURIComponent(`created_at_i>${since},points>20`);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const j = await res.json();
  const hits = (j.hits || []).sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, N_HN);
  return hits.map((h) => ({
    source: "HackerNews", title: clean(h.title),
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    published: h.created_at || "",
    summary: "",
    signal: `${h.points || 0} points · ${h.num_comments || 0} comments`,
    category: categoryHint(h.title || ""),
    discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
  }));
}

// ---------- GitHub (최근 생성 + 별점순, trending 근사) ----------
async function fetchGitHub() {
  const d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  // 최근 활발(pushed) + 인기(stars) = 트렌딩 근사. 괄호/in: 조합은 0건이라 단순 AND 사용.
  const q = `LLM pushed:>${d} stars:>50`;
  const url = "https://api.github.com/search/repositories?q=" + encodeURIComponent(q) +
    "&sort=stars&order=desc&per_page=" + N_GH;
  const headers = { "User-Agent": UA, "Accept": "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = "Bearer " + process.env.GITHUB_TOKEN;
  const res = await fetch(url, { headers });
  const j = await res.json();
  if (!j.items) throw new Error("GitHub 응답 이상: " + JSON.stringify(j).slice(0, 200));
  return j.items.map((r) => ({
    source: "GitHub", title: r.full_name,
    url: r.html_url,
    published: r.created_at || "",
    summary: truncate(clean(r.description || ""), 300),
    signal: `★ ${r.stargazers_count} · ${r.language || "?"}`,
    category: "툴/라이브러리",
  }));
}

// ---------- main ----------
(async () => {
  const results = [];
  for (const [name, fn] of [["arXiv", fetchArxiv], ["HackerNews", fetchHN], ["GitHub", fetchGitHub]]) {
    try {
      const items = await fn();
      console.log(`  ${name}: ${items.length}개`);
      results.push(...items);
    } catch (err) {
      console.error(`  ${name} 실패: ${err.message}`);
    }
  }
  results.forEach((r, i) => (r.id = "T" + String(i + 1).padStart(2, "0")));

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "trends.json"), JSON.stringify(results, null, 2), "utf8");

  let md = `# AI 트렌드 수집 (${new Date().toISOString().slice(0, 10)})\n\n`;
  md += `총 ${results.length}건 — arXiv / Hacker News / GitHub\n\n`;
  for (const r of results) {
    md += `## ${r.id}. [${r.source}] ${r.title}\n`;
    md += `- URL: ${r.url}\n`;
    if (r.discussion) md += `- 토론: ${r.discussion}\n`;
    md += `- 발행: ${clean(r.published)}\n`;
    md += `- 신호: ${r.signal}\n`;
    md += `- 카테고리(힌트): ${r.category}\n`;
    if (r.summary) md += `- 요약: ${r.summary}\n`;
    md += `\n`;
  }
  fs.writeFileSync(path.join(outDir, "trends.md"), md, "utf8");

  console.log(`\n✅ 총 ${results.length}건`);
  console.log(`   → ${path.join(outDir, "trends.json")}`);
  console.log(`   → ${path.join(outDir, "trends.md")}`);
})();
