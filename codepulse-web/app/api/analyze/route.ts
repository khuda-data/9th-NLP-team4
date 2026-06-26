import { NextRequest, NextResponse } from "next/server";
import { analyzeRepo } from "@/lib/pipeline";

// 클론 + Gemini 호출은 시간이 걸리므로 Node 런타임 + 긴 타임아웃
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let repoUrl: string;
  let apiKey: string | undefined;
  try {
    const body = await req.json();
    repoUrl = body?.repoUrl;
    apiKey = body?.apiKey;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  if (!repoUrl) {
    return NextResponse.json({ error: "repoUrl이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await analyzeRepo(repoUrl, apiKey);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "분석 실패";
    console.error("[/api/analyze] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
