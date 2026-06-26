// packer.ts — 레포 전체(README + 코드)를 LLM-friendly 단일 컨텍스트로 패킹
// repo_packer.js(스파이크 CLI)의 핵심 로직을 함수로 이식. 의존성 없음.

import fs from "node:fs";
import path from "node:path";
import type { RepoMeta } from "./types";

const MAX_TOTAL_CHARS = 300_000;
const MAX_FILE_CHARS = 16_000;

const IGNORE_DIRS = new Set([
  ".git", "node_modules", ".venv", "venv", "env", "__pycache__", ".mypy_cache",
  ".pytest_cache", "dist", "build", ".next", ".nuxt", "out", "target", ".idea",
  ".vscode", "coverage", ".turbo", ".cache", "vendor", "site-packages", ".gradle",
  "bin", "obj", ".terraform", "migrations",
]);

const CODE_EXT = new Set([
  ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte",
  ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs", ".cpp", ".cc", ".c",
  ".h", ".hpp", ".scala", ".swift", ".sql", ".sh", ".bash", ".r", ".jl",
  ".yaml", ".yml", ".toml", ".ipynb",
]);

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

type FileEntry = { rel: string; abs: string; ext: string; size: number };

function readSafe(abs: string): string {
  try { return fs.readFileSync(abs, "utf8"); } catch { return ""; }
}

export function packRepo(repoPath: string): { context: string; meta: RepoMeta } {
  const repoName = path.basename(path.resolve(repoPath));
  const files: FileEntry[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.isDirectory() && !IGNORE_DIRS.has(e.name) && e.name !== ".github") continue;
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

  const readmes = files.filter((f) => /^readme/i.test(path.basename(f.rel)) || (/readme/i.test(f.rel) && f.ext === ".md"));
  const manifests = files.filter((f) => MANIFESTS.has(path.basename(f.rel)) && !readmes.includes(f));
  const codeFiles = files.filter((f) => CODE_EXT.has(f.ext) && !manifests.includes(f) && !readmes.includes(f));

  function score(f: FileEntry): number {
    const depth = f.rel.split("/").length;
    const base = path.basename(f.rel).toLowerCase();
    let s = depth * 10;
    if (/^(main|index|app|server|__init__|cli)\./.test(base)) s -= 25;
    if (/^(src|app|backend|server|core)\//.test(f.rel)) s -= 8;
    if (/(test|spec|__tests__|\.test\.|\.spec\.)/i.test(f.rel)) s += 40;
    return s;
  }
  codeFiles.sort((a, b) => score(a) - score(b) || a.rel.localeCompare(b.rel));

  const langBytes: Record<string, number> = {};
  for (const f of files) {
    if (!CODE_EXT.has(f.ext)) continue;
    langBytes[f.ext] = (langBytes[f.ext] || 0) + f.size;
  }
  const langTop = Object.entries(langBytes).sort((a, b) => b[1] - a[1])
    .map(([ext, b]) => `${ext} (${Math.round(b / 1024)}KB)`);

  const deps = new Set<string>();
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
      txt.split(/\r?\n/).forEach((line) => {
        const l = line.trim();
        if (l && !l.startsWith("#") && !l.startsWith("-")) {
          const name = l.split(/[=<>!~;\[ ]/)[0].trim();
          if (name) deps.add(name);
        }
      });
    } else if (base === "pyproject.toml" || base === "Pipfile") {
      const m = txt.match(/^[ \t]*([A-Za-z0-9_.\-]+)\s*=/gm);
      if (m) m.forEach((x) => {
        const n = x.split("=")[0].trim();
        if (n && !["python", "name", "version", "description", "authors", "readme", "requires-python"].includes(n)) deps.add(n);
      });
    }
  }
  const depList = [...deps];

  const depStr = depList.join(" ").toLowerCase();
  const tags: string[] = [];
  const rule = (re: RegExp, tag: string) => { if (re.test(depStr)) tags.push(tag); };
  rule(/torch|tensorflow|keras|\bjax\b|scikit-learn|sklearn|xgboost|lightgbm/, "ML/DL");
  rule(/langchain|llama[_-]?index|llamaindex|\bopenai\b|anthropic|google-genai|generativeai|\bgemini\b|transformers|sentence-transformers/, "LLM");
  rule(/chromadb|\bfaiss|pinecone|weaviate|qdrant|pgvector|\bmilvus/, "RAG/VectorDB");
  rule(/fastapi|flask|django|uvicorn|\bexpress\b|nestjs|koa|starlette/, "Backend/API");
  rule(/\breact\b|next|\bvue\b|svelte|@angular|nuxt/, "Frontend");
  rule(/pandas|numpy|polars|pyspark|\bdask\b/, "Data");
  rule(/sqlalchemy|psycopg2|pymongo|\bredis\b|prisma|mongoose|sqlite/, "DB");
  rule(/scrapy|beautifulsoup|bs4|playwright|selenium|requests|httpx|aiohttp/, "Crawling/HTTP");

  const included: string[] = [];
  const truncated: string[] = [];
  const skipped: string[] = [];
  let budget = MAX_TOTAL_CHARS;

  function fence(rel: string): string {
    const ext = path.extname(rel).slice(1);
    const map: Record<string, string> = {
      py: "python", js: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx",
      md: "markdown", yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql",
      sh: "bash", json: "json", java: "java", go: "go", rs: "rust",
    };
    return map[ext] || ext || "";
  }
  function block(f: FileEntry): string {
    let txt = readSafe(f.abs);
    if (txt == null) return "";
    let note = "";
    if (txt.length > MAX_FILE_CHARS) {
      const orig = txt.length;
      txt = txt.slice(0, MAX_FILE_CHARS);
      note = `\n... (잘림: 원본 ${(orig / 1024).toFixed(1)}KB)`;
      truncated.push(f.rel);
    }
    included.push(f.rel);
    return `\n### \`${f.rel}\`\n\n\`\`\`${fence(f.rel)}\n${txt}${note}\n\`\`\`\n`;
  }

  let md = "";
  md += `# 프로젝트 컨텍스트: ${repoName}\n\n`;
  md += `> repo_packer 자동 생성 — README + 코드 전체를 LLM에 넣기 위한 단일 컨텍스트\n\n`;
  md += `## 개요\n\n`;
  md += `- **이름**: ${repoName}\n`;
  md += `- **추론 스택/도메인**: ${tags.length ? tags.join(", ") : "(추론 불가)"}\n`;
  md += `- **주요 언어(코드량)**: ${langTop.slice(0, 8).join(", ") || "-"}\n`;
  md += `- **의존성(${depList.length})**: ${depList.slice(0, 60).join(", ")}${depList.length > 60 ? " …" : ""}\n`;
  md += `- **전체 파일 수**: ${files.length} (코드 ${codeFiles.length}, 매니페스트 ${manifests.length}, README ${readmes.length})\n\n`;

  md += `## 파일 트리\n\n\`\`\`\n`;
  const treeFiles = [...readmes, ...manifests, ...codeFiles].map((f) => f.rel).sort();
  md += treeFiles.slice(0, 200).join("\n") + (treeFiles.length > 200 ? `\n... (+${treeFiles.length - 200} more)` : "") + "\n```\n";

  md += `\n## README\n`;
  if (readmes.length) {
    for (const f of readmes) md += block(f);
  } else {
    md += "\n(README 없음)\n";
  }

  if (manifests.length) {
    md += `\n## 의존성/설정 파일\n`;
    for (const f of manifests) md += block(f);
  }

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

  const meta: RepoMeta = {
    repoName, tags, languages: langTop, dependencies: depList,
    counts: {
      total: files.length, code: codeFiles.length, manifests: manifests.length,
      readmes: readmes.length, included: included.length, skipped: skipped.length, truncated: truncated.length,
    },
  };

  return { context: md, meta };
}
