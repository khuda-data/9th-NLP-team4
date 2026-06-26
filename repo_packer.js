#!/usr/bin/env node
/*
 * repo_packer.js — 레포 전체(README + 코드)를 LLM-friendly 단일 컨텍스트로 패킹
 *
 * 사용법:
 *   node repo_packer.js <repo_경로> [출력폴더]
 *   예) node repo_packer.js "C:\\Users\\me\\projects\\my-repo"
 *
 * 결과물:
 *   <출력폴더>/repo_context.md  ← LLM에 통째로 넣을 프로젝트 컨텍스트 (README + 코드)
 *   <출력폴더>/repo_meta.json   ← 언어/의존성/포함파일 요약 메타데이터
 *
 * 의존성 없음 (node 단독 실행).
 */

const fs = require("fs");
const path = require("path");

// ---------- 설정 ----------
const MAX_TOTAL_CHARS = 300_000; // 전체 코드 본문 상한 (대략. README/매니페스트는 별도 우선 포함)
const MAX_FILE_CHARS = 16_000;   // 파일 1개당 상한 (넘으면 잘라서 표시)

const IGNORE_DIRS = new Set([
  ".git", "node_modules", ".venv", "venv", "env", "__pycache__", ".mypy_cache",
  ".pytest_cache", "dist", "build", ".next", ".nuxt", "out", "target", ".idea",
  ".vscode", "coverage", ".turbo", ".cache", "vendor", "site-packages", ".gradle",
  "bin", "obj", ".terraform", "migrations",
]);

// 코드/문서로 취급할 확장자
const CODE_EXT = new Set([
  ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte",
  ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs", ".cpp", ".cc", ".c",
  ".h", ".hpp", ".scala", ".swift", ".sql", ".sh", ".bash", ".r", ".jl",
  ".yaml", ".yml", ".toml", ".ipynb",
]);

// 의존성/설정 매니페스트 (우선 포함)
const MANIFESTS = new Set([
  "package.json", "requirements.txt", "pyproject.toml", "Pipfile", "setup.py",
  "setup.cfg", "environment.yml", "go.mod", "Cargo.toml", "pom.xml",
  "build.gradle", "Gemfile", "composer.json", "Dockerfile", "docker-compose.yml",
]);

const SKIP_FILE_RE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock|\.min\.(js|css)$)/i;
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".pdf", ".zip",
  ".gz", ".tar", ".mp4", ".mov", ".mp3", ".wav", ".woff", ".woff2", ".ttf",
  ".eot", ".otf", ".bin", ".pt", ".pth", ".onnx", ".h5", ".pkl", ".npy",
  ".parquet", ".db", ".sqlite", ".lock", ".exe", ".dll", ".so", ".dylib",
]);

// ---------- 인자 ----------
const repoPath = process.argv[2];
const outDir = process.argv[3] || process.cwd();
if (!repoPath) {
  console.error("사용법: node repo_packer.js <repo_경로> [출력폴더]");
  process.exit(1);
}
if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
  console.error("경로를 찾을 수 없거나 폴더가 아닙니다:", repoPath);
  process.exit(1);
}
const repoName = path.basename(path.resolve(repoPath));

// ---------- 파일 수집 ----------
/** @type {{rel:string, abs:string, ext:string, size:number}[]} */
const files = [];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.isDirectory() && !IGNORE_DIRS.has(e.name) && e.name !== ".github") {
      // 숨김 폴더는 .github 빼고 스킵
      continue;
    }
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(abs);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (BINARY_EXT.has(ext)) continue;
      if (SKIP_FILE_RE.test(e.name)) continue;
      let size = 0;
      try { size = fs.statSync(abs).size; } catch {}
      files.push({ rel: path.relative(repoPath, abs).split(path.sep).join("/"), abs, ext, size });
    }
  }
}
walk(repoPath);

// ---------- 분류 ----------
const readmes = files.filter((f) => /^readme/i.test(path.basename(f.rel)) || /readme/i.test(f.rel) && f.ext === ".md");
const manifests = files.filter((f) => MANIFESTS.has(path.basename(f.rel)) && !readmes.includes(f));
const codeFiles = files.filter(
  (f) => CODE_EXT.has(f.ext) && !manifests.includes(f) && !readmes.includes(f)
);

// 코드 파일 중요도 정렬: 얕은 depth 먼저, 엔트리포인트 우선
function score(f) {
  const depth = f.rel.split("/").length;
  const base = path.basename(f.rel).toLowerCase();
  let s = depth * 10;
  if (/^(main|index|app|server|__init__|cli)\./.test(base)) s -= 25;
  if (/^(src|app|backend|server|core)\//.test(f.rel)) s -= 8;
  if (/(test|spec|__tests__|\.test\.|\.spec\.)/i.test(f.rel)) s += 40; // 테스트는 뒤로
  return s;
}
codeFiles.sort((a, b) => score(a) - score(b) || a.rel.localeCompare(b.rel));

// ---------- 언어 통계 ----------
const langBytes = {};
for (const f of files) {
  if (!CODE_EXT.has(f.ext)) continue;
  langBytes[f.ext] = (langBytes[f.ext] || 0) + f.size;
}
const langTop = Object.entries(langBytes).sort((a, b) => b[1] - a[1])
  .map(([ext, b]) => `${ext} (${Math.round(b / 1024)}KB)`);

// ---------- 의존성 추출 ----------
function readSafe(abs) { try { return fs.readFileSync(abs, "utf8"); } catch { return ""; } }
const deps = new Set();
for (const f of manifests) {
  const base = path.basename(f.rel);
  const txt = readSafe(f.abs);
  if (base === "package.json") {
    try {
      const j = JSON.parse(txt);
      Object.keys(j.dependencies || {}).forEach((d) => deps.add(d));
      Object.keys(j.devDependencies || {}).forEach((d) => deps.add(d));
    } catch {}
  } else if (base === "requirements.txt") {
    txt.split(/\r?\n/).forEach((l) => {
      l = l.trim();
      if (l && !l.startsWith("#") && !l.startsWith("-")) {
        const name = l.split(/[=<>!~;\[ ]/)[0].trim();
        if (name) deps.add(name);
      }
    });
  } else if (base === "pyproject.toml" || base === "Pipfile") {
    const m = txt.match(/^[ \t]*([A-Za-z0-9_.\-]+)\s*=/gm);
    if (m) m.forEach((x) => { const n = x.split("=")[0].trim(); if (n && !["python", "name", "version", "description", "authors", "readme", "requires-python"].includes(n)) deps.add(n); });
  }
}
const depList = [...deps];

// ---------- 스택/도메인 추론 ----------
const depStr = depList.join(" ").toLowerCase();
const tags = [];
const rule = (re, tag) => { if (re.test(depStr)) tags.push(tag); };
rule(/torch|tensorflow|keras|\bjax\b|scikit-learn|sklearn|xgboost|lightgbm/, "ML/DL");
rule(/langchain|llama[_-]?index|llamaindex|\bopenai\b|anthropic|google-genai|generativeai|\bgemini\b|transformers|sentence-transformers/, "LLM");
rule(/chromadb|\bfaiss|pinecone|weaviate|qdrant|pgvector|\bmilvus/, "RAG/VectorDB");
rule(/fastapi|flask|django|uvicorn|\bexpress\b|nestjs|koa|starlette/, "Backend/API");
rule(/\breact\b|next|\bvue\b|svelte|@angular|nuxt/, "Frontend");
rule(/pandas|numpy|polars|pyspark|\bdask\b/, "Data");
rule(/sqlalchemy|psycopg2|pymongo|\bredis\b|prisma|mongoose|sqlite/, "DB");
rule(/scrapy|beautifulsoup|bs4|playwright|selenium|requests|httpx|aiohttp/, "Crawling/HTTP");

// ---------- Markdown 패킹 ----------
let included = [], skipped = [], truncated = [];
let budget = MAX_TOTAL_CHARS;

function fence(rel) {
  const ext = path.extname(rel).slice(1);
  const lang = { py: "python", js: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx", md: "markdown", yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql", sh: "bash", json: "json", java: "java", go: "go", rs: "rust" }[ext] || ext || "";
  return lang;
}
function block(f, forcePartial) {
  let txt = readSafe(f.abs);
  if (txt == null) return "";
  let note = "";
  const cap = MAX_FILE_CHARS;
  if (txt.length > cap) { txt = txt.slice(0, cap); note = `\n... (잘림: 원본 ${(readSafe(f.abs).length / 1024).toFixed(1)}KB)`; truncated.push(f.rel); }
  included.push(f.rel);
  return `\n### \`${f.rel}\`\n\n\`\`\`${fence(f.rel)}\n${txt}${note}\n\`\`\`\n`;
}

let md = "";
md += `# 프로젝트 컨텍스트: ${repoName}\n\n`;
md += `> repo_packer.js 자동 생성 — README + 코드 전체를 LLM에 넣기 위한 단일 컨텍스트\n\n`;
md += `## 개요\n\n`;
md += `- **이름**: ${repoName}\n`;
md += `- **추론 스택/도메인**: ${tags.length ? tags.join(", ") : "(추론 불가)"}\n`;
md += `- **주요 언어(코드량)**: ${langTop.slice(0, 8).join(", ") || "-"}\n`;
md += `- **의존성(${depList.length})**: ${depList.slice(0, 60).join(", ")}${depList.length > 60 ? " …" : ""}\n`;
md += `- **전체 파일 수**: ${files.length} (코드 ${codeFiles.length}, 매니페스트 ${manifests.length}, README ${readmes.length})\n\n`;

// 파일 트리(간단)
md += `## 파일 트리\n\n\`\`\`\n`;
const treeFiles = [...readmes, ...manifests, ...codeFiles].map((f) => f.rel).sort();
md += treeFiles.slice(0, 200).join("\n") + (treeFiles.length > 200 ? `\n... (+${treeFiles.length - 200} more)` : "") + "\n\`\`\`\n";

// README (전문, 우선)
md += `\n## README\n`;
if (readmes.length) {
  for (const f of readmes) { md += block(f); }
} else { md += "\n(README 없음)\n"; }

// 매니페스트
if (manifests.length) {
  md += `\n## 의존성/설정 파일\n`;
  for (const f of manifests) { md += block(f); }
}

// 코드 (예산 내에서)
md += `\n## 소스 코드\n`;
for (const f of codeFiles) {
  const approx = Math.min(f.size, MAX_FILE_CHARS) + 200;
  if (budget - approx < 0) { skipped.push(f.rel); continue; }
  const b = block(f);
  budget -= b.length;
  md += b;
}
if (skipped.length) {
  md += `\n## (예산 초과로 생략된 파일: ${skipped.length}개)\n\n` + skipped.slice(0, 100).map((s) => `- ${s}`).join("\n") + "\n";
}

// ---------- 출력 ----------
fs.mkdirSync(outDir, { recursive: true });
const mdPath = path.join(outDir, "repo_context.md");
fs.writeFileSync(mdPath, md, "utf8");

const meta = {
  repoName, tags, languages: langTop, dependencies: depList,
  counts: { total: files.length, code: codeFiles.length, manifests: manifests.length, readmes: readmes.length, included: included.length, skipped: skipped.length, truncated: truncated.length },
  includedFiles: included, skippedFiles: skipped, truncatedFiles: truncated,
};
const metaPath = path.join(outDir, "repo_meta.json");
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

console.log(`✅ 완료`);
console.log(`   스택/도메인 : ${tags.join(", ") || "(추론 불가)"}`);
console.log(`   의존성       : ${depList.length}개`);
console.log(`   파일         : 전체 ${files.length} / 포함 ${included.length} / 생략 ${skipped.length} / 잘림 ${truncated.length}`);
console.log(`   컨텍스트 크기: ${(md.length / 1024).toFixed(1)}KB (${md.length} chars)`);
console.log(`   →  ${mdPath}`);
console.log(`   →  ${metaPath}`);
