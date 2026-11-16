
import json
import sys
from collections import defaultdict

from core import SolveRequest, solve_schedule

path = sys.argv[1] if len(sys.argv) > 1 else "sample_request.json"
req = SolveRequest.model_validate_json(open(path, encoding="utf-8").read())

req.config.engine = "cpsat"  # یا "milp" یا "csp"
# ----------------------------------------------------

res = solve_schedule(req)

print("status:", res.status.value, "| objective:", res.objective, "| bound:", res.best_bound, "| time:", res.solve_time_sec)
for i in res.issues:
    print(f"[{i.severity}] {i.code}: {i.message}")
if res.infeasibility_core:
    print("conflicting groups:", res.infeasibility_core)

names = {c.id: c.name for c in req.courses}
tnames = {t.id: t.name for t in req.teachers}
by_day = defaultdict(list)
for a in res.assignments:
    by_day[a.day_name].append(a)
for day, items in by_day.items():
    print(f"\n{day}")
    for a in items:
        print(f"  {a.start}-{a.end}  {names[a.course_id]:<22} {tnames[a.teacher_id]}  (جلسه {a.session_index + 1})")

if res.metrics:
    print("\nobjective breakdown:", res.objective_breakdown)
    for tid, m in res.metrics["teachers"].items():
        print(f"  {m['name']:<14} days={m['days_on_campus']} hours={m['teaching_hours']} gaps={m['gap_hours']}h")