#!/usr/bin/env python3
"""Focused local-only tests for the deterministic WMD sanitization batch runner."""

from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


RUNNER_PATH = Path(__file__).resolve().parents[1] / "run_wmd_sales_folder_sanitization_batch.py"
SPEC = importlib.util.spec_from_file_location("wmd_batch_runner", RUNNER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Cannot load batch runner")
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


def write_json(path: Path, value: object) -> bytes:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    path.write_bytes(payload)
    return payload


def evidence(path: str, value: bytes) -> dict[str, object]:
    return {"path": path, "sha256": runner.sha256_bytes(value), "bytes": len(value)}


class SyntheticApprovedBatch:
    def __init__(self, root: Path, job_count: int = 2):
        self.repository = root / "repository"
        self.run_root = self.repository / "tmp" / "synthetic-approved-run"
        self.repository.mkdir(parents=True)
        self.run_root.mkdir(parents=True)
        self.job_count = job_count
        self.sanitizer_path = self.repository / runner.SANITIZER_RELATIVE_PATH
        self.sanitizer_path.parent.mkdir(parents=True)
        self.sanitizer_bytes = b"def run_sanitize(*args):\n    raise RuntimeError('test injects a fake')\n"
        self.sanitizer_path.write_bytes(self.sanitizer_bytes)
        audit_path = self.run_root / "review/template-geometry-audit.json"
        self.audit_bytes = write_json(audit_path, {"kind": "synthetic-audit", "schemaVersion": 1})
        promotion_path = self.run_root / "review/approved-template-package/promotion-manifest.json"
        promotion_bytes = write_json(
            promotion_path,
            {"kind": "synthetic-approved-template-package", "schemaVersion": 1, "state": "approved"},
        )
        decision_path = self.run_root / "review/sanitization-contract-approval-decision.json"
        decision_bytes = write_json(
            decision_path,
            {"kind": "synthetic-user-decision", "schemaVersion": 1, "approved": True},
        )
        self.approval_evidence = {
            "templatePromotionManifest": evidence(
                "review/approved-template-package/promotion-manifest.json", promotion_bytes
            ),
            "sanitizationContractApprovalDecision": evidence(
                "review/sanitization-contract-approval-decision.json", decision_bytes
            ),
        }
        self.jobs: list[dict[str, object]] = []
        self.contract_rows: list[dict[str, object]] = []
        for index in range(job_count):
            self._add_job(index)
        self._write_plan_and_manifest()

    def _add_job(self, index: int) -> None:
        job_id = f"synthetic-approved-sales-folder-job-{index + 1:03d}-abcdef1234567890"
        source_relative = f"documents/source-pdfs/source-{index + 1:03d}.pdf"
        source_path = self.run_root / source_relative
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_bytes = f"synthetic source payload {index + 1}\n".encode("utf-8")
        source_path.write_bytes(source_bytes)
        source_sha = runner.sha256_bytes(source_bytes)
        geometry = {
            "format": "a4",
            "construction": "2-part-2-flaps",
            "print": "4+4",
            "spineMm": index + 1,
        }
        expected_geometry_key = (
            f"{geometry['format']}|{geometry['construction']}|{geometry['print']}|{geometry['spineMm']}mm"
        )
        finish_key = "none" if index == 0 else "matt-lamination"
        signature = {
            "expectedGeometryKey": expected_geometry_key,
            "finishKey": finish_key,
            "resolvedSourceSha256": source_sha,
        }
        signature_sha = runner.sha256_json(signature)
        contract_relative = f"documents/sanitization-contracts/{job_id}.json"
        output_relative = f"documents/sanitized-pdfs/{job_id}.pdf"
        inspection_relative = f"documents/sanitization-inspections/{job_id}.json"
        contract = {
            "kind": "wmd_sales_folder_sanitization_contract",
            "schemaVersion": 1,
            "state": runner.APPROVED_CONTRACT_STATE,
            "reviewState": runner.APPROVED_CONTRACT_STATE,
            "localOnly": True,
            "eligibleForSanitization": True,
            "eligibleForTemplateImport": False,
            "geometry": geometry,
            "finishKey": finish_key,
            "sourceEvidence": {"sha256": source_sha},
            "geometryAudit": {
                "reportSha256": runner.sha256_bytes(self.audit_bytes),
                "bindingKey": f"synthetic-binding-{index + 1}",
            },
            "geometrySupplement": None,
            "templateResolutionPlan": None,
            "verifiedBeschnittGuideDonor": None,
            "candidateIdentity": {
                "jobId": job_id,
                "safeOutputSignatureSha256": signature_sha,
            },
            "batchEvidence": {
                "geometryAudit": evidence("review/template-geometry-audit.json", self.audit_bytes),
                "approvedGeometrySupplement": None,
                "approvedTemplateResolutionPlan": None,
                "verifiedBeschnittGuideDonors": None,
            },
            "review": {
                "reviewer": "Synthetic human reviewer",
                "reviewedAt": "2026-08-31T12:00:00Z",
                "note": "Synthetic fixture only",
            },
            "prohibitedActionsPerformed": {
                "sourcePdfModified": False,
                "sourcePdfSanitized": False,
                "pdfCreated": False,
                "pdfUploaded": False,
                "databaseWritten": False,
                "supplierBankWritten": False,
                "productOrTemplateRecordWritten": False,
                "pricingWritten": False,
                "published": False,
            },
        }
        contract_bytes = write_json(self.run_root / contract_relative, contract)
        contract_row = {
            "jobId": job_id,
            "path": contract_relative,
            "sha256": runner.sha256_bytes(contract_bytes),
            "bytes": len(contract_bytes),
            "safeOutputSignatureSha256": signature_sha,
            "sourceSha256": source_sha,
            "state": runner.APPROVED_CONTRACT_STATE,
        }
        binding_key = f"https://supplier.invalid/product-{index + 1}|material-{index + 1}"
        job = {
            "jobId": job_id,
            "safeOutputSignature": signature,
            "safeOutputSignatureSha256": signature_sha,
            "geometry": {**geometry, "expectedGeometryKey": expected_geometry_key},
            "finish": {"key": finish_key},
            "source": {
                "executionIdentity": {
                    "sha256": source_sha,
                    "byteSize": len(source_bytes),
                    "localRelativePath": source_relative,
                },
            },
            "coveredBindingCount": 1,
            "coveredBindings": [{"bindingKey": binding_key}],
            "outputs": {
                "reviewedContract": contract_relative,
                "sanitizedPdf": output_relative,
                "inspection": inspection_relative,
            },
            "sanitizerArgumentsAfterAllApprovals": {
                "source": source_relative,
                "contract": contract_relative,
                "geometryAudit": "review/template-geometry-audit.json",
                "geometrySupplement": None,
                "templateResolutionPlan": None,
                "output": output_relative,
                "inspection": inspection_relative,
            },
        }
        self.jobs.append(job)
        self.contract_rows.append(contract_row)

    def _write_plan_and_manifest(self) -> None:
        plan = {
            "kind": "wmd_sales_folder_sanitization_batch_plan",
            "schemaVersion": 1,
            "state": "pending_review",
            "reviewState": "pending_review",
            "localOnly": True,
            "eligibleForSanitization": False,
            "eligibleForTemplateImport": False,
            "counts": {
                "bindings": self.job_count,
                "outputJobs": self.job_count,
                "expectedReviewedContracts": self.job_count,
                "expectedSanitizedPdfs": self.job_count,
                "expectedInspections": self.job_count,
            },
            "jobs": self.jobs,
        }
        self.plan_path = self.run_root / runner.PLAN_RELATIVE_PATH
        self.plan_bytes = write_json(self.plan_path, plan)
        manifest = {
            "kind": runner.APPROVED_CONTRACT_MANIFEST_KIND,
            "schemaVersion": 1,
            "state": runner.APPROVED_CONTRACT_STATE,
            "reviewState": runner.APPROVED_CONTRACT_STATE,
            "localOnly": True,
            "eligibleForSanitization": True,
            "eligibleForTemplateImport": False,
            "executionAuthorization": {
                "approved": True,
                "reviewer": "Synthetic batch approver",
                "reviewedAt": "2026-08-31T13:00:00Z",
                "expectedOutputCount": self.job_count,
                "allContractsApproved": True,
                "localPdfAuthoringOnly": True,
                "individualJsonEntryReviewClaimed": False,
            },
            "counts": {
                "approvedContracts": self.job_count,
                "expectedOutputCount": self.job_count,
            },
            "planEvidence": evidence(runner.PLAN_RELATIVE_PATH, self.plan_bytes),
            "sanitizerImplementation": {
                **evidence(runner.SANITIZER_RELATIVE_PATH, self.sanitizer_bytes),
                "entrypoint": "run_sanitize",
            },
            "approvalEvidence": self.approval_evidence,
            "contractFiles": self.contract_rows,
            "prohibitedActionsPerformed": {
                "sourcePdfModified": False,
                "sourcePdfSanitized": False,
                "pdfCreated": False,
                "pdfUploaded": False,
                "databaseWritten": False,
                "supplierBankWritten": False,
                "productOrTemplateRecordWritten": False,
                "pricingWritten": False,
                "published": False,
            },
        }
        manifest_directory = self.run_root / "documents/sanitization-contracts"
        self.manifest_path = manifest_directory / "manifest.json"
        self.manifest_bytes = write_json(self.manifest_path, manifest)
        (manifest_directory / "manifest.json.sha256").write_text(
            f"{runner.sha256_bytes(self.manifest_bytes)}  manifest.json\n",
            encoding="utf-8",
        )
        checksum_rows = [("manifest.json", runner.sha256_bytes(self.manifest_bytes))]
        checksum_rows.extend(
            (Path(row["path"]).name, row["sha256"]) for row in self.contract_rows
        )
        (manifest_directory / "checksums.sha256").write_text(
            "".join(f"{checksum}  {path}\n" for path, checksum in checksum_rows),
            encoding="utf-8",
        )

    def repromote_sanitizer(self, payload: bytes) -> None:
        self.sanitizer_bytes = payload
        self.sanitizer_path.write_bytes(payload)
        self._write_plan_and_manifest()

    def write_recoverable_zero_output_checkpoint(self, context: dict[str, object]) -> tuple[Path, bytes]:
        first_job_id = self.jobs[0]["jobId"]
        failure = (
            f"{first_job_id}: {runner.ZERO_OUTPUT_RECOVERABLE_FAILURE_SUFFIX}"
        )
        checkpoint_path = self.run_root / runner.BATCH_CHECKPOINT_RELATIVE_PATH
        checkpoint = runner.checkpoint_payload(
            context,
            [],
            "failed_fail_fast",
            failure,
        )
        checkpoint_bytes = write_json(checkpoint_path, checkpoint)
        return checkpoint_path, checkpoint_bytes

    def zero_output_incident(
        self,
        context: dict[str, object],
        checkpoint_bytes: bytes,
    ) -> dict[str, object]:
        return {
            "checkpointSha256": runner.sha256_bytes(checkpoint_bytes),
            "checkpointBytes": len(checkpoint_bytes),
            "planSha256": context["planSha256"],
            "contractManifestSha256": context["contractManifestSha256"],
            "sanitizerSha256": context["sanitizerSha256"],
            "expectedOutputCount": len(context["jobs"]),
            "firstJobId": self.jobs[0]["jobId"],
            "orderedJobIdentitySha256": runner.ordered_job_identity_sha256(
                context
            ),
            "failure": json.loads(checkpoint_bytes.decode("utf-8"))["failure"],
        }

    def fake_sanitizer(self, fail_job_id: str | None = None):
        def sanitize(source, output, inspection, contract_path, audit_path, supplement_path, resolution_path):
            contract = json.loads(Path(contract_path).read_text(encoding="utf-8"))
            job_id = contract["candidateIdentity"]["jobId"]
            if job_id == fail_job_id:
                raise RuntimeError("synthetic sanitizer failure")
            output = Path(output)
            inspection = Path(inspection)
            output.parent.mkdir(parents=True, exist_ok=True)
            inspection.parent.mkdir(parents=True, exist_ok=True)
            output_bytes = (
                b"synthetic-not-a-real-pdf\n"
                + runner.sha256_bytes(Path(source).read_bytes()).encode("ascii")
                + b"\n"
            )
            output.write_bytes(output_bytes)
            payload = {
                "schemaVersion": 1,
                "state": runner.BATCH_OUTPUT_STATE,
                "eligibleForTemplateImport": False,
                "eligibleForImport": False,
                "geometry": contract["geometry"],
                "finishKey": contract["finishKey"],
                "contractSha256": runner.sha256_bytes(Path(contract_path).read_bytes()),
                "geometryAuditSha256": contract["geometryAudit"]["reportSha256"],
                "geometrySupplementSha256": None,
                "templateResolutionPlanSha256": None,
                "sourceSha256": runner.sha256_bytes(Path(source).read_bytes()),
                "outputSha256": runner.sha256_bytes(output_bytes),
                "validation": {
                    "pageBoxesPreserved": True,
                    "supplierTextAndBrandingRemoved": True,
                    "metadataXmpThumbnailsAttachmentsActionsLinksAndCommentsRemoved": True,
                    "danishInformationContained": True,
                    "webprinterBluePanelPaintVerified": True,
                    "supplierGreenPaintAbsent": True,
                },
                "visualReviewPending": True,
                "designerLockedOverlayVerificationPending": True,
                "designerExportExclusionVerificationPending": True,
                "prohibitedActionsPerformed": {
                    "uploaded": False,
                    "databaseWritten": False,
                    "productOrTemplateAttached": False,
                    "published": False,
                },
            }
            write_json(inspection, payload)
            return payload

        return sanitize


class BatchRunnerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_pdf_marker_policy_caps_large_batches_and_keeps_small_batches_exact(self):
        self.assertEqual(
            runner.pdf_edit_marker_policy(1420),
            {
                "kind": "pdf_skill_edit_marker_expected_output_count_cap",
                "toolSupportedMaximum": 100,
                "requiredConfirmedCount": 100,
            },
        )
        self.assertEqual(
            runner.pdf_edit_marker_policy(99)["requiredConfirmedCount"],
            99,
        )
        for total, confirmed in (
            (1420, 99),
            (1420, 101),
            (1420, 1420),
            (99, 98),
            (99, 100),
        ):
            with self.subTest(total=total, confirmed=confirmed), self.assertRaisesRegex(
                runner.BatchSanitizationError,
                "required confirmed count",
            ):
                runner.validate_pdf_edit_marker_count(total, confirmed)
        runner.validate_pdf_edit_marker_count(1420, 100)
        runner.validate_pdf_edit_marker_count(99, 99)

    def test_zero_output_incident_pins_match_the_real_failed_checkpoint(self):
        run_root = (
            RUNNER_PATH.parents[2]
            / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
        )
        plan_path = run_root / runner.PLAN_RELATIVE_PATH
        checkpoint_path = run_root / runner.BATCH_CHECKPOINT_RELATIVE_PATH
        if not plan_path.is_file() or not checkpoint_path.is_file():
            self.skipTest("Real approved 1,420-job run evidence is not present")
        incident = runner.ZERO_OUTPUT_RECOVERY_INCIDENT
        for key in (
            "checkpointSha256",
            "planSha256",
            "contractManifestSha256",
            "sanitizerSha256",
            "orderedJobIdentitySha256",
        ):
            self.assertTrue(runner.valid_sha256(incident[key]), key)
        plan_bytes = plan_path.read_bytes()
        plan = json.loads(plan_bytes.decode("utf-8"))
        identity_context = {"jobs": [{"job": job} for job in plan["jobs"]]}
        original_context = {
            **identity_context,
            "planSha256": incident["planSha256"],
            "contractManifestSha256": incident["contractManifestSha256"],
            "sanitizerSha256": incident["sanitizerSha256"],
        }
        reconstructed_original = (
            json.dumps(
                runner.checkpoint_payload(
                    original_context,
                    [],
                    "failed_fail_fast",
                    incident["failure"],
                ),
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        ).encode("utf-8")
        self.assertEqual(
            runner.sha256_bytes(reconstructed_original),
            incident["checkpointSha256"],
        )
        self.assertEqual(len(reconstructed_original), incident["checkpointBytes"])
        self.assertEqual(runner.sha256_bytes(plan_bytes), incident["planSha256"])
        self.assertEqual(len(plan["jobs"]), incident["expectedOutputCount"])
        self.assertEqual(plan["jobs"][0]["jobId"], incident["firstJobId"])
        self.assertEqual(
            runner.ordered_job_identity_sha256(identity_context),
            incident["orderedJobIdentitySha256"],
        )
        self.assertEqual(
            incident["failure"],
            f"{incident['firstJobId']}: {runner.ZERO_OUTPUT_RECOVERABLE_FAILURE_SUFFIX}",
        )
        live_checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        if "zeroOutputCheckpointAmendment" in live_checkpoint:
            original = live_checkpoint["zeroOutputCheckpointAmendment"][
                "originalCheckpoint"
            ]
            self.assertEqual(
                original,
                {
                    "sha256": incident["checkpointSha256"],
                    "bytes": incident["checkpointBytes"],
                },
            )
        elif live_checkpoint.get("state") == "failed_fail_fast":
            self.assertEqual(checkpoint_path.read_bytes(), reconstructed_original)
        elif live_checkpoint.get("state") == "complete":
            manifest_path = run_root / runner.BATCH_MANIFEST_RELATIVE_PATH
            self.assertTrue(manifest_path.is_file())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(
                live_checkpoint["expectedOutputCount"],
                incident["expectedOutputCount"],
            )
            self.assertEqual(
                live_checkpoint["completedOutputCount"],
                incident["expectedOutputCount"],
            )
            self.assertIsNone(live_checkpoint["failure"])
            self.assertEqual(
                live_checkpoint["planSha256"],
                manifest["inputEvidence"]["sanitizationProposalPlan"]["sha256"],
            )
            self.assertEqual(
                live_checkpoint["contractManifestSha256"],
                manifest["inputEvidence"]["approvedContractManifest"]["sha256"],
            )
            self.assertEqual(
                live_checkpoint["sanitizerSha256"],
                manifest["inputEvidence"]["sanitizerImplementation"]["sha256"],
            )
            self.assertEqual(
                manifest["counts"]["sanitizedPdfs"],
                incident["expectedOutputCount"],
            )
            self.assertEqual(
                manifest["counts"]["inspections"],
                incident["expectedOutputCount"],
            )
            self.assertEqual(
                manifest["counts"]["jobs"],
                incident["expectedOutputCount"],
            )
        else:
            self.fail(
                "Real batch checkpoint has an unexpected state: "
                f"{live_checkpoint.get('state')!r}"
            )

    def test_preflight_is_read_only_and_checks_exact_approved_set(self):
        fixture = SyntheticApprovedBatch(self.directory)
        before = sorted(
            path.relative_to(fixture.repository).as_posix()
            for path in fixture.repository.rglob("*") if path.is_file()
        )

        context = runner.preflight(
            fixture.run_root,
            fixture.repository,
            expected_job_count=2,
        )

        after = sorted(
            path.relative_to(fixture.repository).as_posix()
            for path in fixture.repository.rglob("*") if path.is_file()
        )
        self.assertEqual(before, after)
        self.assertEqual(len(context["jobs"]), 2)
        self.assertEqual(
            fixture.jobs[0]["source"]["executionIdentity"]["localRelativePath"],
            fixture.jobs[0]["sanitizerArgumentsAfterAllApprovals"]["source"],
        )
        self.assertFalse((fixture.run_root / runner.BATCH_DIRECTORY_RELATIVE_PATH).exists())
        with self.assertRaisesRegex(
            runner.BatchSanitizationError, "schema is invalid"
        ):
            runner.false_mutation_record(
                {"uploaded": False},
                "incomplete runner mutation record",
                runner.RUNNER_PROHIBITED_ACTION_KEYS,
            )

    def test_preflight_rejects_repo_prefixed_or_escaping_source_identity(self):
        repo_prefixed = SyntheticApprovedBatch(self.directory / "repo-prefixed")
        source_relative = repo_prefixed.jobs[0][
            "sanitizerArgumentsAfterAllApprovals"
        ]["source"]
        run_prefix = repo_prefixed.run_root.relative_to(
            repo_prefixed.repository
        ).as_posix()
        repo_prefixed.jobs[0]["source"]["executionIdentity"][
            "localRelativePath"
        ] = f"{run_prefix}/{source_relative}"
        repo_prefixed._write_plan_and_manifest()
        with self.assertRaisesRegex(
            runner.BatchSanitizationError,
            "Source PDF localRelativePath is not exact",
        ):
            runner.preflight(
                repo_prefixed.run_root,
                repo_prefixed.repository,
                expected_job_count=2,
            )

        escaping = SyntheticApprovedBatch(self.directory / "escaping")
        escaping.jobs[0]["sanitizerArgumentsAfterAllApprovals"]["source"] = (
            "../outside.pdf"
        )
        escaping.jobs[0]["source"]["executionIdentity"]["localRelativePath"] = (
            "../outside.pdf"
        )
        escaping._write_plan_and_manifest()
        with self.assertRaisesRegex(
            runner.BatchSanitizationError,
            "not a normalized relative POSIX path",
        ):
            runner.preflight(
                escaping.run_root,
                escaping.repository,
                expected_job_count=2,
            )

    def test_execute_writes_only_local_outputs_inspections_checkpoint_and_checksummed_manifest(self):
        fixture = SyntheticApprovedBatch(self.directory)
        context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )

        manifest = runner.run_batch(
            context,
            resume=False,
            marker_confirmed_count=2,
            sanitizer_callable=fixture.fake_sanitizer(),
        )

        self.assertEqual(manifest["kind"], runner.BATCH_MANIFEST_KIND)
        self.assertEqual(manifest["state"], runner.BATCH_OUTPUT_STATE)
        self.assertEqual(manifest["counts"]["jobs"], 2)
        self.assertEqual(len(manifest["jobs"]), 2)
        self.assertTrue(manifest["visualReviewPending"])
        self.assertFalse(manifest["eligibleForImport"])
        batch_directory = fixture.run_root / runner.BATCH_DIRECTORY_RELATIVE_PATH
        manifest_bytes = (batch_directory / "manifest.json").read_bytes()
        manifest_sha = runner.sha256_bytes(manifest_bytes)
        self.assertEqual(
            (batch_directory / "manifest.json.sha256").read_text(encoding="utf-8"),
            f"{manifest_sha}  manifest.json\n",
        )
        checksums = runner.parse_checksum_file(
            (batch_directory / "checksums.sha256").read_bytes(), "test checksums"
        )
        self.assertEqual(len(checksums), 5)
        self.assertEqual(checksums[runner.BATCH_MANIFEST_RELATIVE_PATH], manifest_sha)
        checkpoint = json.loads((batch_directory / "checkpoint.json").read_text(encoding="utf-8"))
        self.assertEqual(checkpoint["state"], "complete")
        self.assertEqual(checkpoint["completedOutputCount"], 2)
        authorization = checkpoint["artifactOperationAuthorization"]
        self.assertEqual(authorization["authorizedTotalOutputCount"], 2)
        self.assertEqual(
            authorization["markerPolicy"],
            {
                "kind": "pdf_skill_edit_marker_expected_output_count_cap",
                "toolSupportedMaximum": 100,
                "requiredConfirmedCount": 2,
            },
        )
        self.assertEqual(
            manifest["artifactOperationAuthorization"], authorization
        )
        self.assertTrue(all(value is False for value in manifest["prohibitedActionsPerformed"].values()))

    def test_real_runner_path_reuses_one_content_addressed_validation_cache(self):
        fixture = SyntheticApprovedBatch(self.directory)
        context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )
        seen_caches: list[object] = []
        fake_sanitize = fixture.fake_sanitizer()

        class FakeCache:
            pass

        class FakeModule:
            BatchValidationCache = FakeCache

            @staticmethod
            def run_sanitize(*args, validation_cache=None):
                self.assertIsInstance(validation_cache, FakeCache)
                seen_caches.append(validation_cache)
                return fake_sanitize(*args)

        with mock.patch.object(runner, "load_sanitizer", return_value=FakeModule):
            runner.run_batch(
                context,
                resume=False,
                marker_confirmed_count=2,
            )
        self.assertEqual(len(seen_caches), 2)
        self.assertIs(seen_caches[0], seen_caches[1])

    def test_fail_fast_then_resume_is_deterministic(self):
        fixture = SyntheticApprovedBatch(self.directory / "resumed")
        context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )
        second_id = fixture.jobs[1]["jobId"]
        with self.assertRaisesRegex(runner.BatchSanitizationError, "failed fast"):
            runner.run_batch(
                context,
                resume=False,
                marker_confirmed_count=2,
                sanitizer_callable=fixture.fake_sanitizer(second_id),
            )
        first_output = fixture.run_root / fixture.jobs[0]["outputs"]["sanitizedPdf"]
        second_output = fixture.run_root / fixture.jobs[1]["outputs"]["sanitizedPdf"]
        self.assertTrue(first_output.is_file())
        self.assertFalse(second_output.exists())
        failed_checkpoint = json.loads(
            (fixture.run_root / runner.BATCH_CHECKPOINT_RELATIVE_PATH).read_text(encoding="utf-8")
        )
        self.assertEqual(failed_checkpoint["state"], "failed_fail_fast")
        self.assertEqual(failed_checkpoint["completedOutputCount"], 1)

        resumed_context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )
        runner.run_batch(
            resumed_context,
            resume=True,
            marker_confirmed_count=2,
            sanitizer_callable=fixture.fake_sanitizer(),
        )
        resumed_manifest = (
            fixture.run_root / runner.BATCH_MANIFEST_RELATIVE_PATH
        ).read_bytes()

        uninterrupted = SyntheticApprovedBatch(self.directory / "uninterrupted")
        uninterrupted_context = runner.preflight(
            uninterrupted.run_root, uninterrupted.repository, expected_job_count=2
        )
        runner.run_batch(
            uninterrupted_context,
            resume=False,
            marker_confirmed_count=2,
            sanitizer_callable=uninterrupted.fake_sanitizer(),
        )
        uninterrupted_manifest = (
            uninterrupted.run_root / runner.BATCH_MANIFEST_RELATIVE_PATH
        ).read_bytes()
        self.assertEqual(resumed_manifest, uninterrupted_manifest)

    def test_zero_output_amendment_adopts_exact_pins_once_and_survives_resume(self):
        fixture = SyntheticApprovedBatch(self.directory / "zero-output")
        old_context = runner.preflight(
            fixture.run_root,
            fixture.repository,
            expected_job_count=2,
        )
        checkpoint_path, checkpoint_bytes = (
            fixture.write_recoverable_zero_output_checkpoint(old_context)
        )
        old_authorization = json.loads(
            checkpoint_bytes.decode("utf-8")
        )["artifactOperationAuthorization"]
        fixture.repromote_sanitizer(
            b"def run_sanitize(*args):\n    raise RuntimeError('approved corrected sanitizer')\n"
        )
        new_context = runner.preflight(
            fixture.run_root,
            fixture.repository,
            expected_job_count=2,
        )

        incident = fixture.zero_output_incident(old_context, checkpoint_bytes)
        with mock.patch.object(runner, "ZERO_OUTPUT_RECOVERY_INCIDENT", incident):
            amended = runner.amend_zero_output_checkpoint(
                new_context,
                expected_checkpoint_sha256=runner.sha256_bytes(checkpoint_bytes),
                expected_adopted_contract_manifest_sha256=new_context[
                    "contractManifestSha256"
                ],
                expected_adopted_sanitizer_sha256=new_context["sanitizerSha256"],
            )

        amendment = amended["zeroOutputCheckpointAmendment"]
        self.assertEqual(amended["state"], "failed_fail_fast_zero_output_amended")
        self.assertEqual(
            amended["artifactOperationAuthorization"],
            old_authorization,
        )
        self.assertEqual(
            amendment["superseded"]["contractManifestSha256"],
            old_context["contractManifestSha256"],
        )
        self.assertEqual(
            amendment["adopted"]["contractManifestSha256"],
            new_context["contractManifestSha256"],
        )
        self.assertEqual(
            amendment["unchangedBatchIdentity"][
                "orderedJobIdAndSafeOutputSignatureSha256"
            ],
            runner.ordered_job_identity_sha256(new_context),
        )
        self.assertEqual(list((fixture.run_root / "documents/sanitized-pdfs").glob("*")), [])
        self.assertEqual(list((fixture.run_root / "documents/sanitization-inspections").glob("*")), [])

        tampered = copy.deepcopy(amended)
        tampered["zeroOutputCheckpointAmendment"]["originalCheckpoint"][
            "bytes"
        ] += 1
        write_json(checkpoint_path, tampered)
        with mock.patch.object(
            runner,
            "ZERO_OUTPUT_RECOVERY_INCIDENT",
            incident,
        ), self.assertRaisesRegex(
            runner.BatchSanitizationError,
            "amendment evidence is invalid",
        ):
            runner.validate_resume_checkpoint(checkpoint_path, new_context)
        write_json(checkpoint_path, amended)

        with mock.patch.object(runner, "ZERO_OUTPUT_RECOVERY_INCIDENT", incident):
            with self.assertRaisesRegex(
                runner.BatchSanitizationError,
                "second amendment is forbidden",
            ):
                runner.amend_zero_output_checkpoint(
                    new_context,
                    expected_checkpoint_sha256=runner.sha256_bytes(
                        checkpoint_path.read_bytes()
                    ),
                    expected_adopted_contract_manifest_sha256=new_context[
                        "contractManifestSha256"
                    ],
                    expected_adopted_sanitizer_sha256=new_context["sanitizerSha256"],
                )

            manifest = runner.run_batch(
                new_context,
                resume=True,
                marker_confirmed_count=2,
                sanitizer_callable=fixture.fake_sanitizer(),
            )
        completed_checkpoint = json.loads(
            checkpoint_path.read_text(encoding="utf-8")
        )
        self.assertEqual(
            completed_checkpoint["zeroOutputCheckpointAmendment"], amendment
        )
        self.assertEqual(manifest["zeroOutputCheckpointAmendment"], amendment)
        self.assertEqual(
            manifest["artifactOperationAuthorization"], old_authorization
        )

    def test_zero_output_amendment_refuses_completed_or_hidden_output_evidence(self):
        for scenario in ("completed", "hidden-output", "final-artifact"):
            with self.subTest(scenario=scenario):
                fixture = SyntheticApprovedBatch(self.directory / scenario)
                old_context = runner.preflight(
                    fixture.run_root,
                    fixture.repository,
                    expected_job_count=2,
                )
                checkpoint_path, checkpoint_bytes = (
                    fixture.write_recoverable_zero_output_checkpoint(old_context)
                )
                if scenario == "completed":
                    checkpoint = json.loads(checkpoint_bytes.decode("utf-8"))
                    checkpoint["completedOutputCount"] = 1
                    checkpoint["completedJobs"] = [fixture.jobs[0]["jobId"]]
                    checkpoint_bytes = write_json(checkpoint_path, checkpoint)
                elif scenario == "hidden-output":
                    hidden = fixture.run_root / "documents/sanitized-pdfs/.partial"
                    hidden.parent.mkdir(parents=True, exist_ok=True)
                    hidden.write_bytes(b"partial")
                else:
                    final_artifact = fixture.run_root / runner.BATCH_MANIFEST_RELATIVE_PATH
                    final_artifact.parent.mkdir(parents=True, exist_ok=True)
                    final_artifact.write_bytes(b"stale")
                fixture.repromote_sanitizer(
                    b"def run_sanitize(*args):\n    raise RuntimeError('approved v2')\n"
                )
                new_context = runner.preflight(
                    fixture.run_root,
                    fixture.repository,
                    expected_job_count=2,
                )
                before = checkpoint_path.read_bytes()
                incident = fixture.zero_output_incident(
                    old_context,
                    checkpoint_bytes,
                )
                with mock.patch.object(
                    runner,
                    "ZERO_OUTPUT_RECOVERY_INCIDENT",
                    incident,
                ), self.assertRaises(runner.BatchSanitizationError):
                    runner.amend_zero_output_checkpoint(
                        new_context,
                        expected_checkpoint_sha256=runner.sha256_bytes(
                            checkpoint_bytes
                        ),
                        expected_adopted_contract_manifest_sha256=new_context[
                            "contractManifestSha256"
                        ],
                        expected_adopted_sanitizer_sha256=new_context[
                            "sanitizerSha256"
                        ],
                    )
                self.assertEqual(checkpoint_path.read_bytes(), before)

    def test_zero_output_amendment_rejects_tampered_checkpoint_and_adopted_pins(self):
        fixture = SyntheticApprovedBatch(self.directory / "pin-tamper")
        old_context = runner.preflight(
            fixture.run_root,
            fixture.repository,
            expected_job_count=2,
        )
        checkpoint_path, checkpoint_bytes = (
            fixture.write_recoverable_zero_output_checkpoint(old_context)
        )
        fixture.repromote_sanitizer(
            b"def run_sanitize(*args):\n    raise RuntimeError('approved v2')\n"
        )
        new_context = runner.preflight(
            fixture.run_root,
            fixture.repository,
            expected_job_count=2,
        )
        before = checkpoint_path.read_bytes()
        incident = fixture.zero_output_incident(old_context, checkpoint_bytes)
        cases = (
            ("0" * 64, new_context["contractManifestSha256"], new_context["sanitizerSha256"]),
            (runner.sha256_bytes(checkpoint_bytes), "0" * 64, new_context["sanitizerSha256"]),
            (runner.sha256_bytes(checkpoint_bytes), new_context["contractManifestSha256"], "0" * 64),
        )
        for checkpoint_sha, manifest_sha, sanitizer_sha in cases:
            with self.subTest(
                checkpoint_sha=checkpoint_sha,
                manifest_sha=manifest_sha,
                sanitizer_sha=sanitizer_sha,
            ), mock.patch.object(
                runner,
                "ZERO_OUTPUT_RECOVERY_INCIDENT",
                incident,
            ), self.assertRaises(runner.BatchSanitizationError):
                runner.amend_zero_output_checkpoint(
                    new_context,
                    expected_checkpoint_sha256=checkpoint_sha,
                    expected_adopted_contract_manifest_sha256=manifest_sha,
                    expected_adopted_sanitizer_sha256=sanitizer_sha,
                )
            self.assertEqual(checkpoint_path.read_bytes(), before)

    def test_tampered_input_and_wrong_marker_count_refuse_before_authoring(self):
        fixture = SyntheticApprovedBatch(self.directory)
        context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )
        with self.assertRaisesRegex(runner.BatchSanitizationError, "required confirmed count"):
            runner.run_batch(
                context,
                resume=False,
                marker_confirmed_count=1,
                sanitizer_callable=fixture.fake_sanitizer(),
            )
        self.assertFalse(
            (fixture.run_root / fixture.jobs[0]["outputs"]["sanitizedPdf"]).exists()
        )
        source = fixture.run_root / fixture.jobs[0]["sanitizerArgumentsAfterAllApprovals"]["source"]
        source.write_bytes(source.read_bytes() + b"tamper")
        with self.assertRaisesRegex(runner.BatchSanitizationError, "Input changed during batch execution"):
            runner.run_batch(
                context,
                resume=False,
                marker_confirmed_count=2,
                sanitizer_callable=fixture.fake_sanitizer(),
            )

    def test_finalization_rehashes_early_outputs_after_the_last_job(self):
        fixture = SyntheticApprovedBatch(self.directory)
        context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )
        base_sanitizer = fixture.fake_sanitizer()
        call_count = 0

        def tampering_sanitizer(*args):
            nonlocal call_count
            call_count += 1
            result = base_sanitizer(*args)
            if call_count == 2:
                first_output = (
                    fixture.run_root / fixture.jobs[0]["outputs"]["sanitizedPdf"]
                )
                first_output.write_bytes(first_output.read_bytes() + b"late tamper")
            return result

        with self.assertRaisesRegex(
            runner.BatchSanitizationError, "identity is invalid"
        ):
            runner.run_batch(
                context,
                resume=False,
                marker_confirmed_count=2,
                sanitizer_callable=tampering_sanitizer,
            )
        self.assertFalse(
            (fixture.run_root / runner.BATCH_MANIFEST_RELATIVE_PATH).exists()
        )

    def test_resume_rejects_orphan_and_tampered_inspection(self):
        fixture = SyntheticApprovedBatch(self.directory)
        context = runner.preflight(
            fixture.run_root, fixture.repository, expected_job_count=2
        )
        first = context["jobs"][0]
        first["outputPath"].parent.mkdir(parents=True, exist_ok=True)
        first["outputPath"].write_bytes(b"orphan")
        with self.assertRaisesRegex(runner.BatchSanitizationError, "orphaned PDF/inspection"):
            runner.run_batch(
                context,
                resume=True,
                marker_confirmed_count=2,
                sanitizer_callable=fixture.fake_sanitizer(),
            )

        first["outputPath"].unlink()
        fixture.fake_sanitizer()(
            first["sourcePath"],
            first["outputPath"],
            first["inspectionPath"],
            first["contractPath"],
            first["geometryAuditPath"],
            None,
            None,
        )
        inspection = json.loads(first["inspectionPath"].read_text(encoding="utf-8"))
        inspection["outputSha256"] = "0" * 64
        write_json(first["inspectionPath"], inspection)
        with self.assertRaisesRegex(runner.BatchSanitizationError, "identity is invalid"):
            runner.run_batch(
                context,
                resume=True,
                marker_confirmed_count=2,
                sanitizer_callable=fixture.fake_sanitizer(),
            )

    def test_pending_or_partial_contract_manifest_cannot_authorize(self):
        fixture = SyntheticApprovedBatch(self.directory)
        manifest = json.loads(fixture.manifest_path.read_text(encoding="utf-8"))
        manifest["executionAuthorization"]["allContractsApproved"] = False
        manifest_bytes = write_json(fixture.manifest_path, manifest)
        fixture.manifest_path.with_name("manifest.json.sha256").write_text(
            f"{runner.sha256_bytes(manifest_bytes)}  manifest.json\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(runner.BatchSanitizationError, "authorization is incomplete"):
            runner.preflight(
                fixture.run_root, fixture.repository, expected_job_count=2
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
