FROM ghcr.io/astral-sh/uv:0.9.20 AS uv
FROM python:3.13-slim AS build
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_LINK_MODE=copy
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
COPY ilargi ./ilargi
RUN uv run --no-sync python -m ilargi.kernels

FROM python:3.13-slim
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    ILARGI_KERNEL_DIR=/app/data/kernels ILARGI_TERRAIN_DIR=/app/data/terrain \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 GDAL_CACHEMAX=128
COPY --from=build /app/.venv ./.venv
COPY --from=build /app/data/kernels ./data/kernels
COPY ilargi ./ilargi
COPY data/materials ./data/materials
COPY data/terrain/*.tif data/terrain/*.vrt ./data/terrain/
RUN useradd --uid 10001 --create-home ilargi
USER 10001
EXPOSE 8080
CMD ["sh", "-c", "exec python -m uvicorn ilargi.api:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
