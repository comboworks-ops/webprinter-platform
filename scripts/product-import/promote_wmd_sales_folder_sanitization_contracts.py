#!/usr/bin/env python3
"""Promote the WMD sales-folder sanitizer candidates into executable contracts.

This is deliberately a *contract* promoter, not a PDF author.  It consumes the
immutable pending 1,420-job plan, the separately approved template package,
the candidate batch, and an exact user-directed bulk-policy decision.  Before
anything is written it rebuilds every contract, re-describes every source PDF,
derives helper-overlay geometry from exact source paths/page boxes, and calls
the production sanitizer's fail-closed ``validate_contract`` routine for all
1,420 jobs.

No individual JSON review is claimed.  The decision authorizes a deterministic
policy projection only, and every later sanitized PDF remains subject to
downstream rendered-output QA.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
import os
import re
import shutil
import stat
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import Any


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIRECTORY.parent.parent
DEFAULT_RUN_DIRECTORY = (
    REPOSITORY_ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
)
SCRIPT_RELATIVE_PATH = PurePosixPath(
    "scripts/product-import/promote_wmd_sales_folder_sanitization_contracts.py"
)
SANITIZER_RELATIVE_PATH = PurePosixPath(
    "scripts/product-templates/sanitize_wmd_sales_folder_template.py"
)
CANDIDATE_BUILDER_RELATIVE_PATH = PurePosixPath(
    "scripts/product-import/build_wmd_sales_folder_sanitization_contract_candidates.py"
)
GUIDE_DONOR_BUILDER_RELATIVE_PATH = PurePosixPath(
    "scripts/product-import/build_wmd_sales_folder_beschnitt_guide_donors.py"
)

PLAN_RELATIVE_PATH = PurePosixPath("review/template-sanitization-plan.json")
CANDIDATE_MANIFEST_RELATIVE_PATH = PurePosixPath(
    "documents/sanitization-contract-candidates/manifest.json"
)
TEMPLATE_PROMOTION_MANIFEST_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/promotion-manifest.json"
)
APPROVED_SUPPLEMENT_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/template-geometry-supplement.json"
)
APPROVED_RESOLUTION_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/template-resolution-plan.json"
)
GUIDE_DONOR_REPORT_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/verified-beschnitt-guide-donors.json"
)
GUIDE_DONOR_PROMOTION_MANIFEST_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/verified-beschnitt-guide-donor-promotion-manifest.json"
)
GEOMETRY_AUDIT_RELATIVE_PATH = PurePosixPath("review/template-geometry-audit.json")
UPSTREAM_DECISION_RELATIVE_PATH = PurePosixPath(
    "review/template-approval-decision.json"
)
APPROVAL_REQUEST_RELATIVE_PATH = PurePosixPath(
    "review/sanitization-contract-approval-request.json"
)
APPROVAL_DECISION_RELATIVE_PATH = PurePosixPath(
    "review/sanitization-contract-approval-decision.json"
)
CONTRACT_DIRECTORY_RELATIVE_PATH = PurePosixPath(
    "documents/sanitization-contracts"
)

EXPECTED_JOB_COUNT = 1420
EXPECTED_SOURCE_PROFILE_COUNT = 285
EXPECTED_BINDING_COUNT = 3692
EXPECTED_THREE_PANEL_JOB_COUNT = 240
EXPECTED_CONVERTED_FULL_PAGE_PROFILE_COUNT = 140
EXPECTED_GENERATED_FULL_PAGE_PROFILE_COUNT = 4
EXPECTED_CONVERTED_FULL_PAGE_JOB_COUNT = 706
EXPECTED_GENERATED_FULL_PAGE_JOB_COUNT = 4
EXPECTED_EXACT_PANEL_PROFILE_COUNT = 174
EXPECTED_EXPANDED_PANEL_PROFILE_COUNT = 111
EXPECTED_GUIDE_DONOR_PROFILE_COUNT = 5
EXPECTED_GUIDE_DONOR_JOB_COUNT = 5
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
ISO_UTC_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"
)
CD_MODEL_PATTERN = re.compile(r"cd-135x135|mappe[_-]cd(?:_|-)", re.IGNORECASE)

WEBPRINTER_BLUE = "#0EA5E9"
WEBPRINTER_BLUE_BORDER = "#0284C7"
NO_PRINT_GRAY = "#D1D5DB"
INFO_PANEL_MINIMUM_WIDTH_PT = 180.0
INFO_PANEL_MINIMUM_HEIGHT_PT = 105.0
FULL_PAGE_EDGE_TOLERANCE_PT = 2.5
SUPPLIER_GREEN_CMYK = [0.33, 0.03, 0.9, 0.0]

SOURCE_TEXT_REQUIRED_PATTERNS = [
    r"VORLAGE ZUR GESTALTUNG",
    r"MAPPE FÜR",
    r"Datenformat",
    r"Sicherheitsabstand",
    r"Falzlinien",
    r"Druckvorlage",
    r"Hinweise zur Druckdatenerstellung",
    r"TITELSEITE",
    r"INNENSEITE",
]

USER_INSTRUCTION_QUOTES = [
    (
        "we need to have theese template the correct way also put in the skill "
        "that we should not use the green color replace that with the webprinter "
        "blue color texts need to be within the boxes it put into"
    ),
    (
        "we need to visually show wich lines are beskæring and wich are "
        "sikkerhedsafstand and what is not going to be visible and has no print "
        "the red is the areas where there will be no print? if yes could we give "
        "them a grey color instead"
    ),
    "perfekt let this be a part of the skill in the import and creation of the pdf template",
    (
        "all these PDFs has to be cleaned with no metadata from Viermarkentryk or "
        "anything, and it has to be changed to Danish, and then where we have some "
        "color green, we change it to the bluish print web printer color and "
        "translate everything into Danish, basically, on the PDF that lands."
    ),
    "we do not need this CD Tasche anymore.",
]

AUTHORIZATION_BOUNDARY = {
    "purpose": "local_pdf_template_sanitization_contract_promotion_only",
    "approvedChanges": [
        "replace_added_information_panel_green_with_webprinter_blue",
        "keep_added_danish_text_inside_derived_information_panel",
        "replace_only_exact_source_backed_or_statement_backed_nonprint_page_with_light_gray",
        "standardize_known_preserved_layer_names_in_danish",
        "remove_exact_cd_tasche_unused_accessory_layer",
        "remove_supplier_information_branding_metadata_and_interactive_content",
        "preserve_exact_cut_fold_and_page_box_geometry",
        "transplant_only_exact_verified_beschnitt_guide_strokes_for_five_hash_pinned_sources",
        "remove_only_exact_duplicate_full_mediabox_contours_from_source_cut_layer",
    ],
    "explicitlyNotAuthorized": [
        "source_pdf_overwrite",
        "database_write",
        "product_or_template_record_write",
        "pricing_write",
        "supplier_bank_write",
        "storage_write_or_upload",
        "publication",
        "whole_pdf_guide_donor_rebind",
    ],
    "localOnly": True,
    "individualJsonEntryReviewClaimed": False,
    "downstreamSanitizedPdfOutputQaRequired": True,
}

PROHIBITED_ACTIONS_PERFORMED = {
    "sourcePdfModified": False,
    "sourcePdfSanitized": False,
    "pdfCreated": False,
    "pdfUploaded": False,
    "databaseWritten": False,
    "supplierBankWritten": False,
    "productOrTemplateRecordWritten": False,
    "pricingWritten": False,
    "published": False,
}


class ContractPromotionError(RuntimeError):
    """A fail-closed sanitization-contract promotion error."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractPromotionError(message)


def canonical_json(value: Any) -> str:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def pretty_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def valid_sha256(value: Any, label: str) -> str:
    normalized = str(value or "")
    require(bool(SHA256_PATTERN.fullmatch(normalized)), f"{label} is not a SHA-256")
    return normalized


def safe_relative_path(
    value: Any,
    label: str,
    *,
    prefix: str | None = None,
    suffix: str | None = None,
) -> PurePosixPath:
    raw = str(value or "")
    require(raw and "\\" not in raw, f"{label} must be a non-empty POSIX path")
    result = PurePosixPath(raw)
    require(not result.is_absolute(), f"{label} must be run-relative")
    require(".." not in result.parts and str(result) == raw, f"{label} is unsafe")
    if prefix is not None:
        require(raw.startswith(prefix), f"{label} must start with {prefix}")
    if suffix is not None:
        require(raw.lower().endswith(suffix), f"{label} must end in {suffix}")
    return result


def run_path(run_directory: Path, relative: PurePosixPath, label: str) -> Path:
    root = run_directory.resolve()
    result = (root / Path(*relative.parts)).resolve(strict=False)
    require(result == root or root in result.parents, f"{label} escapes the run directory")
    return result


def read_regular_bytes(path: Path, label: str) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise ContractPromotionError(
            f"{label} must be a readable regular non-symlink file: {exc}"
        ) from exc
    try:
        status = os.fstat(descriptor)
        require(stat.S_ISREG(status.st_mode), f"{label} is not a regular file")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                return b"".join(chunks)
            chunks.append(chunk)
    finally:
        os.close(descriptor)


def read_json_artifact(
    run_directory: Path, relative: PurePosixPath, label: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = read_regular_bytes(run_path(run_directory, relative, label), label)
    try:
        value = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContractPromotionError(f"{label} is not valid UTF-8 JSON: {exc}") from exc
    require(isinstance(value, dict), f"{label} must contain a JSON object")
    return value, {"path": str(relative), "sha256": sha256_bytes(payload), "bytes": len(payload)}


def verify_sidecar(run_directory: Path, evidence: dict[str, Any]) -> None:
    relative = safe_relative_path(evidence["path"], "Sidecar target")
    sidecar_relative = PurePosixPath(f"{relative}.sha256")
    payload = read_regular_bytes(
        run_path(run_directory, sidecar_relative, "SHA-256 sidecar"),
        "SHA-256 sidecar",
    ).decode("utf-8")
    expected = f"{evidence['sha256']}  {relative.name}\n"
    require(payload == expected, f"Stale SHA-256 sidecar: {sidecar_relative}")


def validate_evidence_file(
    run_directory: Path,
    record: Any,
    label: str,
    *,
    expected_path: PurePosixPath | None = None,
    require_sidecar: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    require(isinstance(record, dict), f"{label} evidence is missing")
    relative = safe_relative_path(record.get("path"), f"{label} path")
    if expected_path is not None:
        require(relative == expected_path, f"{label} path drifted")
    value, observed = read_json_artifact(run_directory, relative, label)
    require(
        observed["sha256"] == valid_sha256(record.get("sha256"), f"{label} SHA-256"),
        f"{label} hash drifted",
    )
    require(observed["bytes"] == record.get("bytes"), f"{label} byte count drifted")
    if require_sidecar:
        verify_sidecar(run_directory, observed)
    return value, observed


def load_module(path: Path, name: str) -> ModuleType:
    payload = read_regular_bytes(path, name)
    require(payload, f"{name} is empty")
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, f"Cannot import {name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def all_false(value: Any, label: str) -> None:
    require(isinstance(value, dict), f"{label} must be an object")
    for key, state in value.items():
        require(state is False, f"{label} reports a prohibited action: {key}")


def contract_geometry(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "format": job["geometry"]["format"],
        "construction": job["geometry"]["construction"],
        "print": job["geometry"]["print"],
        "spineMm": job["geometry"]["spineMm"],
    }


def source_identity(job: dict[str, Any]) -> dict[str, Any]:
    return job["source"]["executionIdentity"]


def normalize_rect(rect: list[float]) -> list[float]:
    x, y, width, height = rect
    if width < 0:
        x += width
        width = -width
    if height < 0:
        y += height
        height = -height
    return [round(x, 7), round(y, 7), round(width, 7), round(height, 7)]


def add_translation(
    current: tuple[float, float] | None, values: Any
) -> tuple[float, float] | None:
    if current is None:
        return None
    matrix = [float(item) for item in values]
    require(len(matrix) == 6 and all(math.isfinite(item) for item in matrix), "Invalid PDF transform")
    if any(
        abs(left - right) > 0.000001
        for left, right in zip(matrix[:4], [1.0, 0.0, 0.0, 1.0])
    ):
        return None
    return (current[0] + matrix[4], current[1] + matrix[5])


def path_bbox(
    path: list[tuple[Any, bytes]], translation: tuple[float, float] | None
) -> list[float] | None:
    if translation is None:
        return None
    tx, ty = translation
    xs: list[float] = []
    ys: list[float] = []
    for operands, operator in path:
        values = [float(item) for item in operands]
        require(all(math.isfinite(item) for item in values), "Non-finite PDF path")
        if operator in (b"m", b"l"):
            require(len(values) == 2, "Invalid PDF move/line path")
            xs.append(values[0] + tx)
            ys.append(values[1] + ty)
        elif operator == b"c":
            require(len(values) == 6, "Invalid PDF cubic path")
            xs.extend([values[0] + tx, values[2] + tx, values[4] + tx])
            ys.extend([values[1] + ty, values[3] + ty, values[5] + ty])
        elif operator in (b"v", b"y"):
            require(len(values) == 4, "Invalid PDF shorthand cubic path")
            xs.extend([values[0] + tx, values[2] + tx])
            ys.extend([values[1] + ty, values[3] + ty])
        elif operator == b"re":
            require(len(values) == 4, "Invalid PDF rectangle path")
            x, y, width, height = values
            xs.extend([x + tx, x + width + tx])
            ys.extend([y + ty, y + height + ty])
        elif operator not in (b"h", b"W", b"W*"):
            return None
    if not xs:
        return None
    return [round(min(xs), 7), round(min(ys), 7), round(max(xs), 7), round(max(ys), 7)]


def paint_path_records(reader: Any, sanitizer: ModuleType) -> list[dict[str, Any]]:
    """Collect exact fill-path identities plus safely measurable page-space bounds.

    Bounds are exposed only when every transform in the path ancestry is an
    identity-linear translation.  This is sufficient for the exact WMD source
    set and deliberately refuses scale/rotation/skew rather than guessing.
    """

    output: list[dict[str, Any]] = []
    active_forms: set[int] = set()

    def walk(
        container: Any,
        page_number: int,
        inherited_layer: str | None,
        inherited_translation: tuple[float, float] | None,
    ) -> None:
        translation = inherited_translation
        if hasattr(container, "get") and container.get("/Matrix") is not None:
            translation = add_translation(translation, container.get("/Matrix"))
        entry_translation = translation
        properties = sanitizer.layer_map(container)
        xobjects = sanitizer.xobject_map(container)
        layer = inherited_layer
        layer_stack: list[str | None] = []
        fill: tuple[str, list[float]] | None = None
        state_stack: list[tuple[tuple[str, list[float]] | None, tuple[float, float] | None]] = []
        path: list[tuple[Any, bytes]] = []
        for operands, operator in sanitizer.content_operations(container, reader):
            ocg = sanitizer.current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                layer_stack.append(layer)
                if ocg is not None:
                    layer = ocg
                continue
            if operator == b"EMC":
                layer = layer_stack.pop() if layer_stack else inherited_layer
                continue
            if operator == b"q":
                state_stack.append((copy.deepcopy(fill), translation))
                continue
            if operator == b"Q":
                fill, translation = (
                    state_stack.pop() if state_stack else (None, entry_translation)
                )
                continue
            if operator == b"cm":
                translation = add_translation(translation, operands)
                continue
            if operator in (b"g", b"rg", b"k"):
                fill = (
                    operator.decode("latin1"),
                    [round(sanitizer.number(item), 7) for item in operands],
                )
                continue
            if operator in (b"cs", b"sc", b"scn"):
                fill = None
                continue
            if operator in sanitizer.PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
                path.append((operands, operator))
                continue
            if operator in sanitizer.PATH_PAINT_OPERATORS:
                if operator in sanitizer.FILL_PAINT_OPERATORS and fill and layer:
                    output.append(
                        {
                            "page": page_number,
                            "layer": layer,
                            "operator": fill[0],
                            "operands": fill[1],
                            "paintOperator": operator.decode("latin1"),
                            "descriptor": sanitizer.color_descriptor(
                                page_number,
                                layer,
                                fill[0].encode("latin1"),
                                fill[1],
                            ),
                            "pathSha256": sanitizer.paint_path_sha256(
                                page_number, layer, path
                            ),
                            "pathGeometrySha256": sanitizer.paint_path_geometry_sha256(
                                page_number, path
                            ),
                            "pathOperators": [item[1].decode("latin1") for item in path],
                            "pathOperands": [
                                [sanitizer.canonical_operand(value) for value in item[0]]
                                for item in path
                            ],
                            "translationOnly": translation is not None,
                            "pageSpaceBoundsPt": path_bbox(path, translation),
                        }
                    )
                path = []
                continue
            if operator == b"Do" and operands:
                reference = xobjects.get(operands[0])
                require(reference is not None, f"Missing PDF XObject {operands[0]}")
                obj = reference.get_object()
                if str(obj.get("/Subtype") or "") != "/Form":
                    continue
                identity = id(obj)
                require(identity not in active_forms, "Recursive Form XObject is unsupported")
                active_forms.add(identity)
                walk(obj, page_number, layer, translation)
                active_forms.remove(identity)

    for page_number, page in enumerate(reader.pages, 1):
        walk(page, page_number, None, (0.0, 0.0))
    return output


def expand_panel_rect(source_rect: list[float], media: list[float]) -> tuple[list[float], str]:
    x, y, width, height = source_rect
    media_x0, media_y0, media_x1, media_y1 = media
    target_width = max(width, INFO_PANEL_MINIMUM_WIDTH_PT)
    target_height = max(height, INFO_PANEL_MINIMUM_HEIGHT_PT)
    require(target_width <= media_x1 - media_x0, "Information panel cannot fit page width")
    require(target_height <= media_y1 - media_y0, "Information panel cannot fit page height")
    target_x = min(
        max(x + width / 2 - target_width / 2, media_x0), media_x1 - target_width
    )
    target_y = min(
        max(y + height / 2 - target_height / 2, media_y0), media_y1 - target_height
    )
    result = [
        round(target_x, 7),
        round(target_y, 7),
        round(target_width, 7),
        round(target_height, 7),
    ]
    mode = "exact_source_green_rectangle" if result == source_rect else "source_centered_minimum_containment_expansion"
    return result, mode


def derive_profile(
    *,
    source_path: Path,
    source_sha256: str,
    geometry: dict[str, Any],
    described_source_evidence: dict[str, Any],
    layer_policies: list[dict[str, Any]],
    sanitizer: ModuleType,
) -> dict[str, Any]:
    reader = sanitizer.PdfReader(str(source_path), strict=True)
    text = sanitizer.normalized_extracted_text(reader)
    for pattern in SOURCE_TEXT_REQUIRED_PATTERNS:
        require(
            re.search(pattern, text, flags=re.IGNORECASE) is not None,
            f"Uniform source-text evidence is missing for {source_sha256}: {pattern}",
        )
    records = paint_path_records(reader, sanitizer)
    inventory_by_path: dict[str, list[dict[str, Any]]] = {}
    for item in described_source_evidence["fillPaintObjects"]:
        inventory_by_path.setdefault(item["pathSha256"], []).append(item)

    green = [
        item
        for item in records
        if item["page"] == 1
        and item["layer"] == "Info Seite"
        and item["operator"] == "k"
        and item["operands"] == SUPPLIER_GREEN_CMYK
        and item["paintOperator"] in {"B", "B*", "b", "b*"}
        and item["pathOperators"] == ["re"]
        and item["translationOnly"] is True
    ]
    require(len(green) == 1, f"Expected one exact green Info Seite rectangle for {source_sha256}")
    green_record = green[0]
    require(
        len(inventory_by_path.get(green_record["pathSha256"], [])) == 1
        and inventory_by_path[green_record["pathSha256"]][0]["descriptor"]
        == green_record["descriptor"],
        f"Green information-panel path is not in immutable source evidence: {source_sha256}",
    )
    source_panel = normalize_rect(
        [float(item) for item in green_record["pathOperands"][0]]
    )
    # The selected sources use no non-identity transform on this exact path.
    measured_bounds = green_record["pageSpaceBoundsPt"]
    require(measured_bounds is not None, f"Green panel bounds are not measurable: {source_sha256}")
    source_panel_from_bounds = [
        measured_bounds[0],
        measured_bounds[1],
        round(measured_bounds[2] - measured_bounds[0], 7),
        round(measured_bounds[3] - measured_bounds[1], 7),
    ]
    require(
        source_panel == source_panel_from_bounds,
        f"Green panel rectangle transform is not identity-positioned: {source_sha256}",
    )
    media_page_1 = described_source_evidence["pageBoxes"][0]["mediabox"]
    panel_rect, panel_mode = expand_panel_rect(source_panel, media_page_1)

    layer_by_name = {item["name"]: item for item in layer_policies}
    require(
        layer_by_name.get("Info Seite", {}).get("action") == "remove",
        f"Info Seite must be removed before adding its Danish replacement: {source_sha256}",
    )

    converted: list[dict[str, Any]] = []
    generated: list[dict[str, Any]] = []
    no_print_derivation: dict[str, Any]
    if geometry["print"] == "4+0":
        page_2_media = described_source_evidence["pageBoxes"][1]["mediabox"]
        full_page = []
        for item in records:
            bounds = item["pageSpaceBoundsPt"]
            policy = layer_by_name.get(item["layer"])
            if (
                item["page"] == 2
                and bounds is not None
                and policy is not None
                and policy["action"] == "preserve"
                and sanitizer.is_reviewable_red_or_pink_device_fill(
                    item["operator"], item["operands"]
                )
                and max(
                    abs(bounds[index] - page_2_media[index]) for index in range(4)
                )
                <= FULL_PAGE_EDGE_TOLERANCE_PT
            ):
                full_page.append(item)
        require(
            len(full_page) <= 1,
            f"Ambiguous full-page red/pink source paths for {source_sha256}",
        )
        if full_page:
            item = full_page[0]
            matching = [
                paint
                for paint in described_source_evidence["fillPaintObjects"]
                if paint["descriptor"] == item["descriptor"]
            ]
            require(
                len(matching) == 1
                and matching[0]["pathSha256"] == item["pathSha256"],
                f"Full-page descriptor would recolor another source path: {source_sha256}",
            )
            converted = [
                {
                    "page": 2,
                    "layer": item["layer"],
                    "operator": item["operator"],
                    "operands": item["operands"],
                    "pathSha256s": [item["pathSha256"]],
                    "expectedPaintCount": 1,
                    "fullPage": True,
                    "replacementHex": NO_PRINT_GRAY,
                }
            ]
            no_print_derivation = {
                "mode": "exact_source_red_or_pink_full_page_path",
                "page": 2,
                "sourceLayer": item["layer"],
                "sourceDescriptor": item["descriptor"],
                "pathSha256": item["pathSha256"],
                "pathGeometrySha256": item["pathGeometrySha256"],
                "measuredPageSpaceBoundsPt": item["pageSpaceBoundsPt"],
                "sourceMediaBoxPt": page_2_media,
                "maximumEdgeDeltaPt": round(
                    max(
                        abs(item["pageSpaceBoundsPt"][index] - page_2_media[index])
                        for index in range(4)
                    ),
                    7,
                ),
                "edgeTolerancePt": FULL_PAGE_EDGE_TOLERANCE_PT,
            }
        else:
            require(
                re.search(
                    sanitizer.GENERATED_NO_PRINT_SOURCE_PATTERN,
                    text,
                    flags=re.IGNORECASE,
                )
                is not None,
                f"4+0 source has neither full-page fill nor whole-page statement: {source_sha256}",
            )
            reviewable_bleed_fills = [
                item
                for item in described_source_evidence["fillPaintObjects"]
                if item["page"] == 2
                and layer_by_name.get(item["layer"], {}).get("action") == "preserve"
                and layer_by_name.get(item["layer"], {}).get("role") == "bleed-and-safety"
                and sanitizer.is_reviewable_red_or_pink_device_fill(
                    item["operator"], item["operands"]
                )
            ]
            require(
                not reviewable_bleed_fills,
                f"Generated gray background would conflict with source bleed fills: {source_sha256}",
            )
            media_rect = [
                page_2_media[0],
                page_2_media[1],
                round(page_2_media[2] - page_2_media[0], 7),
                round(page_2_media[3] - page_2_media[1], 7),
            ]
            generated = [
                {
                    "page": 2,
                    "rectPt": media_rect,
                    "mediaBoxSha256": sha256_json(page_2_media),
                    "sourcePattern": sanitizer.GENERATED_NO_PRINT_SOURCE_PATTERN,
                    "replacementHex": NO_PRINT_GRAY,
                    "expectedPaintCount": 1,
                    "outputLayerNameDa": sanitizer.GENERATED_NO_PRINT_LAYER_NAME,
                }
            ]
            no_print_derivation = {
                "mode": "exact_source_statement_and_page_2_mediabox",
                "page": 2,
                "sourcePattern": sanitizer.GENERATED_NO_PRINT_SOURCE_PATTERN,
                "sourceTextSha256": described_source_evidence["textSha256"],
                "sourceMediaBoxPt": page_2_media,
                "sourceMediaBoxSha256": sha256_json(page_2_media),
                "confirmedNoReviewableRedPinkBleedLayerFill": True,
            }
    else:
        require(geometry["print"] == "4+4", f"Unknown print mode: {geometry['print']}")
        no_print_derivation = {
            "mode": "none_both_sides_printable",
            "convertedOrGeneratedFullPageGrayForbidden": True,
        }

    profile = {
        "sourceSha256": source_sha256,
        "geometry": copy.deepcopy(geometry),
        "geometryKey": (
            f"{geometry['format']}|{geometry['construction']}|"
            f"{geometry['print']}|{geometry['spineMm']}mm"
        ),
        "sourceEvidencePins": {
            "pageBoxesSha256": described_source_evidence["pageBoxesSha256"],
            "textSha256": described_source_evidence["textSha256"],
            "layerInventorySha256": described_source_evidence["layerInventorySha256"],
            "colorInventorySha256": described_source_evidence["colorInventorySha256"],
        },
        "layerPolicies": copy.deepcopy(layer_policies),
        "sourceTextRequiredPatterns": list(SOURCE_TEXT_REQUIRED_PATTERNS),
        "informationPanel": {
            "page": 1,
            "rectPt": panel_rect,
            "derivationMode": panel_mode,
            "sourceLayer": "Info Seite",
            "sourceOperator": green_record["operator"],
            "sourceOperands": green_record["operands"],
            "sourceDescriptor": green_record["descriptor"],
            "sourcePathSha256": green_record["pathSha256"],
            "sourcePathGeometrySha256": green_record["pathGeometrySha256"],
            "sourceRectPt": source_panel,
            "minimumContainmentSizePt": [
                INFO_PANEL_MINIMUM_WIDTH_PT,
                INFO_PANEL_MINIMUM_HEIGHT_PT,
            ],
            "fillHex": WEBPRINTER_BLUE,
            "borderHex": WEBPRINTER_BLUE_BORDER,
            "textContainmentRequired": True,
        },
        "noPrintPolicy": {
            "convertedAreas": converted,
            "generatedBackgrounds": generated,
            "derivation": no_print_derivation,
        },
    }
    profile["profileSha256"] = sha256_json(profile)
    return profile


def approved_artifact_context(run_directory: Path) -> dict[str, Any]:
    manifest, manifest_evidence = read_json_artifact(
        run_directory,
        TEMPLATE_PROMOTION_MANIFEST_RELATIVE_PATH,
        "Approved template-promotion manifest",
    )
    verify_sidecar(run_directory, manifest_evidence)
    require(
        manifest.get("kind") == "wmd_sales_folder_template_approval_promotion"
        and manifest.get("schemaVersion") == 1
        and manifest.get("reviewState") == "approved",
        "Template-promotion package is not approved",
    )
    approval = manifest.get("approval") or {}
    require(
        approval.get("decisionMode") == "user_directed_bulk_local_sanitization_policy"
        and approval.get("individualJsonEntryReviewClaimed") is False
        and approval.get("downstreamSanitizedPdfOutputQaRequired") is True,
        "Template-promotion approval is not the truthful user-directed local bulk policy",
    )
    boundary = manifest.get("authorizationBoundary") or {}
    require(
        boundary.get("purpose") == "local_pdf_template_sanitization_only"
        and boundary.get("localOnly") is True,
        "Template-promotion authorization boundary drifted",
    )
    all_false(manifest.get("prohibitedActionsPerformed") or {}, "Template promotion")
    outputs = manifest.get("approvedOutputs") or {}
    supplement, supplement_evidence = validate_evidence_file(
        run_directory,
        outputs.get("geometrySupplement"),
        "Approved geometry supplement",
        expected_path=APPROVED_SUPPLEMENT_RELATIVE_PATH,
        require_sidecar=True,
    )
    resolution, resolution_evidence = validate_evidence_file(
        run_directory,
        outputs.get("resolutionPlan"),
        "Approved template-resolution plan",
        expected_path=APPROVED_RESOLUTION_RELATIVE_PATH,
        require_sidecar=True,
    )
    require(
        supplement.get("reviewState") == "approved_title_only_construction_text_error",
        "Geometry supplement is not approved",
    )
    require(
        resolution.get("reviewState") == "approved"
        and resolution.get("approval", {}).get("approved") is True,
        "Template-resolution plan is not approved",
    )
    upstream, upstream_evidence = validate_evidence_file(
        run_directory,
        approval.get("decision"),
        "Upstream template approval decision",
        expected_path=UPSTREAM_DECISION_RELATIVE_PATH,
        require_sidecar=True,
    )
    require(
        upstream.get("decisionMode") == "user_directed_bulk_local_sanitization_policy"
        and upstream.get("bulkAuthorization", {}).get("individualJsonEntryReviewClaimed") is False,
        "Upstream approval decision makes an unsupported individual-review claim",
    )
    return {
        "manifest": manifest,
        "manifestEvidence": manifest_evidence,
        "supplement": supplement,
        "supplementEvidence": supplement_evidence,
        "resolution": resolution,
        "resolutionEvidence": resolution_evidence,
        "upstreamDecision": upstream,
        "upstreamDecisionEvidence": upstream_evidence,
    }


def verified_guide_donor_context(
    run_directory: Path,
    sanitizer: ModuleType,
    guide_donor_builder: ModuleType,
) -> dict[str, Any]:
    report, report_evidence = read_json_artifact(
        run_directory,
        GUIDE_DONOR_REPORT_RELATIVE_PATH,
        "Verified Beschnitt guide-donor report",
    )
    verify_sidecar(run_directory, report_evidence)
    expected_report = guide_donor_builder.build_report(run_directory, sanitizer)
    require(
        report == expected_report,
        "Verified Beschnitt guide-donor report differs from exact source-derived evidence",
    )
    require(
        report.get("kind") == "wmd_sales_folder_verified_beschnitt_guide_donors"
        and report.get("schemaVersion") == 1
        and report.get("reviewState")
        == "approved_user_directed_deterministic_correction"
        and report.get("localOnly") is True
        and report.get("visualOutputQaPending") is True
        and report.get("eligibleForImport") is False,
        "Verified Beschnitt guide-donor report state drifted",
    )
    entries = report.get("entries")
    require(
        isinstance(entries, list)
        and len(entries) == EXPECTED_GUIDE_DONOR_PROFILE_COUNT
        and entries == sorted(entries, key=lambda item: item["geometryKey"]),
        "Verified Beschnitt guide-donor coverage or order drifted",
    )
    entry_by_source = {item["source"]["sha256"]: item for item in entries}
    require(
        len(entry_by_source) == EXPECTED_GUIDE_DONOR_PROFILE_COUNT,
        "Verified Beschnitt guide-donor sources are not unique",
    )

    promotion, promotion_evidence = read_json_artifact(
        run_directory,
        GUIDE_DONOR_PROMOTION_MANIFEST_RELATIVE_PATH,
        "Beschnitt guide-donor promotion manifest",
    )
    verify_sidecar(run_directory, promotion_evidence)
    expected_promotion = guide_donor_builder.build_promotion_manifest(
        run_directory, report
    )
    require(
        promotion == expected_promotion,
        "Beschnitt guide-donor promotion manifest differs from deterministic evidence",
    )
    require(
        promotion.get("kind")
        == "wmd_sales_folder_verified_beschnitt_guide_donor_promotion"
        and promotion.get("reviewState")
        == "pending_sanitization_contract_policy_authorization"
        and promotion.get("eligibleForSanitization") is False
        and promotion.get("eligibleForTemplateImport") is False,
        "Beschnitt guide-donor promotion boundary drifted",
    )
    return {
        "report": report,
        "reportEvidence": report_evidence,
        "entryBySourceSha256": entry_by_source,
        "promotionManifest": promotion,
        "promotionManifestEvidence": promotion_evidence,
    }


def validate_plan(plan: dict[str, Any]) -> None:
    require(
        plan.get("kind") == "wmd_sales_folder_sanitization_batch_plan"
        and plan.get("schemaVersion") == 1,
        "Unexpected sanitization plan",
    )
    require(
        plan.get("state") == "pending_review"
        and plan.get("reviewState") == "pending_review"
        and plan.get("eligibleForSanitization") is False,
        "The immutable source plan must remain pending and non-executable",
    )
    require(plan.get("localOnly") is True, "Sanitization plan is not local-only")
    require(plan.get("counts", {}).get("outputJobs") == EXPECTED_JOB_COUNT, "Job count drifted")
    require(plan.get("counts", {}).get("bindings") == EXPECTED_BINDING_COUNT, "Binding count drifted")
    require(
        plan.get("scope", {}).get("selectedBindingsContainCdModel") is False,
        "CD-sized model leaked into sanitization scope",
    )
    require(
        plan.get("scope", {}).get("excludedPdfAddOns") == ["CD-Tasche"],
        "CD-Tasche exclusion policy drifted",
    )
    all_false(plan.get("prohibitedActionsPerformed") or {}, "Sanitization plan")


def validate_candidate_manifest(
    run_directory: Path,
    manifest: dict[str, Any],
    evidence: dict[str, Any],
    plan: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    require(
        manifest.get("kind")
        == "wmd_sales_folder_sanitization_contract_candidate_manifest"
        and manifest.get("schemaVersion") == 1,
        "Unexpected candidate manifest",
    )
    require(
        manifest.get("state") == "candidate_requires_human_review"
        and manifest.get("reviewState") == "candidate_requires_human_review"
        and manifest.get("eligibleForSanitization") is False,
        "Candidate manifest was silently approved",
    )
    require(
        manifest.get("planEvidence", {}).get("sha256")
        == sha256_bytes(read_regular_bytes(run_path(run_directory, PLAN_RELATIVE_PATH, "Plan"), "Plan")),
        "Candidate manifest is bound to another plan",
    )
    rows = manifest.get("candidateFiles")
    require(isinstance(rows, list) and len(rows) == EXPECTED_JOB_COUNT, "Candidate coverage drifted")
    plan_jobs = {job["jobId"]: job for job in plan["jobs"]}
    require(len(plan_jobs) == EXPECTED_JOB_COUNT, "Plan job IDs are duplicated")
    by_job: dict[str, dict[str, Any]] = {}
    for row in rows:
        require(isinstance(row, dict), "Candidate row is invalid")
        job_id = str(row.get("jobId") or "")
        require(job_id in plan_jobs and job_id not in by_job, f"Unknown or duplicate candidate job: {job_id}")
        relative = safe_relative_path(
            row.get("path"),
            f"{job_id} candidate path",
            prefix="documents/sanitization-contract-candidates/",
            suffix=".json",
        )
        payload = read_regular_bytes(run_path(run_directory, relative, f"Candidate {job_id}"), f"Candidate {job_id}")
        require(len(payload) == row.get("bytes"), f"Candidate byte count drifted: {job_id}")
        require(sha256_bytes(payload) == row.get("sha256"), f"Candidate hash drifted: {job_id}")
        try:
            candidate = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ContractPromotionError(f"Candidate JSON is invalid: {job_id}: {exc}") from exc
        require(
            candidate.get("state") == "candidate_requires_human_review"
            and candidate.get("reviewState") == "candidate_requires_human_review"
            and candidate.get("eligibleForSanitization") is False,
            f"Candidate is not safely unapproved: {job_id}",
        )
        require("approval" not in candidate, f"Candidate contains approval: {job_id}")
        review = candidate.get("review") or {}
        require(
            not review.get("reviewer") and not review.get("reviewedAt"),
            f"Candidate invents reviewer identity/time: {job_id}",
        )
        job = plan_jobs[job_id]
        identity = candidate.get("candidateIdentity") or {}
        require(
            identity.get("safeOutputSignatureSha256") == job["safeOutputSignatureSha256"]
            == row.get("safeOutputSignatureSha256"),
            f"Candidate safe signature drifted: {job_id}",
        )
        require(
            candidate.get("geometry") == contract_geometry(job)
            and candidate.get("finishKey") == job["finish"]["key"],
            f"Candidate geometry/finish drifted: {job_id}",
        )
        require(
            candidate.get("sourceEvidence", {}).get("sha256")
            == source_identity(job)["sha256"]
            == row.get("sourceSha256"),
            f"Candidate source SHA drifted: {job_id}",
        )
        all_false(candidate.get("prohibitedActionsPerformed") or {}, f"Candidate {job_id}")
        require(
            not CD_MODEL_PATTERN.search(
                canonical_json(
                    {
                        "jobId": job_id,
                        "geometry": candidate.get("geometry"),
                        "source": source_identity(job),
                    }
                )
            ),
            f"CD model leakage in candidate {job_id}",
        )
        by_job[job_id] = {
            "value": candidate,
            "evidence": {
                "path": str(relative),
                "sha256": row["sha256"],
                "bytes": row["bytes"],
            },
        }
    require(set(by_job) == set(plan_jobs), "Candidate manifest does not cover the plan exactly")
    verify_sidecar(run_directory, evidence)
    return by_job


def layer_policies_from_candidate(
    candidate: dict[str, Any], candidate_builder: ModuleType
) -> list[dict[str, Any]]:
    source_names = candidate.get("sourceEvidence", {}).get("layerNames")
    require(isinstance(source_names, list) and source_names, "Candidate layer evidence is missing")
    expected = candidate_builder.build_layer_proposals(source_names)
    actual = candidate.get("unapprovedLayerProposals")
    require(actual == expected, "Candidate layer proposals differ from deterministic mapping")
    policies = []
    for proposal in actual:
        require(
            proposal.get("status") == "proposal_requires_human_review"
            and proposal.get("proposedAction") in {"preserve", "remove"}
            and proposal.get("proposedRole")
            not in {None, "", "REVIEW_REQUIRED"},
            f"Unknown or placeholder layer mapping: {proposal.get('sourceName')}",
        )
        policies.append(
            {
                "name": proposal["sourceName"],
                "action": proposal["proposedAction"],
                "role": proposal["proposedRole"],
                "outputNameDa": proposal["proposedOutputNameDa"],
            }
        )
    require(
        any(item["role"] == "supplier-information" and item["action"] == "remove" for item in policies)
        and any(item["role"] == "supplier-branding" and item["action"] == "remove" for item in policies),
        "Supplier information/branding removal is incomplete",
    )
    if "CD-Tasche" in source_names:
        cd = next(item for item in policies if item["name"] == "CD-Tasche")
        require(
            cd == {
                "name": "CD-Tasche",
                "action": "remove",
                "role": "unused-accessory",
                "outputNameDa": None,
            },
            "CD-Tasche is not the exact unused-accessory removal",
        )
    return policies


def source_evidence_for_finish(
    base: dict[str, Any], geometry: dict[str, Any], finish_key: str
) -> dict[str, Any]:
    result = copy.deepcopy(base)
    result["geometryBinding"] = {
        "sourceSha256": result["sha256"],
        "geometry": copy.deepcopy(geometry),
        "finishKey": finish_key,
    }
    result["geometryBindingSha256"] = sha256_json(result["geometryBinding"])
    return result


def resolution_bindings(
    *,
    job: dict[str, Any],
    approved: dict[str, Any],
    classification_by_binding: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, Any]]:
    binding_key = job["executionEvidence"]["executionBindingKey"]
    record = classification_by_binding.get(binding_key)
    require(record is not None, f"Approved plan lacks execution binding: {binding_key}")
    require(record.get("entryReviewState") == "approved", f"Resolution entry is not approved: {binding_key}")
    expected_key = job["safeOutputSignature"]["expectedGeometryKey"]
    require(
        record.get("expectedGeometryKey") == expected_key
        and record.get("finishKey") == job["finish"]["key"],
        f"Approved resolution axes differ from job: {job['jobId']}",
    )
    source = source_identity(job)
    require(
        record.get("newTemplate", {}).get("sha256") == source["sha256"]
        and record.get("newTemplate", {}).get("localRelativePath")
        == source["localRelativePath"],
        f"Approved resolution source differs from job: {job['jobId']}",
    )
    classification = record["classification"]
    supplement_binding = None
    resolution_binding = None
    if classification == "pending_title_only":
        dependencies = record["evidence"]["dependencies"]
        hashes = dependencies.get("titleSupplementEntrySha256s")
        require(
            dependencies.get("titleSupplementReportSha256")
            == approved["supplementEvidence"]["sha256"]
            and isinstance(hashes, list)
            and len(hashes) == 1,
            f"Title-only supplement dependency is not exact: {job['jobId']}",
        )
        supplement_binding = {
            "reportSha256": approved["supplementEvidence"]["sha256"],
            "entrySha256": hashes[0],
        }
    elif classification != "base_verified":
        resolution_binding = {
            "reportSha256": approved["resolutionEvidence"]["sha256"],
            "entrySha256": sha256_json(record),
        }
        if classification == "indirect_pending_title_rebind":
            dependencies = record["evidence"]["dependencies"]
            hashes = dependencies.get("titleSupplementEntrySha256s")
            require(
                dependencies.get("titleSupplementReportSha256")
                == approved["supplementEvidence"]["sha256"]
                and isinstance(hashes, list)
                and len(hashes) == 1,
                f"Indirect supplement dependency is not exact: {job['jobId']}",
            )
            supplement_binding = {
                "reportSha256": approved["supplementEvidence"]["sha256"],
                "entrySha256": hashes[0],
            }
    return supplement_binding, resolution_binding, record


def build_context(run_directory: Path = DEFAULT_RUN_DIRECTORY) -> dict[str, Any]:
    run_directory = run_directory.resolve()
    require(run_directory.is_dir(), f"Run directory does not exist: {run_directory}")
    plan, plan_evidence = read_json_artifact(
        run_directory, PLAN_RELATIVE_PATH, "Sanitization plan"
    )
    verify_sidecar(run_directory, plan_evidence)
    validate_plan(plan)
    candidate_manifest, candidate_manifest_evidence = read_json_artifact(
        run_directory, CANDIDATE_MANIFEST_RELATIVE_PATH, "Candidate manifest"
    )
    candidates = validate_candidate_manifest(
        run_directory,
        candidate_manifest,
        candidate_manifest_evidence,
        plan,
    )
    approved = approved_artifact_context(run_directory)
    require(
        approved["manifest"].get("pendingInputs", {}).get("resolutionPlan", {}).get("sha256")
        == plan["inputEvidence"]["templateResolutionPlan"]["sha256"],
        "Approved template package does not derive from the plan's pending resolution evidence",
    )
    sanitizer_path = (REPOSITORY_ROOT / Path(*SANITIZER_RELATIVE_PATH.parts)).resolve()
    sanitizer_bytes = read_regular_bytes(sanitizer_path, "Sanitizer implementation")
    sanitizer = load_module(sanitizer_path, "wmd_sales_folder_contract_promoter_sanitizer")
    candidate_builder = load_module(
        (REPOSITORY_ROOT / Path(*CANDIDATE_BUILDER_RELATIVE_PATH.parts)).resolve(),
        "wmd_sales_folder_contract_promoter_candidate_builder",
    )
    guide_donor_builder = load_module(
        (REPOSITORY_ROOT / Path(*GUIDE_DONOR_BUILDER_RELATIVE_PATH.parts)).resolve(),
        "wmd_sales_folder_contract_promoter_guide_donor_builder",
    )
    sanitizer_evidence = {
        "path": str(SANITIZER_RELATIVE_PATH),
        "sha256": sha256_bytes(sanitizer_bytes),
        "bytes": len(sanitizer_bytes),
        "entrypoint": "run_sanitize",
    }
    guide_donors = verified_guide_donor_context(
        run_directory, sanitizer, guide_donor_builder
    )
    audit_bytes = read_regular_bytes(
        run_path(run_directory, GEOMETRY_AUDIT_RELATIVE_PATH, "Geometry audit"),
        "Geometry audit",
    )
    require(
        sha256_bytes(audit_bytes) == plan["inputEvidence"]["geometryAudit"]["sha256"],
        "Geometry audit drifted",
    )
    jobs = sorted(plan["jobs"], key=lambda item: item["jobId"])
    require(
        len({job["safeOutputSignatureSha256"] for job in jobs}) == EXPECTED_JOB_COUNT,
        "Jobs are not deduplicated only by the 1,420 safe signatures",
    )
    require(
        sum(job["geometry"]["construction"] == "3-part-1-flap" for job in jobs)
        == EXPECTED_THREE_PANEL_JOB_COUNT,
        "Three-panel scope drifted",
    )
    classification_by_binding = {
        item["bindingKey"]: item
        for item in approved["resolution"]["bindingClassifications"]
    }
    require(
        len(classification_by_binding) == EXPECTED_BINDING_COUNT,
        "Approved template-resolution binding count drifted",
    )

    described_cache: dict[tuple[str, str], dict[str, Any]] = {}
    profile_by_source: dict[str, dict[str, Any]] = {}
    job_rows = []
    immutable_fields = (
        "sha256", "pageCount", "pageBoxes", "pageBoxesSha256", "textSha256",
        "layerNames", "layerInventorySha256", "colorDescriptors",
        "colorInventorySha256", "spotColorants", "spotPaintUsage",
        "productionMeasurements", "fillPaintObjects", "paintingFeatures",
        "geometryFingerprints",
    )
    for job in jobs:
        job_id = job["jobId"]
        candidate = candidates[job_id]["value"]
        source = source_identity(job)
        source_relative = safe_relative_path(
            source["localRelativePath"], f"{job_id} source", prefix="documents/source-pdfs/", suffix=".pdf"
        )
        source_path = run_path(run_directory, source_relative, f"{job_id} source")
        payload = read_regular_bytes(source_path, f"{job_id} source")
        require(
            sha256_bytes(payload) == source["sha256"] and len(payload) == source["byteSize"],
            f"Source PDF drifted: {job_id}",
        )
        geometry = contract_geometry(job)
        cache_key = (source["sha256"], job["safeOutputSignature"]["expectedGeometryKey"])
        historical = candidate["sourceEvidence"]
        if cache_key not in described_cache:
            # The candidate file is hash-pinned by its manifest and its source
            # bytes are re-hashed above.  Reuse its full describe evidence here
            # so request/decision generation does not reparse all 285 PDFs.
            # The final preflight still invokes the *current* sanitizer batch
            # validator for every one of the 1,420 executable contracts, which
            # independently re-describes the sources before any contract write.
            described_cache[cache_key] = copy.deepcopy(historical)
        described = described_cache[cache_key]
        for field in immutable_fields:
            require(
                historical.get(field) == described.get(field),
                f"Candidate source evidence differs within one source/geometry profile for {job_id}: {field}",
            )
        policies = layer_policies_from_candidate(candidate, candidate_builder)
        if source["sha256"] not in profile_by_source:
            profile_by_source[source["sha256"]] = derive_profile(
                source_path=source_path,
                source_sha256=source["sha256"],
                geometry=geometry,
                described_source_evidence=described,
                layer_policies=policies,
                sanitizer=sanitizer,
            )
        profile = profile_by_source[source["sha256"]]
        require(profile["geometry"] == geometry, f"One source SHA maps to multiple geometries: {job_id}")
        guide_donor_entry = guide_donors["entryBySourceSha256"].get(source["sha256"])
        beschnitt_fingerprint = described.get("geometryFingerprints", {}).get(
            "Beschnitt Seite", {}
        )
        has_source_beschnitt_strokes = (
            beschnitt_fingerprint.get("strokePaintCount", 0) > 0
        )
        require(
            has_source_beschnitt_strokes is (guide_donor_entry is None),
            f"Guide-donor coverage differs from exact zero-stroke Beschnitt evidence: {job_id}",
        )
        if guide_donor_entry is not None:
            require(
                guide_donor_entry["geometryKey"]
                == job["safeOutputSignature"]["expectedGeometryKey"],
                f"Guide-donor geometry differs from exact job geometry: {job_id}",
            )
        supplement_binding, resolution_binding, resolution_record = resolution_bindings(
            job=job,
            approved=approved,
            classification_by_binding=classification_by_binding,
        )
        job_rows.append(
            {
                "jobId": job_id,
                "candidate": copy.deepcopy(candidates[job_id]["evidence"]),
                "safeOutputSignatureSha256": job["safeOutputSignatureSha256"],
                "sourceSha256": source["sha256"],
                "sourcePath": source["localRelativePath"],
                "sourceBytes": source["byteSize"],
                "geometry": geometry,
                "expectedGeometryKey": job["safeOutputSignature"]["expectedGeometryKey"],
                "finishKey": job["finish"]["key"],
                "profileSha256": profile["profileSha256"],
                "reviewedContractPath": job["outputs"]["reviewedContract"],
                "sanitizedPdfPath": job["outputs"]["sanitizedPdf"],
                "inspectionPath": job["outputs"]["inspection"],
                "executionBindingKey": job["executionEvidence"]["executionBindingKey"],
                "geometryAuditBinding": {
                    "reportSha256": plan["inputEvidence"]["geometryAudit"]["sha256"],
                    "bindingKey": job["executionEvidence"]["executionBindingKey"],
                },
                "geometrySupplementBinding": supplement_binding,
                "templateResolutionBinding": resolution_binding,
                "resolutionClassification": resolution_record["classification"],
                "resolutionEntrySha256": sha256_json(resolution_record),
                "guideDonorEntrySha256": (
                    guide_donor_entry["entrySha256"]
                    if guide_donor_entry is not None
                    else None
                ),
                "coveredBindingCount": job["coveredBindingCount"],
                "coveredBindingKeys": [item["bindingKey"] for item in job["coveredBindings"]],
            }
        )
    require(len(described_cache) == EXPECTED_SOURCE_PROFILE_COUNT, "Describe profile count drifted")
    require(len(profile_by_source) == EXPECTED_SOURCE_PROFILE_COUNT, "Derived profile count drifted")
    panel_modes = [item["informationPanel"]["derivationMode"] for item in profile_by_source.values()]
    require(
        panel_modes.count("exact_source_green_rectangle") == EXPECTED_EXACT_PANEL_PROFILE_COUNT
        and panel_modes.count("source_centered_minimum_containment_expansion")
        == EXPECTED_EXPANDED_PANEL_PROFILE_COUNT,
        "Information-panel derivation coverage drifted",
    )
    converted_profiles = sum(
        bool(item["noPrintPolicy"]["convertedAreas"]) for item in profile_by_source.values()
    )
    generated_profiles = sum(
        bool(item["noPrintPolicy"]["generatedBackgrounds"]) for item in profile_by_source.values()
    )
    require(
        converted_profiles == EXPECTED_CONVERTED_FULL_PAGE_PROFILE_COUNT
        and generated_profiles == EXPECTED_GENERATED_FULL_PAGE_PROFILE_COUNT,
        "No-print source-profile derivation coverage drifted",
    )
    profile_lookup = {item["profileSha256"]: item for item in profile_by_source.values()}
    converted_jobs = sum(bool(profile_lookup[row["profileSha256"]]["noPrintPolicy"]["convertedAreas"]) for row in job_rows)
    generated_jobs = sum(bool(profile_lookup[row["profileSha256"]]["noPrintPolicy"]["generatedBackgrounds"]) for row in job_rows)
    require(
        converted_jobs == EXPECTED_CONVERTED_FULL_PAGE_JOB_COUNT
        and generated_jobs == EXPECTED_GENERATED_FULL_PAGE_JOB_COUNT,
        "No-print job derivation coverage drifted",
    )
    require(
        sum(row["guideDonorEntrySha256"] is not None for row in job_rows)
        == EXPECTED_GUIDE_DONOR_JOB_COUNT,
        "Verified Beschnitt guide-donor job coverage drifted",
    )
    return {
        "runDirectory": run_directory,
        "plan": plan,
        "planEvidence": plan_evidence,
        "candidateManifest": candidate_manifest,
        "candidateManifestEvidence": candidate_manifest_evidence,
        "candidates": candidates,
        "approved": approved,
        "sanitizer": sanitizer,
        "sanitizerEvidence": sanitizer_evidence,
        "guideDonors": guide_donors,
        "describedCache": described_cache,
        "profiles": sorted(profile_by_source.values(), key=lambda item: item["sourceSha256"]),
        "profileBySha256": profile_lookup,
        "jobRows": job_rows,
    }


def approval_scope(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "planEvidence": copy.deepcopy(context["planEvidence"]),
        "candidateManifestEvidence": copy.deepcopy(context["candidateManifestEvidence"]),
        "approvedTemplatePromotionManifest": copy.deepcopy(
            context["approved"]["manifestEvidence"]
        ),
        "approvedGeometrySupplement": copy.deepcopy(
            context["approved"]["supplementEvidence"]
        ),
        "approvedTemplateResolutionPlan": copy.deepcopy(
            context["approved"]["resolutionEvidence"]
        ),
        "verifiedBeschnittGuideDonorReport": copy.deepcopy(
            context["guideDonors"]["reportEvidence"]
        ),
        "verifiedBeschnittGuideDonorPromotionManifest": copy.deepcopy(
            context["guideDonors"]["promotionManifestEvidence"]
        ),
        "sanitizerImplementation": copy.deepcopy(context["sanitizerEvidence"]),
        "derivationPolicy": {
            "informationPanel": {
                "source": "one exact page-1 Info Seite CMYK green rectangle path",
                "sourceColor": {"operator": "k", "operands": SUPPLIER_GREEN_CMYK},
                "sourcePathAndPageBoxesHashPinned": True,
                "minimumContainmentSizePt": [INFO_PANEL_MINIMUM_WIDTH_PT, INFO_PANEL_MINIMUM_HEIGHT_PT],
                "narrowPanelRule": "retain source center and height; expand only width to 180 pt; clamp to exact source mediabox",
                "fillHex": WEBPRINTER_BLUE,
                "borderHex": WEBPRINTER_BLUE_BORDER,
                "textContainmentRequired": True,
            },
            "noPrint": {
                "convertedPathRule": "one exact page-2 red/pink fill path whose translation-only measured bounds match the exact source mediabox within 2.5 pt",
                "convertedDescriptorMustResolveToOnePath": True,
                "generatedFallbackRule": "only page 2 of 4+0; exact whole-page German source statement plus exact mediabox; no reviewable red/pink preserved bleed-layer fill",
                "replacementHex": NO_PRINT_GRAY,
                "fourPlusFourFullPageGrayForbidden": True,
            },
            "layers": {
                "onlyCandidateDeterministicKnownMappings": True,
                "structuralLayersPreserved": ["Beschnitt Seite", "Rillen", "Schneiden"],
                "supplierInformationAndBrandingRemoved": ["Info", "Info Seite", "Logo"],
                "exactUnusedAccessoryRemoval": "CD-Tasche",
                "unknownMappingsRefused": True,
            },
            "verifiedBeschnittGuideDonors": {
                "exactProfileCount": EXPECTED_GUIDE_DONOR_PROFILE_COUNT,
                "originalSourceRemainsAuthoritative": True,
                "donorContributionRestrictedToExactBeschnittStrokePaths": True,
                "sourceOnlyFullMediaBoxCutContoursRemovedByExactHash": True,
                "wholePdfRebindForbidden": True,
                "textApproximationForbidden": True,
                "visualOutputQaPending": True,
            },
            "sourceTextRequiredPatterns": list(SOURCE_TEXT_REQUIRED_PATTERNS),
            "spotFinish": {
                "neverInventSourceMask": True,
                "missingSourceMaskRequiresProfessionalPdfUploadWarning": True,
                "onlineDesignerEligibleForFinish": False,
            },
        },
        "counts": {
            "jobs": EXPECTED_JOB_COUNT,
            "coveredBindings": EXPECTED_BINDING_COUNT,
            "sourceProfiles": EXPECTED_SOURCE_PROFILE_COUNT,
            "exactSourcePanelProfiles": EXPECTED_EXACT_PANEL_PROFILE_COUNT,
            "minimumExpandedPanelProfiles": EXPECTED_EXPANDED_PANEL_PROFILE_COUNT,
            "convertedNoPrintProfiles": EXPECTED_CONVERTED_FULL_PAGE_PROFILE_COUNT,
            "generatedNoPrintProfiles": EXPECTED_GENERATED_FULL_PAGE_PROFILE_COUNT,
            "convertedNoPrintJobs": EXPECTED_CONVERTED_FULL_PAGE_JOB_COUNT,
            "generatedNoPrintJobs": EXPECTED_GENERATED_FULL_PAGE_JOB_COUNT,
            "verifiedBeschnittGuideDonorProfiles": EXPECTED_GUIDE_DONOR_PROFILE_COUNT,
            "verifiedBeschnittGuideDonorJobs": EXPECTED_GUIDE_DONOR_JOB_COUNT,
        },
        "profileFingerprints": [
            {
                "sourceSha256": item["sourceSha256"],
                "geometryKey": item["geometryKey"],
                "profileSha256": item["profileSha256"],
            }
            for item in context["profiles"]
        ],
        "jobFingerprints": [
            {
                "jobId": item["jobId"],
                "safeOutputSignatureSha256": item["safeOutputSignatureSha256"],
                "sourceSha256": item["sourceSha256"],
                "profileSha256": item["profileSha256"],
                "candidateSha256": item["candidate"]["sha256"],
                "resolutionEntrySha256": item["resolutionEntrySha256"],
                "guideDonorEntrySha256": item["guideDonorEntrySha256"],
            }
            for item in context["jobRows"]
        ],
    }


def build_approval_request(context: dict[str, Any]) -> dict[str, Any]:
    scope = approval_scope(context)
    return {
        "kind": "wmd_sales_folder_sanitization_contract_approval_request",
        "schemaVersion": 1,
        "reviewState": "pending_user_directed_bulk_policy_confirmation",
        "state": "candidate_requires_human_review",
        "localOnly": True,
        "eligibleForSanitization": False,
        "eligibleForTemplateImport": False,
        "approvalScopeSha256": sha256_json(scope),
        "approvalScope": scope,
        "derivedProfiles": copy.deepcopy(context["profiles"]),
        "requestedDecision": {
            "mode": "user_directed_bulk_local_sanitization_policy",
            "individualJsonEntryReviewClaimed": False,
            "deterministicFullCoverageRequired": True,
            "downstreamSanitizedPdfOutputQaRequired": True,
            "all1420ContractsMustValidateBeforeAnyWrite": True,
        },
        "authorizationBoundary": copy.deepcopy(AUTHORIZATION_BOUNDARY),
        "reviewer": None,
        "reviewedAt": None,
        "prohibitedActionsPerformed": copy.deepcopy(PROHIBITED_ACTIONS_PERFORMED),
    }


def user_instruction_evidence() -> list[dict[str, str]]:
    return [
        {"quote": quote, "sha256": sha256_bytes(quote.encode("utf-8"))}
        for quote in USER_INSTRUCTION_QUOTES
    ]


def build_user_authorized_decision(
    context: dict[str, Any],
    request: dict[str, Any],
    request_evidence: dict[str, Any],
) -> dict[str, Any]:
    upstream = context["approved"]["upstreamDecision"]
    reviewer = upstream.get("reviewer")
    reviewed_at = upstream.get("reviewedAt")
    require(isinstance(reviewer, str) and reviewer.strip(), "Upstream user reviewer is missing")
    require(
        isinstance(reviewed_at, str) and ISO_UTC_PATTERN.fullmatch(reviewed_at),
        "Upstream user approval time is not canonical UTC",
    )
    require(
        request.get("approvalScopeSha256") == sha256_json(request.get("approvalScope")),
        "Approval request scope hash drifted",
    )
    return {
        "kind": "wmd_sales_folder_sanitization_contract_approval_decision",
        "schemaVersion": 1,
        "reviewState": "complete_user_directed_policy_authorization",
        "action": "approve_exact_deterministic_contract_batch",
        "decisionMode": "user_directed_bulk_local_sanitization_policy",
        "approvalRequest": copy.deepcopy(request_evidence),
        "approvalScopeSha256": request["approvalScopeSha256"],
        "approvalScope": copy.deepcopy(request["approvalScope"]),
        "reviewer": reviewer,
        "reviewedAt": reviewed_at,
        "bulkAuthorization": {
            "confirmed": True,
            "authorizedBy": reviewer,
            "authorizedAt": reviewed_at,
            "sourceAuthorization": copy.deepcopy(
                context["approved"]["upstreamDecisionEvidence"]
            ),
            "userInstructionEvidence": user_instruction_evidence(),
            "deterministicFullCoverageRequired": True,
            "all1420ContractsMustValidateBeforeAnyWrite": True,
            "individualJsonEntryReviewClaimed": False,
            "downstreamSanitizedPdfOutputQaRequired": True,
        },
        "humanAttestation": {
            "confirmed": False,
            "reviewer": None,
            "reviewedAt": None,
            "statement": "No claim is made that a human manually reviewed every generated JSON contract entry.",
        },
        "authorizationBoundary": copy.deepcopy(AUTHORIZATION_BOUNDARY),
        "prohibitedActionsPerformed": copy.deepcopy(PROHIBITED_ACTIONS_PERFORMED),
    }


def validate_request_and_decision(
    context: dict[str, Any],
    request: dict[str, Any],
    request_evidence: dict[str, Any],
    decision: dict[str, Any],
) -> None:
    expected_request = build_approval_request(context)
    require(request == expected_request, "Approval request is stale or differs from exact derived scope")
    expected_decision = build_user_authorized_decision(
        context, expected_request, request_evidence
    )
    require(decision == expected_decision, "Sanitization approval decision is stale or not exact")
    require(
        decision["bulkAuthorization"]["individualJsonEntryReviewClaimed"] is False
        and decision["humanAttestation"]["confirmed"] is False,
        "Decision makes an unsupported individual-entry review claim",
    )
    all_false(decision["prohibitedActionsPerformed"], "Sanitization decision")


def atomic_write_artifact(path: Path, payload: bytes) -> None:
    require(not path.exists(), f"Refusing to overwrite existing artifact: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "wb", dir=path.parent, delete=False, prefix=f".{path.name}.", suffix=".tmp"
    ) as handle:
        temporary = Path(handle.name)
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def write_json_with_sidecar(
    run_directory: Path, relative: PurePosixPath, value: dict[str, Any]
) -> dict[str, Any]:
    path = run_path(run_directory, relative, "JSON output")
    sidecar = Path(f"{path}.sha256")
    require(not sidecar.exists(), f"Refusing to overwrite existing sidecar: {sidecar}")
    payload = pretty_json_bytes(value)
    digest = sha256_bytes(payload)
    atomic_write_artifact(path, payload)
    try:
        atomic_write_artifact(sidecar, f"{digest}  {path.name}\n".encode("utf-8"))
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"path": str(relative), "sha256": digest, "bytes": len(payload)}


def read_required_request_decision(
    context: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    run_directory = context["runDirectory"]
    request, request_evidence = read_json_artifact(
        run_directory, APPROVAL_REQUEST_RELATIVE_PATH, "Sanitization approval request"
    )
    verify_sidecar(run_directory, request_evidence)
    decision, decision_evidence = read_json_artifact(
        run_directory, APPROVAL_DECISION_RELATIVE_PATH, "Sanitization approval decision"
    )
    verify_sidecar(run_directory, decision_evidence)
    validate_request_and_decision(context, request, request_evidence, decision)
    return request, request_evidence, decision, decision_evidence


def approved_batch_evidence(
    context: dict[str, Any],
    row: dict[str, Any],
    request_evidence: dict[str, Any],
    decision_evidence: dict[str, Any],
) -> dict[str, Any]:
    return {
        "sanitizationPlan": copy.deepcopy(context["planEvidence"]),
        "candidateManifest": copy.deepcopy(context["candidateManifestEvidence"]),
        "candidateFile": copy.deepcopy(row["candidate"]),
        "geometryAudit": copy.deepcopy(context["plan"]["inputEvidence"]["geometryAudit"]),
        "approvedGeometrySupplement": copy.deepcopy(
            context["approved"]["supplementEvidence"]
        ),
        "approvedTemplateResolutionPlan": copy.deepcopy(
            context["approved"]["resolutionEvidence"]
        ),
        "approvedTemplatePromotionManifest": copy.deepcopy(
            context["approved"]["manifestEvidence"]
        ),
        "verifiedBeschnittGuideDonors": copy.deepcopy(
            context["guideDonors"]["reportEvidence"]
        ),
        "verifiedBeschnittGuideDonorPromotionManifest": copy.deepcopy(
            context["guideDonors"]["promotionManifestEvidence"]
        ),
        "sanitizationContractApprovalRequest": copy.deepcopy(request_evidence),
        "sanitizationContractApprovalDecision": copy.deepcopy(decision_evidence),
        "sanitizerExecutionImplementation": copy.deepcopy(
            context["sanitizerEvidence"]
        ),
        "executionBindingKey": row["executionBindingKey"],
        "geometryAuditBinding": copy.deepcopy(row["geometryAuditBinding"]),
        "geometrySupplementBinding": copy.deepcopy(row["geometrySupplementBinding"]),
        "templateResolutionBinding": copy.deepcopy(row["templateResolutionBinding"]),
        "resolutionClassification": row["resolutionClassification"],
        "resolutionEntrySha256": row["resolutionEntrySha256"],
        "verifiedBeschnittGuideDonorEntrySha256": row[
            "guideDonorEntrySha256"
        ],
    }


def build_contract(
    context: dict[str, Any],
    row: dict[str, Any],
    decision: dict[str, Any],
    request_evidence: dict[str, Any],
    decision_evidence: dict[str, Any],
) -> dict[str, Any]:
    job = next(item for item in context["plan"]["jobs"] if item["jobId"] == row["jobId"])
    candidate = context["candidates"][row["jobId"]]["value"]
    profile = context["profileBySha256"][row["profileSha256"]]
    base_evidence = context["describedCache"][(row["sourceSha256"], row["expectedGeometryKey"])]
    source_evidence = source_evidence_for_finish(
        base_evidence, row["geometry"], row["finishKey"]
    )
    spot_finish = {
        "required": False,
        "allowedColorants": copy.deepcopy(source_evidence["spotColorants"]),
        "requiredColorants": [],
        "requiredLayerNames": [],
        "minimumPaintOperators": 0,
    }
    warning = (
        context["sanitizer"].PROFESSIONAL_UPLOAD_WARNING_DA
        if row["finishKey"] in context["sanitizer"].SPOT_FINISHES
        else None
    )
    contract_path = safe_relative_path(
        row["reviewedContractPath"],
        f"{row['jobId']} contract output",
        prefix="documents/sanitization-contracts/",
        suffix=".json",
    )
    require(
        contract_path == PurePosixPath(CONTRACT_DIRECTORY_RELATIVE_PATH, f"{row['jobId']}.json"),
        f"Contract path differs from exact job ID: {row['jobId']}",
    )
    contract = {
        "schemaVersion": 1,
        "kind": "wmd_sales_folder_sanitization_contract",
        "state": "approved_for_sanitization",
        "reviewState": "approved_for_sanitization",
        "localOnly": True,
        "eligibleForSanitization": True,
        "eligibleForTemplateImport": False,
        "geometry": copy.deepcopy(row["geometry"]),
        "finishKey": row["finishKey"],
        "sourceEvidence": source_evidence,
        "layers": copy.deepcopy(profile["layerPolicies"]),
        "requiredGeometryRoles": ["cut", "fold", "bleed", "safety"],
        "productionMeasurements": copy.deepcopy(source_evidence["productionMeasurements"]),
        "sourceText": {
            "sha256": source_evidence["textSha256"],
            "requiredPatterns": list(profile["sourceTextRequiredPatterns"]),
        },
        "colors": {
            "allowedDescriptors": copy.deepcopy(source_evidence["colorDescriptors"]),
            "noPrintAreas": copy.deepcopy(profile["noPrintPolicy"]["convertedAreas"]),
            "generatedNoPrintBackgrounds": copy.deepcopy(
                profile["noPrintPolicy"]["generatedBackgrounds"]
            ),
        },
        "spotFinish": spot_finish,
        "finishInstructions": [],
        "professionalUploadWarningDa": warning,
        "informationPanels": [
            {
                "page": profile["informationPanel"]["page"],
                "rectPt": copy.deepcopy(profile["informationPanel"]["rectPt"]),
            }
        ],
        "geometryAudit": copy.deepcopy(row["geometryAuditBinding"]),
        "geometrySupplement": copy.deepcopy(row["geometrySupplementBinding"]),
        "templateResolutionPlan": copy.deepcopy(row["templateResolutionBinding"]),
        "verifiedBeschnittGuideDonor": (
            {
                "reportSha256": context["guideDonors"]["reportEvidence"]["sha256"],
                "entrySha256": row["guideDonorEntrySha256"],
            }
            if row["guideDonorEntrySha256"] is not None
            else None
        ),
        "review": {
            "reviewer": decision["reviewer"],
            "reviewedAt": decision["reviewedAt"],
            "note": (
                "Godkendt via brugerens afgrænsede lokale batchpolitik; der påstås "
                "ikke manuel gennemgang af hver JSON-post. Kilde-, lag- og "
                "geometrievidens er deterministisk valideret, og hvert PDF-output "
                "kræver efterfølgende visuel QA."
            ),
        },
        "candidateIdentity": {
            "jobId": row["jobId"],
            "safeOutputSignature": copy.deepcopy(job["safeOutputSignature"]),
            "safeOutputSignatureSha256": row["safeOutputSignatureSha256"],
            "candidatePath": candidate["candidateIdentity"]["candidatePath"],
            "approvedContractPath": str(contract_path),
        },
        "batchEvidence": approved_batch_evidence(
            context, row, request_evidence, decision_evidence
        ),
        "derivedPolicyEvidence": {
            "approvalRequestSha256": request_evidence["sha256"],
            "profileSha256": profile["profileSha256"],
            "informationPanelDerivationMode": profile["informationPanel"]["derivationMode"],
            "noPrintDerivationMode": profile["noPrintPolicy"]["derivation"]["mode"],
            "verifiedBeschnittGuideDonorEntrySha256": row[
                "guideDonorEntrySha256"
            ],
            "individualJsonEntryReviewClaimed": False,
            "downstreamSanitizedPdfOutputQaRequired": True,
        },
        "authorizationBoundary": copy.deepcopy(AUTHORIZATION_BOUNDARY),
        "prohibitedActionsPerformed": copy.deepcopy(PROHIBITED_ACTIONS_PERFORMED),
    }
    require("REVIEW_REQUIRED" not in canonical_json(contract), f"Contract has a review placeholder: {row['jobId']}")
    require("candidate_requires_human_review" not in canonical_json(contract), f"Approved contract retains candidate state: {row['jobId']}")
    require(
        not CD_MODEL_PATTERN.search(
            canonical_json(
                {
                    "jobId": row["jobId"],
                    "geometry": row["geometry"],
                    "sourcePath": row["sourcePath"],
                }
            )
        ),
        f"CD model leaked into contract: {row['jobId']}",
    )
    return contract


def validate_all_contracts(
    context: dict[str, Any],
    decision: dict[str, Any],
    request_evidence: dict[str, Any],
    decision_evidence: dict[str, Any],
    progress: bool = False,
) -> list[dict[str, Any]]:
    run_directory = context["runDirectory"]
    sanitizer = context["sanitizer"]
    audit_path = run_path(run_directory, GEOMETRY_AUDIT_RELATIVE_PATH, "Geometry audit")
    supplement_path = run_path(
        run_directory, APPROVED_SUPPLEMENT_RELATIVE_PATH, "Approved supplement"
    )
    resolution_path = run_path(
        run_directory, APPROVED_RESOLUTION_RELATIVE_PATH, "Approved resolution plan"
    )
    # One fresh cache is scoped to this exact all-contract preflight.  The
    # sanitizer still validates every contract and re-hashes every referenced
    # file; it only reuses immutable parsed/source observations and the global
    # resolution-graph proof while their content identities remain exact.
    validation_cache = sanitizer.BatchValidationCache()
    results = []
    for index, row in enumerate(context["jobRows"], 1):
        contract = build_contract(
            context, row, decision, request_evidence, decision_evidence
        )
        source_path = run_path(
            run_directory,
            safe_relative_path(row["sourcePath"], f"{row['jobId']} source"),
            f"{row['jobId']} source",
        )
        try:
            sanitizer.validate_contract(
                contract,
                source_path,
                audit_path,
                supplement_path if contract["geometrySupplement"] is not None else None,
                resolution_path if contract["templateResolutionPlan"] is not None else None,
                validation_cache=validation_cache,
            )
        except sanitizer.SalesFolderSanitizationError as exc:
            raise ContractPromotionError(
                f"Contract validation failed at {index}/{EXPECTED_JOB_COUNT} "
                f"for {row['jobId']}: {exc}"
            ) from exc
        payload = pretty_json_bytes(contract)
        results.append(
            {
                "row": row,
                "contract": contract,
                "payload": payload,
                "sha256": sha256_bytes(payload),
                "bytes": len(payload),
            }
        )
        if progress and (index == 1 or index % 100 == 0 or index == EXPECTED_JOB_COUNT):
            print(f"validated {index}/{EXPECTED_JOB_COUNT}", file=os.sys.stderr)
    require(len(results) == EXPECTED_JOB_COUNT, "Contract validation coverage drifted")
    return results


def build_manifest(
    context: dict[str, Any],
    decision: dict[str, Any],
    decision_evidence: dict[str, Any],
    contracts: list[dict[str, Any]],
) -> dict[str, Any]:
    contract_files = [
        {
            "jobId": item["row"]["jobId"],
            "path": item["row"]["reviewedContractPath"],
            "sha256": item["sha256"],
            "bytes": item["bytes"],
            "safeOutputSignatureSha256": item["row"]["safeOutputSignatureSha256"],
            "sourceSha256": item["row"]["sourceSha256"],
            "state": "approved_for_sanitization",
        }
        for item in contracts
    ]
    require(
        contract_files == sorted(contract_files, key=lambda item: item["jobId"]),
        "Contract manifest rows are not sorted",
    )
    manifest = {
        "schemaVersion": 1,
        "kind": "wmd_sales_folder_sanitization_contract_manifest",
        "state": "approved_for_sanitization",
        "reviewState": "approved_for_sanitization",
        "localOnly": True,
        "eligibleForSanitization": True,
        "eligibleForTemplateImport": False,
        "executionAuthorization": {
            "approved": True,
            "reviewer": decision["reviewer"],
            "reviewedAt": decision["reviewedAt"],
            "expectedOutputCount": EXPECTED_JOB_COUNT,
            "allContractsApproved": True,
            "localPdfAuthoringOnly": True,
            "individualJsonEntryReviewClaimed": False,
        },
        "counts": {
            "approvedContracts": EXPECTED_JOB_COUNT,
            "expectedOutputCount": EXPECTED_JOB_COUNT,
        },
        "planEvidence": copy.deepcopy(context["planEvidence"]),
        "sanitizerImplementation": copy.deepcopy(context["sanitizerEvidence"]),
        "approvalEvidence": {
            "templatePromotionManifest": copy.deepcopy(
                context["approved"]["manifestEvidence"]
            ),
            "sanitizationContractApprovalDecision": copy.deepcopy(decision_evidence),
            "verifiedBeschnittGuideDonorReport": copy.deepcopy(
                context["guideDonors"]["reportEvidence"]
            ),
            "verifiedBeschnittGuideDonorPromotionManifest": copy.deepcopy(
                context["guideDonors"]["promotionManifestEvidence"]
            ),
        },
        "derivedEvidence": {
            "approvalRequest": copy.deepcopy(decision["approvalRequest"]),
            "approvalScopeSha256": decision["approvalScopeSha256"],
            "sourceProfiles": EXPECTED_SOURCE_PROFILE_COUNT,
            "exactSourcePanelProfiles": EXPECTED_EXACT_PANEL_PROFILE_COUNT,
            "minimumExpandedPanelProfiles": EXPECTED_EXPANDED_PANEL_PROFILE_COUNT,
            "convertedNoPrintJobs": EXPECTED_CONVERTED_FULL_PAGE_JOB_COUNT,
            "generatedNoPrintJobs": EXPECTED_GENERATED_FULL_PAGE_JOB_COUNT,
            "verifiedBeschnittGuideDonorProfiles": EXPECTED_GUIDE_DONOR_PROFILE_COUNT,
            "verifiedBeschnittGuideDonorJobs": EXPECTED_GUIDE_DONOR_JOB_COUNT,
        },
        "authorizationBoundary": copy.deepcopy(AUTHORIZATION_BOUNDARY),
        "outputQa": {
            "required": True,
            "allSanitizedPdfOutputsMustBeRenderedAndReviewed": True,
            "contractValidationIsNotPdfVisualQa": True,
        },
        "contractFiles": contract_files,
        "generator": {
            "script": str(SCRIPT_RELATIVE_PATH),
            "schemaVersion": 1,
            "deterministicForIdenticalInputs": True,
        },
        "prohibitedActionsPerformed": copy.deepcopy(PROHIBITED_ACTIONS_PERFORMED),
    }
    return manifest


def write_contract_batch(
    context: dict[str, Any], manifest: dict[str, Any], contracts: list[dict[str, Any]]
) -> dict[str, Any]:
    output = run_path(
        context["runDirectory"], CONTRACT_DIRECTORY_RELATIVE_PATH, "Contract output"
    )
    require(not output.exists(), f"Refusing to overwrite existing contract output: {output}")
    temporary = Path(tempfile.mkdtemp(prefix=".sanitization-contracts-", dir=output.parent))
    try:
        for item in contracts:
            path = temporary / f"{item['row']['jobId']}.json"
            path.write_bytes(item["payload"])
        manifest_payload = pretty_json_bytes(manifest)
        manifest_sha = sha256_bytes(manifest_payload)
        (temporary / "manifest.json").write_bytes(manifest_payload)
        (temporary / "manifest.json.sha256").write_text(
            f"{manifest_sha}  manifest.json\n", encoding="utf-8"
        )
        checksum_lines = [f"{manifest_sha}  manifest.json"]
        checksum_lines.extend(
            f"{item['sha256']}  {item['row']['jobId']}.json" for item in contracts
        )
        (temporary / "checksums.sha256").write_text(
            "\n".join(checksum_lines) + "\n", encoding="utf-8"
        )
        expected_names = {
            "manifest.json", "manifest.json.sha256", "checksums.sha256",
            *{f"{item['row']['jobId']}.json" for item in contracts},
        }
        require(
            {path.name for path in temporary.iterdir()} == expected_names,
            "Temporary contract batch contains unexpected files",
        )
        os.replace(temporary, output)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return {
        "outputDirectory": str(CONTRACT_DIRECTORY_RELATIVE_PATH),
        "manifestSha256": sha256_bytes(pretty_json_bytes(manifest)),
        "approvedContracts": len(contracts),
        "pdfsCreated": 0,
    }


def command_request(context: dict[str, Any]) -> dict[str, Any]:
    request = build_approval_request(context)
    evidence = write_json_with_sidecar(
        context["runDirectory"], APPROVAL_REQUEST_RELATIVE_PATH, request
    )
    return {"request": evidence, "profiles": len(context["profiles"])}


def command_decision(context: dict[str, Any]) -> dict[str, Any]:
    request, request_evidence = read_json_artifact(
        context["runDirectory"], APPROVAL_REQUEST_RELATIVE_PATH, "Sanitization approval request"
    )
    verify_sidecar(context["runDirectory"], request_evidence)
    require(request == build_approval_request(context), "Approval request is stale")
    decision = build_user_authorized_decision(context, request, request_evidence)
    evidence = write_json_with_sidecar(
        context["runDirectory"], APPROVAL_DECISION_RELATIVE_PATH, decision
    )
    return {
        "decision": evidence,
        "individualJsonEntryReviewClaimed": False,
        "downstreamSanitizedPdfOutputQaRequired": True,
    }


def command_verify_or_promote(
    context: dict[str, Any], *, write: bool, progress: bool
) -> dict[str, Any]:
    request, request_evidence, decision, decision_evidence = read_required_request_decision(context)
    del request
    contracts = validate_all_contracts(
        context, decision, request_evidence, decision_evidence, progress=progress
    )
    manifest = build_manifest(context, decision, decision_evidence, contracts)
    if not write:
        return {
            "verified": True,
            "approvedContracts": len(contracts),
            "wouldWrite": str(CONTRACT_DIRECTORY_RELATIVE_PATH),
            "manifestSha256": sha256_bytes(pretty_json_bytes(manifest)),
            "pdfsCreated": 0,
        }
    return write_contract_batch(context, manifest, contracts)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=("request", "record-user-authorized-decision", "verify", "promote")
    )
    parser.add_argument("--run-dir", type=Path, default=DEFAULT_RUN_DIRECTORY)
    parser.add_argument("--progress", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        context = build_context(args.run_dir)
        if args.command == "request":
            result = command_request(context)
        elif args.command == "record-user-authorized-decision":
            result = command_decision(context)
        elif args.command == "verify":
            result = command_verify_or_promote(context, write=False, progress=args.progress)
        else:
            result = command_verify_or_promote(context, write=True, progress=args.progress)
    except (ContractPromotionError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=os.sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
