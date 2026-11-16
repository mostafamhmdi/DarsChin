"""CP-SAT engine: native constraint programming model + SAT-based search (OR-Tools)."""
from __future__ import annotations

from ortools.sat.python import cp_model

from ...preprocess import Problem
from ..base import Capabilities, SchedulerBackend, SolveOutcome
from .diagnostics import explain_infeasibility
from .model_builder import build_model


class CpSatBackend(SchedulerBackend):
    name = "cpsat"
    capabilities = Capabilities(proves_optimality=True, explains_infeasibility=True, reports_bound=True)

    def _solve(self, problem: Problem) -> SolveOutcome:
        cfg = problem.config
        ctx = build_model(problem)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = cfg.time_limit_sec
        solver.parameters.num_workers = cfg.num_workers
        solver.parameters.random_seed = cfg.random_seed
        status = solver.Solve(ctx.model)

        out = SolveOutcome(status=solver.StatusName(status), wall_time=solver.WallTime())
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            out.objective = solver.ObjectiveValue()
            out.best_bound = solver.BestObjectiveBound()
            out.picks = [k for k, v in ctx.x.items() if solver.BooleanValue(v)]
        elif status == cp_model.INFEASIBLE:
            out.infeasibility_core = explain_infeasibility(problem)
        else:
            out.status = "UNKNOWN"
        return out
