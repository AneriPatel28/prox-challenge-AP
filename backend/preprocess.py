"""
preprocess.py — Step 1: Extract and save all page data to JSON.

What this does:
  1. Renders every PDF page to a JPEG
  2. Classifies each page: "vision" (has images) or "text" (pure text/tables)
  3. For vision pages  → sends JPEG to Claude Opus Vision → gets description
  4. For text pages    → extracts + cleans text with PyMuPDF + pdfplumber
  5. Saves everything to data/descriptions.json

What this does NOT do:
  - No embeddings
  - No ChromaDB
  - Just clean, readable JSON you can open and verify

Run:
  python preprocess.py

Output:
  data/images/          ← page JPEGs
  data/descriptions.json ← all extracted content, ready to review
"""

import os
import json
import base64
import re
from pathlib import Path

import fitz
import pdfplumber
import anthropic
from dotenv import load_dotenv
from tqdm import tqdm

# ─── Paths ────────────────────────────────────────────────────────────────────

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

ROOT        = Path(__file__).parent.parent
FILES_DIR   = ROOT / "files"
IMAGES_DIR  = ROOT / "data" / "images"
OUTPUT_FILE = ROOT / "data" / "descriptions.json"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
(ROOT / "data").mkdir(parents=True, exist_ok=True)

# ─── Config ───────────────────────────────────────────────────────────────────

VISION_MODEL     = "claude-opus-4-6"
MIN_TEXT_CHARS   = 100

PDFS = [
    ("owner-manual",      FILES_DIR / "owner-manual.pdf"),
    ("quick-start-guide", FILES_DIR / "quick-start-guide.pdf"),
    ("selection-chart",   FILES_DIR / "selection-chart.pdf"),
]


# ══════════════════════════════════════════════════════════════════════════════
# PAGE RENDERING
# ══════════════════════════════════════════════════════════════════════════════

def extract_figures_docling(source: str, pdf_path: Path) -> dict:
    """
    Use Docling ML layout detection to find and crop all figures from a PDF.
    Detects both raster images AND vector graphics (schematics, wiring diagrams).
    PyMuPDF's get_images() only finds raster — this catches everything.

    Returns {page_num (1-based): ["/images/...", ...]} for every page that has figures.
    Run once during preprocessing — output saved to disk, no runtime dependency on Docling.
    """
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling_core.types.doc import PictureItem

    print(f"\n  Docling: processing {pdf_path.name}...", flush=True)

    # generate_picture_images=True is required — without it Docling detects layout
    # but doesn't export pixel data, giving 0 figures
    pipeline_options = PdfPipelineOptions()
    pipeline_options.images_scale = 2.0
    pipeline_options.generate_picture_images = True

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    result = converter.convert(str(pdf_path))

    page_figures: dict[int, list[str]] = {}
    fig_counters: dict[int, int]       = {}

    for pic in result.document.pictures:
        if not pic.prov:
            continue

        page_num = pic.prov[0].page_no  # 1-based

        try:
            pil_img = pic.get_image(result.document)
            if pil_img is None:
                continue
            w, h = pil_img.size
            # Filter junk: icons, arrows, separators, decorative elements
            if w < 150 or h < 150:
                continue  # too small — icons, bullets
            if max(w, h) / min(w, h) > 5:
                continue  # too elongated — arrows, divider lines
            if w * h < 30_000:
                continue  # too little content area

            # Add padding so surrounding labels and captions aren't clipped
            from PIL import ImageOps
            pil_img = ImageOps.expand(pil_img.convert("RGB"), border=30, fill="white")

            fig_counters[page_num] = fig_counters.get(page_num, 0) + 1
            fig_idx  = fig_counters[page_num]
            fig_name = f"{source}-p{page_num:03d}-fig{fig_idx:02d}.jpg"
            fig_path = IMAGES_DIR / fig_name
            pil_img.save(str(fig_path), "JPEG", quality=90)

            page_figures.setdefault(page_num, []).append(f"/images/{fig_name}")
            print(f"    p{page_num:03d} fig{fig_idx:02d}: {w}×{h}px → {fig_name}")
        except Exception as e:
            print(f"    WARNING: figure on p{page_num} failed: {e}")

    total = sum(len(v) for v in page_figures.values())
    print(f"  Docling: {total} figures extracted across {len(page_figures)} pages\n", flush=True)
    return page_figures


def render_page_to_jpeg(page: fitz.Page, source: str, page_num: int) -> Path:
    img_path = IMAGES_DIR / f"{source}-p{page_num:03d}.jpg"
    if not img_path.exists():
        matrix = fitz.Matrix(1.5, 1.5)
        pixmap = page.get_pixmap(matrix=matrix)
        pixmap.save(str(img_path))
    return img_path


# ══════════════════════════════════════════════════════════════════════════════
# PAGE CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════════════

def classify_page(page: fitz.Page, pdf_path: Path, page_num: int) -> str:
    """
    Returns "vision" or "text" based on actual block structure.

    "vision" → has embedded images, vector drawings, almost no text, OR has tables
               (tables sent to Claude Vision so merged/spanned cells are understood)
    "text"   → pure paragraph text only
    """
    blocks     = page.get_text("dict")["blocks"]
    img_blocks = [b for b in blocks if b["type"] == 1]
    text_chars = sum(
        len(span["text"].strip())
        for b in blocks if b["type"] == 0
        for line in b.get("lines", [])
        for span in line.get("spans", [])
    )

    if len(img_blocks) > 0:
        return "vision"
    if text_chars < MIN_TEXT_CHARS:
        return "vision"
    if len(page.get_drawings()) > 100:
        return "vision"

    # Tables → vision: Claude understands merged/spanned cells; pdfplumber flattens them
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            if pdf.pages[page_num - 1].extract_tables():
                return "vision"
    except Exception:
        pass

    return "text"


# ══════════════════════════════════════════════════════════════════════════════
# CLAUDE VISION
# ══════════════════════════════════════════════════════════════════════════════

def describe_image_page(
    client: anthropic.Anthropic,
    img_path: Path,
    source: str,
    page_num: int,
) -> str:
    with open(img_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    prompt = f"""You are analyzing page {page_num} from the Vulcan OmniPro 220 multiprocess welder manual ({source}).

Describe everything on this page in precise technical detail. Your description will be used to answer questions from users who are setting up or troubleshooting this welder.

Focus on:
- If it shows cable/socket connections: name every socket, which cable goes where, polarity (DCEN/DCEP), +/– labels
- If it shows a table: extract ALL rows and columns with their exact values (amps, volts, duty cycle %, wire speed)
- If it shows a step-by-step diagram: describe each numbered step and what action is being performed
- If it shows a weld quality photo: describe what defect or good weld is shown and its visual characteristics
- If it shows a parts diagram: list every labeled component and its location
- If it shows a process selection chart: describe what process is recommended for what material/thickness/skill level

Include all numbers, measurements, labels, and technical terms visible on the page.
Be specific — a welder in their garage needs to follow these instructions exactly."""

    response = client.messages.create(
        model=VISION_MODEL,
        max_tokens=8192,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": image_data,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return response.content[0].text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# TEXT EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

def extract_tables_from_page(pdf_path: Path, page_num: int) -> str:
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            page   = pdf.pages[page_num - 1]
            tables = page.extract_tables()
            if not tables:
                return ""
            rows = []
            for table in tables:
                for row in table:
                    clean_row = [str(cell).strip() for cell in row if cell]
                    if clean_row:
                        rows.append(" | ".join(clean_row))
            return "\n".join(rows)
    except Exception:
        return ""


def clean_text(text: str) -> str:
    text = re.sub(r"For technical questions.*?\d{3}-\d{3}-\d{4}\.", "", text)
    text = re.sub(r"Item\s+\d+", "", text)
    text = re.sub(r"Page\s+\d+", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    # Strip sidebar navigation labels (plain text or markdown-formatted)
    text = re.sub(
        r'^#{0,6}\s*(?:Safety|Welding Tips|MAINTENANCE|TIG\s*/\s*Stick|CONTROLS|Wire)\s*\n',
        '', text, flags=re.MULTILINE
    )
    return text.strip()




def dict_to_markdown(page: fitz.Page) -> str:
    """
    Convert PyMuPDF get_text("dict") to markdown using font sizes.
    - Largest font size on page → ## heading
    - If no distinct heading font size → bold short lines treated as headings
    - Bold spans → **text**
    - Bullet • → - list item
    """
    blocks = page.get_text("dict")["blocks"]

    all_sizes = [
        span["size"]
        for b in blocks if b["type"] == 0
        for line in b["lines"]
        for span in line["spans"]
        if span["text"].strip()
    ]
    if not all_sizes:
        return page.get_text("text").strip()

    sizes       = sorted(set(all_sizes))
    heading_min = sizes[-1] if len(sizes) > 1 else None  # None = use bold fallback

    lines_out = []
    for b in blocks:
        if b["type"] != 0:
            continue
        for line in b["lines"]:
            parts      = []
            is_heading = False
            all_bold   = True

            for span in line["spans"]:
                txt = span["text"]
                if not txt.strip():
                    continue

                if heading_min and span["size"] >= heading_min:
                    is_heading = True

                is_bold = bool(span["flags"] & 4)
                if not is_bold:
                    all_bold = False

                # Ensure space between spans if needed
                if parts and not parts[-1].endswith(" ") and not txt.startswith(" "):
                    parts.append(" ")

                if is_bold and not is_heading:
                    txt = f"**{txt.strip()}**"
                parts.append(txt)

            if not parts:
                continue

            combined = "".join(parts).strip()
            if not combined:
                continue

            # Fallback: bold-only short line = heading when no font size distinction
            if not is_heading and all_bold and heading_min is None and len(combined) < 60:
                is_heading = True

            if is_heading:
                lines_out.append(f"\n## {combined}\n")
            elif combined.startswith("•"):
                lines_out.append(f"- {combined.lstrip('• ').strip()}")
            else:
                lines_out.append(combined)

    return "\n".join(lines_out).strip()


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def process_pdf(
    source: str,
    pdf_path: Path,
    client: anthropic.Anthropic,
) -> list[dict]:
    # Run Docling once for the whole PDF to get all figure crops
    all_figures = extract_figures_docling(source, pdf_path)  # {page_num: [urls]}

    doc   = fitz.open(str(pdf_path))
    pages = []

    with tqdm(total=len(doc), desc=f"  {source}", unit="page", ncols=80) as pbar:
        for page_idx in range(len(doc)):
            page_num  = page_idx + 1
            page      = doc[page_idx]

            # Render full-page JPEG (PyMuPDF — unchanged)
            img_path  = render_page_to_jpeg(page, source, page_num)
            image_url = f"/images/{source}-p{page_num:03d}.jpg"

            page_type = classify_page(page, pdf_path, page_num)

            if page_type == "vision":
                pbar.set_postfix({"page": page_num, "type": "vision"})
                description  = describe_image_page(client, img_path, source, page_num)
                content_type = "diagram"
                text         = description
                raw_text     = page.get_text("text").strip()

            else:
                pbar.set_postfix({"page": page_num, "type": "text"})
                raw_text     = page.get_text("text").strip()
                md           = dict_to_markdown(page)
                text         = md if "## " in md else clean_text(raw_text)
                content_type = "text"

            pages.append({
                "source":       source,
                "page":         page_num,
                "content_type": content_type,
                "image_url":    image_url,
                "figure_urls":  all_figures.get(page_num, []),
                "raw_text":     raw_text,
                "text":         text,
            })

            pbar.update(1)

    doc.close()
    return pages


def process_text_pages_only():
    """
    Re-extract only text/table pages using PyMuPDF markdown output.
    Loads existing descriptions.json, updates text pages in-place, saves back.
    No Claude API calls — safe to run anytime.

    Run:
      python preprocess.py --text-only
    """
    if not OUTPUT_FILE.exists():
        print("ERROR: descriptions.json not found. Run full preprocess first.")
        return

    pages = json.loads(OUTPUT_FILE.read_text())
    pdf_map = {source: pdf_path for source, pdf_path in PDFS if pdf_path.exists()}
    docs    = {source: fitz.open(str(pdf_path)) for source, pdf_path in pdf_map.items()}

    updated = 0
    for entry in pages:
        if entry["content_type"] != "text":
            continue

        source = entry["source"]
        doc    = docs.get(source)
        if doc is None:
            continue

        # pymupdf4llm.to_markdown uses 0-based page index via pages=[...]
        page              = doc[entry["page"] - 1]
        raw               = page.get_text("text").strip()
        md                = dict_to_markdown(page)
        entry["raw_text"] = raw
        entry["text"]     = md if "## " in md else clean_text(raw)

        updated += 1
        print(f"  p{entry['page']} ({source}) — updated")
        preview = entry["text"][:150].replace("\n", "↵")
        print(f"    {preview}\n")

    for doc in docs.values():
        doc.close()

    OUTPUT_FILE.write_text(json.dumps(pages, indent=2, ensure_ascii=False))
    print(f"Done. Updated {updated} pages → {OUTPUT_FILE}")


def main():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in .env")

    print(f"\n{'═'*60}", flush=True)
    print(f"  STEP 1 — Extract page data to JSON", flush=True)
    print(f"  Vision model: {VISION_MODEL}", flush=True)
    print(f"  Output: {OUTPUT_FILE}", flush=True)
    print(f"{'═'*60}\n", flush=True)

    print("  [1/2] Initializing Anthropic client...", flush=True)
    client = anthropic.Anthropic(api_key=api_key)
    print("        ✓ Done\n", flush=True)

    print("  [2/2] Processing PDFs...\n", flush=True)

    all_pages = []
    for source, pdf_path in PDFS:
        if not pdf_path.exists():
            print(f"  WARNING: {pdf_path} not found, skipping.", flush=True)
            continue
        pages = process_pdf(source, pdf_path, client)
        all_pages.extend(pages)

    # Save to JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_pages, f, indent=2, ensure_ascii=False)

    vision_count = sum(1 for p in all_pages if p["content_type"] == "diagram")
    text_count   = len(all_pages) - vision_count

    print(f"\n{'═'*60}", flush=True)
    print(f"  DONE", flush=True)
    print(f"  Total pages : {len(all_pages)}", flush=True)
    print(f"  Vision pages: {vision_count}  (Claude Opus described these)", flush=True)
    print(f"  Text pages  : {text_count}   (PyMuPDF extracted these)", flush=True)
    print(f"  Saved to    : {OUTPUT_FILE}", flush=True)
    print(f"\n  Open data/descriptions.json and verify before next step.", flush=True)
    print(f"{'═'*60}\n", flush=True)


def process_table_pages_only():
    """
    Re-process only content_type=="table" pages through Claude Vision.
    Loads existing descriptions.json, updates table entries in-place, saves back.
    All other pages (diagram, text) are untouched.

    Run:
      python preprocess.py --tables-only
    """
    if not OUTPUT_FILE.exists():
        print("ERROR: descriptions.json not found. Run full preprocess first.")
        return

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in .env")

    client = anthropic.Anthropic(api_key=api_key)
    pages  = json.loads(OUTPUT_FILE.read_text())

    updated = 0
    for entry in pages:
        if entry["content_type"] != "table":
            continue

        source   = entry["source"]
        page_num = entry["page"]
        img_path = IMAGES_DIR / f"{source}-p{page_num:03d}.jpg"

        if not img_path.exists():
            print(f"  SKIP p{page_num} — JPEG not found, run full preprocess first")
            continue

        print(f"  p{page_num} ({source}) — sending to Claude Vision...")
        description      = describe_image_page(client, img_path, source, page_num)
        entry["text"]    = description
        entry["content_type"] = "diagram"   # now handled by vision, same as other diagram pages
        updated += 1
        print(f"    ✓ Done ({len(description)} chars)\n")

    OUTPUT_FILE.write_text(json.dumps(pages, indent=2, ensure_ascii=False))
    print(f"Done. Updated {updated} table pages → {OUTPUT_FILE}")


def process_figures_only():
    """
    Extract figure crops using Docling ML layout detection. No Opus calls.
    Detects raster images AND vector graphics (schematics, wiring diagrams).
    Loads existing descriptions.json, updates figure_urls in-place, saves back.

    Run:
      python preprocess.py --figures-only
    """
    if not OUTPUT_FILE.exists():
        print("ERROR: descriptions.json not found. Run full preprocess first.")
        return

    pages   = json.loads(OUTPUT_FILE.read_text())
    pdf_map = {source: pdf_path for source, pdf_path in PDFS if pdf_path.exists()}

    # Run Docling once per PDF — collects all figures across all pages
    all_figures_by_source = {}
    for source, pdf_path in pdf_map.items():
        all_figures_by_source[source] = extract_figures_docling(source, pdf_path)

    # Update each page entry with figure_urls + ensure image_url is always set
    updated = 0
    for entry in pages:
        source   = entry["source"]
        page_num = entry["page"]

        # Always ensure full page image URL is present
        entry["image_url"] = f"/images/{source}-p{page_num:03d}.jpg"

        figs = all_figures_by_source.get(source, {}).get(page_num, [])
        entry["figure_urls"] = figs
        if figs:
            updated += 1

    OUTPUT_FILE.write_text(json.dumps(pages, indent=2, ensure_ascii=False))
    print(f"\nDone. {updated} pages updated with figure crops → {OUTPUT_FILE}")


if __name__ == "__main__":
    import sys
    if "--text-only" in sys.argv:
        process_text_pages_only()
    elif "--tables-only" in sys.argv:
        process_table_pages_only()
    elif "--figures-only" in sys.argv:
        process_figures_only()
    else:
        main()
