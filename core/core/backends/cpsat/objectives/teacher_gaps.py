from ..plugins import register_objective


@register_objective
class TeacherGaps:
    """
    Penalise 'holes' in a teacher's day: a free slot that has an occupied slot
    both before and after it (in slot order within the day).

        before[i] >= occ[i-1], before[i] >= before[i-1]     (running OR to the left)
        after[i]  >= occ[i+1], after[i]  >= after[i+1]      (running OR to the right)
        hole[i]   >= before[i] + after[i] - occ[i] - 1

    before/after/hole are only lower-bounded: minimisation makes them tight.
    Cost of a hole is proportional to its length (per 30 minutes).
    """
    name = "teacher_gaps"

    def build(self, ctx):
        w = ctx.cfg.weights.teacher_gaps
        if w == 0:
            return
        p, m = ctx.problem, ctx.model
        for t in p.teachers:
            if len(p.sessions_of_teacher.get(t.idx, [])) < 2:
                continue
            for day in t.days:
                order = p.slots_by_day.get(day, [])
                n = len(order)
                if n < 3:
                    continue
                occ = [ctx.teacher_slot_occ(t.idx, s) for s in order]

                before = [None] * n
                for i in range(1, n):
                    if occ[i - 1] is None and before[i - 1] is None:
                        continue
                    b = m.NewBoolVar(f"bef_t{t.idx}_d{day}_{i}")
                    if occ[i - 1] is not None:
                        m.Add(b >= occ[i - 1])
                    if before[i - 1] is not None:
                        m.Add(b >= before[i - 1])
                    before[i] = b

                after = [None] * n
                for i in range(n - 2, -1, -1):
                    if occ[i + 1] is None and after[i + 1] is None:
                        continue
                    a = m.NewBoolVar(f"aft_t{t.idx}_d{day}_{i}")
                    if occ[i + 1] is not None:
                        m.Add(a >= occ[i + 1])
                    if after[i + 1] is not None:
                        m.Add(a >= after[i + 1])
                    after[i] = a

                for i in range(1, n - 1):
                    if before[i] is None or after[i] is None:
                        continue
                    h = m.NewBoolVar(f"hole_t{t.idx}_d{day}_{i}")
                    expr = before[i] + after[i] - 1
                    if occ[i] is not None:
                        expr = expr - occ[i]
                    m.Add(h >= expr)
                    length = max(1, p.slots[order[i]].minutes // 30)
                    ctx.add_penalty(self.name, w * t.priority * length, h)
