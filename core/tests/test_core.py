import json
import pathlib
import random

import pytest
from fastapi.testclient import TestClient

from core import SolveRequest, solve_schedule
from core.api import app
from core.backends import Capabilities, SchedulerBackend, SolveOutcome, register_backend

SAMPLE = pathlib.Path(__file__).parent.parent / "examples" / "sample_request.json"
ENGINES = ["cpsat", "milp", "csp"]


@pytest.fixture(params=ENGINES)
def engine(request):
    return request.param


def load():
    return json.loads(SAMPLE.read_text(encoding="utf-8"))


def solve(d, engine="cpsat", limit=8):
    d = json.loads(json.dumps(d))
    d.setdefault("config", {}).update({"engine": engine, "time_limit_sec": limit})
    return solve_schedule(SolveRequest.model_validate(d))


def slot(i, day, a, b, pen=0):
    return {"id": i, "day": day, "start": a, "end": b, "penalty": pen}


def course(i, t, n=1, h=2):
    return {"id": i, "name": i, "teacher_id": t, "sessions_per_week": n, "session_hours": h,
            "level": "bachelor", "major": "CE"}


def teacher(i, days=(0,), prio=3):
    return {"id": i, "name": i, "available_days": list(days), "priority": prio}


# ------------------------------------------------------------------ all engines
def test_sample_is_solved_and_valid(engine):
    res = solve(load(), engine, limit=6)               # service re-verifies; invalid output would raise
    assert res.status.value in ("OPTIMAL", "FEASIBLE") and res.engine == engine
    assert len(res.assignments) == 18
    assert res.metrics["total_gap_hours"] == 0
    assert not [i for i in res.issues if i.code == "ENGINE_OBJECTIVE_MISMATCH"]   # engine == independent scorer


def test_hard_conflict_and_teacher_overlap_respected(engine):
    d = {"teachers": [teacher("A"), teacher("B")],
         "courses": [course("c1", "A"), course("c2", "A"), course("c3", "B")],
         "slots": [slot("s1", 0, "08:00", "10:00"), slot("s2", 0, "10:00", "12:00"), slot("s3", 0, "14:00", "16:00")],
         "conflicts": [{"course_a": "c1", "course_b": "c3"}]}
    res = solve(d, engine)
    when = {a.course_id: a.slot_ids[0] for a in res.assignments}
    assert when["c1"] != when["c2"] and when["c1"] != when["c3"]


def test_infeasible_detected(engine):
    d = {"teachers": [teacher("A"), teacher("B"), teacher("C")],
         "courses": [course("c1", "A"), course("c2", "B"), course("c3", "C")],
         "slots": [slot("s1", 0, "08:00", "10:00"), slot("s2", 0, "10:00", "12:00")],
         "conflicts": [{"course_a": "c1", "course_b": "c2"}, {"course_a": "c2", "course_b": "c3"},
                       {"course_a": "c1", "course_b": "c3"}]}
    res = solve(d, engine)
    assert res.status.value == "INFEASIBLE"
    if engine == "cpsat":
        assert res.infeasibility_core and all(g.startswith("conflict:") for g in res.infeasibility_core)
    else:
        assert any(i.code == "NO_INFEASIBILITY_CORE" for i in res.issues)


def test_soft_conflict_is_allowed_but_priced(engine):
    d = {"teachers": [teacher("A"), teacher("B")], "courses": [course("c1", "A"), course("c2", "B")],
         "slots": [slot("s1", 0, "08:00", "10:00")],
         "conflicts": [{"course_a": "c1", "course_b": "c2", "hard": False}]}
    res = solve(d, engine)
    assert res.status.value in ("OPTIMAL", "FEASIBLE") and res.objective_breakdown["soft_course_conflicts"] > 0


def test_daily_cap_respected(engine):
    d = {"teachers": [teacher("A", days=(0, 1))],
         "courses": [course("c1", "A", h=2), course("c2", "A", h=2)],
         "slots": [slot(f"{day}{h}", day, f"{h:02d}:00", f"{h + 1:02d}:00") for day in (0, 1) for h in (8, 9, 10, 11)],
         "config": {"max_teaching_hours_per_day": 2}}
    res = solve(d, engine)
    assert {a.day for a in res.assignments} == {0, 1}     # cap forces two different days


def test_disabled_module_switch(engine):
    d = load()
    d["config"]["disabled_modules"] = ["teacher_gaps", "course_spread"]
    res = solve(d, engine, limit=5)
    assert "teacher_gaps" not in res.objective_breakdown and "course_spread" not in res.objective_breakdown


# --------------------------------------------------- input validation (engine-agnostic)
def test_duration_that_fits_no_slot_is_reported():
    d = {"teachers": [teacher("A")], "courses": [course("c1", "A", h=3)],
         "slots": [slot("s1", 0, "08:00", "10:00"), slot("s2", 0, "10:00", "12:00")]}
    res = solve(d)
    assert res.status.value == "INVALID_INPUT" and any(i.code == "NO_PLACEMENT" for i in res.issues)


def test_lunch_break_does_not_merge_slots():
    d = {"teachers": [teacher("A")], "courses": [course("c1", "A", h=2)],
         "slots": [slot("s1", 0, "11:00", "12:00"), slot("s2", 0, "14:00", "15:00")]}
    assert solve(d).status.value == "INVALID_INPUT"


def test_teacher_overload_detected_before_solving():
    d = {"teachers": [teacher("A")], "courses": [course("c1", "A"), course("c2", "A")],
         "slots": [slot("s1", 0, "08:00", "10:00")]}
    res = solve(d)
    assert res.status.value == "INVALID_INPUT" and any(i.code == "TEACHER_OVERLOADED" for i in res.issues)


def test_unknown_reference_is_invalid_input():
    d = {"teachers": [teacher("A")], "courses": [course("c1", "ZZZ")], "slots": [slot("s1", 0, "08:00", "10:00")]}
    res = solve(d)
    assert res.status.value == "INVALID_INPUT" and res.issues[0].code == "UNKNOWN_TEACHER"


# ------------------------------------------------------ the architecture itself
def random_instance(seed):
    r = random.Random(seed)
    days = [0, 1, 2]
    slots = [slot(f"d{d}h{h}", d, f"{h:02d}:00", f"{h + 1:02d}:00", r.choice([0, 0, 1, 2]))
             for d in days for h in (8, 9, 10, 11, 14, 15)]
    teachers = [teacher(f"T{i}", days=r.sample(days, r.choice([2, 3])), prio=r.randint(1, 5)) for i in range(3)]
    courses = [course(f"C{i}", f"T{i % 3}", n=r.choice([1, 2]), h=r.choice([1, 2])) for i in range(5)]
    conflicts = [{"course_a": a, "course_b": b, "hard": r.random() < 0.6}
                 for a, b in r.sample([(f"C{i}", f"C{j}") for i in range(5) for j in range(i + 1, 5)], 3)]
    return {"teachers": teachers, "courses": courses, "slots": slots, "conflicts": conflicts}


@pytest.mark.parametrize("seed", range(12))
def test_differential_engines_agree(seed):
    """Three independent formulations must agree on the optimum (CSP: >= optimum, == if proved)."""
    d = random_instance(seed)
    ref = solve(d, "cpsat", limit=20)
    mil = solve(d, "milp", limit=20)
    csp = solve(d, "csp", limit=10)
    assert ref.status == mil.status or {ref.status.value, mil.status.value} <= {"INVALID_INPUT"}
    if ref.status.value == "OPTIMAL":
        assert mil.status.value == "OPTIMAL" and mil.objective == ref.objective
        assert csp.status.value in ("OPTIMAL", "FEASIBLE") and csp.objective >= ref.objective
        if csp.status.value == "OPTIMAL":
            assert csp.objective == ref.objective
    elif ref.status.value == "INFEASIBLE":
        assert csp.status.value == "INFEASIBLE"
    else:
        assert csp.status.value == ref.status.value == "INVALID_INPUT"


def test_unknown_and_broken_engines_are_reported_not_crashed():
    res = solve(load(), "quantum")
    assert res.status.value == "INVALID_INPUT" and res.issues[0].code == "UNKNOWN_ENGINE"
    register_backend("broken", "no.such.module:Nope")
    res = solve(load(), "broken")
    assert res.status.value == "INVALID_INPUT" and any(i.code == "ENGINE_UNAVAILABLE" for i in res.issues)


class _SloppyBackend(SchedulerBackend):
    """Plug-in that ignores every rule: first placement for all sessions."""
    name = "sloppy"
    capabilities = Capabilities(False, False, False)

    def _solve(self, problem):
        return SolveOutcome(status="FEASIBLE", picks=[(s.idx, 0) for s in problem.sessions])


def test_safety_net_rejects_an_invalid_engine_result():
    import core.backends.registry as reg
    reg._PATHS["sloppy"] = f"{__name__}:_SloppyBackend"
    with pytest.raises(RuntimeError, match="invalid timetable"):
        solve(load(), "sloppy")


def test_http_api():
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}
    engines = client.get("/v1/engines").json()
    assert {"cpsat", "milp", "csp"} <= set(engines) and engines["milp"]["available"]
    r = client.post("/v1/schedule/solve", json=load())
    assert r.status_code == 200 and r.json()["status"] in ("OPTIMAL", "FEASIBLE")
    assert "properties" in client.get("/v1/schema").json()
