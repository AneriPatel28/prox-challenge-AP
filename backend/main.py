"""
main.py — Step 4: FastAPI server with SSE streaming.

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

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT          = Path(__file__).parent.parent
IMAGES_DIR    = ROOT / "data" / "images"
FILES_DIR     = ROOT / "files"
FEEDBACK_FILE = ROOT / "data" / "feedback.jsonl"

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

    import datetime
    entry = {
        "ts":         datetime.datetime.utcnow().isoformat(),
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
