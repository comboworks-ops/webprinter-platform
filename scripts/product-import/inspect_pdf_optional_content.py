#!/usr/bin/env python3
"""Read-only PDF optional-content and spot-color inspection for supplier evidence."""

from __future__ import annotations

import json
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import pypdf
from pypdf import PdfReader


def resolve(value: Any) -> Any:
    current = value
    for _ in range(12):
        getter = getattr(current, "get_object", None)
        if getter is None:
            return current
        resolved = getter()
        if resolved is current:
            return current
        current = resolved
    raise ValueError("PDF object indirection exceeded the safety limit")


def clean_name(value: Any) -> str:
    text = str(value or "")
    return text[1:] if text.startswith("/") else text


def indirect_key(reference: Any, resolved: Any) -> str:
    if hasattr(reference, "idnum"):
        return f"{reference.idnum}:{getattr(reference, 'generation', 0)}"
    return f"direct:{id(resolved)}"


def state_from_usage(usage: Any, category: str, state_key: str) -> str | None:
    usage_dict = resolve(usage) if usage else None
    if not isinstance(usage_dict, Mapping):
        return None
    category_dict = resolve(usage_dict.get(category)) if usage_dict.get(category) else None
    if not isinstance(category_dict, Mapping):
        return None
    value = category_dict.get(state_key)
    return clean_name(value) or None


def referenced_layers(value: Any, layer_by_reference: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    resolved = resolve(value) if value else []
    if not isinstance(resolved, Sequence) or isinstance(resolved, (str, bytes)):
        return []
    output: list[dict[str, Any]] = []
    for reference in resolved:
        group = resolve(reference)
        details = layer_by_reference.get(indirect_key(reference, group))
        if details:
            output.append({"index": details["index"], "name": details["name"]})
    return output


def flatten_order(value: Any, layer_by_reference: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    resolved = resolve(value) if value else []
    if not isinstance(resolved, Sequence) or isinstance(resolved, (str, bytes)):
        return []
    output: list[dict[str, Any]] = []
    for item in resolved:
        item_resolved = resolve(item)
        if isinstance(item_resolved, Sequence) and not isinstance(item_resolved, (str, bytes)):
            output.extend(flatten_order(item_resolved, layer_by_reference))
            continue
        details = layer_by_reference.get(indirect_key(item, item_resolved))
        if details:
            output.append({"index": details["index"], "name": details["name"]})
    return output


def inspect_optional_content(reader: PdfReader) -> dict[str, Any]:
    root = resolve(reader.trailer["/Root"])
    raw_properties = root.get("/OCProperties")
    if raw_properties is None:
        return {
            "propertiesPresent": False,
            "ocgCount": 0,
            "layerNames": [],
            "layers": [],
            "defaultConfiguration": None,
        }
    properties = resolve(raw_properties)
    if not isinstance(properties, Mapping):
        raise ValueError("/OCProperties is present but is not a dictionary")
    if "/OCGs" not in properties:
        raise ValueError("/OCProperties is present but /OCGs is missing")
    raw_groups = resolve(properties.get("/OCGs"))
    if not isinstance(raw_groups, Sequence) or isinstance(raw_groups, (str, bytes)):
        raise ValueError("/OCProperties/OCGs is not an array")

    layers: list[dict[str, Any]] = []
    layer_by_reference: dict[str, dict[str, Any]] = {}
    for index, reference in enumerate(raw_groups):
        group = resolve(reference)
        if not isinstance(group, Mapping):
            raise ValueError(f"OCG {index} is not a dictionary")
        name = str(group.get("/Name") or "").strip()
        if not name:
            raise ValueError(f"OCG {index} has no layer name")
        usage = group.get("/Usage")
        layer = {
            "index": index,
            "name": name,
            "type": clean_name(group.get("/Type")) or None,
            "intent": clean_name(group.get("/Intent")) or None,
            "viewState": state_from_usage(usage, "/View", "/ViewState"),
            "printState": state_from_usage(usage, "/Print", "/PrintState"),
            "exportState": state_from_usage(usage, "/Export", "/ExportState"),
        }
        layers.append(layer)
        layer_by_reference[indirect_key(reference, group)] = layer

    default_raw = properties.get("/D")
    default = resolve(default_raw) if default_raw else None
    if default is not None and not isinstance(default, Mapping):
        raise ValueError("/OCProperties/D is not a dictionary")
    default_configuration = None
    if isinstance(default, Mapping):
        default_configuration = {
            "name": str(default.get("/Name") or "").strip() or None,
            "baseState": clean_name(default.get("/BaseState")) or None,
            "onLayers": referenced_layers(default.get("/ON"), layer_by_reference),
            "offLayers": referenced_layers(default.get("/OFF"), layer_by_reference),
            "orderedLayers": flatten_order(default.get("/Order"), layer_by_reference),
        }

    return {
        "propertiesPresent": True,
        "ocgCount": len(layers),
        "layerNames": [layer["name"] for layer in layers],
        "layers": layers,
        "defaultConfiguration": default_configuration,
    }


def color_space_declaration(definition: Any) -> dict[str, Any] | None:
    resolved = resolve(definition)
    if not isinstance(resolved, Sequence) or isinstance(resolved, (str, bytes)) or not resolved:
        return None
    color_space_type = clean_name(resolved[0])
    if color_space_type == "Separation" and len(resolved) >= 3:
        return {
            "type": "Separation",
            "colorantNames": [clean_name(resolved[1])],
            "alternateColorSpace": clean_name(resolve(resolved[2])) or str(resolve(resolved[2])),
        }
    if color_space_type == "DeviceN" and len(resolved) >= 3:
        raw_names = resolve(resolved[1])
        if not isinstance(raw_names, Sequence) or isinstance(raw_names, (str, bytes)):
            raise ValueError("DeviceN colorant names are not an array")
        return {
            "type": "DeviceN",
            "colorantNames": [clean_name(name) for name in raw_names],
            "alternateColorSpace": clean_name(resolve(resolved[2])) or str(resolve(resolved[2])),
        }
    return None


def inspect_spot_colors(reader: PdfReader) -> dict[str, Any]:
    declarations: dict[tuple[str, tuple[str, ...], str], dict[str, Any]] = {}

    def record(definition: Any, resource_name: Any, page_number: int, location: str) -> None:
        declaration = color_space_declaration(definition)
        if not declaration:
            return
        key = (
            declaration["type"],
            tuple(declaration["colorantNames"]),
            declaration["alternateColorSpace"],
        )
        existing = declarations.setdefault(key, {
            **declaration,
            "resourceNames": set(),
            "pageNumbers": set(),
            "locations": set(),
        })
        existing["resourceNames"].add(clean_name(resource_name))
        existing["pageNumbers"].add(page_number)
        existing["locations"].add(location)

    def walk_resources(resources_reference: Any, page_number: int, location: str, seen: set[str]) -> None:
        if resources_reference is None:
            return
        resources = resolve(resources_reference)
        if not isinstance(resources, Mapping):
            raise ValueError(f"Resources at {location} are not a dictionary")
        key = indirect_key(resources_reference, resources)
        if key in seen:
            return
        seen.add(key)

        color_spaces_reference = resources.get("/ColorSpace")
        if color_spaces_reference is not None:
            color_spaces = resolve(color_spaces_reference)
            if not isinstance(color_spaces, Mapping):
                raise ValueError(f"ColorSpace resources at {location} are not a dictionary")
            for resource_name, definition in color_spaces.items():
                record(
                    definition,
                    resource_name,
                    page_number,
                    f"{location}/ColorSpace/{clean_name(resource_name)}",
                )

        xobjects_reference = resources.get("/XObject")
        if xobjects_reference is not None:
            xobjects = resolve(xobjects_reference)
            if not isinstance(xobjects, Mapping):
                raise ValueError(f"XObject resources at {location} are not a dictionary")
            for resource_name, reference in xobjects.items():
                xobject = resolve(reference)
                if isinstance(xobject, Mapping) and clean_name(xobject.get("/Subtype")) == "Form":
                    walk_resources(
                        xobject.get("/Resources"),
                        page_number,
                        f"{location}/XObject/{clean_name(resource_name)}",
                        seen,
                    )

        patterns_reference = resources.get("/Pattern")
        if patterns_reference is not None:
            patterns = resolve(patterns_reference)
            if isinstance(patterns, Mapping):
                for resource_name, reference in patterns.items():
                    pattern = resolve(reference)
                    if isinstance(pattern, Mapping):
                        walk_resources(
                            pattern.get("/Resources"),
                            page_number,
                            f"{location}/Pattern/{clean_name(resource_name)}",
                            seen,
                        )

    for page_number, page in enumerate(reader.pages, start=1):
        walk_resources(page.get("/Resources"), page_number, f"Page {page_number}/Resources", set())

    normalized = []
    for declaration in declarations.values():
        normalized.append({
            **declaration,
            "resourceNames": sorted(declaration["resourceNames"]),
            "pageNumbers": sorted(declaration["pageNumbers"]),
            "locations": sorted(declaration["locations"]),
        })
    normalized.sort(key=lambda item: (
        item["type"],
        ",".join(item["colorantNames"]),
        item["alternateColorSpace"],
    ))
    colorant_names = sorted({
        name
        for declaration in normalized
        for name in declaration["colorantNames"]
    })
    return {
        "declarationCount": len(normalized),
        "separationDeclarationCount": sum(item["type"] == "Separation" for item in normalized),
        "deviceNDeclarationCount": sum(item["type"] == "DeviceN" for item in normalized),
        "colorantNames": colorant_names,
        "declarations": normalized,
    }


def inspect_pdf(pdf_path: Path) -> dict[str, Any]:
    reader = PdfReader(str(pdf_path), strict=True)
    if reader.is_encrypted:
        raise ValueError("Encrypted PDF cannot be inspected without changing authentication state")
    page_count = len(reader.pages)
    if page_count < 1:
        raise ValueError("PDF has no pages")
    return {
        "schemaVersion": 1,
        "inspector": "pypdf",
        "pypdfVersion": pypdf.__version__,
        "inspectionPerformed": True,
        "pageCount": page_count,
        "multiPage": page_count > 1,
        "optionalContent": inspect_optional_content(reader),
        "spotColors": inspect_spot_colors(reader),
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: inspect_pdf_optional_content.py PDF", file=sys.stderr)
        return 2
    pdf_path = Path(sys.argv[1])
    try:
        result = inspect_pdf(pdf_path)
    except Exception as error:  # noqa: BLE001 - fail closed with a concise machine-readable error.
        print(json.dumps({
            "schemaVersion": 1,
            "inspectionPerformed": False,
            "errorType": type(error).__name__,
            "error": str(error),
        }, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
