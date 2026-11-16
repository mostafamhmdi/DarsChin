"""Tiny plugin registry. A constraint / objective module = one class + one decorator."""
from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:  # pragma: no cover
    from .model_builder import ModelContext


class ConstraintModule(Protocol):
    name: str

    def apply(self, ctx: "ModelContext") -> None: ...


class ObjectiveModule(Protocol):
    name: str

    def build(self, ctx: "ModelContext") -> None: ...


CONSTRAINTS: dict[str, type] = {}
OBJECTIVES: dict[str, type] = {}


def register_constraint(cls):
    CONSTRAINTS[cls.name] = cls
    return cls


def register_objective(cls):
    OBJECTIVES[cls.name] = cls
    return cls
