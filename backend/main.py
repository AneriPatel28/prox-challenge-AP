"""
main.py — FastAPI server with SSE streaming.

Endpoints:
  POST /api/chat      → SSE stream of thinking events + final answer
  GET  /health        → basic liveness check
  GET  /ready         → readiness check (models loaded, ChromaDB connected)
  GET  /images/{file} → serve manual page JPEGs

SSE event stream format:
  data: {"type": "thinking", "message": "Searching the manual..."}
  data: {"type": "thinking", "message": "Found 5 relevant sections (relevance: 63%)"}
  data: {"type": "answer",   "text": "...", "artifact": {...}, "sources": [...]}
  data: {"type": "error",    "message": "..."}
  data: {"type": "done"}

Run:
  uvicorn backend.main:app --reload --port 8000

Test SSE stream:
  curl -X POST http://localhost:8000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"What is the duty cycle at 200A on 240V?","session_id":"test-123"}'
"""

from __future__ import annotations

import asyncio
import datetime as _dt
import json
import logging
import queue
import threading
import uuid
from pathlib import Path
from typing import Callable, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.agent import (
    COLLECTION_NAME,
    get_client,
    get_collection,
    get_embed_model,
    get_memory,
    run_agent,
)
from backend.eval_scorer import score_response as _score_response

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT          = Path(__file__).parent.parent
IMAGES_DIR    = ROOT / "data" / "images"
FILES_DIR     = ROOT / "files"
FEEDBACK_FILE    = ROOT / "data" / "feedback.jsonl"
EVAL_CASES_FILE  = ROOT / "data" / "eval_test_cases.json"
EVAL_RESULTS_FILE = ROOT / "data" / "eval_results.json"

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s [%(levelname)s] %(message)s",
    datefmt = "%H:%M:%S",
)
log = logging.getLogger("main")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "Vulcan OmniPro 220 Agent API",
    description = "Multimodal reasoning agent for the Vulcan OmniPro 220 welder.",
    version     = "1.0.0",
)

# CORS — allow Next.js frontend on any port during development
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],   # tighten to frontend URL in production
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Serve manual page images at /images/<filename>
if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
else:
    log.warning("Images directory not found at %s — /images endpoint unavailable.", IMAGES_DIR)

# ─── Request / Response models ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str
    session_id: Optional[str] = None   # generated server-side if not provided
    history:    list[dict] = []


class FeedbackRequest(BaseModel):
    session_id: str
    message_id: str
    query:      str
    response:   str
    rating:     int   # 1 = positive, -1 = negative


# ══════════════════════════════════════════════════════════════════════════════
# STARTUP — pre-load models so first request is fast
# ══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    """
    Pre-load embedding model + ChromaDB + Anthropic client on server start.
    Runs in a thread pool so it doesn't block the event loop.
    """
    log.info("Server starting — pre-loading models...")

    loop = asyncio.get_event_loop()

    def preload():
        try:
            get_embed_model()
            log.info("  ✓ Embedding model loaded")
        except Exception as e:
            log.error("  ✗ Embedding model failed: %s", e)

        try:
            col = get_collection()
            log.info("  ✓ ChromaDB connected (%d chunks)", col.count())
        except Exception as e:
            log.error("  ✗ ChromaDB failed: %s", e)

        try:
            get_client()
            log.info("  ✓ Anthropic client ready")
        except Exception as e:
            log.error("  ✗ Anthropic client failed: %s", e)

        try:
            get_memory()
            log.info("  ✓ Mem0 memory ready")
        except Exception as e:
            log.warning("  ⚠ Mem0 init failed (non-fatal): %s", e)

        log.info("Pre-loading complete. Server ready.")

    await loop.run_in_executor(None, preload)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    """Liveness check — returns 200 if server is running."""
    return {"status": "ok"}


@app.get("/ready")
def ready():
    """
    Readiness check — verifies all dependencies are loaded.
    Used by GCP health checks and frontend to know when server is ready.
    """
    status = {}
    ok     = True

    try:
        col            = get_collection()
        status["chromadb"] = {"ok": True, "chunks": col.count()}
    except Exception as e:
        status["chromadb"] = {"ok": False, "error": str(e)}
        ok = False

    try:
        get_embed_model()
        status["embed_model"] = {"ok": True}
    except Exception as e:
        status["embed_model"] = {"ok": False, "error": str(e)}
        ok = False

    try:
        get_client()
        status["anthropic"] = {"ok": True}
    except Exception as e:
        status["anthropic"] = {"ok": False, "error": str(e)}
        ok = False

    if not ok:
        raise HTTPException(status_code=503, detail=status)

    return {"status": "ready", **status}


@app.get("/files/{filename}")
def serve_pdf(filename: str):
    """Serve PDF files from the files/ directory."""
    # Only allow PDF files to prevent path traversal
    if not filename.endswith(".pdf") or "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = FILES_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@app.post("/api/feedback")
async def feedback(req: FeedbackRequest):
    """Store thumbs up/down feedback for a response."""
    if req.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="rating must be 1 or -1")

    entry = {
        "ts":         _dt.datetime.utcnow().isoformat(),
        "session_id": req.session_id,
        "message_id": req.message_id,
        "rating":     req.rating,
        "query":      req.query[:500],
        "response":   req.response[:1000],
    }
    FEEDBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    log.info("Feedback | session: %s | rating: %+d", req.session_id, req.rating)
    return {"ok": True}


class SiteFeedbackRequest(BaseModel):
    name:    str
    email:   str
    message: str
    rating:  int   # 1-5


USER_FEEDBACK_FILE = ROOT / "data" / "user_feedback.jsonl"


@app.post("/api/user-feedback")
async def site_feedback(req: SiteFeedbackRequest):
    """Store user-submitted site feedback (name, email, message, star rating)."""
    if not 1 <= req.rating <= 5:
        raise HTTPException(status_code=400, detail="rating must be 1-5")

    entry = {
        "ts":      _dt.datetime.utcnow().isoformat(),
        "name":    req.name[:100],
        "email":   req.email[:200],
        "message": req.message[:2000],
        "rating":  req.rating,
    }
    USER_FEEDBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USER_FEEDBACK_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    log.info("Site feedback | %s (%s) | rating: %d", req.name, req.email, req.rating)
    return {"ok": True}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """
    Main chat endpoint — streams SSE events as the agent works.

    Event types:
      thinking → agent step update (shown in ThinkingIndicator)
      answer   → final answer + artifact + sources
      error    → something went wrong
      done     → stream complete, frontend can close connection
    """
    session_id = req.session_id or str(uuid.uuid4())
    log.info("Chat request | session: %s | message: %.80s", session_id, req.message)

    # Queue bridges the sync agent thread and async SSE generator
    event_queue: queue.Queue = queue.Queue()

    def on_event(event: dict):
        """Called by agent on every thinking/answer/error event."""
        event_queue.put(event)

    def run_in_thread():
        """Run the blocking agent in a separate thread."""
        try:
            run_agent(
                user_message = req.message,
                session_id   = session_id,
                history      = req.history,
                on_event     = on_event,
            )
        except Exception as e:
            log.error("Agent thread error: %s", e)
            event_queue.put({"type": "error", "message": str(e)})
        finally:
            event_queue.put({"type": "done"})

    # Start agent in background thread
    thread = threading.Thread(target=run_in_thread, daemon=True)
    thread.start()

    async def event_stream():
        """Read from queue and yield SSE-formatted events."""
        total_waited = 0
        MAX_WAIT     = 300   # 5 min hard cap
        POLL_INTERVAL = 15   # heartbeat every 15s

        while total_waited < MAX_WAIT:
            try:
                event = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: event_queue.get(timeout=POLL_INTERVAL),
                )
            except queue.Empty:
                # No event yet — send heartbeat to keep connection alive
                total_waited += POLL_INTERVAL
                log.debug("Heartbeat sent for session %s (%ds elapsed)", session_id, total_waited)
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                continue

            yield f"data: {json.dumps(event)}\n\n"

            if event["type"] == "done":
                break

        else:
            log.warning("SSE stream hit 5-min cap for session %s", session_id)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Request timed out after 5 minutes'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type = "text/event-stream",
        headers    = {
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering on GCP
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# EVAL ENDPOINT  — POST /api/eval/run
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/eval/count")
def get_eval_count():
    """Return the total number of test cases without running anything."""
    if not EVAL_CASES_FILE.exists():
        raise HTTPException(status_code=404, detail="eval_test_cases.json not found")
    with open(EVAL_CASES_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return {"total": len(data.get("test_cases", []))}


@app.get("/api/eval/results")
def get_eval_results():
    """Return the last saved eval run, or 404 if no run has been saved yet."""
    if not EVAL_RESULTS_FILE.exists():
        raise HTTPException(status_code=404, detail="No eval results saved yet. Run an evaluation first.")
    with open(EVAL_RESULTS_FILE, encoding="utf-8") as f:
        return json.load(f)


class EvalRequest(BaseModel):
    case_ids: list[str] = []    # empty = run all
    merge:    bool      = False # merge results into existing file instead of overwriting


@app.post("/api/eval/run")
async def eval_run(req: EvalRequest):
    """
    Run evaluation test cases through the agent and score with LLM-as-judge (Claude Haiku).

    SSE events:
      progress  → {"type":"progress", "current":N, "total":M, "tc_id":"TC001"}
      result    → {"type":"result", "tc_id":"TC001", "question":"...", "category":"...",
                   "response":"...", "score":0.85, "passed":true, "feedback":"...",
                   "dimension_scores":{...}, "has_artifact":true, "sources_found":["p7"]}
      summary   → {"type":"summary", "avg_score":0.87, "pass_rate":0.88, "total":50, "by_category":{...}}
      done      → {"type":"done"}
    """
    if not EVAL_CASES_FILE.exists():
        raise HTTPException(status_code=404, detail="eval_test_cases.json not found")

    with open(EVAL_CASES_FILE) as f:
        eval_data = json.load(f)

    all_cases = eval_data["test_cases"]
    if req.case_ids:
        cases = [c for c in all_cases if c["id"] in req.case_ids]
    else:
        cases = all_cases

    event_queue: queue.Queue = queue.Queue()

    def score_response(tc, response_text, artifacts, sources):
        def on_retry(label, attempt, wait):
            event_queue.put({"type": "retry", "label": label, "attempt": attempt, "wait": wait})
        return _score_response(tc, response_text, artifacts, sources, get_client, on_retry=on_retry)

    import time as _time

    def _call_with_retry(fn, label: str, max_retries: int = 4):
        """Call fn(); on 429/529/overloaded retry with exponential backoff."""
        delay = 20  # seconds before first retry
        for attempt in range(max_retries + 1):
            try:
                return fn()
            except Exception as e:
                err_str = str(e)
                is_retryable = (
                    "529" in err_str or
                    "overloaded" in err_str.lower() or
                    "429" in err_str or
                    "rate_limit" in err_str.lower() or
                    "rate limit" in err_str.lower() or
                    "too many requests" in err_str.lower()
                )
                if is_retryable and attempt < max_retries:
                    log.warning("%s rate-limited (attempt %d/%d) — waiting %ds", label, attempt + 1, max_retries, delay)
                    event_queue.put({
                        "type":    "retry",
                        "label":   label,
                        "attempt": attempt + 1,
                        "wait":    delay,
                    })
                    _time.sleep(delay)
                    delay = min(delay * 2, 120)  # cap at 2 min
                else:
                    raise
        raise RuntimeError(f"{label} failed after {max_retries} retries")

    merge_mode = req.merge

    def run_eval_thread():
        # In merge mode: load existing results and keep non-re-run cases
        if merge_mode and EVAL_RESULTS_FILE.exists():
            try:
                with open(EVAL_RESULTS_FILE) as f:
                    existing_saved = json.load(f)
                rerun_ids = {tc["id"] for tc in cases}
                base_results = [r for r in existing_saved.get("results", []) if r["tc_id"] not in rerun_ids]
            except Exception:
                base_results = []
        else:
            base_results = []

        results = list(base_results)
        by_category: dict[str, list[float]] = {}

        for i, tc in enumerate(cases):
            event_queue.put({
                "type":    "progress",
                "current": i + 1,
                "total":   len(cases),
                "tc_id":   tc["id"],
                "question": tc["question"][:80],
            })

            # Pause between cases to stay under TPM rate limit
            if i > 0:
                _time.sleep(10)

            # Run through the actual agent with retry on overload
            agent_result = {"text": "", "artifacts": [], "sources": []}
            try:
                returned = _call_with_retry(
                    lambda: run_agent(
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
                log.error("Agent error for %s: %s", tc["id"], e)
                agent_result["text"] = f"[Agent error: {e}]"

            # Score with LLM judge
            score_info = score_response(
                tc,
                agent_result["text"],
                agent_result["artifacts"],
                agent_result["sources"],
            )

            gt = tc["ground_truth"]
            result = {
                "type":              "result",
                "tc_id":             tc["id"],
                "question":          tc["question"],
                "category":          tc["category"],
                # actual agent output
                "response":          agent_result["text"][:800],
                "has_artifact":      len(agent_result["artifacts"]) > 0,
                "artifact_types":    [a.get("type", "?") for a in agent_result["artifacts"]],
                "sources_found":     [str(s.get("page", "")) for s in agent_result["sources"]],
                # scores
                "score":             score_info["aggregate"],
                "passed":            score_info["passed"],
                "feedback":          score_info["feedback"],
                "dimension_scores":  score_info["dimension_scores"],
                "must_not_violated": score_info["must_not_violated"],
                # ground truth — shown in expanded view so user can see expected vs actual
                "sources_expected":  tc.get("sources_expected", []),
                "must_mention":      gt.get("must_mention", []),
                "must_not_claim":    gt.get("must_not_claim", []),
                "key_facts":         gt.get("key_facts", []),
            }

            results.append(result)
            by_category.setdefault(tc["category"], []).append(score_info["aggregate"])

            event_queue.put(result)

            # Write incrementally after each case so progress is never lost
            try:
                all_scores_so_far = [r["score"] for r in results]
                interim_saved = {
                    "run_at":  _dt.datetime.utcnow().isoformat() + "Z",
                    "summary": {
                        "avg_score":   round(sum(all_scores_so_far) / len(all_scores_so_far), 3),
                        "pass_rate":   round(sum(1 for r in results if r["passed"]) / len(results), 3),
                        "pass_count":  sum(1 for r in results if r["passed"]),
                        "total":       len(results),
                        "by_category": {},
                    },
                    "results": results,
                }
                EVAL_RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
                with open(EVAL_RESULTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(interim_saved, f, indent=2)
            except Exception as e:
                log.warning("Incremental save failed: %s", e)

        # Summary
        all_scores = [r["score"] for r in results]
        avg_score  = round(sum(all_scores) / len(all_scores), 3) if all_scores else 0
        pass_count = sum(1 for r in results if r["passed"])

        category_summary = {
            cat: {
                "avg":   round(sum(scores) / len(scores), 3),
                "count": len(scores),
                "passed": sum(1 for s in scores if s >= 0.70),
            }
            for cat, scores in by_category.items()
        }

        summary_event = {
            "type":        "summary",
            "avg_score":   avg_score,
            "pass_rate":   round(pass_count / len(results), 3) if results else 0,
            "pass_count":  pass_count,
            "total":       len(results),
            "by_category": category_summary,
        }
        event_queue.put(summary_event)
        event_queue.put({"type": "done"})

        # Final save with complete merged results and full summary
        try:
            saved = {
                "run_at":  _dt.datetime.utcnow().isoformat() + "Z",
                "summary": {k: v for k, v in summary_event.items() if k != "type"},
                "results": results,
            }
            EVAL_RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(EVAL_RESULTS_FILE, "w", encoding="utf-8") as f:
                json.dump(saved, f, indent=2)
            log.info("Eval results saved to %s", EVAL_RESULTS_FILE)
        except Exception as e:
            log.warning("Failed to save eval results: %s", e)

    thread = threading.Thread(target=run_eval_thread, daemon=True)
    thread.start()

    async def eval_stream():
        MAX_WAIT = 3600  # 60 min for full 65-case eval (includes retries)
        waited   = 0
        while waited < MAX_WAIT:
            try:
                ev = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: event_queue.get(timeout=30)
                )
            except queue.Empty:
                waited += 30
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                continue
            yield f"data: {json.dumps(ev)}\n\n"
            if ev["type"] == "done":
                break

    return StreamingResponse(
        eval_stream(),
        media_type = "text/event-stream",
        headers    = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
