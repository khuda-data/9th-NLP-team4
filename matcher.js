#!/usr/bin/env node
/*
 * matcher.js — CodePulse 매칭·영향 엔진 (MVP v0)
 *
 * 입력: repo_context.md (프로젝트 컨텍스트) + trends.json (수집된 트렌드)
 * 처리: Gemini에게 "이 프로젝트에 실제로 의미 있는 트렌드만" 골라
 *       [영향]/[대체후보]/[신규적용] 분류 + 왜(코드 근거) + 다음 행동 생성
 * 출력: matches.json (구조화) + matches.md (피드/푸시용)
 *
 * 사용법:
 *   set GEMINI_API_KEY=...   (또는 $env:GEMINI_API_KEY="...")
 *   node matcher.js <repo_context.md> <trends.json> [출력폴더]
 *
 * 환경변수:
 *   GEMINI_API_KEY  (필수 — 없으면 프롬프트만 파일로 저장)
 *   GEMINI_MODEL    (선택, 기본 gemini-2.0-flash)
 */

const fs = require("fs");
const path = require("path");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const MIN_RELEVANCE = 40;

const [, , repoCtxPath, trendsPath, outArg] = process.argv;
if (!repoCtxPath || !trendsPath) {
  console.error("사용법: node matcher.js <repo_context.md> <trends.json> [출력폴더]");
  process.exit(1);
}
const outDir = outArg || process.cwd();
const repoCtx = fs.readFileSync(repoCtxPath, "utf8");
const trends = JSON.parse(fs.readFileSync(trendsPath, "utf8"));

// 트렌드를 프롬프트용으로 압축
const trendsBlock = trends.map((t) =>
  `- ${t.trend_id} [${t.source}/${t.type}] ${t.title}\n  url: ${t.url}\n  tags: ${[...(t.task_tags || []), ...(t.dependency_tags || []), ...(t.impact_tags || []), ...(t.keyword_tags || [])].join(", ") || "none"}\n  요약: ${t.summary || ""}`
).join("\n");

const PROMPT = `당신은 "CodePulse"의 매칭·영향 엔진입니다. 사용자의 코드베이스를 깊이 이해한 시니어 개발자로서, 오늘 수집된 AI 트렌드 중 "이 프로젝트에 실제로 의미 있는 것"만 골라 영향을 분석합니다.

[규칙]
1. 사용자 프로젝트와 실제로 관련된 트렌드만 출력하라. 일반적 AI 뉴스·무관한 논문·이 프로젝트가 쓰지 않는 도메인(에이전트·로보틱스 등)은 과감히 제외하라. 적게 고르는 것이 가치다.
2. ★ 이 서비스의 핵심 가치는 "새로 나온 기술로 사용자의 '현재 구현'을 어떻게 더 낫게 바꿀지"를 짚어주는 것이다. 다음 우선순위로 분석하라:
   - "대체후보"(최우선): 사용자가 지금 쓰는 접근/기법/도구를 새로 나온 더 나은 것으로 대체. 예: 단순 top-k 검색 → 리랭킹/late-interaction. 가장 풍부하고 구체적으로 분석하라.
   - "신규적용"(우선): 아직 안 쓰지만 이 프로젝트에 새로 도입하면 가치 있는 기법/도구.
   - "영향"(부차적, 간결히): 직접 의존/사용하는 라이브러리의 버전·보안·deprecation 변화. 중요하지만 짧게 다뤄라.
3. "why"(왜 너에게)와 근거는 코드가 '무엇을 하는지'(아키텍처·접근방식·사용 기법·파일/모듈)에 두어라. 트렌드가 의존성 목록에 이미 있는지로만 판단하지 마라 — 새 기술이라도 사용자의 현재 구현을 대체/보완할 수 있으면, 그 구현 부분(파일·함수)을 근거로 [대체후보]/[신규적용]으로 적극 분류하라. 예: "rag/retriever.py가 FAISS 단순 top-k라서 리랭킹 기법으로 검색 단계를 대체 가능".
4. "next_action"(다음 행동)은 구체적이어야 한다. 특히 [대체후보]/[신규적용]은 "어느 파일·함수의 무엇을, 어떻게 바꾸면 되는지"까지 제시하라.
5. "relevance"(0~100)는 이 프로젝트 기준 관련도. ${MIN_RELEVANCE} 미만이면 출력하지 마라.
6. "grounding"에는 근거가 된 파일·모듈·사용 기법 이름을 적어라(의존성 이름에만 한정하지 말 것).
7. 조건부로만 의미 있으면 "condition"에 조건을 적어라(예: "신규적용 항목을 채택할 때만").
8. 모든 텍스트는 한국어. 사실이 아니라 추측이면 그렇게 표시하라. 코드에 없는 사실을 지어내지 마라.

[사용자 프로젝트 컨텍스트]
${repoCtx}

[오늘 수집된 트렌드 (${trends.length}건)]
${trendsBlock}

위 트렌드 중 이 프로젝트에 실제로 의미 있는 것만 골라, 관련도(relevance) 높은 순으로 JSON 배열로 출력하라.`;

// 프롬프트는 항상 파일로 저장 (키 없이도 확인 가능)
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "_prompt.txt"), PROMPT, "utf8");

if (!API_KEY) {
  console.log("⚠️  GEMINI_API_KEY 환경변수가 없습니다. 프롬프트만 저장했습니다.");
  console.log("   → " + path.join(outDir, "_prompt.txt"));
  console.log("   키 발급: https://aistudio.google.com/apikey");
  console.log('   실행:   $env:GEMINI_API_KEY="키"; node matcher.js ' + `"${repoCtxPath}" "${trendsPath}" "${outDir}"`);
  process.exit(0);
}

// Gemini 구조화 출력 스키마
const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      trend_id: { type: "STRING" },
      title: { type: "STRING" },
      source: { type: "STRING" },
      url: { type: "STRING" },
      classification: { type: "STRING", enum: ["영향", "대체후보", "신규적용"] },
      relevance: { type: "INTEGER" },
      why: { type: "STRING" },
      grounding: { type: "STRING" },
      next_action: { type: "STRING" },
      condition: { type: "STRING" },
    },
    required: ["trend_id", "classification", "relevance", "why", "next_action"],
  },
};

async function callGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}\n${text.slice(0, 800)}\n(모델명이 틀렸다면 GEMINI_MODEL 환경변수로 바꾸세요. 예: gemini-1.5-flash, gemini-2.5-flash)`);
  }
  const j = JSON.parse(text);
  const out = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("응답에 텍스트 없음: " + text.slice(0, 500));
  // JSON 파싱 (혹시 코드펜스 있으면 제거)
  const cleaned = out.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

const EMOJI = { "영향": "🔴", "대체후보": "🟡", "신규적용": "🟢" };

(async () => {
  console.log(`매칭 중... (model=${MODEL}, 트렌드 ${trends.length}건)`);
  let matches;
  try {
    matches = await callGemini();
  } catch (err) {
    console.error("❌ " + err.message);
    process.exit(1);
  }
  matches.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

  fs.writeFileSync(path.join(outDir, "matches.json"), JSON.stringify(matches, null, 2), "utf8");

  // 피드/푸시용 Markdown
  const repoName = (repoCtx.match(/# 프로젝트 컨텍스트: (.+)/) || [])[1] || path.basename(path.dirname(repoCtxPath));
  let md = `# 오늘의 레이더 — ${repoName}\n\n`;
  md += `수집 ${trends.length}건 → 관련 **${matches.length}건** 선별 (나머지 ${trends.length - matches.length}건은 노이즈로 제외)\n\n`;
  for (const m of matches) {
    md += `## ${EMOJI[m.classification] || "•"} [${m.classification}] ${m.title || m.trend_id} (relevance ${m.relevance})\n`;
    md += `- **왜 너에게**: ${m.why}\n`;
    if (m.grounding) md += `- **근거**: ${m.grounding}\n`;
    md += `- **다음 행동**: ${m.next_action}\n`;
    if (m.condition) md += `- **조건**: ${m.condition}\n`;
    if (m.url) md += `- 출처: ${m.url}\n`;
    md += `\n`;
  }
  fs.writeFileSync(path.join(outDir, "matches.md"), md, "utf8");

  console.log(`✅ 관련 ${matches.length}건 선별 (제외 ${trends.length - matches.length}건)`);
  for (const m of matches) console.log(`   ${EMOJI[m.classification] || "•"} [${m.relevance}] ${m.trend_id} ${m.title || ""}`);
  console.log(`   → ${path.join(outDir, "matches.json")}`);
  console.log(`   → ${path.join(outDir, "matches.md")}`);
})();
