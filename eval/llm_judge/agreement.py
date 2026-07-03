"""judge ↔ 사람(gold) 라벨 대조 — judge 자체를 신뢰해도 되는지 검증.

judge를 대량에 쓰기 전에, 사람이 매긴 소량 gold와 얼마나 일치하는지부터 재야 한다.
(판단 신뢰도 기법 ⑦: judge의 신뢰도를 사람 라벨로 보증)

gold 라벨 형식(각 샘플에 optional):
  "gold": { "verdict": "good"|"borderline"|"bad" }
"""

from __future__ import annotations

from typing import Any


def compare(results: list[dict[str, Any]]) -> dict[str, Any]:
    """results = run_judge가 만든 항목들. 각 항목에 gold가 있으면 일치율 계산."""
    labeled = [r for r in results if r.get("gold")]
    if not labeled:
        return {"labeled": 0, "note": "gold 라벨이 없어 judge 검증 생략. samples에 gold를 넣으면 일치율이 나옵니다."}

    exact = 0
    # good/bad를 1/0으로 본 이진 일치도(borderline은 별도)
    binary_hits = 0
    binary_total = 0
    confusion: dict[str, dict[str, int]] = {}

    for r in labeled:
        gold = r["gold"]["verdict"]
        pred = r["judge"]["overall_verdict"]
        if gold == pred:
            exact += 1
        confusion.setdefault(gold, {}).setdefault(pred, 0)
        confusion[gold][pred] += 1
        if gold in {"good", "bad"} and pred in {"good", "bad"}:
            binary_total += 1
            if gold == pred:
                binary_hits += 1

    n = len(labeled)
    return {
        "labeled": n,
        "exact_agreement": round(exact / n, 2),
        "binary_agreement(good/bad)": round(binary_hits / binary_total, 2) if binary_total else None,
        "confusion(gold→pred)": confusion,
        "verdict": (
            "judge 신뢰 가능(≥0.8)" if exact / n >= 0.8
            else "judge 보정 필요(<0.8): rubric/모델 조정 후 재검증"
        ),
    }
