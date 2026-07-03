"""LLM-judge 실행 CLI.

사용법:
  # 무비용 규칙기반(fake) — API 키 없이 동작 확인/CI
  python -m eval.llm_judge.run_judge --input eval/llm_judge/samples/sample_cards.json --fake

  # 실제 OpenAI judge (backend/.env의 OPENAI_API_KEY 사용, self-consistency 3회)
  python -m eval.llm_judge.run_judge --input eval/llm_judge/samples/sample_cards.json --samples 3

입력 JSON: [{ "id", "repo_context", "trend", "impact_card", "gold"?:{"verdict"} }, ...]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .agreement import compare
from .judge import judge_card

# Windows 콘솔(cp949)에서도 한글/기호가 깨지지 않게 UTF-8 강제
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass


def main() -> None:
    parser = argparse.ArgumentParser(description="CodePulse D-track LLM-judge")
    parser.add_argument("--input", required=True, help="샘플 JSON 경로")
    parser.add_argument("--output", default="", help="결과 JSON 저장 경로(선택)")
    parser.add_argument("--samples", type=int, default=1, help="self-consistency 반복 횟수(실모드)")
    parser.add_argument("--fake", action="store_true", help="규칙기반 무비용 judge 사용")
    args = parser.parse_args()

    samples = json.loads(Path(args.input).read_text(encoding="utf-8"))
    results = []
    for item in samples:
        verdict = judge_card(
            item["repo_context"], item["trend"], item["impact_card"],
            n_samples=args.samples, fake=args.fake,
        )
        row = {
            "id": item.get("id"),
            "trend_id": item["trend"].get("trend_id") or item["trend"].get("id"),
            "judge": {k: v for k, v in verdict.items() if k != "raw"},
        }
        if item.get("gold"):
            row["gold"] = item["gold"]
        results.append(row)

    # 요약
    n = len(results)
    verdict_counts: dict[str, int] = {}
    hallucination_flags = 0
    for r in results:
        v = r["judge"]["overall_verdict"]
        verdict_counts[v] = verdict_counts.get(v, 0) + 1
        if r["judge"]["hallucinated_evidence"]:
            hallucination_flags += 1

    validation = compare(results)

    print("\n=== LLM-judge 결과 ===")
    print(f"엔진: {results[0]['judge']['engine'] if results else '-'}  |  샘플 {n}건")
    print(f"판정 분포: {verdict_counts}")
    print(f"환각 근거 검출된 카드: {hallucination_flags}건")
    print("\n--- 카드별 ---")
    for r in results:
        j = r["judge"]
        halluc = f"  [!]환각:{j['hallucinated_evidence']}" if j["hallucinated_evidence"] else ""
        print(
            f"[{r['id']}] {j['overall_verdict']}(score {j['overall_score']}, conf {j['confidence']}) "
            f"rel={j['relevance']} ground={j['groundedness']} act={j['actionability']} "
            f"cls={j['classification_verdict']}{halluc}"
        )
    print("\n--- judge 검증 (vs 사람 gold) ---")
    print(json.dumps(validation, ensure_ascii=False, indent=2))

    if args.output:
        Path(args.output).write_text(
            json.dumps({"results": results, "validation": validation}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\n저장: {args.output}")


if __name__ == "__main__":
    sys.exit(main())
