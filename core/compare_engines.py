"""
Developer tool (NOT part of the service): run several engines on the same request and compare.
Because every engine's result is re-scored by the same independent judge, numbers are comparable.

    python compare_engines.py [request.json] [engine ...]     e.g.  python compare_engines.py x.json cpsat csp
"""
import json
import sys

from core import SolveRequest, solve_schedule
from core.backends import list_backends

path = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith(".json") else "sample_request.json"
wanted = [a for a in sys.argv[1:] if not a.endswith(".json")] or [n for n, i in list_backends().items() if i["available"]]
base = json.load(open(path, encoding="utf-8"))

rows = []
for eng in wanted:
    d = json.loads(json.dumps(base))
    d.setdefault("config", {})["engine"] = eng
    r = solve_schedule(SolveRequest.model_validate(d))
    rows.append((eng, r.status.value, r.objective, r.best_bound, r.solve_time_sec, r.metrics.get("engine_stats", {})))

best = min((r[2] for r in rows if r[2] is not None), default=None)
print(f"{'engine':8}{'status':12}{'objective':>10}{'vs best':>9}{'bound':>8}{'time(s)':>9}   stats")
for eng, st, obj, bound, t, stats in rows:
    gap = "-" if obj is None or best is None else f"+{obj - best:g}"
    print(f"{eng:8}{st:12}{'-' if obj is None else f'{obj:g}':>10}{gap:>9}{'-' if bound is None else f'{bound:g}':>8}{t or 0:>9.2f}   {stats}")
