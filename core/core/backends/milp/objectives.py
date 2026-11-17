"""MILP soft objectives. Weights/semantics identical to scoring.py (verified by tests)."""
from __future__ import annotations

from ...preprocess import term_groups
from ...scoring import active_weights, lateness_units
from .model import MilpContext


def teacher_days(ctx: MilpContext, w: int) -> None:
    for t in ctx.problem.teachers:
        sess = ctx.problem.sessions_of_teacher.get(t.idx, [])
        for day in t.days:
            ctx.penalty(w * t.priority, ctx.or_lower(ctx.lits_on_day(sess, day), "used"))


def teacher_gaps(ctx: MilpContext, w: int) -> None:
    """hole[i] >= before[i] + after[i] - occ[i] - 1   (before/after: running OR, lower-bound form)."""
    p, S = ctx.problem, ctx.solver
    for t in p.teachers:
        sess = p.sessions_of_teacher.get(t.idx, [])
        if len(sess) < 2:
            continue
        for day in t.days:
            order = p.slots_by_day.get(day, [])
            n = len(order)
            if n < 3:
                continue
            occ = [ctx.or_exact(ctx.lits_at_slot(sess, s), "occ") for s in order]   # exact: used with '-' sign
            before = [None] * n
            for i in range(1, n):
                if occ[i - 1] is None and before[i - 1] is None:
                    continue
                b = ctx.new_bool("bef")
                if occ[i - 1] is not None:
                    S.Add(b >= occ[i - 1])
                if before[i - 1] is not None:
                    S.Add(b >= before[i - 1])
                before[i] = b
            after = [None] * n
            for i in range(n - 2, -1, -1):
                if occ[i + 1] is None and after[i + 1] is None:
                    continue
                a = ctx.new_bool("aft")
                if occ[i + 1] is not None:
                    S.Add(a >= occ[i + 1])
                if after[i + 1] is not None:
                    S.Add(a >= after[i + 1])
                after[i] = a
            for i in range(1, n - 1):
                if before[i] is None or after[i] is None:
                    continue
                h = ctx.new_bool("hole")
                expr = before[i] + after[i] - 1
                if occ[i] is not None:
                    expr = expr - occ[i]
                S.Add(h >= expr)
                ctx.penalty(w * t.priority * max(1, p.slots[order[i]].minutes // 30), h)


def course_spread(ctx: MilpContext, w: int) -> None:
    p, S = ctx.problem, ctx.solver
    days = sorted(p.slots_by_day)
    for c in p.courses:
        sess = p.sessions_of_course[c.idx]
        if len(sess) < 2:
            continue
        y = {d: ctx.or_lower(ctx.lits_on_day(sess, d), "y") for d in days}
        for d in days:
            if d + 1 in y and y[d] is not None and y[d + 1] is not None:
                adj = ctx.new_bool("adj")
                S.Add(adj >= y[d] + y[d + 1] - 1)
                ctx.penalty(w, adj)


def slot_quality(ctx: MilpContext, w: int) -> None:
    p = ctx.problem
    for s in p.sessions:
        prio = p.teachers[p.courses[s.course_idx].teacher_idx].priority
        for i, pl in enumerate(p.placements[s.idx]):
            ctx.penalty(w * prio * pl.penalty, ctx.x[(s.idx, i)])


def soft_course_conflicts(ctx: MilpContext, w: int) -> None:
    p, S = ctx.problem, ctx.solver
    for cf in p.conflicts:
        if cf.hard:
            continue
        sa, sb = p.sessions_of_course[cf.a], p.sessions_of_course[cf.b]
        for slot in p.slots:
            la, lb = ctx.lits_at_slot(sa, slot.idx), ctx.lits_at_slot(sb, slot.idx)
            if la and lb:
                o = ctx.new_bool("soft")
                S.Add(o >= S.Sum(la) + S.Sum(lb) - 1)
                ctx.penalty(w * max(1, slot.minutes // 30), o)

def total_days(ctx: MilpContext, w: int) -> None:
    p = ctx.problem
    all_sessions = [s.idx for s in p.sessions]
    for day in p.slots_by_day:
        lits = ctx.lits_on_day(all_sessions, day)
        # متغیر used در صورتی که حداقل یک کلاس در این روز باشد 1 می‌شود
        used = ctx.or_lower(lits, f"global_day_{day}")
        ctx.penalty(w, used)


def course_earliness(ctx: MilpContext, w: int) -> None:
    """Linear in x: cost(placement) = w * course.weight * lateness. No auxiliary variables needed."""
    p = ctx.problem
    for s in p.sessions:
        weight = p.courses[s.course_idx].weight
        if weight:
            for i, pl in enumerate(p.placements[s.idx]):
                ctx.penalty(w * weight * lateness_units(p, pl), ctx.x[(s.idx, i)])


def term_days(ctx: MilpContext, w: int) -> None:
    """used[term, day] >= every x of that term on that day (lower-bound form: it has a positive cost)."""
    p = ctx.problem
    for term, course_idxs in term_groups(p).items():
        sess = [s for c in course_idxs for s in p.sessions_of_course[c]]
        for day in p.slots_by_day:
            ctx.penalty(w, ctx.or_lower(ctx.lits_on_day(sess, day), f"term_{term}_d{day}"))


ALL = {"teacher_days": teacher_days, "teacher_gaps": teacher_gaps, "course_spread": course_spread,
       "slot_quality": slot_quality, "soft_course_conflicts": soft_course_conflicts, "total_days": total_days,
       "course_earliness": course_earliness, "term_days": term_days}


def apply_all(ctx: MilpContext) -> None:
    weights = active_weights(ctx.problem)   
    for name, fn in ALL.items():
        if weights[name] > 0:
            fn(ctx, weights[name])
