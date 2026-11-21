"""
Thin HTTP wrapper (FastAPI). Run:  uvicorn core.api:app --port 8001

The core is stateless: the backend sends the full problem, gets the full answer.
For long time limits, put this behind a job queue (POST job -> poll result).
"""
from fastapi import FastAPI

from .backends import list_backends
from .schemas import SolveRequest, SolveResponse
from .service import solve_schedule

app = FastAPI(title="Scheduler Core", version="1.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/v1/engines")
def engines() -> dict:
    """Which solving engines exist on this server, whether they can run, and what they can do."""
    return list_backends()


@app.get("/v1/schema")
def schema() -> dict:
    return SolveRequest.model_json_schema()


@app.post("/v1/schedule/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:   # sync def -> runs in FastAPI's threadpool
    return solve_schedule(req)

