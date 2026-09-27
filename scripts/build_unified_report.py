# -*- coding: utf-8 -*-
"""Build ONE Tracked E2E markdown deliverable: exec summary + full inlined annexes.

Canonical output: TRACKED_E2E_REPORT.md only (no UNIFIED twin; annexes folded in).
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

PLAN = Path(r"C:\Users\brian\grok-build-queue\plans\ai-book-tools-2026-09-27\novelwriter")
RUNNER = Path(r"C:\Users\brian\OneDrive\Documents\GitHubRepos\AI-Book-Tools\scripts\run-tracked-e2e.mjs")
OUT = PLAN / "TRACKED_E2E_REPORT.md"
REPORT_JSON = PLAN / "TRACKED_E2E_REPORT.json"
ANNEX_JSON = PLAN / "TRACKED_E2E_ANNEX_NOVELDATA.json"

# Official docs.x.ai (fetched 2026-09-27): grok-4-1-fast-non-reasoning retired / redirects to grok-4.3
# grok-4.3 (<200k prompt): input $1.25 / 1M, output $2.50 / 1M, cached input $0.20 / 1M
RATE_CARD = {
    "model_requested": "grok-4-1-fast-non-reasoning",
    "billing_model": "grok-4.3",
    "note": "Requested slug is retired on xAI and redirects to grok-4.3; costs use official grok-4.3 list rates (<200k prompt band).",
    "source": "https://docs.x.ai/docs/models",
    "as_of": "2026-09-27",
    "input_per_1m_usd": 1.25,
    "output_per_1m_usd": 2.50,
    "cached_input_per_1m_usd": 0.20,
}


def money(x: float) -> str:
    if x >= 1:
        return f"${x:,.2f}"
    if x >= 0.01:
        return f"${x:,.4f}"
    return f"${x:,.6f}"


def trunc(s: str, n: int) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def char_blurb(c: dict) -> str:
    name = c.get("name") or "Unnamed"
    back = trunc(c.get("backstory") or "", 220)
    arc = trunc(c.get("arc") or "", 180)
    parts = [f"**{name}**"]
    if back:
        parts.append(back)
    if arc:
        parts.append(f"_Arc:_ {arc}")
    return " — ".join(parts) if len(parts) > 1 else parts[0]


def synopsis_from(nd: dict) -> str:
    arc = (nd.get("storyArc") or "").strip()
    setting = (nd.get("setting") or "").strip()
    plot = (nd.get("generalPlot") or nd.get("plotOutline") or "").strip()
    if isinstance(plot, (dict, list)):
        plot = json.dumps(plot)
    bits = []
    if setting:
        bits.append("**Setting.** " + trunc(setting, 420))
    if plot:
        bits.append("**Plot.** " + trunc(str(plot), 700))
    if arc:
        bits.append("**Arc.** " + trunc(arc, 900))
    if not bits:
        return "(No synopsis fields populated in novelData.)"
    return "\n\n".join(bits)


def compute_cost(prompt: int, completion: int, cached: int = 0) -> dict:
    # If cached tokens are known, bill those at cached rate and remainder of prompt at input rate.
    # Conservative: if cached unknown, bill all prompt at input rate.
    cached = max(0, min(cached or 0, prompt))
    uncached = max(0, prompt - cached)
    input_cost = (uncached / 1_000_000.0) * RATE_CARD["input_per_1m_usd"]
    cached_cost = (cached / 1_000_000.0) * RATE_CARD["cached_input_per_1m_usd"]
    output_cost = (completion / 1_000_000.0) * RATE_CARD["output_per_1m_usd"]
    total = input_cost + cached_cost + output_cost
    total_tokens = prompt + completion
    blended = (total / total_tokens) if total_tokens else 0.0
    return {
        "input_cost_usd": input_cost,
        "cached_cost_usd": cached_cost,
        "output_cost_usd": output_cost,
        "total_cost_usd": total,
        "blended_per_token_usd": blended,
        "input_per_token_usd": RATE_CARD["input_per_1m_usd"] / 1_000_000.0,
        "output_per_token_usd": RATE_CARD["output_per_1m_usd"] / 1_000_000.0,
        "cached_tokens_billed": cached,
        "uncached_prompt_tokens": uncached,
    }


def build_report(report: dict, nd: dict) -> str:
    cfg = report.get("config") or {}
    summary = report.get("summary") or {}
    totals = summary.get("totals") or {}
    prompt = int(totals.get("prompt_tokens") or 0)
    completion = int(totals.get("completion_tokens") or 0)
    total_tok = int(totals.get("total_tokens") or (prompt + completion))
    calls = int(summary.get("callCount") or len((report.get("bookTokenUsage") or {}).get("calls") or []))
    cached = 0
    btu = report.get("bookTokenUsage") or {}
    details = btu.get("prompt_tokens_details") or {}
    if isinstance(details, dict):
        cached = int(details.get("cached_tokens") or 0)

    cost = compute_cost(prompt, completion, cached)
    chars = [c for c in (nd.get("characters") or []) if isinstance(c, dict)]
    tokens_by_prompt = report.get("tokensByPrompt") or []
    tokens_by_stage = report.get("tokensByStage") or []
    quality = report.get("qualitySamples") or []

    lines: list[str] = []
    lines.append("# NovelWriter Tracked E2E — Complete Report (single file)")
    lines.append("")
    lines.append(f"- **Result:** {'PASS' if report.get('ok') else 'FAIL / partial'}")
    lines.append(f"- **Finished:** {report.get('finishedAt') or ''}")
    lines.append(f"- **Model requested:** `{cfg.get('model') or RATE_CARD['model_requested']}`")
    lines.append(f"- **Lean config:** {cfg.get('numChapters')} chapters · {cfg.get('chapterLength')} words · {cfg.get('numCharacters')} characters · {cfg.get('minSubplots')} subplots · genre `{cfg.get('genre')}`")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 1. Executive summary")
    lines.append("")
    lines.append("### Book")
    lines.append("")
    lines.append(f"- **Title:** {nd.get('title') or '(untitled)'}")
    lines.append(f"- **Genre:** {nd.get('genre') or cfg.get('genre') or ''}")
    lines.append(f"- **Characters:** **{len(chars)}**")
    ch_lens = [len(c or '') for c in (nd.get('chapters') or [])]
    if ch_lens:
        lines.append(f"- **Chapters generated:** {len(ch_lens)} (char lengths: {', '.join(str(x) for x in ch_lens)})")
    lines.append("")
    lines.append("### Synopsis")
    lines.append("")
    lines.append(synopsis_from(nd))
    lines.append("")
    lines.append("### Cast (high level)")
    lines.append("")
    if not chars:
        lines.append("(No characters in novelData.)")
    else:
        for c in chars:
            lines.append(f"- {char_blurb(c)}")
    lines.append("")
    lines.append("### Tokens & cost (cost/efficiency — not quality)")
    lines.append("")
    lines.append(f"- **Calls:** {calls}")
    lines.append(f"- **Tokens:** prompt **{prompt:,}** · completion **{completion:,}** · total **{total_tok:,}**")
    if cached:
        lines.append(f"- **Cached input tokens (API details):** {cached:,} (billed at cached rate; remainder of prompt at input rate)")
    lines.append(f"- **Rate card:** `{RATE_CARD['billing_model']}` — input {money(RATE_CARD['input_per_1m_usd'])}/1M · output {money(RATE_CARD['output_per_1m_usd'])}/1M · cached input {money(RATE_CARD['cached_input_per_1m_usd'])}/1M")
    lines.append(f"- **Cost per token:** input {money(cost['input_per_token_usd'])}/tok · output {money(cost['output_per_token_usd'])}/tok · blended {money(cost['blended_per_token_usd'])}/tok")
    lines.append(f"- **Cost breakdown:** input {money(cost['input_cost_usd'])} · cached {money(cost['cached_cost_usd'])} · output {money(cost['output_cost_usd'])}")
    lines.append(f"- **Total cost of effort:** **{money(cost['total_cost_usd'])}**")
    lines.append(f"- **Pricing note:** {RATE_CARD['note']} Source: {RATE_CARD['source']} (as of {RATE_CARD['as_of']}).")
    lines.append("")
    # --- quality / auto-edit for exec summary ---
    gate = nd.get("lastQualityGate") or {}
    findings = nd.get("qualityFindings") or []
    book_imps = nd.get("bookImprovementsWithStatus") or nd.get("bookImprovements") or []
    ch_imps = [x for x in (nd.get("chapterImprovements") or []) if x]
    continuity = nd.get("continuityFindings") or []

    def _score_line(s):
        return (
            f"interest={s.get('interest')} readability={s.get('readability')} "
            f"aiSlopRisk={s.get('aiSlopRisk')} humanLikeness={s.get('humanLikeness')}"
        )

    # before/after automated chapter edit (heuristics)
    q_by = {s.get("label"): s for s in quality if isinstance(s, dict)}
    ch1_gen = q_by.get("chapter1-generate") or q_by.get("chapter1-heuristics")
    ch1_after = q_by.get("chapter1-afterUpdate")
    ch2_gen = q_by.get("chapter2-generate") or q_by.get("chapter2-heuristics")

    lines.append("### Quality & automated editing (separate from cost)")
    lines.append("")
    if gate:
        passed = gate.get("passed")
        thr = gate.get("thresholds") or {}
        lines.append(
            f"- **Last quality gate:** `{'PASS' if passed else 'FAIL'}` on `{gate.get('label')}` "
            f"(thresholds: interest≥{thr.get('minInterest')}, human≥{thr.get('minHumanLikeness')}, "
            f"slop≤{thr.get('maxAiSlopRisk')})"
        )
        sc = gate.get("scores") or {}
        if sc:
            lines.append(f"- **Gate scores:** {_score_line(sc)}")
        fails = gate.get("failures") or []
        if fails:
            lines.append(f"- **Gate failures:** {', '.join(str(f) for f in fails)}")
    lines.append(f"- **Gate findings logged:** {len(findings)}")
    if ch1_gen:
        lines.append(f"- **Ch1 at generate (heur):** {_score_line(ch1_gen)}")
    if ch1_after:
        lines.append(f"- **Ch1 after automated edit (`updateChapter`):** {_score_line(ch1_after)}")
        if ch1_gen:
            deltas = []
            for k in ("interest", "readability", "aiSlopRisk", "humanLikeness"):
                a, b = ch1_gen.get(k), ch1_after.get(k)
                if a is not None and b is not None:
                    d = b - a
                    sign = "+" if d > 0 else ""
                    deltas.append(f"{k} {sign}{d}")
            lines.append(f"- **Automated edit delta (Ch1):** {', '.join(deltas)}")
    if ch2_gen:
        lines.append(f"- **Ch2 at generate (heur):** {_score_line(ch2_gen)}")
    llm = q_by.get("chapter1-llmJudge")
    if llm:
        lines.append(f"- **Ch1 LLM judge:** {_score_line(llm)} (informational; gate uses heuristics)")
    n_book = len(book_imps) if isinstance(book_imps, list) else 0
    lines.append(f"- **Automated book critique items:** {n_book}")
    lines.append(f"- **Continuity findings:** {len(continuity)}")
    mp = nd.get("qualityMultiPassLog") or []
    if mp:
        kinds = " → ".join(f'pass{e.get("pass")}:{e.get("kind")}' for e in mp if isinstance(e, dict))
        lines.append(f"- **Multi-pass quality (QE5):** {kinds}")
    else:
        lines.append("- **Multi-pass quality (QE5):** none this run (cap maxAutoPasses=2; continuity/second pass when needed)")
    lines.append(
        "- **Remaining next:** per-prompt cost in-product (Tab1); series RAG/KG still future docs only."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 2. Run outcome")
    lines.append("")
    failed = summary.get("failedSteps") or []
    lines.append(f"- OK: `{report.get('ok')}`")
    lines.append(f"- Failed steps: {', '.join(failed) if failed else 'none'}")
    lines.append(f"- Started: {report.get('startedAt')}")
    lines.append(f"- Finished: {report.get('finishedAt')}")
    steps = report.get("steps") or []
    if steps:
        lines.append("")
        lines.append("| Step | OK |")
        lines.append("| --- | --- |")
        for s in steps:
            lines.append(f"| {s.get('name')} | {'pass' if s.get('ok') else 'FAIL'} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 3. Tokens by prompt (each LLM call)")
    lines.append("")
    lines.append("| # | Stage (tab) | Operation / prompt | Prompt | Completion | Total | Est. cost |")
    lines.append("| --- | --- | --- | ---: | ---: | ---: | ---: |")
    for c in tokens_by_prompt:
        pc = compute_cost(int(c.get("prompt_tokens") or 0), int(c.get("completion_tokens") or 0), 0)
        lines.append(
            f"| {c.get('i')} | {c.get('originTab')} | {c.get('operationName')} | "
            f"{c.get('prompt_tokens')} | {c.get('completion_tokens')} | {c.get('total_tokens')} | "
            f"{money(pc['total_cost_usd'])} |"
        )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 4. Tokens by stage (rollup)")
    lines.append("")
    lines.append("| Stage | Calls | Prompt | Completion | Total | Est. cost |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for s in tokens_by_stage:
        pc = compute_cost(int(s.get("prompt_tokens") or 0), int(s.get("completion_tokens") or 0), 0)
        lines.append(
            f"| {s.get('stage')} | {s.get('count')} | {s.get('prompt_tokens')} | "
            f"{s.get('completion_tokens')} | {s.get('total_tokens')} | {money(pc['total_cost_usd'])} |"
        )
    lines.append("")
    lines.append(f"**Book rollup:** {prompt:,} / {completion:,} / {total_tok:,} · **{money(cost['total_cost_usd'])}**")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 5. Quality gate, scores & automated editing")
    lines.append("")
    lines.append("Prose quality and automated edit/critique are separate from token cost.")
    lines.append("")
    lines.append("### 5.1 Quality gate")
    lines.append("")
    gate = nd.get("lastQualityGate") or {}
    if gate:
        thr = gate.get("thresholds") or {}
        lines.append(f"- Label: `{gate.get('label')}`")
        lines.append(f"- Passed: **{'yes' if gate.get('passed') else 'NO'}**")
        lines.append(
            f"- Thresholds: interest≥{thr.get('minInterest')}, humanLikeness≥{thr.get('minHumanLikeness')}, "
            f"aiSlopRisk≤{thr.get('maxAiSlopRisk')}, minChars={thr.get('minChars')}"
        )
        sc = gate.get("scores") or {}
        if sc:
            lines.append(
                f"- Scores: interest={sc.get('interest')} readability={sc.get('readability')} "
                f"aiSlopRisk={sc.get('aiSlopRisk')} humanLikeness={sc.get('humanLikeness')}"
            )
            notes = sc.get("notes") or []
            if notes:
                lines.append(f"- Notes: {', '.join(str(n) for n in notes)}")
        fails = gate.get("failures") or []
        lines.append(f"- Failures: {', '.join(str(f) for f in fails) if fails else 'none'}")
    else:
        lines.append("(No lastQualityGate on novelData.)")
    findings = nd.get("qualityFindings") or []
    if findings:
        lines.append("")
        lines.append("#### Gate findings (per chapter gen)")
        lines.append("")
        for f in findings:
            lines.append(
                f"- `{f.get('label')}`: passed={f.get('passed')} · "
                f"interest={f.get('interest')} readability={f.get('readability')} "
                f"aiSlopRisk={f.get('aiSlopRisk')} humanLikeness={f.get('humanLikeness')}"
                + (f" · failures={f.get('failures')}" if f.get("failures") else "")
            )
    lines.append("")
    lines.append("### 5.2 Quality samples (all)")
    lines.append("")
    for s in quality:
        lines.append(
            f"- **{s.get('label')}**: interest={s.get('interest')} readability={s.get('readability')} "
            f"aiSlopRisk={s.get('aiSlopRisk')} humanLikeness={s.get('humanLikeness')} "
            f"({s.get('source')})"
            + (f" — {s.get('rationale')}" if s.get("rationale") else "")
        )
        notes = s.get("notes") or []
        if notes:
            lines.append(f"  - notes: {', '.join(str(n) for n in notes)}")
    lines.append("")
    lines.append("### 5.3 Automated quality editing (this run)")
    lines.append("")
    lines.append(
        "Lean Tracked E2E exercised automated edit via Tab6 `updateChapter` "
        "(tighten opening / sensory detail) and Tab7 `suggestBookImprovements` (critique list)."
    )
    lines.append("")
    q_by = {s.get("label"): s for s in quality if isinstance(s, dict)}
    ch1_gen = q_by.get("chapter1-generate") or q_by.get("chapter1-heuristics")
    ch1_after = q_by.get("chapter1-afterUpdate")
    if ch1_gen or ch1_after:
        lines.append("| Stage | Interest | Readability | AI slop risk | Human likeness |")
        lines.append("| --- | ---: | ---: | ---: | ---: |")
        if ch1_gen:
            lines.append(
                f"| Ch1 generate | {ch1_gen.get('interest')} | {ch1_gen.get('readability')} | "
                f"{ch1_gen.get('aiSlopRisk')} | {ch1_gen.get('humanLikeness')} |"
            )
        if ch1_after:
            lines.append(
                f"| Ch1 after `updateChapter` | {ch1_after.get('interest')} | {ch1_after.get('readability')} | "
                f"{ch1_after.get('aiSlopRisk')} | {ch1_after.get('humanLikeness')} |"
            )
        lines.append("")
    # chapter length delta
    chapters = nd.get("chapters") or []
    edited = nd.get("editedChapters") or []
    if chapters and edited and edited[0]:
        lines.append(
            f"- Ch1 length: generate snapshot in samples textLen="
            f"{(ch1_gen or {}).get('textLen', '?')} → after edit stored chapter len={len(chapters[0] or '')} "
            f"(editedChapters[0] len={len(edited[0] or '')})."
        )
        lines.append("")
    book_imps = nd.get("bookImprovementsWithStatus") or []
    if not book_imps:
        raw = nd.get("bookImprovements") or []
        book_imps = [{"text": x} if isinstance(x, str) else x for x in raw]
    lines.append(f"#### Book critique / improvement suggestions ({len(book_imps)})")
    lines.append("")
    if not book_imps:
        lines.append("(None returned.)")
    else:
        for i, item in enumerate(book_imps, 1):
            if isinstance(item, dict):
                text = item.get("text") or item.get("improvement") or item.get("suggestion") or json.dumps(item)
                status = item.get("status") or item.get("state") or ""
            else:
                text, status = str(item), ""
            text = trunc(str(text), 420)
            suffix = f" _(status: {status})_" if status else ""
            lines.append(f"{i}. {text}{suffix}")
        lines.append("")
    ch_imps = [x for x in (nd.get("chapterImprovements") or []) if x]
    if ch_imps:
        lines.append(f"#### Chapter-level improvement notes ({len(ch_imps)})")
        lines.append("")
        for i, item in enumerate(ch_imps, 1):
            lines.append(f"{i}. {trunc(str(item), 400)}")
        lines.append("")
    continuity = nd.get("continuityFindings") or []
    lines.append(f"#### Continuity audit findings ({len(continuity)})")
    lines.append("")
    if not continuity:
        lines.append("(None.)")
    else:
        for i, item in enumerate(continuity, 1):
            lines.append(f"{i}. {trunc(str(item), 350)}")
        lines.append("")
    mp_log = nd.get("qualityMultiPassLog") or []
    lines.append("### 5.4 Multi-pass quality editing (QE5)")
    lines.append("")
    lines.append(
        "Shipped: after first gate-fail revise or apply-staged, a **second targeted pass** may run "
        "(continuity findings / still-failing heuristics gate / residual staged notes). "
        f"Cap `maxAutoPasses={2}`; fail-closed remains heuristics; `reviseOnJudgeAdvisory` stays false."
    )
    lines.append("")
    if not mp_log:
        lines.append("(No `qualityMultiPassLog` entries this run.)")
    else:
        lines.append("| Pass | Kind | Chapter | Passed after |")
        lines.append("| ---: | --- | ---: | --- |")
        for e in mp_log:
            if not isinstance(e, dict):
                continue
            lines.append(
                f"| {e.get('pass')} | {e.get('kind')} | {e.get('chapter')} | "
                f"{'yes' if e.get('passedAfter') else 'no'} |"
            )
        lines.append("")
    lines.append("### 5.5 Next iteration (remaining)")
    lines.append("")
    lines.append(
        "QE1–QE5 shipped. Remaining product backlog: **per-prompt cost in-product** (Tab1 diagnostics). "
        "Series RAG/KG remains future docs only. Watchout: cast count in reports may show Unnamed vs rich fixture "
        "cast densification — track separately."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 6. Story annexes (full prose — inlined)")
    lines.append("")
    lines.append(
        "This section is the readable book deliverable. Full chapter text, cast, "
        "subplots, outlines, and world digests are inlined below. "
        "Optional machine sidecar: `TRACKED_E2E_ANNEX_NOVELDATA.json` (not required to read the book)."
    )
    lines.append("")

    # --- Annex A: World / digests ---
    lines.append("### Annex A — World & digests")
    lines.append("")
    if nd.get("setting"):
        lines.append("#### Setting")
        lines.append("")
        lines.append(str(nd["setting"]).strip())
        lines.append("")
    plot = nd.get("generalPlot") or nd.get("plotOutline") or ""
    if isinstance(plot, (dict, list)):
        plot = json.dumps(plot, indent=2)
    if str(plot).strip():
        lines.append("#### Plot")
        lines.append("")
        lines.append(str(plot).strip())
        lines.append("")
    if nd.get("storyArc"):
        lines.append("#### Story arc")
        lines.append("")
        lines.append(str(nd["storyArc"]).strip())
        lines.append("")
    if nd.get("novelOutline"):
        no = nd["novelOutline"]
        if isinstance(no, (dict, list)):
            no = json.dumps(no, indent=2)
        lines.append("#### Novel outline")
        lines.append("")
        lines.append(str(no).strip())
        lines.append("")
    if nd.get("styleGuide"):
        lines.append("#### Style guide")
        lines.append("")
        lines.append(str(nd["styleGuide"]).strip())
        lines.append("")
    if not any(
        [
            nd.get("setting"),
            str(plot).strip() if plot else "",
            nd.get("storyArc"),
            nd.get("novelOutline"),
            nd.get("styleGuide"),
        ]
    ):
        lines.append("(No world/digest fields populated.)")
        lines.append("")

    # --- Annex B: Cast (full) ---
    lines.append("### Annex B — Cast (full)")
    lines.append("")
    if not chars:
        lines.append("(No characters in novelData.)")
        lines.append("")
    else:
        for c in chars:
            lines.append(f"#### {c.get('name') or 'Unnamed'}")
            lines.append("")
            role = c.get("role") or c.get("Role") or ""
            if role:
                lines.append(f"- **Role:** {role}")
            for key, label in (
                ("backstory", "Backstory"),
                ("arc", "Arc"),
                ("personality", "Personality"),
                ("appearance", "Appearance"),
                ("goals", "Goals"),
                ("conflicts", "Conflicts"),
                ("notes", "Notes"),
            ):
                val = c.get(key)
                if val:
                    if isinstance(val, (dict, list)):
                        val = json.dumps(val, indent=2)
                    lines.append(f"- **{label}:**")
                    lines.append("")
                    lines.append(str(val).strip())
                    lines.append("")
            # dump remaining scalar fields briefly
            skip = {
                "name",
                "Name",
                "role",
                "Role",
                "backstory",
                "arc",
                "personality",
                "appearance",
                "goals",
                "conflicts",
                "notes",
            }
            extras = []
            for k, v in c.items():
                if k in skip or v in (None, "", [], {}):
                    continue
                if isinstance(v, (dict, list)):
                    continue
                extras.append(f"{k}={v}")
            if extras:
                lines.append(f"- _Other:_ {', '.join(extras)}")
                lines.append("")

    # --- Annex C: Subplots ---
    lines.append("### Annex C — Subplots")
    lines.append("")
    subs = nd.get("subplots") or []
    if not subs:
        lines.append("(None.)")
        lines.append("")
    else:
        for i, sp in enumerate(subs, 1):
            if isinstance(sp, dict):
                title = sp.get("title") or sp.get("name") or f"Subplot {i}"
                body = sp.get("description") or sp.get("text") or sp.get("summary") or json.dumps(sp, indent=2)
                lines.append(f"#### {i}. {title}")
                lines.append("")
                lines.append(str(body).strip())
                lines.append("")
            else:
                lines.append(f"{i}. {str(sp).strip()}")
                lines.append("")

    # --- Annex D: Chapter outlines ---
    lines.append("### Annex D — Chapter outlines")
    lines.append("")
    outlines = nd.get("chapterOutlines") or []
    if not outlines:
        lines.append("(None.)")
        lines.append("")
    else:
        for i, o in enumerate(outlines):
            o = o or ""
            if not str(o).strip():
                continue
            lines.append(f"#### Chapter {i + 1} outline ({len(str(o))} chars)")
            lines.append("")
            if isinstance(o, (dict, list)):
                lines.append(json.dumps(o, indent=2))
            else:
                lines.append(str(o).strip())
            lines.append("")

    # --- Annex E: Full chapter prose (THE BOOK) ---
    lines.append("### Annex E — Full chapter prose")
    lines.append("")
    lines.append(
        "Complete chapter text as stored in novelData after the run "
        "(including Tab6 automated edit on Ch1 when present). Not truncated."
    )
    lines.append("")
    chapters = nd.get("chapters") or []
    nonempty = [(i, body or "") for i, body in enumerate(chapters) if (body or "").strip()]
    if not nonempty:
        lines.append("(No chapter prose in novelData.)")
        lines.append("")
    else:
        for i, body in nonempty:
            lines.append(f"#### Chapter {i + 1} — full text ({len(body)} chars)")
            lines.append("")
            lines.append(body.strip())
            lines.append("")
            lines.append(f"_End Chapter {i + 1}_")
            lines.append("")

    # edited chapters note if different
    edited = nd.get("editedChapters") or []
    if edited and any((e or "").strip() for e in edited):
        lines.append("##### Edited-chapter lengths (reference)")
        lines.append("")
        for i, e in enumerate(edited):
            if (e or "").strip():
                lines.append(f"- editedChapters[{i}]: {len(e)} chars")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 7. Artifacts")
    lines.append("")
    lines.append(
        "- **`TRACKED_E2E_REPORT.md`** — **this document** (canonical human deliverable: summary + full annexes)"
    )
    lines.append("- `TRACKED_E2E_REPORT.json` — machine-readable steps, tokensByPrompt, tokensByStage, cost meta")
    lines.append(
        "- `TRACKED_E2E_ANNEX_NOVELDATA.json` — optional machine sidecar (full novelData); prose above is already complete"
    )
    lines.append("- `TRACKED_E2E_PROGRESS.md` — live tab stream (run log, not the book)")
    lines.append("- `TRACKED_E2E_TOKENS_BY_STAGE.md` — optional tokens-only companion")
    lines.append("")
    lines.append(
        "_Deprecated / no longer emitted as a second main report: `TRACKED_E2E_UNIFIED_REPORT.md`, "
        "`TRACKED_E2E_ANNEXES.md` (content folded into this file)._"
    )
    lines.append("")
    lines.append(f"_Generated {datetime.now().astimezone().isoformat()}_")
    lines.append("")

    return "\n".join(lines)



def main() -> None:
    report = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
    nd = json.loads(ANNEX_JSON.read_text(encoding="utf-8"))
    # ensure token arrays exist
    if not report.get("tokensByPrompt"):
        calls = (report.get("bookTokenUsage") or {}).get("calls") or []
        report["tokensByPrompt"] = [
            {
                "i": i + 1,
                "operationName": c.get("operationName") or "",
                "originTab": c.get("originTab") or "",
                "model": c.get("model") or "",
                "prompt_tokens": c.get("prompt_tokens") or 0,
                "completion_tokens": c.get("completion_tokens") or 0,
                "total_tokens": c.get("total_tokens") or 0,
                "contextPackChars": c.get("contextPackChars"),
                "ts": c.get("ts"),
            }
            for i, c in enumerate(calls)
        ]
    if not report.get("tokensByStage"):
        by = {}
        for c in (report.get("bookTokenUsage") or {}).get("calls") or []:
            stage = f"{c.get('originTab') or 'unknown'} / {c.get('operationName') or 'unnamed'}"
            if stage not in by:
                by[stage] = {
                    "stage": stage,
                    "originTab": c.get("originTab") or "",
                    "operationName": c.get("operationName") or "",
                    "count": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                }
            by[stage]["count"] += 1
            by[stage]["prompt_tokens"] += c.get("prompt_tokens") or 0
            by[stage]["completion_tokens"] += c.get("completion_tokens") or 0
            by[stage]["total_tokens"] += c.get("total_tokens") or 0
        report["tokensByStage"] = list(by.values())

    totals = (report.get("summary") or {}).get("totals") or {}
    prompt = int(totals.get("prompt_tokens") or 0)
    completion = int(totals.get("completion_tokens") or 0)
    cached = int(((report.get("bookTokenUsage") or {}).get("prompt_tokens_details") or {}).get("cached_tokens") or 0)
    cost = compute_cost(prompt, completion, cached)
    report["cost"] = {
        **RATE_CARD,
        **cost,
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "cached_tokens": cached,
        "total_tokens": prompt + completion,
    }
    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    md = build_report(report, nd)
    OUT.write_text(md, encoding="utf-8")
    # Remove deprecated second "main" report if present
    unified = PLAN / "TRACKED_E2E_UNIFIED_REPORT.md"
    if unified.exists():
        unified.unlink()
        print("removed deprecated", unified.name)
    annexes_md = PLAN / "TRACKED_E2E_ANNEXES.md"
    if annexes_md.exists():
        # Leave a one-line pointer so old links don't 404-empty; book is in REPORT.md
        annexes_md.write_text(
            "# Deprecated\n\n"
            "Annex content (full chapter prose, cast, digests) is now inlined in "
            "`TRACKED_E2E_REPORT.md`. Open that single file.\n",
            encoding="utf-8",
        )
        print("stubbed deprecated", annexes_md.name)
    # Verify chapters landed in full
    ch = (nd.get("chapters") or [])
    for i, body in enumerate(ch):
        body = body or ""
        if not body.strip():
            continue
        needle = body.strip()[:80]
        if needle not in md:
            raise SystemExit(f"Chapter {i+1} prose missing from single report (start not found)")
        if f"({len(body)} chars)" not in md:
            print("warn: length label missing for ch", i + 1)
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("chapters_inlined", [len(c or "") for c in ch if (c or "").strip()])
    print("total_cost_usd", cost["total_cost_usd"])
    print("blended_per_token", cost["blended_per_token_usd"])


if __name__ == "__main__":
    main()
