from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


TEST_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = TEST_DIRECTORY.parent.parent.parent
SCRIPT_PATH = (
    REPOSITORY_ROOT
    / "scripts/product-import/build_wmd_sales_folder_sanitization_contract_candidates.py"
)
RUN_DIRECTORY = (
    REPOSITORY_ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
)
SANITIZER_PATH = (
    REPOSITORY_ROOT
    / "scripts/product-templates/sanitize_wmd_sales_folder_template.py"
)


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


candidates = load_module(SCRIPT_PATH, "wmd_candidate_batch_test_subject")


class CandidateBatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.plan, cls.plan_evidence = candidates.read_json_artifact(
            RUN_DIRECTORY,
            candidates.PLAN_RELATIVE_PATH,
            "Template-sanitization plan",
        )
        candidates.validate_plan(cls.plan)
        candidates.validate_evidence_files(
            RUN_DIRECTORY, cls.plan, cls.plan_evidence
        )
        sanitizer_bytes = candidates.read_regular_bytes(
            SANITIZER_PATH, "Sanitizer implementation"
        )
        cls.sanitizer_evidence = {
            "path": str(candidates.SANITIZER_RELATIVE_PATH),
            "sha256": candidates.sha256_bytes(sanitizer_bytes),
            "bytes": len(sanitizer_bytes),
            "entrypoint": "describe_source",
        }
        cls.request_set = candidates.build_request_set(
            RUN_DIRECTORY,
            cls.plan,
            cls.plan_evidence,
            cls.sanitizer_evidence,
        )

    def test_request_set_has_1420_exact_unapproved_safe_signature_jobs(self) -> None:
        request_set = self.request_set
        self.assertEqual(
            request_set["state"], "candidate_requires_human_review"
        )
        self.assertEqual(
            request_set["reviewState"], "candidate_requires_human_review"
        )
        self.assertFalse(request_set["eligibleForSanitization"])
        self.assertFalse(request_set["eligibleForTemplateImport"])
        self.assertEqual(request_set["counts"]["requests"], 1420)
        self.assertEqual(
            request_set["counts"]["distinctSafeOutputSignatures"], 1420
        )
        self.assertEqual(
            request_set["counts"]["sourceGeometryDescribeComputations"], 285
        )
        self.assertEqual(request_set["counts"]["coveredBindings"], 3692)
        self.assertEqual(request_set["counts"]["threePanelRequests"], 240)
        self.assertTrue(
            request_set["deduplicationPolicy"][
                "sourceOrPayloadDeduplicationForbidden"
            ]
        )
        requests = request_set["requests"]
        self.assertEqual(len({item["jobId"] for item in requests}), 1420)
        self.assertEqual(
            len({item["safeOutputSignatureSha256"] for item in requests}),
            1420,
        )
        self.assertTrue(
            all(
                item["candidatePath"].startswith(
                    "documents/sanitization-contract-candidates/"
                )
                for item in requests
            )
        )
        self.assertFalse(
            any(
                "documents/sanitization-contracts/" in item["candidatePath"]
                for item in requests
            )
        )
        self.assertFalse(
            any(
                candidates.CD_MODEL_PATTERN.search(
                    candidates.canonical_json(
                        {
                            "jobId": item["jobId"],
                            "signature": item["safeOutputSignature"],
                            "geometry": item["geometry"],
                            "source": item["source"],
                        }
                    )
                )
                for item in requests
            )
        )

    def test_every_request_pins_plan_source_audit_supplement_and_resolution(self) -> None:
        for request in self.request_set["requests"]:
            evidence = request["evidence"]
            self.assertEqual(
                evidence["sanitizationPlan"]["sha256"],
                self.plan_evidence["sha256"],
            )
            for key in (
                "geometryAudit",
                "geometrySupplement",
                "templateResolutionPlan",
                "templateProjectionStubs",
                "documentInventory",
            ):
                self.assertEqual(
                    evidence[key]["sha256"],
                    self.plan["inputEvidence"][key]["sha256"],
                )
            self.assertEqual(
                evidence["jobGeometryAuditBinding"]["reportSha256"],
                self.plan["inputEvidence"]["geometryAudit"]["sha256"],
            )
            self.assertEqual(
                evidence["jobTemplateResolutionBinding"]["reportSha256"],
                self.plan["inputEvidence"]["templateResolutionPlan"][
                    "sha256"
                ],
            )
            self.assertEqual(
                request["source"]["sha256"],
                request["safeOutputSignature"]["resolvedSourceSha256"],
            )

    def test_layer_proposals_are_explicit_and_never_promote_contract_fields(self) -> None:
        proposals = candidates.build_layer_proposals(
            [
                "Abheftvorrichtung",
                "Artwork",
                "Beschnitt Seite",
                "CD-Tasche",
                "Info Seite",
                "Logo",
                "Rillen",
                "Schneiden",
            ]
        )
        by_name = {item["sourceName"]: item for item in proposals}
        self.assertEqual(
            by_name["CD-Tasche"],
            {
                "sourceName": "CD-Tasche",
                "status": "proposal_requires_human_review",
                "proposedAction": "remove",
                "proposedRole": "unused-accessory",
                "proposedOutputNameDa": None,
                "basis": "Exact produktejerbeslutning; kun laget CD-Tasche må bruge rollen unused-accessory.",
            },
        )
        self.assertEqual(by_name["Rillen"]["proposedAction"], "preserve")
        self.assertEqual(by_name["Rillen"]["proposedRole"], "fold")
        self.assertEqual(by_name["Rillen"]["proposedOutputNameDa"], "Falselinjer")
        self.assertEqual(by_name["Schneiden"]["proposedRole"], "cut")
        self.assertEqual(
            by_name["Beschnitt Seite"]["proposedRole"], "bleed-and-safety"
        )
        self.assertEqual(
            by_name["Info Seite"]["proposedRole"], "supplier-information"
        )
        self.assertEqual(by_name["Logo"]["proposedRole"], "supplier-branding")
        self.assertEqual(by_name["Artwork"]["status"], "human_classification_required")
        self.assertIsNone(by_name["Artwork"]["proposedAction"])

    def test_one_real_describe_candidate_remains_unapproved_and_pins_policies(self) -> None:
        sanitizer = candidates.load_sanitizer_module(SANITIZER_PATH.resolve())
        request = self.request_set["requests"][0]
        candidate = candidates.build_candidate(
            request, RUN_DIRECTORY, sanitizer, {}
        )
        candidates.validate_candidate(candidate, request)
        self.assertEqual(
            candidate["reviewState"], "candidate_requires_human_review"
        )
        self.assertNotIn("approval", candidate)
        self.assertEqual(candidate["review"]["reviewer"], "")
        self.assertEqual(candidate["review"]["reviewedAt"], "")
        self.assertFalse(candidate["candidateGate"]["sanitizationAllowed"])
        self.assertTrue(
            candidate["candidateGate"][
                "directDescribeContractFieldsRemainReviewRequired"
            ]
        )
        self.assertTrue(
            all(
                item["action"] == "REVIEW_REQUIRED"
                for item in candidate["layers"]
            )
        )
        visual = candidate["unapprovedPolicyProposals"]["visualPolicy"]
        self.assertEqual(visual["addedInformationPanelFill"], "#0EA5E9")
        self.assertEqual(visual["addedInformationPanelBorder"], "#0284C7")
        self.assertEqual(visual["noPrintOrHiddenAreaFill"], "#D1D5DB")
        text_boxes = candidate["unapprovedPolicyProposals"]["textBoxPolicy"]
        self.assertTrue(
            text_boxes["horizontalAndVerticalContainmentMustBeVerified"]
        )
        self.assertTrue(text_boxes["overflowBlocksSanitization"])

    def test_validator_refuses_approval_or_reviewer_invention(self) -> None:
        sanitizer = candidates.load_sanitizer_module(SANITIZER_PATH.resolve())
        request = self.request_set["requests"][0]
        candidate = candidates.build_candidate(
            request, RUN_DIRECTORY, sanitizer, {}
        )
        approved = copy.deepcopy(candidate)
        approved["approval"] = {"approved": True}
        with self.assertRaisesRegex(
            candidates.CandidateBuildError, "approval record"
        ):
            candidates.validate_candidate(approved, request)
        reviewed = copy.deepcopy(candidate)
        reviewed["review"]["reviewer"] = "Robot"
        with self.assertRaisesRegex(
            candidates.CandidateBuildError, "reviewer identity or time"
        ):
            candidates.validate_candidate(reviewed, request)

    def test_pending_plan_drift_is_refused(self) -> None:
        drifted = copy.deepcopy(self.plan)
        drifted["approval"]["approved"] = True
        with self.assertRaisesRegex(
            candidates.CandidateBuildError,
            "approval identity or hashes",
        ):
            candidates.validate_plan(drifted)

    def test_existing_execution_output_blocks_candidate_generation(self) -> None:
        minimal = copy.deepcopy(self.plan)
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            output = minimal["jobs"][0]["outputs"]["reviewedContract"]
            output_path = run / output
            output_path.parent.mkdir(parents=True)
            output_path.write_text("{}\n", encoding="utf-8")
            minimal["jobs"] = [minimal["jobs"][0]]
            with self.assertRaisesRegex(
                candidates.CandidateBuildError, "already exists"
            ):
                candidates.assert_execution_outputs_absent(run, minimal)


if __name__ == "__main__":
    unittest.main()
