from ..plugins import register_objective


@register_objective
class SoftCourseConflicts:
    """Conflicts flagged hard=false may overlap, at a price per overlapping 30 minutes."""
    name = "soft_course_conflicts"

    def build(self, ctx):
        w = ctx.cfg.weights.soft_conflict
        p, m = ctx.problem, ctx.model
        for cf in p.conflicts:
            if cf.hard:
                continue
            sa, sb = p.sessions_of_course[cf.a], p.sessions_of_course[cf.b]
            for slot in p.slots:
                la, lb = ctx.lits_at_slot(sa, slot.idx), ctx.lits_at_slot(sb, slot.idx)
                if la and lb:
                    o = m.NewBoolVar(f"soft_{cf.a}_{cf.b}_{slot.idx}")
                    m.Add(o >= sum(la) + sum(lb) - 1)
                    ctx.add_penalty(self.name, w * max(1, slot.minutes // 30), o)
