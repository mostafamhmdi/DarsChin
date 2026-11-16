"""
Engine-independent objective ("the judge").

Every engine optimises its own internal model, but the number we report - and compare across
engines - is ALWAYS computed here from the final timetable. Formulas intentionally mirror the
objective modules of the engines:

    teacher_days          w * priority                      per (teacher, day) with a class
    teacher_gaps          w * priority * max(1, min//30)    per empty slot between two busy slots
    course_spread         w                                 per pair of back-to-back days of a course
    slot_quality          w * priority * slot penalty       per placed session
    soft_course_conflicts w * max(1, min//30)               per overlapping slot of a soft conflict
    total_days            w                                 per distinct active day in the whole schedule # اضافه شد

`active_weights` is shared with engines that need weights (CSP) so "disabled_modules" and
"weight = 0" mean the same thing everywhere.
"""
from __future__ import annotations

from collections import defaultdict

from .preprocess import Problem
from .evaluation import Resolved

# total_days به لیست نام‌ها اضافه شد
OBJECTIVE_NAMES = ("teacher_days", "teacher_gaps", "course_spread", "slot_quality", "soft_course_conflicts", "total_days")


def active_weights(problem: Problem) -> dict[str, int]:
    w = problem.config.weights
    raw = {
        "teacher_days": w.teacher_days,
        "teacher_gaps": w.teacher_gaps,
        "course_spread": w.course_spread,
        "slot_quality": w.slot_quality,
        "soft_course_conflicts": w.soft_conflict,
        # استفاده از getattr تا در صورت نبود فیلد در کلاس کانفیگ ارور ندهد
        "total_days": getattr(w, "total_days", 0), 
    }
    disabled = set(problem.config.disabled_modules)
    return {k: (0 if k in disabled else v) for k, v in raw.items()}


def hole_units(slots_minutes: list[int], occupied_positions: set[int]) -> int:
    """Sum of max(1, minutes//30) over free positions that lie between busy positions."""
    if len(occupied_positions) < 2:
        return 0
    lo, hi = min(occupied_positions), max(occupied_positions)
    return sum(max(1, slots_minutes[i] // 30) for i in range(lo + 1, hi) if i not in occupied_positions)


def score(problem: Problem, resolved: Resolved) -> tuple[int, dict[str, int]]:
    w = active_weights(problem)
    br = {k: 0 for k, v in w.items() if k not in problem.config.disabled_modules}

    # per teacher/day occupancy (as slot positions), per course day sets, per course slot sets
    occ: dict[tuple[int, int], set[int]] = defaultdict(set)
    course_days: dict[int, set[int]] = defaultdict(set)
    course_slots: dict[int, set[int]] = defaultdict(set)
    
    # متغیری برای ذخیره تمام روزهایی که در کل برنامه پر شده‌اند
    active_days: set[int] = set()

    for sess, pl in resolved:
        c = problem.courses[sess.course_idx]
        prio = problem.teachers[c.teacher_idx].priority
        occ[(c.teacher_idx, pl.day)].update(problem.slots[i].order for i in pl.slot_idxs)
        course_days[c.idx].add(pl.day)
        course_slots[c.idx].update(pl.slot_idxs)
        
        # ثبت روز برای قید total_days
        active_days.add(pl.day)

        if "slot_quality" in br:
            br["slot_quality"] += w["slot_quality"] * prio * pl.penalty

    for (t, day), positions in occ.items():
        prio = problem.teachers[t].priority
        if "teacher_days" in br:
            br["teacher_days"] += w["teacher_days"] * prio
        if "teacher_gaps" in br:
            mins = [problem.slots[i].minutes for i in problem.slots_by_day[day]]
            br["teacher_gaps"] += w["teacher_gaps"] * prio * hole_units(mins, positions)

    if "course_spread" in br:
        for c, days in course_days.items():
            if problem.courses[c].sessions >= 2:
                br["course_spread"] += w["course_spread"] * sum(1 for d in days if d + 1 in days)

    if "soft_course_conflicts" in br:
        for cf in problem.conflicts:
            if cf.hard:
                continue
            for i in course_slots[cf.a] & course_slots[cf.b]:
                br["soft_course_conflicts"] += w["soft_course_conflicts"] * max(1, problem.slots[i].minutes // 30)

    # اعمال جریمه کل روزهای درگیر در صورت فعال بودن
    if "total_days" in br:
        br["total_days"] += w["total_days"] * len(active_days)

    return sum(br.values()), br