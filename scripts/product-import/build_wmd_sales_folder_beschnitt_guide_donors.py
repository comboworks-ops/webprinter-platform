#!/usr/bin/env python3
"""Build exact source-backed Beschnitt guide-donor evidence for five PDFs.

The five reviewed source PDFs remain authoritative.  This tool proves that a
same-geometry supplier PDF can donate only its stroked ``Beschnitt Seite``
paths.  It never authors a PDF and never permits a whole-PDF source rebind.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import stat
import tempfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import Any


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIRECTORY.parent.parent
DEFAULT_RUN_DIRECTORY = (
    REPOSITORY_ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
)
SCRIPT_RELATIVE_PATH = PurePosixPath(
    "scripts/product-import/build_wmd_sales_folder_beschnitt_guide_donors.py"
)
SANITIZER_RELATIVE_PATH = PurePosixPath(
    "scripts/product-templates/sanitize_wmd_sales_folder_template.py"
)
UPSTREAM_DECISION_RELATIVE_PATH = PurePosixPath(
    "review/template-approval-decision.json"
)
REPORT_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/verified-beschnitt-guide-donors.json"
)
PROMOTION_MANIFEST_RELATIVE_PATH = PurePosixPath(
    "review/approved-template-package/verified-beschnitt-guide-donor-promotion-manifest.json"
)

STROKE_OPERATORS = {b"S", b"s", b"B", b"B*", b"b", b"b*"}
EXPECTED_ENTRY_COUNT = 5

# These identities are intentionally an allowlist, not discovery heuristics.
# The source-only hashes were independently reviewed as one exact full-page
# contour per page and match a donor Beschnitt stroke on that same page.
GUIDE_DONOR_MAPPINGS = (
    {
        "geometryKey": "a4|2-part-2-flaps|4+0|3mm",
        "source": {
            "localRelativePath": "documents/source-pdfs/c4a01bb1342f35e5-mappe_din_a4_2teilig_2laschen_3mm_40plus_2.pdf",
            "sha256": "5ac5f32fa0d855ae9434f58b0cf54a1c60684e4cbcd432e4cc72021c48f8c1fe",
        },
        "donor": {
            "localRelativePath": "documents/source-pdfs/93e6f578a8a9ea92-mappe_din_a4_2teilig_2laschen_3mm_40_2.pdf",
            "sha256": "89300700e5b357fd56246bb600bb5dd55c4850fecc4d17d86e22c85fbefb8b1a",
        },
        "pageBoxesSha256": "af8db7bcc35fc825f80222f46bd49ea4eda080a0d1a33de00c81d338410391a9",
        "rillenStrokeCount": 12,
        "sourceSchneidenStrokeCount": 54,
        "donorSchneidenStrokeCount": 54,
        "donorBeschnittStrokeCount": 8,
        "sourceOnlyReclassified": (),
    },
    {
        "geometryKey": "a5|2-part-3-flaps|4+0|3mm",
        "source": {
            "localRelativePath": "documents/source-pdfs/b21e2475362e9919-mappe_din_a5_2teilig_3laschen_3mm_40plus_2.pdf",
            "sha256": "660a8748281cb6d681dde963630efd382edea08ec32fc292ac084d144a865ade",
        },
        "donor": {
            "localRelativePath": "documents/source-pdfs/548e8d0d7c14b687-mappe_din_a5_2teilig_3laschen_3mm_40_2.pdf",
            "sha256": "c274f30ff3251d94081537c5b78eb96791148699a431112a0f85c8f82d77e76b",
        },
        "pageBoxesSha256": "80462f54a92c08b030f839ff5895e7e80bdd03d7ed16cc706db7927cbfa58013",
        "rillenStrokeCount": 20,
        "sourceSchneidenStrokeCount": 92,
        "donorSchneidenStrokeCount": 90,
        "donorBeschnittStrokeCount": 12,
        "sourceOnlyReclassified": (
            "6472a59fd6659633d1fd48b5275b2148475e11ecbf5bb1e17960b75e4bf769c4",
            "cf51d053fec75829adcb060cf6998012c67204bb572da902db0539829aac0d50",
        ),
    },
    {
        "geometryKey": "a5|2-part-3-flaps|4+0|5mm",
        "source": {
            "localRelativePath": "documents/source-pdfs/7609d840ce9f73a8-mappe_din_a5_2teilig_3laschen_5mm_40plus_2.pdf",
            "sha256": "31707d23cf399adb88b9594e21565ad38959e26f25c838e6ab9019f0299c2015",
        },
        "donor": {
            "localRelativePath": "documents/source-pdfs/cb5c7ffa11863e63-mappe_din_a5_2teilig_3laschen_5mm_40_2.pdf",
            "sha256": "18c6144f217fdc2d3957a8340cc841b6a0b6047b8fef70b3d65e370464c2534d",
        },
        "pageBoxesSha256": "eaf2a7e5997f8eb58ddaf66a23edb8883b0e219f4009e05d0ec239b5d50e766b",
        "rillenStrokeCount": 20,
        "sourceSchneidenStrokeCount": 110,
        "donorSchneidenStrokeCount": 108,
        "donorBeschnittStrokeCount": 12,
        "sourceOnlyReclassified": (
            "550b2bca2238bfa7a6ac6f9d4d3a2164de3c7e1d77b65d1aac28b8362a2298c0",
            "5cc42e48b10ecc41fbed3a95a0200edce81a339a21164c77d35c208faf3d20cf",
        ),
    },
    {
        "geometryKey": "a5|2-part-3-flaps|4+0|10mm",
        "source": {
            "localRelativePath": "documents/source-pdfs/fa00ab2372d6b4bd-mappe_din_a5_2teilig_3laschen_10mm_40plus_2.pdf",
            "sha256": "04a45942e622ec7892dd67eed925ee0b9eee5b76de3b0fd35014c74936aa7529",
        },
        "donor": {
            "localRelativePath": "documents/source-pdfs/6cf8103cf496214f-mappe_din_a5_2teilig_3laschen_10mm_40plus_2.pdf",
            "sha256": "506ee01a93a2802c72f19a7e88eb25999b9335486e2345f9fe37edd68c1ef6e0",
        },
        "pageBoxesSha256": "cf696197c917b6e0a4acc80c72320d933c6840692859c3e29cbdf712687d057c",
        "rillenStrokeCount": 20,
        "sourceSchneidenStrokeCount": 100,
        "donorSchneidenStrokeCount": 98,
        "donorBeschnittStrokeCount": 12,
        "sourceOnlyReclassified": (
            "8a66ab1804b9c87765fa239bcbd766232f337bd73fcf73de960d3191aade08d3",
            "1546589b34f5f8008f347b27025808aff863751703536f5d3108038a653a9b88",
        ),
    },
    {
        "geometryKey": "a6|2-part-closure|4+4|5mm",
        "source": {
            "localRelativePath": "documents/source-pdfs/d2b842e0e4c3eeba-mappe_din_a6_3laschen_verschluss_5mm_44_2.pdf",
            "sha256": "98de75b1daca5c49bf32364fe13cd49ef515058e077d8404d56a7331015d13ef",
        },
        "donor": {
            "localRelativePath": "documents/source-pdfs/13c4b1d984c1c7c6-mappe_din_a6_3laschen_verschluss_5mm_44plus_2.pdf",
            "sha256": "65c784b17273651ce26df480fc8b9e0fedaf291359eda5e572d9f0b05154e934",
        },
        "pageBoxesSha256": "0d0a6824fb646e78c445b7003c28f5264699d2a824bec8893d0fbe51769f0e21",
        "rillenStrokeCount": 16,
        "sourceSchneidenStrokeCount": 56,
        "donorSchneidenStrokeCount": 54,
        "donorBeschnittStrokeCount": 6,
        "sourceOnlyReclassified": (
            "bf6d018031a55466571af35219e4fbacd00fb0288a5c50052463e28c0325d63c",
            "6b6cd9a79c764e25df0bef79f3295e946b4baac78a64613d9d2c1602a168a2ad",
        ),
    },
)


class GuideDonorEvidenceError(RuntimeError):
    """Fail-closed guide-donor evidence error."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise GuideDonorEvidenceError(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def pretty_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def read_regular_bytes(path: Path, label: str) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise GuideDonorEvidenceError(
            f"{label} must be a readable regular non-symlink file: {exc}"
        ) from exc
    try:
        status = os.fstat(descriptor)
        require(stat.S_ISREG(status.st_mode), f"{label} must be a regular file")
        chunks = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def run_path(run_directory: Path, relative: str | PurePosixPath, label: str) -> Path:
    value = PurePosixPath(str(relative))
    require(
        not value.is_absolute()
        and ".." not in value.parts
        and value.parts,
        f"Unsafe {label} path: {relative}",
    )
    resolved = (run_directory / Path(*value.parts)).resolve()
    require(
        resolved == run_directory or run_directory in resolved.parents,
        f"{label} escapes the run directory",
    )
    return resolved


def load_module(path: Path, name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def identity(run_directory: Path, expected: dict[str, str], label: str) -> tuple[Path, dict[str, Any]]:
    path = run_path(run_directory, expected["localRelativePath"], label)
    payload = read_regular_bytes(path, label)
    digest = sha256_bytes(payload)
    require(digest == expected["sha256"], f"{label} SHA-256 drifted")
    return path, {
        "localRelativePath": expected["localRelativePath"],
        "sha256": digest,
        "bytes": len(payload),
    }


def stroke_inventory(reader: Any, sanitizer: ModuleType) -> dict[str, list[dict[str, Any]]]:
    output: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in sanitizer.stroke_path_inventory(reader):
        layer = event["layer"] or "__unlayered__"
        output[layer].append(
            {
                "page": event["page"],
                "pathGeometrySha256": event["pathGeometrySha256"],
                "effectiveBbox": event["effectiveBbox"],
            }
        )
    return output


def path_hashes(inventory: dict[str, list[dict[str, Any]]], layer: str) -> list[str]:
    return [item["pathGeometrySha256"] for item in inventory.get(layer, [])]


def layer_record(layer: str, ordered: list[str]) -> dict[str, Any]:
    return {
        "layerName": layer,
        "strokePaintCount": len(ordered),
        "orderedPathGeometrySha256s": ordered,
        "orderedSha256": sha256_json(ordered),
        "sortedMultisetSha256": sha256_json(sorted(ordered)),
    }


def rounded_bbox(values: list[float]) -> list[float]:
    output = []
    for value in values:
        rounded = round(float(value), 3)
        output.append(0.0 if rounded == 0 else rounded)
    return output


def counter_subset(subset: list[str], superset: list[str]) -> bool:
    return not (Counter(subset) - Counter(superset))


def build_entry(
    run_directory: Path,
    mapping: dict[str, Any],
    sanitizer: ModuleType,
) -> dict[str, Any]:
    PdfReader = sanitizer.PdfReader
    source_path, source_identity = identity(run_directory, mapping["source"], "Source PDF")
    donor_path, donor_identity = identity(run_directory, mapping["donor"], "Donor PDF")
    source_reader = PdfReader(str(source_path), strict=True)
    donor_reader = PdfReader(str(donor_path), strict=True)
    source_boxes = sanitizer.page_box_inventory(source_reader)
    donor_boxes = sanitizer.page_box_inventory(donor_reader)
    require(source_boxes == donor_boxes, f"Page boxes differ for {mapping['geometryKey']}")
    require(len(source_boxes) == 2, f"Page count drifted for {mapping['geometryKey']}")
    page_boxes_sha = sha256_json(source_boxes)
    require(
        page_boxes_sha == mapping["pageBoxesSha256"],
        f"Page-box SHA-256 drifted for {mapping['geometryKey']}",
    )

    source_inventory = stroke_inventory(source_reader, sanitizer)
    donor_inventory = stroke_inventory(donor_reader, sanitizer)
    source_beschnitt = path_hashes(source_inventory, "Beschnitt Seite")
    donor_beschnitt = path_hashes(donor_inventory, "Beschnitt Seite")
    source_rillen = path_hashes(source_inventory, "Rillen")
    donor_rillen = path_hashes(donor_inventory, "Rillen")
    source_schneiden = path_hashes(source_inventory, "Schneiden")
    donor_schneiden = path_hashes(donor_inventory, "Schneiden")

    require(not source_beschnitt, f"Source Beschnitt unexpectedly has strokes: {mapping['geometryKey']}")
    require(
        len(donor_beschnitt) == mapping["donorBeschnittStrokeCount"],
        f"Donor Beschnitt stroke count drifted for {mapping['geometryKey']}",
    )
    require(
        len(source_rillen) == len(donor_rillen) == mapping["rillenStrokeCount"]
        and Counter(source_rillen) == Counter(donor_rillen),
        f"Rillen stroke evidence differs for {mapping['geometryKey']}",
    )
    require(
        len(source_schneiden) == mapping["sourceSchneidenStrokeCount"]
        and len(donor_schneiden) == mapping["donorSchneidenStrokeCount"]
        and counter_subset(donor_schneiden, source_schneiden),
        f"Schneiden stroke evidence differs for {mapping['geometryKey']}",
    )

    source_only_counter = Counter(source_schneiden) - Counter(donor_schneiden)
    source_only_ordered: list[str] = []
    remaining = source_only_counter.copy()
    for value in source_schneiden:
        if remaining[value] > 0:
            source_only_ordered.append(value)
            remaining[value] -= 1
    expected_source_only = list(mapping["sourceOnlyReclassified"])
    require(
        source_only_ordered == expected_source_only,
        f"Source-only cut contour order drifted for {mapping['geometryKey']}",
    )
    require(
        counter_subset(source_only_ordered, donor_beschnitt),
        f"Source-only contours do not match donor Beschnitt for {mapping['geometryKey']}",
    )
    reclassified = []
    for path_hash in source_only_ordered:
        source_matches = [
            item
            for item in source_inventory["Schneiden"]
            if item["pathGeometrySha256"] == path_hash
        ]
        donor_matches = [
            item
            for item in donor_inventory["Beschnitt Seite"]
            if item["pathGeometrySha256"] == path_hash
        ]
        require(
            len(source_matches) == len(donor_matches) == 1,
            f"Reclassified contour does not resolve uniquely for {mapping['geometryKey']}",
        )
        source_event = source_matches[0]
        donor_event = donor_matches[0]
        require(
            source_event["page"] == donor_event["page"],
            f"Reclassified contour page differs for {mapping['geometryKey']}",
        )
        media = rounded_bbox(source_boxes[source_event["page"] - 1]["mediabox"])
        source_bbox = rounded_bbox(source_event["effectiveBbox"])
        donor_bbox = rounded_bbox(donor_event["effectiveBbox"])
        require(
            source_bbox == donor_bbox
            and sanitizer.full_media_box_contour(source_bbox, media),
            f"Reclassified contour is not the exact full MediaBox for {mapping['geometryKey']}",
        )
        reclassified.append(
            {
                "page": source_event["page"],
                "pathGeometrySha256": path_hash,
                "effectiveBbox": source_bbox,
                "equalsDonorBeschnittPath": True,
                "fullMediaBoxOuterContour": True,
            }
        )

    entry: dict[str, Any] = {
        "geometryKey": mapping["geometryKey"],
        "source": source_identity,
        "donor": donor_identity,
        "pageCount": len(source_boxes),
        "pageBoxesSha256": page_boxes_sha,
        "sourceBeschnitt": layer_record("Beschnitt Seite", source_beschnitt),
        "donorBeschnitt": layer_record("Beschnitt Seite", donor_beschnitt),
        "rillen": {
            "layerName": "Rillen",
            "sourceStrokeCount": len(source_rillen),
            "donorStrokeCount": len(donor_rillen),
            "sourceSortedMultisetSha256": sha256_json(sorted(source_rillen)),
            "donorSortedMultisetSha256": sha256_json(sorted(donor_rillen)),
            "exactMultisetEqual": True,
        },
        "schneiden": {
            "layerName": "Schneiden",
            "sourceStrokeCount": len(source_schneiden),
            "donorStrokeCount": len(donor_schneiden),
            "sourceSortedMultisetSha256": sha256_json(sorted(source_schneiden)),
            "donorSortedMultisetSha256": sha256_json(sorted(donor_schneiden)),
            "donorIsExactMultisetSubset": True,
            "sourceOnlyReclassified": reclassified,
            "sourceOnlySortedMultisetSha256": sha256_json(sorted(source_only_ordered)),
        },
        "importPolicy": {
            "exclusiveDonorLayerName": "Beschnitt Seite",
            "importedStrokePathGeometrySha256s": donor_beschnitt,
            "removeSourceSchneidenPathGeometrySha256s": source_only_ordered,
            "preserveOriginalSourceForAllOtherGeometry": True,
            "noFullPdfRebind": True,
            "noTextApproximation": True,
        },
        "optionalAccessoryGeometryPreservedFromSource": True,
    }
    entry["entrySha256"] = sha256_json(entry)
    return entry


def read_upstream_approval(run_directory: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    path = run_path(run_directory, UPSTREAM_DECISION_RELATIVE_PATH, "Upstream decision")
    payload = read_regular_bytes(path, "Upstream decision")
    try:
        decision = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GuideDonorEvidenceError(f"Cannot parse upstream decision: {exc}") from exc
    require(
        decision.get("decisionMode") == "user_directed_bulk_local_sanitization_policy"
        and decision.get("bulkAuthorization", {}).get("individualJsonEntryReviewClaimed") is False,
        "Upstream user-directed approval evidence drifted",
    )
    reviewer = decision.get("reviewer")
    reviewed_at = decision.get("reviewedAt")
    require(isinstance(reviewer, str) and reviewer.strip(), "Upstream reviewer is missing")
    require(isinstance(reviewed_at, str) and reviewed_at.endswith("Z"), "Upstream review time is invalid")
    return decision, {
        "path": str(UPSTREAM_DECISION_RELATIVE_PATH),
        "sha256": sha256_bytes(payload),
        "bytes": len(payload),
    }


def build_report(run_directory: Path, sanitizer: ModuleType | None = None) -> dict[str, Any]:
    run_directory = run_directory.resolve()
    require(run_directory.is_dir(), f"Run directory does not exist: {run_directory}")
    if sanitizer is None:
        sanitizer = load_module(
            (REPOSITORY_ROOT / Path(*SANITIZER_RELATIVE_PATH.parts)).resolve(),
            "wmd_beschnitt_guide_donor_builder_sanitizer",
        )
    decision, _ = read_upstream_approval(run_directory)
    entries = [
        build_entry(run_directory, mapping, sanitizer)
        for mapping in GUIDE_DONOR_MAPPINGS
    ]
    entries.sort(key=lambda item: item["geometryKey"])
    require(len(entries) == EXPECTED_ENTRY_COUNT, "Guide-donor entry count drifted")
    require(
        len({item["source"]["sha256"] for item in entries}) == EXPECTED_ENTRY_COUNT,
        "Guide-donor source identities are not unique",
    )
    return {
        "kind": "wmd_sales_folder_verified_beschnitt_guide_donors",
        "schemaVersion": 1,
        "reviewState": "approved_user_directed_deterministic_correction",
        "approval": {
            "decisionMode": "user_directed_deterministic_correction",
            "individualJsonEntryReviewClaimed": False,
            "reviewer": decision["reviewer"],
            "reviewedAt": decision["reviewedAt"],
        },
        "localOnly": True,
        "visualOutputQaPending": True,
        "eligibleForImport": False,
        "prohibitedActionsPerformed": {
            "uploaded": False,
            "databaseWritten": False,
            "productOrTemplateAttached": False,
            "published": False,
        },
        "entries": entries,
    }


def evidence(relative: PurePosixPath, value: dict[str, Any]) -> dict[str, Any]:
    payload = pretty_json_bytes(value)
    return {"path": str(relative), "sha256": sha256_bytes(payload), "bytes": len(payload)}


def build_promotion_manifest(
    run_directory: Path,
    report: dict[str, Any],
) -> dict[str, Any]:
    _, upstream = read_upstream_approval(run_directory)
    report_evidence = evidence(REPORT_RELATIVE_PATH, report)
    builder_path = (REPOSITORY_ROOT / Path(*SCRIPT_RELATIVE_PATH.parts)).resolve()
    sanitizer_path = (REPOSITORY_ROOT / Path(*SANITIZER_RELATIVE_PATH.parts)).resolve()
    builder_bytes = read_regular_bytes(builder_path, "Guide-donor builder")
    sanitizer_bytes = read_regular_bytes(sanitizer_path, "Sanitizer implementation")
    return {
        "kind": "wmd_sales_folder_verified_beschnitt_guide_donor_promotion",
        "schemaVersion": 1,
        "state": "pending_sanitization_contract_policy_authorization",
        "reviewState": "pending_sanitization_contract_policy_authorization",
        "localOnly": True,
        "eligibleForSanitization": False,
        "eligibleForTemplateImport": False,
        "promotedEvidence": report_evidence,
        "inputEvidence": {
            "upstreamUserDecision": upstream,
            "builderImplementation": {
                "path": str(SCRIPT_RELATIVE_PATH),
                "sha256": sha256_bytes(builder_bytes),
                "bytes": len(builder_bytes),
                "entrypoint": "build_report",
            },
            "sanitizerImplementation": {
                "path": str(SANITIZER_RELATIVE_PATH),
                "sha256": sha256_bytes(sanitizer_bytes),
                "bytes": len(sanitizer_bytes),
                "entrypoint": "run_sanitize",
            },
        },
        "counts": {
            "verifiedProfiles": EXPECTED_ENTRY_COUNT,
            "wholePdfRebinds": 0,
            "visualOutputQaPending": EXPECTED_ENTRY_COUNT,
        },
        "authorizationBoundary": {
            "purpose": "local_source_backed_beschnitt_guide_donor_evidence_only",
            "originalSourceRemainsAuthoritative": True,
            "wholePdfRebindForbidden": True,
            "pdfAuthoringAuthorized": False,
            "databaseProductPricingStorageUploadPublicationAuthorized": False,
        },
        "prohibitedActionsPerformed": {
            "pdfAuthored": False,
            "sourcePdfModified": False,
            "uploaded": False,
            "databaseWritten": False,
            "productOrTemplateAttached": False,
            "pricingWritten": False,
            "published": False,
        },
    }


def verify_existing(path: Path, expected: bytes, label: str) -> None:
    actual = read_regular_bytes(path, label)
    require(actual == expected, f"{label} differs from exact deterministic output")
    sidecar = Path(f"{path}.sha256")
    sidecar_bytes = read_regular_bytes(sidecar, f"{label} sidecar")
    digest = sha256_bytes(actual)
    require(
        sidecar_bytes == f"{digest}  {path.name}\n".encode("utf-8"),
        f"{label} sidecar differs",
    )


def atomic_write(path: Path, payload: bytes) -> None:
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


def write_artifact(path: Path, value: dict[str, Any]) -> dict[str, Any]:
    payload = pretty_json_bytes(value)
    digest = sha256_bytes(payload)
    sidecar = Path(f"{path}.sha256")
    require(not path.exists() and not sidecar.exists(), f"Refusing to overwrite {path}")
    atomic_write(path, payload)
    try:
        atomic_write(sidecar, f"{digest}  {path.name}\n".encode("utf-8"))
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"path": path.name, "sha256": digest, "bytes": len(payload)}


def run(command: str, run_directory: Path) -> dict[str, Any]:
    run_directory = run_directory.resolve()
    report = build_report(run_directory)
    promotion = build_promotion_manifest(run_directory, report)
    report_path = run_path(run_directory, REPORT_RELATIVE_PATH, "Guide-donor report")
    promotion_path = run_path(
        run_directory, PROMOTION_MANIFEST_RELATIVE_PATH, "Guide-donor promotion manifest"
    )
    if command == "verify":
        verify_existing(report_path, pretty_json_bytes(report), "Guide-donor report")
        verify_existing(
            promotion_path,
            pretty_json_bytes(promotion),
            "Guide-donor promotion manifest",
        )
    elif command == "write":
        require(
            not report_path.exists()
            and not Path(f"{report_path}.sha256").exists()
            and not promotion_path.exists()
            and not Path(f"{promotion_path}.sha256").exists(),
            "Refusing partial or overwrite guide-donor artifact write",
        )
        write_artifact(report_path, report)
        try:
            write_artifact(promotion_path, promotion)
        except Exception:
            report_path.unlink(missing_ok=True)
            Path(f"{report_path}.sha256").unlink(missing_ok=True)
            raise
    else:  # pragma: no cover - argparse constrains this
        raise GuideDonorEvidenceError(f"Unknown command: {command}")
    return {
        "report": evidence(REPORT_RELATIVE_PATH, report),
        "promotionManifest": evidence(PROMOTION_MANIFEST_RELATIVE_PATH, promotion),
        "verifiedProfiles": EXPECTED_ENTRY_COUNT,
        "pdfsCreated": 0,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("write", "verify"))
    parser.add_argument("--run-dir", type=Path, default=DEFAULT_RUN_DIRECTORY)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        result = run(args.command, args.run_dir)
    except GuideDonorEvidenceError as exc:
        print(f"ERROR: {exc}", file=os.sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
