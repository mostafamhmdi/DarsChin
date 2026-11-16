"""
The ONE interface every solving engine implements (Strategy pattern).

    SchedulerBackend.solve(problem) -> SolveOutcome

Contract
--------
* Input  : the immutable, engine-neutral `Problem` (see preprocess.py).
* Output : `SolveOutcome.picks` = [(session_idx, placement_idx)], where placement_idx indexes
           `problem.placements[session_idx]`. Engines never invent their own result format.
* Engines are STATELESS between calls and never talk to each other.
* Hard-rule correctness is NOT trusted to an engine: the service re-verifies every result with
  `evaluation.verify`, and recomputes the objective with `scoring.score`.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import ClassVar

from ..preprocess import Problem


@dataclass(frozen=True)
class Capabilities:
    proves_optimality: bool          # can return OPTIMAL (with a proof), not only FEASIBLE
    explains_infeasibility: bool     # can name the constraint groups that clash
    reports_bound: bool              # returns a meaningful best_bound


@dataclass
class SolveOutcome:
    status: str = "UNKNOWN"          # OPTIMAL | FEASIBLE | INFEASIBLE | UNKNOWN
    objective: float | None = None   # engine-reported (cross-checked against scoring.score)
    best_bound: float | None = None
    wall_time: float = 0.0
    picks: list[tuple[int, int]] = field(default_factory=list)
    infeasibility_core: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)      # engine specific (nodes, iterations, ...)


class SchedulerBackend(ABC):
    name: ClassVar[str]
    capabilities: ClassVar[Capabilities]

    @classmethod
    def is_available(cls) -> bool:
        """Override to check optional dependencies. Must NOT raise."""
        return True

    @abstractmethod
    def _solve(self, problem: Problem) -> SolveOutcome: ...

    def solve(self, problem: Problem) -> SolveOutcome:
        """Template method: timing + invariants common to all engines."""
        t0 = time.perf_counter()
        out = self._solve(problem)
        out.wall_time = out.wall_time or (time.perf_counter() - t0)
        if out.status in ("OPTIMAL", "FEASIBLE") and len(out.picks) != len(problem.sessions):
            raise RuntimeError(f"engine '{self.name}' returned an incomplete assignment")
        return out
