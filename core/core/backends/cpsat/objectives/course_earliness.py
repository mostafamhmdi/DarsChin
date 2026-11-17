from ....scoring import lateness_units
from ..plugins import register_objective


@register_objective
class CourseEarliness:
    """
    Heavier course (course.weight) -> earlier in its day, never at the end of the day.
    Cost of a placement = w * course.weight * lateness, lateness = 30-min units after the
    first slot of that day. It is linear in x, so it is exact (no auxiliary variables).
    """
    name = "course_earliness"

    def build(self, ctx):
        w = ctx.cfg.weights.course_earliness
        p = ctx.problem
        for s in p.sessions:
            weight = p.courses[s.course_idx].weight
            if not weight:
                continue
            for i, pl in enumerate(p.placements[s.idx]):
                ctx.add_penalty(self.name, w * weight * lateness_units(p, pl), ctx.x[(s.idx, i)])
