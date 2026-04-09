#!/usr/bin/env python3
"""
Standalone eval runner — no FastAPI server needed.

Usage:
    python scripts/run_eval.py                   # run all 65 cases
    python scripts/run_eval.py --cases TC001,TC002
    python scripts/run_eval.py --category specs
    python scripts/run_eval.py --output my_results.json
"""

import argparse
import datetime
import json
import sys
import time
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT    = Path(__file__).parent.parent
BACKEND = ROOT / "backend"
DATA    = ROOT / "data"
sys.path.insert(0, str(BACKEND))

from agent import run_agent, get_client                      # noqa: E402
from eval_scorer import score_response as _score, PASS_THRESHOLD  # noqa: E402

# ── Config ────────────────────────────────────────────────────────────────────
EVAL_CASES_FILE   = DATA / "eval_test_cases.json"
EVAL_RESULTS_FILE = DATA / "eval_results.json"
SLEEP_BETWEEN = 10  # seconds between cases (stay under 30K TPM rate limit)

# ── Colours for terminal output ───────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"



# ── Retry helper ──────────────────────────────────────────────────────────────
def call_with_retry(fn, label: str, max_retries: int = 4):
    delay = 15
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as e:
            err = str(e)
            is_overload = "529" in err or "overloaded" in err.lower() or "too low" not in err.lower() and "credit" not in err.lower()
            is_retryable = (
                "529" in err or "overloaded" in err.lower() or
                "429" in err or "rate_limit" in err.lower() or
                "rate limit" in err.lower() or "too many requests" in err.lower()
            )
            if is_retryable and attempt < max_retries:
                print(f"  {YELLOW}⚠ {label} overloaded (attempt {attempt+1}/{max_retries}) — waiting {delay}s{RESET}")
                time.sleep(delay)
                delay = min(delay * 2, 120)
            else:
                raise


# ── Scoring — delegates to eval_scorer.py (single source of truth) ───────────
def score_response(tc, response_text, artifacts, sources):
    def on_retry(label, attempt, wait):
        print(f"  {YELLOW}⚠ Judge overloaded — retrying {label} (attempt {attempt}, waiting {wait}s){RESET}")
    return _score(tc, response_text, artifacts, sources, get_client, on_retry=on_retry)


# ── Save helper ───────────────────────────────────────────────────────────────
def _save(output_file: Path, by_id: dict):
    all_results = list(by_id.values())
    all_scores  = [r["score"] for r in all_results]
    pass_count  = sum(1 for r in all_results if r["passed"])
    avg_score   = round(sum(all_scores) / len(all_scores), 3) if all_scores else 0
    by_cat: dict = {}
    for r in all_results:
        by_cat.setdefault(r["category"], []).append(r["score"])
    category_summary = {
        cat: {
            "avg":    round(sum(s)/len(s), 3),
            "count":  len(s),
            "passed": sum(1 for x in s if x >= PASS_THRESHOLD),
        }
        for cat, s in by_cat.items()
    }
    saved = {
        "run_at":  datetime.datetime.utcnow().isoformat() + "Z",
        "summary": {
            "avg_score":   avg_score,
            "pass_rate":   round(pass_count / len(all_results), 3) if all_results else 0,
            "pass_count":  pass_count,
            "total":       len(all_results),
            "by_category": category_summary,
        },
        "results": all_results,
    }
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(saved, f, indent=2)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Run eval test cases against the welding agent.")
    parser.add_argument("--cases",    type=str, default="", help="Comma-separated case IDs, e.g. TC001,TC002")
    parser.add_argument("--category", type=str, default="", help="Filter by category, e.g. specs")
    parser.add_argument("--output",   type=str, default="", help="Output JSON file (default: data/eval_results.json)")
    parser.add_argument("--merge",    action="store_true",  help="Merge results into existing file instead of overwriting")
    parser.add_argument("--below",    type=float, default=0.0, help="Rerun all cases with score below this threshold, e.g. --below 0.85")
    args = parser.parse_args()

    if not EVAL_CASES_FILE.exists():
        print(f"ERROR: {EVAL_CASES_FILE} not found")
        sys.exit(1)

    with open(EVAL_CASES_FILE) as f:
        eval_data = json.load(f)

    all_cases = eval_data["test_cases"]

    output_file = Path(args.output) if args.output else EVAL_RESULTS_FILE

    # Load existing results for merge mode
    existing_by_id = {}
    if (args.merge or args.below > 0.0) and output_file.exists():
        with open(output_file) as f:
            existing = json.load(f)
        for r in existing.get("results", []):
            existing_by_id[r["tc_id"]] = r
        print(f"  Loaded {len(existing_by_id)} existing results for merge.")

    # Filter cases
    if args.below > 0.0:
        # Rerun all cases whose existing score is below threshold
        ids = {tc_id for tc_id, r in existing_by_id.items() if r.get("score", 1.0) < args.below}
        # Also include cases not yet run
        run_ids = set(existing_by_id.keys())
        all_ids = {c["id"] for c in all_cases}
        ids |= (all_ids - run_ids)
        cases = [c for c in all_cases if c["id"] in ids]
        print(f"  --below {args.below}: {len(cases)} case(s) to rerun.")
    elif args.cases:
        ids = {c.strip() for c in args.cases.split(",")}
        cases = [c for c in all_cases if c["id"] in ids]
    elif args.category:
        cases = [c for c in all_cases if c["category"] == args.category]
    else:
        cases = all_cases

    total = len(cases)
    print(f"\n{BOLD}Prox Eval Runner{RESET} — {total} case(s)\n{'─'*60}")

    results       = []
    by_category   = {}
    start_time    = time.time()

    for i, tc in enumerate(cases):
        pct = f"{i+1}/{total}"
        print(f"\n{CYAN}[{pct}]{RESET} {BOLD}{tc['id']}{RESET} — {tc['category']}")
        print(f"  Q: {tc['question'][:90]}")

        if i > 0:
            time.sleep(SLEEP_BETWEEN)

        # Run agent
        agent_result = {"text": "", "artifacts": [], "sources": []}
        try:
            returned = call_with_retry(
                lambda tc=tc: run_agent(
                    user_message = tc["question"],
                    session_id   = f"eval-{tc['id']}",
                    history      = [],
                    on_event     = None,
                ),
                label = tc["id"],
            )
            agent_result["text"]      = returned.get("text", "")
            agent_result["artifacts"] = returned.get("artifacts", [])
            agent_result["sources"]   = returned.get("sources", [])
        except Exception as e:
            print(f"  {RED}Agent error: {e}{RESET}")
            agent_result["text"] = f"[Agent error: {e}]"

        # Score
        score_info = score_response(
            tc,
            agent_result["text"],
            agent_result["artifacts"],
            agent_result["sources"],
        )

        score  = score_info["aggregate"]
        passed = score_info["passed"]
        icon   = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        print(f"  Score: {BOLD}{score:.0%}{RESET} [{icon}]  |  {score_info['feedback'][:100]}")

        gt = tc["ground_truth"]
        result = {
            "tc_id":             tc["id"],
            "question":          tc["question"],
            "category":          tc["category"],
            "response":          agent_result["text"][:800],
            "has_artifact":      len(agent_result["artifacts"]) > 0,
            "artifact_types":    [a.get("type", "?") for a in agent_result["artifacts"]],
            "sources_found":     [str(s.get("page", "")) for s in agent_result["sources"]],
            "score":             score,
            "passed":            passed,
            "feedback":          score_info["feedback"],
            "dimension_scores":  score_info["dimension_scores"],
            "must_not_violated": score_info["must_not_violated"],
            "sources_expected":  tc.get("sources_expected", []),
            "must_mention":      gt.get("must_mention", []),
            "must_not_claim":    gt.get("must_not_claim", []),
            "key_facts":         gt.get("key_facts", []),
        }
        results.append(result)
        by_category.setdefault(tc["category"], []).append(score)

        # Incremental write after each case — merge with existing
        existing_by_id[tc["id"]] = result
        _save(output_file, existing_by_id)

    # ── Summary ───────────────────────────────────────────────────────────────
    elapsed    = round(time.time() - start_time)
    all_scores = [r["score"] for r in results]
    avg_score  = round(sum(all_scores) / len(all_scores), 3) if all_scores else 0
    pass_count = sum(1 for r in results if r["passed"])
    pass_rate  = round(pass_count / len(results), 3) if results else 0

    print(f"\n{'─'*60}")
    print(f"{BOLD}Summary{RESET}")
    print(f"  Cases run:  {total}")
    print(f"  Avg score:  {BOLD}{avg_score:.0%}{RESET}")
    print(f"  Pass rate:  {pass_count}/{total} ({pass_rate:.0%})")
    print(f"  Run time:   {elapsed//60}m {elapsed%60:02d}s")
    print(f"\n  By category:")

    category_summary = {}
    for cat, scores in sorted(by_category.items()):
        cat_avg    = round(sum(scores) / len(scores), 3)
        cat_passed = sum(1 for s in scores if s >= PASS_THRESHOLD)
        icon       = GREEN if cat_avg >= PASS_THRESHOLD else RED
        print(f"    {icon}{cat:<22}{RESET}  {cat_avg:.0%}  ({cat_passed}/{len(scores)} pass)")
        category_summary[cat] = {"avg": cat_avg, "count": len(scores), "passed": cat_passed}

    # ── Final save (already done incrementally, this is a no-op flush) ───────
    _save(output_file, existing_by_id)
    print(f"\n  Results saved → {output_file}")
    print()


if __name__ == "__main__":
    main()
