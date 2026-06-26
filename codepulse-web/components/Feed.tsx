"use client";

import { useState } from "react";
import type { Match, Classification } from "@/lib/types";

type Meta = { repo: string; collected: number; date: string };

const STYLE: Record<Classification, { dot: string; chip: string; ring: string }> = {
  영향: { dot: "🔴", chip: "bg-red-500/15 text-red-300 border-red-500/40", ring: "hover:border-red-500/50" },
  대체후보: { dot: "🟡", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40", ring: "hover:border-amber-500/50" },
  신규적용: { dot: "🟢", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", ring: "hover:border-emerald-500/50" },
};

// 기획 우선순위: 대체후보(최우선) > 신규적용 > 영향(덤)
const FILTERS: { key: "전체" | Classification; label: string }[] = [
  { key: "전체", label: "전체" },
  { key: "대체후보", label: "🟡 대체후보" },
  { key: "신규적용", label: "🟢 신규적용" },
  { key: "영향", label: "🔴 영향" },
];

const PRIORITY: Record<Classification, number> = { 대체후보: 0, 신규적용: 1, 영향: 2 };

export default function Feed({
  matches: raw,
  meta,
  onReset,
}: {
  matches: Match[];
  meta: Meta;
  onReset?: () => void;
}) {
  // 분류 우선순위(대체후보>신규적용>영향) → 같은 분류면 관련도 높은 순
  const matches = raw
    .slice()
    .sort((a, b) => PRIORITY[a.classification] - PRIORITY[b.classification] || b.relevance - a.relevance);
  const [filter, setFilter] = useState<"전체" | Classification>("전체");
  const shown = filter === "전체" ? matches : matches.filter((m) => m.classification === filter);
  const excluded = Math.max(0, meta.collected - matches.length);
  const count = (cls: "전체" | Classification) =>
    cls === "전체" ? matches.length : matches.filter((m) => m.classification === cls).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20">
      {/* TopNav */}
      <header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-white/10 bg-[#0b0e14]/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-fuchsia-400">◉</span> CodePulse
          </div>
          <div className="flex items-center gap-3 text-sm text-white/60">
            <button
              onClick={onReset}
              className="rounded-md border border-white/15 px-2 py-1 text-white/80 transition hover:border-white/40"
              title="다른 레포 분석"
            >
              {meta.repo} ▾
            </button>
            <span>{meta.date}</span>
            <span className="cursor-default">⚙</span>
            <span className="cursor-default">🔔</span>
          </div>
        </div>
      </header>

      {/* Summary */}
      <div className="mb-1 flex items-end justify-between">
        <h1 className="text-2xl font-bold">오늘의 레이더</h1>
        <div className="text-sm text-white/55">
          수집 <span className="text-white/80">{meta.collected}</span> → 선별{" "}
          <span className="font-semibold text-white">{matches.length}</span>
        </div>
      </div>
      <p className="mb-5 text-xs text-white/40">
        새 기술로 <span className="text-white/60">내 코드를 어떻게 바꿀지</span>(🟡대체·🟢신규)를 우선으로,
        버전·보안(🔴영향)은 덤으로 보여줍니다.
      </p>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filter === f.key
                ? "border-white/40 bg-white/10 text-white"
                : "border-white/10 text-white/60 hover:border-white/25"
            }`}
          >
            {f.label} {count(f.key)}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {shown.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/50">
            이 분류에 해당하는 항목이 없습니다.
          </div>
        )}
        {shown.map((m) => {
          const s = STYLE[m.classification];
          return (
            <details
              key={m.trend_id}
              className={`group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition ${s.ring}`}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${s.chip}`}>
                      {s.dot} {m.classification}
                    </span>
                    <span className="text-xs text-white/40">{m.source}</span>
                  </div>
                  <div className="truncate font-semibold text-white">{m.title ?? m.trend_id}</div>
                  <div className="mt-1 text-sm text-white/70">
                    <span className="text-white/40">왜 ▸ </span>
                    {m.why}
                  </div>
                  <div className="mt-1 text-sm text-sky-300/90">→ {m.next_action}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-white/40">관련도</div>
                  <div className="text-lg font-bold text-white">{m.relevance}</div>
                </div>
              </summary>

              <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
                {m.grounding && (
                  <div>
                    <div className="mb-1 text-white/40">근거 (코드)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.grounding.split(/,\s*/).map((g) => (
                        <code key={g} className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-emerald-200">
                          {g}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {m.condition && (
                  <div className="text-amber-300/90">
                    <span className="text-white/40">조건 · </span>
                    {m.condition}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">
                      📎 출처 보기
                    </a>
                  )}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 text-xs text-white/40">💬 이게 왜 내 코드에? (v2: RAG 연결 예정)</div>
                  <div className="flex gap-2">
                    <input
                      disabled
                      placeholder="예: app.py 어디를 고쳐야 해?"
                      className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/50 placeholder:text-white/25"
                    />
                    <button disabled className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/40">
                      전송
                    </button>
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      {/* Excluded */}
      <details className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-white/50">
        <summary className="cursor-pointer">▸ 제외된 {excluded}건 보기 (노이즈로 걸러짐)</summary>
        <p className="mt-3 leading-relaxed">
          수집된 {meta.collected}건 중 이 레포와 무관한 {excluded}건(무관 논문·에이전트 프레임워크·일반 AI 뉴스 등)은
          관련도 기준 미달로 제외했습니다. <span className="text-white/30">— "덜 보여주기"가 핵심 가치입니다.</span>
        </p>
      </details>

      <footer className="mt-10 text-center text-xs text-white/25">
        CodePulse MVP · 데이터: 실시간 분석({meta.repo}) · Next.js Route Handler 백엔드
      </footer>
    </div>
  );
}
