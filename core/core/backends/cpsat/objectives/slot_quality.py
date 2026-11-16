from ..plugins import register_objective


@register_objective
class SlotQuality:
    """
    Slots carry a `penalty` (e.g. 08:00 and 17:00 are unpopular). Cost is multiplied
    by the teacher's priority so high-priority teachers win the good slots.
    """
    name = "slot_quality"

    def build(self, ctx):
        w = ctx.cfg.weights.slot_quality
        p = ctx.problem
        for s in p.sessions:
            prio = p.teachers[p.courses[s.course_idx].teacher_idx].priority
            for i, pl in enumerate(p.placements[s.idx]):
                ctx.add_penalty(self.name, w * prio * pl.penalty, ctx.x[(s.idx, i)])
