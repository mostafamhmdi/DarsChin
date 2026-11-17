from ..plugins import register_objective


@register_objective
class TotalDays:
    """Fewer distinct days on which ANY class is held (whole department)."""
    name = "total_days"

    def build(self, ctx):
        w = ctx.cfg.weights.total_days
        everyone = [s.idx for s in ctx.problem.sessions]
        for day in ctx.problem.slots_by_day:
            ctx.add_penalty(self.name, w, ctx._or(ctx.lits_on_day(everyone, day), f"total_day{day}"))
