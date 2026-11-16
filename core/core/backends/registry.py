"""
Lazy backend factory.

Engines are registered by *import path*, not by class: an engine whose optional dependency is
missing (or whose code is never used) is never imported, so it cannot break the others.
Third parties can add an engine with `register_backend("name", "pkg.module:Class")`.
"""
from __future__ import annotations

from importlib import import_module

from .base import SchedulerBackend

_PATHS: dict[str, str] = {
    "cpsat": "core.backends.cpsat:CpSatBackend",
    "milp": "core.backends.milp:MilpBackend",
    "csp": "core.backends.csp:CspBackend",
}


class UnknownBackend(KeyError):
    pass


def register_backend(name: str, path: str) -> None:
    _PATHS[name] = path


def backend_class(name: str) -> type[SchedulerBackend]:
    if name not in _PATHS:
        raise UnknownBackend(name)
    module, cls = _PATHS[name].split(":")
    return getattr(import_module(module), cls)


def get_backend(name: str) -> SchedulerBackend:
    return backend_class(name)()


def list_backends() -> dict[str, dict]:
    """name -> {available, capabilities}. Imports engines lazily and survives broken ones."""
    out: dict[str, dict] = {}
    for name in _PATHS:
        try:
            cls = backend_class(name)
            out[name] = {"available": bool(cls.is_available()), "capabilities": vars(cls.capabilities)}
        except Exception as exc:  # noqa: BLE001
            out[name] = {"available": False, "error": f"{type(exc).__name__}: {exc}"}
    return out
