"""
Layer 2 - Model construction.

`ModelContext` owns the CpModel and the decision variables and exposes a few
cached helper expressions (occupancy, day-used). Constraint / objective plugins
only talk to the context - never to each other.

Decision variables
    x[s, i] in {0,1}  : session s uses its i-th legal placement
Everything else (teacher occupancy, day used, gap indicators ...) is derived.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from ortools.sat.python import cp_model

from ...preprocess import Problem
from .plugins import CONSTRAINTS, OBJECTIVES


@dataclass
class PenaltyTerm:
    name: str
    coef: int
    var: Any


class ModelContext:
    def __init__(self, problem: Problem, diagnostics: bool = False):
        self.problem = problem
        self.cfg = problem.config
        self.model = cp_model.CpModel()
        self.diagnostics = diagnostics          # True -> hard groups get assumption literals

        self.x: dict[tuple[int, int], cp_model.IntVar] = {}
        # session -> slot -> literals that cover that slot
        self.cover: dict[int, dict[int, list]] = defaultdict(lambda: defaultdict(list))
        self.penalties: list[PenaltyTerm] = []
        self.guards: dict[str, cp_model.IntVar] = {}
        self._occ: dict[tuple[int, int], Any] = {}
        self._day_used: dict[tuple[int, int], Any] = {}
        self._create_variables()

    # ------------------------------------------------------------------ vars
    def _create_variables(self) -> None:
        for s in self.problem.sessions:
            for i, pl in enumerate(self.problem.placements[s.idx]):
                v = self.model.NewBoolVar(f"x_s{s.idx}_p{i}")
                self.x[(s.idx, i)] = v
                for t in pl.slot_idxs:
                    self.cover[s.idx][t].append(v)

    # --------------------------------------------------------------- helpers
    def lits_at_slot(self, session_idxs: list[int], slot_idx: int) -> list:
        out: list = []
        for s in session_idxs:
            out.extend(self.cover[s].get(slot_idx, ()))
        return out

    def lits_on_day(self, session_idxs: list[int], day: int) -> list:
        out = []
        for s in session_idxs:
            for i, pl in enumerate(self.problem.placements[s]):
                if pl.day == day:
                    out.append(self.x[(s, i)])
        return out

    def _or(self, lits: list, name: str):
        """Return a literal equal to OR(lits); None if lits is empty (constant 0)."""
        if not lits:
            return None
        if len(lits) == 1:
            return lits[0]
        v = self.model.NewBoolVar(name)
        self.model.AddMaxEquality(v, lits)
        return v

    def teacher_slot_occ(self, t_idx: int, slot_idx: int):
        key = (t_idx, slot_idx)
        if key not in self._occ:
            lits = self.lits_at_slot(self.problem.sessions_of_teacher.get(t_idx, []), slot_idx)
            self._occ[key] = self._or(lits, f"occ_t{t_idx}_s{slot_idx}")
        return self._occ[key]

    def teacher_day_used(self, t_idx: int, day: int):
        key = (t_idx, day)
        if key not in self._day_used:
            lits = self.lits_on_day(self.problem.sessions_of_teacher.get(t_idx, []), day)
            self._day_used[key] = self._or(lits, f"used_t{t_idx}_d{day}")
        return self._day_used[key]

    # ------------------------------------------------- hard-group diagnostics
    def guard(self, name: str):
        """Assumption literal for a named group of hard constraints (diagnostic mode only)."""
        if not self.diagnostics:
            return None
        if name not in self.guards:
            self.guards[name] = self.model.NewBoolVar(f"guard::{name}")
        return self.guards[name]

    def post(self, ct, group: str | None = None):
        """Register a hard constraint, optionally tied to a diagnostic group."""
        if group is not None and self.diagnostics:
            ct.OnlyEnforceIf(self.guard(group))
        return ct

    # ------------------------------------------------------------- objective
    def add_penalty(self, name: str, coef: int, var) -> None:
        if coef > 0 and var is not None:
            self.penalties.append(PenaltyTerm(name, int(coef), var))

    def finalize_objective(self) -> None:
        if self.penalties:
            self.model.Minimize(sum(p.coef * p.var for p in self.penalties))


def build_model(problem: Problem, diagnostics: bool = False) -> ModelContext:
    # importing the packages triggers @register_* decorators
    from . import constraints, objectives  # noqa: F401

    ctx = ModelContext(problem, diagnostics=diagnostics)
    disabled = set(problem.config.disabled_modules)

    for name, cls in CONSTRAINTS.items():
        if name not in disabled:
            cls().apply(ctx)
    if not diagnostics:
        for name, cls in OBJECTIVES.items():
            if name not in disabled:
                cls().build(ctx)
        ctx.finalize_objective()
    return ctx
