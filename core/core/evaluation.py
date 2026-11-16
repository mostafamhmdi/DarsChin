"""
Independent verifier + KPI calculator.

It re-checks every hard rule on the *output* without touching CP-SAT, so a modelling
bug can never silently ship an invalid timetable (also used heavily in tests).
"""
from __future__ import annotations

from collections import defaultdict

from .preprocess import Placement, Problem, Session

Resolved = list[tuple[Session, Placement]]


def resolve(problem: Problem, picks: list[tuple[int, int]]) -> Resolved:
    return [(problem.sessions[s], problem.placements[s][i]) for s, i in sorted(picks)]


def verify(problem: Problem, resolved: Resolved) -> list[str]:
    errs: list[str] = []
    cfg = problem.config

    if len(resolved) != len(problem.sessions):
        errs.append("not every session is placed")

    teacher_slots: dict[tuple[int, int], int] = defaultdict(int)
    course_slots: dict[tuple[int, int], int] = defaultdict(int)
    days_of_course: dict[int, list[int]] = defaultdict(list)
    teacher_day_minutes: dict[tuple[int, int], int] = defaultdict(int)

    for sess, pl in resolved:
        c = problem.courses[sess.course_idx]
        t = problem.teachers[c.teacher_idx]
        if pl.day not in t.days:
            errs.append(f"{c.id}: teacher {t.id} not available on day {pl.day}")
        if set(pl.slot_idxs) & t.blocked_slots:
            errs.append(f"{c.id}: uses a blocked slot of teacher {t.id}")
        if pl.end - pl.start != c.minutes:
            errs.append(f"{c.id}: wrong session length")
        days_of_course[c.idx].append(pl.day)
        teacher_day_minutes[(t.idx, pl.day)] += c.minutes
        for sl in pl.slot_idxs:
            teacher_slots[(t.idx, sl)] += 1
            course_slots[(c.idx, sl)] += 1

    for (t, sl), n in teacher_slots.items():
        if n > 1:
            errs.append(f"teacher {problem.teachers[t].id} double-booked at slot {problem.slots[sl].id}")
    if cfg.sessions_on_distinct_days:
        for c, days in days_of_course.items():
            if len(days) != len(set(days)):
                errs.append(f"course {problem.courses[c].id} has two sessions on one day")
    if cfg.max_teaching_hours_per_day:
        for (t, d), m in teacher_day_minutes.items():
            if m > cfg.max_teaching_hours_per_day * 60:
                errs.append(f"teacher {problem.teachers[t].id} exceeds daily cap on day {d}")
    for cf in problem.conflicts:
        if cf.hard:
            for sl in problem.slots:
                if course_slots.get((cf.a, sl.idx)) and course_slots.get((cf.b, sl.idx)):
                    errs.append(f"hard conflict {problem.courses[cf.a].id}|{problem.courses[cf.b].id} at {sl.id}")
    return errs


def compute_metrics(problem: Problem, resolved: Resolved) -> dict:
    occupied: dict[tuple[int, int], set[int]] = defaultdict(set)   # (teacher, day) -> slot idxs
    for sess, pl in resolved:
        t = problem.courses[sess.course_idx].teacher_idx
        occupied[(t, pl.day)].update(pl.slot_idxs)

    teachers = {}
    for t in problem.teachers:
        days = sorted(d for (tt, d) in occupied if tt == t.idx)
        hole_min = 0
        for d in days:
            order = problem.slots_by_day[d]
            pos = [problem.slots[s].order for s in occupied[(t.idx, d)]]
            lo, hi = min(pos), max(pos)
            for o in range(lo, hi + 1):
                if order[o] not in occupied[(t.idx, d)]:
                    hole_min += problem.slots[order[o]].minutes
        teaching = sum(problem.slots[s].minutes for d in days for s in occupied[(t.idx, d)])
        teachers[t.id] = {
            "name": t.name,
            "days_on_campus": len(days),
            "days": days,
            "teaching_hours": round(teaching / 60, 2),
            "gap_hours": round(hole_min / 60, 2),
        }

    all_days = sorted({pl.day for _, pl in resolved})
    return {
        "teachers": teachers,
        "days_used_overall": all_days,
        "total_gap_hours": round(sum(t["gap_hours"] for t in teachers.values()), 2),
        "total_teacher_days": sum(t["days_on_campus"] for t in teachers.values()),
    }
