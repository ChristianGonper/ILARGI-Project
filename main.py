"""Arranca el servidor web FastAPI de ILARGI con `uv run python main.py`."""

from ilargi.api import serve

if __name__ == "__main__":
    serve()
