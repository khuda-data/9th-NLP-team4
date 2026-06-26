"use client";

import { useEffect, useState } from "react";
import Feed from "@/components/Feed";
import type { AnalyzeResult } from "@/lib/types";
import demoMatches from "@/data/matches.json";
import demoMeta from "@/data/feed-meta.json";

const STAGES = ["레포 클론", "코드 패킹", "트렌드 수집", "Gemini 매칭"];
const EXAMPLES = ["lkh3409/Gram", "AsyncFuncAI/deepwiki-open", "openai/openai-python"];

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // API 키는 브라우저 localStorage에 보관(한 번만 입력). 서버 .env.local이 있으면 비워둬도 됨.
  useEffect(() => {
    const saved = localStorage.getItem("codepulse_gemini_key");
    if (saved) setApiKey(saved);
  }, []);

  function saveKey(v: string) {
    setApiKey(v);
    if (v.trim()) localStorage.setItem("codepulse_gemini_key", v.trim());
    else localStorage.removeItem("codepulse_gemini_key");
  }

  async function analyze(url: string) {
    setError(null);
    setLoading(true);
    setStage(0);
    // 진행 표시는 실제 단계와 동기화할 수 없으니 시간 기반 추정으로 연출
    const timers = [
      setTimeout(() => setStage(1), 2500),
      setTimeout(() => setStage(2), 6000),
      setTimeout(() => setStage(3), 9000),
    ];
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url, apiKey: apiKey.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `분석 실패 (${res.status})`);
      setResult(data as AnalyzeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  }

  function showDemo() {
    setError(null);
    setResult({
      repo: demoMeta.repo,
      repoUrl: "https://github.com/lkh3409/Gram",
      date: demoMeta.date,
      collected: demoMeta.collected,
      meta: { repoName: demoMeta.repo, tags: [], languages: [], dependencies: [], counts: {} },
      matches: demoMatches as AnalyzeResult["matches"],
    });
  }

  if (result) {
    return (
      <Feed
        matches={result.matches}
        meta={{ repo: result.repo, collected: result.collected, date: result.date }}
        onReset={() => {
          setResult(null);
          setRepoUrl("");
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-2xl font-bold">
          <span className="text-fuchsia-400">◉</span> CodePulse
        </div>
        <p className="text-lg font-semibold text-white">내 코드를 아는 AI 트렌드 레이더</p>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          GitHub 레포를 연결하면, 새로 나온 AI 기술로<br />
          <span className="text-white/80">내 코드를 어떻게 대체·개선할지</span>까지 짚어 드립니다.
        </p>
      </div>

      {!loading && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (repoUrl.trim()) analyze(repoUrl);
            }}
            className="space-y-3"
          >
            <input
              autoFocus
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-fuchsia-400/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!repoUrl.trim()}
              className="w-full rounded-lg bg-fuchsia-500/90 px-4 py-3 font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
            >
              레이더 켜기
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>예시:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setRepoUrl(`https://github.com/${ex}`);
                }}
                className="rounded-full border border-white/10 px-2.5 py-1 text-white/60 transition hover:border-white/30 hover:text-white/80"
              >
                {ex}
              </button>
            ))}
          </div>

          {/* API 키 (선택) — 넣으면 이 키로, 비우면 서버 .env.local 사용 */}
          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/60">
                🔑 Gemini API 키
                {apiKey.trim() && <span className="text-xs text-emerald-400">· 저장됨</span>}
              </span>
              <button
                onClick={() => setShowKey((v) => !v)}
                className="text-xs text-white/40 hover:text-white/70"
              >
                {showKey ? "닫기" : apiKey.trim() ? "변경" : "입력"}
              </button>
            </div>
            {showKey && (
              <div className="mt-3 space-y-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveKey(e.target.value)}
                  placeholder="AIza... (브라우저에만 저장)"
                  className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25 focus:border-fuchsia-400/60 focus:outline-none"
                />
                <p className="text-xs leading-relaxed text-white/35">
                  이 칸이 비어 있으면 서버의 <code className="text-white/50">.env.local</code> 키를 씁니다. 입력하면
                  이 브라우저(localStorage)에만 저장되어 다음에 다시 안 넣어도 됩니다.{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">키 발급</a>
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={showDemo}
            className="mt-8 text-center text-xs text-white/35 underline-offset-4 hover:text-white/60 hover:underline"
          >
            API 키 없이 데모 결과 보기 (Gram 레포 사전 분석본)
          </button>
        </>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="text-center text-sm text-white/60">
            <span className="font-mono text-white/80">{repoUrl.replace(/^https?:\/\/github\.com\//, "")}</span>{" "}
            분석 중…
          </div>
          <ul className="mx-auto max-w-xs space-y-2">
            {STAGES.map((label, i) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    i < stage
                      ? "text-emerald-400"
                      : i === stage
                        ? "animate-pulse text-fuchsia-400"
                        : "text-white/25"
                  }
                >
                  {i < stage ? "✓" : i === stage ? "◐" : "○"}
                </span>
                <span className={i <= stage ? "text-white/80" : "text-white/35"}>{label}</span>
              </li>
            ))}
          </ul>
          <p className="text-center text-xs text-white/30">레포 크기에 따라 10~60초 걸릴 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}
