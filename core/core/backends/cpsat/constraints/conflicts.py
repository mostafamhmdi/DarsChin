"""Pairs of courses that must never run at the same time."""
from ....preprocess import term_groups
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


@register_constraint
class TermNoOverlap:
    """
    Courses of the same term (= the same students) never share a slot.
    One diagnostic group per term, so an infeasible core says e.g. "term_overlap:Term3".
    """
    name = "term_no_overlap"

    def apply(self, ctx):
        p = ctx.problem
        for term, course_idxs in term_groups(p).items():
            sess = [s for c in course_idxs for s in p.sessions_of_course[c]]
            if len(sess) < 2:
                continue
            for slot in p.slots:
                lits = ctx.lits_at_slot(sess, slot.idx)
                if len(lits) > 1:
                    ctx.post(ctx.model.Add(sum(lits) <= 1), f"term_overlap:{term}")
