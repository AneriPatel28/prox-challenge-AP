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

CHAT_MODEL      = "claude-opus-4-6"
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

SYSTEM_PROMPT = """You are a precise technical assistant for the Vulcan OmniPro 220 multiprocess welder. You help welders set up, configure, and troubleshoot their machine using the official manuals.

## Step 1 — Classify the query (internally, before searching)
- FACTUAL    : single spec or fact ("what is the max OCV?")
               → 1-2 searches (second search if first chunk references a diagram or table)
               → direct answer, artifact only if a visual genuinely clarifies
- PROCEDURE  : step-by-step setup or connection question ("how do I set up TIG?", "how do I connect the spool gun?")
               → 2-3 searches, numbered steps, Mermaid or image artifact
- DIAGNOSIS  : ANY "something is wrong" question — weld defects, machine not working,
               unexpected behavior, overheating, arc instability, wire feed problems, etc.
               → 2-4 searches, find ALL possible causes, HTML flowchart artifact

## Step 2 — Search strategy (CRAG — Corrective Retrieval)
1. Always search before answering — never answer from memory alone
2. After each search, score relevance internally (1–10):
   - Score ≥ 7 → proceed
   - Score < 7 → reformulate with different terms and search again
3. If any chunk has content_type "diagram" → call get_page_image for that page
4. If specs conflict across chunks → prefer the more specific chunk

## Step 3 — Self-verify before writing your final answer
The retrieved chunks are the only source of truth. Check inside your thinking block:
- Do all numbers (amps, voltage, duty cycle, wire speed) match what the chunks say exactly?
- Is the polarity claim supported by a specific chunk — not assumed?
- Am I citing the correct source manual and page number from the chunk metadata?
- Am I answering what was actually asked, not a related but different question?
If a chunk contradicts your answer, trust the chunk and correct yourself.

## Artifact generation
Generate ONE artifact when it genuinely helps. Use exact tag format:

Mermaid — cable connections, polarity, setup sequences:
<antArtifact identifier="[kebab-id]" type="application/vnd.ant.mermaid" title="[title]">
graph LR or TD (choose direction that fits — LR for connections, TD for sequences)
  ...
</antArtifact>

HTML — calculators, configurators, troubleshooting flowcharts:
<antArtifact identifier="[kebab-id]" type="text/html" title="[title]">
<!DOCTYPE html>
<html>
<head><script src="https://cdn.tailwindcss.com"></script></head>
<body class="p-6 font-sans bg-gray-50">
  ... fully self-contained HTML + CSS + JS ...
</body>
</html>
</antArtifact>

Image — when the manual page itself is the answer:
<antArtifact identifier="[kebab-id]" type="image/jpeg" source="[source]" page="[page]">
</antArtifact>

When to generate each (use judgment — these are principles, not a keyword list):
- Mermaid    : ANY question where the answer involves physical connections, wire routing,
               what plugs into what, or a sequence of steps with decisions
- HTML calc  : ANY question with a numeric answer that varies by input
               (duty cycle, wire speed, heat input, material thickness → settings)
- HTML config: ANY "what settings should I use for X?" question →
               inputs (process, material, thickness, voltage) → outputs (amps, wire speed, gas)
- HTML flow  : ANY troubleshooting question with 3+ possible root causes
- Image      : ANY question asking to see something, or where a diagram page
               is the clearest answer ("show me", "what does X look like", "where is X")
- None       : pure single-value facts, yes/no safety rules, simple definitions

Reuse the same identifier if a follow-up updates the same artifact — UI updates in place.

## Style
- Direct and precise — welders want steps, not essays
- Always cite: source manual + page number
- If the manual doesn't cover it, say so — never guess
- For procedural answers, use numbered steps"""


# ══════════════════════════════════════════════════════════════════════════════
# ARTIFACT PARSING
# ══════════════════════════════════════════════════════════════════════════════

def parse_artifact(text: str) -> dict | None:
    """Extract first <antArtifact> block from Claude's text response."""
    match = re.search(
        r'<antArtifact\s+([^>]+)>(.*?)</antArtifact>',
        text,
        re.DOTALL,
    )
    if not match:
        return None

    attrs = {}
    for m in re.finditer(r'(\w+)=["\']([^"\']*)["\']', match.group(1)):
        attrs[m.group(1)] = m.group(2)

    return {
        "identifier": attrs.get("identifier", ""),
        "type":       attrs.get("type", "text/html"),
        "title":      attrs.get("title", ""),
        "source":     attrs.get("source", ""),
        "page":       int(attrs["page"]) if attrs.get("page") else None,
        "content":    match.group(2).strip(),
    }


def strip_artifact_tags(text: str) -> str:
    """Remove <antArtifact> blocks — clean text for chat display and memory storage."""
    return re.sub(
        r'<antArtifact\s[^>]*>.*?</antArtifact>',
        '',
        text,
        flags=re.DOTALL,
    ).strip()


# ══════════════════════════════════════════════════════════════════════════════
# AGENT LOOP
# ══════════════════════════════════════════════════════════════════════════════

def run_agent(
    user_message: str,
    session_id:   str,
    history:      list[dict] | None = None,
) -> dict:
    """
    Run one turn of the Agentic RAG loop.

    Args:
        user_message : latest user message text
        session_id   : UUID identifying this session (from frontend)
        history      : prior turns in Anthropic message format

    Returns:
        {
          "text":     str,          # clean answer (artifact tags stripped)
          "artifact": dict | None,  # parsed artifact if Claude generated one
          "sources":  list[dict],   # all chunks retrieved this turn
        }
    """
    client = get_client()
    memory = get_memory()   # always init — saving on turn 1 makes turn 2 useful

    # ── 1. Load relevant past memory (only for continuing conversations) ──────
    # Skip on turn 1 — nothing is stored yet, saves 1-2s on every first message
    memory_context = ""
    if history and memory:
        log.info("Loading memory for continuing session %s", session_id)
        past = memory.search(user_message, user_id=session_id, limit=3)
        if past and past.get("results"):
            facts = [m["memory"] for m in past["results"]]
            memory_context = (
                "\n\nRelevant context from this user's past conversations:\n"
                + "\n".join(f"- {f}" for f in facts)
            )
            log.info("Injected %d memory facts into prompt.", len(facts))
    else:
        log.info("First message in session — skipping memory search.")

    # ── 2. Build system prompt with injected memory ───────────────────────────
    system = SYSTEM_PROMPT + memory_context

    # ── 3. Build message history ──────────────────────────────────────────────
    messages = list(history or [])
    messages.append({"role": "user", "content": user_message})

    # ── 4. Agentic RAG loop (Adaptive Routing + CRAG + Self-Verification) ────────
    # Extended thinking = Reason step | tool_use = Act step | tool_result = Observe step
    all_sources     = []
    tool_call_count = 0
    final_text      = ""

    log.info("Starting agent loop for session %s", session_id)

    while tool_call_count < MAX_TOOL_CALLS:
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
            raise

        log.info("Stop reason: %s | Tool calls so far: %d", response.stop_reason, tool_call_count)

        # Done — extract final text block
        if response.stop_reason == "end_turn":
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
                try:
                    result = search_manual(
                        query     = block.input["query"],
                        n_results = block.input.get("n_results", TOP_K),
                    )
                    log.info("search_manual → %d chunks, top score: %.4f", len(result), result[0]["score"] if result else 0)
                    all_sources.extend(result)
                except Exception as e:
                    log.error("search_manual failed: %s", e)
                    result = []
                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result),
                })

            elif block.name == "get_page_image":
                try:
                    result = get_page_image(
                        source = block.input["source"],
                        page   = block.input["page"],
                    )
                    log.info("get_page_image → %s", result["image_url"])
                except Exception as e:
                    log.error("get_page_image failed: %s", e)
                    result = {"error": str(e)}
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
            break

    log.info("Agent loop done. Tool calls: %d | Artifact: %s",
             tool_call_count, "yes" if parse_artifact(final_text) else "no")

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

    # ── 6. Parse artifact and return ──────────────────────────────────────────
    return {
        "text":     strip_artifact_tags(final_text),
        "artifact": parse_artifact(final_text),
        "sources":  all_sources,
    }


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

    result = run_agent(query, session_id)

    print("── Answer ─────────────────────────────────────────────────")
    print(result["text"])

    if result["artifact"]:
        a = result["artifact"]
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
