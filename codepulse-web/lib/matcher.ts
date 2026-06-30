// matcher.ts — CodePulse 매칭·영향 엔진
// matcher.js(스파이크 CLI)의 핵심 로직을 함수로 이식. Gemini 구조화 출력.

import type { Trend, Match } from "./types";

const MIN_RELEVANCE = 40;

function buildPrompt(repoCtx: string, trends: Trend[]): string {
  const trendsBlock = trends.map((t) =>
    `- ${t.trend_id} [${t.source}/${t.type}] ${t.title}\n  url: ${t.url}\n  tags: ${[...(t.task_tags || []), ...(t.dependency_tags || []), ...(t.impact_tags || []), ...(t.keyword_tags || [])].join(", ") || "none"}\n  요약: ${t.summary}`
  ).join("\n");

  return `당신은 "CodePulse"의 매칭·영향 엔진입니다. 사용자의 코드베이스를 깊이 이해한 시니어 개발자로서, 오늘 수집된 AI 트렌드 중 "이 프로젝트에 실제로 의미 있는 것"만 골라 영향을 분석합니다.

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
}

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

export async function matchTrends(repoCtx: string, trends: Trend[], userKey?: string): Promise<Match[]> {
  // 우선순위: UI에서 넘긴 키 > 서버 .env.local
  const apiKey = (userKey && userKey.trim()) || process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    throw new Error("Gemini API 키가 없습니다. UI의 '🔑 API 키' 칸에 넣거나, codepulse-web/.env.local에 GEMINI_API_KEY를 설정하세요. (발급: https://aistudio.google.com/apikey)");
  }

  const prompt = buildPrompt(repoCtx, trends);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema },
  };

  // 무료 티어는 분당/일일 한도가 빡빡 → 429/503은 백오프 후 최대 2회 재시도
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let res!: Response;
  let text = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    text = await res.text();
    if (res.ok) break;
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      await sleep(2000 * (attempt + 1)); // 2s, 4s
      continue;
    }
    break;
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Gemini 무료 티어 사용량 한도에 걸렸습니다(분당/일일 요청 수). 1~2분 후 다시 시도하거나, 다른 API 키를 사용하세요. " + text.slice(0, 200));
    }
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 400)} (모델명이 틀렸다면 GEMINI_MODEL 환경변수로 바꾸세요)`);
  }
  const j = JSON.parse(text);
  const out = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Gemini 응답에 텍스트 없음: " + text.slice(0, 300));
  const cleaned = out.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const matches = JSON.parse(cleaned) as Match[];
  matches.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  return matches;
}
