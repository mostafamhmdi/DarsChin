"""
Systematic search over the CSP + Large Neighbourhood Search.

dfs (one routine, three uses)
    * variable ordering : MRV (smallest domain), ties -> highest degree
    * value ordering    : cheapest incremental cost first (+ optional noise for restarts / LNS)
    * pruning           : forward checking + branch-and-bound on the monotone cost
    * first_only=True   -> stop at the first solution (used by randomised restarts)
"""
from __future__ import annotations

import random
import time

from .compile import CPl, CspModel
from .state import CspState


class Searcher:
    def __init__(self, state: CspState, *, deadline: float, rng: random.Random,
                 node_limit: int | None = None, best_cost: float = float("inf"),
                 first_only: bool = False, noise: float = 0.0):
        self.st = state
        self.deadline = deadline
        self.rng = rng
        self.node_limit = node_limit
        self.best_cost = best_cost
        self.first_only = first_only
        self.noise = noise
        self.best: list[CPl | None] | None = None
        self.found = False
        self.aborted = False
        self.nodes = 0

    def dfs(self, free: list[int]) -> None:
        self.nodes += 1
        if (self.node_limit and self.nodes >= self.node_limit) or \
           (self.nodes & 127 == 0 and time.monotonic() > self.deadline):
            self.aborted = True
            return

        st, m = self.st, self.st.m
        pick, pick_key = None, None
        for s in free:
            if st.asg[s] is None:
                k = (len(st.dom[s]), -m.degree[s])
                if pick_key is None or k < pick_key:
                    pick, pick_key = s, k
        if pick is None:                                   # complete assignment
            total = st.mono + st.gap
            if total < self.best_cost:
                self.best_cost, self.best, self.found = total, list(st.asg), True
            return

        s = pick
        cands = []
        for p in st.dom[s]:
            md = st.mono_delta(s, p)
            if st.mono + md >= self.best_cost:
                continue
            h = md + st.gap_delta(s, p) + (self.rng.random() * self.noise if self.noise else 0.0)
            cands.append((h, md, p))
        cands.sort(key=lambda x: x[0])

        for _, md, p in cands:
            if st.mono + md >= self.best_cost:             # incumbent may have improved meanwhile
                continue
            mark = len(st.trail)
            if st.assign(s, p):
                self.dfs(free)
            st.undo(s, mark)
            if self.aborted or (self.first_only and self.found):
                return


def neighbourhood(m: CspModel, cur: list[CPl], k: int, rng: random.Random) -> list[int]:
    """Pick the sessions to free: random / one teacher / one day / around a session's constraints."""
    kind = rng.choice(("random", "teacher", "day", "related"))
    if kind == "teacher":
        t = rng.choice(list(m.sessions_of_teacher))
        free = set(m.sessions_of_teacher[t])
    elif kind == "day":
        d = rng.choice([p.day for p in cur])
        free = {s for s in range(m.n) if cur[s].day == d}
    elif kind == "related":
        s0 = rng.randrange(m.n)
        free = {s0} | {n for n, _ in m.neighbors[s0]}
    else:
        free = set()
    while len(free) < min(k, m.n):
        free.add(rng.randrange(m.n))
    if len(free) > 2 * k:
        free = set(rng.sample(sorted(free), 2 * k))
    return sorted(free)


def lns(m: CspModel, cur: list[CPl], cur_cost: int, *, deadline: float, rng: random.Random,
        node_limit: int, stats: dict) -> tuple[list[CPl], int]:
    best, best_cost = list(cur), cur_cost
    k = min(m.n, 8)
    while time.monotonic() < deadline:
        free = neighbourhood(m, cur, k, rng)
        fixed = set(range(m.n)) - set(free)
        st = CspState(m)
        if not all(st.assign(s, cur[s]) for s in sorted(fixed)):
            continue
        sr = Searcher(st, deadline=deadline, rng=rng, node_limit=node_limit,
                      best_cost=cur_cost + 1, noise=6.0)   # +1 -> equal-cost moves allowed (plateau walk)
        sr.dfs(free)
        stats["lns_iterations"] += 1
        stats["nodes"] += sr.nodes
        if sr.found:
            cur, cur_cost = sr.best, sr.best_cost
            if cur_cost < best_cost:
                best, best_cost = list(cur), cur_cost
                stats["lns_improvements"] += 1
        # adapt neighbourhood size: too easy -> bigger, too hard -> smaller
        k = max(2, k - 1) if sr.aborted else min(m.n, k + 1)
    return best, best_cost
