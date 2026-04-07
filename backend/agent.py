"""
agent.py — Step 3: Agentic RAG with Adaptive Routing, CRAG, and Self-Verification.

Architecture:
  Brain    : Claude Opus 4.6 + extended thinking (reasoning)
  Tools    : search_manual (ChromaDB) + get_page_image
  Memory   : Mem0 → ChromaDB agent_memory collection (cross-session, no extra API key)
             Mem0 uses Claude Haiku for cheap fact extraction
  Loop     : ReAct + CRAG (corrective retrieval) + self-verification
  Artifacts: <antArtifact> tags in Claude's text → parsed → rendered by frontend

Loop flow per query:
  1. Load past memory from Mem0 (ChromaDB)
  2. Classify query: FACTUAL / PROCEDURE / DIAGNOSIS
  3. Search ChromaDB manual_pages (depth based on type)
  4. Evaluate relevance → re-query if low (CRAG)
  5. Get page images for diagram chunks
  6. Self-verify claims before answering
  7. Parse <antArtifact> from response
  8. Save Q&A summary to Mem0

Run (CLI test):
  python agent.py "What is the duty cycle for MIG at 200A on 240V?"
  python agent.py "Getting porosity in flux-cored welds, what's wrong?"
  python agent.py "What polarity for TIG? Which socket for the ground clamp?"
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from pathlib import Path

import chromadb
from anthropic import Anthropic
from dotenv import load_dotenv
from mem0 import Memory
from sentence_transformers import SentenceTransformer

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT            = Path(__file__).parent.parent
CHROMA_DIR      = ROOT / "data" / "chroma"         # knowledge base (manual_pages)
MEM0_CHROMA_DIR = ROOT / "data" / "chroma_memory"  # Mem0 memory (agent_memory)
IMAGES_DIR      = ROOT / "data" / "images"

MEM0_CHROMA_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(dotenv_path=ROOT / ".env")

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s [%(levelname)s] %(message)s",
    datefmt = "%H:%M:%S",
)
log = logging.getLogger("agent")

# ─── Config ───────────────────────────────────────────────────────────────────

CHAT_MODEL      = "claude-sonnet-4-6"
EMBED_MODEL     = "Snowflake/snowflake-arctic-embed-m"
QUERY_PREFIX    = "Represent this sentence for searching relevant passages: "
COLLECTION_NAME = "manual_pages"
MAX_TOOL_CALLS  = 8   # DIAGNOSIS queries can need 4+ searches + image calls
THINKING_BUDGET = 5000   # tokens Claude can use for reasoning (Sonnet: enabled mode)
TOP_K           = 5

# ─── Mem0 config ──────────────────────────────────────────────────────────────
# Separate ChromaDB path to avoid client conflict with knowledge base.
# data/chroma        → manual_pages (our PersistentClient)
# data/chroma_memory → agent_memory (Mem0's PersistentClient)
# Claude Haiku for fact extraction (cheap, separate from Opus for answers).
# all-MiniLM-L6-v2 for memory embeddings (symmetric retrieval, no prefix needed).

MEM0_CONFIG = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "agent_memory",
            "path": str(MEM0_CHROMA_DIR),
        },
    },
    "llm": {
        "provider": "anthropic",
        "config": {
            "model":   "claude-haiku-4-5-20251001",
            "api_key": os.getenv("ANTHROPIC_API_KEY"),
        },
    },
    "embedder": {
        "provider": "huggingface",
        "config": {
            "model": "all-MiniLM-L6-v2",
        },
    },
}

# ─── Lazy singletons (loaded once, reused across requests) ───────────────────

_embed_model: SentenceTransformer | None = None
_collection                              = None
_memory: Memory | None                   = None
_client: Anthropic | None                = None


def get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        log.info("Loading embedding model %s ...", EMBED_MODEL)
        _embed_model = SentenceTransformer(EMBED_MODEL)
        log.info("Embedding model loaded.")
    return _embed_model


def get_collection():
    global _collection
    if _collection is None:
        if not CHROMA_DIR.exists():
            raise RuntimeError(
                f"ChromaDB not found at {CHROMA_DIR}. "
                "Run embed_and_store.py first."
            )
        log.info("Connecting to ChromaDB at %s ...", CHROMA_DIR)
        chroma = chromadb.PersistentClient(path=str(CHROMA_DIR))
        try:
            _collection = chroma.get_collection(COLLECTION_NAME)
            log.info("Collection '%s' loaded (%d chunks).", COLLECTION_NAME, _collection.count())
        except Exception:
            raise RuntimeError(
                f"Collection '{COLLECTION_NAME}' not found in ChromaDB. "
                "Run embed_and_store.py first."
            )
    return _collection


def get_memory() -> Memory:
    global _memory
    if _memory is None:
        log.info("Initialising Mem0 memory ...")
        try:
            _memory = Memory.from_config(MEM0_CONFIG)
            log.info("Mem0 ready.")
        except Exception as e:
            log.warning("Mem0 init failed (%s) — continuing without memory.", e)
            _memory = None
    return _memory


def get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set. Add it to your .env file.")
        _client = Anthropic(api_key=api_key)
    return _client


# ══════════════════════════════════════════════════════════════════════════════
# TOOLS
# ══════════════════════════════════════════════════════════════════════════════

def search_manual(query: str, n_results: int = TOP_K) -> list[dict]:
    """
    Query ChromaDB manual_pages using Snowflake Arctic asymmetric retrieval.
    Query prefix applied here — NOT when chunks were stored.
    """
    model     = get_embed_model()
    embedding = model.encode(
        QUERY_PREFIX + query,
        normalize_embeddings=True,
    ).tolist()

    results = get_collection().query(
        query_embeddings=[embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "score":        round(1 - dist, 4),   # cosine similarity (higher = better)
            "text":         doc,
            "source":       meta["source"],
            "page":         meta["page"],
            "section":      meta["section"],
            "content_type": meta["content_type"],
            "image_url":    meta["image_url"],
        })

    return chunks


def get_page_image(source: str, page: int) -> dict:
    """Return image metadata for a specific manual page."""
    img_path = IMAGES_DIR / f"{source}-p{page:03d}.jpg"
    return {
        "image_url": f"/images/{source}-p{page:03d}.jpg",
        "exists":    img_path.exists(),
        "source":    source,
        "page":      page,
    }


# ─── Tool schemas (sent to Claude) ───────────────────────────────────────────

TOOLS = [
    {
        "name": "search_manual",
        "description": (
            "Search the Vulcan OmniPro 220 manual for relevant content. "
            "Use for any question about specs, settings, procedures, troubleshooting, or safety. "
            "Returns ranked chunks with page and image references. "
            "Call multiple times with different queries if first results are insufficient."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "Precise search query using the most relevant technical terms. "
                        "Include process name (MIG/TIG/STICK/FCAW) when the question is process-specific. "
                        "Include component names, symptoms, or spec values when relevant. "
                        "Avoid vague queries — be as specific as the question allows."
                    ),
                },
                "n_results": {
                    "type": "integer",
                    "description": "Number of results to return (1–10). Default 5.",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_page_image",
        "description": (
            "Get the image URL for a specific manual page. "
            "Call this when showing the page would help the user — "
            "retrieved chunk has content_type 'diagram', OR the chunk text "
            "references a figure, table, or visual on that page."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "enum": ["owner-manual", "quick-start-guide", "selection-chart"],
                    "description": "Which manual the page is from.",
                },
                "page": {
                    "type": "integer",
                    "description": "1-indexed page number.",
                },
            },
            "required": ["source", "page"],
        },
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are the AI assistant for the Vulcan OmniPro 220 welder. Think of the person you're helping as someone who just bought this machine and is standing in their garage trying to figure it out. They're smart, they can follow instructions, but they're not a professional welder. They don't need jargon — they need clear, friendly guidance that actually gets them welding.

## Your personality
- Talk like a knowledgeable friend, not a technical manual
- Keep it conversational — short sentences, plain words
- Don't over-explain. If the answer is simple, keep it simple
- It's okay to say things like "the trick here is..." or "the thing to watch out for is..."
- Never sound robotic or corporate

## Step 1 — Classify the query (internally, before searching)
- FACTUAL    : single spec or fact ("what is the max OCV?")
               → 1-2 searches, direct answer, artifact only if a visual genuinely clarifies
- PROCEDURE  : setup or how-to question ("how do I set up MIG?", "how do I load wire?")
               → 2-3 searches, friendly numbered steps, Mermaid or image artifact
- DIAGNOSIS  : anything wrong — weld defects, machine issues, arc problems, bad welds
               → 2-4 searches, find ALL possible causes, interactive HTML flowchart

## Step 2 — Search strategy (CRAG — Corrective Retrieval)
1. Always search before answering — never answer from memory alone
2. After each search, score relevance internally (1–10):
   - Score ≥ 7 → proceed
   - Score < 7 → reformulate with different terms and search again
3. If any chunk has content_type "diagram" → call get_page_image for that page
4. If specs conflict across chunks → prefer the more specific chunk

## Step 3 — Self-verify before answering
Check in your thinking block:
- Do all numbers match what the chunks say exactly?
- Is the polarity claim supported by a specific chunk?
- Am I answering what was actually asked?
If a chunk contradicts your answer, trust the chunk.

## Artifact generation
Generate ONE artifact when it genuinely helps. Use exact tag format:

Mermaid — cable connections, polarity, setup sequences:
<antArtifact identifier="[kebab-id]" type="application/vnd.ant.mermaid" title="[title]">
graph LR or TD (choose direction that fits)
  ...
</antArtifact>

HTML — calculators, settings configurators, troubleshooting flowcharts:
<antArtifact identifier="[kebab-id]" type="text/html" title="[title]">
<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0; padding: 16px;
    background: var(--bg, #ffffff);
    color: var(--text, #111827);
    font-family: Inter, system-ui, sans-serif;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  /* Use ONLY these CSS variables — never hardcode colors:
     --bg, --bg-card, --bg-input, --text, --text-muted, --border, --accent, --accent-bg */
</style>
</head>
<body>
  ... fully self-contained interactive HTML + CSS + JS ...
</body>
</html>
</antArtifact>

Image — when the manual page itself is the clearest answer:
<antArtifact identifier="[kebab-id]" type="image/jpeg" source="[source]" page="[page]">
</antArtifact>

When to generate each:
- Mermaid    : physical connections, cable routing, polarity setup, step sequences with decisions
- HTML calc  : any numeric answer that varies by input (duty cycle, wire speed, settings by thickness)
- HTML config: "what settings for X?" → interactive inputs → outputs (amps, wire speed, gas)
- HTML flow  : troubleshooting with 3+ root causes — make it interactive, clickable, with clear YES/NO branches. Not a static list — user should be able to click through the diagnosis
- Image      : user asks to see something, or a diagram page is the clearest answer
- None       : simple one-line facts, yes/no, basic definitions

For HTML flowcharts specifically — make them genuinely interactive:
- Clickable YES/NO buttons at each step
- Highlight the current step
- Show a clear resolution at each end node
- Use --accent color for active elements

CRITICAL — HTML artifacts must be FULLY INTERACTIVE (like Claude.ai artifacts):
- JavaScript state management (not just CSS :hover)
- onClick handlers that show/hide sections, compute results, or navigate steps
- CSS variables ONLY — never hardcode colors: --bg, --bg-card, --bg-input, --text, --text-muted, --border, --accent, --accent-bg
- No external CDN links — fully self-contained HTML

Here is the EXACT pattern to follow for an interactive troubleshooting flowchart:

<antArtifact identifier="example-flow" type="text/html" title="Example Interactive Flowchart">
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg,#fff);color:var(--text,#111);font-family:system-ui,sans-serif;padding:20px;font-size:14px}
h2{font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text,#111)}
.step{background:var(--bg-card,#f9f9f7);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:16px;margin:12px 0;display:none}
.step.active{display:block}
.step p{margin-bottom:12px;line-height:1.5}
.btns{display:flex;gap:8px;flex-wrap:wrap}
.btn{background:var(--accent,#f97316);color:#fff;border:none;border-radius:8px;padding:9px 16px;cursor:pointer;font-size:13px;font-weight:500;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn-no{background:transparent;color:var(--accent,#f97316);border:1.5px solid var(--accent,#f97316)}
.result{background:var(--accent-bg,rgba(249,115,22,.1));border-left:3px solid var(--accent,#f97316);padding:12px 14px;border-radius:0 8px 8px 0;line-height:1.5}
.back{background:transparent;color:var(--text-muted,#9ca3af);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;margin-top:10px}
.back:hover{color:var(--text,#111)}
</style></head><body>
<h2>Arc Troubleshooting</h2>
<div class="step active" id="q1">
  <p>Does the arc start at all?</p>
  <div class="btns">
    <button class="btn" onclick="go('q2')">Yes — arc starts</button>
    <button class="btn btn-no" onclick="go('q3')">No arc at all</button>
  </div>
</div>
<div class="step" id="q2">
  <p>Does the arc immediately go out?</p>
  <div class="btns">
    <button class="btn" onclick="go('r1')">Yes, dies quickly</button>
    <button class="btn btn-no" onclick="go('r2')">No, arc holds</button>
  </div>
  <button class="back" onclick="go('q1')">← Back</button>
</div>
<div class="step" id="q3">
  <div class="result">Check: power ON, correct outlet voltage (120V vs 240V), ground clamp firmly attached, output terminals clean.</div>
  <button class="back" onclick="go('q1')">← Start over</button>
</div>
<div class="step" id="r1">
  <div class="result">Wire speed too low or contact tip clogged. Increase WFS 10% and inspect drive rolls.</div>
  <button class="back" onclick="go('q2')">← Back</button>
</div>
<div class="step" id="r2">
  <div class="result">Arc is stable — check post-weld appearance. Verify gas flow rate and work angle.</div>
  <button class="back" onclick="go('q2')">← Back</button>
</div>
<script>function go(id){document.querySelectorAll('.step').forEach(e=>e.classList.remove('active'));document.getElementById(id).classList.add('active')}</script>
</body></html>
</antArtifact>

And for calculators — use onChange for LIVE updating (no submit button needed):
- Input fields with onInput/onChange that immediately recalculate
- Display result in a highlighted box that updates in real time
- Show the formula or logic below the result

Reuse the same identifier on follow-ups so the artifact updates in place.

## How to write responses
- Start with the direct answer or the first thing they need to do — don't warm up with "Great question!"
- Use numbered steps for procedures
- Bold the key action in each step so it's easy to scan
- Keep each step to 1-2 sentences max
- End with a short "you're good to go" or a heads-up about the most common mistake
- Always cite page number: (Owner's Manual, p. 12)
- If the manual doesn't cover it, say so honestly"""


# ══════════════════════════════════════════════════════════════════════════════
# ARTIFACT PARSING
# ══════════════════════════════════════════════════════════════════════════════

def parse_artifacts(text: str) -> list:
    """Extract ALL <antArtifact> blocks from Claude's text response."""
    matches = re.findall(
        r'<antArtifact\s+(.*?)>(.*?)</antArtifact>',
        text,
        re.DOTALL,
    )
    results = []
    for attrs_str, content in matches:
        attrs = {}
        for m in re.finditer(r'(\w+)=["\']([^"\']*)["\']', attrs_str):
            attrs[m.group(1)] = m.group(2)
        results.append({
            "identifier": attrs.get("identifier", ""),
            "type":       attrs.get("type", "text/html"),
            "title":      attrs.get("title", ""),
            "source":     attrs.get("source", ""),
            "page":       int(attrs["page"]) if attrs.get("page") else None,
            "content":    content.strip(),
        })
    return results


def strip_artifact_tags(text: str) -> str:
    """Remove <antArtifact> blocks and artifact reference lines from display text."""
    # Remove artifact blocks
    text = re.sub(r'<antArtifact\s[^>]*>.*?</antArtifact>', '', text, flags=re.DOTALL)
    # Remove standalone artifact reference lines Claude emits before/after tags
    # e.g. "→ Spatter Troubleshooter" or "**→ Duty Cycle Calculator**"
    text = re.sub(r'\n?\s*(?:\*{1,2})?→\s*\[?[^\n\]]{1,80}\]?(?:\([^)]*\))?\*{0,2}\s*\n?', '\n', text)
    # Collapse 2+ blank lines into one
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# AGENT LOOP
# ══════════════════════════════════════════════════════════════════════════════

def run_agent(
    user_message: str,
    session_id:   str,
    history:      list[dict] | None = None,
    on_event:     callable | None   = None,
) -> dict:
    """
    Run one turn of the Agentic RAG loop.

    Args:
        user_message : latest user message text
        session_id   : UUID identifying this session (from frontend)
        history      : prior turns in Anthropic message format
        on_event     : optional callback(event: dict) for streaming status to frontend
                       event shapes:
                         {"type": "thinking", "message": str}  ← agent step update
                         {"type": "answer",   "text": str,
                          "artifacts": list, "sources": list}  ← final result
                         {"type": "error",    "message": str}  ← something went wrong

    Returns:
        {
          "text":      str,        # clean answer (artifact tags stripped)
          "artifacts": list[dict], # all parsed artifacts Claude generated
          "sources":   list[dict], # all chunks retrieved this turn
        }
    """

    def emit(event_type: str, **kwargs):
        """Push an event to the SSE stream (no-op if no callback registered)."""
        if on_event:
            try:
                on_event({"type": event_type, **kwargs})
            except Exception as e:
                log.warning("on_event callback failed: %s", e)

    try:
        client = get_client()
    except RuntimeError as e:
        emit("error", message=str(e))
        raise

    try:
        memory = get_memory()
    except Exception as e:
        log.warning("Mem0 init failed — continuing without memory: %s", e)
        memory = None

    # ── 1. Load relevant past memory ─────────────────────────────────────────
    # Only search if: session has 2+ prior turns AND memory exists
    # Score threshold 0.6 — only inject facts that are actually relevant to this question
    MEMORY_MIN_SCORE  = 0.6
    MEMORY_MIN_TURNS  = 2   # need at least 1 full Q&A turn stored before searching

    memory_context = ""
    prior_turns    = len([m for m in (history or []) if m.get("role") == "user"])

    if prior_turns >= MEMORY_MIN_TURNS and memory:
        log.info("Searching memory for session %s (prior turns: %d)", session_id, prior_turns)
        emit("thinking", message="Recalling previous conversation...")
        try:
            past    = memory.search(user_message, user_id=session_id, limit=5)
            results = past.get("results", []) if past else []

            # Only keep facts above the relevance threshold
            relevant = [
                m["memory"] for m in results
                if m.get("score", 0) >= MEMORY_MIN_SCORE
            ]

            if relevant:
                memory_context = (
                    "\n\nRelevant context from earlier in this conversation:\n"
                    + "\n".join(f"- {f}" for f in relevant[:3])  # max 3 facts
                )
                log.info("Injected %d relevant memory facts (threshold %.1f).", len(relevant[:3]), MEMORY_MIN_SCORE)
            else:
                log.info("No memory facts above threshold %.1f — skipping injection.", MEMORY_MIN_SCORE)
        except Exception as e:
            log.warning("Memory search failed (non-fatal): %s", e)
    else:
        log.info("Skipping memory search (prior turns: %d, threshold: %d).", prior_turns, MEMORY_MIN_TURNS)

    # ── 2. Build system prompt with injected memory ───────────────────────────
    system = SYSTEM_PROMPT + memory_context

    # ── 3. Build message history ──────────────────────────────────────────────
    messages = list(history or [])
    messages.append({"role": "user", "content": user_message})

    # ── 4. Agentic RAG loop (Adaptive Routing + CRAG + Self-Verification) ─────
    # Extended thinking = Reason step | tool_use = Act step | tool_result = Observe step
    all_sources     = []
    tool_call_count = 0
    final_text      = ""
    search_count    = 0

    log.info("Starting agent loop for session %s", session_id)
    emit("thinking", message="Analyzing your question...")

    while True:
        try:
            response = client.messages.create(
                model      = CHAT_MODEL,
                max_tokens = 16000,
                thinking   = {"type": "adaptive"},
                tools      = TOOLS,
                system     = system,
                messages   = messages,
            )
        except Exception as e:
            log.error("Claude API call failed: %s", e)
            emit("error", message=f"Claude API error: {str(e)}")
            raise

        log.info("Stop reason: %s | Tool calls so far: %d", response.stop_reason, tool_call_count)

        # Done — extract final text block
        if response.stop_reason == "end_turn":
            emit("thinking", message="Preparing your answer...")
            for block in response.content:
                if hasattr(block, "text"):
                    final_text = block.text
                    break
            break

        # Unexpected stop
        if response.stop_reason != "tool_use":
            log.warning("Unexpected stop reason: %s", response.stop_reason)
            break

        # ── Execute tool calls ────────────────────────────────────────────────
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            tool_call_count += 1
            log.info("Tool call %d: %s(%s)", tool_call_count, block.name, block.input)

            if block.name == "search_manual":
                search_count += 1
                query = block.input["query"]
                emit("thinking", message=f"Searching the manual for '{query}'...")
                try:
                    result = search_manual(
                        query     = query,
                        n_results = block.input.get("n_results", TOP_K),
                    )
                    top_score = result[0]["score"] if result else 0
                    log.info("search_manual → %d chunks, top score: %.4f", len(result), top_score)
                    all_sources.extend(result)
                    emit("thinking", message=f"Found {len(result)} relevant sections (relevance: {int(top_score * 100)}%)")
                except Exception as e:
                    log.error("search_manual failed: %s", e)
                    emit("thinking", message="Search encountered an issue, retrying with different terms...")
                    result = []
                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result),
                })

            elif block.name == "get_page_image":
                source = block.input["source"]
                page   = block.input["page"]
                emit("thinking", message=f"Loading diagram from {source} p.{page}...")
                try:
                    result = get_page_image(source=source, page=page)
                    log.info("get_page_image → %s", result["image_url"])
                    if not result.get("exists"):
                        log.warning("Image file not found: %s", result["image_url"])
                except Exception as e:
                    log.error("get_page_image failed: %s", e)
                    result = {"error": str(e), "image_url": "", "exists": False}
                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result),
                })

        # Append assistant turn + tool results to history
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user",      "content": tool_results})

        # If we've hit the tool call cap, make one final call to get the answer
        if tool_call_count >= MAX_TOOL_CALLS:
            log.info("Tool call cap reached (%d). Making final answer call.", MAX_TOOL_CALLS)
            emit("thinking", message="Synthesizing everything I found...")
            try:
                final_response = client.messages.create(
                    model      = CHAT_MODEL,
                    max_tokens = 16000,
                    thinking   = {"type": "adaptive"},
                    tools      = TOOLS,
                    system     = system,
                    messages   = messages,
                )
                for block in final_response.content:
                    if hasattr(block, "text"):
                        final_text = block.text
                        break
            except Exception as e:
                log.error("Final answer call failed: %s", e)
                emit("error", message="Failed to generate final answer.")
            break

    artifacts = parse_artifacts(final_text)
    log.info("Agent loop done. Tool calls: %d | Artifacts: %d",
             tool_call_count, len(artifacts))

    # ── 5. Save Q&A to Mem0 ───────────────────────────────────────────────────
    if final_text and memory:
        try:
            clean_answer = strip_artifact_tags(final_text)
            memory.add(
                f"User asked: {user_message}\nAnswer: {clean_answer[:500]}",
                user_id=session_id,
            )
            log.info("Memory saved for session %s", session_id)
        except Exception as e:
            log.warning("Mem0 save failed (non-fatal): %s", e)

    # ── 6. Build result ───────────────────────────────────────────────────────
    result = {
        "text":      strip_artifact_tags(final_text),
        "artifacts": artifacts,
        "sources":   all_sources,
    }

    # Emit final answer event for SSE consumers
    emit("answer",
         text      = result["text"],
         artifacts = result["artifacts"],
         sources   = result["sources"])

    return result


# ══════════════════════════════════════════════════════════════════════════════
# CLI TEST
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    query      = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else \
                 "What is the duty cycle for MIG welding at 200A on 240V?"
    session_id = str(uuid.uuid4())

    print(f"\nQuery   : {query}")
    print(f"Session : {session_id}")
    print(f"{'─' * 60}\n")

    def on_event(event: dict):
        if event["type"] == "thinking":
            print(f"  ⟳  {event['message']}", flush=True)
        elif event["type"] == "error":
            print(f"  ✗  {event['message']}", flush=True)

    result = run_agent(query, session_id, on_event=on_event)

    print("── Answer ─────────────────────────────────────────────────")
    print(result["text"])

    for a in result["artifacts"]:
        print(f"\n── Artifact [{a['type']}] ── {a['title']}")
        preview = a["content"][:400]
        print(preview + ("..." if len(a["content"]) > 400 else ""))

    if result["sources"]:
        print(f"\n── Sources ({len(result['sources'])} chunks retrieved) ───────────")
        seen = set()
        for s in result["sources"]:
            key = f"{s['source']} p{s['page']}"
            if key not in seen:
                seen.add(key)
                print(f"  {s['source']} p{s['page']:03d} — {s['section']} (score: {s['score']})")
