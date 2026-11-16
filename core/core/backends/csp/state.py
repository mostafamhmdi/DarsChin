"""
Mutable search state: domains + partial assignment + incremental cost, with exact undo.

Forward checking (FC): after assigning s := p, every UNASSIGNED neighbour keeps only the values
compatible with p; an emptied domain means dead end. Domains are never mutated in place -
a pruned domain is a NEW list and the old one goes on the trail, so undo is O(#changes).

Cost split (needed for branch-and-bound):
    mono : teacher_days + slot_quality + course_spread + soft_conflicts
           -> never decreases while assigning, so it is a valid lower bound.
    gap  : holes in a teacher's day -> can shrink when a hole gets filled; added only at leaves.
"""
from __future__ import annotations

from collections import defaultdict

from .compile import DISJOINT, DISTINCT_DAY, ORD_GT, ORD_LT, CPl, CspModel


def compatible(p: CPl, q: CPl, rel: int) -> bool:
    if rel & DISJOINT and p.gmask & q.gmask:
        return False
    if rel & DISTINCT_DAY and p.day == q.day:
        return False
    if rel & ORD_LT and not p.key < q.key:
        return False
    if rel & ORD_GT and not p.key > q.key:
        return False
    return True


class CspState:
    def __init__(self, m: CspModel):
        self.m = m
        self.dom: list[list[CPl]] = list(m.dom0)          # lists are replaced, never mutated
        self.asg: list[CPl | None] = [None] * m.n
        self.trail: list[tuple[int, list[CPl]]] = []
        self.n_assigned = 0
        self.tday: dict[tuple[int, int], int] = defaultdict(int)
        self.tocc: dict[tuple[int, int], int] = defaultdict(int)
        self.cday: dict[tuple[int, int], int] = defaultdict(int)
        self.global_day: dict[int, int] = defaultdict(int)
        self.load: dict[tuple[int, int], int] = defaultdict(int)
        self.mono = 0
        self.gap = 0
        self._mono_added: dict[int, int] = {}
        self._gap_added: dict[int, int] = {}
        self._old_occ: dict[int, int] = {}

    # ------------------------------------------------------------------ cost
    def hole_cost(self, t: int, day: int, occ: int) -> int:
        w = self.m.w["teacher_gaps"]
        if not w or occ & (occ - 1) == 0:
            return 0
        lo = (occ & -occ).bit_length() - 1
        hi = occ.bit_length() - 1
        holes = (((1 << hi) - 1) ^ ((1 << (lo + 1)) - 1)) & ~occ
        units, gu = 0, self.m.gap_units[day]
        while holes:
            low = holes & -holes
            units += gu[low.bit_length() - 1]
            holes ^= low
        return units * w * self.m.teacher_prio[t]

    def mono_delta(self, s: int, p: CPl) -> int:
        m, w = self.m, self.m.w
        t, c, d, prio = m.teacher[s], m.course[s], p.day, m.prio[s]
        cost = w["slot_quality"] * prio * p.penalty
        if w.get("total_days") and self.global_day[d] == 0:  
            cost += w["total_days"]
        if self.tday[(t, d)] == 0:
            cost += w["teacher_days"] * prio
        if w["course_spread"] and len(m.sessions_of_course[c]) >= 2 and self.cday[(c, d)] == 0:
            if self.cday[(c, d - 1)]:
                cost += w["course_spread"]
            if self.cday[(c, d + 1)]:
                cost += w["course_spread"]
        if w["soft_course_conflicts"]:
            for c2 in m.soft_partners.get(c, ()):
                for s2 in m.sessions_of_course[c2]:
                    q = self.asg[s2]
                    if q is not None:
                        ov = p.gmask & q.gmask
                        while ov:
                            low = ov & -ov
                            cost += w["soft_course_conflicts"] * m.soft_unit[low.bit_length() - 1]
                            ov ^= low
        return cost

    def gap_delta(self, s: int, p: CPl) -> int:
        t = self.m.teacher[s]
        old = self.tocc[(t, p.day)]
        return self.hole_cost(t, p.day, old | p.pmask) - self.hole_cost(t, p.day, old)

    # ---------------------------------------------------------------- assign
    def assign(self, s: int, p: CPl) -> bool:
        """Assign + forward-check. Returns False on a dead end. ALWAYS pair with undo()."""
        m = self.m
        t, c, d = m.teacher[s], m.course[s], p.day
        key = (t, d)

        md, gd = self.mono_delta(s, p), self.gap_delta(s, p)
        self._mono_added[s], self._gap_added[s] = md, gd
        self.mono += md
        self.gap += gd
        self._old_occ[s] = self.tocc[key]
        self.tocc[key] |= p.pmask
        self.tday[key] += 1
        self.cday[(c, d)] += 1
        self.global_day[d] += 1
        self.load[key] += p.minutes
        self.asg[s] = p
        self.n_assigned += 1
        

        for n, rel in m.neighbors[s]:
            if self.asg[n] is not None:
                continue
            old = self.dom[n]
            new = [q for q in old if compatible(p, q, rel)]
            if len(new) != len(old):
                self.trail.append((n, old))
                self.dom[n] = new
                if not new:
                    return False

        if m.cap_minutes is not None:
            used = self.load[key]
            for u in m.sessions_of_teacher[t]:
                if self.asg[u] is None:
                    old = self.dom[u]
                    new = [q for q in old if q.day != d or used + q.minutes <= m.cap_minutes]
                    if len(new) != len(old):
                        self.trail.append((u, old))
                        self.dom[u] = new
                        if not new:
                            return False
        return True

    def undo(self, s: int, mark: int) -> None:
        m = self.m
        p = self.asg[s]
        t, c, d = m.teacher[s], m.course[s], p.day
        key = (t, d)
        self.mono -= self._mono_added.pop(s)
        self.gap -= self._gap_added.pop(s)
        self.tocc[key] = self._old_occ.pop(s)
        self.tday[key] -= 1
        self.cday[(c, d)] -= 1
        self.global_day[d] -= 1
        self.load[key] -= p.minutes
        self.asg[s] = None
        self.n_assigned -= 1
        while len(self.trail) > mark:
            n, old = self.trail.pop()
            self.dom[n] = old
