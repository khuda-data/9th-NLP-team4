from __future__ import annotations

from pathlib import Path

from .collectors import collect_all
from .dedup import deduplicate
from .models import PipelineState
from .normalizer import normalize_raw
from .quality import quality_report
from .schema import is_valid_trend
from .storage import write_chroma_or_jsonl, write_json


def collector_node(state: PipelineState, limit_per_source: int = 20) -> PipelineState:
    if not state.raw_trends:
        state.raw_trends = collect_all(limit_per_source)
    return state


def normalizer_node(state: PipelineState) -> PipelineState:
    normalized = []
    for raw in state.raw_trends:
        if raw.get("source") == "error":
            state.errors.append(f"{raw.get('title')}: {raw.get('error')}")
            continue
        try:
            trend = normalize_raw(raw)
            if is_valid_trend(trend):
                normalized.append(trend)
            else:
                state.errors.append(f"invalid trend after normalize: {trend.get('trend_id')}")
        except Exception as exc:
            state.errors.append(f"normalize failed: {exc}")
    state.normalized_trends = normalized
    return state


def weak_labeling_node(state: PipelineState) -> PipelineState:
    # Labels are assigned during normalization. This node remains explicit so it
    # can later branch to LLM-only repair for low-confidence items if the team agrees.
    state.labeled_trends = state.normalized_trends
    return state


def semantic_dedup_node(state: PipelineState, threshold: float = 0.85) -> PipelineState:
    state.deduped_trends, state.duplicate_groups = deduplicate(state.labeled_trends, threshold)
    return state


def ingestion_node(state: PipelineState, output_dir: str | Path = "data_pipeline/output") -> PipelineState:
    out = Path(output_dir)
    state.ingested_count = write_chroma_or_jsonl(out / "chroma", state.deduped_trends)
    write_json(out / "trends.json", state.deduped_trends)
    return state


def quality_check_node(state: PipelineState) -> PipelineState:
    state.quality_report = quality_report(state)
    return state


def should_repair(state: PipelineState) -> str:
    report = state.quality_report
    if report.get("missing_required_fields", 0):
        return "repair"
    if report.get("empty_task_tag_ratio", 0) > 0.3:
        return "repair"
    return "done"


def repair_node(state: PipelineState) -> PipelineState:
    # No LLM repair in MVP. Keep deterministic: drop invalid items and keep report trace.
    before = len(state.deduped_trends)
    state.deduped_trends = [t for t in state.deduped_trends if is_valid_trend(t)]
    dropped = before - len(state.deduped_trends)
    if dropped:
        state.errors.append(f"deterministic repair applied: dropped {dropped} invalid trends")
    return quality_check_node(state)


def run_sequential(
    raw_trends: list[dict] | None = None,
    output_dir: str | Path = "data_pipeline/output",
    limit_per_source: int = 20,
) -> PipelineState:
    state = PipelineState(raw_trends=raw_trends or [])
    state = collector_node(state, limit_per_source)
    state = normalizer_node(state)
    state = weak_labeling_node(state)
    state = semantic_dedup_node(state)
    state = ingestion_node(state, output_dir)
    state = quality_check_node(state)
    if should_repair(state) == "repair":
        state = repair_node(state)
    return state


def build_langgraph():
    """Build a LangGraph workflow when langgraph is installed.

    The project does not require LangGraph for tests or local MVP execution.
    Install it later and this function can be used by the backend scheduler.
    """
    try:
        from langgraph.graph import END, StateGraph  # type: ignore
    except Exception as exc:
        raise RuntimeError("langgraph is not installed; use run_sequential() for the no-dependency MVP") from exc

    graph = StateGraph(PipelineState)
    graph.add_node("collector", collector_node)
    graph.add_node("normalizer", normalizer_node)
    graph.add_node("weak_labeling", weak_labeling_node)
    graph.add_node("semantic_dedup", semantic_dedup_node)
    graph.add_node("ingestion", ingestion_node)
    graph.add_node("quality_check", quality_check_node)
    graph.add_node("repair", repair_node)
    graph.set_entry_point("collector")
    graph.add_edge("collector", "normalizer")
    graph.add_edge("normalizer", "weak_labeling")
    graph.add_edge("weak_labeling", "semantic_dedup")
    graph.add_edge("semantic_dedup", "ingestion")
    graph.add_edge("ingestion", "quality_check")
    graph.add_conditional_edges("quality_check", should_repair, {"repair": "repair", "done": END})
    graph.add_edge("repair", END)
    return graph.compile()
