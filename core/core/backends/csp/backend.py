"""
CSP engine: constraint satisfaction with systematic search (no external solver).

Pipeline
    1. first solution : DFS (MRV + forward checking), randomised restarts with growing node limit
       (a COMPLETE run without a solution proves INFEASIBLE)
    2. branch & bound : complete search from the root with the incumbent as bound
       (if it finishes -> OPTIMAL)
    3. LNS            : free a neighbourhood of sessions, re-solve it exactly, repeat until time-out

engine_options: lns_node_limit (default 1500), bb_share (fraction of time for step 2, default 0.3)
"""
from __future__ import annotations

import random
import sys
import time

from ...preprocess import Problem
from ..base import Capabilities, SchedulerBackend, SolveOutcome
from .compile import compile_problem
from .search import Searcher, lns
from .state import CspState


class CspBackend(SchedulerBackend):
    name = "csp"
    capabilities = Capabilities(proves_optimality=True, explains_infeasibility=False, reports_bound=False)

    def _solve(self, problem: Problem) -> SolveOutcome:
        cfg, opts = problem.config, problem.config.engine_options
        t0 = time.monotonic()
        deadline = t0 + cfg.time_limit_sec
        rng = random.Random(cfg.random_seed)
        m = compile_problem(problem)
        sys.setrecursionlimit(max(sys.getrecursionlimit(), 4 * m.n + 1000))
        stats = {"nodes": 0, "restarts": 0, "lns_iterations": 0, "lns_improvements": 0}

        def done(status, best=None, cost=None):
            out = SolveOutcome(status=status, wall_time=time.monotonic() - t0, stats=stats)
            if best is not None:
                out.objective = float(cost)
                out.picks = [(s, best[s].idx) for s in range(m.n)]
                if status == "OPTIMAL":
                    out.best_bound = float(cost)
            return out

        if any(not d for d in m.dom0):
            return done("INFEASIBLE")

        # ---- 1. first solution (restarts) ----
        limit, attempt, first = 2000, 0, None
        while time.monotonic() < deadline:
            sr = Searcher(CspState(m), deadline=deadline, rng=rng, node_limit=limit,
                          first_only=True, noise=0.0 if attempt == 0 else 25.0)
            sr.dfs(list(range(m.n)))
            stats["nodes"] += sr.nodes
            if sr.found:
                first = (sr.best, sr.best_cost)
                break
            if not sr.aborted:                      # exhausted the whole tree, nothing found
                return done("INFEASIBLE")
            attempt += 1
            stats["restarts"] = attempt
            limit = int(limit * 1.5)
        if first is None:
            return done("UNKNOWN")
        best, best_cost = first

        # ---- 2. complete branch & bound for a slice of the time ----
        now = time.monotonic()
        bb_deadline = now + float(opts.get("bb_share", 0.3)) * max(0.0, deadline - now)
        sr = Searcher(CspState(m), deadline=bb_deadline, rng=rng, best_cost=best_cost)
        sr.dfs(list(range(m.n)))
        stats["nodes"] += sr.nodes
        if sr.found:
            best, best_cost = sr.best, sr.best_cost
        if not sr.aborted:
            return done("OPTIMAL", best, best_cost)

        # ---- 3. LNS until the deadline ----
        best, best_cost = lns(m, best, best_cost, deadline=deadline, rng=rng,
                              node_limit=int(opts.get("lns_node_limit", 1500)), stats=stats)
        return done("FEASIBLE", best, best_cost)
