"""Pairs of courses that must never run at the same time."""
from ..plugins import register_constraint


@register_constraint
class HardCourseConflicts:
    name = "hard_course_conflicts"

    def apply(self, ctx):
        p = ctx.problem
        for cf in p.conflicts:
            if not cf.hard:
                continue
            a, b = p.courses[cf.a], p.courses[cf.b]
            sa, sb = p.sessions_of_course[a.idx], p.sessions_of_course[b.idx]
            for slot in p.slots:
                la, lb = ctx.lits_at_slot(sa, slot.idx), ctx.lits_at_slot(sb, slot.idx)
                if la and lb:
                    ctx.post(ctx.model.Add(sum(la) + sum(lb) <= 1), f"conflict:{a.id}|{b.id}")
