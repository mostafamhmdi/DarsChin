"""
Orchestrator - the ONLY entry point the rest of the system should call.

    request -> validate -> problem -> pre-check -> [ backend.solve ] -> verify -> score -> response
                                                     ^ cpsat | milp | csp (chosen by config.engine)

The service knows nothing about CP-SAT / MILP / CSP internals: it talks to `SchedulerBackend`.
"""
from __future__ import annotations

from .backends import UnknownBackend, get_backend, list_backends
from .backends.registry import backend_class
from .evaluation import compute_metrics, resolve, verify
from .preprocess import build_problem, min_to_hhmm
from .schemas import (DAY_NAMES_FA, AssignmentOut, Issue, SolveRequest,
                      SolveResponse, SolveStatus)
from .scoring import score
from .validation import has_errors, validate_problem, validate_request


def _invalid(issues, engine):
    return SolveResponse(status=SolveStatus.INVALID_INPUT, engine=engine, issues=issues)


def solve_schedule(req: SolveRequest) -> SolveResponse:
    engine = req.config.engine

    issues = validate_request(req)
    try:
        backend_cls = backend_class(engine)
        if not backend_cls.is_available():
            issues.append(Issue(code="ENGINE_UNAVAILABLE", severity="error",
                                message=f"engine '{engine}' is not available on this server", refs=[engine]))
    except UnknownBackend:
        issues.append(Issue(code="UNKNOWN_ENGINE", severity="error",
                           message=f"unknown engine '{engine}'; known: {sorted(list_backends())}", refs=[engine]))
    except Exception as exc:  # noqa: BLE001  (broken optional dependency)
        issues.append(Issue(code="ENGINE_UNAVAILABLE", severity="error",
                            message=f"engine '{engine}' failed to load: {exc}", refs=[engine]))
    if has_errors(issues):
        return _invalid(issues, engine)

    problem = build_problem(req)
    issues += validate_problem(problem)
    if has_errors(issues):
        return _invalid(issues, engine)

    backend = get_backend(engine)
    out = backend.solve(problem)

    if out.status == "INFEASIBLE":
        if not backend.capabilities.explains_infeasibility:
            issues.append(Issue(code="NO_INFEASIBILITY_CORE", severity="warning", refs=[engine],
                                message=f"engine '{engine}' cannot explain infeasibility; re-run with engine=cpsat"))
        return SolveResponse(status=SolveStatus.INFEASIBLE, engine=engine, issues=issues,
                             solve_time_sec=round(out.wall_time, 3), infeasibility_core=out.infeasibility_core)
    if out.status not in ("OPTIMAL", "FEASIBLE"):
        return SolveResponse(status=SolveStatus.UNKNOWN, engine=engine, issues=issues,
                             solve_time_sec=round(out.wall_time, 3))

    resolved = resolve(problem, out.picks)
    violations = verify(problem, resolved)
    if violations:  # must never happen; protects against bugs in ANY engine
        raise RuntimeError(f"engine '{engine}' produced an invalid timetable: " + "; ".join(violations))

    total, breakdown = score(problem, resolved)
    if out.objective is not None and abs(out.objective - total) > 1e-6:
        issues.append(Issue(code="ENGINE_OBJECTIVE_MISMATCH", severity="warning", refs=[engine],
                            message=f"engine reported {out.objective}, independent scorer computed {total}"))

    assignments = []
    for sess, pl in resolved:
        c = problem.courses[sess.course_idx]
        assignments.append(AssignmentOut(
            course_id=c.id, session_index=sess.k, teacher_id=problem.teachers[c.teacher_idx].id,
            day=pl.day, day_name=DAY_NAMES_FA[pl.day],
            start=min_to_hhmm(pl.start), end=min_to_hhmm(pl.end),
            slot_ids=[problem.slots[i].id for i in pl.slot_idxs]))
    assignments.sort(key=lambda a: (a.day, a.start, a.course_id))

    metrics = compute_metrics(problem, resolved)
    metrics["engine_stats"] = out.stats
    return SolveResponse(
        status=SolveStatus(out.status), engine=engine, objective=total, best_bound=out.best_bound,
        solve_time_sec=round(out.wall_time, 3), assignments=assignments,
        objective_breakdown=breakdown, metrics=metrics, issues=issues)
