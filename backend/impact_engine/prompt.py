import json

from models import GateResult, RepoContext, TrendItem


def build_impact_prompt(repo: RepoContext, trend: TrendItem, gate: GateResult) -> str:
    repo_json = repo.model_dump()
    trend_json = trend.model_dump(exclude_none=True)
    gate_json = gate.model_dump()

    output_schema = {
        "trend_id": trend.trend_id,
        "classification": "impact | replacement_candidate | new_application | exclude",
        "classification_label": "영향 | 대체후보 | 신규적용 | 제외",
        "relevance_score": "integer 0-100",
        "display_decision": "show | candidate | hide",
        "evidence": ["저장소의 구체적인 근거만 한국어로 작성"],
        "why_it_matters": "짧은 한국어 설명",
        "next_actions": ["제공된 저장소 맥락에 근거한 구체적인 다음 행동을 한국어로 작성"],
        "related_files": ["repo.file_tree에 실제로 있는 파일만 포함"],
    }

    return f"""
You are the Impact Engine for CodePulse, an AI trend radar for developers.

Use only the given Repo Context, Trend Item, and Rule Gate. The Trend Item uses
the final A-track Trend JSON schema and includes trend_id, source, title,
summary, url, type, and optional published_at, authors_or_org, task_tags,
dependency_tags, impact_tags, keyword_tags, raw_text, embedding_text, and
metadata. Missing optional fields may be omitted. Do not invent files,
dependencies, APIs, libraries, models, services, integrations, tools, or
architecture. Do not infer hidden architecture. Do not classify as show only
because keywords overlap.

Repo Context:
{json.dumps(repo_json, ensure_ascii=False, indent=2)}

Trend Item:
{json.dumps(trend_json, ensure_ascii=False, indent=2)}

Rule Gate:
{json.dumps(gate_json, ensure_ascii=False, indent=2)}

Classification decision (evaluate in order; choose the FIRST that matches):
1. impact (영향): The trend is specifically ABOUT a library, framework, model, or
   tool that appears in repo.dependencies OR that a Rule Gate "dependency" reason
   names. The repo ALREADY uses the exact thing the trend is about. If the trend
   does not concern something the repo actually depends on, it is NOT impact.
2. replacement_candidate (대체후보): The repo already does something in this area,
   and the trend is a concrete method/tool that could replace or measurably
   improve it (e.g. the repo does retrieval and the trend is a stronger reranker).
   The trend's specific tool is not yet a dependency.
3. new_application (신규적용): The repo does not currently do this, but the trend
   is a concrete, applicable technique/tool for the repo's stated goal.
4. exclude (제외): Only generic topic/keyword overlap, or no actionable meaning
   for THIS repo. When evidence is weak, choose exclude.

Most trends that merely share a topic (e.g. "agent", "RAG", "LLM") with the repo
but do not concern a dependency the repo actually uses are new_application or
exclude — they are NOT impact.

Scoring rubric — score how DIRECT and SPECIFIC the connection to THIS repo is,
and spread scores across the range. Do not default every card to the same number.
- 85-100: A Rule Gate "dependency" reason fired, i.e. the trend concerns a
  library/tool that is actually in repo.dependencies, AND there is a concrete next
  step. Reserve this band for direct hits on the repo's own stack.
- 70-84: Clearly relevant to what the repo does, with specific repo evidence, but
  the trend's exact tool/library is not a current dependency.
- 50-69: Related in topic, but the evidence is only tag/text/file-name overlap;
  usefulness is plausible, not certain.
- 0-49: Weak or generic overlap only; not worth showing (use exclude).
Judge each trend on its own evidence. Two trends should not receive the same
score unless their evidence for THIS repo is genuinely equivalent. Only a small
number of trends deserve 85+; if you are about to give most cards the same high
score, re-check the classification and lower the ones without a dependency match.

Output requirements:
- Return valid JSON only.
- Keep the API structure exactly as shown in the JSON output format.
- The field names and enum values must remain exactly as shown.
- Treat Trend Item metadata as optional supporting information only. Metadata
  may be missing or contain null values, and core impact judgment must not
  depend on metadata existing.
- Base the core judgment on repo context plus Trend Item title, summary, type,
  raw_text if present, embedding_text if present, task_tags, dependency_tags,
  impact_tags, and keyword_tags.
- All user-facing output fields must be written in Korean.
- evidence, why_it_matters, and next_actions are user-facing fields and must be
  written in Korean.
- When referencing English repo context, explain it naturally in Korean instead
  of copying the English sentence verbatim unless an exact quotation is needed.
- Evidence must reference concrete repo context from README, dependencies,
  file_tree, code_context, or meta_tags. Do not use generic claims as evidence.
- Return 2 to 3 next_actions for any card that is not excluded.
- Next actions must be specific, actionable, and grounded in the provided repo
  context. Do not suggest work that requires invented files, hidden services, or
  unprovided architecture.
- Do not recommend a specific library, package, API integration, framework,
  vector DB, embedding system, or external service unless it appears in
  repo.dependencies, in the Trend Item, or in the provided repo context.
- Do not add or recommend LangChain, Chroma, FAISS, embeddings, or vector DB
  unless they already appear in repo.dependencies or in the Trend Item.
- related_files must include only file paths that appear exactly in
  repo.file_tree. If no exact file exists, return an empty list.
- If concrete repo evidence is weak, use classification "exclude".

JSON output format:
{json.dumps(output_schema, ensure_ascii=False, indent=2)}
""".strip()
