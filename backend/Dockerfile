# Multi-stage Dockerfile for FastAPI Backend on Oracle VPS (ARM64 / x86_64 Multi-Arch)
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv fast package installer
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency specification files
COPY pyproject.toml README.md /app/

# Install production dependencies into virtual environment
RUN uv sync --frozen --no-cache || uv sync --no-cache

# Runtime stage
FROM python:3.12-slim AS runner

WORKDIR /app

# Create non-root system user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

# Copy virtual environment and application code from builder stage
COPY --from=builder /app/.venv /app/.venv
COPY app /app/app

# Set environment
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/liveness')" || exit 1

# Production Gunicorn worker process manager with Uvicorn async workers
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "-w", "4", "--timeout", "120"]
