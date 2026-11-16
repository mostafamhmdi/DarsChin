"""
Infeasibility explanation.

When the hard model is INFEASIBLE we rebuild it with one *assumption literal per
named constraint group* (e.g. "teacher_overlap:T3", "conflict:C1|C2") and ask
CP-SAT for a sufficient (small) subset of assumptions that already causes the
contradiction. The names are returned to the backend/UI so the department head
sees *which* teachers/conflicts to relax.
"""
from __future__ import annotations

from ortools.sat.python import cp_model

from .model_builder import build_model
from ...preprocess import Problem


def explain_infeasibility(problem: Problem, time_limit_sec: float = 20.0) -> list[str]:
    ctx = build_model(problem, diagnostics=True)
    if not ctx.guards:
        return []
    ctx.model.AddAssumptions(list(ctx.guards.values()))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    solver.parameters.num_workers = 1                  # assumptions need a single worker
    solver.parameters.keep_all_feasible_solutions_in_presolve = True
    status = solver.Solve(ctx.model)
    if status != cp_model.INFEASIBLE:
        return []
    core = set(solver.SufficientAssumptionsForInfeasibility())
    return sorted(name for name, lit in ctx.guards.items() if lit.Index() in core)
