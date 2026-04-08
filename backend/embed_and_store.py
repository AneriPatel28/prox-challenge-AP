"""
embed_and_store.py — Step 2: Chunk, embed, and store in ChromaDB.

What this does:
  1. Reads data/descriptions.json (output of preprocess.py)
  2. Chunks each page using LangChain markdown-aware splitting
  3. Saves chunks to data/chunks.json  ← inspect before embedding
  4. Loads Snowflake Arctic Embed M (local, 440MB)
  5. Embeds each chunk
  6. Stores in ChromaDB (persistent, on disk)

Chunking strategy:
  - Split at ## headings (MarkdownHeaderTextSplitter)
  - If any section > MAX_TOKENS → RecursiveCharacterTextSplitter
  - Heading always kept in chunk text for embedding context

Run:
  python embed_and_store.py

Outputs:
  data/chunks.json   ← inspect chunks here first
  data/chroma/       ← ChromaDB vector store
"""

import json
from pathlib import Path

import chromadb
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT          = Path(__file__).parent.parent
INPUT_FILE    = ROOT / "data" / "descriptions.json"
CHUNKS_FILE   = ROOT / "data" / "chunks.json"
CHROMA_DIR    = ROOT / "data" / "chroma"

CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# ─── Config ───────────────────────────────────────────────────────────────────

EMBED_MODEL     = "Snowflake/snowflake-arctic-embed-m"
QUERY_PREFIX    = "Represent this sentence for searching relevant passages: "
COLLECTION_NAME = "manual_pages"
MAX_TOKENS       = 400   # lowered to leave room for overlap without exceeding Arctic-m's 512 limit
MIN_CHUNK_TOKENS = 15    # skip truly empty fragments only
OVERLAP_TOKENS   = 50    # ~50 token overlap between splits for context continuity


# ─── LangChain splitters ──────────────────────────────────────────────────────

# Step 1: split at markdown headings
md_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[("#", "h1"), ("##", "section"), ("###", "subsection")],
    strip_headers=False,   # keep heading in chunk text → embedding has context
)

# Step 2: recursively split oversized sections
char_splitter = RecursiveCharacterTextSplitter(
    chunk_size=MAX_TOKENS * 4,     # chars (1 token ≈ 4 chars) → 1600 chars ≈ 400 tokens
    chunk_overlap=OVERLAP_TOKENS * 4,  # 200 chars ≈ 50 tokens overlap
    separators=["\n\n", "\n", ". ", " "],
)


# ══════════════════════════════════════════════════════════════════════════════
# CHUNKING
# ══════════════════════════════════════════════════════════════════════════════

def token_count(text: str) -> int:
    return len(text) // 4


def chunk_page(text: str) -> list[str]:
    """
    1. MarkdownHeaderTextSplitter splits at ## headings
    2. Any section still > MAX_TOKENS gets recursively split
    3. Returns list of plain strings (heading kept in text)
    """
    docs  = md_splitter.split_text(text)
    final = char_splitter.split_documents(docs)
    return [d.page_content.strip() for d in final if d.page_content.strip()]


def smart_chunk(page: dict) -> list[dict]:
    """Chunk a page and return list of chunk dicts with metadata."""
    raw_chunks = chunk_page(page["text"])
    result     = []
    idx        = 0

    for chunk in raw_chunks:
        if token_count(chunk) < MIN_CHUNK_TOKENS:
            continue


        # Extract section name from first heading line
        first_line   = chunk.split("\n")[0].strip()
        section_name = (
            first_line.lstrip("#").strip()
            if first_line.startswith("#")
            else f"p{page['page']}-section_{idx}"
        )

        result.append({
            "chunk_id":     f"{page['source']}-p{page['page']:03d}-c{idx:02d}",
            "source":       page["source"],
            "page":         page["page"],
            "section":      section_name,
            "chunk_index":  idx,
            "content_type": page["content_type"],
            "image_url":    page["image_url"],
            "figure_urls":  json.dumps(page.get("figure_urls", [])),  # stored as JSON string — ChromaDB doesn't support arrays
            "tokens":       token_count(chunk),
            "text":         chunk,
        })
        idx += 1

    return result


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{'═'*60}", flush=True)
    print(f"  STEP 2 — Chunk, Embed, and Store in ChromaDB", flush=True)
    print(f"  Input : {INPUT_FILE}", flush=True)
    print(f"  Output: {CHROMA_DIR}", flush=True)
    print(f"{'═'*60}\n", flush=True)

    # ── 1. Load descriptions.json ─────────────────────────────────────────────
    print("  [1/5] Loading descriptions.json...", flush=True)
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"{INPUT_FILE} not found. Run preprocess.py first.")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        pages = json.load(f)
    print(f"        ✓ {len(pages)} pages loaded\n", flush=True)

    # ── 2. Chunk all pages ────────────────────────────────────────────────────
    print("  [2/5] Chunking pages...", flush=True)

    all_chunks = []
    for page in pages:
        all_chunks.extend(smart_chunk(page))

    with open(CHUNKS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, indent=2, ensure_ascii=False)

    # Stats
    sources = {}
    for c in all_chunks:
        sources.setdefault(c["source"], []).append(c)

    print(f"\n        Chunk breakdown:")
    print(f"        {'Source':<25} {'Pages':>6}  {'Chunks':>7}  {'Avg tokens':>10}")
    print(f"        {'─'*55}")
    for src, chunks in sources.items():
        pages_in_src = len(set(c["page"] for c in chunks))
        avg_tokens   = sum(c["tokens"] for c in chunks) // len(chunks)
        print(f"        {src:<25} {pages_in_src:>6}  {len(chunks):>7}  {avg_tokens:>10}")
    print(f"        {'─'*55}")
    print(f"        {'TOTAL':<25} {len(pages):>6}  {len(all_chunks):>7}")
    print(f"\n        ✓ Saved to data/chunks.json — inspect before continuing\n", flush=True)

    # ── 3. Sample preview ─────────────────────────────────────────────────────
    print("  [3/5] Sample chunks preview:\n", flush=True)
    for i in [0, len(all_chunks)//4, len(all_chunks)//2, -1]:
        c       = all_chunks[i]
        preview = c["text"][:200].replace("\n", " ")
        print(f"        [{c['chunk_id']}]")
        print(f"        section : {c['section']}")
        print(f"        tokens  : {c['tokens']}")
        print(f"        preview : {preview}...")
        print(f"        {'─'*55}", flush=True)

    print(f"\n  Open data/chunks.json to verify chunks look correct.", flush=True)
    response = input("\n  Continue to embed and store? (y/n): ").strip().lower()
    if response != "y":
        print("\n  Stopped. Fix issues in preprocess.py and re-run.\n", flush=True)
        return

    # ── 4. Load embedding model ───────────────────────────────────────────────
    print(f"\n  [4/5] Loading embedding model ({EMBED_MODEL})...", flush=True)
    model = SentenceTransformer(EMBED_MODEL)
    print(f"        ✓ Model loaded\n", flush=True)

    # ── 5. Embed and store ────────────────────────────────────────────────────
    print(f"  [5/5] Embedding and storing in ChromaDB...\n", flush=True)

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"        ↻ Existing collection cleared\n", flush=True)
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    texts     = [c["text"]     for c in all_chunks]
    ids       = [c["chunk_id"] for c in all_chunks]
    metadatas = [
        {
            "source":       c["source"],
            "page":         c["page"],
            "section":      c["section"],
            "chunk_index":  c["chunk_index"],
            "content_type": c["content_type"],
            "image_url":    c["image_url"],
            "figure_urls":  c["figure_urls"],
        }
        for c in all_chunks
    ]

    BATCH_SIZE     = 8
    all_embeddings = []

    with tqdm(total=len(texts), desc="  Embedding", unit="chunk", ncols=80) as pbar:
        for i in range(0, len(texts), BATCH_SIZE):
            batch      = texts[i : i + BATCH_SIZE]
            embeddings = model.encode(
                batch,
                show_progress_bar=False,
                normalize_embeddings=True,
            ).tolist()
            all_embeddings.extend(embeddings)
            pbar.update(len(batch))

    collection.add(
        ids        = ids,
        embeddings = all_embeddings,
        documents  = texts,
        metadatas  = metadatas,
    )

    print(f"\n{'═'*60}", flush=True)
    print(f"  DONE", flush=True)
    print(f"  Pages    : {len(pages)}", flush=True)
    print(f"  Chunks   : {len(all_chunks)}", flush=True)
    print(f"  ChromaDB : {CHROMA_DIR}", flush=True)
    print(f"\n  Query prefix for agent.py:", flush=True)
    print(f'  "{QUERY_PREFIX}"', flush=True)
    print(f"{'═'*60}\n", flush=True)


if __name__ == "__main__":
    main()
