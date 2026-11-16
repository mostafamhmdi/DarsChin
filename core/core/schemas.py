"""
Public data contract of the core (input + output).

This file is the single source of truth shared with the backend developer:
    SolveRequest.model_json_schema()  ->  JSON Schema / OpenAPI

Conventions
-----------
* day      : integer 0..6  (0 = Saturday, 1 = Sunday, ..., 6 = Friday)
* time     : "HH:MM" 24h string
* all ids  : opaque strings owned by the backend (DB primary keys), never names
"""
from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

DAY_NAMES_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- #
# INPUT
# --------------------------------------------------------------------------- #
class Level(str, Enum):
    BACHELOR = "bachelor"
    MASTER = "master"
    PHD = "phd"


class TeacherIn(_Base):
    id: str
    name: str
    available_days: list[int] = Field(min_length=1, description="days the teacher can come")
    priority: int = Field(3, ge=1, le=5, description="1..5; higher = his/her preferences weigh more")
    unavailable_slot_ids: list[str] = Field(default_factory=list)

    @field_validator("available_days")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("days must be in 0..6")
        return sorted(set(v))


class SlotIn(_Base):
    id: str
    day: int = Field(ge=0, le=6)
    start: str
    end: str
    penalty: int = Field(0, ge=0, le=20, description="undesirability of this slot (0 = best)")

    @field_validator("start", "end")
    @classmethod
    def _fmt(cls, v: str) -> str:
        if not _HHMM.match(v):
            raise ValueError("time must be HH:MM")
        return v

    @model_validator(mode="after")
    def _order(self) -> "SlotIn":
        if self.end <= self.start:
            raise ValueError("end must be after start")
        return self


class CourseIn(_Base):
    id: str
    name: str
    teacher_id: str
    sessions_per_week: int = Field(ge=1, le=7)
    session_hours: float = Field(gt=0, le=8, description="duration of EACH session, e.g. 2 or 1.5")
    level: Level
    major: str

    @property
    def session_minutes(self) -> int:
        return round(self.session_hours * 60)


class ConflictIn(_Base):
    """Two courses that must not run at the same time (the 'pre/co-requisite' list in the UI)."""
    course_a: str
    course_b: str
    hard: bool = True


class Weights(_Base):
    teacher_days: int = Field(10, ge=0)
    teacher_gaps: int = Field(2, ge=0)
    course_spread: int = Field(5, ge=0)
    slot_quality: int = Field(1, ge=0)
    soft_conflict: int = Field(20, ge=0)


class SolverConfig(_Base):
    engine: str = Field("cpsat", description="cpsat | milp | csp (see GET /v1/engines)")
    engine_options: dict = Field(default_factory=dict, description="engine specific knobs, e.g. {'solver': 'SCIP'}")
    time_limit_sec: float = Field(30, gt=0, le=3600)
    num_workers: int = Field(8, ge=1, le=64)
    random_seed: int = 0
    sessions_on_distinct_days: bool = True
    max_teaching_hours_per_day: float | None = Field(None, gt=0)
    weights: Weights = Field(default_factory=Weights)
    disabled_modules: list[str] = Field(default_factory=list, description="names of constraint/objective plugins to switch off")


class SolveRequest(_Base):
    teachers: list[TeacherIn]
    courses: list[CourseIn]
    slots: list[SlotIn]
    conflicts: list[ConflictIn] = Field(default_factory=list)
    config: SolverConfig = Field(default_factory=SolverConfig)


# --------------------------------------------------------------------------- #
# OUTPUT
# --------------------------------------------------------------------------- #
class SolveStatus(str, Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"          # a good solution found, optimality not proven (time limit)
    INFEASIBLE = "INFEASIBLE"      # hard constraints cannot all hold
    INVALID_INPUT = "INVALID_INPUT"
    UNKNOWN = "UNKNOWN"            # time limit hit without any solution


class Issue(_Base):
    code: str
    severity: str  # "error" | "warning"
    message: str
    refs: list[str] = Field(default_factory=list)


class AssignmentOut(_Base):
    course_id: str
    session_index: int
    teacher_id: str
    day: int
    day_name: str
    start: str
    end: str
    slot_ids: list[str]


class SolveResponse(_Base):
    status: SolveStatus
    engine: str | None = None
    objective: float | None = None
    best_bound: float | None = None
    solve_time_sec: float | None = None
    assignments: list[AssignmentOut] = Field(default_factory=list)
    objective_breakdown: dict[str, int] = Field(default_factory=dict)
    metrics: dict = Field(default_factory=dict)
    issues: list[Issue] = Field(default_factory=list)
    infeasibility_core: list[str] = Field(default_factory=list)
