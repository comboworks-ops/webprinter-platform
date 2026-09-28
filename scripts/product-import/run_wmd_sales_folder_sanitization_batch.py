#!/usr/bin/env python3
"""Run the exact approved WMD sales-folder PDF sanitization batch locally.

The runner is intentionally local-only.  It cannot upload files or write any
database, Supplier Bank, product, pricing, template, or publication state.  A
pending plan is accepted only as immutable proposal evidence beneath a separate
approved contract manifest that authorizes every one of the 1,420 jobs.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import os
import re
import stat
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Callable


SCHEMA_VERSION = 1
EXPECTED_JOB_COUNT = 1420
EXPECTED_BINDING_COUNT = 3692
PLAN_RELATIVE_PATH = "review/template-sanitization-plan.json"
CONTRACT_MANIFEST_RELATIVE_PATH = "documents/sanitization-contracts/manifest.json"
BATCH_DIRECTORY_RELATIVE_PATH = "documents/sanitization-batch"
BATCH_MANIFEST_RELATIVE_PATH = f"{BATCH_DIRECTORY_RELATIVE_PATH}/manifest.json"
BATCH_MANIFEST_SHA_RELATIVE_PATH = f"{BATCH_DIRECTORY_RELATIVE_PATH}/manifest.json.sha256"
BATCH_CHECKSUMS_RELATIVE_PATH = f"{BATCH_DIRECTORY_RELATIVE_PATH}/checksums.sha256"
BATCH_CHECKPOINT_RELATIVE_PATH = f"{BATCH_DIRECTORY_RELATIVE_PATH}/checkpoint.json"
SANITIZER_RELATIVE_PATH = "scripts/product-templates/sanitize_wmd_sales_folder_template.py"
APPROVED_CONTRACT_MANIFEST_KIND = "wmd_sales_folder_sanitization_contract_manifest"
APPROVED_CONTRACT_STATE = "approved_for_sanitization"
BATCH_MANIFEST_KIND = "wmd_sales_folder_sanitization_batch_manifest"
BATCH_OUTPUT_STATE = "sanitized_render_review_required"
PDF_EDIT_MARKER_TOOL_SUPPORTED_MAXIMUM = 100
PDF_EDIT_MARKER_POLICY_KIND = "pdf_skill_edit_marker_expected_output_count_cap"
ZERO_OUTPUT_AMENDMENT_KIND = "wmd_sales_folder_zero_output_checkpoint_amendment"
ZERO_OUTPUT_AMENDMENT_REASON = (
    "approved_sanitizer_and_contract_manifest_after_first_job_failed_without_output"
)
ZERO_OUTPUT_RECOVERABLE_FAILURE_SUFFIX = (
    "SalesFolderSanitizationError: Preserved geometry colors changed outside "
    "reviewed no-print replacements"
)
ZERO_OUTPUT_RECOVERY_INCIDENT = {
    "checkpointSha256": "e88881f3732843af97930fa24ee8d6aee852433e0bc2be90a3c01ab96099da79",
    "checkpointBytes": 1255,
    "planSha256": "5f07b26ec1351d0918ac0425c58e911f0d8a0c3ab62062e10b68aaf6d4213759",
    "contractManifestSha256": "849e6c4bfe83502cabdad487d4a25fe1cd82e918a7333255df317110bc660988",
    "sanitizerSha256": "21c740809277d30ea981368b2cdaab9c5c80322413ea57613bb9ae84ccebda2c",
    "expectedOutputCount": 1420,
    "firstJobId": (
        "salgsmappe-a4-2-part-2-flaps-window-4plus0-1mm-blind-emboss-"
        "e7758da8dc0d6017"
    ),
    "orderedJobIdentitySha256": (
        "fb23bf8d130788c63d9e13b0ba23d7a408c9e9193c49df2e1ffc1246c768e0f8"
    ),
    "failure": (
        "salgsmappe-a4-2-part-2-flaps-window-4plus0-1mm-blind-emboss-"
        "e7758da8dc0d6017: SalesFolderSanitizationError: Preserved geometry "
        "colors changed outside reviewed no-print replacements"
    ),
}
SHA256_RE = re.compile(r"[a-f0-9]{64}")
JOB_ID_RE = re.compile(r"[a-z0-9][a-z0-9-]{20,220}")
CONTRACT_PROHIBITED_ACTION_KEYS = {
    "sourcePdfModified",
    "sourcePdfSanitized",
    "pdfCreated",
    "pdfUploaded",
    "databaseWritten",
    "supplierBankWritten",
    "productOrTemplateRecordWritten",
    "pricingWritten",
    "published",
}
INSPECTION_PROHIBITED_ACTION_KEYS = {
    "uploaded",
    "databaseWritten",
    "productOrTemplateAttached",
    "published",
}
RUNNER_PROHIBITED_ACTION_KEYS = {
    "uploaded",
    "databaseWritten",
    "supplierBankWritten",
    "productOrTemplateAttached",
    "pricingWritten",
    "published",
}
CHECKPOINT_BASE_KEYS = {
    "kind",
    "schemaVersion",
    "state",
    "localOnly",
    "expectedOutputCount",
    "completedOutputCount",
    "planSha256",
    "contractManifestSha256",
    "sanitizerSha256",
    "artifactOperationAuthorization",
    "completedJobs",
    "failure",
    "prohibitedActionsPerformed",
}
ZERO_OUTPUT_AMENDMENT_KEYS = {
    "kind",
    "schemaVersion",
    "sequence",
    "reason",
    "originalCheckpoint",
    "superseded",
    "adopted",
    "unchangedBatchIdentity",
    "preservedArtifactOperationAuthorizationSha256",
    "zeroOutputEvidence",
    "originalFailure",
}


class BatchSanitizationError(RuntimeError):
    """Raised when any batch authorization, identity, or output gate fails."""


def pdf_edit_marker_policy(expected_output_count: int) -> dict[str, Any]:
    if (
        not isinstance(expected_output_count, int)
        or isinstance(expected_output_count, bool)
        or expected_output_count < 1
    ):
        raise BatchSanitizationError(
            "PDF edit marker policy requires a positive total output count"
        )
    return {
        "kind": PDF_EDIT_MARKER_POLICY_KIND,
        "toolSupportedMaximum": PDF_EDIT_MARKER_TOOL_SUPPORTED_MAXIMUM,
        "requiredConfirmedCount": min(
            expected_output_count,
            PDF_EDIT_MARKER_TOOL_SUPPORTED_MAXIMUM,
        ),
    }


def artifact_operation_authorization(expected_output_count: int) -> dict[str, Any]:
    return {
        "operationKind": "edit",
        "outputFormat": "pdf",
        "authorizedTotalOutputCount": expected_output_count,
        "markerPolicy": pdf_edit_marker_policy(expected_output_count),
        "markerRecordedBeforeFirstAuthoring": True,
    }


def validate_pdf_edit_marker_count(
    expected_output_count: int,
    marker_confirmed_count: int,
) -> None:
    policy = pdf_edit_marker_policy(expected_output_count)
    required = policy["requiredConfirmedCount"]
    if (
        not isinstance(marker_confirmed_count, int)
        or isinstance(marker_confirmed_count, bool)
        or marker_confirmed_count != required
    ):
        raise BatchSanitizationError(
            "PDF edit marker required confirmed count is "
            f"{required} for the authorized total {expected_output_count} "
            f"under the tool-supported maximum {policy['toolSupportedMaximum']}; "
            f"received {marker_confirmed_count}. On resume, reuse this recorded "
            "count without running a second marker for the pending remainder"
        )


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def valid_sha256(value: Any) -> bool:
    return isinstance(value, str) and SHA256_RE.fullmatch(value) is not None


def read_regular_bytes(path: Path, label: str) -> bytes:
    try:
        metadata = path.lstat()
    except FileNotFoundError as exc:
        raise BatchSanitizationError(f"{label} is missing: {path}") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise BatchSanitizationError(f"{label} must be a regular non-symlink file: {path}")
    with path.open("rb") as handle:
        value = handle.read()
    after = path.lstat()
    if (metadata.st_dev, metadata.st_ino, metadata.st_size) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
    ):
        raise BatchSanitizationError(f"{label} changed while it was read: {path}")
    return value


def read_json(path: Path, label: str) -> tuple[Any, bytes]:
    value = read_regular_bytes(path, label)
    try:
        return json.loads(value.decode("utf-8")), value
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BatchSanitizationError(f"{label} is not valid UTF-8 JSON: {path}") from exc


def safe_relative_path(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise BatchSanitizationError(f"{label} is not a safe relative POSIX path")
    pure = PurePosixPath(value)
    if pure.is_absolute() or str(pure) != value or any(part in {"", ".", ".."} for part in pure.parts):
        raise BatchSanitizationError(f"{label} is not a normalized relative POSIX path: {value!r}")
    return value


def path_under(root: Path, relative: Any, label: str, *, must_exist: bool = False) -> Path:
    relative_value = safe_relative_path(relative, label)
    root_resolved = root.resolve(strict=True)
    current = root_resolved
    for component in PurePosixPath(relative_value).parts:
        current = current / component
        if current.exists() or current.is_symlink():
            if current.is_symlink():
                raise BatchSanitizationError(f"{label} traverses a symlink: {relative_value}")
    target = root_resolved.joinpath(*PurePosixPath(relative_value).parts)
    try:
        target.resolve(strict=False).relative_to(root_resolved)
    except ValueError as exc:
        raise BatchSanitizationError(f"{label} escapes the approved root: {relative_value}") from exc
    if must_exist:
        read_regular_bytes(target, label)
    return target


def exact_file_evidence(
    root: Path,
    evidence: Any,
    label: str,
    *,
    identity_cache: dict[Path, tuple[str, int]] | None = None,
) -> tuple[Path, bytes | None]:
    if not isinstance(evidence, dict):
        raise BatchSanitizationError(f"{label} evidence is missing")
    required = {"path", "sha256", "bytes"}
    if not required.issubset(evidence):
        raise BatchSanitizationError(f"{label} evidence must contain path, sha256, and bytes")
    path = path_under(root, evidence["path"], label, must_exist=True)
    if not valid_sha256(evidence["sha256"]) or (
        not isinstance(evidence["bytes"], int) or isinstance(evidence["bytes"], bool)
    ):
        raise BatchSanitizationError(f"{label} path/hash/byte evidence is invalid")
    cached = identity_cache.get(path) if identity_cache is not None else None
    if cached is None:
        value = read_regular_bytes(path, label)
        actual = (sha256_bytes(value), len(value))
        if identity_cache is not None:
            identity_cache[path] = actual
    else:
        value = None
        actual = cached
    if actual != (evidence["sha256"], evidence["bytes"]):
        raise BatchSanitizationError(f"{label} path/hash/byte identity changed")
    return path, value


def parse_checksum_file(value: bytes, label: str) -> dict[str, str]:
    try:
        text = value.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BatchSanitizationError(f"{label} is not UTF-8") from exc
    output: dict[str, str] = {}
    for line_number, line in enumerate(text.splitlines(), 1):
        match = re.fullmatch(r"([a-f0-9]{64})  ([^\r\n]+)", line)
        if not match:
            raise BatchSanitizationError(f"{label} line {line_number} is malformed")
        checksum, relative = match.groups()
        safe_relative_path(relative, f"{label} line {line_number}")
        if relative in output:
            raise BatchSanitizationError(f"{label} repeats {relative}")
        output[relative] = checksum
    if not output:
        raise BatchSanitizationError(f"{label} is empty")
    return output


def recursive_placeholder_hits(value: Any, path: str = "$") -> list[str]:
    output: list[str] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            output.extend(recursive_placeholder_hits(nested, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            output.extend(recursive_placeholder_hits(nested, f"{path}[{index}]"))
    elif isinstance(value, str) and (
        "REVIEW_REQUIRED" in value
        or "candidate_requires_human_review" in value
        or "proposal_requires_human_review" in value
    ):
        output.append(path)
    return output


def false_mutation_record(
    value: Any, label: str, expected_keys: set[str]
) -> dict[str, bool]:
    if not isinstance(value, dict) or set(value) != expected_keys:
        raise BatchSanitizationError(f"{label} schema is invalid")
    if any(item is not False for item in value.values()):
        raise BatchSanitizationError(f"{label} records a prohibited mutation")
    return value


def validate_plan(plan: Any, expected_job_count: int) -> list[dict[str, Any]]:
    if not isinstance(plan, dict) or plan.get("kind") != "wmd_sales_folder_sanitization_batch_plan":
        raise BatchSanitizationError("Sanitization proposal plan kind is invalid")
    if plan.get("schemaVersion") != SCHEMA_VERSION:
        raise BatchSanitizationError("Sanitization proposal plan schemaVersion is invalid")
    if (
        plan.get("state") != "pending_review"
        or plan.get("reviewState") != "pending_review"
        or plan.get("localOnly") is not True
        or plan.get("eligibleForSanitization") is not False
        or plan.get("eligibleForTemplateImport") is not False
    ):
        raise BatchSanitizationError(
            "The immutable proposal plan must remain pending and non-executable; approval belongs only to the separate manifest"
        )
    counts = plan.get("counts")
    jobs = plan.get("jobs")
    if (
        not isinstance(counts, dict)
        or counts.get("outputJobs") != expected_job_count
        or counts.get("expectedReviewedContracts") != expected_job_count
        or counts.get("expectedSanitizedPdfs") != expected_job_count
        or counts.get("expectedInspections") != expected_job_count
        or not isinstance(jobs, list)
        or len(jobs) != expected_job_count
    ):
        raise BatchSanitizationError("Sanitization proposal plan does not contain the exact approved job count")
    if expected_job_count == EXPECTED_JOB_COUNT and counts.get("bindings") != EXPECTED_BINDING_COUNT:
        raise BatchSanitizationError("Sanitization proposal plan does not cover exactly 3,692 scoped bindings")
    seen_ids: set[str] = set()
    seen_signatures: set[str] = set()
    for index, job in enumerate(jobs):
        if not isinstance(job, dict):
            raise BatchSanitizationError(f"Plan job {index + 1} is not an object")
        job_id = job.get("jobId")
        signature = job.get("safeOutputSignature")
        signature_sha = job.get("safeOutputSignatureSha256")
        if not isinstance(job_id, str) or not JOB_ID_RE.fullmatch(job_id) or job_id in seen_ids:
            raise BatchSanitizationError(f"Plan job id is invalid or duplicated: {job_id!r}")
        if not isinstance(signature, dict) or not valid_sha256(signature_sha) or sha256_json(signature) != signature_sha:
            raise BatchSanitizationError(f"Plan safe-output signature is invalid for {job_id}")
        if signature_sha in seen_signatures:
            raise BatchSanitizationError(f"Plan safe-output signature is duplicated: {job_id}")
        seen_ids.add(job_id)
        seen_signatures.add(signature_sha)
    return jobs


def validate_contract_manifest(
    run_root: Path,
    repository_root: Path,
    manifest: Any,
    manifest_bytes: bytes,
    manifest_path: Path,
    plan_path: Path,
    plan_bytes: bytes,
    expected_job_count: int,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    if not isinstance(manifest, dict) or manifest.get("kind") != APPROVED_CONTRACT_MANIFEST_KIND:
        raise BatchSanitizationError("Approved contract manifest kind is invalid")
    if (
        manifest.get("schemaVersion") != SCHEMA_VERSION
        or manifest.get("state") != APPROVED_CONTRACT_STATE
        or manifest.get("reviewState") != APPROVED_CONTRACT_STATE
        or manifest.get("localOnly") is not True
        or manifest.get("eligibleForSanitization") is not True
        or manifest.get("eligibleForTemplateImport") is not False
    ):
        raise BatchSanitizationError("Approved contract manifest is not executable local-only evidence")
    authorization = manifest.get("executionAuthorization")
    if not isinstance(authorization, dict) or (
        authorization.get("approved") is not True
        or authorization.get("expectedOutputCount") != expected_job_count
        or authorization.get("allContractsApproved") is not True
        or authorization.get("localPdfAuthoringOnly") is not True
        or authorization.get("individualJsonEntryReviewClaimed") is not False
        or not str(authorization.get("reviewer") or "").strip()
        or not str(authorization.get("reviewedAt") or "").strip()
    ):
        raise BatchSanitizationError("Batch execution authorization is incomplete or overclaims individual review")
    counts = manifest.get("counts")
    contract_files = manifest.get("contractFiles")
    if (
        not isinstance(counts, dict)
        or counts.get("approvedContracts") != expected_job_count
        or counts.get("expectedOutputCount") != expected_job_count
        or not isinstance(contract_files, list)
        or len(contract_files) != expected_job_count
    ):
        raise BatchSanitizationError("Approved contract manifest count is not exact")
    plan_evidence = manifest.get("planEvidence")
    if not isinstance(plan_evidence, dict) or (
        plan_evidence.get("path") != PLAN_RELATIVE_PATH
        or plan_evidence.get("sha256") != sha256_bytes(plan_bytes)
        or plan_evidence.get("bytes") != len(plan_bytes)
        or path_under(run_root, plan_evidence.get("path"), "approved plan evidence", must_exist=True) != plan_path
    ):
        raise BatchSanitizationError("Approved contract manifest does not pin the immutable proposal plan")
    sanitizer_evidence = manifest.get("sanitizerImplementation")
    if not isinstance(sanitizer_evidence, dict) or (
        sanitizer_evidence.get("path") != SANITIZER_RELATIVE_PATH
        or sanitizer_evidence.get("entrypoint") != "run_sanitize"
    ):
        raise BatchSanitizationError("Approved manifest does not pin the sanitizer run_sanitize implementation")
    sanitizer_path = path_under(
        repository_root,
        sanitizer_evidence.get("path"),
        "sanitizer implementation",
        must_exist=True,
    )
    sanitizer_bytes = read_regular_bytes(sanitizer_path, "sanitizer implementation")
    if (
        sanitizer_evidence.get("sha256") != sha256_bytes(sanitizer_bytes)
        or sanitizer_evidence.get("bytes") != len(sanitizer_bytes)
    ):
        raise BatchSanitizationError("Approved sanitizer implementation identity changed")
    approval_evidence = manifest.get("approvalEvidence")
    if not isinstance(approval_evidence, dict):
        raise BatchSanitizationError("Approved manifest has no approvalEvidence")
    for key in ("templatePromotionManifest", "sanitizationContractApprovalDecision"):
        exact_file_evidence(run_root, approval_evidence.get(key), f"approvalEvidence.{key}")
    false_mutation_record(
        manifest.get("prohibitedActionsPerformed"),
        "contract manifest prohibitedActionsPerformed",
        CONTRACT_PROHIBITED_ACTION_KEYS,
    )

    sidecar_path = manifest_path.with_name("manifest.json.sha256")
    sidecar_bytes = read_regular_bytes(
        sidecar_path, "approved contract manifest SHA sidecar"
    )
    sidecar = sidecar_bytes.decode("utf-8")
    expected_sidecar = f"{sha256_bytes(manifest_bytes)}  manifest.json\n"
    if sidecar != expected_sidecar:
        raise BatchSanitizationError("Approved contract manifest SHA sidecar is invalid")
    checksums_path = manifest_path.with_name("checksums.sha256")
    checksums_bytes = read_regular_bytes(
        checksums_path, "approved contract checksums"
    )
    checksums = parse_checksum_file(
        checksums_bytes,
        "approved contract checksums",
    )
    by_job: dict[str, dict[str, Any]] = {}
    expected_checksums = {"manifest.json": sha256_bytes(manifest_bytes)}
    for entry in contract_files:
        if not isinstance(entry, dict):
            raise BatchSanitizationError("Approved contract manifest row is invalid")
        job_id = entry.get("jobId")
        relative = entry.get("path")
        if (
            not isinstance(job_id, str)
            or job_id in by_job
            or entry.get("state") != APPROVED_CONTRACT_STATE
            or not valid_sha256(entry.get("sha256"))
            or not valid_sha256(entry.get("safeOutputSignatureSha256"))
            or not valid_sha256(entry.get("sourceSha256"))
            or not isinstance(entry.get("bytes"), int)
            or isinstance(entry.get("bytes"), bool)
        ):
            raise BatchSanitizationError(f"Approved contract manifest row is invalid: {job_id!r}")
        expected_relative = f"documents/sanitization-contracts/{job_id}.json"
        if relative != expected_relative:
            raise BatchSanitizationError(f"Approved contract path is not exact for {job_id}")
        contract_path = path_under(run_root, relative, f"approved contract {job_id}", must_exist=True)
        contract_bytes = read_regular_bytes(contract_path, f"approved contract {job_id}")
        if sha256_bytes(contract_bytes) != entry["sha256"] or len(contract_bytes) != entry["bytes"]:
            raise BatchSanitizationError(f"Approved contract identity changed: {job_id}")
        expected_checksums[PurePosixPath(relative).name] = entry["sha256"]
        by_job[job_id] = {**entry, "_path": contract_path, "_bytes": contract_bytes}
    if checksums != expected_checksums:
        raise BatchSanitizationError("Approved contract checksums do not exactly cover manifest and contracts")
    return by_job, {
        "sanitizerPath": sanitizer_path,
        "sanitizerSha256": sanitizer_evidence["sha256"],
        "sanitizerBytes": sanitizer_evidence["bytes"],
        "approvalEvidence": approval_evidence,
        "manifestSha256": sha256_bytes(manifest_bytes),
        "manifestBytes": len(manifest_bytes),
        "manifestSidecarPath": sidecar_path,
        "manifestSidecarSha256": sha256_bytes(sidecar_bytes),
        "manifestSidecarBytes": len(sidecar_bytes),
        "checksumsPath": checksums_path,
        "checksumsSha256": sha256_bytes(checksums_bytes),
        "checksumsBytes": len(checksums_bytes),
    }


def contract_evidence_path(
    run_root: Path,
    contract: dict[str, Any],
    key: str,
    contract_field: str,
    label: str,
    identity_cache: dict[Path, tuple[str, int]],
) -> Path | None:
    contract_value = contract.get(contract_field)
    if contract_value is None:
        return None
    batch_evidence = contract.get("batchEvidence")
    if not isinstance(batch_evidence, dict):
        raise BatchSanitizationError(f"{label} has no batchEvidence")
    evidence = batch_evidence.get(key)
    path, _ = exact_file_evidence(
        run_root,
        evidence,
        f"{label} {key}",
        identity_cache=identity_cache,
    )
    if not isinstance(contract_value, dict) or contract_value.get("reportSha256") != evidence.get("sha256"):
        raise BatchSanitizationError(f"{label} {contract_field} does not match its approved report")
    return path


def validate_job(
    run_root: Path,
    job: dict[str, Any],
    contract_entry: dict[str, Any],
    identity_cache: dict[Path, tuple[str, int]],
) -> dict[str, Any]:
    job_id = job["jobId"]
    if (
        contract_entry.get("safeOutputSignatureSha256") != job["safeOutputSignatureSha256"]
        or contract_entry.get("sourceSha256") != job.get("source", {}).get("executionIdentity", {}).get("sha256")
    ):
        raise BatchSanitizationError(f"Approved contract manifest identity differs from plan job {job_id}")
    args = job.get("sanitizerArgumentsAfterAllApprovals")
    outputs = job.get("outputs")
    if not isinstance(args, dict) or not isinstance(outputs, dict):
        raise BatchSanitizationError(f"Plan job paths are missing for {job_id}")
    expected_outputs = {
        "reviewedContract": f"documents/sanitization-contracts/{job_id}.json",
        "sanitizedPdf": f"documents/sanitized-pdfs/{job_id}.pdf",
        "inspection": f"documents/sanitization-inspections/{job_id}.json",
    }
    if outputs != expected_outputs or (
        args.get("contract") != expected_outputs["reviewedContract"]
        or args.get("output") != expected_outputs["sanitizedPdf"]
        or args.get("inspection") != expected_outputs["inspection"]
        or args.get("geometryAudit") != "review/template-geometry-audit.json"
    ):
        raise BatchSanitizationError(f"Plan job output/argument paths are not exact for {job_id}")
    source_relative = safe_relative_path(args.get("source"), f"source path for {job_id}")
    if not source_relative.startswith("documents/source-pdfs/") or not source_relative.endswith(".pdf"):
        raise BatchSanitizationError(f"Source path is outside the local source-PDF directory for {job_id}")
    source_path = path_under(run_root, source_relative, f"source PDF for {job_id}", must_exist=True)
    cached_source = identity_cache.get(source_path)
    if cached_source is None:
        source_bytes_value = read_regular_bytes(source_path, f"source PDF for {job_id}")
        cached_source = (sha256_bytes(source_bytes_value), len(source_bytes_value))
        identity_cache[source_path] = cached_source
    source_sha256, source_byte_size = cached_source
    source_identity = job.get("source", {}).get("executionIdentity")
    if not isinstance(source_identity, dict) or (
        source_identity.get("sha256") != source_sha256
        or source_identity.get("byteSize") != source_byte_size
    ):
        raise BatchSanitizationError(f"Source PDF identity changed for {job_id}")
    if source_identity.get("localRelativePath") != source_relative:
        raise BatchSanitizationError(f"Source PDF localRelativePath is not exact for {job_id}")
    if contract_entry["path"] != expected_outputs["reviewedContract"]:
        raise BatchSanitizationError(f"Contract path differs from plan for {job_id}")
    try:
        contract = json.loads(contract_entry["_bytes"].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BatchSanitizationError(f"Approved contract is not UTF-8 JSON for {job_id}") from exc
    if recursive_placeholder_hits(contract):
        raise BatchSanitizationError(f"Approved contract still contains review placeholders for {job_id}")
    geometry = job.get("geometry")
    contract_geometry = contract.get("geometry")
    if not isinstance(geometry, dict) or not isinstance(contract_geometry, dict):
        raise BatchSanitizationError(f"Geometry is missing for {job_id}")
    expected_contract_geometry = {
        key: geometry.get(key) for key in ("format", "construction", "print", "spineMm")
    }
    if (
        contract.get("kind") != "wmd_sales_folder_sanitization_contract"
        or contract.get("schemaVersion") != SCHEMA_VERSION
        or contract.get("reviewState") != APPROVED_CONTRACT_STATE
        or contract.get("state") != APPROVED_CONTRACT_STATE
        or contract.get("localOnly") is not True
        or contract.get("eligibleForSanitization") is not True
        or contract.get("eligibleForTemplateImport") is not False
        or contract_geometry != expected_contract_geometry
        or contract.get("finishKey") != job.get("finish", {}).get("key")
        or contract.get("sourceEvidence", {}).get("sha256") != source_identity["sha256"]
    ):
        raise BatchSanitizationError(f"Approved contract core identity is invalid for {job_id}")
    candidate_identity = contract.get("candidateIdentity")
    if not isinstance(candidate_identity, dict) or (
        candidate_identity.get("jobId") != job_id
        or candidate_identity.get("safeOutputSignatureSha256") != job["safeOutputSignatureSha256"]
    ):
        raise BatchSanitizationError(f"Approved contract is not bound to exact job {job_id}")
    false_mutation_record(
        contract.get("prohibitedActionsPerformed"),
        f"contract {job_id} prohibitedActionsPerformed",
        CONTRACT_PROHIBITED_ACTION_KEYS,
    )
    audit_evidence = contract.get("batchEvidence", {}).get("geometryAudit")
    audit_path, _ = exact_file_evidence(
        run_root,
        audit_evidence,
        f"contract {job_id} geometry audit",
        identity_cache=identity_cache,
    )
    if contract.get("geometryAudit", {}).get("reportSha256") != audit_evidence.get("sha256"):
        raise BatchSanitizationError(f"Contract geometry-audit pin is invalid for {job_id}")
    supplement_path = contract_evidence_path(
        run_root,
        contract,
        "approvedGeometrySupplement",
        "geometrySupplement",
        f"contract {job_id}",
        identity_cache,
    )
    resolution_path = contract_evidence_path(
        run_root,
        contract,
        "approvedTemplateResolutionPlan",
        "templateResolutionPlan",
        f"contract {job_id}",
        identity_cache,
    )
    if "verifiedBeschnittGuideDonor" not in contract:
        raise BatchSanitizationError(
            f"Contract {job_id} must explicitly set verifiedBeschnittGuideDonor"
        )
    beschnitt_donor_report_path = contract_evidence_path(
        run_root,
        contract,
        "verifiedBeschnittGuideDonors",
        "verifiedBeschnittGuideDonor",
        f"contract {job_id}",
        identity_cache,
    )
    output_path = path_under(run_root, outputs["sanitizedPdf"], f"output PDF for {job_id}")
    inspection_path = path_under(run_root, outputs["inspection"], f"inspection for {job_id}")
    binding_keys = sorted(
        item.get("bindingKey") for item in job.get("coveredBindings", [])
        if isinstance(item, dict) and isinstance(item.get("bindingKey"), str)
    )
    if len(binding_keys) != job.get("coveredBindingCount") or len(set(binding_keys)) != len(binding_keys):
        raise BatchSanitizationError(f"Covered bindings are invalid for {job_id}")
    return {
        "job": job,
        "contract": contract,
        "sourcePath": source_path,
        "sourceSha256": source_identity["sha256"],
        "sourceBytes": source_byte_size,
        "contractPath": contract_entry["_path"],
        "contractSha256": contract_entry["sha256"],
        "contractBytes": contract_entry["bytes"],
        "geometryAuditPath": audit_path,
        "geometrySupplementPath": supplement_path,
        "templateResolutionPlanPath": resolution_path,
        "verifiedBeschnittGuideDonorReportPath": beschnitt_donor_report_path,
        "outputPath": output_path,
        "inspectionPath": inspection_path,
        "coveredBindingCount": len(binding_keys),
        "coveredBindingKeysSha256": sha256_json(binding_keys),
    }


def validate_existing_output(
    item: dict[str, Any],
    *,
    sanitizer_module: Any | None = None,
    validation_cache: Any | None = None,
) -> dict[str, Any]:
    job = item["job"]
    job_id = job["jobId"]
    output_exists = item["outputPath"].exists() or item["outputPath"].is_symlink()
    inspection_exists = item["inspectionPath"].exists() or item["inspectionPath"].is_symlink()
    if output_exists != inspection_exists:
        raise BatchSanitizationError(
            f"Resume refuses orphaned PDF/inspection output for {job_id}; manual review is required"
        )
    if not output_exists:
        return {"exists": False}
    output_bytes = read_regular_bytes(item["outputPath"], f"existing output PDF {job_id}")
    inspection, inspection_bytes = read_json(
        item["inspectionPath"], f"existing output inspection {job_id}"
    )
    expected_geometry = {
        key: job["geometry"][key] for key in ("format", "construction", "print", "spineMm")
    }
    if not isinstance(inspection, dict) or (
        inspection.get("schemaVersion") != SCHEMA_VERSION
        or inspection.get("state") != BATCH_OUTPUT_STATE
        or inspection.get("eligibleForTemplateImport") is not False
        or inspection.get("eligibleForImport") is not False
        or inspection.get("visualReviewPending") is not True
        or inspection.get("designerLockedOverlayVerificationPending") is not True
        or inspection.get("designerExportExclusionVerificationPending") is not True
        or inspection.get("geometry") != expected_geometry
        or inspection.get("finishKey") != job["finish"]["key"]
        or inspection.get("sourceSha256") != item["sourceSha256"]
        or inspection.get("contractSha256") != item["contractSha256"]
        or inspection.get("outputSha256") != sha256_bytes(output_bytes)
        or inspection.get("geometryAuditSha256") != item["contract"]["geometryAudit"]["reportSha256"]
    ):
        raise BatchSanitizationError(f"Existing output/inspection identity is invalid for {job_id}")
    supplement = item["contract"].get("geometrySupplement")
    resolution = item["contract"].get("templateResolutionPlan")
    beschnitt_donor = item["contract"].get("verifiedBeschnittGuideDonor")
    if inspection.get("geometrySupplementSha256") != (
        supplement.get("reportSha256") if isinstance(supplement, dict) else None
    ) or inspection.get("templateResolutionPlanSha256") != (
        resolution.get("reportSha256") if isinstance(resolution, dict) else None
    ):
        raise BatchSanitizationError(f"Existing inspection evidence drifted for {job_id}")
    inspection_donor = inspection.get("verifiedBeschnittGuideDonor")
    if isinstance(beschnitt_donor, dict):
        if (
            not isinstance(inspection_donor, dict)
            or inspection_donor.get("reportSha256")
            != beschnitt_donor.get("reportSha256")
            or inspection_donor.get("entrySha256")
            != beschnitt_donor.get("entrySha256")
        ):
            raise BatchSanitizationError(
                f"Existing inspection Beschnitt-donor evidence drifted for {job_id}"
            )
    elif inspection_donor is not None:
        raise BatchSanitizationError(
            f"Existing inspection unexpectedly claims Beschnitt-donor evidence for {job_id}"
        )
    false_mutation_record(
        inspection.get("prohibitedActionsPerformed"),
        f"inspection {job_id} prohibitedActionsPerformed",
        INSPECTION_PROHIBITED_ACTION_KEYS,
    )
    validation = inspection.get("validation")
    if not isinstance(validation, dict) or (
        validation.get("pageBoxesPreserved") is not True
        or validation.get("supplierTextAndBrandingRemoved") is not True
        or validation.get("metadataXmpThumbnailsAttachmentsActionsLinksAndCommentsRemoved") is not True
        or validation.get("danishInformationContained") is not True
        or validation.get("webprinterBluePanelPaintVerified") is not True
        or validation.get("supplierGreenPaintAbsent") is not True
    ):
        raise BatchSanitizationError(f"Existing inspection validation is incomplete for {job_id}")
    if sanitizer_module is not None:
        try:
            normalized_contract, observed, _ = sanitizer_module.validate_contract(
                copy.deepcopy(item["contract"]),
                item["sourcePath"],
                item["geometryAuditPath"],
                item["geometrySupplementPath"],
                item["templateResolutionPlanPath"],
                validation_cache=validation_cache,
            )
            independently_observed = sanitizer_module.validate_output(
                item["sourcePath"],
                item["outputPath"],
                normalized_contract,
                observed,
            )
        except Exception as exc:
            raise BatchSanitizationError(
                f"Existing output failed independent sanitizer verification for {job_id}: {exc}"
            ) from exc
        if independently_observed != validation:
            raise BatchSanitizationError(
                f"Existing inspection differs from independent sanitizer verification for {job_id}"
            )
    return {
        "exists": True,
        "outputSha256": sha256_bytes(output_bytes),
        "outputBytes": len(output_bytes),
        "inspectionSha256": sha256_bytes(inspection_bytes),
        "inspectionBytes": len(inspection_bytes),
    }


def build_job_manifest_row(item: dict[str, Any], existing: dict[str, Any]) -> dict[str, Any]:
    job = item["job"]
    contract = item["contract"]
    supplement = contract.get("geometrySupplement")
    resolution = contract.get("templateResolutionPlan")
    beschnitt_donor = contract.get("verifiedBeschnittGuideDonor")
    return {
        "jobId": job["jobId"],
        "safeOutputSignatureSha256": job["safeOutputSignatureSha256"],
        "geometry": job["geometry"],
        "finishKey": job["finish"]["key"],
        "coveredBindingCount": item["coveredBindingCount"],
        "coveredBindingKeysSha256": item["coveredBindingKeysSha256"],
        "source": {
            "path": job["sanitizerArgumentsAfterAllApprovals"]["source"],
            "sha256": item["sourceSha256"],
            "bytes": item["sourceBytes"],
        },
        "contract": {
            "path": job["outputs"]["reviewedContract"],
            "sha256": item["contractSha256"],
            "bytes": item["contractBytes"],
        },
        "sanitizedPdf": {
            "path": job["outputs"]["sanitizedPdf"],
            "sha256": existing["outputSha256"],
            "bytes": existing["outputBytes"],
        },
        "inspection": {
            "path": job["outputs"]["inspection"],
            "sha256": existing["inspectionSha256"],
            "bytes": existing["inspectionBytes"],
        },
        "executionEvidence": {
            "geometryAudit": {
                "path": contract["batchEvidence"]["geometryAudit"]["path"],
                "sha256": contract["geometryAudit"]["reportSha256"],
                "bytes": contract["batchEvidence"]["geometryAudit"]["bytes"],
            },
            "geometrySupplement": (
                {
                    "path": contract["batchEvidence"]["approvedGeometrySupplement"]["path"],
                    "sha256": supplement["reportSha256"],
                    "bytes": contract["batchEvidence"]["approvedGeometrySupplement"]["bytes"],
                }
                if isinstance(supplement, dict) else None
            ),
            "templateResolutionPlan": (
                {
                    "path": contract["batchEvidence"]["approvedTemplateResolutionPlan"]["path"],
                    "sha256": resolution["reportSha256"],
                    "bytes": contract["batchEvidence"]["approvedTemplateResolutionPlan"]["bytes"],
                }
                if isinstance(resolution, dict) else None
            ),
            "verifiedBeschnittGuideDonorReport": (
                {
                    "path": contract["batchEvidence"]["verifiedBeschnittGuideDonors"]["path"],
                    "sha256": beschnitt_donor["reportSha256"],
                    "bytes": contract["batchEvidence"]["verifiedBeschnittGuideDonors"]["bytes"],
                    "entrySha256": beschnitt_donor["entrySha256"],
                }
                if isinstance(beschnitt_donor, dict) else None
            ),
        },
        "state": BATCH_OUTPUT_STATE,
        "visualReviewPending": True,
        "designerLockedOverlayVerificationPending": True,
        "designerExportExclusionVerificationPending": True,
        "eligibleForTemplateImport": False,
        "eligibleForImport": False,
        "prohibitedActionsPerformed": {
            "uploaded": False,
            "databaseWritten": False,
            "supplierBankWritten": False,
            "productOrTemplateAttached": False,
            "pricingWritten": False,
            "published": False,
        },
    }


def atomic_replace_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_if_absent_or_identical(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(
            path,
            os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0),
            0o600,
        )
    except FileExistsError:
        if read_regular_bytes(path, f"existing final batch artifact {path.name}") != payload:
            raise BatchSanitizationError(f"Refusing to overwrite a different final batch artifact: {path}")
        return
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def load_sanitizer(path: Path) -> Any:
    specification = importlib.util.spec_from_file_location("wmd_sales_folder_batch_sanitizer", path)
    if specification is None or specification.loader is None:
        raise BatchSanitizationError("Cannot load approved sanitizer implementation")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    if not callable(getattr(module, "run_sanitize", None)):
        raise BatchSanitizationError("Approved sanitizer has no run_sanitize entrypoint")
    return module


def preflight(
    run_root: Path,
    repository_root: Path,
    *,
    expected_job_count: int = EXPECTED_JOB_COUNT,
) -> dict[str, Any]:
    if run_root.is_symlink() or not run_root.is_dir():
        raise BatchSanitizationError("Run directory must be an existing non-symlink directory")
    try:
        run_root.resolve(strict=True).relative_to(repository_root.resolve(strict=True))
    except ValueError as exc:
        raise BatchSanitizationError("Run directory must be inside the repository") from exc
    plan_path = path_under(run_root, PLAN_RELATIVE_PATH, "sanitization proposal plan", must_exist=True)
    plan, plan_bytes = read_json(plan_path, "sanitization proposal plan")
    jobs = validate_plan(plan, expected_job_count)
    manifest_path = path_under(
        run_root,
        CONTRACT_MANIFEST_RELATIVE_PATH,
        "approved contract manifest",
        must_exist=True,
    )
    contract_manifest, contract_manifest_bytes = read_json(
        manifest_path, "approved contract manifest"
    )
    contract_entries, manifest_context = validate_contract_manifest(
        run_root,
        repository_root,
        contract_manifest,
        contract_manifest_bytes,
        manifest_path,
        plan_path,
        plan_bytes,
        expected_job_count,
    )
    plan_ids = {job["jobId"] for job in jobs}
    if set(contract_entries) != plan_ids:
        raise BatchSanitizationError("Approved contracts do not exactly cover the proposal-plan job set")
    identity_cache: dict[Path, tuple[str, int]] = {}
    validated_jobs = [
        validate_job(
            run_root,
            job,
            contract_entries[job["jobId"]],
            identity_cache,
        )
        for job in jobs
    ]
    covered_binding_references = sum(
        item["coveredBindingCount"] for item in validated_jobs
    )
    if (
        covered_binding_references < expected_job_count
        or (
            expected_job_count == EXPECTED_JOB_COUNT
            and covered_binding_references != EXPECTED_BINDING_COUNT
        )
    ):
        raise BatchSanitizationError("Approved batch has invalid binding coverage")
    return {
        "runRoot": run_root,
        "repositoryRoot": repository_root,
        "planPath": plan_path,
        "planSha256": sha256_bytes(plan_bytes),
        "planBytes": len(plan_bytes),
        "contractManifestPath": manifest_path,
        "contractManifestSha256": manifest_context["manifestSha256"],
        "contractManifestBytes": manifest_context["manifestBytes"],
        "contractManifestSidecarPath": manifest_context["manifestSidecarPath"],
        "contractManifestSidecarSha256": manifest_context["manifestSidecarSha256"],
        "contractManifestSidecarBytes": manifest_context["manifestSidecarBytes"],
        "contractChecksumsPath": manifest_context["checksumsPath"],
        "contractChecksumsSha256": manifest_context["checksumsSha256"],
        "contractChecksumsBytes": manifest_context["checksumsBytes"],
        "sanitizerPath": manifest_context["sanitizerPath"],
        "sanitizerSha256": manifest_context["sanitizerSha256"],
        "sanitizerBytes": manifest_context["sanitizerBytes"],
        "approvalEvidence": manifest_context["approvalEvidence"],
        "sharedFileIdentities": identity_cache,
        "jobs": validated_jobs,
    }


def revalidate_inputs(context: dict[str, Any]) -> None:
    identities = [
        (context["planPath"], context["planSha256"], context["planBytes"], "proposal plan"),
        (
            context["contractManifestPath"],
            context["contractManifestSha256"],
            context["contractManifestBytes"],
            "approved contract manifest",
        ),
        (
            context["sanitizerPath"],
            context["sanitizerSha256"],
            context["sanitizerBytes"],
            "sanitizer implementation",
        ),
        (
            context["contractManifestSidecarPath"],
            context["contractManifestSidecarSha256"],
            context["contractManifestSidecarBytes"],
            "approved contract manifest SHA sidecar",
        ),
        (
            context["contractChecksumsPath"],
            context["contractChecksumsSha256"],
            context["contractChecksumsBytes"],
            "approved contract checksums",
        ),
    ]
    for path, (expected_sha, expected_bytes) in context["sharedFileIdentities"].items():
        identities.append((path, expected_sha, expected_bytes, f"shared evidence {path.name}"))
    for label, approval in context["approvalEvidence"].items():
        approval_path = path_under(
            context["runRoot"], approval["path"], f"approval evidence {label}", must_exist=True
        )
        identities.append((
            approval_path,
            approval["sha256"],
            approval["bytes"],
            f"approval evidence {label}",
        ))
    seen: set[Path] = set()
    for item in context["jobs"]:
        identities.extend([
            (item["sourcePath"], item["sourceSha256"], item["sourceBytes"], f"source {item['job']['jobId']}"),
            (item["contractPath"], item["contractSha256"], item["contractBytes"], f"contract {item['job']['jobId']}"),
        ])
    for path, expected_sha, expected_bytes, label in identities:
        if path in seen:
            continue
        seen.add(path)
        value = read_regular_bytes(path, label)
        if sha256_bytes(value) != expected_sha or len(value) != expected_bytes:
            raise BatchSanitizationError(f"Input changed during batch execution: {label}")


def ordered_job_identity_sha256(context: dict[str, Any]) -> str:
    return sha256_json([
        {
            "jobId": item["job"]["jobId"],
            "safeOutputSignatureSha256": item["job"]["safeOutputSignatureSha256"],
        }
        for item in context["jobs"]
    ])


def checkpoint_payload(
    context: dict[str, Any],
    rows: list[dict[str, Any]],
    state: str,
    failure: str | None = None,
    *,
    zero_output_amendment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "kind": "wmd_sales_folder_sanitization_batch_checkpoint",
        "schemaVersion": SCHEMA_VERSION,
        "state": state,
        "localOnly": True,
        "expectedOutputCount": len(context["jobs"]),
        "completedOutputCount": len(rows),
        "planSha256": context["planSha256"],
        "contractManifestSha256": context["contractManifestSha256"],
        "sanitizerSha256": context["sanitizerSha256"],
        "artifactOperationAuthorization": artifact_operation_authorization(
            len(context["jobs"])
        ),
        "completedJobs": [row["jobId"] for row in rows],
        "failure": failure,
        "prohibitedActionsPerformed": {
            "uploaded": False,
            "databaseWritten": False,
            "supplierBankWritten": False,
            "productOrTemplateAttached": False,
            "pricingWritten": False,
            "published": False,
        },
    }
    if zero_output_amendment is not None:
        payload["zeroOutputCheckpointAmendment"] = copy.deepcopy(
            zero_output_amendment
        )
    return payload


def validate_zero_output_amendment(
    amendment: Any,
    context: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(amendment, dict) or set(amendment) != ZERO_OUTPUT_AMENDMENT_KEYS:
        raise BatchSanitizationError("Zero-output checkpoint amendment schema is invalid")
    original = amendment.get("originalCheckpoint")
    superseded = amendment.get("superseded")
    adopted = amendment.get("adopted")
    unchanged = amendment.get("unchangedBatchIdentity")
    zero_evidence = amendment.get("zeroOutputEvidence")
    incident = ZERO_OUTPUT_RECOVERY_INCIDENT
    if (
        amendment.get("kind") != ZERO_OUTPUT_AMENDMENT_KIND
        or amendment.get("schemaVersion") != SCHEMA_VERSION
        or isinstance(amendment.get("schemaVersion"), bool)
        or amendment.get("sequence") != 1
        or isinstance(amendment.get("sequence"), bool)
        or amendment.get("reason") != ZERO_OUTPUT_AMENDMENT_REASON
        or not isinstance(original, dict)
        or set(original) != {"sha256", "bytes"}
        or not valid_sha256(original.get("sha256"))
        or not isinstance(original.get("bytes"), int)
        or isinstance(original.get("bytes"), bool)
        or original.get("bytes", 0) < 1
        or original.get("sha256") != incident["checkpointSha256"]
        or original.get("bytes") != incident["checkpointBytes"]
        or not isinstance(superseded, dict)
        or set(superseded) != {
            "planSha256",
            "contractManifestSha256",
            "sanitizerSha256",
        }
        or not all(valid_sha256(value) for value in superseded.values())
        or superseded
        != {
            "planSha256": incident["planSha256"],
            "contractManifestSha256": incident["contractManifestSha256"],
            "sanitizerSha256": incident["sanitizerSha256"],
        }
        or not isinstance(adopted, dict)
        or set(adopted) != {
            "planSha256",
            "contractManifestSha256",
            "sanitizerSha256",
        }
        or adopted
        != {
            "planSha256": context["planSha256"],
            "contractManifestSha256": context["contractManifestSha256"],
            "sanitizerSha256": context["sanitizerSha256"],
        }
        or superseded["planSha256"] != adopted["planSha256"]
        or superseded["contractManifestSha256"]
        == adopted["contractManifestSha256"]
        or superseded["sanitizerSha256"] == adopted["sanitizerSha256"]
        or not isinstance(unchanged, dict)
        or set(unchanged)
        != {"expectedOutputCount", "orderedJobIdAndSafeOutputSignatureSha256"}
        or unchanged.get("expectedOutputCount") != len(context["jobs"])
        or unchanged.get("expectedOutputCount")
        != incident["expectedOutputCount"]
        or unchanged.get("orderedJobIdAndSafeOutputSignatureSha256")
        != ordered_job_identity_sha256(context)
        or unchanged.get("orderedJobIdAndSafeOutputSignatureSha256")
        != incident["orderedJobIdentitySha256"]
        or amendment.get("preservedArtifactOperationAuthorizationSha256")
        != sha256_json(artifact_operation_authorization(len(context["jobs"])))
        or zero_evidence
        != {
            "completedOutputCount": 0,
            "completedJobs": [],
            "sanitizedPdfTreeEntryCount": 0,
            "inspectionTreeEntryCount": 0,
            "finalBatchArtifactCount": 0,
        }
        or not isinstance(amendment.get("originalFailure"), str)
        or amendment.get("originalFailure") != incident["failure"]
        or not amendment["originalFailure"].startswith(
            f"{context['jobs'][0]['job']['jobId']}: "
        )
        or context["jobs"][0]["job"]["jobId"] != incident["firstJobId"]
        or not amendment["originalFailure"].endswith(
            ZERO_OUTPUT_RECOVERABLE_FAILURE_SUFFIX
        )
    ):
        raise BatchSanitizationError("Zero-output checkpoint amendment evidence is invalid")
    return amendment


def validate_resume_checkpoint(path: Path, context: dict[str, Any]) -> dict[str, Any]:
    checkpoint, _ = read_json(path, "batch resume checkpoint")
    authorization = checkpoint.get("artifactOperationAuthorization") if isinstance(checkpoint, dict) else None
    expected_authorization = artifact_operation_authorization(len(context["jobs"]))
    if not isinstance(checkpoint, dict) or (
        checkpoint.get("kind") != "wmd_sales_folder_sanitization_batch_checkpoint"
        or checkpoint.get("schemaVersion") != SCHEMA_VERSION
        or checkpoint.get("localOnly") is not True
        or checkpoint.get("expectedOutputCount") != len(context["jobs"])
        or checkpoint.get("planSha256") != context["planSha256"]
        or checkpoint.get("contractManifestSha256") != context["contractManifestSha256"]
        or checkpoint.get("sanitizerSha256") != context["sanitizerSha256"]
        or authorization != expected_authorization
    ):
        raise BatchSanitizationError(
            "Resume checkpoint is not bound to the original exact PDF edit-marker authorization"
        )
    amendment = checkpoint.get("zeroOutputCheckpointAmendment")
    expected_keys = CHECKPOINT_BASE_KEYS | (
        {"zeroOutputCheckpointAmendment"} if amendment is not None else set()
    )
    if set(checkpoint) != expected_keys:
        raise BatchSanitizationError("Resume checkpoint schema is invalid")
    if amendment is not None:
        validate_zero_output_amendment(amendment, context)
    false_mutation_record(
        checkpoint.get("prohibitedActionsPerformed"),
        "resume checkpoint prohibitedActionsPerformed",
        RUNNER_PROHIBITED_ACTION_KEYS,
    )
    completed = checkpoint.get("completedJobs")
    plan_ids = [item["job"]["jobId"] for item in context["jobs"]]
    if not isinstance(completed, list) or completed != plan_ids[:len(completed)]:
        raise BatchSanitizationError("Resume checkpoint completed-job prefix is invalid")
    if checkpoint.get("completedOutputCount") != len(completed):
        raise BatchSanitizationError("Resume checkpoint completed-output count is invalid")
    return checkpoint


def require_empty_non_symlink_directory_or_absent(path: Path, label: str) -> int:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return 0
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise BatchSanitizationError(f"{label} must be absent or an empty non-symlink directory")
    entries = list(path.iterdir())
    if entries:
        raise BatchSanitizationError(
            f"{label} is not empty; zero-output recovery refuses every existing entry"
        )
    return 0


def verify_zero_output_artifacts_absent(
    context: dict[str, Any],
    checkpoint_path: Path,
) -> None:
    run_root = context["runRoot"]
    sanitized_directory = path_under(
        run_root,
        "documents/sanitized-pdfs",
        "sanitized PDF output directory",
    )
    inspection_directory = path_under(
        run_root,
        "documents/sanitization-inspections",
        "sanitization inspection output directory",
    )
    require_empty_non_symlink_directory_or_absent(
        sanitized_directory,
        "Sanitized PDF output directory",
    )
    require_empty_non_symlink_directory_or_absent(
        inspection_directory,
        "Sanitization inspection output directory",
    )
    for item in context["jobs"]:
        if item["outputPath"].exists() or item["outputPath"].is_symlink():
            raise BatchSanitizationError("Zero-output recovery found an existing sanitized PDF")
        if item["inspectionPath"].exists() or item["inspectionPath"].is_symlink():
            raise BatchSanitizationError("Zero-output recovery found an existing inspection")
    batch_directory = path_under(
        run_root,
        BATCH_DIRECTORY_RELATIVE_PATH,
        "sanitization batch directory",
    )
    batch_metadata = batch_directory.lstat()
    if stat.S_ISLNK(batch_metadata.st_mode) or not stat.S_ISDIR(batch_metadata.st_mode):
        raise BatchSanitizationError("Sanitization batch directory must be a non-symlink directory")
    batch_entries = list(batch_directory.iterdir())
    if len(batch_entries) != 1 or batch_entries[0] != checkpoint_path:
        raise BatchSanitizationError(
            "Zero-output recovery requires checkpoint.json to be the only batch artifact"
        )


def amend_zero_output_checkpoint(
    context: dict[str, Any],
    *,
    expected_checkpoint_sha256: str,
    expected_adopted_contract_manifest_sha256: str,
    expected_adopted_sanitizer_sha256: str,
) -> dict[str, Any]:
    """Adopt newly approved pins after the exact first-job/no-output failure.

    This operation never loads or invokes the sanitizer.  It only replaces the
    existing checkpoint after a complete current preflight and exhaustive
    zero-output checks; the original PDF marker authorization is preserved.
    """

    if not valid_sha256(expected_checkpoint_sha256):
        raise BatchSanitizationError("Expected checkpoint SHA-256 is invalid")
    incident = ZERO_OUTPUT_RECOVERY_INCIDENT
    if (
        set(incident)
        != {
            "checkpointSha256",
            "checkpointBytes",
            "planSha256",
            "contractManifestSha256",
            "sanitizerSha256",
            "expectedOutputCount",
            "firstJobId",
            "orderedJobIdentitySha256",
            "failure",
        }
        or not all(
            valid_sha256(incident[key])
            for key in (
                "checkpointSha256",
                "planSha256",
                "contractManifestSha256",
                "sanitizerSha256",
                "orderedJobIdentitySha256",
            )
        )
        or not isinstance(incident["expectedOutputCount"], int)
        or isinstance(incident["expectedOutputCount"], bool)
        or incident["expectedOutputCount"] < 1
        or not isinstance(incident["checkpointBytes"], int)
        or isinstance(incident["checkpointBytes"], bool)
        or incident["checkpointBytes"] < 1
        or not isinstance(incident["firstJobId"], str)
        or not JOB_ID_RE.fullmatch(incident["firstJobId"])
        or incident["failure"]
        != f"{incident['firstJobId']}: {ZERO_OUTPUT_RECOVERABLE_FAILURE_SUFFIX}"
    ):
        raise BatchSanitizationError(
            "Built-in zero-output recovery incident identity is invalid"
        )
    revalidate_inputs(context)
    run_root = context["runRoot"]
    checkpoint_path = path_under(
        run_root,
        BATCH_CHECKPOINT_RELATIVE_PATH,
        "zero-output recovery checkpoint",
        must_exist=True,
    )
    checkpoint, checkpoint_bytes = read_json(
        checkpoint_path,
        "zero-output recovery checkpoint",
    )
    if (
        isinstance(checkpoint, dict)
        and "zeroOutputCheckpointAmendment" in checkpoint
    ):
        raise BatchSanitizationError(
            "Zero-output checkpoint was already amended; a second amendment is forbidden"
        )
    if expected_checkpoint_sha256 != incident["checkpointSha256"]:
        raise BatchSanitizationError(
            "Expected checkpoint SHA-256 is not the approved zero-output incident"
        )
    if expected_adopted_contract_manifest_sha256 != context["contractManifestSha256"]:
        raise BatchSanitizationError("Adopted contract-manifest SHA-256 does not match current preflight")
    if expected_adopted_sanitizer_sha256 != context["sanitizerSha256"]:
        raise BatchSanitizationError("Adopted sanitizer SHA-256 does not match current preflight")
    if sha256_bytes(checkpoint_bytes) != expected_checkpoint_sha256:
        raise BatchSanitizationError("Zero-output recovery checkpoint SHA-256 changed")
    if len(checkpoint_bytes) != incident["checkpointBytes"]:
        raise BatchSanitizationError("Zero-output recovery checkpoint byte size changed")
    if not isinstance(checkpoint, dict) or set(checkpoint) != CHECKPOINT_BASE_KEYS:
        raise BatchSanitizationError(
            "Zero-output recovery requires the exact unamended checkpoint schema"
        )
    expected_count = len(context["jobs"])
    expected_authorization = artifact_operation_authorization(expected_count)
    first_job_id = context["jobs"][0]["job"]["jobId"]
    failure = checkpoint.get("failure")
    if (
        checkpoint.get("kind") != "wmd_sales_folder_sanitization_batch_checkpoint"
        or checkpoint.get("schemaVersion") != SCHEMA_VERSION
        or checkpoint.get("state") != "failed_fail_fast"
        or checkpoint.get("localOnly") is not True
        or checkpoint.get("expectedOutputCount") != expected_count
        or expected_count != incident["expectedOutputCount"]
        or checkpoint.get("completedOutputCount") != 0
        or checkpoint.get("completedJobs") != []
        or checkpoint.get("planSha256") != context["planSha256"]
        or checkpoint.get("planSha256") != incident["planSha256"]
        or checkpoint.get("artifactOperationAuthorization") != expected_authorization
        or not isinstance(failure, str)
        or failure != incident["failure"]
        or not failure.startswith(f"{first_job_id}: ")
        or first_job_id != incident["firstJobId"]
        or not failure.endswith(ZERO_OUTPUT_RECOVERABLE_FAILURE_SUFFIX)
        or not valid_sha256(checkpoint.get("contractManifestSha256"))
        or not valid_sha256(checkpoint.get("sanitizerSha256"))
        or checkpoint.get("contractManifestSha256")
        != incident["contractManifestSha256"]
        or checkpoint.get("sanitizerSha256") != incident["sanitizerSha256"]
        or checkpoint.get("contractManifestSha256")
        == context["contractManifestSha256"]
        or checkpoint.get("sanitizerSha256") == context["sanitizerSha256"]
        or ordered_job_identity_sha256(context)
        != incident["orderedJobIdentitySha256"]
    ):
        raise BatchSanitizationError(
            "Checkpoint is not the exact recoverable first-job/no-output failure"
        )
    false_mutation_record(
        checkpoint.get("prohibitedActionsPerformed"),
        "zero-output recovery checkpoint prohibitedActionsPerformed",
        RUNNER_PROHIBITED_ACTION_KEYS,
    )

    verify_zero_output_artifacts_absent(context, checkpoint_path)

    amendment = {
        "kind": ZERO_OUTPUT_AMENDMENT_KIND,
        "schemaVersion": SCHEMA_VERSION,
        "sequence": 1,
        "reason": ZERO_OUTPUT_AMENDMENT_REASON,
        "originalCheckpoint": {
            "sha256": expected_checkpoint_sha256,
            "bytes": len(checkpoint_bytes),
        },
        "superseded": {
            "planSha256": checkpoint["planSha256"],
            "contractManifestSha256": checkpoint["contractManifestSha256"],
            "sanitizerSha256": checkpoint["sanitizerSha256"],
        },
        "adopted": {
            "planSha256": context["planSha256"],
            "contractManifestSha256": context["contractManifestSha256"],
            "sanitizerSha256": context["sanitizerSha256"],
        },
        "unchangedBatchIdentity": {
            "expectedOutputCount": expected_count,
            "orderedJobIdAndSafeOutputSignatureSha256": ordered_job_identity_sha256(
                context
            ),
        },
        "preservedArtifactOperationAuthorizationSha256": sha256_json(
            checkpoint["artifactOperationAuthorization"]
        ),
        "zeroOutputEvidence": {
            "completedOutputCount": 0,
            "completedJobs": [],
            "sanitizedPdfTreeEntryCount": 0,
            "inspectionTreeEntryCount": 0,
            "finalBatchArtifactCount": 0,
        },
        "originalFailure": failure,
    }
    validate_zero_output_amendment(amendment, context)
    amended = copy.deepcopy(checkpoint)
    amended["state"] = "failed_fail_fast_zero_output_amended"
    amended["contractManifestSha256"] = context["contractManifestSha256"]
    amended["sanitizerSha256"] = context["sanitizerSha256"]
    amended["zeroOutputCheckpointAmendment"] = amendment

    revalidate_inputs(context)
    # Recheck every output location after the potentially long 1,420-job input
    # revalidation, immediately before replacing the checkpoint.  This closes
    # the practical recovery race with an accidental concurrent execute.
    verify_zero_output_artifacts_absent(context, checkpoint_path)
    current_checkpoint_bytes = read_regular_bytes(
        checkpoint_path,
        "zero-output recovery checkpoint before atomic replacement",
    )
    if (
        sha256_bytes(current_checkpoint_bytes) != expected_checkpoint_sha256
        or current_checkpoint_bytes != checkpoint_bytes
    ):
        raise BatchSanitizationError(
            "Zero-output recovery checkpoint changed before atomic replacement"
        )
    atomic_replace_json(checkpoint_path, amended)
    return amended


def build_final_manifest(
    context: dict[str, Any],
    rows: list[dict[str, Any]],
    *,
    zero_output_amendment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    manifest = {
        "kind": BATCH_MANIFEST_KIND,
        "schemaVersion": SCHEMA_VERSION,
        "state": BATCH_OUTPUT_STATE,
        "reviewState": BATCH_OUTPUT_STATE,
        "localOnly": True,
        "eligibleForTemplateImport": False,
        "eligibleForImport": False,
        "counts": {
            "expectedOutputCount": len(context["jobs"]),
            "sanitizedPdfs": len(rows),
            "inspections": len(rows),
            "jobs": len(rows),
            "coveredBindingReferences": sum(row["coveredBindingCount"] for row in rows),
        },
        "artifactOperationAuthorization": artifact_operation_authorization(
            len(context["jobs"])
        ),
        "inputEvidence": {
            "sanitizationProposalPlan": {
                "path": PLAN_RELATIVE_PATH,
                "sha256": context["planSha256"],
                "bytes": context["planBytes"],
            },
            "approvedContractManifest": {
                "path": CONTRACT_MANIFEST_RELATIVE_PATH,
                "sha256": context["contractManifestSha256"],
                "bytes": context["contractManifestBytes"],
            },
            "sanitizerImplementation": {
                "path": SANITIZER_RELATIVE_PATH,
                "sha256": context["sanitizerSha256"],
                "bytes": context["sanitizerBytes"],
                "entrypoint": "run_sanitize",
            },
            "approvalEvidence": context["approvalEvidence"],
        },
        "jobs": rows,
        "visualReviewPending": True,
        "designerLockedOverlayVerificationPending": True,
        "designerExportExclusionVerificationPending": True,
        "prohibitedActionsPerformed": {
            "uploaded": False,
            "databaseWritten": False,
            "supplierBankWritten": False,
            "productOrTemplateAttached": False,
            "pricingWritten": False,
            "published": False,
        },
        "nextGate": (
            "Render and visually review every sanitized PDF, then separately verify the locked non-printing "
            "Designer overlay and overlay-free production export. This manifest does not authorize import, upload, "
            "database, product, template, pricing, or publication writes."
        ),
    }
    if zero_output_amendment is not None:
        manifest["zeroOutputCheckpointAmendment"] = copy.deepcopy(
            zero_output_amendment
        )
    return manifest


def run_batch(
    context: dict[str, Any],
    *,
    resume: bool,
    marker_confirmed_count: int,
    sanitizer_callable: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, Any]:
    revalidate_inputs(context)
    sanitizer_module = None
    validation_cache = None
    if sanitizer_callable is None:
        sanitizer_module = load_sanitizer(context["sanitizerPath"])
        sanitizer_callable = sanitizer_module.run_sanitize
        cache_type = getattr(sanitizer_module, "BatchValidationCache", None)
        if not callable(cache_type):
            raise BatchSanitizationError(
                "Approved sanitizer lacks the required content-addressed batch validation cache"
            )
        validation_cache = cache_type()
    run_root = context["runRoot"]
    checkpoint_path = path_under(run_root, BATCH_CHECKPOINT_RELATIVE_PATH, "batch checkpoint")
    final_manifest_path = path_under(run_root, BATCH_MANIFEST_RELATIVE_PATH, "batch manifest")
    final_sha_path = path_under(run_root, BATCH_MANIFEST_SHA_RELATIVE_PATH, "batch manifest SHA")
    final_checksums_path = path_under(run_root, BATCH_CHECKSUMS_RELATIVE_PATH, "batch checksums")
    final_exists = [path.exists() or path.is_symlink() for path in (final_manifest_path, final_sha_path, final_checksums_path)]
    if any(final_exists) and not all(final_exists):
        raise BatchSanitizationError("Final batch manifest artifacts are incomplete; resume refuses to guess")
    if all(final_exists) and not resume:
        raise BatchSanitizationError("Final batch manifest already exists; use --resume for idempotent verification")
    existing_by_job: dict[str, dict[str, Any]] = {}
    pending: list[dict[str, Any]] = []
    for item in context["jobs"]:
        existing = validate_existing_output(
            item,
            sanitizer_module=sanitizer_module,
            validation_cache=validation_cache,
        )
        if existing["exists"]:
            existing_by_job[item["job"]["jobId"]] = existing
        else:
            pending.append(item)
    if existing_by_job and not resume:
        raise BatchSanitizationError("Existing batch outputs require explicit --resume")
    checkpoint_exists = checkpoint_path.exists() or checkpoint_path.is_symlink()
    if checkpoint_exists and not resume:
        raise BatchSanitizationError("Existing batch checkpoint requires explicit --resume")
    zero_output_amendment = None
    if resume:
        if not checkpoint_exists:
            raise BatchSanitizationError(
                "Resume requires the checkpoint written before the original first PDF authoring command"
            )
        resume_checkpoint = validate_resume_checkpoint(checkpoint_path, context)
        zero_output_amendment = resume_checkpoint.get(
            "zeroOutputCheckpointAmendment"
        )
    validate_pdf_edit_marker_count(len(context["jobs"]), marker_confirmed_count)
    if not resume:
        atomic_replace_json(
            checkpoint_path,
            checkpoint_payload(
                context,
                [],
                "authorized_before_first_authoring",
                zero_output_amendment=zero_output_amendment,
            ),
        )
    rows: list[dict[str, Any]] = []
    for item in context["jobs"]:
        job_id = item["job"]["jobId"]
        existing = existing_by_job.get(job_id)
        if existing is None:
            try:
                assert sanitizer_callable is not None
                arguments = (
                    item["sourcePath"],
                    item["outputPath"],
                    item["inspectionPath"],
                    item["contractPath"],
                    item["geometryAuditPath"],
                    item["geometrySupplementPath"],
                    item["templateResolutionPlanPath"],
                )
                if sanitizer_module is None:
                    sanitizer_callable(*arguments)
                else:
                    sanitizer_callable(
                        *arguments,
                        validation_cache=validation_cache,
                    )
                existing = validate_existing_output(item)
                if not existing["exists"]:
                    raise BatchSanitizationError(f"Sanitizer returned without exact outputs for {job_id}")
            except Exception as exc:
                atomic_replace_json(
                    checkpoint_path,
                    checkpoint_payload(
                        context,
                        rows,
                        "failed_fail_fast",
                        f"{job_id}: {type(exc).__name__}: {exc}",
                        zero_output_amendment=zero_output_amendment,
                    ),
                )
                if isinstance(exc, BatchSanitizationError):
                    raise
                raise BatchSanitizationError(f"Sanitization failed fast at {job_id}: {exc}") from exc
        row = build_job_manifest_row(item, existing)
        rows.append(row)
        atomic_replace_json(
            checkpoint_path,
            checkpoint_payload(
                context,
                rows,
                "in_progress",
                zero_output_amendment=zero_output_amendment,
            ),
        )
    revalidate_inputs(context)
    if len(rows) != len(context["jobs"]):
        raise BatchSanitizationError("Batch did not produce the exact approved output count")
    # Re-read every PDF and inspection immediately before finalization.  A
    # 1,420-job run is long enough that an early output could otherwise change
    # after its per-job checkpoint and leave stale hashes in the final manifest.
    final_rows: list[dict[str, Any]] = []
    for item in context["jobs"]:
        final_identity = validate_existing_output(item)
        if not final_identity["exists"]:
            raise BatchSanitizationError(
                f"Final output revalidation found a missing PDF/inspection pair for {item['job']['jobId']}"
            )
        final_rows.append(build_job_manifest_row(item, final_identity))
    rows = final_rows
    manifest = build_final_manifest(
        context,
        rows,
        zero_output_amendment=zero_output_amendment,
    )
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    manifest_sha = sha256_bytes(manifest_bytes)
    checksum_rows: list[tuple[str, str]] = []
    for row in rows:
        checksum_rows.extend([
            (row["sanitizedPdf"]["path"], row["sanitizedPdf"]["sha256"]),
            (row["inspection"]["path"], row["inspection"]["sha256"]),
        ])
    checksum_rows.append((BATCH_MANIFEST_RELATIVE_PATH, manifest_sha))
    checksum_bytes = "".join(
        f"{checksum}  {path}\n" for path, checksum in sorted(checksum_rows)
    ).encode("utf-8")
    sidecar_bytes = f"{manifest_sha}  manifest.json\n".encode("utf-8")
    write_if_absent_or_identical(final_checksums_path, checksum_bytes)
    write_if_absent_or_identical(final_sha_path, sidecar_bytes)
    write_if_absent_or_identical(final_manifest_path, manifest_bytes)
    atomic_replace_json(
        checkpoint_path,
        checkpoint_payload(
            context,
            rows,
            "complete",
            zero_output_amendment=zero_output_amendment,
        ),
    )
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=("preflight", "execute", "amend-zero-output-checkpoint"),
    )
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument(
        "--pdf-edit-marker-confirmed-count",
        type=int,
        default=None,
        help=(
            "For execute only: successful PDF edit-marker expected-output-count, capped at the tool-supported maximum of 100 (for 1,420 jobs pass 100); reuse that recorded count on resume without running a second marker"
        ),
    )
    parser.add_argument(
        "--expected-checkpoint-sha256",
        default=None,
        help=(
            "For amend-zero-output-checkpoint only: exact SHA-256 of the unamended failed checkpoint"
        ),
    )
    parser.add_argument(
        "--adopted-contract-manifest-sha256",
        default=None,
        help=(
            "For amend-zero-output-checkpoint only: exact newly approved contract-manifest SHA-256"
        ),
    )
    parser.add_argument(
        "--adopted-sanitizer-sha256",
        default=None,
        help=(
            "For amend-zero-output-checkpoint only: exact newly approved sanitizer SHA-256"
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repository_root = Path(__file__).resolve().parents[2]
    run_root = Path(args.run_dir).absolute()
    try:
        context = preflight(run_root, repository_root)
        amendment_arguments = (
            args.expected_checkpoint_sha256,
            args.adopted_contract_manifest_sha256,
            args.adopted_sanitizer_sha256,
        )
        if args.command == "preflight":
            if (
                args.resume
                or args.pdf_edit_marker_confirmed_count is not None
                or any(value is not None for value in amendment_arguments)
            ):
                raise BatchSanitizationError(
                    "preflight does not accept execution, resume, or amendment flags"
                )
            print(json.dumps({
                "state": "preflight_passed_no_writes",
                "expectedOutputCount": len(context["jobs"]),
                "planSha256": context["planSha256"],
                "contractManifestSha256": context["contractManifestSha256"],
                "sanitizerSha256": context["sanitizerSha256"],
                "pdfEditMarkerPolicy": pdf_edit_marker_policy(len(context["jobs"])),
            }, ensure_ascii=False))
            return 0
        if args.command == "amend-zero-output-checkpoint":
            if args.resume or args.pdf_edit_marker_confirmed_count is not None:
                raise BatchSanitizationError(
                    "amend-zero-output-checkpoint is a separate no-authoring operation and does not accept execute/resume marker flags"
                )
            if any(value is None for value in amendment_arguments):
                raise BatchSanitizationError(
                    "amend-zero-output-checkpoint requires the exact checkpoint, adopted contract-manifest, and adopted sanitizer SHA-256 arguments"
                )
            amended = amend_zero_output_checkpoint(
                context,
                expected_checkpoint_sha256=args.expected_checkpoint_sha256,
                expected_adopted_contract_manifest_sha256=(
                    args.adopted_contract_manifest_sha256
                ),
                expected_adopted_sanitizer_sha256=args.adopted_sanitizer_sha256,
            )
            print(json.dumps({
                "state": amended["state"],
                "checkpoint": BATCH_CHECKPOINT_RELATIVE_PATH,
                "zeroOutputCheckpointAmendment": amended[
                    "zeroOutputCheckpointAmendment"
                ],
                "pdfAuthored": False,
            }, ensure_ascii=False))
            return 0
        if any(value is not None for value in amendment_arguments):
            raise BatchSanitizationError(
                "execute does not accept zero-output amendment arguments; run the separate amendment command first"
            )
        if args.pdf_edit_marker_confirmed_count is None:
            policy = pdf_edit_marker_policy(len(context["jobs"]))
            raise BatchSanitizationError(
                "Run the PDF edit marker exactly once immediately before the first execute "
                f"with expected-output-count {policy['requiredConfirmedCount']} "
                f"(tool-supported maximum {policy['toolSupportedMaximum']}; authorized batch total "
                f"{len(context['jobs'])}), then pass --pdf-edit-marker-confirmed-count "
                f"{policy['requiredConfirmedCount']}. On resume, reuse that count without "
                "running a second marker"
            )
        manifest = run_batch(
            context,
            resume=args.resume,
            marker_confirmed_count=args.pdf_edit_marker_confirmed_count,
        )
        print(json.dumps({
            "state": manifest["state"],
            "jobs": manifest["counts"]["jobs"],
            "manifest": BATCH_MANIFEST_RELATIVE_PATH,
            "eligibleForImport": False,
        }, ensure_ascii=False))
        return 0
    except (BatchSanitizationError, OSError, ValueError) as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"REFUSED: unexpected batch-runner failure: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
