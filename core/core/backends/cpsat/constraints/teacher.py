"""Teacher related hard constraints. (Availability is already pruned in preprocess.)"""
from ..plugins import register_constraint


@register_constraint
class TeacherNoOverlap:
    """A teacher is in at most one class at any slot."""
    name = "teacher_no_overlap"

    def apply(self, ctx):
        p = ctx.problem
        for t in p.teachers:
            sess = p.sessions_of_teacher.get(t.idx, [])
            if len(sess) < 2:
                continue
            for slot in p.slots:
                lits = ctx.lits_at_slot(sess, slot.idx)
                if len(lits) > 1:
                    ctx.post(ctx.model.Add(sum(lits) <= 1), f"teacher_overlap:{t.id}")


@register_constraint
class TeacherDailyLoad:
    """Optional cap on teaching minutes per day (config.max_teaching_hours_per_day)."""
    name = "teacher_daily_load"

    def apply(self, ctx):
        cap_h = ctx.cfg.max_teaching_hours_per_day
        if not cap_h:
            return
        p = ctx.problem
        cap = int(cap_h * 60)
        for t in p.teachers:
            sess = p.sessions_of_teacher.get(t.idx, [])
            for day in p.slots_by_day:
                terms = [(pl.end - pl.start) * ctx.x[(s, i)]
                         for s in sess for i, pl in enumerate(p.placements[s]) if pl.day == day]
                if terms:
                    ctx.post(ctx.model.Add(sum(terms) <= cap), f"daily_load:{t.id}")
