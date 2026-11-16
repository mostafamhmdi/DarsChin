from ..plugins import register_objective


@register_objective
class TeacherDays:
    """Fewer distinct days on campus per teacher. Weighted by teacher priority."""
    name = "teacher_days"

    def build(self, ctx):
        w = ctx.cfg.weights.teacher_days
        for t in ctx.problem.teachers:
            for day in t.days:
                ctx.add_penalty(self.name, w * t.priority, ctx.teacher_day_used(t.idx, day))
