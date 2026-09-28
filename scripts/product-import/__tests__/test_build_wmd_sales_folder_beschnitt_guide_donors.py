from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path


TEST_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = TEST_DIRECTORY.parent.parent.parent
SCRIPT_PATH = (
    REPOSITORY_ROOT
    / "scripts/product-import/build_wmd_sales_folder_beschnitt_guide_donors.py"
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


builder = load_module(SCRIPT_PATH, "wmd_beschnitt_guide_donor_builder_test_subject")


class BeschnittGuideDonorBuilderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sanitizer = builder.load_module(
            (
                REPOSITORY_ROOT
                / Path(*builder.SANITIZER_RELATIVE_PATH.parts)
            ).resolve(),
            "wmd_beschnitt_guide_donor_builder_test_sanitizer",
        )
        cls.report = builder.build_report(RUN_DIRECTORY, cls.sanitizer)

    def test_exact_report_schema_and_five_profiles(self) -> None:
        report = self.report
        self.assertEqual(
            set(report),
            {
                "kind", "schemaVersion", "reviewState", "approval", "localOnly",
                "visualOutputQaPending", "eligibleForImport",
                "prohibitedActionsPerformed", "entries",
            },
        )
        self.assertEqual(
            report["kind"], "wmd_sales_folder_verified_beschnitt_guide_donors"
        )
        self.assertEqual(len(report["entries"]), 5)
        self.assertEqual(
            [entry["geometryKey"] for entry in report["entries"]],
            sorted(entry["geometryKey"] for entry in report["entries"]),
        )
        self.assertFalse(report["approval"]["individualJsonEntryReviewClaimed"])
        self.assertTrue(report["visualOutputQaPending"])
        self.assertFalse(report["eligibleForImport"])

    def test_entries_are_self_hashed_and_keep_original_source_authoritative(self) -> None:
        for entry in self.report["entries"]:
            unhashed = {key: value for key, value in entry.items() if key != "entrySha256"}
            self.assertEqual(entry["entrySha256"], builder.sha256_json(unhashed))
            self.assertEqual(entry["sourceBeschnitt"]["strokePaintCount"], 0)
            self.assertEqual(entry["sourceBeschnitt"]["orderedPathGeometrySha256s"], [])
            self.assertTrue(
                entry["importPolicy"]["preserveOriginalSourceForAllOtherGeometry"]
            )
            self.assertTrue(entry["importPolicy"]["noFullPdfRebind"])
            self.assertTrue(entry["importPolicy"]["noTextApproximation"])
            self.assertTrue(entry["optionalAccessoryGeometryPreservedFromSource"])

    def test_exact_transplant_and_reclassification_counts(self) -> None:
        guide_counts = {
            entry["geometryKey"]: entry["donorBeschnitt"]["strokePaintCount"]
            for entry in self.report["entries"]
        }
        self.assertEqual(
            guide_counts,
            {
                "a4|2-part-2-flaps|4+0|3mm": 8,
                "a5|2-part-3-flaps|4+0|10mm": 12,
                "a5|2-part-3-flaps|4+0|3mm": 12,
                "a5|2-part-3-flaps|4+0|5mm": 12,
                "a6|2-part-closure|4+4|5mm": 6,
            },
        )
        for entry in self.report["entries"]:
            imported = entry["importPolicy"]["importedStrokePathGeometrySha256s"]
            self.assertEqual(
                imported, entry["donorBeschnitt"]["orderedPathGeometrySha256s"]
            )
            removed = entry["importPolicy"][
                "removeSourceSchneidenPathGeometrySha256s"
            ]
            expected = 0 if entry["geometryKey"].startswith("a4|") else 2
            self.assertEqual(len(removed), expected)
            self.assertEqual(
                removed,
                [
                    row["pathGeometrySha256"]
                    for row in entry["schneiden"]["sourceOnlyReclassified"]
                ],
            )
            for row in entry["schneiden"]["sourceOnlyReclassified"]:
                self.assertTrue(row["equalsDonorBeschnittPath"])
                self.assertTrue(row["fullMediaBoxOuterContour"])

    def test_identity_drift_fails_closed(self) -> None:
        mapping = copy.deepcopy(builder.GUIDE_DONOR_MAPPINGS[0])
        mapping["source"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(builder.GuideDonorEvidenceError, "SHA-256 drifted"):
            builder.build_entry(RUN_DIRECTORY, mapping, self.sanitizer)


if __name__ == "__main__":
    unittest.main()
