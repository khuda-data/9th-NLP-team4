// pipeline.ts — 엔드투엔드 오케스트레이션
// repo_url → git clone → 패킹 → 트렌드(캐시/수집) → Gemini 매칭 → AnalyzeResult

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { packRepo } from "./packer";
import { loadOrCollectTrends } from "./trends";
import { matchTrends } from "./matcher";
import type { AnalyzeResult } from "./types";

const execFileP = promisify(execFile);

const GITHUB_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

export function normalizeRepoUrl(input: string): { url: string; name: string } {
  let url = (input || "").trim();
  if (!url) throw new Error("레포 URL이 비어 있습니다.");
  // owner/repo 축약 입력 허용
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  url = url.replace(/\.git$/i, "").replace(/\/$/, "");
  if (!GITHUB_RE.test(url)) {
    throw new Error("올바른 GitHub 레포 URL이 아닙니다. 예: https://github.com/owner/repo");
  }
  const name = url.split("/").pop() || "repo";
  return { url, name };
}

// PATH에서 git을 못 찾는 환경(서버 프로세스 PATH 누락)을 대비한 폴백 경로
const GIT_FALLBACKS = [
  process.env.GIT_PATH,
  "git",
  "C:\\Program Files\\Git\\cmd\\git.exe",
  "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
].filter(Boolean) as string[];

async function cloneRepo(url: string, dest: string): Promise<void> {
  const args = ["clone", "--depth", "1", "--quiet", url, dest];
  const opts = { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 };
  let lastErr: unknown;
  for (const bin of GIT_FALLBACKS) {
    try {
      await execFileP(bin, args, opts);
      return;
    } catch (err) {
      lastErr = err;
      // git 실행 파일을 못 찾은 경우(ENOENT)만 다음 후보로, 그 외 에러는 즉시 전달
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      throw err;
    }
  }
  throw lastErr;
}

export async function analyzeRepo(repoUrlInput: string, apiKey?: string): Promise<AnalyzeResult> {
  const { url, name } = normalizeRepoUrl(repoUrlInput);

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codepulse-"));
  const dest = path.join(tmpBase, name);
  try {
    await cloneRepo(url, dest).catch((err) => {
      const detail = [
        err?.code !== undefined && `code=${err.code}`,
        err?.errno !== undefined && `errno=${err.errno}`,
        err?.syscall && `syscall=${err.syscall}`,
        err?.path && `path=${err.path}`,
        err?.message,
        err?.stderr && `stderr=${err.stderr}`,
      ].filter(Boolean).join(" | ");
      throw new Error(`git clone 실패: ${detail}`.slice(0, 600));
    });

    const { context, meta } = packRepo(dest);
    const trends = await loadOrCollectTrends();
    const matches = await matchTrends(context, trends, apiKey);

    return {
      repo: name,
      repoUrl: url,
      date: new Date().toISOString().slice(0, 10),
      collected: trends.length,
      meta,
      matches,
    };
  } finally {
    // 임시 클론 정리
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
  }
}
