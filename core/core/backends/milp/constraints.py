"""MILP hard constraints (linear)."""
from __future__ import annotations

from .model import MilpContext


def _on(ctx: MilpContext, name: str) -> bool:
    return name not in ctx.cfg.disabled_modules


def one_placement_per_session(ctx: MilpContext) -> None:
    if not _on(ctx, "one_placement_per_session"):
        return
    for s in ctx.problem.sessions:
        ctx.solver.Add(ctx.solver.Sum([ctx.x[(s.idx, i)] for i in range(len(ctx.problem.placements[s.idx]))]) == 1)


def distinct_days(ctx: MilpContext) -> None:
    if not (ctx.cfg.sessions_on_distinct_days and _on(ctx, "course_sessions_distinct_days")):
        return
    p = ctx.problem
    for c in p.courses:
        sess = p.sessions_of_course[c.idx]
        if len(sess) > 1:
            for day in p.slots_by_day:
                lits = ctx.lits_on_day(sess, day)
                if len(lits) > 1:
                    ctx.solver.Add(ctx.solver.Sum(lits) <= 1)


def symmetry_breaking(ctx: MilpContext) -> None:
    """
    Sessions of one course are interchangeable: force key(a) < key(b) with key = day*1440+start.
    Strong (cumulative) form:  for every threshold t:
        [a placed at key >= t]  <=  [b placed at key > t]
    which keeps the LP relaxation tight, unlike one big-coefficient inequality.
    """
    if not _on(ctx, "session_symmetry_breaking"):
        return
    p = ctx.problem
    key = lambda pl: pl.day * 1440 + pl.start  # noqa: E731
    for c in p.courses:
        sess = p.sessions_of_course[c.idx]
        for a, b in zip(sess, sess[1:]):
            pa, pb = p.placements[a], p.placements[b]
            for t in sorted({key(pl) for pl in pa}):
                left = [ctx.x[(a, i)] for i, pl in enumerate(pa) if key(pl) >= t]
                right = [ctx.x[(b, j)] for j, pl in enumerate(pb) if key(pl) > t]
                ctx.solver.Add(ctx.solver.Sum(left) <= (ctx.solver.Sum(right) if right else 0))


def teacher_no_overlap(ctx: MilpContext) -> None:
    if not _on(ctx, "teacher_no_overlap"):
        return
    p = ctx.problem
    for t in p.teachers:
        sess = p.sessions_of_teacher.get(t.idx, [])
        if len(sess) < 2:
            continue
        for slot in p.slots:
            lits = ctx.lits_at_slot(sess, slot.idx)
            if len(lits) > 1:
                ctx.solver.Add(ctx.solver.Sum(lits) <= 1)


def teacher_daily_load(ctx: MilpContext) -> None:
    cap_h = ctx.cfg.max_teaching_hours_per_day
    if not cap_h or not _on(ctx, "teacher_daily_load"):
        return
    p = ctx.problem
    for t in p.teachers:
        sess = p.sessions_of_teacher.get(t.idx, [])
        for day in p.slots_by_day:
            terms = [(pl.end - pl.start) * ctx.x[(s, i)] for s in sess
                     for i, pl in enumerate(p.placements[s]) if pl.day == day]
            if terms:
                ctx.solver.Add(ctx.solver.Sum(terms) <= int(cap_h * 60))


def hard_course_conflicts(ctx: MilpContext) -> None:
    if not _on(ctx, "hard_course_conflicts"):
        return
    p = ctx.problem
    for cf in p.conflicts:
        if not cf.hard:
            continue
        sa, sb = p.sessions_of_course[cf.a], p.sessions_of_course[cf.b]
        for slot in p.slots:
            la, lb = ctx.lits_at_slot(sa, slot.idx), ctx.lits_at_slot(sb, slot.idx)
            if la and lb:
                ctx.solver.Add(ctx.solver.Sum(la + lb) <= 1)


ALL = [one_placement_per_session, distinct_days, symmetry_breaking,
       teacher_no_overlap, teacher_daily_load, hard_course_conflicts]
