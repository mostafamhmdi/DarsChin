"""
MILP model context (OR-Tools linear_solver: SCIP / CBC / HiGHS).

Same decision variable as the other engines, x[s,i] in {0,1}, but EVERYTHING else must be linear:
    OR(lits)  is linearised as   u >= lit (for each lit)           [lower-bound form]
                       and       u <= sum(lits)                    [adds the exactness]
The lower-bound form is enough when u only appears with a POSITIVE objective coefficient
(minimisation pushes it down); the exact form is required when u appears with a negative sign
inside a constraint (occupancy inside the hole constraint).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from ortools.linear_solver import pywraplp

from ...preprocess import Problem

SOLVER_PREFERENCE = ("SCIP", "CBC", "HiGHS")


def create_solver(preferred: str | None = None):
    names = ([preferred] if preferred else []) + [n for n in SOLVER_PREFERENCE if n != preferred]
    for n in names:
        s = pywraplp.Solver.CreateSolver(n)
        if s is not None:
            return s, n
    return None, None


class MilpContext:
    def __init__(self, problem: Problem, solver: pywraplp.Solver):
        self.problem = problem
        self.cfg = problem.config
        self.solver = solver
        self.x: dict[tuple[int, int], Any] = {}
        self.cover: dict[int, dict[int, list]] = defaultdict(lambda: defaultdict(list))
        self.obj: dict[Any, float] = defaultdict(float)     # var -> coefficient (aggregated)
        self._n = 0

        for s in problem.sessions:
            for i, pl in enumerate(problem.placements[s.idx]):
                v = solver.BoolVar(f"x_{s.idx}_{i}")
                self.x[(s.idx, i)] = v
                for t in pl.slot_idxs:
                    self.cover[s.idx][t].append(v)

    # -------------------------------------------------------------- helpers
    def new_bool(self, prefix: str):
        self._n += 1
        return self.solver.BoolVar(f"{prefix}_{self._n}")

    def lits_at_slot(self, sessions: list[int], slot: int) -> list:
        return [v for s in sessions for v in self.cover[s].get(slot, ())]

    def lits_on_day(self, sessions: list[int], day: int) -> list:
        return [self.x[(s, i)] for s in sessions
                for i, pl in enumerate(self.problem.placements[s]) if pl.day == day]

    def or_lower(self, lits: list, prefix: str):
        """u >= every lit. None if lits is empty (constant 0)."""
        if not lits:
            return None
        if len(lits) == 1:
            return lits[0]
        u = self.new_bool(prefix)
        for l in lits:
            self.solver.Add(u >= l)
        return u

    def or_exact(self, lits: list, prefix: str):
        """u == OR(lits)."""
        u = self.or_lower(lits, prefix)
        if u is not None and len(lits) > 1:
            self.solver.Add(u <= self.solver.Sum(lits))
        return u

    def penalty(self, coef: float, var) -> None:
        if coef > 0 and var is not None:
            self.obj[var] += coef
