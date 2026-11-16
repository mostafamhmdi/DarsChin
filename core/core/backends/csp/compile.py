"""
CSP compilation: Problem -> a compact, pure-Python constraint network.

    variables : one per session
    domains   : that session's legal placements (as bit-masks: O(1) overlap tests)
    constraints (all binary, stored as relation flags on directed neighbour pairs):
        DISJOINT      the two sessions must not share a slot     (same teacher / hard conflict)
        DISTINCT_DAY  the two sessions must be on different days (same course)
        ORD_LT/ORD_GT symmetry breaking between sessions of a course
    plus one n-ary constraint: teacher daily load <= cap (handled inside the state).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ...preprocess import Problem
from ...scoring import active_weights

DISJOINT, DISTINCT_DAY, ORD_LT, ORD_GT = 1, 2, 4, 8


@dataclass(frozen=True, slots=True)
class CPl:
    idx: int          # index into problem.placements[session]
    day: int
    gmask: int        # bit per GLOBAL slot index  (overlap tests between sessions)
    pmask: int        # bit per slot POSITION inside its day (hole computation)
    minutes: int
    key: int          # day*1440 + start  (symmetry ordering)
    penalty: int
    start: int


@dataclass
class CspModel:
    n: int
    dom0: list[list[CPl]]
    teacher: list[int]
    course: list[int]
    prio: list[int]
    neighbors: list[list[tuple[int, int]]]
    degree: list[int]
    sessions_of_teacher: dict[int, list[int]]
    sessions_of_course: dict[int, list[int]]
    soft_partners: dict[int, list[int]]
    teacher_prio: list[int]
    w: dict[str, int]
    gap_units: dict[int, list[int]]
    soft_unit: list[int]
    cap_minutes: int | None
    days: list[int] = field(default_factory=list)


def compile_problem(p: Problem) -> CspModel:
    cfg = p.config
    off = set(cfg.disabled_modules)
    w = active_weights(p)

    dom0: list[list[CPl]] = []
    for s in p.sessions:
        dom0.append([
            CPl(i, pl.day,
                sum(1 << k for k in pl.slot_idxs),
                sum(1 << p.slots[k].order for k in pl.slot_idxs),
                pl.end - pl.start, pl.day * 1440 + pl.start, pl.penalty, pl.start)
            for i, pl in enumerate(p.placements[s.idx])])

    rel: dict[tuple[int, int], int] = defaultdict(int)
    if "teacher_no_overlap" not in off:
        for sess in p.sessions_of_teacher.values():
            for a in sess:
                for b in sess:
                    if a != b:
                        rel[(a, b)] |= DISJOINT
    if "hard_course_conflicts" not in off:
        for cf in p.conflicts:
            if cf.hard:
                for a in p.sessions_of_course[cf.a]:
                    for b in p.sessions_of_course[cf.b]:
                        rel[(a, b)] |= DISJOINT
                        rel[(b, a)] |= DISJOINT
    if "term_no_overlap" not in off:
        term_groups = defaultdict(list)
        for c in p.courses:
            term = getattr(c, "term", None)
            if term:
                term_groups[term].append(c.idx)
        for course_idxs in term_groups.values():
            for i, ca in enumerate(course_idxs):
                for cb in course_idxs[i + 1:]:
                    for a in p.sessions_of_course[ca]:
                        for b in p.sessions_of_course[cb]:
                            rel[(a, b)] |= DISJOINT
                            rel[(b, a)] |= DISJOINT                   
    distinct = cfg.sessions_on_distinct_days and "course_sessions_distinct_days" not in off
    ordered = "session_symmetry_breaking" not in off
    for sess in p.sessions_of_course.values():
        for i, a in enumerate(sess):
            for b in sess[i + 1:]:
                if distinct:
                    rel[(a, b)] |= DISTINCT_DAY
                    rel[(b, a)] |= DISTINCT_DAY
                if ordered:
                    rel[(a, b)] |= ORD_LT
                    rel[(b, a)] |= ORD_GT

    neighbors: list[list[tuple[int, int]]] = [[] for _ in p.sessions]
    for (a, b), f in rel.items():
        neighbors[a].append((b, f))

    soft: dict[int, list[int]] = defaultdict(list)
    for cf in p.conflicts:
        if not cf.hard:
            soft[cf.a].append(cf.b)
            soft[cf.b].append(cf.a)

    cap = int(cfg.max_teaching_hours_per_day * 60) if (cfg.max_teaching_hours_per_day
                                                       and "teacher_daily_load" not in off) else None
    return CspModel(
        n=len(p.sessions), dom0=dom0,
        teacher=[p.courses[s.course_idx].teacher_idx for s in p.sessions],
        course=[s.course_idx for s in p.sessions],
        prio=[p.teachers[p.courses[s.course_idx].teacher_idx].priority for s in p.sessions],
        neighbors=neighbors, degree=[len(x) for x in neighbors],
        sessions_of_teacher=dict(p.sessions_of_teacher), sessions_of_course=dict(p.sessions_of_course),
        soft_partners=dict(soft), teacher_prio=[t.priority for t in p.teachers], w=w,
        gap_units={d: [max(1, p.slots[i].minutes // 30) for i in idxs] for d, idxs in p.slots_by_day.items()},
        soft_unit=[max(1, s.minutes // 30) for s in p.slots], cap_minutes=cap,
        days=sorted(p.slots_by_day))
