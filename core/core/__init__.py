"""Scheduler Core: CP-SAT based weekly course timetabling engine."""
from .schemas import SolveRequest, SolveResponse
from .service import solve_schedule

__all__ = ["SolveRequest", "SolveResponse", "solve_schedule"]
