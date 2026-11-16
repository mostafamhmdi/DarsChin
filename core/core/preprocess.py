"""
Layer 1 - Normalisation.

Turns the API-level request (strings, ids, HH:MM) into an immutable, index-based
`Problem` that the CP-SAT layer consumes. All "what are the legal choices?"
logic lives here: the model never reasons about clock times, only about
pre-computed *placements*.

Key idea - PLACEMENT
    A placement = a legal way to put ONE session of a given duration on the
    timetable: a day + a run of consecutive, time-adjacent slots whose total
    length equals the session duration. The solver simply picks one placement
    per session.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from .schemas import Level, SolverConfig, SolveRequest


def hhmm_to_min(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def min_to_hhmm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


@dataclass(frozen=True)
class Slot:
    idx: int
    id: str
    day: int
    order: int          # position inside its day (0 = first slot of the day)
    start: int          # minutes from midnight
    end: int
    penalty: int

    @property
    def minutes(self) -> int:
        return self.end - self.start


@dataclass(frozen=True)
class Placement:
    day: int
    slot_idxs: tuple[int, ...]
    start: int
    end: int
    penalty: int        # sum of slot penalties it covers


@dataclass(frozen=True)
class Teacher:
    idx: int
    id: str
    name: str
    days: frozenset[int]
    priority: int
    blocked_slots: frozenset[int]


@dataclass(frozen=True)
class Course:
    idx: int
    id: str
    name: str
    teacher_idx: int
    sessions: int
    minutes: int
    level: Level
    major: str


@dataclass(frozen=True)
class Session:
    idx: int
    course_idx: int
    k: int              # 0-based index of the session inside the week


@dataclass(frozen=True)
class Conflict:
    a: int              # course idx
    b: int
    hard: bool


@dataclass
class Problem:
    teachers: list[Teacher]
    courses: list[Course]
    slots: list[Slot]
    sessions: list[Session]
    conflicts: list[Conflict]
    config: SolverConfig
    slots_by_day: dict[int, list[int]]
    placements: dict[int, list[Placement]]                 # session idx -> legal placements
    sessions_of_course: dict[int, list[int]] = field(default_factory=dict)
    sessions_of_teacher: dict[int, list[int]] = field(default_factory=dict)


def _generate_placements(slots: list[Slot], slots_by_day: dict[int, list[int]], minutes: int) -> list[Placement]:
    out: list[Placement] = []
    for day, idxs in slots_by_day.items():
        for i in range(len(idxs)):
            run: list[int] = []
            total = 0
            for j in range(i, len(idxs)):
                s = slots[idxs[j]]
                if run and slots[run[-1]].end != s.start:   # lunch break etc. -> run is broken
                    break
                run.append(idxs[j])
                total += s.minutes
                if total == minutes:
                    out.append(Placement(
                        day=day,
                        slot_idxs=tuple(run),
                        start=slots[run[0]].start,
                        end=slots[run[-1]].end,
                        penalty=sum(slots[r].penalty for r in run),
                    ))
                    break
                if total > minutes:
                    break
    return out


def build_problem(req: SolveRequest) -> Problem:
    # ---- slots (sorted by day, start) ----
    ordered = sorted(req.slots, key=lambda s: (s.day, hhmm_to_min(s.start)))
    slots: list[Slot] = []
    slots_by_day: dict[int, list[int]] = defaultdict(list)
    for i, s in enumerate(ordered):
        slots.append(Slot(i, s.id, s.day, len(slots_by_day[s.day]),
                          hhmm_to_min(s.start), hhmm_to_min(s.end), s.penalty))
        slots_by_day[s.day].append(i)
    slot_idx = {s.id: s.idx for s in slots}

    # ---- teachers / courses ----
    teachers = [
        Teacher(i, t.id, t.name, frozenset(t.available_days), t.priority,
                frozenset(slot_idx[sid] for sid in t.unavailable_slot_ids if sid in slot_idx))
        for i, t in enumerate(req.teachers)
    ]
    t_idx = {t.id: t.idx for t in teachers}
    courses = [
        Course(i, c.id, c.name, t_idx[c.teacher_id], c.sessions_per_week,
               c.session_minutes, c.level, c.major)
        for i, c in enumerate(req.courses)
    ]
    c_idx = {c.id: c.idx for c in courses}

    # ---- conflicts (deduplicated, hard wins over soft) ----
    merged: dict[tuple[int, int], bool] = {}
    for cf in req.conflicts:
        a, b = sorted((c_idx[cf.course_a], c_idx[cf.course_b]))
        merged[(a, b)] = merged.get((a, b), False) or cf.hard
    conflicts = [Conflict(a, b, h) for (a, b), h in merged.items()]

    # ---- sessions & placements ----
    sessions: list[Session] = []
    sessions_of_course: dict[int, list[int]] = defaultdict(list)
    sessions_of_teacher: dict[int, list[int]] = defaultdict(list)
    for c in courses:
        for k in range(c.sessions):
            s = Session(len(sessions), c.idx, k)
            sessions.append(s)
            sessions_of_course[c.idx].append(s.idx)
            sessions_of_teacher[c.teacher_idx].append(s.idx)

    cache: dict[int, list[Placement]] = {}
    placements: dict[int, list[Placement]] = {}
    for s in sessions:
        c = courses[s.course_idx]
        t = teachers[c.teacher_idx]
        if c.minutes not in cache:
            cache[c.minutes] = _generate_placements(slots, slots_by_day, c.minutes)
        placements[s.idx] = [
            p for p in cache[c.minutes]
            if p.day in t.days and not (set(p.slot_idxs) & t.blocked_slots)
        ]

    return Problem(teachers, courses, slots, sessions, conflicts, req.config,
                   dict(slots_by_day), placements, dict(sessions_of_course), dict(sessions_of_teacher))
