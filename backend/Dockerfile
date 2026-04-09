FROM python:3.11-slim

WORKDIR /app

# System deps for sentence-transformers / chromadb
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch + pin transformers to a stable version (avoids nn.Module NameError in transformers 4.50+)
RUN pip install --no-cache-dir \
    "torch==2.4.1" --index-url https://download.pytorch.org/whl/cpu

# Install remaining runtime deps — sentence-transformers 2.7.0 uses stable transformers<4.50
COPY requirements.txt .
RUN pip install --no-cache-dir \
    anthropic \
    "sentence-transformers==2.7.0" \
    chromadb \
    fastapi \
    uvicorn \
    python-multipart \
    python-dotenv \
    pillow \
    tqdm \
    mem0ai \
    langchain-text-splitters

# Copy source
COPY backend/ ./backend/
COPY data/     ./data/
COPY files/    ./files/

# Pre-download embedding model into the image — avoids HuggingFace rate limits at runtime
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('Snowflake/snowflake-arctic-embed-m')"

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
