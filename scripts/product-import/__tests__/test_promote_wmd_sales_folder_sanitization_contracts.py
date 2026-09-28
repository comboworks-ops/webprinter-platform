from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path


TEST_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = TEST_DIRECTORY.parent.parent.parent
SCRIPT_PATH = (
    REPOSITORY_ROOT
    / "scripts/product-import/promote_wmd_sales_folder_sanitization_contracts.py"
)
RUN_DIRECTORY = (
    REPOSITORY_ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
)


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


promoter = load_module(SCRIPT_PATH, "wmd_contract_promoter_test_subject")


class ContractPromoterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.context = promoter.build_context(RUN_DIRECTORY)
        cls.request = promoter.build_approval_request(cls.context)
        cls.request_bytes = promoter.pretty_json_bytes(cls.request)
        cls.request_evidence = {
            "path": str(promoter.APPROVAL_REQUEST_RELATIVE_PATH),
            "sha256": promoter.sha256_bytes(cls.request_bytes),
            "bytes": len(cls.request_bytes),
        }
        cls.decision = promoter.build_user_authorized_decision(
            cls.context, cls.request, cls.request_evidence
        )
        cls.decision_bytes = promoter.pretty_json_bytes(cls.decision)
        cls.decision_evidence = {
            "path": str(promoter.APPROVAL_DECISION_RELATIVE_PATH),
            "sha256": promoter.sha256_bytes(cls.decision_bytes),
            "bytes": len(cls.decision_bytes),
        }

    def test_exact_full_batch_and_profile_coverage(self) -> None:
        context = self.context
        self.assertEqual(len(context["jobRows"]), 1420)
        self.assertEqual(len(context["profiles"]), 285)
        self.assertEqual(
            len({item["safeOutputSignatureSha256"] for item in context["jobRows"]}),
            1420,
        )
        modes = [
            item["informationPanel"]["derivationMode"]
            for item in context["profiles"]
        ]
        self.assertEqual(modes.count("exact_source_green_rectangle"), 174)
        self.assertEqual(
            modes.count("source_centered_minimum_containment_expansion"), 111
        )
        self.assertEqual(
            sum(bool(item["noPrintPolicy"]["convertedAreas"]) for item in context["profiles"]),
            140,
        )
        self.assertEqual(
            sum(bool(item["noPrintPolicy"]["generatedBackgrounds"]) for item in context["profiles"]),
            4,
        )
        donor_rows = [
            row
            for row in context["jobRows"]
            if row["guideDonorEntrySha256"] is not None
        ]
        self.assertEqual(len(context["guideDonors"]["report"]["entries"]), 5)
        self.assertEqual(len(donor_rows), 5)
        self.assertEqual(
            {row["sourceSha256"] for row in donor_rows},
            {
                entry["source"]["sha256"]
                for entry in context["guideDonors"]["report"]["entries"]
            },
        )

    def test_bulk_decision_is_truthful_and_exact(self) -> None:
        decision = self.decision
        self.assertEqual(
            decision["reviewState"],
            "complete_user_directed_policy_authorization",
        )
        self.assertFalse(
            decision["bulkAuthorization"]["individualJsonEntryReviewClaimed"]
        )
        self.assertTrue(
            decision["bulkAuthorization"]["downstreamSanitizedPdfOutputQaRequired"]
        )
        self.assertFalse(decision["humanAttestation"]["confirmed"])
        self.assertEqual(
            decision["approvalScopeSha256"],
            promoter.sha256_json(decision["approvalScope"]),
        )
        promoter.validate_request_and_decision(
            self.context,
            self.request,
            self.request_evidence,
            decision,
        )
        drifted = copy.deepcopy(decision)
        drifted["bulkAuthorization"]["individualJsonEntryReviewClaimed"] = True
        with self.assertRaisesRegex(
            promoter.ContractPromotionError, "stale or not exact"
        ):
            promoter.validate_request_and_decision(
                self.context,
                self.request,
                self.request_evidence,
                drifted,
            )

    def test_information_panel_is_source_anchored_and_contained(self) -> None:
        for profile in self.context["profiles"]:
            panel = profile["informationPanel"]
            self.assertEqual(panel["sourceLayer"], "Info Seite")
            self.assertEqual(panel["sourceOperator"], "k")
            self.assertEqual(panel["sourceOperands"], [0.33, 0.03, 0.9, 0.0])
            self.assertEqual(panel["fillHex"], "#0EA5E9")
            self.assertEqual(panel["borderHex"], "#0284C7")
            self.assertGreaterEqual(panel["rectPt"][2], 180)
            self.assertGreaterEqual(panel["rectPt"][3], 105)
            self.assertTrue(panel["textContainmentRequired"])

    def test_no_print_derivation_never_fabricates_a_source_conversion(self) -> None:
        converted = [
            item for item in self.context["profiles"]
            if item["noPrintPolicy"]["convertedAreas"]
        ]
        generated = [
            item for item in self.context["profiles"]
            if item["noPrintPolicy"]["generatedBackgrounds"]
        ]
        self.assertTrue(
            all(
                item["noPrintPolicy"]["derivation"]["mode"]
                == "exact_source_red_or_pink_full_page_path"
                and item["noPrintPolicy"]["convertedAreas"][0]["replacementHex"]
                == "#D1D5DB"
                for item in converted
            )
        )
        self.assertTrue(
            all(
                not item["noPrintPolicy"]["convertedAreas"]
                and item["noPrintPolicy"]["derivation"]["mode"]
                == "exact_source_statement_and_page_2_mediabox"
                and item["noPrintPolicy"]["generatedBackgrounds"][0]["sourcePattern"]
                == self.context["sanitizer"].GENERATED_NO_PRINT_SOURCE_PATTERN
                for item in generated
            )
        )

    def test_unknown_or_placeholder_layer_mapping_is_refused(self) -> None:
        candidate = copy.deepcopy(
            self.context["candidates"][self.context["jobRows"][0]["jobId"]]["value"]
        )
        candidate["unapprovedLayerProposals"][0]["status"] = (
            "human_classification_required"
        )
        candidate["unapprovedLayerProposals"][0]["proposedAction"] = None
        with self.assertRaisesRegex(
            promoter.ContractPromotionError,
            "differ from deterministic mapping|Unknown or placeholder",
        ):
            promoter.layer_policies_from_candidate(
                candidate,
                promoter.load_module(
                    (
                        REPOSITORY_ROOT
                        / Path(*promoter.CANDIDATE_BUILDER_RELATIVE_PATH.parts)
                    ).resolve(),
                    "wmd_contract_promoter_bad_layer_fixture",
                ),
            )

    def test_one_real_contract_passes_current_sanitizer_without_authoring_pdf(self) -> None:
        row = next(
            item
            for item in self.context["jobRows"]
            if item["resolutionClassification"] == "base_verified"
        )
        contract = promoter.build_contract(
            self.context,
            row,
            self.decision,
            self.request_evidence,
            self.decision_evidence,
        )
        source = promoter.run_path(
            RUN_DIRECTORY,
            promoter.safe_relative_path(row["sourcePath"], "Test source"),
            "Test source",
        )
        sanitizer = self.context["sanitizer"]
        sanitizer.validate_contract(
            contract,
            source,
            promoter.run_path(
                RUN_DIRECTORY,
                promoter.GEOMETRY_AUDIT_RELATIVE_PATH,
                "Geometry audit",
            ),
            None,
            None,
        )
        self.assertEqual(contract["state"], "approved_for_sanitization")
        self.assertNotIn("REVIEW_REQUIRED", promoter.canonical_json(contract))
        self.assertFalse(
            contract["derivedPolicyEvidence"]["individualJsonEntryReviewClaimed"]
        )

    def test_one_exact_guide_donor_contract_passes_and_binding_tamper_fails(self) -> None:
        row = next(
            item
            for item in self.context["jobRows"]
            if item["jobId"]
            == "salgsmappe-a5-2-part-3-flaps-4plus0-10mm-gloss-lamination-04a45942e622ec78"
        )
        self.assertIsNotNone(row["guideDonorEntrySha256"])
        contract = promoter.build_contract(
            self.context,
            row,
            self.decision,
            self.request_evidence,
            self.decision_evidence,
        )
        self.assertEqual(
            contract["verifiedBeschnittGuideDonor"],
            {
                "reportSha256": self.context["guideDonors"]["reportEvidence"]["sha256"],
                "entrySha256": row["guideDonorEntrySha256"],
            },
        )
        source = promoter.run_path(
            RUN_DIRECTORY,
            promoter.safe_relative_path(row["sourcePath"], "Test donor source"),
            "Test donor source",
        )
        sanitizer = self.context["sanitizer"]
        audit = promoter.run_path(
            RUN_DIRECTORY,
            promoter.GEOMETRY_AUDIT_RELATIVE_PATH,
            "Geometry audit",
        )
        supplement = promoter.run_path(
            RUN_DIRECTORY,
            promoter.APPROVED_SUPPLEMENT_RELATIVE_PATH,
            "Approved supplement",
        )
        resolution = promoter.run_path(
            RUN_DIRECTORY,
            promoter.APPROVED_RESOLUTION_RELATIVE_PATH,
            "Approved resolution",
        )
        sanitizer.validate_contract(
            contract,
            source,
            audit,
            supplement if contract["geometrySupplement"] is not None else None,
            resolution if contract["templateResolutionPlan"] is not None else None,
        )

        tampered = copy.deepcopy(contract)
        tampered["verifiedBeschnittGuideDonor"]["entrySha256"] = "0" * 64
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "does not resolve to exactly one report entry",
        ):
            sanitizer.validate_contract(
                tampered,
                source,
                audit,
                supplement if tampered["geometrySupplement"] is not None else None,
                resolution if tampered["templateResolutionPlan"] is not None else None,
            )

    def test_non_donor_contract_explicitly_carries_null_binding(self) -> None:
        row = next(
            item
            for item in self.context["jobRows"]
            if item["guideDonorEntrySha256"] is None
        )
        contract = promoter.build_contract(
            self.context,
            row,
            self.decision,
            self.request_evidence,
            self.decision_evidence,
        )
        self.assertIsNone(contract["verifiedBeschnittGuideDonor"])
        self.assertIsNone(
            contract["batchEvidence"]["verifiedBeschnittGuideDonorEntrySha256"]
        )

    def test_real_resolution_plan_contract_passes_global_extended_evidence(self) -> None:
        row = next(
            item
            for item in self.context["jobRows"]
            if item["jobId"]
            == "salgsmappe-a4-2-part-2-flaps-4plus4-1mm-blind-emboss-50be25e7e4d194fa"
        )
        self.assertEqual(
            row["resolutionClassification"],
            "collateral_original_after_bad_alias_quarantine",
        )
        contract = promoter.build_contract(
            self.context,
            row,
            self.decision,
            self.request_evidence,
            self.decision_evidence,
        )
        source = promoter.run_path(
            RUN_DIRECTORY,
            promoter.safe_relative_path(row["sourcePath"], "Resolution-plan source"),
            "Resolution-plan source",
        )
        sanitizer = self.context["sanitizer"]
        sanitizer.validate_contract(
            contract,
            source,
            promoter.run_path(
                RUN_DIRECTORY,
                promoter.GEOMETRY_AUDIT_RELATIVE_PATH,
                "Geometry audit",
            ),
            None,
            promoter.run_path(
                RUN_DIRECTORY,
                promoter.APPROVED_RESOLUTION_RELATIVE_PATH,
                "Approved resolution",
            ),
        )


if __name__ == "__main__":
    unittest.main()
