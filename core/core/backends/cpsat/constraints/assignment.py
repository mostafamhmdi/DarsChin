"""Core assignment constraints."""
from ..plugins import register_constraint


@register_constraint
class OnePlacementPerSession:
    """Every session of every course is placed exactly once."""
    name = "one_placement_per_session"

    def apply(self, ctx):
        for s in ctx.problem.sessions:
            lits = [ctx.x[(s.idx, i)] for i in range(len(ctx.problem.placements[s.idx]))]
            ctx.model.AddExactlyOne(lits)


@register_constraint
class CourseSessionsOnDistinctDays:
    """Two sessions of one course never fall on the same day (config switchable)."""
    name = "course_sessions_distinct_days"

    def apply(self, ctx):
        if not ctx.cfg.sessions_on_distinct_days:
            return
        for c in ctx.problem.courses:
            sess = ctx.problem.sessions_of_course[c.idx]
            if len(sess) < 2:
                continue
            for day in ctx.problem.slots_by_day:
                lits = ctx.lits_on_day(sess, day)
                if len(lits) > 1:
                    ctx.post(ctx.model.Add(sum(lits) <= 1), f"distinct_days:{c.id}")


@register_constraint
class SessionSymmetryBreaking:
    """
    Sessions of the same course are interchangeable; force them into increasing
    (day, start) order so the solver does not explore k! equivalent solutions.
    """
    name = "session_symmetry_breaking"

    def apply(self, ctx):
        for c in ctx.problem.courses:
            sess = ctx.problem.sessions_of_course[c.idx]
            keys = []
            for s in sess:
                keys.append(sum((pl.day * 1440 + pl.start) * ctx.x[(s, i)]
                                for i, pl in enumerate(ctx.problem.placements[s])))
            for a, b in zip(keys, keys[1:]):
                ctx.model.Add(a < b)
