from ....preprocess import term_groups
from ..plugins import register_objective


@register_objective
class TermDays:
    """
    Students of one term should come to campus on as few days as possible:
    pay once per (term, day) on which at least one course of that term is held.
    """
    name = "term_days"

    def build(self, ctx):
        w = ctx.cfg.weights.term_days
        p = ctx.problem
        for term, course_idxs in term_groups(p).items():
            sess = [s for c in course_idxs for s in p.sessions_of_course[c]]
            for day in p.slots_by_day:
                used = ctx._or(ctx.lits_on_day(sess, day), f"term_{term}_d{day}")
                ctx.add_penalty(self.name, w, used)
