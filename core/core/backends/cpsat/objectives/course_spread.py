from ..plugins import register_objective


@register_objective
class CourseSpread:
    """A multi-session course should not sit on two back-to-back days (Sat+Sun -> prefer Sat+Mon)."""
    name = "course_spread"

    def build(self, ctx):
        w = ctx.cfg.weights.course_spread
        if w == 0:
            return
        p, m = ctx.problem, ctx.model
        days = sorted(p.slots_by_day)
        for c in p.courses:
            sess = p.sessions_of_course[c.idx]
            if len(sess) < 2:
                continue
            y = {d: ctx._or(ctx.lits_on_day(sess, d), f"y_c{c.idx}_d{d}") for d in days}
            for d in days:
                if d + 1 in y and y[d] is not None and y[d + 1] is not None:
                    adj = m.NewBoolVar(f"adj_c{c.idx}_d{d}")
                    m.Add(adj >= y[d] + y[d + 1] - 1)
                    ctx.add_penalty(self.name, w, adj)
