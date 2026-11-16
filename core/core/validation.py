"""
Layer 0/1 - Validation.

Fail fast with HUMAN-READABLE reasons before the solver runs. Most "infeasible"
cases in practice are data-entry problems that can be explained without search.
"""
from __future__ import annotations

from collections import Counter

from .preprocess import Problem
from .schemas import Issue, SolveRequest


def _err(code, msg, refs=()):
    return Issue(code=code, severity="error", message=msg, refs=list(refs))


def _warn(code, msg, refs=()):
    return Issue(code=code, severity="warning", message=msg, refs=list(refs))


def has_errors(issues: list[Issue]) -> bool:
    return any(i.severity == "error" for i in issues)


def validate_request(req: SolveRequest) -> list[Issue]:
    """Referential integrity (must pass before `build_problem`)."""
    issues: list[Issue] = []

    for kind, ids in (("teacher", [t.id for t in req.teachers]),
                      ("course", [c.id for c in req.courses]),
                      ("slot", [s.id for s in req.slots])):
        for _id, n in Counter(ids).items():
            if n > 1:
                issues.append(_err("DUPLICATE_ID", f"duplicate {kind} id '{_id}'", [_id]))

    teacher_ids = {t.id for t in req.teachers}
    course_ids = {c.id for c in req.courses}
    slot_ids = {s.id for s in req.slots}

    for c in req.courses:
        if c.teacher_id not in teacher_ids:
            issues.append(_err("UNKNOWN_TEACHER", f"course '{c.name}' references unknown teacher '{c.teacher_id}'", [c.id]))
    for t in req.teachers:
        for sid in t.unavailable_slot_ids:
            if sid not in slot_ids:
                issues.append(_err("UNKNOWN_SLOT", f"teacher '{t.name}' references unknown slot '{sid}'", [t.id, sid]))
    for cf in req.conflicts:
        for cid in (cf.course_a, cf.course_b):
            if cid not in course_ids:
                issues.append(_err("UNKNOWN_COURSE", f"conflict references unknown course '{cid}'", [cid]))
        if cf.course_a == cf.course_b:
            issues.append(_err("SELF_CONFLICT", f"course '{cf.course_a}' conflicts with itself", [cf.course_a]))

    # overlapping slots inside one day
    by_day: dict[int, list] = {}
    for s in req.slots:
        by_day.setdefault(s.day, []).append(s)
    for day, ss in by_day.items():
        ss.sort(key=lambda s: s.start)
        for a, b in zip(ss, ss[1:]):
            if b.start < a.end:
                issues.append(_err("OVERLAPPING_SLOTS", f"slots '{a.id}' and '{b.id}' overlap on day {day}", [a.id, b.id]))
    return issues


def validate_problem(p: Problem) -> list[Issue]:
    """Semantic pre-checks on the normalised problem (cheap necessary conditions)."""
    issues: list[Issue] = []
    cfg = p.config

    for c in p.courses:
        t = p.teachers[c.teacher_idx]
        sess = p.sessions_of_course[c.idx]
        pls = p.placements[sess[0]]
        if not pls:
            issues.append(_err(
                "NO_PLACEMENT",
                f"course '{c.name}' ({c.minutes} min per session) has no legal time: "
                f"no run of consecutive slots of that length falls on days teacher '{t.name}' is available",
                [c.id, t.id]))
            continue
        days = {pl.day for pl in pls}
        if cfg.sessions_on_distinct_days and c.sessions > len(days):
            issues.append(_err(
                "TOO_MANY_SESSIONS",
                f"course '{c.name}' needs {c.sessions} sessions on different days but only {len(days)} usable day(s) exist",
                [c.id, t.id]))
        if cfg.max_teaching_hours_per_day and c.minutes > cfg.max_teaching_hours_per_day * 60:
            issues.append(_err("SESSION_EXCEEDS_DAILY_CAP",
                               f"a session of '{c.name}' is longer than the daily teaching cap", [c.id]))

    for t in p.teachers:
        need = sum(p.courses[p.sessions[s].course_idx].minutes for s in p.sessions_of_teacher.get(t.idx, []))
        if need == 0:
            issues.append(_warn("TEACHER_WITHOUT_COURSE", f"teacher '{t.name}' has no course", [t.id]))
            continue
        cap = sum(s.minutes for s in p.slots if s.day in t.days and s.idx not in t.blocked_slots)
        if need > cap:
            issues.append(_err(
                "TEACHER_OVERLOADED",
                f"teacher '{t.name}' must teach {need/60:g}h/week but only {cap/60:g}h of slots are available to them",
                [t.id]))
        if cfg.max_teaching_hours_per_day:
            cap2 = len(t.days) * cfg.max_teaching_hours_per_day * 60
            if need > cap2:
                issues.append(_err("TEACHER_DAILY_CAP",
                                   f"teacher '{t.name}' cannot fit {need/60:g}h/week under the daily cap", [t.id]))

    for cf in p.conflicts:
        if p.courses[cf.a].teacher_idx == p.courses[cf.b].teacher_idx:
            issues.append(_warn("REDUNDANT_CONFLICT",
                                f"'{p.courses[cf.a].name}' and '{p.courses[cf.b].name}' share a teacher; the conflict is implied",
                                [p.courses[cf.a].id, p.courses[cf.b].id]))
    return issues
