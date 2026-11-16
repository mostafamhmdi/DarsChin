"""MILP engine: linear formulation + LP-based branch-and-cut (SCIP by default; CBC / HiGHS fallback)."""
from __future__ import annotations

from ortools.linear_solver import pywraplp

from ...preprocess import Problem
from ..base import Capabilities, SchedulerBackend, SolveOutcome
from . import constraints, objectives
from .model import MilpContext, create_solver

_STATUS = {
    pywraplp.Solver.OPTIMAL: "OPTIMAL",
    pywraplp.Solver.FEASIBLE: "FEASIBLE",
    pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
}


class MilpBackend(SchedulerBackend):
    """
    engine_options:
        solver : "SCIP" | "CBC" | "HiGHS"   (default SCIP, silently falls back if missing)
        gap    : relative MIP gap to stop at (default 0 = prove optimality)
    """
    name = "milp"
    capabilities = Capabilities(proves_optimality=True, explains_infeasibility=False, reports_bound=True)

    @classmethod
    def is_available(cls) -> bool:
        s, _ = create_solver()
        return s is not None

    def _solve(self, problem: Problem) -> SolveOutcome:
        cfg = problem.config
        opts = cfg.engine_options
        solver, used = create_solver(opts.get("solver"))
        if solver is None:
            return SolveOutcome(status="UNKNOWN", stats={"error": "no MILP solver available"})

        ctx = MilpContext(problem, solver)
        for fn in constraints.ALL:
            fn(ctx)
        objectives.apply_all(ctx)

        obj = solver.Objective()
        for var, coef in ctx.obj.items():
            obj.SetCoefficient(var, coef)
        obj.SetMinimization()

        solver.SetTimeLimit(int(cfg.time_limit_sec * 1000))
        solver.SetNumThreads(cfg.num_workers)
        params = pywraplp.MPSolverParameters()
        params.SetDoubleParam(pywraplp.MPSolverParameters.RELATIVE_MIP_GAP, float(opts.get("gap", 0.0)))

        status = solver.Solve(params)
        out = SolveOutcome(status=_STATUS.get(status, "UNKNOWN"),
                           wall_time=solver.WallTime() / 1000.0,
                           stats={"solver": used, "variables": solver.NumVariables(),
                                  "constraints": solver.NumConstraints(), "nodes": solver.nodes()})
        if out.status in ("OPTIMAL", "FEASIBLE"):
            out.objective = obj.Value()
            out.best_bound = obj.BestBound()
            out.picks = [k for k, v in ctx.x.items() if v.solution_value() > 0.5]
        return out
