#!/usr/bin/env python3
"""Read-only batch geometry inspection for WMD sales-folder supplement review.

The implementation deliberately reuses ``describe_source`` from the strict
sales-folder sanitizer, but returns only the immutable page-box and guide-layer
fingerprints needed by the additive supplement generator.  It never writes or
sanitizes a PDF.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
from typing import Any


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
SANITIZER_PATH = (
    SCRIPT_DIRECTORY.parent
    / "product-templates"
    / "sanitize_wmd_sales_folder_template.py"
)
REQUIRED_LAYERS = ("Beschnitt Seite", "Rillen", "Schneiden")


def load_sanitizer() -> Any:
    spec = importlib.util.spec_from_file_location(
        "wmd_sales_folder_sanitizer_for_supplement",
        SANITIZER_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load sanitizer module: {SANITIZER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def inspect_one(sanitizer: Any, item: dict[str, Any]) -> dict[str, Any]:
    source_input = Path(str(item.get("sourcePath") or ""))
    if source_input.is_symlink() or not source_input.is_file():
        raise RuntimeError(
            f"Source PDF must be a regular non-symlink file: {source_input}"
        )
    source = source_input.resolve()
    geometry = {
        "format": str(item["geometry"]["format"]),
        "construction": str(item["geometry"]["construction"]),
        "print": str(item["geometry"]["print"]),
        "spineMm": int(item["geometry"]["spine"]),
    }
    observed = sanitizer.describe_source(source, geometry, str(item["finishKey"]))
    evidence = observed["sourceEvidence"]
    fingerprints = evidence["geometryFingerprints"]
    missing = [name for name in REQUIRED_LAYERS if name not in fingerprints]
    if missing:
        raise RuntimeError(
            f"Required guide layers missing from {source}: {', '.join(missing)}"
        )
    return {
        "requestKey": str(item["requestKey"]),
        "sha256": evidence["sha256"],
        "pageCount": evidence["pageCount"],
        "pageBoxesSha256": evidence["pageBoxesSha256"],
        "geometryFingerprints": {
            name: fingerprints[name] for name in REQUIRED_LAYERS
        },
    }


def main() -> int:
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, list) or not request:
            raise RuntimeError("Inspection request must be a non-empty JSON array")
        sanitizer = load_sanitizer()
        output = [inspect_one(sanitizer, item) for item in request]
        json.dump(output, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.stdout.write("\n")
        return 0
    except Exception as exc:  # fail closed at the process boundary
        print(f"REFUSED: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
