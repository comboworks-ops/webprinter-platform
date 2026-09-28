#!/usr/bin/env python3
"""Build local-only, unapproved WMD sales-folder sanitizer candidates.

The exact pending batch plan is the authority for scope and grouping.  This
script deliberately writes contract *candidates* to a path that cannot be
mistaken for the reviewed-contract path consumed by the sanitizer.  It never
authors PDFs and never records an approval, reviewer, or review timestamp.

The sanitizer's own ``describe_source`` routine is used for immutable PDF
evidence.  That evidence is cached only while reading a single source/geometry
pair; one candidate is still emitted for every distinct safe output signature.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import Any, Callable


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIRECTORY.parent.parent
DEFAULT_RUN_DIRECTORY = (
    REPOSITORY_ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
)
PLAN_RELATIVE_PATH = PurePosixPath("review/template-sanitization-plan.json")
DEFAULT_OUTPUT_RELATIVE_PATH = PurePosixPath(
    "documents/sanitization-contract-candidates"
)
SANITIZER_RELATIVE_PATH = PurePosixPath(
    "scripts/product-templates/sanitize_wmd_sales_folder_template.py"
)

EXPECTED_JOB_COUNT = 1420
EXPECTED_BINDING_COUNT = 3692
EXPECTED_SOURCE_URL_COUNT = 1099
EXPECTED_SOURCE_PAYLOAD_COUNT = 285
EXPECTED_DESCRIBE_COMPUTATION_COUNT = 285
EXPECTED_THREE_PANEL_JOB_COUNT = 240
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
CD_MODEL_PATTERN = re.compile(r"cd-135x135|mappe[_-]cd(?:_|-)", re.IGNORECASE)

WEBPRINTER_BLUE = "#0EA5E9"
WEBPRINTER_BLUE_BORDER = "#0284C7"
NO_PRINT_GRAY = "#D1D5DB"

STRUCTURAL_LAYER_PROPOSALS: dict[str, tuple[str, str]] = {
    "Beschnitt Seite": ("bleed-and-safety", "Udfald og sikkerhedsafstand"),
    "Rillen": ("fold", "Falselinjer"),
    "Schneiden": ("cut", "Beskæring og stans"),
}
ACCESSORY_LAYER_NAMES_DA: dict[str, str] = {
    "Abheftvorrichtung": "Arkiveringsmekanisme",
    "Dreieckstasche": "Trekantlomme",
    "Dreieckstasche_klein": "Lille trekantlomme",
    "Gummiband": "Elastik",
    "Gummiband_gross": "Stor elastik",
    "Gummiband_klein": "Lille elastik",
    "Kombi Visitenkartentasche": "Kombineret visitkortlomme",
    "Magnetpunkte": "Magnetpunkter",
    "Magnetverchluss": "Magnetlukning",
    "Magnetverschluss": "Magnetlukning",
    "Visitenkartentasche": "Visitkortlomme",
}
SUPPLIER_INFORMATION_LAYERS = {"Info", "Info Seite"}
SUPPLIER_BRANDING_LAYERS = {"Logo"}

PROHIBITED_ACTIONS_PERFORMED = {
    "approvalRecorded": False,
    "reviewerInvented": False,
    "reviewTimestampInvented": False,
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


class CandidateBuildError(RuntimeError):
    """A fail-closed candidate-generation error."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise CandidateBuildError(message)


def canonical_json(value: Any) -> str:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def valid_sha256(value: Any, label: str) -> str:
    normalized = str(value or "")
    require(bool(SHA256_PATTERN.fullmatch(normalized)), f"{label} is not a SHA-256")
    return normalized


def safe_relative_path(value: Any, label: str, suffix: str | None = None) -> PurePosixPath:
    raw = str(value or "")
    require(raw and "\\" not in raw, f"{label} must be a non-empty POSIX path")
    candidate = PurePosixPath(raw)
    require(not candidate.is_absolute(), f"{label} must be run-relative")
    require(".." not in candidate.parts, f"{label} escapes the run directory")
    require(str(candidate) == raw, f"{label} is not normalized")
    if suffix is not None:
        require(raw.lower().endswith(suffix), f"{label} must end in {suffix}")
    return candidate


def run_path(run_directory: Path, relative_path: PurePosixPath, label: str) -> Path:
    run_directory = run_directory.resolve()
    result = (run_directory / Path(*relative_path.parts)).resolve(strict=False)
    require(
        result == run_directory or run_directory in result.parents,
        f"{label} resolves outside the run directory",
    )
    return result


def read_regular_bytes(path: Path, label: str) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise CandidateBuildError(
            f"{label} must remain a readable regular non-symlink file: {exc}"
        ) from exc
    try:
        status = os.fstat(descriptor)
        require(stat.S_ISREG(status.st_mode), f"{label} is not a regular file")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def read_json_artifact(
    run_directory: Path, relative_path: PurePosixPath, label: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    absolute_path = run_path(run_directory, relative_path, label)
    payload = read_regular_bytes(absolute_path, label)
    try:
        value = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CandidateBuildError(f"{label} is not valid UTF-8 JSON: {exc}") from exc
    require(isinstance(value, dict), f"{label} must contain a JSON object")
    return value, {
        "path": str(relative_path),
        "sha256": sha256_bytes(payload),
        "bytes": len(payload),
    }


def verify_sidecar(run_directory: Path, evidence: dict[str, Any]) -> None:
    relative = safe_relative_path(evidence["path"], "Sidecar target")
    sidecar_relative = PurePosixPath(f"{relative}.sha256")
    sidecar = read_regular_bytes(
        run_path(run_directory, sidecar_relative, "SHA-256 sidecar"),
        "SHA-256 sidecar",
    ).decode("utf-8")
    expected = f"{evidence['sha256']}  {relative.name}\n"
    require(sidecar == expected, f"Stale SHA-256 sidecar: {sidecar_relative}")


def load_sanitizer_module(path: Path) -> ModuleType:
    require(path == path.resolve(), "Sanitizer path must be absolute and normalized")
    read_regular_bytes(path, "Sanitizer implementation")
    spec = importlib.util.spec_from_file_location(
        "wmd_sales_folder_sanitizer_candidate_source", path
    )
    require(spec is not None and spec.loader is not None, "Cannot load sanitizer module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_plan(plan: dict[str, Any]) -> None:
    require(plan.get("schemaVersion") == 1, "Sanitization plan schema drifted")
    require(
        plan.get("kind") == "wmd_sales_folder_sanitization_batch_plan",
        "Unexpected sanitization-plan kind",
    )
    require(plan.get("state") == "pending_review", "Plan is not pending review")
    require(
        plan.get("reviewState") == "pending_review",
        "Plan review state is not pending",
    )
    require(plan.get("localOnly") is True, "Plan is not local-only")
    require(
        plan.get("eligibleForSanitization") is False,
        "Pending plan must not authorize sanitization",
    )
    require(
        plan.get("eligibleForTemplateImport") is False,
        "Pending plan must not authorize template import",
    )
    require(
        plan.get("approval")
        == {
            "approved": False,
            "reviewer": None,
            "reviewedAt": None,
            "approvedJobSignatureHashes": [],
        },
        "Pending plan already carries an approval identity or hashes",
    )
    counts = plan.get("counts") or {}
    expected_counts = {
        "bindings": EXPECTED_BINDING_COUNT,
        "resolvedSourceUrls": EXPECTED_SOURCE_URL_COUNT,
        "distinctSourcePayloads": EXPECTED_SOURCE_PAYLOAD_COUNT,
        "outputJobs": EXPECTED_JOB_COUNT,
        "expectedReviewedContracts": EXPECTED_JOB_COUNT,
        "expectedSanitizedPdfs": EXPECTED_JOB_COUNT,
        "expectedInspections": EXPECTED_JOB_COUNT,
    }
    for key, expected in expected_counts.items():
        require(counts.get(key) == expected, f"Plan {key} count drifted")
    scope = plan.get("scope") or {}
    require(
        scope.get("excludedFolderModel") == "cd-135x135--2-part-closure",
        "The exact CD-sized model exclusion is missing",
    )
    require(
        scope.get("selectedBindingsContainCdModel") is False,
        "The proposed scope reports CD-model leakage",
    )
    require(
        scope.get("excludedPdfAddOns") == ["CD-Tasche"],
        "The exact CD-Tasche layer exclusion is missing",
    )
    requirements = plan.get("contractRequirements") or {}
    layer_policy = requirements.get("layerPolicy") or {}
    require(
        layer_policy.get("cdTascheWhenPresent")
        == {"action": "remove", "role": "unused-accessory", "outputNameDa": None},
        "Plan does not require exact CD-Tasche unused-accessory removal",
    )
    visual = requirements.get("visualPolicy") or {}
    require(
        visual.get("addedInformationPanelFill") == WEBPRINTER_BLUE
        and visual.get("addedInformationPanelBorder") == WEBPRINTER_BLUE_BORDER
        and visual.get("noPrintOrHiddenAreaFill") == NO_PRINT_GRAY,
        "Plan Webprinter visual policy drifted",
    )
    require(
        all(value is False for value in (plan.get("prohibitedActionsPerformed") or {}).values()),
        "Plan reports that a prohibited action was performed",
    )


def validate_job(job: dict[str, Any]) -> None:
    job_id = str(job.get("jobId") or "")
    require(job_id and not CD_MODEL_PATTERN.search(job_id), f"Invalid job ID: {job_id}")
    signature = job.get("safeOutputSignature")
    require(isinstance(signature, dict), f"{job_id} has no safe output signature")
    require(
        set(signature) == {
            "expectedGeometryKey",
            "finishKey",
            "resolvedSourceSha256",
        },
        f"{job_id} safe output signature schema drifted",
    )
    require(
        sha256_json(signature) == job.get("safeOutputSignatureSha256"),
        f"{job_id} safe output signature hash drifted",
    )
    require(
        not CD_MODEL_PATTERN.search(canonical_json(signature)),
        f"{job_id} contains excluded CD-model signature leakage",
    )
    geometry = job.get("geometry") or {}
    require(
        set(geometry) == {
            "format",
            "construction",
            "print",
            "spineMm",
            "expectedGeometryKey",
        },
        f"{job_id} geometry schema drifted",
    )
    require(
        geometry["expectedGeometryKey"] == signature["expectedGeometryKey"],
        f"{job_id} geometry key differs from its signature",
    )
    finish = job.get("finish") or {}
    require(finish.get("key") == signature["finishKey"], f"{job_id} finish drifted")
    source = (job.get("source") or {}).get("executionIdentity") or {}
    valid_sha256(source.get("sha256"), f"{job_id} source SHA-256")
    require(
        source["sha256"] == signature["resolvedSourceSha256"],
        f"{job_id} source SHA differs from its signature",
    )
    safe_relative_path(source.get("localRelativePath"), f"{job_id} source path", ".pdf")
    require(
        not CD_MODEL_PATTERN.search(str(source.get("localRelativePath") or "")),
        f"{job_id} points to an excluded CD-model PDF",
    )
    gate = job.get("gate") or {}
    require(
        gate.get("sanitizationAllowed") is False
        and gate.get("contractExists") is False
        and gate.get("contractApproved") is False,
        f"{job_id} no longer has a closed sanitizer gate",
    )
    execution = job.get("executionEvidence") or {}
    audit = execution.get("geometryAudit") or {}
    valid_sha256(audit.get("reportSha256"), f"{job_id} audit report SHA-256")
    valid_sha256(audit.get("bindingSha256"), f"{job_id} audit binding SHA-256")
    mapping = job.get("mappingEvidence") or {}
    valid_sha256(
        mapping.get("templateResolutionPlanSha256"),
        f"{job_id} resolution plan SHA-256",
    )
    for binding in job.get("coveredBindings") or []:
        require(
            not CD_MODEL_PATTERN.search(canonical_json(binding.get("selections") or {})),
            f"{job_id} contains an excluded CD-model binding",
        )


def build_layer_proposals(layer_names: list[str]) -> list[dict[str, Any]]:
    proposals: list[dict[str, Any]] = []
    for name in layer_names:
        if name == "CD-Tasche":
            proposal = {
                "sourceName": name,
                "status": "proposal_requires_human_review",
                "proposedAction": "remove",
                "proposedRole": "unused-accessory",
                "proposedOutputNameDa": None,
                "basis": "Exact produktejerbeslutning; kun laget CD-Tasche må bruge rollen unused-accessory.",
            }
        elif name in STRUCTURAL_LAYER_PROPOSALS:
            role, output_name = STRUCTURAL_LAYER_PROPOSALS[name]
            proposal = {
                "sourceName": name,
                "status": "proposal_requires_human_review",
                "proposedAction": "preserve",
                "proposedRole": role,
                "proposedOutputNameDa": output_name,
                "basis": "Eksakt kendt konstruktionslag med standardiseret dansk Webprinter-navn.",
            }
        elif name in SUPPLIER_INFORMATION_LAYERS:
            proposal = {
                "sourceName": name,
                "status": "proposal_requires_human_review",
                "proposedAction": "remove",
                "proposedRole": "supplier-information",
                "proposedOutputNameDa": None,
                "basis": "Eksakt kendt leverandørinformationslag; dansk Webprinter-information tilføjes separat.",
            }
        elif name in SUPPLIER_BRANDING_LAYERS:
            proposal = {
                "sourceName": name,
                "status": "proposal_requires_human_review",
                "proposedAction": "remove",
                "proposedRole": "supplier-branding",
                "proposedOutputNameDa": None,
                "basis": "Eksakt kendt leverandørlogolag.",
            }
        elif name in ACCESSORY_LAYER_NAMES_DA:
            proposal = {
                "sourceName": name,
                "status": "proposal_requires_human_review",
                "proposedAction": "preserve",
                "proposedRole": "accessory",
                "proposedOutputNameDa": ACCESSORY_LAYER_NAMES_DA[name],
                "basis": "Eksakt kendt tilbehørslag med standardiseret dansk Webprinter-navn.",
            }
        else:
            proposal = {
                "sourceName": name,
                "status": "human_classification_required",
                "proposedAction": None,
                "proposedRole": None,
                "proposedOutputNameDa": None,
                "basis": "Ingen sikker automatisk klassifikation; menneskelig PDF-gennemgang er påkrævet.",
            }
        proposals.append(proposal)
    require(
        [item["sourceName"] for item in proposals] == sorted(set(layer_names)),
        "Layer proposals are not an exact sorted one-to-one projection",
    )
    for structural_name in STRUCTURAL_LAYER_PROPOSALS:
        if structural_name in layer_names:
            proposal = next(item for item in proposals if item["sourceName"] == structural_name)
            require(
                proposal["proposedAction"] == "preserve",
                f"Structural layer {structural_name} is not proposed for preservation",
            )
    if "CD-Tasche" in layer_names:
        cd = next(item for item in proposals if item["sourceName"] == "CD-Tasche")
        require(
            cd["proposedAction"] == "remove"
            and cd["proposedRole"] == "unused-accessory"
            and cd["proposedOutputNameDa"] is None,
            "CD-Tasche proposal is not the exact allowed removal",
        )
    return proposals


def candidate_policy_proposals() -> dict[str, Any]:
    return {
        "status": "all_values_are_unapproved_proposals_requiring_human_review",
        "metadataAndSupplierIdentity": {
            "removeDocumentMetadata": True,
            "removeXmpThumbnailsAttachmentsActionsLinksAndComments": True,
            "removeSupplierInformationAndBrandingLayers": True,
            "forbidSupplierIdentityInVisibleTextAndMetadata": True,
            "translateAddedCustomerFacingInformationToDanish": True,
        },
        "visualPolicy": {
            "addedInformationPanelFill": WEBPRINTER_BLUE,
            "addedInformationPanelBorder": WEBPRINTER_BLUE_BORDER,
            "replaceSupplierGreenInAddedInformationPanels": True,
            "doNotRecolorStructuralGeometryWithoutExactReview": True,
            "noPrintOrHiddenAreaFill": NO_PRINT_GRAY,
            "grayMeansNotVisibleOrNotPrintedOnlyAfterExactObjectReview": True,
        },
        "textBoxPolicy": {
            "allAddedOrTranslatedTextMustRemainInsideItsAssignedBox": True,
            "minimumPaddingMustBeHumanReviewed": True,
            "horizontalAndVerticalContainmentMustBeVerified": True,
            "overflowBlocksSanitization": True,
        },
        "helperLayerPolicy": {
            "viewOn": True,
            "printOff": True,
            "exportOff": True,
            "designerOverlayMustRemainLockedAndExcludedFromCustomerExport": True,
        },
    }


def build_request_set(
    run_directory: Path,
    plan: dict[str, Any],
    plan_evidence: dict[str, Any],
    sanitizer_evidence: dict[str, Any],
) -> dict[str, Any]:
    validate_plan(plan)
    jobs = plan.get("jobs")
    require(isinstance(jobs, list) and len(jobs) == EXPECTED_JOB_COUNT, "Plan must contain exactly 1,420 jobs")
    requests: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_signatures: set[str] = set()
    for job in jobs:
        require(isinstance(job, dict), "Plan job must be an object")
        validate_job(job)
        job_id = job["jobId"]
        execution_evidence = job["executionEvidence"]
        require(
            execution_evidence["geometryAudit"]["reportSha256"]
            == plan["inputEvidence"]["geometryAudit"]["sha256"],
            f"{job_id} geometry-audit report pin differs from the batch authority",
        )
        supplement_binding = execution_evidence.get("geometrySupplement")
        if supplement_binding is not None:
            require(
                supplement_binding.get("reportSha256")
                == plan["inputEvidence"]["geometrySupplement"]["sha256"],
                f"{job_id} geometry-supplement report pin differs from the batch authority",
            )
            valid_sha256(
                supplement_binding.get("entrySha256"),
                f"{job_id} geometry-supplement entry SHA-256",
            )
        resolution_binding = execution_evidence["templateResolutionPlan"]
        require(
            resolution_binding["reportSha256"]
            == plan["inputEvidence"]["templateResolutionPlan"]["sha256"],
            f"{job_id} template-resolution report pin differs from the batch authority",
        )
        valid_sha256(
            resolution_binding.get("entrySha256"),
            f"{job_id} template-resolution entry SHA-256",
        )
        require(
            job["mappingEvidence"]["templateResolutionPlanSha256"]
            == plan["inputEvidence"]["templateResolutionPlan"]["sha256"],
            f"{job_id} mapping report pin differs from the batch authority",
        )
        signature_hash = job["safeOutputSignatureSha256"]
        require(job_id not in seen_ids, f"Duplicate job ID: {job_id}")
        require(signature_hash not in seen_signatures, f"Duplicate safe output signature: {signature_hash}")
        seen_ids.add(job_id)
        seen_signatures.add(signature_hash)
        candidate_path = PurePosixPath(
            DEFAULT_OUTPUT_RELATIVE_PATH, f"{job_id}.json"
        )
        source_identity = job["source"]["executionIdentity"]
        request = {
            "jobId": job_id,
            "candidatePath": str(candidate_path),
            "safeOutputSignature": copy.deepcopy(job["safeOutputSignature"]),
            "safeOutputSignatureSha256": signature_hash,
            "geometry": {
                key: job["geometry"][key]
                for key in ("format", "construction", "print", "spineMm")
            },
            "finishKey": job["finish"]["key"],
            "source": {
                "localRelativePath": source_identity["localRelativePath"],
                "sha256": source_identity["sha256"],
                "byteSize": source_identity["byteSize"],
                "inventoryRowSha256": source_identity["inventoryRowSha256"],
            },
            "evidence": {
                "sanitizationPlan": copy.deepcopy(plan_evidence),
                "geometryAudit": copy.deepcopy(plan["inputEvidence"]["geometryAudit"]),
                "geometrySupplement": copy.deepcopy(plan["inputEvidence"]["geometrySupplement"]),
                "templateResolutionPlan": copy.deepcopy(plan["inputEvidence"]["templateResolutionPlan"]),
                "templateProjectionStubs": copy.deepcopy(plan["inputEvidence"]["templateProjectionStubs"]),
                "documentInventory": copy.deepcopy(plan["inputEvidence"]["documentInventory"]),
                "sanitizerDescribeImplementation": copy.deepcopy(sanitizer_evidence),
                "jobGeometryAuditBinding": copy.deepcopy(job["executionEvidence"]["geometryAudit"]),
                "jobGeometrySupplementBinding": copy.deepcopy(job["executionEvidence"]["geometrySupplement"]),
                "jobTemplateResolutionBinding": copy.deepcopy(job["executionEvidence"]["templateResolutionPlan"]),
                "jobMappingEvidence": copy.deepcopy(job["mappingEvidence"]),
            },
        }
        require(not CD_MODEL_PATTERN.search(canonical_json(request)), f"CD-model leakage in request {job_id}")
        requests.append(request)
    require(len(seen_signatures) == EXPECTED_JOB_COUNT, "Candidate requests were deduplicated by something other than safe signature")
    describe_groups = {
        (
            request["safeOutputSignature"]["expectedGeometryKey"],
            request["safeOutputSignature"]["resolvedSourceSha256"],
        )
        for request in requests
    }
    require(
        len(describe_groups) == EXPECTED_DESCRIBE_COMPUTATION_COUNT,
        "Source-payload/geometry describe cache scope drifted from 285",
    )
    three_panel_jobs = sum(
        request["geometry"]["construction"] == "3-part-1-flap"
        for request in requests
    )
    require(
        three_panel_jobs == EXPECTED_THREE_PANEL_JOB_COUNT,
        "Three-panel candidate scope drifted from 240 jobs",
    )
    return {
        "schemaVersion": 1,
        "kind": "wmd_sales_folder_sanitization_contract_candidate_request_set",
        "state": "candidate_requires_human_review",
        "reviewState": "candidate_requires_human_review",
        "localOnly": True,
        "eligibleForSanitization": False,
        "eligibleForTemplateImport": False,
        "candidateDirectory": str(DEFAULT_OUTPUT_RELATIVE_PATH),
        "deduplicationPolicy": {
            "onlyKey": "safeOutputSignatureSha256",
            "signatureFields": [
                "expectedGeometryKey",
                "finishKey",
                "resolvedSourceSha256",
            ],
            "sourceOrPayloadDeduplicationForbidden": True,
        },
        "counts": {
            "requests": len(requests),
            "distinctSafeOutputSignatures": len(seen_signatures),
            "sourceGeometryDescribeComputations": len(describe_groups),
            "coveredBindings": sum(job["coveredBindingCount"] for job in jobs),
            "threePanelRequests": three_panel_jobs,
        },
        "planEvidence": copy.deepcopy(plan_evidence),
        "inputEvidence": copy.deepcopy(plan["inputEvidence"]),
        "sanitizerDescribeImplementation": copy.deepcopy(sanitizer_evidence),
        "policyProposals": candidate_policy_proposals(),
        "prohibitedActionsPerformed": copy.deepcopy(PROHIBITED_ACTIONS_PERFORMED),
        "requests": requests,
    }


def validate_evidence_files(
    run_directory: Path, plan: dict[str, Any], plan_evidence: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    expected_keys = {
        "templateProjectionStubs",
        "geometryAudit",
        "geometrySupplement",
        "templateResolutionPlan",
        "documentInventory",
    }
    evidence = plan.get("inputEvidence")
    require(isinstance(evidence, dict) and set(evidence) == expected_keys, "Plan input-evidence schema drifted")
    verified: dict[str, dict[str, Any]] = {}
    for key in sorted(expected_keys):
        record = evidence[key]
        require(isinstance(record, dict), f"{key} evidence is missing")
        relative = safe_relative_path(record.get("path"), f"{key} path")
        payload = read_regular_bytes(run_path(run_directory, relative, key), key)
        observed = sha256_bytes(payload)
        require(observed == valid_sha256(record.get("sha256"), f"{key} SHA-256"), f"{key} hash drifted")
        require(len(payload) == record.get("bytes"), f"{key} byte count drifted")
        verified[key] = copy.deepcopy(record)
    verify_sidecar(run_directory, verified["geometrySupplement"])
    verify_sidecar(run_directory, verified["templateResolutionPlan"])
    require(
        verified["geometryAudit"]["sha256"]
        == plan["jobs"][0]["executionEvidence"]["geometryAudit"]["reportSha256"],
        "Geometry-audit job pin differs from plan input evidence",
    )
    require(
        verified["templateResolutionPlan"]["sha256"]
        == plan["jobs"][0]["mappingEvidence"]["templateResolutionPlanSha256"],
        "Template-resolution job pin differs from plan input evidence",
    )
    verify_sidecar(run_directory, plan_evidence)
    return verified


def verify_sources(
    run_directory: Path, requests: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    requirements: dict[str, dict[str, Any]] = {}
    for request in requests:
        source = request["source"]
        relative = safe_relative_path(
            source["localRelativePath"], f"{request['jobId']} source", ".pdf"
        )
        key = str(relative)
        if key in requirements:
            require(
                requirements[key]["sha256"] == source["sha256"],
                f"One source path has conflicting hashes: {key}",
            )
        else:
            requirements[key] = source
    verified: dict[str, dict[str, Any]] = {}
    for key in sorted(requirements):
        source = requirements[key]
        payload = read_regular_bytes(
            run_path(run_directory, PurePosixPath(key), f"Source PDF {key}"),
            f"Source PDF {key}",
        )
        require(sha256_bytes(payload) == source["sha256"], f"Source PDF hash drifted: {key}")
        require(len(payload) == source["byteSize"], f"Source PDF byte count drifted: {key}")
        verified[key] = {"sha256": source["sha256"], "byteSize": len(payload)}
    return verified


def assert_execution_outputs_absent(run_directory: Path, plan: dict[str, Any]) -> None:
    for job in plan["jobs"]:
        for kind, raw_path in (job.get("outputs") or {}).items():
            relative = safe_relative_path(raw_path, f"{job['jobId']} {kind}")
            require(
                not run_path(run_directory, relative, f"{job['jobId']} {kind}").exists(),
                f"Refusing candidate generation because a planned {kind} already exists: {relative}",
            )


def build_candidate(
    request: dict[str, Any],
    run_directory: Path,
    sanitizer: ModuleType,
    describe_cache: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any]:
    source_relative = safe_relative_path(
        request["source"]["localRelativePath"], f"{request['jobId']} source", ".pdf"
    )
    source_path = run_path(run_directory, source_relative, "Candidate source")
    geometry = request["geometry"]
    cache_key = (
        request["source"]["sha256"],
        request["safeOutputSignature"]["expectedGeometryKey"],
    )
    if cache_key not in describe_cache:
        describe_cache[cache_key] = sanitizer.describe_source(
            source_path, geometry, request["finishKey"]
        )
    described = copy.deepcopy(describe_cache[cache_key])
    # describe_source is finish-aware only in these exact binding fields.  Keep
    # the expensive immutable PDF inventory cached, but bind every candidate to
    # its own safe-signature finish.
    described["finishKey"] = request["finishKey"]
    described["sourceEvidence"]["geometryBinding"] = {
        "sourceSha256": request["source"]["sha256"],
        "geometry": copy.deepcopy(geometry),
        "finishKey": request["finishKey"],
    }
    described["sourceEvidence"]["geometryBindingSha256"] = sha256_json(
        described["sourceEvidence"]["geometryBinding"]
    )
    require(
        described.get("reviewState") == "candidate_requires_human_review",
        "Sanitizer describe unexpectedly returned an approved state",
    )
    require(described["sourceEvidence"]["sha256"] == request["source"]["sha256"], "Describe source SHA drifted")
    require(described["geometry"] == geometry, "Describe geometry drifted")
    require(described["finishKey"] == request["finishKey"], "Describe finish drifted")
    require(
        described.get("review")
        == {
            "reviewer": "",
            "reviewedAt": "",
            "note": "Review every layer, color, text fingerprint, no-print object, and panel rectangle.",
        },
        "Describe candidate unexpectedly contains reviewer identity or time",
    )
    require("approval" not in described, "Describe candidate unexpectedly contains approval")
    described.update(
        {
            "kind": "wmd_sales_folder_sanitization_contract_candidate",
            "state": "candidate_requires_human_review",
            "localOnly": True,
            "eligibleForSanitization": False,
            "eligibleForTemplateImport": False,
            "candidateIdentity": {
                "jobId": request["jobId"],
                "safeOutputSignature": copy.deepcopy(request["safeOutputSignature"]),
                "safeOutputSignatureSha256": request["safeOutputSignatureSha256"],
                "candidatePath": request["candidatePath"],
            },
            "batchEvidence": copy.deepcopy(request["evidence"]),
            "unapprovedLayerProposals": build_layer_proposals(
                described["sourceEvidence"]["layerNames"]
            ),
            "unapprovedPolicyProposals": candidate_policy_proposals(),
            "candidateGate": {
                "state": "candidate_requires_human_review",
                "sanitizationAllowed": False,
                "approvalRecorded": False,
                "reviewerRecorded": False,
                "reviewTimestampRecorded": False,
                "directDescribeContractFieldsRemainReviewRequired": True,
                "everyProposalMustBeConfirmedOrChangedByAHuman": True,
            },
            "prohibitedActionsPerformed": copy.deepcopy(
                PROHIBITED_ACTIONS_PERFORMED
            ),
        }
    )
    validate_candidate(described, request)
    return described


def validate_candidate(candidate: dict[str, Any], request: dict[str, Any]) -> None:
    require(candidate.get("state") == "candidate_requires_human_review", "Candidate state drifted")
    require(candidate.get("reviewState") == "candidate_requires_human_review", "Candidate review state drifted")
    require(candidate.get("eligibleForSanitization") is False, "Candidate authorizes sanitization")
    require(candidate.get("eligibleForTemplateImport") is False, "Candidate authorizes import")
    require("approval" not in candidate, "Candidate contains an approval record")
    review = candidate.get("review") or {}
    require(not review.get("reviewer") and not review.get("reviewedAt"), "Candidate contains reviewer identity or time")
    identity = candidate.get("candidateIdentity") or {}
    require(identity.get("jobId") == request["jobId"], "Candidate job identity drifted")
    require(
        identity.get("safeOutputSignatureSha256")
        == request["safeOutputSignatureSha256"],
        "Candidate safe-signature pin drifted",
    )
    require(
        sha256_json(identity.get("safeOutputSignature"))
        == request["safeOutputSignatureSha256"],
        "Candidate safe-signature bytes drifted",
    )
    source = candidate.get("sourceEvidence") or {}
    require(source.get("sha256") == request["source"]["sha256"], "Candidate source SHA drifted")
    require(
        source.get("geometryBindingSha256")
        == sha256_json(source.get("geometryBinding")),
        "Candidate geometry-binding hash drifted",
    )
    direct_layers = candidate.get("layers") or []
    require(
        all(
            layer.get("action") == "REVIEW_REQUIRED"
            and layer.get("role") == "REVIEW_REQUIRED"
            and layer.get("outputNameDa") == "REVIEW_REQUIRED"
            for layer in direct_layers
        ),
        "Candidate silently promoted a layer proposal into reviewed contract fields",
    )
    proposal_names = [
        item.get("sourceName") for item in candidate.get("unapprovedLayerProposals") or []
    ]
    require(proposal_names == source.get("layerNames"), "Candidate proposals do not cover every source layer exactly once")
    if "CD-Tasche" in proposal_names:
        cd = next(
            item
            for item in candidate["unapprovedLayerProposals"]
            if item["sourceName"] == "CD-Tasche"
        )
        require(
            cd["status"] == "proposal_requires_human_review"
            and cd["proposedAction"] == "remove"
            and cd["proposedRole"] == "unused-accessory"
            and cd["proposedOutputNameDa"] is None,
            "Candidate CD-Tasche proposal drifted",
        )
    for name in STRUCTURAL_LAYER_PROPOSALS:
        if name in proposal_names:
            proposal = next(
                item
                for item in candidate["unapprovedLayerProposals"]
                if item["sourceName"] == name
            )
            require(proposal["proposedAction"] == "preserve", f"Candidate removes structural layer {name}")
    require(
        all(value is False for value in candidate["prohibitedActionsPerformed"].values()),
        "Candidate reports a prohibited action",
    )


def atomic_write_json(path: Path, value: Any) -> str:
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with tempfile.NamedTemporaryFile(
        "wb", dir=path.parent, delete=False, prefix=f".{path.name}.", suffix=".tmp"
    ) as handle:
        temporary = Path(handle.name)
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)
    return sha256_bytes(payload)


def generate_candidates(
    run_directory: Path = DEFAULT_RUN_DIRECTORY,
    output_relative_path: PurePosixPath = DEFAULT_OUTPUT_RELATIVE_PATH,
    write_output: bool = True,
    progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    run_directory = run_directory.resolve()
    require(run_directory.is_dir(), f"Run directory does not exist: {run_directory}")
    require(
        output_relative_path == DEFAULT_OUTPUT_RELATIVE_PATH,
        "Production candidates must use documents/sanitization-contract-candidates/",
    )
    plan, plan_evidence = read_json_artifact(
        run_directory, PLAN_RELATIVE_PATH, "Template-sanitization plan"
    )
    verify_sidecar(run_directory, plan_evidence)
    validate_plan(plan)
    validate_evidence_files(run_directory, plan, plan_evidence)
    sanitizer_path = (REPOSITORY_ROOT / Path(*SANITIZER_RELATIVE_PATH.parts)).resolve()
    sanitizer_payload = read_regular_bytes(sanitizer_path, "Sanitizer implementation")
    sanitizer_evidence = {
        "path": str(SANITIZER_RELATIVE_PATH),
        "sha256": sha256_bytes(sanitizer_payload),
        "bytes": len(sanitizer_payload),
        "entrypoint": "describe_source",
    }
    request_set = build_request_set(
        run_directory, plan, plan_evidence, sanitizer_evidence
    )
    verified_sources = verify_sources(run_directory, request_set["requests"])
    assert_execution_outputs_absent(run_directory, plan)
    output_directory = run_path(
        run_directory, output_relative_path, "Candidate output directory"
    )
    require(
        not output_directory.exists(),
        f"Refusing to overwrite existing candidate output: {output_relative_path}",
    )
    if not write_output:
        return {
            "requestSet": request_set,
            "outputDirectory": output_directory,
            "written": False,
            "verifiedSourceFiles": len(verified_sources),
            "sanitizerDescribeComputations": request_set["counts"][
                "sourceGeometryDescribeComputations"
            ],
        }

    sanitizer = load_sanitizer_module(sanitizer_path)
    parent = output_directory.parent
    parent.mkdir(parents=True, exist_ok=True)
    temporary_directory = Path(
        tempfile.mkdtemp(prefix=f".{output_directory.name}.", suffix=".tmp", dir=parent)
    )
    describe_cache: dict[tuple[str, str], dict[str, Any]] = {}
    candidate_records: list[dict[str, Any]] = []
    completed = False
    try:
        for index, request in enumerate(request_set["requests"], 1):
            candidate = build_candidate(
                request, run_directory, sanitizer, describe_cache
            )
            candidate_path = temporary_directory / f"{request['jobId']}.json"
            candidate_sha256 = atomic_write_json(candidate_path, candidate)
            candidate_records.append(
                {
                    "jobId": request["jobId"],
                    "path": request["candidatePath"],
                    "sha256": candidate_sha256,
                    "bytes": candidate_path.stat().st_size,
                    "safeOutputSignatureSha256": request[
                        "safeOutputSignatureSha256"
                    ],
                    "sourceSha256": request["source"]["sha256"],
                    "state": "candidate_requires_human_review",
                }
            )
            if progress is not None:
                progress(index, len(request_set["requests"]))
        require(
            len(candidate_records) == EXPECTED_JOB_COUNT,
            "Candidate materialization count drifted",
        )
        require(
            len(describe_cache) == EXPECTED_DESCRIBE_COMPUTATION_COUNT,
            "Describe computation cache count drifted",
        )
        # Re-verify every authority after describe and before the atomic publish.
        current_plan = read_regular_bytes(
            run_path(run_directory, PLAN_RELATIVE_PATH, "Template-sanitization plan"),
            "Template-sanitization plan",
        )
        require(
            sha256_bytes(current_plan) == plan_evidence["sha256"],
            "Template-sanitization plan changed during candidate generation",
        )
        validate_evidence_files(run_directory, plan, plan_evidence)
        verify_sources(run_directory, request_set["requests"])
        current_sanitizer = read_regular_bytes(sanitizer_path, "Sanitizer implementation")
        require(
            sha256_bytes(current_sanitizer) == sanitizer_evidence["sha256"],
            "Sanitizer describe implementation changed during candidate generation",
        )
        manifest = {
            key: copy.deepcopy(value)
            for key, value in request_set.items()
            if key != "requests"
        }
        manifest.update(
            {
                "kind": "wmd_sales_folder_sanitization_contract_candidate_manifest",
                "counts": {
                    **request_set["counts"],
                    "candidateFiles": len(candidate_records),
                    "sanitizedPdfsCreated": 0,
                    "approvedContractsCreated": 0,
                },
                "candidateFiles": candidate_records,
                "nextGate": "A human must review every exact candidate and separately promote it into documents/sanitization-contracts; this manifest cannot authorize PDF sanitization.",
            }
        )
        manifest_sha256 = atomic_write_json(
            temporary_directory / "manifest.json", manifest
        )
        checksum_lines = [
            f"{record['sha256']}  {Path(record['path']).name}"
            for record in candidate_records
        ]
        checksum_lines.append(f"{manifest_sha256}  manifest.json")
        checksums = ("\n".join(checksum_lines) + "\n").encode("utf-8")
        (temporary_directory / "checksums.sha256").write_bytes(checksums)
        (temporary_directory / "manifest.json.sha256").write_text(
            f"{manifest_sha256}  manifest.json\n", encoding="utf-8"
        )
        require(not output_directory.exists(), "Candidate output appeared during generation")
        os.replace(temporary_directory, output_directory)
        completed = True
        return {
            "requestSet": request_set,
            "manifest": manifest,
            "manifestSha256": manifest_sha256,
            "outputDirectory": output_directory,
            "written": True,
            "verifiedSourceFiles": len(verified_sources),
            "sanitizerDescribeComputations": len(describe_cache),
        }
    finally:
        if not completed and temporary_directory.exists():
            shutil.rmtree(temporary_directory)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", default=str(DEFAULT_RUN_DIRECTORY))
    parser.add_argument("--no-write", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)

    def progress(done: int, total: int) -> None:
        if done == 1 or done % 100 == 0 or done == total:
            print(f"candidate progress: {done}/{total}", file=sys.stderr)

    try:
        result = generate_candidates(
            run_directory=Path(args.run),
            write_output=not args.no_write,
            progress=progress if not args.no_write else None,
        )
        print(
            json.dumps(
                {
                    "state": "candidate_requires_human_review",
                    "candidateCount": result["requestSet"]["counts"]["requests"],
                    "threePanelCandidateCount": result["requestSet"]["counts"][
                        "threePanelRequests"
                    ],
                    "verifiedSourceFiles": result["verifiedSourceFiles"],
                    "sanitizerDescribeComputations": result[
                        "sanitizerDescribeComputations"
                    ],
                    "written": result["written"],
                    "outputDirectory": str(result["outputDirectory"]),
                    "eligibleForSanitization": False,
                    "approvedContractsCreated": 0,
                    "pdfsCreated": 0,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (CandidateBuildError, OSError, ValueError, KeyError, TypeError) as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
