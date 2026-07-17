"""Scans this repo's own dependencies — the backend's installed Python
packages and the frontend's package.json — and loads them into the
inventory database. This is what "Prioritize Exposures" actually analyzes:
no manifest paste, no user input. The tool audits its own supply chain.
"""
from __future__ import annotations

import json
import re
from importlib import metadata
from pathlib import Path

from . import config, db

BACKEND_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = (BACKEND_DIR / config.FRONTEND_DIR) if config.FRONTEND_DIR else BACKEND_DIR.parent / "frontend"

# Real packages, real (patched-since) CVEs, intentionally outdated pins —
# not this project's actual dependencies. Tagged source="demo" so the UI
# never presents them as part of the real backend/frontend scan. Only
# merged in when INCLUDE_DEMO_PACKAGES=true (see config.py).
DEMO_PACKAGES = [
    {"name": "pyyaml", "version": "5.3", "ecosystem": "PyPI", "source": "demo"},
    {"name": "requests", "version": "2.25.0", "ecosystem": "PyPI", "source": "demo"},
    {"name": "pillow", "version": "8.0.0", "ecosystem": "PyPI", "source": "demo"},
    {"name": "lodash", "version": "4.17.15", "ecosystem": "npm", "source": "demo"},
]

_REQ_NAME_RE = re.compile(r"^([A-Za-z0-9_.\-]+)")


def scan_backend_packages() -> list[dict]:
    """Reads requirements.txt for the package names, then asks the running
    interpreter for the exact installed version of each — the real version
    in use, not just the range requirements.txt allows."""
    req_file = BACKEND_DIR / "requirements.txt"
    if not req_file.exists():
        return []

    packages = []
    for line in req_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        base = line.split("[")[0]  # strip extras, e.g. uvicorn[standard]
        match = _REQ_NAME_RE.match(base)
        if not match:
            continue
        name = match.group(1)
        try:
            version = metadata.version(name)
        except metadata.PackageNotFoundError:
            continue
        packages.append({"name": name, "version": version, "ecosystem": "PyPI", "source": "backend"})
    return packages


def _lockfile_versions() -> dict[str, str]:
    """Exact resolved versions from package-lock.json (lockfile v2/v3 shape).
    Falls back to the package.json-declared version (with ^/~ stripped) for
    any package this doesn't cover."""
    lock_file = FRONTEND_DIR / "package-lock.json"
    if not lock_file.exists():
        return {}

    data = json.loads(lock_file.read_text())
    versions: dict[str, str] = {}
    for path, info in data.get("packages", {}).items():
        prefix = "node_modules/"
        if not path.startswith(prefix):
            continue
        name = path[len(prefix):]
        if "node_modules/" in name:  # skip nested transitive copies
            continue
        if "version" in info:
            versions[name] = info["version"]
    return versions


def scan_frontend_packages() -> list[dict]:
    pkg_file = FRONTEND_DIR / "package.json"
    if not pkg_file.exists():
        return []

    data = json.loads(pkg_file.read_text())
    declared = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    resolved = _lockfile_versions()

    packages = []
    for name, declared_version in declared.items():
        version = resolved.get(name) or declared_version.lstrip("^~=")
        packages.append({"name": name, "version": version, "ecosystem": "npm", "source": "frontend"})
    return packages


def seed_inventory() -> list[dict]:
    db.init_db()
    deps = scan_backend_packages() + scan_frontend_packages()
    if config.INCLUDE_DEMO_PACKAGES:
        deps += DEMO_PACKAGES
    db.replace_dependencies(deps)
    return deps
