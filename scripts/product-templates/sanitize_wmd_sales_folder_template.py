#!/usr/bin/env python3
"""Sanitize one reviewed WMD sales-folder PDF without changing its dieline geometry.

This tool intentionally does not share code with the Advent-calendar sanitizer.
It has two modes:

* ``describe`` creates a read-only source-evidence candidate.  A human must
  classify every layer and approve the contract before it can be used.
* ``sanitize`` accepts only an approved contract bound to the exact source
  SHA-256 and exact (format, construction, print, spine) geometry tuple.  A
  blocked construction-title mismatch needs a separately hashed, independently
  reviewed geometry supplement.  Other explicitly resolved projections need a
  separate, approved, hash-pinned template-resolution plan; the sanitizer never
  infers a rebind or changes the immutable base audit.

The resulting PDF retains reviewed vector geometry, removes supplier copy and
identity, removes only the exact optional ``CD-Tasche`` layer when its contract
classifies it as an unused accessory, gives retained layers reviewed Danish
names, converts only explicitly allowlisted no-print fills to neutral grey, and
adds Danish Webprinter information on optional-content groups whose PDF usage
policy is View ON / Print OFF / Export OFF.  A selected spot finish without a
real source finish mask is reported as professional-upload-only; the technical
``stanzen`` cut paint and geometry are preserved under a deterministic
Webprinter/Danish swatch name and are never promoted into a finish mask.  Five
exact zero-stroke ``Beschnitt Seite`` sources may use a separately approved,
hash-pinned donor report: only its CTM-aware stroke paths are transplanted, and
only exact shared full-page contours are reclassified out of ``Schneiden``.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import io
import json
import math
import os
import re
import stat
import sys
import tempfile
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    ContentStream,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    TextStringObject,
)
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas


SCHEMA_VERSION = 1
WEBPRINTER_BLUE = "#0EA5E9"
WEBPRINTER_BLUE_BORDER = "#0284C7"
NO_PRINT_GRAY = "#D1D5DB"
WEBPRINTER_BLUE_RGB = (14 / 255, 165 / 255, 233 / 255)
WEBPRINTER_BLUE_BORDER_RGB = (2 / 255, 132 / 255, 199 / 255)
NO_PRINT_GRAY_RGB = (209 / 255, 213 / 255, 219 / 255)
INFO_LAYER_NAME = "Webprinter-information - ikke til tryk"
GENERATED_NO_PRINT_LAYER_NAME = "Ikke synligt / uden tryk"
VERIFIED_BESCHNITT_GUIDE_DONOR_PATH = (
    "review/approved-template-package/verified-beschnitt-guide-donors.json"
)
VERIFIED_BESCHNITT_GUIDE_DONOR_KIND = (
    "wmd_sales_folder_verified_beschnitt_guide_donors"
)
BESCHNITT_OUTER_CONTOUR_TOLERANCE_PT = 0.02
VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES = {
    "5ac5f32fa0d855ae9434f58b0cf54a1c60684e4cbcd432e4cc72021c48f8c1fe",
    "660a8748281cb6d681dde963630efd382edea08ec32fc292ac084d144a865ade",
    "31707d23cf399adb88b9594e21565ad38959e26f25c838e6ab9019f0299c2015",
    "04a45942e622ec7892dd67eed925ee0b9eee5b76de3b0fd35014c74936aa7529",
    "98de75b1daca5c49bf32364fe13cd49ef515058e077d8404d56a7331015d13ef",
}
VERIFIED_BESCHNITT_DONOR_EXT_GSTATE = {
    "/AIS": "False",
    "/BM": "/Normal",
    "/CA": 1.0,
    "/OP": "False",
    "/OPM": 1.0,
    "/SA": "True",
    "/SMask": "/None",
    "/Type": "/ExtGState",
    "/ca": 1.0,
    "/op": "False",
}
GENERATED_NO_PRINT_SOURCE_PATTERN = (
    r"Dieser Bereich ist nicht bedruckbar\. Hier werden die Zusatzoptionen eingeblendet\."
)
SPOT_COLORANT_OUTPUT_NAMES = {
    "stanzen": "Webprinter_Beskaering_og_stans",
    "lack": "Webprinter_Efterbehandling",
}
SUPPORTED_FORMATS = {
    "a4",
    "a5",
    "a6",
    "din-lang",
    "square-21x21",
    "cd-135x135",
}
SUPPORTED_CONSTRUCTIONS = {
    "2-part-standard",
    "2-part-standard-window",
    "2-part-2-flaps",
    "2-part-2-flaps-window",
    "2-part-3-flaps",
    "2-part-3-flaps-window",
    "2-part-closure",
    "3-part-1-flap",
}
SUPPORTED_PRINTS = {"4+0", "4+4"}
SUPPORTED_SPINES = {1, 3, 5, 10}
SUPPORTED_FINISHES = {
    "none",
    "high-gloss-uv",
    "partial-uv",
    "matt-lamination",
    "gloss-lamination",
    "soft-touch-lamination",
    "soft-touch-partial-uv",
    "hot-foil-gold",
    "hot-foil-silver",
    "blind-emboss",
}
SPOT_FINISHES = {
    "partial-uv",
    "soft-touch-partial-uv",
    "hot-foil-gold",
    "hot-foil-silver",
    "blind-emboss",
}
PROFESSIONAL_UPLOAD_WARNING_DA = (
    "Denne efterbehandling kræver en separat maske i den trykklare PDF. "
    "Online-designeren kan ikke bruges til denne variant."
)
TEMPLATE_RESOLUTION_VERDICTS = {
    "exact_verified_rebind",
    "collateral_original_after_bad_alias_quarantine",
    "indirect_approved_title_rebind",
    "extended_exact_evidence_rebind",
    "extended_exact_evidence_original",
}
TEMPLATE_RESOLUTION_CLASSIFICATIONS = {
    "base_verified": None,
    "pending_title_only": None,
    "exact_verified_rebind": "exact_verified_rebind",
    "collateral_original_after_bad_alias_quarantine":
        "collateral_original_after_bad_alias_quarantine",
    "indirect_pending_title_rebind": "indirect_approved_title_rebind",
    "extended_exact_evidence": {
        "extended_exact_evidence_rebind",
        "extended_exact_evidence_original",
    },
}
PURE_REUSE_BLOCKERS = {
    "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES",
    "TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES",
}
REUSED_SPINE_ALIAS_BLOCKERS = {
    "PDF_TEXT_SPINE_MISMATCH",
    "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES",
    "TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES",
    "URL_SPINE_MISMATCH",
}
PROHIBITED_RESOLUTION_ACTIONS = {
    "supplierNetworkRequested",
    "sourcePdfModified",
    "sourcePdfSanitized",
    "sourcePdfUploaded",
    "databaseWritten",
    "supplierBankWritten",
    "productOrTemplateRecordWritten",
    "pricingWritten",
    "proposalMutated",
    "published",
}
SCOPED_PLAN_KEYS = {"catalogScope", "sourceScopeProjection"}
CD_SCOPE_MODEL_KEY = "cd-135x135--2-part-closure"
URI_COMPONENT_SAFE = "-_.!~*'()"
CD_SCOPE_RAW_BINDING_COUNT = 3744
CD_SCOPE_PROPOSED_BINDING_COUNT = 3692
CD_SCOPE_EXCLUDED_BINDING_COUNT = 52
CD_SCOPE_CLASSIFICATION_COUNTS_RAW = {
    "base_verified": 3170,
    "pending_title_only": 306,
    "exact_verified_rebind": 52,
    "collateral_original_after_bad_alias_quarantine": 140,
    "indirect_pending_title_rebind": 2,
    "extended_exact_evidence": 74,
}
CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED = {
    **CD_SCOPE_CLASSIFICATION_COUNTS_RAW,
    "extended_exact_evidence": 22,
}
CD_SCOPE_CATALOG_COUNTS = {
    "raw": {
        "sourceProducts": 420,
        "folderModels": 21,
        "priceRows": 109768,
        "exactSparseCombinations": 3744,
        "documentBindings": 3744,
        "additionalOptionBindings": 3744,
        "folderModelIcons": 21,
    },
    "proposed": {
        "sourceProducts": 400,
        "folderModels": 20,
        "priceRows": 108348,
        "exactSparseCombinations": 3692,
        "documentBindings": 3692,
        "additionalOptionBindings": 3692,
        "folderModelIcons": 20,
    },
    "excluded": {
        "sourceProducts": 20,
        "folderModels": 1,
        "priceRows": 1420,
        "exactSparseCombinations": 52,
        "documentBindings": 52,
        "additionalOptionBindings": 52,
        "folderModelIcons": 1,
    },
}
CD_SCOPE_EXPECTED_CATALOG = {
    "schemaVersion": 1,
    "state": "explicit_product_scope_projection",
    "rawSupplierEvidenceMutated": False,
    "policy": "exclude_only_explicitly_listed_models_and_add_ons_from_the_proposed_product",
    "excludedModels": [{
        "modelKey": CD_SCOPE_MODEL_KEY,
        "reasonDa": (
            "CD-mappen er fravalgt af produktejeren og skal ikke indg\u00e5 i den "
            "samlede Webprinter-vare."
        ),
        "decision": "exclude_from_proposed_webprinter_product",
        "sourceEvidencePreserved": True,
        "excludedCounts": {
            "sourceProducts": 20,
            "priceRows": 1420,
            "exactSparseCombinations": 52,
            "documentBindings": 52,
            "additionalOptionBindings": 52,
            "folderModelIcons": 1,
        },
    }],
    "excludedAddOns": [{
        "supplierFieldIdentity": {"fieldKey": "41", "supplierFieldId": "647"},
        "canonicalLabelOriginal": "CD-Tasche",
        "reasonDa": (
            "CD-lommen er fravalgt af produktejeren og m\u00e5 ikke blive et valgbart "
            "tilbeh\u00f8r eller indg\u00e5 i priserne."
        ),
        "decision": "exclude_from_proposed_webprinter_product",
        "sourceArtifact": "raw/additional-option-bindings.jsonl",
        "sourceEvidencePreserved": True,
        "projectedToSelectableProductOption": False,
        "includedInPricing": False,
        "evidenceCounts": {
            "raw": {
                "bindingsWithField": 3744,
                "fieldOccurrences": 3744,
                "choiceOccurrences": 7488,
                "labelledFieldOccurrences": 2236,
                "missingLabelFieldOccurrences": 1508,
            },
            "afterFolderModelScope": {
                "bindingsWithField": 3692,
                "fieldOccurrences": 3692,
                "choiceOccurrences": 7384,
                "labelledFieldOccurrences": 2236,
                "missingLabelFieldOccurrences": 1456,
            },
        },
    }],
    "counts": CD_SCOPE_CATALOG_COUNTS,
}
CD_SCOPE_EXPECTED_SOURCE_PROJECTION = {
    "rawBindingCount": CD_SCOPE_RAW_BINDING_COUNT,
    "proposedBindingCount": CD_SCOPE_PROPOSED_BINDING_COUNT,
    "excludedBindingCount": CD_SCOPE_EXCLUDED_BINDING_COUNT,
    "rawClassificationCounts": CD_SCOPE_CLASSIFICATION_COUNTS_RAW,
    "proposedClassificationCounts": CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED,
    "rawExtendedEvidenceFamilies": 5,
    "proposedExtendedEvidenceFamilies": 4,
    "excludedExtendedEvidenceFamilies": 1,
    "rawSupplierEvidenceMutated": False,
}
FINISH_AGNOSTIC_EXTENDED_FAMILY_KEY = "a6_closure_4plus0_finish_agnostic_rebind"
FINISH_AGNOSTIC_EXTENDED_REQUIREMENTS = {
    "resolved_template_matches_exact_expected_geometry",
    "resolved_template_has_no_finish_layer_spot_paint_or_finish_feature",
    "3mm_matte_and_partial_uv_witnesses_are_byte_identical",
    "finish_key_does_not_change_the_resolved_template_bytes",
}
PRESERVED_ROLES = {
    "cut",
    "fold",
    "safety",
    "bleed",
    "bleed-and-safety",
    "accessory",
    "finish",
    "technical",
}
REMOVED_ROLES = {"supplier-information", "supplier-branding", "unused-accessory"}
STRUCTURAL_SOURCE_LAYER_NAMES = {"Beschnitt Seite", "Rillen", "Schneiden"}
KNOWN_DANISH_LAYER_NAMES = {
    "Abheftvorrichtung": "Arkiveringsmekanisme",
    "Beschnitt Seite": "Udfald og sikkerhedsafstand",
    "Dreieckstasche": "Trekantlomme",
    "Dreieckstasche_klein": "Lille trekantlomme",
    "Efterbehandling": "Efterbehandling",
    "Gummiband": "Elastik",
    "Gummiband_gross": "Stor elastik",
    "Gummiband_klein": "Lille elastik",
    "Kombi Visitenkartentasche": "Kombineret visitkortlomme",
    "Magnetpunkte": "Magnetpunkter",
    "Magnetverchluss": "Magnetlukning",
    "Magnetverschluss": "Magnetlukning",
    "Rillen": "Falselinjer",
    "Schneiden": "Beskæring og stans",
    "Visitenkartentasche": "Visitkortlomme",
}
SUPPLIER_IDENTITY_PATTERNS = (
    rb"wir\s*[-_ ]?\s*machen\s*[-_ ]?\s*druck",
    rb"wirmachendruck",
    rb"wir-machen-druck\.de",
    rb"adobe\s+illustrator",
)
FORBIDDEN_INTERACTIVE_KEYS = {
    "/A",
    "/AA",
    "/AF",
    "/Annots",
    "/EmbeddedFiles",
    "/EF",
    "/Filespec",
    "/JS",
    "/JavaScript",
    "/Launch",
    "/Movie",
    "/Metadata",
    "/Names",
    "/OpenAction",
    "/Outlines",
    "/PieceInfo",
    "/RichMedia",
    "/Sound",
    "/SubmitForm",
    "/ImportData",
    "/URI",
    "/3D",
    "/ActualText",
    "/Alt",
    "/LastModified",
}
PATH_BUILD_OPERATORS = {b"m", b"l", b"c", b"v", b"y", b"h", b"re"}
PATH_PAINT_OPERATORS = {
    b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*", b"n"
}
FILL_PAINT_OPERATORS = {b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*"}
GEOMETRY_FINGERPRINT_OPERATORS = (
    PATH_BUILD_OPERATORS
    | PATH_PAINT_OPERATORS
    | {b"W", b"W*", b"cm", b"w", b"J", b"j", b"M", b"d"}
)
COLOR_OPERATORS = {b"g", b"G", b"rg", b"RG", b"k", b"K", b"cs", b"CS", b"sc", b"SC", b"scn", b"SCN"}
FORBIDDEN_OUTPUT_TEXT = (
    r"wir\s*-?\s*machen\s*-?\s*druck",
    r"wirmachendruck",
    r"vorlage\s+zur",
    r"datenformat",
    r"endformat",
    r"sicherheitsabstand",
    r"falzlinien",
    r"stanzlinien",
    r"druckerei",
)
FORBIDDEN_DECODED_OBJECT_PATTERNS = (
    rb"wir\s*-?\s*machen\s*-?\s*druck",
    rb"wirmachendruck",
    rb"wir-machen-druck\.de",
    rb"vorlage\s+zur",
    rb"datenformat",
    rb"endformat",
    rb"sicherheitsabstand",
    rb"falzlinien",
    rb"stanzlinien",
    rb"druckerei",
    rb"\bstanzen\b",
    rb"titelseite",
    rb"r.{0,2}ckseite",
    rb"innenseite",
    rb"einschlagseite",
    rb"f.{0,2}llh.{0,2}he",
    rb"druckdaten",
    rb"bedruckbar",
    rb"zusatzoptionen",
    rb"hinweise\s+zur\s+druckdatenerstellung",
    rb"mappe\s+f.{0,2}r",
)


class SalesFolderSanitizationError(RuntimeError):
    """A fail-closed source, contract, or output validation failure."""


class _FrozenDict(dict):
    """Read-compatible immutable dict used only for cached JSON evidence."""

    def _immutable(self, *_args: Any, **_kwargs: Any) -> None:
        raise TypeError("Cached validation evidence is immutable")

    __setitem__ = _immutable
    __delitem__ = _immutable
    __ior__ = _immutable
    clear = _immutable
    pop = _immutable
    popitem = _immutable
    setdefault = _immutable
    update = _immutable

    def __deepcopy__(self, _memo: dict[int, Any]) -> "_FrozenDict":
        return self


class _FrozenList(list):
    """Read-compatible immutable list used only for cached JSON evidence."""

    def _immutable(self, *_args: Any, **_kwargs: Any) -> None:
        raise TypeError("Cached validation evidence is immutable")

    __setitem__ = _immutable
    __delitem__ = _immutable
    __iadd__ = _immutable
    __imul__ = _immutable
    append = _immutable
    clear = _immutable
    extend = _immutable
    insert = _immutable
    pop = _immutable
    remove = _immutable
    reverse = _immutable
    sort = _immutable

    def __deepcopy__(self, _memo: dict[int, Any]) -> "_FrozenList":
        return self


def freeze_json(value: Any) -> Any:
    if isinstance(value, dict):
        return _FrozenDict({key: freeze_json(item) for key, item in value.items()})
    if isinstance(value, list):
        return _FrozenList(freeze_json(item) for item in value)
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_regular_bytes(path: Path, label: str) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise SalesFolderSanitizationError(
            f"{label} must remain a readable regular non-symlink file: {exc}"
        ) from exc
    try:
        status = os.fstat(descriptor)
        if not stat.S_ISREG(status.st_mode):
            raise SalesFolderSanitizationError(
                f"{label} must be a regular non-symlink file"
            )
        chunks = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(descriptor)


class BatchValidationCache:
    """Process-local cache for immutable, content-addressed validation evidence.

    The cache never stores an approval decision and never skips validation of a
    contract's own policy fields.  Every lookup re-reads and hashes the exact
    regular file; parsed JSON, source observations, and the expensive global
    template-resolution graph proof are reused only when all content hashes
    still match.  This makes later-contract tampering a cache miss or a normal
    fail-closed validation error instead of a stale-cache success.
    """

    def __init__(self) -> None:
        self._json: dict[tuple[str, str, int], Any] = {}
        self._source_observations: dict[
            tuple[str, int, str], tuple[dict[str, Any], str]
        ] = {}
        self._resolution_plans: dict[tuple[Any, ...], dict[str, Any]] = {}

    def read_bytes(self, path: Path, label: str) -> tuple[bytes, str]:
        data = read_regular_bytes(path, label)
        return data, sha256_bytes(data)

    def read_json(
        self, path: Path, label: str
    ) -> tuple[bytes, str, Any]:
        data, digest = self.read_bytes(path, label)
        key = (str(path.resolve()), digest, len(data))
        if key not in self._json:
            try:
                self._json[key] = freeze_json(json.loads(data.decode("utf-8")))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise SalesFolderSanitizationError(
                    f"Cannot read {label.lower()}: {exc}"
                ) from exc
        return data, digest, self._json[key]

    def observe_source(
        self,
        source: Path,
        geometry: dict[str, Any],
        finish_key: str,
    ) -> tuple[dict[str, Any], str]:
        source_bytes, source_sha = self.read_bytes(source, "Source PDF")
        key = (source_sha, len(source_bytes), sha256_json(geometry))
        cached = self._source_observations.get(key)
        if cached is None:
            observed, full_text = _describe_source_bytes(
                source_bytes, geometry, finish_key, include_text=True
            )
            cached = (observed, full_text)
            self._source_observations[key] = copy.deepcopy(cached)
        observed, full_text = copy.deepcopy(cached)
        observed["finishKey"] = finish_key
        geometry_binding = {
            "sourceSha256": source_sha,
            "geometry": geometry,
            "finishKey": finish_key,
        }
        observed["sourceEvidence"]["geometryBinding"] = geometry_binding
        observed["sourceEvidence"]["geometryBindingSha256"] = sha256_json(
            geometry_binding
        )
        observed["professionalUploadWarningDa"] = (
            PROFESSIONAL_UPLOAD_WARNING_DA if finish_key in SPOT_FINISHES else None
        )
        return observed, full_text


def sha256_file(path: Path) -> str:
    return sha256_bytes(read_regular_bytes(path, "File"))


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def number(value: Any) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise SalesFolderSanitizationError("PDF contains a non-finite numeric operand")
    return result


def is_reviewable_red_or_pink_device_fill(operator: str, operands: list[float]) -> bool:
    """Validate one exact reviewed Device color; never select objects by color."""

    if operator == "rg" and len(operands) == 3:
        red, green, blue = operands
    elif operator == "k" and len(operands) == 4:
        cyan, magenta, yellow, black = operands
        red = 1 - min(1, cyan + black)
        green = 1 - min(1, magenta + black)
        blue = 1 - min(1, yellow + black)
    else:
        return False
    return (
        red >= 0.75
        and green <= 0.70
        and red - green >= 0.20
        and red >= blue - 0.05
        and max(red, green, blue) - min(red, green, blue) >= 0.20
    )


def canonical_operand(value: Any) -> Any:
    if isinstance(value, (int, float)):
        return round(float(value), 7)
    try:
        numeric = float(value)
        if math.isfinite(numeric) and re.fullmatch(r"[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?", str(value)):
            return round(numeric, 7)
    except (TypeError, ValueError):
        pass
    if isinstance(value, (list, tuple, ArrayObject)):
        return [canonical_operand(item) for item in value]
    return str(value)


def normalized_extracted_text(reader: PdfReader) -> str:
    pages = []
    for page in reader.pages:
        pages.append(re.sub(r"\s+", " ", page.extract_text() or "").strip())
    return "\n\f\n".join(pages)


def detected_production_measurements(text: str) -> dict[str, float | None]:
    def unique(pattern: str) -> float | None:
        values = {
            round(float(match.replace(",", ".")), 7)
            for match in re.findall(pattern, text, flags=re.IGNORECASE)
        }
        return next(iter(values)) if len(values) == 1 else None

    return {
        "bleedMm": unique(r"(\d+(?:[.,]\d+)?)\s*mm\s+Beschnitt"),
        "safetyMm": unique(r"Sicherheitsabstand\s*:\s*(\d+(?:[.,]\d+)?)\s*mm"),
    }


def box_values(page: Any, key: str) -> list[float]:
    box = getattr(page, key)
    return [round(float(item), 6) for item in box]


def page_box_inventory(reader: PdfReader) -> list[dict[str, list[float]]]:
    return [
        {
            key: box_values(page, key)
            for key in ("mediabox", "cropbox", "bleedbox", "trimbox", "artbox")
        }
        for page in reader.pages
    ]


def layer_map(container: Any) -> dict[str, str]:
    resources = container.get("/Resources")
    resources = resources.get_object() if resources else None
    if not resources:
        return {}
    properties = resources.get("/Properties")
    properties = properties.get_object() if properties else None
    if not properties:
        return {}
    result: dict[str, str] = {}
    for key, reference in properties.items():
        try:
            group = reference.get_object()
            if str(group.get("/Type") or "") != "/OCG":
                continue
            name = str(group.get("/Name") or "").strip()
        except Exception as exc:
            raise SalesFolderSanitizationError(
                f"Cannot inspect optional-content property {key}: {exc}"
            ) from exc
        if not name:
            raise SalesFolderSanitizationError(f"Optional-content property {key} has no name")
        result[str(key)] = name
    return result


def colorant_names(resources: Any) -> set[str]:
    resources = resources.get_object() if resources else None
    if not resources:
        return set()
    spaces = resources.get("/ColorSpace")
    spaces = spaces.get_object() if spaces else None
    if not spaces:
        return set()
    output: set[str] = set()
    for reference in spaces.values():
        try:
            definition = reference.get_object()
            family = str(definition[0]) if isinstance(definition, (list, ArrayObject)) and definition else ""
            if family == "/Separation" and len(definition) >= 2:
                output.add(str(definition[1]).lstrip("/"))
            elif family == "/DeviceN" and len(definition) >= 2:
                names = definition[1].get_object()
                output.update(str(item).lstrip("/") for item in names)
        except Exception as exc:
            raise SalesFolderSanitizationError(f"Cannot inspect spot-color declaration: {exc}") from exc
    return output


def all_source_colorants(reader: PdfReader) -> list[str]:
    output: set[str] = set()
    visited: set[int] = set()

    def walk(container: Any) -> None:
        identity = id(container)
        if identity in visited:
            return
        visited.add(identity)
        resources = container.get("/Resources")
        output.update(colorant_names(resources))
        for reference in xobject_map(container).values():
            obj = reference.get_object()
            if str(obj.get("/Subtype") or "") == "/Form":
                walk(obj)

    for page in reader.pages:
        walk(page)
    return sorted(output)


def resource_colorant_map(resources: Any) -> dict[str, set[str]]:
    resources = resources.get_object() if resources else None
    if not resources:
        return {}
    spaces = resources.get("/ColorSpace")
    spaces = spaces.get_object() if spaces else None
    if not spaces:
        return {}
    output: dict[str, set[str]] = {}
    for key, reference in spaces.items():
        definition = reference.get_object()
        family = str(definition[0]) if isinstance(definition, (list, ArrayObject)) and definition else ""
        names: set[str] = set()
        if family == "/Separation" and len(definition) >= 2:
            names.add(str(definition[1]).lstrip("/"))
        elif family == "/DeviceN" and len(definition) >= 2:
            names.update(str(item).lstrip("/") for item in definition[1].get_object())
        if names:
            output[str(key)] = names
    return output


def rename_spot_colorants_in_resources(resources: Any) -> dict[str, str]:
    """Rename only exact reviewed technical/finish swatches in copied resources."""

    resources = resources.get_object() if resources else None
    if not resources:
        return {}
    spaces = resources.get("/ColorSpace")
    spaces = spaces.get_object() if spaces else None
    if not spaces:
        return {}
    renamed: dict[str, str] = {}
    for key in list(spaces.keys()):
        definition = copy.deepcopy(spaces[key].get_object())
        if not isinstance(definition, (list, ArrayObject)) or not definition:
            continue
        family = str(definition[0])
        if family == "/Separation" and len(definition) >= 2:
            source_name = str(definition[1]).lstrip("/")
            output_name = SPOT_COLORANT_OUTPUT_NAMES.get(source_name)
            if output_name is not None:
                definition[1] = NameObject(f"/{output_name}")
                renamed[source_name] = output_name
                spaces[key] = definition
        elif family == "/DeviceN" and len(definition) >= 2:
            names = definition[1].get_object()
            output_names = ArrayObject()
            changed = False
            for name in names:
                source_name = str(name).lstrip("/")
                output_name = SPOT_COLORANT_OUTPUT_NAMES.get(source_name, source_name)
                output_names.append(NameObject(f"/{output_name}"))
                if output_name != source_name:
                    renamed[source_name] = output_name
                    changed = True
            if changed:
                definition[1] = output_names
                spaces[key] = definition
    return renamed


def spot_paint_usage(reader: PdfReader) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    active_forms: set[int] = set()

    def walk(container: Any, page_number: int, inherited_layer: str | None) -> None:
        properties = layer_map(container)
        spaces = resource_colorant_map(container.get("/Resources"))
        xobjects = xobject_map(container)
        layer = inherited_layer
        layer_stack: list[str | None] = []
        fill_spots: set[str] = set()
        stroke_spots: set[str] = set()
        state_stack: list[tuple[set[str], set[str]]] = []
        for operands, operator in content_operations(container, reader):
            ocg = current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                layer_stack.append(layer)
                if ocg is not None:
                    layer = ocg
                continue
            if operator == b"EMC":
                layer = layer_stack.pop() if layer_stack else inherited_layer
                continue
            if operator == b"q":
                state_stack.append((set(fill_spots), set(stroke_spots)))
                continue
            if operator == b"Q":
                fill_spots, stroke_spots = state_stack.pop() if state_stack else (set(), set())
                continue
            if operator == b"cs":
                fill_spots = set(spaces.get(str(operands[0]), set())) if operands else set()
                continue
            if operator == b"CS":
                stroke_spots = set(spaces.get(str(operands[0]), set())) if operands else set()
                continue
            if operator in FILL_PAINT_OPERATORS:
                for name in fill_spots:
                    output.append({"page": page_number, "layer": layer, "colorant": name, "paint": "fill"})
            if operator in {b"S", b"s", b"B", b"B*", b"b", b"b*"}:
                for name in stroke_spots:
                    output.append({"page": page_number, "layer": layer, "colorant": name, "paint": "stroke"})
            if operator == b"Do" and operands:
                reference = xobjects.get(operands[0])
                if reference is None:
                    raise SalesFolderSanitizationError(f"Missing XObject {operands[0]}")
                obj = reference.get_object()
                if str(obj.get("/Subtype") or "") == "/Form":
                    identity = id(obj)
                    if identity in active_forms:
                        raise SalesFolderSanitizationError("Recursive Form XObject is not supported")
                    active_forms.add(identity)
                    walk(obj, page_number, layer)
                    active_forms.remove(identity)

    for page_number, page in enumerate(reader.pages, 1):
        walk(page, page_number, None)
    return output


def painting_feature_inventory(reader: PdfReader) -> list[dict[str, Any]]:
    features: list[dict[str, Any]] = []
    active_forms: set[int] = set()

    def walk(container: Any, page_number: int, inherited_layer: str | None, location: str) -> None:
        properties = layer_map(container)
        xobjects = xobject_map(container)
        resources = container.get("/Resources")
        resources = resources.get_object() if resources else DictionaryObject()
        for resource_name in ("/Pattern", "/Shading"):
            resource = resources.get(resource_name)
            resource = resource.get_object() if resource else None
            if resource:
                features.append({
                    "type": resource_name.lstrip("/").lower(),
                    "page": page_number,
                    "location": location,
                    "names": sorted(str(key) for key in resource.keys()),
                })
        states = resources.get("/ExtGState")
        states = states.get_object() if states else None
        if states:
            for key, reference in states.items():
                state = reference.get_object()
                smask = state.get("/SMask")
                if smask is not None and str(smask) != "/None":
                    features.append({
                        "type": "soft-mask",
                        "page": page_number,
                        "location": location,
                        "name": str(key),
                    })
        layer = inherited_layer
        stack: list[str | None] = []
        for operands, operator in content_operations(container, reader):
            ocg = current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                stack.append(layer)
                if ocg is not None:
                    layer = ocg
                continue
            if operator == b"EMC":
                layer = stack.pop() if stack else inherited_layer
                continue
            if operator in {b"INLINE IMAGE", b"BI", b"ID", b"EI"}:
                features.append({
                    "type": "inline-image",
                    "page": page_number,
                    "location": location,
                    "layer": layer,
                })
            if operator == b"sh":
                features.append({
                    "type": "shading-paint",
                    "page": page_number,
                    "location": location,
                    "layer": layer,
                })
            if operator == b"Do" and operands:
                reference = xobjects.get(operands[0])
                if reference is None:
                    raise SalesFolderSanitizationError(f"Missing XObject {operands[0]}")
                obj = reference.get_object()
                subtype = str(obj.get("/Subtype") or "")
                if subtype == "/Image":
                    features.append({
                        "type": "image-xobject",
                        "page": page_number,
                        "location": location,
                        "layer": layer,
                        "name": str(operands[0]),
                    })
                elif subtype == "/Form":
                    identity = id(obj)
                    if identity in active_forms:
                        raise SalesFolderSanitizationError("Recursive Form XObject is not supported")
                    active_forms.add(identity)
                    walk(obj, page_number, layer, f"{location}/{operands[0]}")
                    active_forms.remove(identity)

    for page_number, page in enumerate(reader.pages, 1):
        rotation = int(page.get("/Rotate") or 0) % 360
        media = box_values(page, "mediabox")
        if rotation:
            features.append({"type": "rotated-page", "page": page_number, "degrees": rotation})
        if media[0] != 0 or media[1] != 0:
            features.append({"type": "nonzero-page-origin", "page": page_number, "origin": media[:2]})
        walk(page, page_number, None, f"page-{page_number}")
    return features


def current_ocg_name(
    operands: Any,
    operator: bytes,
    properties: dict[str, str],
) -> str | None:
    if operator != b"BDC" or len(operands) < 2 or str(operands[0]) != "/OC":
        return None
    property_name = str(operands[1])
    if property_name not in properties:
        raise SalesFolderSanitizationError(
            f"Optional-content marker references unknown property {property_name}"
        )
    return properties[property_name]


def xobject_map(container: Any) -> Any:
    resources = container.get("/Resources")
    resources = resources.get_object() if resources else None
    if not resources:
        return {}
    xobjects = resources.get("/XObject")
    return xobjects.get_object() if xobjects else {}


def ext_gstate_map(container: Any) -> Any:
    resources = container.get("/Resources")
    resources = resources.get_object() if resources else None
    if not resources:
        return {}
    states = resources.get("/ExtGState")
    return states.get_object() if states else {}


def canonical_pdf_graphics_value(value: Any, active: set[int] | None = None) -> Any:
    """Resolve one graphics-state value into deterministic JSON-safe data.

    ExtGState resources are compared by resolved contents rather than resource
    aliases such as ``/GS0``.  This keeps the validation meaningful when a PDF
    producer uses different names for equivalent dictionaries and also catches
    a same-name resource whose overprint/opacity/style values changed.
    """

    if active is None:
        active = set()
    try:
        resolved = value.get_object() if hasattr(value, "get_object") else value
    except Exception as exc:
        raise SalesFolderSanitizationError(
            f"Cannot resolve ExtGState value: {exc}"
        ) from exc
    if resolved is not value:
        return canonical_pdf_graphics_value(resolved, active)
    if isinstance(resolved, DictionaryObject):
        identity = id(resolved)
        if identity in active:
            raise SalesFolderSanitizationError("Recursive ExtGState value is not supported")
        active.add(identity)
        result = {
            str(key): canonical_pdf_graphics_value(item, active)
            for key, item in sorted(resolved.items(), key=lambda pair: str(pair[0]))
        }
        if hasattr(resolved, "get_data"):
            try:
                result["__streamSha256"] = sha256_bytes(resolved.get_data())
            except Exception as exc:
                raise SalesFolderSanitizationError(
                    f"Cannot read ExtGState stream value: {exc}"
                ) from exc
        active.remove(identity)
        return result
    if isinstance(resolved, (list, tuple, ArrayObject)):
        identity = id(resolved)
        if identity in active:
            raise SalesFolderSanitizationError("Recursive ExtGState array is not supported")
        active.add(identity)
        result = [canonical_pdf_graphics_value(item, active) for item in resolved]
        active.remove(identity)
        return result
    if isinstance(resolved, (bytes, bytearray)):
        return {"bytesSha256": sha256_bytes(bytes(resolved))}
    if resolved is None or isinstance(resolved, bool):
        return resolved
    return canonical_operand(resolved)


def resolved_ext_gstate_delta(container: Any, operands: Any) -> dict[str, Any]:
    if len(operands) != 1:
        raise SalesFolderSanitizationError(
            "ExtGState operator must have exactly one resource name"
        )
    states = ext_gstate_map(container)
    reference = states.get(operands[0])
    if reference is None:
        raise SalesFolderSanitizationError(
            f"Missing ExtGState resource {operands[0]}"
        )
    descriptor = canonical_pdf_graphics_value(reference)
    if not isinstance(descriptor, dict):
        raise SalesFolderSanitizationError("ExtGState resource is not a dictionary")
    return descriptor


def content_operations(container: Any, reader: PdfReader) -> list[tuple[Any, bytes]]:
    contents = container.get_contents() if hasattr(container, "get_contents") else container
    if contents is None:
        return []
    return list(ContentStream(contents, reader).operations)


def color_descriptor(page_number: int, layer: str | None, operator: bytes, operands: Any) -> str:
    return canonical_json(
        {
            "page": page_number,
            "layer": layer or "__unlayered__",
            "operator": operator.decode("latin1"),
            "operands": [canonical_operand(item) for item in operands],
        }
    )


def iter_source_events(reader: PdfReader) -> Iterable[dict[str, Any]]:
    """Yield layer, color, geometry, and XObject events with inherited OCG context."""

    active_forms: set[int] = set()

    def walk(container: Any, page_number: int, inherited_layer: str | None):
        properties = layer_map(container)
        xobjects = xobject_map(container)
        stack: list[str | None] = []
        layer = inherited_layer
        path: list[tuple[Any, bytes]] = []
        for operands, operator in content_operations(container, reader):
            ocg = current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                stack.append(layer)
                if ocg is not None:
                    layer = ocg
                    yield {"kind": "layer", "page": page_number, "layer": layer}
                continue
            if operator == b"EMC":
                layer = stack.pop() if stack else inherited_layer
                continue
            if operator in COLOR_OPERATORS:
                yield {
                    "kind": "color",
                    "page": page_number,
                    "layer": layer,
                    "operator": operator,
                    "operands": operands,
                    "descriptor": color_descriptor(page_number, layer, operator, operands),
                }
            if operator in PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
                path.append((operands, operator))
            if operator in PATH_PAINT_OPERATORS:
                yield {
                    "kind": "paint",
                    "page": page_number,
                    "layer": layer,
                    "operator": operator,
                    "path": list(path),
                }
                path = []
            if operator in GEOMETRY_FINGERPRINT_OPERATORS:
                yield {
                    "kind": "geometry",
                    "page": page_number,
                    "layer": layer,
                    "operator": operator,
                    "operands": operands,
                }
            if operator == b"Do" and operands:
                key = operands[0]
                reference = xobjects.get(key)
                if reference is None:
                    raise SalesFolderSanitizationError(f"Missing XObject {key} on page {page_number}")
                obj = reference.get_object()
                subtype = str(obj.get("/Subtype") or "")
                yield {
                    "kind": "xobject",
                    "page": page_number,
                    "layer": layer,
                    "name": str(key),
                    "subtype": subtype,
                }
                if subtype == "/Form":
                    identity = id(obj)
                    if identity in active_forms:
                        raise SalesFolderSanitizationError("Recursive Form XObject is not supported")
                    active_forms.add(identity)
                    yield from walk(obj, page_number, layer)
                    active_forms.remove(identity)

    for page_number, page in enumerate(reader.pages, 1):
        yield from walk(page, page_number, None)


def geometry_inventory(reader: PdfReader) -> dict[str, dict[str, Any]]:
    by_layer: dict[str, list[Any]] = defaultdict(list)
    path_counts: dict[str, int] = defaultdict(int)
    stroke_paint_counts: dict[str, int] = defaultdict(int)
    fill_paint_counts: dict[str, int] = defaultdict(int)
    for event in iter_source_events(reader):
        if event["kind"] == "paint":
            layer = event["layer"] or "__unlayered__"
            if event["operator"] in {b"S", b"s", b"B", b"B*", b"b", b"b*"}:
                stroke_paint_counts[layer] += 1
            if event["operator"] in FILL_PAINT_OPERATORS:
                fill_paint_counts[layer] += 1
            continue
        if event["kind"] != "geometry":
            continue
        layer = event["layer"] or "__unlayered__"
        by_layer[layer].append(
            {
                "page": event["page"],
                "operator": event["operator"].decode("latin1"),
                "operands": [canonical_operand(item) for item in event["operands"]],
            }
        )
        if event["operator"] in PATH_BUILD_OPERATORS:
            path_counts[layer] += 1
    return {
        layer: {
            "sha256": sha256_json(events),
            "eventCount": len(events),
            "pathOperatorCount": path_counts[layer],
            "strokePaintCount": stroke_paint_counts[layer],
            "fillPaintCount": fill_paint_counts[layer],
        }
        for layer, events in sorted(by_layer.items())
    }


def paint_path_sha256(page_number: int, layer: str, path: list[tuple[Any, bytes]]) -> str:
    return sha256_json({
        "page": page_number,
        "layer": layer,
        "path": [
            {
                "operator": operator.decode("latin1"),
                "operands": [canonical_operand(item) for item in operands],
            }
            for operands, operator in path
        ],
    })


def paint_path_geometry_sha256(page_number: int, path: list[tuple[Any, bytes]]) -> str:
    """Fingerprint paint geometry independently of the reviewed/output OCG name."""

    return sha256_json({
        "page": page_number,
        "path": [
            {
                "operator": operator.decode("latin1"),
                "operands": [canonical_operand(item) for item in operands],
            }
            for operands, operator in path
        ],
    })


IDENTITY_CTM = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
STROKE_PAINT_OPERATORS = {b"S", b"s", b"B", b"B*", b"b", b"b*"}
STROKE_COLOR_OPERATORS = {b"G", b"RG", b"K"}
STROKE_STYLE_OPERATORS = {b"w", b"J", b"j", b"M", b"d"}


def concatenate_ctm(
    current: tuple[float, float, float, float, float, float],
    added: tuple[float, float, float, float, float, float],
) -> tuple[float, float, float, float, float, float]:
    """Concatenate one PDF ``cm`` matrix onto the current user-space CTM."""

    a1, b1, c1, d1, e1, f1 = current
    a2, b2, c2, d2, e2, f2 = added
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def transform_point(
    ctm: tuple[float, float, float, float, float, float],
    x: float,
    y: float,
) -> tuple[float, float]:
    a, b, c, d, e, f = ctm
    return a * x + c * y + e, b * x + d * y + f


def normalized_bbox(values: Iterable[float]) -> list[float]:
    output = []
    for value in values:
        rounded = round(float(value), 3)
        output.append(0.0 if rounded == 0 else rounded)
    return output


def effective_path_bbox(
    path: list[tuple[Any, bytes]],
    ctm: tuple[float, float, float, float, float, float],
) -> list[float]:
    """Return [llx,lly,urx,ury] from path/control points in page user space."""

    points: list[tuple[float, float]] = []
    for operands, operator in path:
        values = [number(item) for item in operands]
        local_points: list[tuple[float, float]] = []
        if operator in {b"m", b"l"} and len(values) == 2:
            local_points.append((values[0], values[1]))
        elif operator == b"c" and len(values) == 6:
            local_points.extend(
                [(values[0], values[1]), (values[2], values[3]), (values[4], values[5])]
            )
        elif operator in {b"v", b"y"} and len(values) == 4:
            local_points.extend([(values[0], values[1]), (values[2], values[3])])
        elif operator == b"re" and len(values) == 4:
            x, y, width, height = values
            local_points.extend(
                [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
            )
        points.extend(transform_point(ctm, x, y) for x, y in local_points)
    if not points:
        raise SalesFolderSanitizationError(
            "A reviewed stroke path has no independently measurable coordinates"
        )
    return normalized_bbox(
        (
            min(item[0] for item in points),
            min(item[1] for item in points),
            max(item[0] for item in points),
            max(item[1] for item in points),
        )
    )


def _stroke_path_inventory(
    reader: PdfReader,
    layer_name: str | None = None,
    *,
    include_operations: bool = False,
    include_ext_gstate: bool = False,
) -> list[dict[str, Any]]:
    """Collect painted stroke paths with their effective page-space CTM.

    The public JSON fields are deliberately stable so approval builders can use
    this same implementation.  Raw pypdf operations are exposed only to the
    in-process, hash-pinned donor importer.
    """

    output: list[dict[str, Any]] = []
    active_forms: set[int] = set()

    def walk(
        container: Any,
        page_number: int,
        inherited_layer: str | None,
        inherited_ctm: tuple[float, float, float, float, float, float],
        inherited_stroke_color: tuple[Any, bytes] | None,
        inherited_line_style: dict[bytes, Any],
        inherited_ext_gstate: dict[str, Any],
    ) -> None:
        properties = layer_map(container)
        xobjects = xobject_map(container)
        layer = inherited_layer
        layer_stack: list[str | None] = []
        ctm = inherited_ctm
        stroke_color = copy.deepcopy(inherited_stroke_color)
        line_style = copy.deepcopy(inherited_line_style)
        ext_gstate = copy.deepcopy(inherited_ext_gstate)
        state_stack: list[
            tuple[
                tuple[float, float, float, float, float, float],
                tuple[Any, bytes] | None,
                dict[bytes, Any],
                dict[str, Any],
            ]
        ] = []
        path: list[tuple[Any, bytes]] = []
        for operands, operator in content_operations(container, reader):
            ocg_name = current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                layer_stack.append(layer)
                if ocg_name is not None:
                    layer = ocg_name
                continue
            if operator == b"EMC":
                if not layer_stack:
                    raise SalesFolderSanitizationError(
                        "Unbalanced donor marked-content operator"
                    )
                layer = layer_stack.pop()
                continue
            if operator == b"q":
                state_stack.append(
                    (
                        ctm,
                        copy.deepcopy(stroke_color),
                        copy.deepcopy(line_style),
                        copy.deepcopy(ext_gstate),
                    )
                )
                continue
            if operator == b"Q":
                if not state_stack:
                    raise SalesFolderSanitizationError(
                        "Unbalanced donor graphics-state operator"
                    )
                ctm, stroke_color, line_style, ext_gstate = state_stack.pop()
                continue
            if operator == b"cm":
                if len(operands) != 6:
                    raise SalesFolderSanitizationError("Invalid donor CTM operator")
                ctm = concatenate_ctm(
                    ctm, tuple(number(item) for item in operands)  # type: ignore[arg-type]
                )
                continue
            if operator in STROKE_COLOR_OPERATORS:
                stroke_color = (copy.deepcopy(operands), operator)
                continue
            if operator in {b"CS", b"SC", b"SCN"}:
                stroke_color = (copy.deepcopy(operands), operator)
                continue
            if operator in STROKE_STYLE_OPERATORS:
                line_style[operator] = copy.deepcopy(operands)
                continue
            if operator == b"gs":
                ext_gstate.update(resolved_ext_gstate_delta(container, operands))
                continue
            if operator in PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
                path.append((copy.deepcopy(operands), operator))
                continue
            if operator in PATH_PAINT_OPERATORS:
                if operator in STROKE_PAINT_OPERATORS and (
                    layer_name is None or layer == layer_name
                ):
                    path_hash = paint_path_geometry_sha256(page_number, path)
                    record: dict[str, Any] = {
                        "page": page_number,
                        "layer": layer,
                        "operator": operator.decode("latin1"),
                        "pathGeometrySha256": path_hash,
                        "effectiveBbox": effective_path_bbox(path, ctm),
                        "effectiveCtm": [round(item, 7) for item in ctm],
                        "strokeColor": (
                            {
                                "operator": stroke_color[1].decode("latin1"),
                                "operands": [
                                    canonical_operand(item)
                                    for item in stroke_color[0]
                                ],
                            }
                            if stroke_color is not None
                            else None
                        ),
                        "lineStyle": {
                            key.decode("latin1"): [
                                canonical_operand(item) for item in value
                            ]
                            for key, value in sorted(line_style.items())
                        },
                    }
                    if include_ext_gstate:
                        record["extGState"] = copy.deepcopy(ext_gstate)
                    if include_operations:
                        record["_pathOperations"] = copy.deepcopy(path)
                        record["_effectiveCtm"] = ctm
                        record["_strokeColorOperation"] = copy.deepcopy(stroke_color)
                        record["_lineStyleOperations"] = copy.deepcopy(line_style)
                    output.append(record)
                path = []
                continue
            if operator == b"Do" and operands:
                reference = xobjects.get(operands[0])
                if reference is None:
                    raise SalesFolderSanitizationError(
                        f"Missing donor XObject {operands[0]}"
                    )
                form = reference.get_object()
                if str(form.get("/Subtype") or "") != "/Form":
                    continue
                identity = id(form)
                if identity in active_forms:
                    raise SalesFolderSanitizationError(
                        "Recursive donor Form XObject is not supported"
                    )
                form_matrix_value = form.get("/Matrix") or IDENTITY_CTM
                if len(form_matrix_value) != 6:
                    raise SalesFolderSanitizationError("Invalid donor Form matrix")
                form_ctm = concatenate_ctm(
                    ctm,
                    tuple(number(item) for item in form_matrix_value),  # type: ignore[arg-type]
                )
                active_forms.add(identity)
                walk(
                    form,
                    page_number,
                    layer,
                    form_ctm,
                    stroke_color,
                    line_style,
                    ext_gstate,
                )
                active_forms.remove(identity)
        if layer_stack or state_stack:
            raise SalesFolderSanitizationError(
                "Unbalanced donor marked-content or graphics-state operators"
            )

    for page_number, page in enumerate(reader.pages, 1):
        walk(page, page_number, None, IDENTITY_CTM, None, {}, {})
    return output


def stroke_path_inventory(
    reader: PdfReader, layer_name: str | None = None
) -> list[dict[str, Any]]:
    """Public JSON-safe CTM-aware stroke inventory used by approval tooling."""

    return _stroke_path_inventory(reader, layer_name, include_operations=False)


def stroke_path_hashes(reader: PdfReader, layer_name: str) -> list[str]:
    return [
        item["pathGeometrySha256"]
        for item in stroke_path_inventory(reader, layer_name)
    ]


def stroke_multiset_sha256(values: Iterable[str]) -> str:
    return sha256_json(sorted(values))


def device_fill_paint_inventory(reader: PdfReader) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    active_forms: set[int] = set()

    def walk(container: Any, page_number: int, inherited_layer: str | None) -> None:
        properties = layer_map(container)
        xobjects = xobject_map(container)
        layer = inherited_layer
        layer_stack: list[str | None] = []
        fill: tuple[str, list[float]] | None = None
        state_stack: list[tuple[str, list[float]] | None] = []
        path: list[tuple[Any, bytes]] = []
        for operands, operator in content_operations(container, reader):
            ocg = current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                layer_stack.append(layer)
                if ocg is not None:
                    layer = ocg
                continue
            if operator == b"EMC":
                layer = layer_stack.pop() if layer_stack else inherited_layer
                continue
            if operator == b"q":
                state_stack.append(copy.deepcopy(fill))
                continue
            if operator == b"Q":
                fill = state_stack.pop() if state_stack else None
                continue
            if operator in (b"g", b"rg", b"k"):
                fill = (operator.decode("latin1"), [round(number(item), 7) for item in operands])
                continue
            if operator in (b"cs", b"sc", b"scn"):
                fill = None
                continue
            if operator in PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
                path.append((operands, operator))
                continue
            if operator in PATH_PAINT_OPERATORS:
                if operator in FILL_PAINT_OPERATORS and fill and layer:
                    output.append({
                        "page": page_number,
                        "layer": layer,
                        "operator": fill[0],
                        "operands": fill[1],
                        "descriptor": color_descriptor(
                            page_number, layer, fill[0].encode("latin1"), fill[1]
                        ),
                        "pathSha256": paint_path_sha256(page_number, layer, path),
                        "pathGeometrySha256": paint_path_geometry_sha256(
                            page_number, path
                        ),
                    })
                path = []
                continue
            if operator == b"Do" and operands:
                reference = xobjects.get(operands[0])
                if reference is None:
                    raise SalesFolderSanitizationError(f"Missing XObject {operands[0]}")
                obj = reference.get_object()
                if str(obj.get("/Subtype") or "") == "/Form":
                    identity = id(obj)
                    if identity in active_forms:
                        raise SalesFolderSanitizationError("Recursive Form XObject is not supported")
                    active_forms.add(identity)
                    walk(obj, page_number, layer)
                    active_forms.remove(identity)

    for page_number, page in enumerate(reader.pages, 1):
        walk(page, page_number, None)
    return output


def _describe_source_bytes(
    source_bytes: bytes,
    geometry: dict[str, Any],
    finish_key: str,
    *,
    include_text: bool = False,
) -> dict[str, Any] | tuple[dict[str, Any], str]:
    if finish_key not in SUPPORTED_FINISHES:
        raise SalesFolderSanitizationError(f"Unsupported finish: {finish_key}")
    reader = PdfReader(io.BytesIO(source_bytes), strict=True)
    text = normalized_extracted_text(reader)
    measurements = detected_production_measurements(text)
    boxes = page_box_inventory(reader)
    events = list(iter_source_events(reader))
    layer_names = sorted({event["layer"] for event in events if event["kind"] == "layer"})
    color_descriptors = sorted({
        event["descriptor"] for event in events if event["kind"] == "color"
    })
    spots = all_source_colorants(reader)
    source_sha256 = sha256_bytes(source_bytes)
    geometry_binding = {
        "sourceSha256": source_sha256,
        "geometry": geometry,
        "finishKey": finish_key,
    }
    observed = {
        "schemaVersion": SCHEMA_VERSION,
        "reviewState": "candidate_requires_human_review",
        "geometry": geometry,
        "finishKey": finish_key,
        "sourceEvidence": {
            "sha256": source_sha256,
            "geometryBinding": geometry_binding,
            "geometryBindingSha256": sha256_json(geometry_binding),
            "pageCount": len(reader.pages),
            "pageBoxes": boxes,
            "pageBoxesSha256": sha256_json(boxes),
            "textSha256": sha256_bytes(text.encode("utf-8")),
            "textPreview": text[:1000],
            "layerNames": layer_names,
            "layerInventorySha256": sha256_json(layer_names),
            "colorDescriptors": color_descriptors,
            "colorInventorySha256": sha256_json(color_descriptors),
            "spotColorants": spots,
            "spotPaintUsage": spot_paint_usage(reader),
            "productionMeasurements": measurements,
            "fillPaintObjects": device_fill_paint_inventory(reader),
            "paintingFeatures": painting_feature_inventory(reader),
            "geometryFingerprints": geometry_inventory(reader),
        },
        "layers": [
            {
                "name": name,
                "action": "REVIEW_REQUIRED",
                "role": "REVIEW_REQUIRED",
                "outputNameDa": "REVIEW_REQUIRED",
            }
            for name in layer_names
        ],
        "requiredGeometryRoles": ["cut", "fold", "bleed", "safety"],
        "productionMeasurements": measurements,
        "sourceText": {
            "sha256": sha256_bytes(text.encode("utf-8")),
            "requiredPatterns": ["REVIEW_REQUIRED"],
        },
        "colors": {
            "allowedDescriptors": color_descriptors,
            "noPrintAreas": [],
            "generatedNoPrintBackgrounds": [],
        },
        "spotFinish": {
            "required": False,
            "allowedColorants": spots,
            "requiredColorants": [],
            "requiredLayerNames": [],
            "minimumPaintOperators": 0,
        },
        "finishInstructions": [],
        "professionalUploadWarningDa": (
            PROFESSIONAL_UPLOAD_WARNING_DA if finish_key in SPOT_FINISHES else None
        ),
        "informationPanels": [],
        "geometryAudit": {
            "reportSha256": "REVIEW_REQUIRED",
            "bindingKey": "REVIEW_REQUIRED",
        },
        "geometrySupplement": None,
        "templateResolutionPlan": None,
        "verifiedBeschnittGuideDonor": None,
        "review": {
            "reviewer": "",
            "reviewedAt": "",
            "note": "Review every layer, color, text fingerprint, no-print object, and panel rectangle.",
        },
    }
    if include_text:
        return observed, text
    return observed


def describe_source(source: Path, geometry: dict[str, Any], finish_key: str) -> dict[str, Any]:
    observed = _describe_source_bytes(
        read_regular_bytes(source, "Source PDF"), geometry, finish_key
    )
    if not isinstance(observed, dict):  # pragma: no cover - static narrowing guard
        raise SalesFolderSanitizationError("Internal source-description result is invalid")
    return observed


def validate_geometry(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SalesFolderSanitizationError("Contract geometry must be an object")
    expected_keys = {"format", "construction", "print", "spineMm"}
    if set(value) != expected_keys:
        raise SalesFolderSanitizationError(
            "Contract geometry must contain exactly format, construction, print, and spineMm"
        )
    geometry = {
        "format": str(value["format"]),
        "construction": str(value["construction"]),
        "print": str(value["print"]),
        "spineMm": int(value["spineMm"]),
    }
    if geometry["format"] not in SUPPORTED_FORMATS:
        raise SalesFolderSanitizationError(f"Unsupported format: {geometry['format']}")
    if geometry["construction"] not in SUPPORTED_CONSTRUCTIONS:
        raise SalesFolderSanitizationError(f"Unsupported construction: {geometry['construction']}")
    if geometry["print"] not in SUPPORTED_PRINTS:
        raise SalesFolderSanitizationError(f"Unsupported print mode: {geometry['print']}")
    if geometry["spineMm"] not in SUPPORTED_SPINES:
        raise SalesFolderSanitizationError(f"Unsupported spine: {geometry['spineMm']}")
    return geometry


def validate_geometry_audit(
    contract: dict[str, Any],
    source: Path,
    audit_path: Path,
    supplement_path: Path | None = None,
    resolution_plan_path: Path | None = None,
    validation_cache: BatchValidationCache | None = None,
) -> dict[str, Any]:
    if audit_path.is_symlink() or not audit_path.is_file():
        raise SalesFolderSanitizationError("Geometry audit must be a regular non-symlink JSON file")
    reviewed = contract.get("geometryAudit")
    if not isinstance(reviewed, dict) or set(reviewed) != {"reportSha256", "bindingKey"}:
        raise SalesFolderSanitizationError("Contract geometryAudit binding is missing or invalid")
    if validation_cache is None:
        report_bytes = read_regular_bytes(audit_path, "Geometry audit")
        report_sha = sha256_bytes(report_bytes)
        try:
            report = json.loads(report_bytes.decode("utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SalesFolderSanitizationError(
                f"Cannot read geometry-audit report: {exc}"
            ) from exc
    else:
        report_bytes, report_sha, report = validation_cache.read_json(
            audit_path, "Geometry audit"
        )
    if reviewed["reportSha256"] != report_sha:
        raise SalesFolderSanitizationError("Geometry-audit report SHA-256 differs from reviewed contract")
    if report.get("schemaVersion") != 1 or not isinstance(report.get("bindingAudits"), list):
        raise SalesFolderSanitizationError("Geometry-audit report schema is invalid")
    matches = [
        item for item in report["bindingAudits"]
        if isinstance(item, dict) and item.get("bindingKey") == reviewed["bindingKey"]
    ]
    if len(matches) != 1:
        raise SalesFolderSanitizationError(
            f"Geometry-audit report contains {len(matches)} exact binding matches; expected one"
        )
    audit = matches[0]
    source_sha = (
        sha256_file(source)
        if validation_cache is None
        else validation_cache.read_bytes(source, "Source PDF")[1]
    )
    geometry = contract["geometry"]
    expected = audit.get("expectedGeometry")
    expected_contract_geometry = {
        "format": geometry["format"],
        "construction": geometry["construction"],
        "print": geometry["print"],
        "spine": geometry["spineMm"],
    }
    if not isinstance(expected, dict) or any(
        expected.get(key) != value for key, value in expected_contract_geometry.items()
    ) or expected.get("problems") not in ([], None):
        raise SalesFolderSanitizationError("Geometry-audit tuple differs from reviewed contract tuple")
    if audit.get("finishKey") != contract["finishKey"]:
        raise SalesFolderSanitizationError("Geometry-audit finish differs from reviewed contract finish")
    strict_ready = (
        audit.get("geometryVerified") is True
        and audit.get("templateReadyForSanitization") is True
        and audit.get("templateReadyForImport") is False
        and audit.get("blockers") == []
    )
    supplement_binding = contract.get("geometrySupplement")
    resolution_binding = contract.get("templateResolutionPlan")
    if strict_ready:
        if audit.get("templateSha256") != source_sha:
            raise SalesFolderSanitizationError(
                "Geometry-audit template SHA-256 differs from exact source PDF"
            )
        if supplement_binding is not None or supplement_path is not None:
            raise SalesFolderSanitizationError(
                "A geometry supplement is not permitted for an already verified base binding"
            )
        if resolution_binding is not None or resolution_plan_path is not None:
            raise SalesFolderSanitizationError(
                "A template-resolution plan is not permitted for an already verified base binding"
            )
        return {
            "reportSha256": report_sha,
            "binding": audit,
            "resolvedBinding": audit,
            "supplement": None,
            "resolutionPlan": None,
        }
    if (resolution_binding is None) != (resolution_plan_path is None):
        raise SalesFolderSanitizationError(
            "Blocked resolution requires both the contract binding and template-resolution-plan file"
        )
    if resolution_binding is not None and resolution_plan_path is not None:
        resolved = validate_template_resolution_plan(
            contract,
            source,
            source_sha,
            report,
            report_sha,
            len(report_bytes),
            audit,
            resolution_binding,
            resolution_plan_path,
            supplement_binding,
            supplement_path,
            validation_cache,
        )
        return {
            "reportSha256": report_sha,
            "binding": audit,
            "resolvedBinding": resolved["resolvedBinding"],
            "supplement": resolved["supplement"],
            "resolutionPlan": resolved["resolutionPlan"],
        }
    if audit.get("templateSha256") != source_sha:
        raise SalesFolderSanitizationError(
            "Geometry-audit template SHA-256 differs from exact source PDF"
        )
    if supplement_binding is None or supplement_path is None:
        raise SalesFolderSanitizationError(
            "Exact geometry-audit binding is blocked or not sanitizer-ready"
        )
    supplement = validate_geometry_supplement(
        contract,
        source,
        source_sha,
        report_sha,
        audit,
        supplement_binding,
        supplement_path,
        validation_cache,
    )
    return {
        "reportSha256": report_sha,
        "binding": audit,
        "resolvedBinding": audit,
        "supplement": supplement,
        "resolutionPlan": None,
    }


def valid_sha256(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None


def exact_keys(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise SalesFolderSanitizationError(f"{label} schema is invalid")
    return value


def validate_reviewed_at(value: Any, label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise SalesFolderSanitizationError(f"{label} reviewedAt is missing")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SalesFolderSanitizationError(f"{label} reviewedAt is not ISO-8601") from exc
    if parsed.tzinfo is None:
        raise SalesFolderSanitizationError(f"{label} reviewedAt must include a timezone")


def expected_geometry_key(geometry: dict[str, Any]) -> str:
    spine = geometry.get("spine", geometry.get("spineMm"))
    return (
        f"{geometry['format']}|{geometry['construction']}|"
        f"{geometry['print']}|{int(spine)}mm"
    )


def audit_blocker_codes(audit: dict[str, Any]) -> list[str]:
    blockers = audit.get("blockers")
    if not isinstance(blockers, list) or any(not isinstance(item, dict) for item in blockers):
        raise SalesFolderSanitizationError("Geometry-audit blockers schema is invalid")
    codes = [str(item.get("code") or "") for item in blockers]
    if any(not code for code in codes) or len(codes) != len(set(codes)):
        raise SalesFolderSanitizationError("Geometry-audit blocker codes are missing or duplicated")
    return sorted(codes)


def audit_state(audit: dict[str, Any]) -> dict[str, Any]:
    return {
        "geometryVerified": audit.get("geometryVerified"),
        "templateReadyForSanitization": audit.get("templateReadyForSanitization"),
        "templateReadyForImport": audit.get("templateReadyForImport"),
        "blockerCodes": audit_blocker_codes(audit),
    }


def audit_identity(audit: dict[str, Any]) -> dict[str, Any]:
    return {
        "bindingKey": audit.get("bindingKey"),
        "sourceUrl": audit.get("templateSourceUrl"),
        "localRelativePath": audit.get("templateLocalRelativePath"),
        "sha256": audit.get("templateSha256"),
    }


def validate_relative_evidence_path(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value or "\\" in value:
        raise SalesFolderSanitizationError(f"{label} path is invalid")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise SalesFolderSanitizationError(f"{label} path is not a safe relative path")
    return value


def validate_template_identity(value: Any, label: str) -> dict[str, Any]:
    identity = exact_keys(
        value,
        {"bindingKey", "sourceUrl", "localRelativePath", "sha256"},
        f"{label} template identity",
    )
    if not isinstance(identity["bindingKey"], str) or not identity["bindingKey"]:
        raise SalesFolderSanitizationError(f"{label} bindingKey is missing")
    if (
        not isinstance(identity["sourceUrl"], str)
        or not identity["sourceUrl"].startswith("https://www.wir-machen-druck.de/")
    ):
        raise SalesFolderSanitizationError(f"{label} source URL is not an exact WMD HTTPS URL")
    validate_relative_evidence_path(identity["localRelativePath"], label)
    if not valid_sha256(identity["sha256"]):
        raise SalesFolderSanitizationError(f"{label} template SHA-256 is invalid")
    return identity


def validate_audit_tuple(audit: dict[str, Any], contract: dict[str, Any], label: str) -> str:
    expected = audit.get("expectedGeometry")
    geometry = contract["geometry"]
    expected_contract = {
        "format": geometry["format"],
        "construction": geometry["construction"],
        "print": geometry["print"],
        "spine": geometry["spineMm"],
    }
    if not isinstance(expected, dict) or any(
        expected.get(key) != value for key, value in expected_contract.items()
    ) or expected.get("problems") not in ([], None):
        raise SalesFolderSanitizationError(f"{label} tuple differs from the exact contract tuple")
    key = expected_geometry_key(expected_contract)
    if audit.get("expectedGeometryKey") not in (None, key):
        raise SalesFolderSanitizationError(f"{label} expectedGeometryKey is inconsistent")
    if audit.get("finishKey") != contract["finishKey"]:
        raise SalesFolderSanitizationError(f"{label} finish differs from the contract")
    return key


def audit_row_by_binding(report: dict[str, Any], binding_key: str, label: str) -> dict[str, Any]:
    matches = [
        row for row in report.get("bindingAudits", [])
        if isinstance(row, dict) and row.get("bindingKey") == binding_key
    ]
    if len(matches) != 1:
        raise SalesFolderSanitizationError(
            f"{label} resolves to {len(matches)} base-audit rows; expected exactly one"
        )
    return matches[0]


def validate_evidence_file(value: Any, label: str, *, with_role: bool = False) -> dict[str, Any]:
    keys = {"path", "sha256", "bytes"} | ({"role"} if with_role else set())
    evidence = exact_keys(value, keys, f"{label} evidence file")
    validate_relative_evidence_path(evidence["path"], label)
    if with_role and (not isinstance(evidence["role"], str) or not evidence["role"]):
        raise SalesFolderSanitizationError(f"{label} role is missing")
    if not valid_sha256(evidence["sha256"]):
        raise SalesFolderSanitizationError(f"{label} SHA-256 is invalid")
    if not isinstance(evidence["bytes"], int) or evidence["bytes"] <= 0:
        raise SalesFolderSanitizationError(f"{label} byte count is invalid")
    return evidence


def read_scoped_plan_evidence(
    plan_path: Path,
    evidence: dict[str, Any],
    *,
    exact_relative_path: str,
    label: str,
) -> bytes:
    """Read one hash-bound run artifact without permitting path substitution."""
    if evidence["path"] != exact_relative_path:
        raise SalesFolderSanitizationError(
            f"{label} path must remain exactly {exact_relative_path}"
        )
    if plan_path.name != "template-resolution-plan.json":
        raise SalesFolderSanitizationError(
            "Scoped template-resolution plan has an unexpected filename"
        )
    if plan_path.parent.name == "review":
        run_root = plan_path.parent.parent
        expected_plan = run_root / "review/template-resolution-plan.json"
    elif (
        plan_path.parent.name == "approved-template-package"
        and plan_path.parent.parent.name == "review"
    ):
        run_root = plan_path.parent.parent.parent
        expected_plan = (
            run_root / "review/approved-template-package/template-resolution-plan.json"
        )
    else:
        raise SalesFolderSanitizationError(
            "Scoped template-resolution plan must remain at the exact pending or approved review path"
        )
    if (
        plan_path.is_symlink()
        or not plan_path.is_file()
        or expected_plan.resolve(strict=True) != plan_path.resolve(strict=True)
        or any(
            cursor.is_symlink()
            for cursor in (
                run_root / "review",
                *(
                    [run_root / "review/approved-template-package"]
                    if plan_path.parent.name == "approved-template-package"
                    else []
                ),
            )
        )
    ):
        raise SalesFolderSanitizationError(
            "Scoped template-resolution plan path is not an exact non-symlink review artifact"
        )
    root_resolved = run_root.resolve(strict=True)
    candidate = run_root.joinpath(*PurePosixPath(exact_relative_path).parts)
    cursor = run_root
    for part in PurePosixPath(exact_relative_path).parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise SalesFolderSanitizationError(
                f"{label} must not contain a symlink path component"
            )
    try:
        resolved = candidate.resolve(strict=True)
    except FileNotFoundError as exc:
        raise SalesFolderSanitizationError(f"{label} file is missing") from exc
    if (
        os.path.commonpath((str(root_resolved), str(resolved))) != str(root_resolved)
        or not resolved.is_file()
    ):
        raise SalesFolderSanitizationError(
            f"{label} must be a regular file inside the reviewed run"
        )
    data = read_regular_bytes(resolved, label)
    if len(data) != evidence["bytes"] or sha256_bytes(data) != evidence["sha256"]:
        raise SalesFolderSanitizationError(
            f"{label} bytes or SHA-256 differ from the approved plan"
        )
    return data


def projection_selection_key(match: dict[str, Any]) -> str:
    axes = ("folder_model", "print", "spine", "paper", "finish")
    return "|".join(
        f"{axis}={urllib.parse.quote(str(match[axis]), safe=URI_COMPONENT_SAFE)}"
        for axis in axes
    )


def validate_cd_scoped_projection(
    catalog_scope: Any,
    source_scope_projection: Any,
    report: dict[str, Any],
    projection_evidence: dict[str, Any],
    plan_path: Path,
) -> dict[str, Any]:
    """Prove the sole approved omission is the exact 52-binding CD product."""
    if catalog_scope != CD_SCOPE_EXPECTED_CATALOG:
        raise SalesFolderSanitizationError(
            "Catalog scope is not the exact approved CD-model/CD-Tasche exclusion"
        )
    if source_scope_projection != CD_SCOPE_EXPECTED_SOURCE_PROJECTION:
        raise SalesFolderSanitizationError(
            "Source scope projection differs from the immutable 3744-to-3692 CD exclusion"
        )

    audits = report.get("bindingAudits")
    if (
        not isinstance(audits, list)
        or len(audits) != CD_SCOPE_RAW_BINDING_COUNT
        or any(not isinstance(row, dict) for row in audits)
    ):
        raise SalesFolderSanitizationError(
            "Scoped plan requires the complete immutable 3744-binding base audit"
        )
    audit_by_binding: dict[str, dict[str, Any]] = {}
    excluded_binding_keys: set[str] = set()
    excluded_source_products: set[str] = set()
    for row in audits:
        binding_key = row.get("bindingKey")
        if not isinstance(binding_key, str) or not binding_key or binding_key in audit_by_binding:
            raise SalesFolderSanitizationError(
                "Scoped plan base audit has a missing or duplicate binding key"
            )
        audit_by_binding[binding_key] = row
        expected = row.get("expectedGeometry")
        if not isinstance(expected, dict):
            raise SalesFolderSanitizationError(
                "Scoped plan base audit contains a binding without expected geometry"
            )
        is_cd_format = expected.get("format") == "cd-135x135"
        is_exact_cd_model = (
            is_cd_format
            and expected.get("construction") == "2-part-closure"
            and expected.get("print") in SUPPORTED_PRINTS
            and expected.get("spine") == 3
            and expected.get("problems") in ([], None)
            and row.get("expectedGeometryKey")
                == expected_geometry_key(expected)
        )
        if is_cd_format and not is_exact_cd_model:
            raise SalesFolderSanitizationError(
                "Scoped plan base audit contains an unexpected CD geometry"
            )
        if is_exact_cd_model:
            source_url = row.get("sourceUrl")
            material_id = row.get("materialId")
            source_product_id = row.get("sourceProductId")
            if (
                not isinstance(source_url, str)
                or "mappe-fuer-cdverpackung-135-x-135-cm" not in source_url
                or not isinstance(material_id, str)
                or binding_key != f"{source_url}|{material_id}"
                or not isinstance(source_product_id, str)
                or not source_product_id
            ):
                raise SalesFolderSanitizationError(
                    "Excluded CD binding identity differs from immutable supplier evidence"
                )
            excluded_binding_keys.add(binding_key)
            excluded_source_products.add(source_product_id)
    if (
        len(excluded_binding_keys) != CD_SCOPE_EXCLUDED_BINDING_COUNT
        or len(excluded_source_products) != 20
    ):
        raise SalesFolderSanitizationError(
            "Base audit does not prove exactly 52 CD bindings across 20 source products"
        )
    proposed_binding_keys = set(audit_by_binding) - excluded_binding_keys
    if len(proposed_binding_keys) != CD_SCOPE_PROPOSED_BINDING_COUNT:
        raise SalesFolderSanitizationError(
            "Scoped proposed binding count does not reconcile to audit minus CD bindings"
        )

    data = read_scoped_plan_evidence(
        plan_path,
        projection_evidence,
        exact_relative_path="review/template-projection-stubs.jsonl",
        label="Template-projection stubs",
    )
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SalesFolderSanitizationError(
            "Template-projection stubs are not valid UTF-8"
        ) from exc
    raw_lines = text.splitlines()
    if len(raw_lines) != CD_SCOPE_PROPOSED_BINDING_COUNT or any(not line.strip() for line in raw_lines):
        raise SalesFolderSanitizationError(
            "Template-projection stubs do not contain exactly 3692 non-empty JSONL records"
        )
    expected_stub_keys = {
        "sourceOrder", "key", "match", "selectionConstraintProfile",
        "selectionConstraintSections", "selectionConstraintStatus",
        "structuredBinding", "sourceBinding", "guide", "template",
    }
    axis_keys = ["folder_model", "print", "spine", "paper", "finish"]
    stub_by_binding: dict[str, dict[str, str]] = {}
    seen_stub_keys: set[str] = set()
    seen_selection_keys: set[str] = set()
    for index, line in enumerate(raw_lines):
        try:
            stub = json.loads(line)
        except json.JSONDecodeError as exc:
            raise SalesFolderSanitizationError(
                f"Template-projection stub line {index + 1} is invalid JSON"
            ) from exc
        if not isinstance(stub, dict) or set(stub) != expected_stub_keys:
            raise SalesFolderSanitizationError(
                f"Template-projection stub line {index + 1} has an invalid schema"
            )
        source_binding = stub["sourceBinding"]
        match = stub["match"]
        structured = stub["structuredBinding"]
        template = stub["template"]
        if (
            stub["sourceOrder"] != index
            or not isinstance(stub["key"], str)
            or not stub["key"]
            or stub["key"] in seen_stub_keys
            or not isinstance(match, dict)
            or list(match) != axis_keys
            or any(not isinstance(match[axis], str) or not match[axis] for axis in axis_keys)
            or match["folder_model"] == CD_SCOPE_MODEL_KEY
            or stub["selectionConstraintProfile"] != "sales_folder_v1"
            or not isinstance(source_binding, dict)
            or not isinstance(template, dict)
            or not isinstance(structured, dict)
            or structured.get("profile") != "sales_folder_v1"
            or structured.get("semanticAxisKeys") != axis_keys
            or structured.get("semanticConstraints") != match
        ):
            raise SalesFolderSanitizationError(
                f"Template-projection stub line {index + 1} is not an exact five-axis sales-folder binding"
            )
        seen_stub_keys.add(stub["key"])
        source_url = source_binding.get("sourceUrl")
        material_id = source_binding.get("materialId")
        if (
            not isinstance(source_url, str)
            or not source_url.startswith("https://www.wir-machen-druck.de/")
            or not isinstance(material_id, str)
            or not material_id
        ):
            raise SalesFolderSanitizationError(
                f"Template-projection stub line {index + 1} has no exact supplier binding identity"
            )
        binding_key = f"{source_url}|{material_id}"
        if binding_key in stub_by_binding:
            raise SalesFolderSanitizationError(
                "Template-projection stubs duplicate a supplier binding"
            )
        audit = audit_by_binding.get(binding_key)
        expected = audit.get("expectedGeometry") if audit is not None else None
        expected_match = None
        if isinstance(expected, dict):
            expected_match = {
                "folder_model": f"{expected.get('format')}--{expected.get('construction')}",
                "print": expected.get("print"),
                "spine": f"{expected.get('spine')}mm",
                "paper": audit.get("paperKey"),
                "finish": audit.get("finishKey"),
            }
        if (
            binding_key not in proposed_binding_keys
            or expected_match != match
            or source_binding.get("sourceProductId") != audit.get("sourceProductId")
            or source_binding.get("sourceSku") != audit.get("sourceSku")
            or template.get("sourceUrl") != audit.get("templateSourceUrl")
        ):
            raise SalesFolderSanitizationError(
                "Template-projection stub differs from its immutable base-audit binding"
            )
        selection_key = projection_selection_key(match)
        if selection_key in seen_selection_keys:
            raise SalesFolderSanitizationError(
                "Template-projection stubs duplicate a five-axis selection"
            )
        seen_selection_keys.add(selection_key)
        stub_by_binding[binding_key] = {
            "selectionKey": selection_key,
            "stubKey": stub["key"],
        }
    if set(stub_by_binding) != proposed_binding_keys:
        raise SalesFolderSanitizationError(
            "Template-projection stubs are not exactly audit minus the 52 CD bindings"
        )
    return {
        "rawBindingKeys": set(audit_by_binding),
        "proposedBindingKeys": proposed_binding_keys,
        "excludedBindingKeys": excluded_binding_keys,
        "stubByBinding": stub_by_binding,
    }


def validate_scoped_resolution_coverage(
    scoped_projection: dict[str, Any],
    entry_by_binding: dict[str, dict[str, Any]],
    counts_by_classification: dict[str, int],
    extended_index: dict[str, Any],
) -> None:
    proposed_binding_keys = scoped_projection["proposedBindingKeys"]
    if set(entry_by_binding) != proposed_binding_keys:
        raise SalesFolderSanitizationError(
            "Scoped template-resolution classifications are not exactly audit minus the 52 CD bindings"
        )
    for binding_key, entry in entry_by_binding.items():
        stub = scoped_projection["stubByBinding"][binding_key]
        if entry["selectionKey"] != stub["selectionKey"]:
            raise SalesFolderSanitizationError(
                "Scoped template-resolution selection differs from its exact proposed stub"
            )
    derived_counts = {key: 0 for key in TEMPLATE_RESOLUTION_CLASSIFICATIONS}
    for entry in entry_by_binding.values():
        classification = entry.get("classification")
        if classification not in derived_counts:
            raise SalesFolderSanitizationError(
                "Scoped template-resolution contains an unknown classification"
            )
        derived_counts[classification] += 1
    if (
        derived_counts != counts_by_classification
        or counts_by_classification != CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED
    ):
        raise SalesFolderSanitizationError(
            "Scoped template-resolution classifications differ from the approved 3692-binding projection"
        )
    if (
        extended_index["familyCount"] != 4
        or not extended_index["coveredBindings"].issubset(proposed_binding_keys)
    ):
        raise SalesFolderSanitizationError(
            "Scoped extended evidence contains an excluded CD binding or family"
        )


def validate_all_false(value: Any, label: str) -> None:
    actions = exact_keys(value, PROHIBITED_RESOLUTION_ACTIONS, label)
    if any(actions[key] is not False for key in PROHIBITED_RESOLUTION_ACTIONS):
        raise SalesFolderSanitizationError(f"{label} records a prohibited mutation")


def validate_plan_base_state(value: Any, audit: dict[str, Any], label: str) -> None:
    state = exact_keys(
        value,
        {
            "geometryVerified", "templateReadyForSanitization",
            "templateReadyForImport", "blockerCodes",
        },
        f"{label} baseAuditState",
    )
    if state != audit_state(audit):
        raise SalesFolderSanitizationError(f"{label} base-audit state drifted")


def validate_plan_common_entry(
    entry: Any,
    report: dict[str, Any],
    base_audit_sha: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    expected_keys = {
        "bindingKey", "selectionKey", "classification", "expectedGeometryKey",
        "finishKey", "oldTemplate", "newTemplate", "reason", "entryReviewState",
        "sanitizerVerdictAfterApproval", "baseAuditState", "ambiguityResult",
        "aliasQuarantineResult", "evidence",
    }
    record = exact_keys(entry, expected_keys, "Template-resolution classification entry")
    for key in ("bindingKey", "selectionKey", "expectedGeometryKey", "finishKey", "reason"):
        if not isinstance(record[key], str) or not record[key]:
            raise SalesFolderSanitizationError(
                f"Template-resolution classification {key} is missing"
            )
    classification = record["classification"]
    if classification not in TEMPLATE_RESOLUTION_CLASSIFICATIONS:
        raise SalesFolderSanitizationError(
            f"Template-resolution classification is unresolved, excluded, or unknown: {classification}"
        )
    if record["entryReviewState"] != "approved":
        raise SalesFolderSanitizationError(
            f"Template-resolution entry {record['bindingKey']} is not approved"
        )
    expected_verdict = TEMPLATE_RESOLUTION_CLASSIFICATIONS[classification]
    verdict = record["sanitizerVerdictAfterApproval"]
    if isinstance(expected_verdict, set):
        verdict_ok = verdict in expected_verdict
    else:
        verdict_ok = verdict == expected_verdict
    if not verdict_ok:
        raise SalesFolderSanitizationError(
            f"Template-resolution verdict does not match classification {classification}"
        )
    if verdict is not None and verdict not in TEMPLATE_RESOLUTION_VERDICTS:
        raise SalesFolderSanitizationError("Template-resolution sanitizer verdict is unknown")
    old_identity = validate_template_identity(record["oldTemplate"], "Original")
    new_identity = validate_template_identity(record["newTemplate"], "Resolved")
    if old_identity["bindingKey"] != record["bindingKey"]:
        raise SalesFolderSanitizationError(
            "Template-resolution original bindingKey differs from classification bindingKey"
        )
    target_audit = audit_row_by_binding(report, record["bindingKey"], "Resolution target")
    if old_identity != audit_identity(target_audit):
        raise SalesFolderSanitizationError(
            "Template-resolution original source URL/path/hash differs from immutable base audit"
        )
    audit_expected = target_audit.get("expectedGeometry")
    if not isinstance(audit_expected, dict):
        raise SalesFolderSanitizationError("Resolution target has no expected geometry")
    audit_key = expected_geometry_key(audit_expected)
    if (
        record["expectedGeometryKey"] != audit_key
        or target_audit.get("expectedGeometryKey") not in (None, audit_key)
        or record["finishKey"] != target_audit.get("finishKey")
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution target geometry or finish differs from immutable base audit"
        )
    validate_plan_base_state(record["baseAuditState"], target_audit, "Resolution target")

    ambiguity = exact_keys(
        record["ambiguityResult"],
        {"status", "candidateTemplateIdentityCount", "candidateBindingKeys"},
        "Template-resolution ambiguityResult",
    )
    if (
        not isinstance(ambiguity["status"], str)
        or not ambiguity["status"].startswith(("passed_", "not_applicable_"))
        or not isinstance(ambiguity["candidateTemplateIdentityCount"], int)
        or ambiguity["candidateTemplateIdentityCount"] != 1
        or not isinstance(ambiguity["candidateBindingKeys"], list)
        or not ambiguity["candidateBindingKeys"]
        or len(ambiguity["candidateBindingKeys"]) != len(set(ambiguity["candidateBindingKeys"]))
        or any(not isinstance(item, str) or not item for item in ambiguity["candidateBindingKeys"])
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution ambiguity was not resolved to one exact identity"
        )
    quarantine = exact_keys(
        record["aliasQuarantineResult"],
        {"required", "status", "quarantinedBindingKeys"},
        "Template-resolution aliasQuarantineResult",
    )
    if (
        not isinstance(quarantine["required"], bool)
        or not isinstance(quarantine["status"], str)
        or not isinstance(quarantine["quarantinedBindingKeys"], list)
        or len(quarantine["quarantinedBindingKeys"])
            != len(set(quarantine["quarantinedBindingKeys"]))
        or any(not isinstance(item, str) or not item for item in quarantine["quarantinedBindingKeys"])
    ):
        raise SalesFolderSanitizationError("Template-resolution alias quarantine is invalid")

    evidence = exact_keys(
        record["evidence"],
        {
            "blockerCodes", "exactExpectedGeometryKey", "exactFinishKey",
            "sourceEvidenceBindingKeys", "dependencies", "resolutionFacts",
        },
        "Template-resolution evidence",
    )
    blockers = audit_blocker_codes(target_audit)
    if (
        evidence["blockerCodes"] != blockers
        or evidence["exactExpectedGeometryKey"] != audit_key
        or evidence["exactFinishKey"] != record["finishKey"]
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution blocker, geometry, or finish evidence drifted"
        )
    source_bindings = evidence["sourceEvidenceBindingKeys"]
    if (
        not isinstance(source_bindings, list)
        or not source_bindings
        or len(source_bindings) != len(set(source_bindings))
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution source evidence binding keys are missing or unstable"
        )
    dependencies = exact_keys(
        evidence["dependencies"],
        {
            "baseAuditSha256", "titleSupplementReportSha256",
            "titleSupplementEntrySha256s", "extendedEvidenceTargetSha256",
            "extendedEvidenceFamilySha256",
        },
        "Template-resolution dependencies",
    )
    if dependencies["baseAuditSha256"] != base_audit_sha:
        raise SalesFolderSanitizationError(
            "Template-resolution entry is bound to another base audit"
        )
    for key in (
        "titleSupplementReportSha256", "extendedEvidenceTargetSha256",
        "extendedEvidenceFamilySha256",
    ):
        if dependencies[key] is not None and not valid_sha256(dependencies[key]):
            raise SalesFolderSanitizationError(
                f"Template-resolution dependency {key} is invalid"
            )
    supplement_hashes = dependencies["titleSupplementEntrySha256s"]
    if (
        not isinstance(supplement_hashes, list)
        or supplement_hashes != sorted(set(supplement_hashes))
        or any(not valid_sha256(item) for item in supplement_hashes)
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution title-supplement entry hashes are invalid"
        )
    facts = exact_keys(
        evidence["resolutionFacts"],
        {
            "geometryAxesVerified", "sourceGeometryVerified", "supplementVerdict",
            "supplementReviewState", "renderedReviewStatus", "extendedFamilyKey",
            "extendedRequirements",
        },
        "Template-resolution resolutionFacts",
    )
    for key in ("geometryAxesVerified", "sourceGeometryVerified"):
        if facts[key] is not None and not isinstance(facts[key], bool):
            raise SalesFolderSanitizationError(
                f"Template-resolution resolution fact {key} is invalid"
            )
    for key in (
        "supplementVerdict", "supplementReviewState", "renderedReviewStatus",
        "extendedFamilyKey",
    ):
        if facts[key] is not None and (not isinstance(facts[key], str) or not facts[key]):
            raise SalesFolderSanitizationError(
                f"Template-resolution resolution fact {key} is invalid"
            )
    if (
        not isinstance(facts["extendedRequirements"], list)
        or facts["extendedRequirements"] != sorted(set(facts["extendedRequirements"]))
        or any(not isinstance(item, str) or not item for item in facts["extendedRequirements"])
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution extended requirements are invalid"
        )
    return record, target_audit


def validate_exact_fingerprint_sequence(
    value: Any,
    expected: list[dict[str, str]],
    expected_keys: set[str],
) -> None:
    """Validate the approved fingerprint index in its reviewed nested order."""
    identity_keys = expected_keys & {"familyKey", "targetKey"}
    if len(identity_keys) != 1:
        raise RuntimeError("Fingerprint schema has no unique identity key")
    identity_key = next(iter(identity_keys))
    if (
        not isinstance(value, list)
        or any(
            not isinstance(item, dict) or set(item) != expected_keys
            for item in value
        )
        or len({item[identity_key] for item in value}) != len(value)
        or value != expected
    ):
        raise SalesFolderSanitizationError(
            "Extended exact-evidence family or target fingerprints drifted"
        )


def validate_extended_resolution_evidence(
    value: Any,
    report: dict[str, Any],
    base_audit_sha: str,
    title_supplement_sha: str,
    input_extended_files: list[dict[str, Any]],
) -> dict[str, Any]:
    extended = exact_keys(
        value,
        {
            "kind", "schemaVersion", "reviewState", "baseAuditSha256",
            "titleSupplementSha256", "familyFingerprints", "targetFingerprints",
            "families", "prohibitedActionsPerformed",
        },
        "Extended exact-evidence",
    )
    if (
        extended["kind"] != "wmd_sales_folder_extended_exact_evidence"
        or extended["schemaVersion"] != 1
        or extended["reviewState"] != "approved"
        or extended["baseAuditSha256"] != base_audit_sha
        or extended["titleSupplementSha256"] != title_supplement_sha
    ):
        raise SalesFolderSanitizationError(
            "Extended exact-evidence is pending, malformed, or bound to other inputs"
        )
    validate_all_false(
        extended["prohibitedActionsPerformed"],
        "Extended exact-evidence prohibitedActionsPerformed",
    )
    families = extended["families"]
    if not isinstance(families, list) or len({
        item.get("familyKey") for item in families if isinstance(item, dict)
    }) != len(families):
        raise SalesFolderSanitizationError("Extended exact-evidence families are invalid")
    expected_family_fingerprints = []
    expected_target_fingerprints = []
    target_by_hash: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}
    family_by_hash: dict[str, dict[str, Any]] = {}
    covered_bindings: set[str] = set()
    available_files: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in input_extended_files:
        available_files[item["sha256"]].append(item)
    for family in families:
        family = exact_keys(
            family,
            {
                "familyKey", "baseBlockerCodes", "resolutionMode",
                "sanitizerVerdictAfterApproval", "requirements", "evidenceFiles",
                "targetEntries",
            },
            "Extended exact-evidence family",
        )
        if (
            not isinstance(family["familyKey"], str)
            or not family["familyKey"]
            or family["resolutionMode"] not in {"original", "rebind"}
            or family["sanitizerVerdictAfterApproval"] not in {
                "extended_exact_evidence_original", "extended_exact_evidence_rebind"
            }
            or family["sanitizerVerdictAfterApproval"]
                != f"extended_exact_evidence_{family['resolutionMode']}"
            or not isinstance(family["baseBlockerCodes"], list)
            or family["baseBlockerCodes"] != sorted(set(family["baseBlockerCodes"]))
            or not isinstance(family["requirements"], list)
            or len(family["requirements"]) != len(set(family["requirements"]))
            or any(not isinstance(item, str) or not item for item in family["requirements"])
            or not family["requirements"]
        ):
            raise SalesFolderSanitizationError("Extended exact-evidence family policy is invalid")
        evidence_files = family["evidenceFiles"]
        if not isinstance(evidence_files, list) or not evidence_files:
            raise SalesFolderSanitizationError(
                "Extended exact-evidence family has no evidence files"
            )
        validated_files = [
            validate_evidence_file(item, "Extended family", with_role=True)
            for item in evidence_files
        ]
        if len({canonical_json(item) for item in validated_files}) != len(validated_files):
            raise SalesFolderSanitizationError(
                "Extended exact-evidence family duplicates an exact evidence record"
            )
        for item in validated_files:
            input_matches = available_files.get(item["sha256"], [])
            accepted_roles = {item["role"], f"{family['familyKey']}:{item['role']}"}
            if not any(
                candidate["path"] == item["path"]
                and candidate["bytes"] == item["bytes"]
                and candidate["role"] in accepted_roles
                for candidate in input_matches
            ):
                raise SalesFolderSanitizationError(
                    "Extended family evidence file is absent from the plan input hashes"
                )
        targets = family["targetEntries"]
        if not isinstance(targets, list) or not targets:
            raise SalesFolderSanitizationError("Extended exact-evidence family has no targets")
        for target in targets:
            target = exact_keys(
                target,
                {
                    "targetKey", "expectedGeometryKey", "finishKey", "coveredBindingKeys",
                    "originalTemplate", "resolvedTemplate", "sourceEvidenceBindingKeys",
                    "evidenceFileSha256s", "baseAuditState", "ambiguityResult",
                    "aliasQuarantineResult", "entryReviewState", "verdict",
                },
                "Extended exact-evidence target",
            )
            original = validate_template_identity(target["originalTemplate"], "Extended original")
            resolved = validate_template_identity(target["resolvedTemplate"], "Extended resolved")
            ambiguity = exact_keys(
                target["ambiguityResult"],
                {"status", "candidateTemplateIdentityCount", "candidateBindingKeys"},
                "Extended target ambiguityResult",
            )
            quarantine = exact_keys(
                target["aliasQuarantineResult"],
                {"required", "status", "quarantinedBindingKeys"},
                "Extended target aliasQuarantineResult",
            )
            expected_ambiguity_status = (
                "passed_unique_original_identity"
                if family["resolutionMode"] == "original"
                else "passed_unique_hash_pinned_rebind_identity"
            )
            expected_quarantine = (
                (False, "not_applicable_original_retained")
                if family["resolutionMode"] == "original"
                else (True, "passed_bad_alias_replaced")
            )
            if (
                target["entryReviewState"] != "approved"
                or target["verdict"] != family["sanitizerVerdictAfterApproval"]
                or not isinstance(target["coveredBindingKeys"], list)
                or not target["coveredBindingKeys"]
                or len(target["coveredBindingKeys"])
                    != len(set(target["coveredBindingKeys"]))
                or not isinstance(target["sourceEvidenceBindingKeys"], list)
                or not target["sourceEvidenceBindingKeys"]
                or len(target["sourceEvidenceBindingKeys"])
                    != len(set(target["sourceEvidenceBindingKeys"]))
                or not isinstance(target["evidenceFileSha256s"], list)
                or Counter(target["evidenceFileSha256s"])
                    != Counter(item["sha256"] for item in validated_files)
                or target["targetKey"]
                    != f"{target['expectedGeometryKey']}|{target['finishKey']}|{original['sha256']}"
                or ((family["resolutionMode"] == "original") != (original == resolved))
                or ambiguity["status"] != expected_ambiguity_status
                or ambiguity["candidateTemplateIdentityCount"] != 1
                or not isinstance(ambiguity["candidateBindingKeys"], list)
                or not ambiguity["candidateBindingKeys"]
                or len(ambiguity["candidateBindingKeys"])
                    != len(set(ambiguity["candidateBindingKeys"]))
                or quarantine["required"] is not expected_quarantine[0]
                or quarantine["status"] != expected_quarantine[1]
                or not isinstance(quarantine["quarantinedBindingKeys"], list)
                or len(quarantine["quarantinedBindingKeys"])
                    != len(set(quarantine["quarantinedBindingKeys"]))
            ):
                raise SalesFolderSanitizationError(
                    "Extended exact-evidence target is pending, ambiguous, or internally inconsistent"
                )
            if original["bindingKey"] not in target["coveredBindingKeys"]:
                raise SalesFolderSanitizationError(
                    "Extended exact-evidence original binding is outside its covered bindings"
                )
            original_asset = {
                key: original[key] for key in ("sourceUrl", "localRelativePath", "sha256")
            }
            for binding_key in target["coveredBindingKeys"]:
                if binding_key in covered_bindings:
                    raise SalesFolderSanitizationError(
                        "Extended exact-evidence covers a binding more than once"
                    )
                target_audit = audit_row_by_binding(report, binding_key, "Extended target")
                if (
                    {
                        key: audit_identity(target_audit)[key]
                        for key in ("sourceUrl", "localRelativePath", "sha256")
                    } != original_asset
                    or expected_geometry_key(target_audit["expectedGeometry"])
                        != target["expectedGeometryKey"]
                    or target_audit.get("finishKey") != target["finishKey"]
                    or sorted(audit_blocker_codes(target_audit)) != family["baseBlockerCodes"]
                ):
                    raise SalesFolderSanitizationError(
                        "Extended exact-evidence target differs from immutable base audit"
                    )
                validate_plan_base_state(target["baseAuditState"], target_audit, "Extended target")
                covered_bindings.add(binding_key)
            target_hash = sha256_json(target)
            expected_target_fingerprints.append({
                "targetKey": target["targetKey"], "entrySha256": target_hash,
            })
            if target_hash in target_by_hash:
                raise SalesFolderSanitizationError(
                    "Extended exact-evidence duplicates a target hash"
                )
            target_by_hash[target_hash] = (family, target)
        family_hash = sha256_json(family)
        expected_family_fingerprints.append({
            "familyKey": family["familyKey"], "familySha256": family_hash,
        })
        if family_hash in family_by_hash:
            raise SalesFolderSanitizationError(
                "Extended exact-evidence duplicates a family hash"
            )
        family_by_hash[family_hash] = family
    # Fingerprints are an exact parallel index over the approved nested
    # family/target sequence.  Preserve that evidence order: lexical sorting
    # would incorrectly place e.g. ``10mm`` before ``3mm`` and detach the index
    # from the reviewed target graph even though every target hash is exact.
    validate_exact_fingerprint_sequence(
        extended["familyFingerprints"],
        expected_family_fingerprints,
        {"familyKey", "familySha256"},
    )
    validate_exact_fingerprint_sequence(
        extended["targetFingerprints"],
        expected_target_fingerprints,
        {"targetKey", "entrySha256"},
    )
    return {
        "familiesByHash": family_by_hash,
        "targetsByHash": target_by_hash,
        "coveredBindings": covered_bindings,
        "familyCount": len(families),
        "targetCount": len(expected_target_fingerprints),
    }


def _validate_template_resolution_plan_full(
    contract: dict[str, Any],
    source: Path,
    source_sha: str,
    report: dict[str, Any],
    base_audit_sha: str,
    base_audit_bytes: int,
    target_audit: dict[str, Any],
    plan_binding: Any,
    plan_path: Path,
    supplement_binding: Any,
    supplement_path: Path | None,
) -> dict[str, Any]:
    if plan_path.is_symlink() or not plan_path.is_file():
        raise SalesFolderSanitizationError(
            "Template-resolution plan must be a regular non-symlink JSON file"
        )
    binding = exact_keys(
        plan_binding,
        {"reportSha256", "entrySha256"},
        "Contract templateResolutionPlan binding",
    )
    if not valid_sha256(binding["reportSha256"]) or not valid_sha256(binding["entrySha256"]):
        raise SalesFolderSanitizationError(
            "Contract templateResolutionPlan hashes are invalid"
        )
    plan_bytes = plan_path.read_bytes()
    plan_sha = sha256_bytes(plan_bytes)
    if plan_sha != binding["reportSha256"]:
        raise SalesFolderSanitizationError(
            "Template-resolution report SHA-256 differs from reviewed contract"
        )
    try:
        plan = json.loads(plan_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SalesFolderSanitizationError(f"Cannot read template-resolution plan: {exc}") from exc
    base_plan_keys = {
        "kind", "schemaVersion", "reviewState", "approval", "approvalContract",
        "approvedEntryHashes", "inputEvidence", "resolutionPolicy", "counts",
        "filteredCandidates", "extendedEvidence", "bindingClassificationFingerprints",
        "bindingClassifications", "prohibitedActionsPerformed", "nextGate",
    }
    actual_plan_keys = set(plan) if isinstance(plan, dict) else set()
    scoped_key_count = len(actual_plan_keys & SCOPED_PLAN_KEYS)
    if scoped_key_count not in {0, len(SCOPED_PLAN_KEYS)}:
        raise SalesFolderSanitizationError(
            "Template-resolution plan must contain both scope records or neither"
        )
    is_scoped_plan = scoped_key_count == len(SCOPED_PLAN_KEYS)
    plan = exact_keys(
        plan,
        base_plan_keys | (SCOPED_PLAN_KEYS if is_scoped_plan else set()),
        "Template-resolution plan",
    )
    if (
        plan["kind"] != "wmd_sales_folder_template_resolution_plan"
        or plan["schemaVersion"] != 1
        or plan["reviewState"] != "approved"
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution plan is pending, malformed, or not approved"
        )
    approval = exact_keys(
        plan["approval"], {"approved", "reviewer", "reviewedAt"},
        "Template-resolution approval",
    )
    if approval["approved"] is not True or not str(approval["reviewer"] or "").strip():
        raise SalesFolderSanitizationError(
            "Template-resolution plan lacks explicit human approval"
        )
    validate_reviewed_at(approval["reviewedAt"], "Template-resolution approval")
    approval_contract = exact_keys(
        plan["approvalContract"],
        {
            "currentArtifactMayAuthorizeSanitization", "requiredArtifactReviewState",
            "requiredEntryReviewState", "requireNonEmptyReviewer", "requireIsoReviewedAt",
            "approvedEntryHashesMustExactlyMatchFingerprints", "inputHashesMustRemainEqual",
            "pendingSupplementRequiresPlanRegenerationAfterApproval",
        },
        "Template-resolution approvalContract",
    )
    expected_approval_contract = {
        "currentArtifactMayAuthorizeSanitization": True,
        "requiredArtifactReviewState": "approved",
        "requiredEntryReviewState": "approved",
        "requireNonEmptyReviewer": True,
        "requireIsoReviewedAt": True,
        "approvedEntryHashesMustExactlyMatchFingerprints": True,
        "inputHashesMustRemainEqual": True,
        "pendingSupplementRequiresPlanRegenerationAfterApproval": True,
    }
    if approval_contract != expected_approval_contract:
        raise SalesFolderSanitizationError(
            "Template-resolution approval contract does not authorize sanitization"
        )
    policy = exact_keys(
        plan["resolutionPolicy"],
        {
            "exactRebindAxes", "baseVerifiedRequiresStrictAuditPass",
            "pendingTitleOnlyRequiresExactSupplementCoverage",
            "indirectPendingRebindMayUseOnlyExactSupplementCoveredSources",
            "extendedEvidenceRequiresExactFamilyAndFileHashes",
            "crossGeometryAliasReuseAllowed",
            "unresolvedSelectionsWithheldFromStorefrontAndDesigner", "pricesRecalculated",
            "proposalMutated",
        },
        "Template-resolution policy",
    )
    expected_policy = {
        "exactRebindAxes": ["expectedGeometryKey", "finishKey"],
        "baseVerifiedRequiresStrictAuditPass": True,
        "pendingTitleOnlyRequiresExactSupplementCoverage": True,
        "indirectPendingRebindMayUseOnlyExactSupplementCoveredSources": True,
        "extendedEvidenceRequiresExactFamilyAndFileHashes": True,
        "crossGeometryAliasReuseAllowed": False,
        "unresolvedSelectionsWithheldFromStorefrontAndDesigner": True,
        "pricesRecalculated": False,
        "proposalMutated": False,
    }
    if policy != expected_policy:
        raise SalesFolderSanitizationError("Template-resolution policy was weakened or changed")
    validate_all_false(
        plan["prohibitedActionsPerformed"],
        "Template-resolution prohibitedActionsPerformed",
    )

    inputs = exact_keys(
        plan["inputEvidence"],
        {
            "baseAudit", "geometrySupplement", "templateProjectionStubs",
            "proposedCompatibility", "proposedPriceRows", "extendedEvidenceFiles",
        },
        "Template-resolution inputEvidence",
    )
    base_input = validate_evidence_file(inputs["baseAudit"], "Base audit")
    if base_input["sha256"] != base_audit_sha or base_input["bytes"] != base_audit_bytes:
        raise SalesFolderSanitizationError(
            "Template-resolution plan is bound to another immutable base audit"
        )
    validated_inputs = {
        key: validate_evidence_file(inputs[key], key)
        for key in (
            "geometrySupplement", "templateProjectionStubs",
            "proposedCompatibility", "proposedPriceRows",
        )
    }
    extended_input_files = inputs["extendedEvidenceFiles"]
    if not isinstance(extended_input_files, list):
        raise SalesFolderSanitizationError(
            "Template-resolution extendedEvidenceFiles must be an array"
        )
    validated_extended_inputs = [
        validate_evidence_file(item, "Extended input", with_role=True)
        for item in extended_input_files
    ]
    if len({canonical_json(item) for item in validated_extended_inputs}) != len(validated_extended_inputs):
        raise SalesFolderSanitizationError(
            "Template-resolution inputEvidence duplicates an extended evidence file"
        )
    scoped_projection = None
    if is_scoped_plan:
        base_evidence_bytes = read_scoped_plan_evidence(
            plan_path,
            base_input,
            exact_relative_path="review/template-geometry-audit.json",
            label="Immutable base audit",
        )
        if (
            len(base_evidence_bytes) != base_audit_bytes
            or sha256_bytes(base_evidence_bytes) != base_audit_sha
        ):
            raise SalesFolderSanitizationError(
                "Scoped plan raw base-audit evidence was mutated or substituted"
            )
        scoped_projection = validate_cd_scoped_projection(
            plan["catalogScope"],
            plan["sourceScopeProjection"],
            report,
            validated_inputs["templateProjectionStubs"],
            plan_path,
        )
    title_supplement_sha = inputs["geometrySupplement"]["sha256"]
    extended_index = validate_extended_resolution_evidence(
        plan["extendedEvidence"],
        report,
        base_audit_sha,
        title_supplement_sha,
        validated_extended_inputs,
    )

    entries = plan["bindingClassifications"]
    if not isinstance(entries, list) or not entries:
        raise SalesFolderSanitizationError(
            "Template-resolution plan contains no binding classifications"
        )
    validated_entries: list[dict[str, Any]] = []
    entry_by_binding: dict[str, dict[str, Any]] = {}
    entry_by_hash: dict[str, dict[str, Any]] = {}
    expected_fingerprints: list[dict[str, str]] = []
    counts_by_classification = {
        key: 0 for key in TEMPLATE_RESOLUTION_CLASSIFICATIONS
    }
    for raw_entry in entries:
        entry, entry_audit = validate_plan_common_entry(raw_entry, report, base_audit_sha)
        if entry["bindingKey"] in entry_by_binding:
            raise SalesFolderSanitizationError(
                "Template-resolution plan classifies a binding more than once"
            )
        entry_hash = sha256_json(entry)
        if entry_hash in entry_by_hash:
            raise SalesFolderSanitizationError(
                "Template-resolution plan duplicates a classification hash"
            )
        entry_by_binding[entry["bindingKey"]] = entry
        entry_by_hash[entry_hash] = entry
        validated_entries.append(entry)
        counts_by_classification[entry["classification"]] += 1
        expected_fingerprints.append({
            "bindingKey": entry["bindingKey"], "entrySha256": entry_hash,
        })

        new_audit = audit_row_by_binding(
            report, entry["newTemplate"]["bindingKey"], "Resolution source"
        )
        if audit_identity(new_audit) != entry["newTemplate"]:
            raise SalesFolderSanitizationError(
                "Template-resolution resolved source URL/path/hash differs from immutable base audit"
            )
        new_key = expected_geometry_key(new_audit["expectedGeometry"])
        finish_agnostic_resolution = False
        if entry["classification"] == "extended_exact_evidence":
            family_hash = entry["evidence"]["dependencies"]["extendedEvidenceFamilySha256"]
            finish_agnostic_family = extended_index["familiesByHash"].get(family_hash)
            finish_agnostic_resolution = (
                finish_agnostic_family is not None
                and finish_agnostic_family["familyKey"]
                    == FINISH_AGNOSTIC_EXTENDED_FAMILY_KEY
                and set(finish_agnostic_family["requirements"])
                    == FINISH_AGNOSTIC_EXTENDED_REQUIREMENTS
                and finish_agnostic_family["resolutionMode"] == "rebind"
            )
        source_finish_matches = new_audit.get("finishKey") == entry["finishKey"]
        if not source_finish_matches:
            source_finish_matches = finish_agnostic_resolution
        if new_key != entry["expectedGeometryKey"] or not source_finish_matches:
            raise SalesFolderSanitizationError(
                "Template-resolution resolved source geometry or finish drifted"
            )
        for evidence_binding in entry["evidence"]["sourceEvidenceBindingKeys"]:
            evidence_audit = audit_row_by_binding(report, evidence_binding, "Resolution evidence")
            if (
                expected_geometry_key(evidence_audit["expectedGeometry"])
                    != entry["expectedGeometryKey"]
                or (
                    evidence_audit.get("finishKey") != entry["finishKey"]
                    and not finish_agnostic_resolution
                )
            ):
                raise SalesFolderSanitizationError(
                    "Template-resolution source evidence crosses geometry or finish axes"
                )

        classification = entry["classification"]
        verdict = entry["sanitizerVerdictAfterApproval"]
        blockers = set(entry["evidence"]["blockerCodes"])
        ambiguity = entry["ambiguityResult"]
        quarantine = entry["aliasQuarantineResult"]
        dependencies = entry["evidence"]["dependencies"]
        facts = entry["evidence"]["resolutionFacts"]
        empty_nonbase_dependencies = (
            dependencies["titleSupplementReportSha256"] is None
            and dependencies["titleSupplementEntrySha256s"] == []
            and dependencies["extendedEvidenceTargetSha256"] is None
            and dependencies["extendedEvidenceFamilySha256"] is None
        )
        if classification == "base_verified":
            if (
                entry["newTemplate"] != entry["oldTemplate"]
                or blockers
                or audit_state(entry_audit) != {
                    "geometryVerified": True,
                    "templateReadyForSanitization": True,
                    "templateReadyForImport": False,
                    "blockerCodes": [],
                }
                or ambiguity["status"] != "not_applicable_base_verified"
                or quarantine != {
                    "required": False,
                    "status": "not_applicable_base_verified",
                    "quarantinedBindingKeys": [],
                }
                or not empty_nonbase_dependencies
            ):
                raise SalesFolderSanitizationError("Approved base_verified classification drifted")
        elif classification == "pending_title_only":
            if (
                entry["newTemplate"] != entry["oldTemplate"]
                or blockers != {
                    "PDF_TEXT_CONSTRUCTION_MISMATCH", "CONSTRUCTION_SOURCE_CONFLICT"
                }
                or ambiguity["status"] != "passed_unique_pending_supplement_entry"
                or quarantine["required"] is not False
                or dependencies["titleSupplementReportSha256"] != title_supplement_sha
                or not dependencies["titleSupplementEntrySha256s"]
            ):
                raise SalesFolderSanitizationError("Approved title-only classification drifted")
        elif classification == "exact_verified_rebind":
            if (
                blockers != REUSED_SPINE_ALIAS_BLOCKERS
                or entry["newTemplate"] == entry["oldTemplate"]
                or ambiguity["status"] != "passed_unique_base_verified_identity"
                or quarantine != {
                    "required": True,
                    "status": "passed_bad_alias_replaced",
                    "quarantinedBindingKeys": [entry["bindingKey"]],
                }
                or not empty_nonbase_dependencies
                or facts["sourceGeometryVerified"] is not True
                or audit_state(new_audit) != {
                    "geometryVerified": True,
                    "templateReadyForSanitization": True,
                    "templateReadyForImport": False,
                    "blockerCodes": [],
                }
            ):
                raise SalesFolderSanitizationError("Approved exact verified rebind drifted")
        elif classification == "collateral_original_after_bad_alias_quarantine":
            if (
                blockers != PURE_REUSE_BLOCKERS
                or entry["newTemplate"] != entry["oldTemplate"]
                or ambiguity["status"] != "passed_unique_original_identity"
                or quarantine["required"] is not True
                or quarantine["status"] != "passed_cross_geometry_aliases_rebound_or_withheld"
                or not empty_nonbase_dependencies
                or facts["geometryAxesVerified"] is not True
                or facts["sourceGeometryVerified"] is not True
            ):
                raise SalesFolderSanitizationError("Approved collateral original drifted")
        elif classification == "indirect_pending_title_rebind":
            if (
                verdict != "indirect_approved_title_rebind"
                or blockers != REUSED_SPINE_ALIAS_BLOCKERS
                or entry["newTemplate"] == entry["oldTemplate"]
                or ambiguity["status"] != "passed_unique_pending_supplement_identity"
                or quarantine != {
                    "required": True,
                    "status": "passed_bad_alias_replaced",
                    "quarantinedBindingKeys": [entry["bindingKey"]],
                }
                or dependencies["titleSupplementReportSha256"] != title_supplement_sha
                or not dependencies["titleSupplementEntrySha256s"]
                or dependencies["extendedEvidenceTargetSha256"] is not None
                or dependencies["extendedEvidenceFamilySha256"] is not None
                or set(audit_blocker_codes(new_audit)) != {
                    "PDF_TEXT_CONSTRUCTION_MISMATCH", "CONSTRUCTION_SOURCE_CONFLICT"
                }
                or facts["supplementVerdict"] != "title_only_construction_text_error"
            ):
                raise SalesFolderSanitizationError("Approved indirect title rebind drifted")
        elif classification == "extended_exact_evidence":
            target_hash = dependencies["extendedEvidenceTargetSha256"]
            family_hash = dependencies["extendedEvidenceFamilySha256"]
            target_pair = extended_index["targetsByHash"].get(target_hash)
            family = extended_index["familiesByHash"].get(family_hash)
            if target_pair is None or family is None or target_pair[0] is not family:
                raise SalesFolderSanitizationError(
                    "Extended classification dependency hashes do not select one exact family target"
                )
            target = target_pair[1]
            if (
                entry["bindingKey"] not in target["coveredBindingKeys"]
                or entry["expectedGeometryKey"] != target["expectedGeometryKey"]
                or entry["finishKey"] != target["finishKey"]
                or {
                    key: entry["oldTemplate"][key]
                    for key in ("sourceUrl", "localRelativePath", "sha256")
                } != {
                    key: target["originalTemplate"][key]
                    for key in ("sourceUrl", "localRelativePath", "sha256")
                }
                or entry["newTemplate"] != target["resolvedTemplate"]
                or verdict != target["verdict"]
                or entry["baseAuditState"] != target["baseAuditState"]
                or entry["ambiguityResult"] != target["ambiguityResult"]
                or entry["aliasQuarantineResult"] != target["aliasQuarantineResult"]
                or facts["extendedFamilyKey"] != family["familyKey"]
                or facts["extendedRequirements"] != sorted(family["requirements"])
                or dependencies["titleSupplementReportSha256"] is not None
                or dependencies["titleSupplementEntrySha256s"] != []
            ):
                raise SalesFolderSanitizationError(
                    "Extended classification differs from its approved family target"
                )

    audit_bindings = [
        row.get("bindingKey") for row in report["bindingAudits"] if isinstance(row, dict)
    ]
    if len(audit_bindings) != len(set(audit_bindings)):
        raise SalesFolderSanitizationError(
            "Immutable base audit contains duplicate binding keys"
        )
    if scoped_projection is None and set(entry_by_binding) != set(audit_bindings):
        raise SalesFolderSanitizationError(
            "Approved template-resolution plan does not classify every base-audit binding exactly once"
        )
    if scoped_projection is not None:
        validate_scoped_resolution_coverage(
            scoped_projection,
            entry_by_binding,
            counts_by_classification,
            extended_index,
        )
    if plan["bindingClassificationFingerprints"] != expected_fingerprints:
        raise SalesFolderSanitizationError(
            "Template-resolution classification fingerprints drifted"
        )
    approved_hashes = [item["entrySha256"] for item in expected_fingerprints]
    if plan["approvedEntryHashes"] != approved_hashes:
        raise SalesFolderSanitizationError(
            "Template-resolution approvedEntryHashes do not exactly match all fingerprints"
        )
    selected = entry_by_hash.get(binding["entrySha256"])
    if selected is None or selected["bindingKey"] != target_audit.get("bindingKey"):
        raise SalesFolderSanitizationError(
            "Template-resolution entry hash does not select the exact contract binding"
        )
    if selected["sanitizerVerdictAfterApproval"] not in TEMPLATE_RESOLUTION_VERDICTS:
        raise SalesFolderSanitizationError(
            "Selected plan entry is base-only, title-only, unresolved, or excluded"
        )

    # Recompute the collateral quarantine boundary from the immutable audit and
    # the approved classifications rather than trusting a human-entered list.
    for entry in validated_entries:
        if entry["classification"] != "collateral_original_after_bad_alias_quarantine":
            continue
        aliases = sorted(
            row["bindingKey"]
            for row in report["bindingAudits"]
            if isinstance(row, dict)
            and audit_identity(row)["sourceUrl"] == entry["oldTemplate"]["sourceUrl"]
            and audit_identity(row)["localRelativePath"] == entry["oldTemplate"]["localRelativePath"]
            and audit_identity(row)["sha256"] == entry["oldTemplate"]["sha256"]
            and expected_geometry_key(row["expectedGeometry"]) != entry["expectedGeometryKey"]
        )
        if (
            not aliases
            or set(aliases)
                != set(entry["aliasQuarantineResult"]["quarantinedBindingKeys"])
        ):
            raise SalesFolderSanitizationError(
                "Collateral original alias-quarantine list differs from immutable audit"
            )
        for alias in aliases:
            alias_entry = entry_by_binding.get(alias)
            if (
                alias_entry is None
                or alias_entry["classification"] not in {
                    "exact_verified_rebind", "indirect_pending_title_rebind",
                    "extended_exact_evidence",
                }
                or alias_entry["newTemplate"] == alias_entry["oldTemplate"]
            ):
                raise SalesFolderSanitizationError(
                    "Collateral cross-geometry alias was not independently rebound"
                )

    counts = exact_keys(
        plan["counts"],
        {
            "totalBindings", "classifications", "baseVerifiedBindings",
            "recoveredBindingsPendingReview", "extendedEvidenceFamilies",
            "extendedEvidenceTargets", "unresolvedBindings",
        },
        "Template-resolution counts",
    )
    if (
        exact_keys(
            counts["classifications"], set(TEMPLATE_RESOLUTION_CLASSIFICATIONS),
            "Template-resolution classification counts",
        ) != counts_by_classification
        or counts["totalBindings"] != len(validated_entries)
        or counts["baseVerifiedBindings"] != counts_by_classification["base_verified"]
        or counts["extendedEvidenceFamilies"] != extended_index["familyCount"]
        or counts["extendedEvidenceTargets"] != extended_index["targetCount"]
        or counts["unresolvedBindings"] != 0
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution counts are unresolved or do not reconcile"
        )
    filtered = exact_keys(
        plan["filteredCandidates"],
        {
            "policy", "templateProjection", "compatibility", "proposedPriceRows",
            "pendingReviewBoundary", "candidateBindingKeys",
        },
        "Template-resolution filteredCandidates",
    )
    filtered_counts: dict[str, dict[str, Any]] = {}
    for key, exact in (
        ("templateProjection", {"inputBindings", "candidateBindings", "withheldBindings"}),
        ("compatibility", {"inputSelections", "candidateSelections", "withheldSelections"}),
        ("proposedPriceRows", {"inputRows", "candidateRows", "withheldRows"}),
    ):
        item = exact_keys(filtered[key], exact, f"Template-resolution {key}")
        filtered_counts[key] = item
        if item["withheldBindings" if key == "templateProjection" else (
            "withheldSelections" if key == "compatibility" else "withheldRows"
        )] != 0:
            raise SalesFolderSanitizationError(
                "Template-resolution plan still contains withheld candidates"
            )
    exact_keys(
        filtered["pendingReviewBoundary"],
        {
            "candidateDoesNotMeanApproved", "nonBaseRecoveryBindingsPendingReview",
            "titleOnlyBindingsPendingReview",
            "indirectRebindBindingsPendingTitleOnlyDependency",
            "extendedEvidenceBindingsPendingReview",
        },
        "Template-resolution pendingReviewBoundary",
    )
    if filtered["candidateBindingKeys"] != [entry["bindingKey"] for entry in validated_entries]:
        raise SalesFolderSanitizationError(
            "Template-resolution candidate binding coverage drifted"
        )
    if scoped_projection is not None and filtered_counts != {
        "templateProjection": {
            "inputBindings": 3692, "candidateBindings": 3692, "withheldBindings": 0,
        },
        "compatibility": {
            "inputSelections": 3692, "candidateSelections": 3692, "withheldSelections": 0,
        },
        "proposedPriceRows": {
            "inputRows": 108348, "candidateRows": 108348, "withheldRows": 0,
        },
    }:
        raise SalesFolderSanitizationError(
            "Scoped filtered-candidate counts differ from the exact CD-excluded proposal"
        )

    contract_key = expected_geometry_key({
        "format": contract["geometry"]["format"],
        "construction": contract["geometry"]["construction"],
        "print": contract["geometry"]["print"],
        "spine": contract["geometry"]["spineMm"],
    })
    if selected["expectedGeometryKey"] != contract_key or selected["finishKey"] != contract["finishKey"]:
        raise SalesFolderSanitizationError(
            "Selected template-resolution entry geometry or finish differs from contract"
        )
    if selected["newTemplate"]["sha256"] != source_sha:
        raise SalesFolderSanitizationError(
            "Selected template-resolution source SHA-256 differs from exact source PDF"
        )
    resolved_audit = audit_row_by_binding(
        report, selected["newTemplate"]["bindingKey"], "Selected resolution source"
    )
    if audit_identity(resolved_audit) != selected["newTemplate"]:
        raise SalesFolderSanitizationError(
            "Selected template-resolution source URL/path/hash drifted"
        )
    verdict = selected["sanitizerVerdictAfterApproval"]
    supplement = None
    if verdict == "indirect_approved_title_rebind":
        if supplement_binding is None or supplement_path is None:
            raise SalesFolderSanitizationError(
                "Indirect approved title rebind requires its separately approved geometry supplement"
            )
        dependencies = selected["evidence"]["dependencies"]
        if supplement_binding.get("reportSha256") != dependencies["titleSupplementReportSha256"]:
            raise SalesFolderSanitizationError(
                "Indirect rebind contract supplement differs from approved plan dependency"
            )
        supplement = validate_geometry_supplement(
            contract,
            source,
            source_sha,
            base_audit_sha,
            resolved_audit,
            supplement_binding,
            supplement_path,
        )
        if supplement["entrySha256"] not in dependencies["titleSupplementEntrySha256s"]:
            raise SalesFolderSanitizationError(
                "Indirect rebind supplement entry is not an exact approved plan dependency"
            )
    elif supplement_binding is not None or supplement_path is not None:
        raise SalesFolderSanitizationError(
            "Geometry supplement is permitted only for the indirect approved title-rebind verdict"
        )
    return {
        "resolvedBinding": resolved_audit,
        "supplement": supplement,
        "resolutionPlan": {
            "reportSha256": plan_sha,
            "entrySha256": binding["entrySha256"],
            "verdict": verdict,
            "targetBindingKey": selected["bindingKey"],
            "resolvedBindingKey": selected["newTemplate"]["bindingKey"],
        },
    }


def _resolution_plan_cache_key(
    validation_cache: BatchValidationCache,
    plan_path: Path,
    plan: Any,
    plan_sha: str,
    report_sha: str,
    report_bytes: int,
) -> tuple[Any, ...]:
    """Bind a global-plan proof to every file it actually reads."""

    dependency_identities: list[tuple[str, str, int]] = []
    if isinstance(plan, dict) and SCOPED_PLAN_KEYS.issubset(plan):
        inputs = plan.get("inputEvidence")
        if not isinstance(inputs, dict):
            raise SalesFolderSanitizationError(
                "Template-resolution inputEvidence is invalid"
            )
        for input_key, exact_path, label in (
            ("baseAudit", "review/template-geometry-audit.json", "Immutable base audit"),
            (
                "templateProjectionStubs",
                "review/template-projection-stubs.jsonl",
                "Template projection stubs",
            ),
        ):
            evidence = validate_evidence_file(inputs.get(input_key), label)
            data = read_scoped_plan_evidence(
                plan_path,
                evidence,
                exact_relative_path=exact_path,
                label=label,
            )
            dependency_identities.append((exact_path, sha256_bytes(data), len(data)))
    return (
        str(plan_path.resolve()),
        plan_sha,
        report_sha,
        report_bytes,
        tuple(dependency_identities),
    )


def _validate_cached_template_resolution_selection(
    context: dict[str, Any],
    contract: dict[str, Any],
    source: Path,
    source_sha: str,
    target_audit: dict[str, Any],
    plan_binding: Any,
    supplement_binding: Any,
    supplement_path: Path | None,
    validation_cache: BatchValidationCache,
) -> dict[str, Any]:
    """Repeat every contract-specific check after one exact global graph proof."""

    binding = exact_keys(
        plan_binding,
        {"reportSha256", "entrySha256"},
        "Contract templateResolutionPlan binding",
    )
    if (
        not valid_sha256(binding["reportSha256"])
        or not valid_sha256(binding["entrySha256"])
        or binding["reportSha256"] != context["planSha256"]
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution report SHA-256 differs from reviewed contract"
        )
    selected = context["entryByHash"].get(binding["entrySha256"])
    if selected is None or selected["bindingKey"] != target_audit.get("bindingKey"):
        raise SalesFolderSanitizationError(
            "Template-resolution entry hash does not select the exact contract binding"
        )
    if selected["sanitizerVerdictAfterApproval"] not in TEMPLATE_RESOLUTION_VERDICTS:
        raise SalesFolderSanitizationError(
            "Selected plan entry is base-only, title-only, unresolved, or excluded"
        )
    contract_key = expected_geometry_key({
        "format": contract["geometry"]["format"],
        "construction": contract["geometry"]["construction"],
        "print": contract["geometry"]["print"],
        "spine": contract["geometry"]["spineMm"],
    })
    if (
        selected["expectedGeometryKey"] != contract_key
        or selected["finishKey"] != contract["finishKey"]
    ):
        raise SalesFolderSanitizationError(
            "Selected template-resolution entry geometry or finish differs from contract"
        )
    if selected["newTemplate"]["sha256"] != source_sha:
        raise SalesFolderSanitizationError(
            "Selected template-resolution source SHA-256 differs from exact source PDF"
        )
    report = context["report"]
    resolved_audit = audit_row_by_binding(
        report, selected["newTemplate"]["bindingKey"], "Selected resolution source"
    )
    if audit_identity(resolved_audit) != selected["newTemplate"]:
        raise SalesFolderSanitizationError(
            "Selected template-resolution source URL/path/hash drifted"
        )
    verdict = selected["sanitizerVerdictAfterApproval"]
    supplement = None
    if verdict == "indirect_approved_title_rebind":
        if supplement_binding is None or supplement_path is None:
            raise SalesFolderSanitizationError(
                "Indirect approved title rebind requires its separately approved geometry supplement"
            )
        dependencies = selected["evidence"]["dependencies"]
        if supplement_binding.get("reportSha256") != dependencies["titleSupplementReportSha256"]:
            raise SalesFolderSanitizationError(
                "Indirect rebind contract supplement differs from approved plan dependency"
            )
        supplement = validate_geometry_supplement(
            contract,
            source,
            source_sha,
            context["baseAuditSha256"],
            resolved_audit,
            supplement_binding,
            supplement_path,
            validation_cache,
        )
        if supplement["entrySha256"] not in dependencies["titleSupplementEntrySha256s"]:
            raise SalesFolderSanitizationError(
                "Indirect rebind supplement entry is not an exact approved plan dependency"
            )
    elif supplement_binding is not None or supplement_path is not None:
        raise SalesFolderSanitizationError(
            "Geometry supplement is permitted only for the indirect approved title-rebind verdict"
        )
    return {
        "resolvedBinding": resolved_audit,
        "supplement": supplement,
        "resolutionPlan": {
            "reportSha256": context["planSha256"],
            "entrySha256": binding["entrySha256"],
            "verdict": verdict,
            "targetBindingKey": selected["bindingKey"],
            "resolvedBindingKey": selected["newTemplate"]["bindingKey"],
        },
    }


def validate_template_resolution_plan(
    contract: dict[str, Any],
    source: Path,
    source_sha: str,
    report: dict[str, Any],
    base_audit_sha: str,
    base_audit_bytes: int,
    target_audit: dict[str, Any],
    plan_binding: Any,
    plan_path: Path,
    supplement_binding: Any,
    supplement_path: Path | None,
    validation_cache: BatchValidationCache | None = None,
) -> dict[str, Any]:
    if validation_cache is None:
        return _validate_template_resolution_plan_full(
            contract,
            source,
            source_sha,
            report,
            base_audit_sha,
            base_audit_bytes,
            target_audit,
            plan_binding,
            plan_path,
            supplement_binding,
            supplement_path,
        )

    plan_bytes, plan_sha, plan = validation_cache.read_json(
        plan_path, "Template-resolution plan"
    )
    cache_key = _resolution_plan_cache_key(
        validation_cache,
        plan_path,
        plan,
        plan_sha,
        base_audit_sha,
        base_audit_bytes,
    )
    context = validation_cache._resolution_plans.get(cache_key)
    if context is None:
        result = _validate_template_resolution_plan_full(
            contract,
            source,
            source_sha,
            report,
            base_audit_sha,
            base_audit_bytes,
            target_audit,
            plan_binding,
            plan_path,
            supplement_binding,
            supplement_path,
        )
        entries = plan.get("bindingClassifications") if isinstance(plan, dict) else None
        if not isinstance(entries, list):  # The full validator should already reject this.
            raise SalesFolderSanitizationError(
                "Template-resolution plan contains no binding classifications"
            )
        entry_by_hash = {sha256_json(entry): entry for entry in entries}
        if len(entry_by_hash) != len(entries):
            raise SalesFolderSanitizationError(
                "Template-resolution plan duplicates a classification hash"
            )
        validation_cache._resolution_plans[cache_key] = freeze_json({
            "planSha256": plan_sha,
            "baseAuditSha256": base_audit_sha,
            "report": report,
            "entryByHash": entry_by_hash,
        })
        return result
    return _validate_cached_template_resolution_selection(
        context,
        contract,
        source,
        source_sha,
        target_audit,
        plan_binding,
        supplement_binding,
        supplement_path,
        validation_cache,
    )


def validate_supplement_geometry(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"format", "construction", "print", "spine"}:
        raise SalesFolderSanitizationError("Geometry-supplement tuple has an invalid schema")
    return {
        "format": str(value["format"]),
        "construction": str(value["construction"]),
        "print": str(value["print"]),
        "spine": int(value["spine"]),
    }


def validate_comparison_fingerprint(
    value: Any,
    label: str,
    *,
    require_equal: bool,
    require_more_paths: bool = False,
    require_more_strokes: bool = False,
) -> None:
    expected_keys = {
        "sourceFingerprint", "counterpartFingerprint",
        "sourcePathOperatorCount", "counterpartPathOperatorCount",
        "sourceStrokePaintCount", "counterpartStrokePaintCount",
    }
    if not isinstance(value, dict) or set(value) != expected_keys:
        raise SalesFolderSanitizationError(f"Geometry-supplement {label} comparison schema is invalid")
    source_fingerprint = value["sourceFingerprint"]
    counterpart_fingerprint = value["counterpartFingerprint"]
    if not valid_sha256(source_fingerprint) or not valid_sha256(counterpart_fingerprint):
        raise SalesFolderSanitizationError(f"Geometry-supplement {label} fingerprint is invalid")
    if (source_fingerprint == counterpart_fingerprint) is not require_equal:
        expectation = "equal" if require_equal else "different"
        raise SalesFolderSanitizationError(
            f"Geometry-supplement {label} fingerprints must be {expectation}"
        )
    counts = {}
    for key in expected_keys - {"sourceFingerprint", "counterpartFingerprint"}:
        if not isinstance(value[key], int) or value[key] < 0:
            raise SalesFolderSanitizationError(
                f"Geometry-supplement {label} contains an invalid geometry count"
            )
        counts[key] = value[key]
    if require_more_paths and counts["counterpartPathOperatorCount"] <= counts["sourcePathOperatorCount"]:
        raise SalesFolderSanitizationError(
            f"Geometry-supplement {label} counterpart must contain more path operators"
        )
    if require_more_strokes and counts["counterpartStrokePaintCount"] <= counts["sourceStrokePaintCount"]:
        raise SalesFolderSanitizationError(
            f"Geometry-supplement {label} counterpart must contain more cut strokes"
        )


def validate_geometry_supplement(
    contract: dict[str, Any],
    source: Path,
    source_sha: str,
    base_audit_sha: str,
    audit: dict[str, Any],
    supplement_binding: Any,
    supplement_path: Path,
    validation_cache: BatchValidationCache | None = None,
) -> dict[str, Any]:
    if supplement_path.is_symlink() or not supplement_path.is_file():
        raise SalesFolderSanitizationError(
            "Geometry supplement must be a regular non-symlink JSON file"
        )
    if not isinstance(supplement_binding, dict) or set(supplement_binding) != {
        "reportSha256", "entrySha256"
    }:
        raise SalesFolderSanitizationError("Contract geometrySupplement binding is missing or invalid")
    if validation_cache is None:
        supplement_bytes = read_regular_bytes(
            supplement_path, "Geometry supplement"
        )
        supplement_sha = sha256_bytes(supplement_bytes)
        try:
            supplement = json.loads(supplement_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SalesFolderSanitizationError(
                f"Cannot read geometry supplement: {exc}"
            ) from exc
    else:
        supplement_bytes, supplement_sha, supplement = validation_cache.read_json(
            supplement_path, "Geometry supplement"
        )
    if supplement_binding["reportSha256"] != supplement_sha:
        raise SalesFolderSanitizationError(
            "Geometry-supplement report SHA-256 differs from reviewed contract"
        )
    if (
        supplement.get("kind") != "wmd_sales_folder_geometry_supplement"
        or supplement.get("schemaVersion") != 1
        or supplement.get("baseAuditSha256") != base_audit_sha
        or supplement.get("reviewState") != "approved_title_only_construction_text_error"
        or not str(supplement.get("reviewer") or "").strip()
        or not str(supplement.get("reviewedAt") or "").strip()
        or not isinstance(supplement.get("entries"), list)
    ):
        raise SalesFolderSanitizationError(
            "Geometry supplement is unreviewed, malformed, or bound to another base audit"
        )
    required_base_blockers = {
        "PDF_TEXT_CONSTRUCTION_MISMATCH",
        "CONSTRUCTION_SOURCE_CONFLICT",
    }
    base_blockers = audit.get("blockers")
    blocker_codes = {
        str(item.get("code") or "")
        for item in (base_blockers if isinstance(base_blockers, list) else [])
        if isinstance(item, dict)
    }
    if (
        not isinstance(base_blockers, list)
        or len(base_blockers) != 2
        or not all(isinstance(item, dict) for item in base_blockers)
        or len(blocker_codes) != 2
        or blocker_codes != required_base_blockers
        or audit.get("geometryVerified") is not False
        or audit.get("templateReadyForSanitization") is not False
        or audit.get("templateReadyForImport") is not False
    ):
        raise SalesFolderSanitizationError(
            "Geometry supplement cannot override print, spine, reuse, or non-title blockers"
        )
    entry_hash = supplement_binding["entrySha256"]
    if not valid_sha256(entry_hash):
        raise SalesFolderSanitizationError("Geometry-supplement entry SHA-256 is invalid")
    matches = [entry for entry in supplement["entries"] if sha256_json(entry) == entry_hash]
    if len(matches) != 1:
        raise SalesFolderSanitizationError(
            f"Geometry supplement contains {len(matches)} exact entry-hash matches; expected one"
        )
    entry = matches[0]
    expected_entry_keys = {
        "sourceTemplateSha256", "expectedGeometry", "finishKey",
        "coveredBindingKeys", "sourceTemplate", "verifiedWindowCounterpart",
        "baseBlockerAssessment", "comparisons", "renderedReviewEvidence", "verdict",
    }
    if not isinstance(entry, dict) or set(entry) != expected_entry_keys:
        raise SalesFolderSanitizationError("Geometry-supplement entry schema is invalid")
    geometry = contract["geometry"]
    expected_geometry = {
        "format": geometry["format"],
        "construction": geometry["construction"],
        "print": geometry["print"],
        "spine": geometry["spineMm"],
    }
    entry_geometry = validate_supplement_geometry(entry["expectedGeometry"])
    if entry_geometry != expected_geometry:
        raise SalesFolderSanitizationError(
            "Geometry-supplement tuple differs from the exact contract tuple"
        )
    non_window_constructions = {
        "2-part-standard", "2-part-2-flaps", "2-part-3-flaps"
    }
    if entry_geometry["construction"] not in non_window_constructions:
        raise SalesFolderSanitizationError(
            "Geometry supplement is restricted to manually reviewed non-window title errors"
        )
    blocker_assessment = entry["baseBlockerAssessment"]
    if (
        not isinstance(blocker_assessment, dict)
        or set(blocker_assessment) != {
            "blockerCodes", "constructionSourceConflictDerivedFromTitleMismatch"
        }
        or blocker_assessment["blockerCodes"] != [
            "PDF_TEXT_CONSTRUCTION_MISMATCH", "CONSTRUCTION_SOURCE_CONFLICT"
        ]
        or blocker_assessment["constructionSourceConflictDerivedFromTitleMismatch"] is not True
    ):
        raise SalesFolderSanitizationError(
            "Geometry supplement does not prove that the construction conflict derives from the title mismatch"
        )
    if entry["sourceTemplateSha256"] != source_sha or entry["finishKey"] != contract["finishKey"]:
        raise SalesFolderSanitizationError(
            "Geometry-supplement source hash or finish differs from the contract"
        )
    covered = entry["coveredBindingKeys"]
    if (
        not isinstance(covered, list)
        or not covered
        or len(set(covered)) != len(covered)
        or audit["bindingKey"] not in covered
        or any(not isinstance(item, str) or not item for item in covered)
    ):
        raise SalesFolderSanitizationError(
            "Geometry supplement does not cover the exact blocked binding key"
        )
    source_identity = entry["sourceTemplate"]
    if not isinstance(source_identity, dict) or set(source_identity) != {
        "sourceUrl", "localRelativePath", "sha256"
    }:
        raise SalesFolderSanitizationError("Geometry-supplement source identity schema is invalid")
    if (
        source_identity["sourceUrl"] != audit.get("templateSourceUrl")
        or source_identity["localRelativePath"] != audit.get("templateLocalRelativePath")
        or source_identity["sha256"] != source_sha
        or not str(source_identity["sourceUrl"]).startswith("https://www.wir-machen-druck.de/")
    ):
        raise SalesFolderSanitizationError(
            "Geometry-supplement source URL/path/hash differs from the base audit"
        )
    counterpart = entry["verifiedWindowCounterpart"]
    if not isinstance(counterpart, dict) or set(counterpart) != {
        "sourceUrl", "localRelativePath", "sha256", "geometry"
    }:
        raise SalesFolderSanitizationError("Geometry-supplement counterpart schema is invalid")
    counterpart_geometry = validate_supplement_geometry(counterpart["geometry"])
    expected_counterpart = {
        **entry_geometry,
        "construction": f"{entry_geometry['construction']}-window",
    }
    if (
        counterpart_geometry != expected_counterpart
        or not valid_sha256(counterpart["sha256"])
        or counterpart["sha256"] == source_sha
        or not str(counterpart["sourceUrl"]).startswith("https://www.wir-machen-druck.de/")
        or not str(counterpart["localRelativePath"] or "").strip()
    ):
        raise SalesFolderSanitizationError(
            "Geometry-supplement window counterpart is not exact or independently hashed"
        )
    comparisons = entry["comparisons"]
    if not isinstance(comparisons, dict) or set(comparisons) != {
        "pageBoxes", "rillen", "schneiden", "beschnitt"
    }:
        raise SalesFolderSanitizationError("Geometry-supplement comparison schema is invalid")
    page_boxes = comparisons["pageBoxes"]
    if not isinstance(page_boxes, dict) or set(page_boxes) != {
        "equal", "sourceSha256", "counterpartSha256"
    } or page_boxes["equal"] is not True or not valid_sha256(page_boxes["sourceSha256"]) \
            or page_boxes["sourceSha256"] != page_boxes["counterpartSha256"]:
        raise SalesFolderSanitizationError(
            "Geometry-supplement page boxes are not proven identical"
        )
    validate_comparison_fingerprint(
        comparisons["rillen"], "Rillen", require_equal=True
    )
    validate_comparison_fingerprint(
        comparisons["schneiden"], "Schneiden", require_equal=False,
        require_more_strokes=True,
    )
    validate_comparison_fingerprint(
        comparisons["beschnitt"], "Beschnitt", require_equal=False,
        require_more_paths=True,
    )
    source_reader = PdfReader(str(source), strict=True)
    source_page_boxes_sha = sha256_json(page_box_inventory(source_reader))
    if page_boxes["sourceSha256"] != source_page_boxes_sha:
        raise SalesFolderSanitizationError(
            "Geometry-supplement page-box fingerprint differs from the exact source PDF"
        )
    source_geometry = geometry_inventory(source_reader)
    for comparison_key, source_layer in (
        ("rillen", "Rillen"),
        ("schneiden", "Schneiden"),
        ("beschnitt", "Beschnitt Seite"),
    ):
        actual = source_geometry.get(source_layer)
        comparison = comparisons[comparison_key]
        if (
            actual is None
            or comparison["sourceFingerprint"] != actual["sha256"]
            or comparison["sourcePathOperatorCount"] != actual["pathOperatorCount"]
            or comparison["sourceStrokePaintCount"] != actual["strokePaintCount"]
        ):
            raise SalesFolderSanitizationError(
                f"Geometry-supplement {source_layer} evidence differs from the exact source PDF"
            )
    render = entry["renderedReviewEvidence"]
    if not isinstance(render, dict) or set(render) != {
        "status", "sourceRenderSha256s", "counterpartRenderSha256s",
        "sourceHasWindowCut", "counterpartHasWindowCut", "reviewerNote",
    }:
        raise SalesFolderSanitizationError("Geometry-supplement rendered-review schema is invalid")
    for key in ("sourceRenderSha256s", "counterpartRenderSha256s"):
        if (
            not isinstance(render[key], list)
            or not render[key]
            or any(not valid_sha256(item) for item in render[key])
        ):
            raise SalesFolderSanitizationError(
                "Geometry-supplement rendered-review hashes are missing or invalid"
            )
    if (
        render["status"] != "passed"
        or render["sourceHasWindowCut"] is not False
        or render["counterpartHasWindowCut"] is not True
        or not str(render["reviewerNote"] or "").strip()
        or entry["verdict"] != "title_only_construction_text_error"
    ):
        raise SalesFolderSanitizationError(
            "Geometry supplement lacks the exact rendered title-only-error verdict"
        )
    return {
        "reportSha256": supplement_sha,
        "entrySha256": entry_hash,
        "verdict": entry["verdict"],
    }


def run_root_from_geometry_audit(geometry_audit_path: Path) -> Path:
    if (
        geometry_audit_path.name != "template-geometry-audit.json"
        or geometry_audit_path.parent.name != "review"
    ):
        raise SalesFolderSanitizationError(
            "Geometry audit must remain at the exact run review path when a donor guide is used"
        )
    run_root = geometry_audit_path.parent.parent
    expected = run_root / "review/template-geometry-audit.json"
    if (
        geometry_audit_path.is_symlink()
        or geometry_audit_path.parent.is_symlink()
        or expected.resolve(strict=True) != geometry_audit_path.resolve(strict=True)
    ):
        raise SalesFolderSanitizationError(
            "Geometry audit path is not an exact non-symlink run artifact"
        )
    return run_root


def exact_run_artifact_path(
    run_root: Path,
    relative_path: str,
    label: str,
    *,
    must_equal: str | None = None,
) -> Path:
    validate_relative_evidence_path(relative_path, label)
    if must_equal is not None and relative_path != must_equal:
        raise SalesFolderSanitizationError(
            f"{label} path must remain exactly {must_equal}"
        )
    root_resolved = run_root.resolve(strict=True)
    cursor = run_root
    for part in PurePosixPath(relative_path).parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise SalesFolderSanitizationError(
                f"{label} must not contain a symlink path component"
            )
    try:
        resolved = cursor.resolve(strict=True)
    except FileNotFoundError as exc:
        raise SalesFolderSanitizationError(f"{label} is missing") from exc
    if (
        os.path.commonpath((str(root_resolved), str(resolved))) != str(root_resolved)
        or not resolved.is_file()
    ):
        raise SalesFolderSanitizationError(
            f"{label} must be a regular file inside the reviewed run"
        )
    return resolved


def path_list_digest(value: Any, label: str, *, ordered: bool) -> tuple[list[str], str]:
    if not isinstance(value, list) or any(not valid_sha256(item) for item in value):
        raise SalesFolderSanitizationError(f"{label} path list is invalid")
    values = list(value)
    digest = sha256_json(values if ordered else sorted(values))
    return values, digest


def exact_file_identity(value: Any, label: str) -> dict[str, Any]:
    identity = exact_keys(
        value, {"localRelativePath", "sha256", "bytes"}, f"{label} identity"
    )
    path = validate_relative_evidence_path(identity["localRelativePath"], label)
    if not path.startswith("documents/source-pdfs/") or not path.endswith(".pdf"):
        raise SalesFolderSanitizationError(
            f"{label} is outside the local source-PDF directory"
        )
    if not valid_sha256(identity["sha256"]):
        raise SalesFolderSanitizationError(f"{label} SHA-256 is invalid")
    if (
        not isinstance(identity["bytes"], int)
        or isinstance(identity["bytes"], bool)
        or identity["bytes"] <= 0
    ):
        raise SalesFolderSanitizationError(f"{label} byte count is invalid")
    return identity


def exact_stroke_summary(value: Any, label: str) -> dict[str, Any]:
    summary = exact_keys(
        value,
        {
            "layerName", "strokePaintCount", "orderedPathGeometrySha256s",
            "orderedSha256", "sortedMultisetSha256",
        },
        f"{label} stroke summary",
    )
    if summary["layerName"] != "Beschnitt Seite":
        raise SalesFolderSanitizationError(f"{label} must describe Beschnitt Seite")
    ordered, ordered_digest = path_list_digest(
        summary["orderedPathGeometrySha256s"], label, ordered=True
    )
    _, sorted_digest = path_list_digest(ordered, label, ordered=False)
    if (
        not isinstance(summary["strokePaintCount"], int)
        or isinstance(summary["strokePaintCount"], bool)
        or summary["strokePaintCount"] != len(ordered)
        or summary["orderedSha256"] != ordered_digest
        or summary["sortedMultisetSha256"] != sorted_digest
    ):
        raise SalesFolderSanitizationError(f"{label} stroke counts or digests are invalid")
    return summary


def exact_relation_summary(value: Any, label: str, layer_name: str) -> dict[str, Any]:
    relation = exact_keys(
        value,
        {
            "layerName", "sourceStrokeCount", "donorStrokeCount",
            "sourceSortedMultisetSha256", "donorSortedMultisetSha256",
            "exactMultisetEqual",
        },
        f"{label} relation",
    )
    if (
        relation["layerName"] != layer_name
        or not isinstance(relation["sourceStrokeCount"], int)
        or isinstance(relation["sourceStrokeCount"], bool)
        or not isinstance(relation["donorStrokeCount"], int)
        or isinstance(relation["donorStrokeCount"], bool)
        or relation["sourceStrokeCount"] < 1
        or relation["donorStrokeCount"] < 1
        or not valid_sha256(relation["sourceSortedMultisetSha256"])
        or not valid_sha256(relation["donorSortedMultisetSha256"])
        or relation["exactMultisetEqual"] is not True
        or relation["sourceStrokeCount"] != relation["donorStrokeCount"]
        or relation["sourceSortedMultisetSha256"]
        != relation["donorSortedMultisetSha256"]
    ):
        raise SalesFolderSanitizationError(f"{label} exact multiset proof is invalid")
    return relation


def source_only_in_paint_order(source: list[str], donor: list[str]) -> list[str]:
    remaining = Counter(source)
    remaining.subtract(Counter(donor))
    if any(value < 0 for value in remaining.values()):
        raise SalesFolderSanitizationError(
            "Donor Schneiden strokes are not an exact multiset subset of the source"
        )
    wanted = Counter({key: value for key, value in remaining.items() if value > 0})
    output: list[str] = []
    for value in source:
        if wanted[value] > 0:
            output.append(value)
            wanted[value] -= 1
    return output


def source_only_stroke_records_in_paint_order(
    source: list[dict[str, Any]],
    donor: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Retain the exact source occurrences left after hash-multiset subtraction."""

    remaining = Counter(item["pathGeometrySha256"] for item in donor)
    output: list[dict[str, Any]] = []
    for record in source:
        path_hash = record["pathGeometrySha256"]
        if remaining[path_hash] > 0:
            remaining[path_hash] -= 1
        else:
            output.append(record)
    if any(remaining.values()):
        raise SalesFolderSanitizationError(
            "Donor Schneiden strokes are not an exact multiset subset of the source"
        )
    return output


def exact_stroke_occurrence(
    records: list[dict[str, Any]],
    page: int,
    path_hash: str,
    effective_bbox: list[float],
    label: str,
) -> dict[str, Any]:
    """Resolve one reviewed page/hash/bbox occurrence without collapsing CTMs."""

    matches = [
        item for item in records
        if item["page"] == page
        and item["pathGeometrySha256"] == path_hash
        and item["effectiveBbox"] == effective_bbox
    ]
    if len(matches) != 1:
        raise SalesFolderSanitizationError(
            f"Verified Beschnitt donor {label} occurrence is missing or ambiguous"
        )
    return matches[0]


def full_media_box_contour(
    bbox: list[float],
    media_box: list[float],
    tolerance: float = BESCHNITT_OUTER_CONTOUR_TOLERANCE_PT,
) -> bool:
    return len(bbox) == 4 and all(
        abs(number(left) - number(right)) <= tolerance
        for left, right in zip(bbox, media_box)
    )


def validate_verified_beschnitt_guide_donor(
    contract: dict[str, Any],
    source: Path,
    geometry_audit_path: Path,
    observed: dict[str, Any],
    validation_cache: BatchValidationCache | None,
) -> dict[str, Any] | None:
    if "verifiedBeschnittGuideDonor" not in contract:
        raise SalesFolderSanitizationError(
            "Contract must explicitly set verifiedBeschnittGuideDonor to null or an approved binding"
        )
    binding = contract["verifiedBeschnittGuideDonor"]
    source_sha = observed["sourceEvidence"]["sha256"]
    requires_donor = source_sha in VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES
    if not requires_donor:
        if binding is not None:
            raise SalesFolderSanitizationError(
                "A Beschnitt donor is restricted to the five exact approved zero-stroke source PDFs"
            )
        return None
    binding = exact_keys(
        binding,
        {"reportSha256", "entrySha256"},
        "verifiedBeschnittGuideDonor binding",
    )
    if not valid_sha256(binding["reportSha256"]) or not valid_sha256(
        binding["entrySha256"]
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor binding hashes are invalid"
        )
    batch_evidence = contract.get("batchEvidence")
    if not isinstance(batch_evidence, dict):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor requires hash-pinned batchEvidence"
        )
    evidence = validate_evidence_file(
        batch_evidence.get("verifiedBeschnittGuideDonors"),
        "Verified Beschnitt donor report",
    )
    if (
        evidence["path"] != VERIFIED_BESCHNITT_GUIDE_DONOR_PATH
        or evidence["sha256"] != binding["reportSha256"]
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor report pin is not exact"
        )
    run_root = run_root_from_geometry_audit(geometry_audit_path)
    report_path = exact_run_artifact_path(
        run_root,
        evidence["path"],
        "Verified Beschnitt donor report",
        must_equal=VERIFIED_BESCHNITT_GUIDE_DONOR_PATH,
    )
    if validation_cache is None:
        report_bytes = read_regular_bytes(report_path, "Verified Beschnitt donor report")
        report_sha = sha256_bytes(report_bytes)
        try:
            report = json.loads(report_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SalesFolderSanitizationError(
                f"Cannot read verified Beschnitt donor report: {exc}"
            ) from exc
    else:
        report_bytes, report_sha, report = validation_cache.read_json(
            report_path, "Verified Beschnitt donor report"
        )
    if report_sha != evidence["sha256"] or len(report_bytes) != evidence["bytes"]:
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor report bytes or SHA-256 changed"
        )
    report = exact_keys(
        report,
        {
            "kind", "schemaVersion", "reviewState", "approval", "localOnly",
            "visualOutputQaPending", "eligibleForImport",
            "prohibitedActionsPerformed", "entries",
        },
        "Verified Beschnitt donor report",
    )
    approval = exact_keys(
        report["approval"],
        {"decisionMode", "individualJsonEntryReviewClaimed", "reviewer", "reviewedAt"},
        "Verified Beschnitt donor approval",
    )
    validate_reviewed_at(approval["reviewedAt"], "Verified Beschnitt donor approval")
    prohibited = exact_keys(
        report["prohibitedActionsPerformed"],
        {"uploaded", "databaseWritten", "productOrTemplateAttached", "published"},
        "Verified Beschnitt donor prohibited actions",
    )
    if (
        report["kind"] != VERIFIED_BESCHNITT_GUIDE_DONOR_KIND
        or report["schemaVersion"] != SCHEMA_VERSION
        or report["reviewState"]
        != "approved_user_directed_deterministic_correction"
        or approval["decisionMode"] != "user_directed_deterministic_correction"
        or approval["individualJsonEntryReviewClaimed"] is not False
        or not isinstance(approval["reviewer"], str)
        or not approval["reviewer"].strip()
        or report["localOnly"] is not True
        or report["visualOutputQaPending"] is not True
        or report["eligibleForImport"] is not False
        or any(value is not False for value in prohibited.values())
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor approval boundary is invalid"
        )
    entries = report["entries"]
    if (
        not isinstance(entries, list)
        or len(entries) != len(VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES)
        or any(not isinstance(item, dict) for item in entries)
        or entries != sorted(entries, key=lambda item: item.get("geometryKey", ""))
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor report must contain five geometry-sorted entries"
        )
    expected_entry_keys = {
        "entrySha256", "geometryKey", "source", "donor", "pageCount",
        "pageBoxesSha256", "sourceBeschnitt", "donorBeschnitt", "rillen",
        "schneiden", "importPolicy", "optionalAccessoryGeometryPreservedFromSource",
    }
    validated_entries: list[dict[str, Any]] = []
    seen_source_shas: set[str] = set()
    seen_geometry_keys: set[str] = set()
    for index, entry_value in enumerate(entries, 1):
        entry = exact_keys(
            entry_value, expected_entry_keys, f"Verified Beschnitt donor entry {index}"
        )
        entry_payload = {key: value for key, value in entry.items() if key != "entrySha256"}
        if (
            not valid_sha256(entry["entrySha256"])
            or entry["entrySha256"] != sha256_json(entry_payload)
        ):
            raise SalesFolderSanitizationError(
                f"Verified Beschnitt donor entry {index} fingerprint is invalid"
            )
        source_identity = exact_file_identity(entry["source"], f"Donor entry {index} source")
        donor_identity = exact_file_identity(entry["donor"], f"Donor entry {index} donor")
        if (
            source_identity["sha256"] in seen_source_shas
            or source_identity["sha256"] not in VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES
            or donor_identity["sha256"] == source_identity["sha256"]
            or not isinstance(entry["geometryKey"], str)
            or entry["geometryKey"] in seen_geometry_keys
        ):
            raise SalesFolderSanitizationError(
                "Verified Beschnitt donor entries are duplicated or outside the approved source set"
            )
        seen_source_shas.add(source_identity["sha256"])
        seen_geometry_keys.add(entry["geometryKey"])
        exact_stroke_summary(entry["sourceBeschnitt"], f"Donor entry {index} source")
        exact_stroke_summary(entry["donorBeschnitt"], f"Donor entry {index} donor")
        exact_relation_summary(entry["rillen"], f"Donor entry {index} Rillen", "Rillen")
        if (
            not isinstance(entry["pageCount"], int)
            or isinstance(entry["pageCount"], bool)
            or entry["pageCount"] != 2
            or not valid_sha256(entry["pageBoxesSha256"])
            or entry["optionalAccessoryGeometryPreservedFromSource"] is not True
        ):
            raise SalesFolderSanitizationError(
                f"Verified Beschnitt donor entry {index} page/accessory proof is invalid"
            )
        validated_entries.append(entry)
    if seen_source_shas != VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES:
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor report does not exactly cover the five approved sources"
        )
    matches = [
        entry for entry in validated_entries
        if entry["entrySha256"] == binding["entrySha256"]
    ]
    if len(matches) != 1:
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor binding does not resolve to exactly one report entry"
        )
    entry = matches[0]
    if (
        entry["source"]["sha256"] != source_sha
        or entry["geometryKey"] != expected_geometry_key(contract["geometry"])
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor entry differs from the exact source/geometry contract"
        )
    source_path = exact_run_artifact_path(
        run_root, entry["source"]["localRelativePath"], "Donor-bound original source"
    )
    donor_path = exact_run_artifact_path(
        run_root, entry["donor"]["localRelativePath"], "Verified Beschnitt donor PDF"
    )
    original_source_bytes = read_regular_bytes(source_path, "Donor-bound original source")
    donor_bytes = read_regular_bytes(donor_path, "Verified Beschnitt donor PDF")
    staged_source_bytes = read_regular_bytes(source, "Staged donor-bound source")
    for data, identity, label in (
        (original_source_bytes, entry["source"], "Donor-bound original source"),
        (donor_bytes, entry["donor"], "Verified Beschnitt donor PDF"),
    ):
        if len(data) != identity["bytes"] or sha256_bytes(data) != identity["sha256"]:
            raise SalesFolderSanitizationError(f"{label} bytes or SHA-256 changed")
    if staged_source_bytes != original_source_bytes:
        raise SalesFolderSanitizationError(
            "Staged source bytes differ from the exact donor-report source"
        )
    source_reader = PdfReader(io.BytesIO(original_source_bytes), strict=True)
    donor_reader = PdfReader(io.BytesIO(donor_bytes), strict=True)
    if len(source_reader.pages) != 2 or len(donor_reader.pages) != 2:
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor source and donor must each have exactly two pages"
        )
    source_boxes = page_box_inventory(source_reader)
    donor_boxes = page_box_inventory(donor_reader)
    if (
        source_boxes != donor_boxes
        or sha256_json(source_boxes) != entry["pageBoxesSha256"]
        or source_boxes != observed["sourceEvidence"]["pageBoxes"]
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor page boxes differ from the original source"
        )
    unsafe_donor_features = [
        item for item in painting_feature_inventory(donor_reader)
        if item["type"] != "image-xobject"
        or item.get("layer") == "Beschnitt Seite"
    ]
    if unsafe_donor_features:
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor guide uses unsupported rotation, origin, raster, pattern, shading, or transparency features"
        )
    source_beschnitt = _stroke_path_inventory(
        source_reader, "Beschnitt Seite", include_operations=True
    )
    donor_beschnitt = _stroke_path_inventory(
        donor_reader,
        "Beschnitt Seite",
        include_operations=True,
        include_ext_gstate=True,
    )
    donor_ext_gstates = {
        canonical_json(record.get("extGState", {}))
        for record in donor_beschnitt
    }
    allowed_donor_ext_gstates = {
        canonical_json({}),
        canonical_json(VERIFIED_BESCHNITT_DONOR_EXT_GSTATE),
    }
    if (
        len(donor_ext_gstates) != 1
        or not donor_ext_gstates.issubset(allowed_donor_ext_gstates)
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor strokes use an unapproved effective ExtGState"
        )
    source_rillen = stroke_path_inventory(source_reader, "Rillen")
    donor_rillen = stroke_path_inventory(donor_reader, "Rillen")
    source_schneiden = stroke_path_inventory(source_reader, "Schneiden")
    donor_schneiden = stroke_path_inventory(donor_reader, "Schneiden")

    def hashes(items: list[dict[str, Any]]) -> list[str]:
        return [item["pathGeometrySha256"] for item in items]

    source_beschnitt_hashes = hashes(source_beschnitt)
    donor_beschnitt_hashes = hashes(donor_beschnitt)
    source_rillen_hashes = hashes(source_rillen)
    donor_rillen_hashes = hashes(donor_rillen)
    source_cut_hashes = hashes(source_schneiden)
    donor_cut_hashes = hashes(donor_schneiden)
    for observed_hashes, summary, label in (
        (source_beschnitt_hashes, entry["sourceBeschnitt"], "source Beschnitt"),
        (donor_beschnitt_hashes, entry["donorBeschnitt"], "donor Beschnitt"),
    ):
        if (
            observed_hashes != summary["orderedPathGeometrySha256s"]
            or sha256_json(observed_hashes) != summary["orderedSha256"]
            or stroke_multiset_sha256(observed_hashes)
            != summary["sortedMultisetSha256"]
            or len(observed_hashes) != summary["strokePaintCount"]
        ):
            raise SalesFolderSanitizationError(
                f"Verified Beschnitt {label} strokes differ from the approved report"
            )
    if source_beschnitt_hashes or not donor_beschnitt_hashes:
        raise SalesFolderSanitizationError(
            "Donor recovery requires zero source Beschnitt strokes and non-empty donor strokes"
        )
    rillen = entry["rillen"]
    if (
        source_rillen_hashes != donor_rillen_hashes
        or len(source_rillen_hashes) != rillen["sourceStrokeCount"]
        or len(donor_rillen_hashes) != rillen["donorStrokeCount"]
        or stroke_multiset_sha256(source_rillen_hashes)
        != rillen["sourceSortedMultisetSha256"]
        or stroke_multiset_sha256(donor_rillen_hashes)
        != rillen["donorSortedMultisetSha256"]
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor Rillen relation changed"
        )
    schneiden = exact_keys(
        entry["schneiden"],
        {
            "layerName", "sourceStrokeCount", "donorStrokeCount",
            "sourceSortedMultisetSha256", "donorSortedMultisetSha256",
            "donorIsExactMultisetSubset", "sourceOnlyReclassified",
            "sourceOnlySortedMultisetSha256",
        },
        "Verified Beschnitt donor Schneiden relation",
    )
    if (
        schneiden["layerName"] != "Schneiden"
        or schneiden["donorIsExactMultisetSubset"] is not True
        or len(source_cut_hashes) != schneiden["sourceStrokeCount"]
        or len(donor_cut_hashes) != schneiden["donorStrokeCount"]
        or stroke_multiset_sha256(source_cut_hashes)
        != schneiden["sourceSortedMultisetSha256"]
        or stroke_multiset_sha256(donor_cut_hashes)
        != schneiden["donorSortedMultisetSha256"]
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor Schneiden evidence changed"
        )
    source_only_records = source_only_stroke_records_in_paint_order(
        source_schneiden, donor_schneiden
    )
    source_only = hashes(source_only_records)
    if (
        len(source_only) not in {0, 2}
        or stroke_multiset_sha256(source_only)
        != schneiden["sourceOnlySortedMultisetSha256"]
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor Schneiden difference is not the exact 0/2 contour set"
        )
    reclassified = schneiden["sourceOnlyReclassified"]
    if not isinstance(reclassified, list) or len(reclassified) != len(source_only):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor reclassification count is invalid"
        )
    for source_only_record, expected_hash, record_value in zip(
        source_only_records, source_only, reclassified
    ):
        record = exact_keys(
            record_value,
            {
                "page", "pathGeometrySha256", "effectiveBbox",
                "equalsDonorBeschnittPath", "fullMediaBoxOuterContour",
            },
            "Verified Beschnitt reclassified contour",
        )
        bbox = normalized_bbox(record["effectiveBbox"])
        if not isinstance(record["page"], int) or isinstance(record["page"], bool):
            raise SalesFolderSanitizationError(
                "Verified Beschnitt reclassified contour page is invalid"
            )
        page_number = record["page"]
        source_record = exact_stroke_occurrence(
            source_schneiden,
            page_number,
            expected_hash,
            bbox,
            "source Schneiden",
        )
        donor_record = exact_stroke_occurrence(
            donor_beschnitt,
            page_number,
            expected_hash,
            bbox,
            "donor Beschnitt",
        )
        media = source_boxes[page_number - 1]["mediabox"] if 1 <= page_number <= 2 else []
        if (
            record["pathGeometrySha256"] != expected_hash
            or source_record != source_only_record
            or page_number != source_record["page"]
            or page_number != donor_record["page"]
            or bbox != source_record["effectiveBbox"]
            or bbox != donor_record["effectiveBbox"]
            or record["equalsDonorBeschnittPath"] is not True
            or record["fullMediaBoxOuterContour"] is not True
            or not full_media_box_contour(bbox, media)
        ):
            raise SalesFolderSanitizationError(
                "Reclassified Schneiden path is not the exact shared full-MediaBox contour"
            )
    import_policy = exact_keys(
        entry["importPolicy"],
        {
            "exclusiveDonorLayerName", "importedStrokePathGeometrySha256s",
            "removeSourceSchneidenPathGeometrySha256s",
            "preserveOriginalSourceForAllOtherGeometry", "noFullPdfRebind",
            "noTextApproximation",
        },
        "Verified Beschnitt donor import policy",
    )
    if (
        import_policy["exclusiveDonorLayerName"] != "Beschnitt Seite"
        or import_policy["importedStrokePathGeometrySha256s"]
        != donor_beschnitt_hashes
        or import_policy["removeSourceSchneidenPathGeometrySha256s"] != source_only
        or import_policy["preserveOriginalSourceForAllOtherGeometry"] is not True
        or import_policy["noFullPdfRebind"] is not True
        or import_policy["noTextApproximation"] is not True
    ):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor import policy is not exact"
        )
    return {
        "reportPath": report_path,
        "reportSha256": report_sha,
        "reportBytes": len(report_bytes),
        "entrySha256": entry["entrySha256"],
        "sourcePath": source_path,
        "sourceSha256": entry["source"]["sha256"],
        "donorPath": donor_path,
        "donorSha256": entry["donor"]["sha256"],
        "donorBytes": entry["donor"]["bytes"],
        "pageBoxesSha256": entry["pageBoxesSha256"],
        "donorStrokeRecords": donor_beschnitt,
        "importedStrokePathGeometrySha256s": donor_beschnitt_hashes,
        "removeSourceSchneidenPathGeometrySha256s": source_only,
    }


def validate_contract(
    contract: Any,
    source: Path,
    geometry_audit_path: Path,
    geometry_supplement_path: Path | None = None,
    template_resolution_plan_path: Path | None = None,
    *,
    validation_cache: BatchValidationCache | None = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if not isinstance(contract, dict) or contract.get("schemaVersion") != SCHEMA_VERSION:
        raise SalesFolderSanitizationError("Unsupported or missing contract schemaVersion")
    if contract.get("reviewState") != "approved_for_sanitization":
        raise SalesFolderSanitizationError("Contract has not been explicitly approved for sanitization")
    review = contract.get("review")
    if not isinstance(review, dict) or not str(review.get("reviewer") or "").strip() or not str(review.get("reviewedAt") or "").strip():
        raise SalesFolderSanitizationError("Approved contract must identify reviewer and reviewedAt")
    geometry = validate_geometry(contract.get("geometry"))
    finish_key = str(contract.get("finishKey") or "")
    if finish_key not in SUPPORTED_FINISHES:
        raise SalesFolderSanitizationError(f"Unsupported or missing finishKey: {finish_key}")
    contract = copy.deepcopy(contract)
    contract["geometry"] = geometry
    geometry_audit = validate_geometry_audit(
        contract,
        source,
        geometry_audit_path,
        geometry_supplement_path,
        template_resolution_plan_path,
        validation_cache,
    )
    if validation_cache is None:
        observed = describe_source(source, geometry, finish_key)
        full_source_text = None
    else:
        observed, full_source_text = validation_cache.observe_source(
            source, geometry, finish_key
        )
    expected_evidence = contract.get("sourceEvidence")
    if not isinstance(expected_evidence, dict):
        raise SalesFolderSanitizationError("Contract has no sourceEvidence object")
    immutable_fields = (
        "sha256",
        "geometryBinding",
        "geometryBindingSha256",
        "pageCount",
        "pageBoxes",
        "pageBoxesSha256",
        "textSha256",
        "layerNames",
        "layerInventorySha256",
        "colorDescriptors",
        "colorInventorySha256",
        "spotColorants",
        "spotPaintUsage",
        "productionMeasurements",
        "fillPaintObjects",
        "paintingFeatures",
        "geometryFingerprints",
    )
    for field in immutable_fields:
        if expected_evidence.get(field) != observed["sourceEvidence"].get(field):
            raise SalesFolderSanitizationError(f"Reviewed source evidence changed: {field}")

    measurements = contract.get("productionMeasurements")
    if not isinstance(measurements, dict) or set(measurements) != {"bleedMm", "safetyMm"}:
        raise SalesFolderSanitizationError("Contract must review exact bleedMm and safetyMm measurements")
    try:
        bleed_mm = number(measurements["bleedMm"])
        safety_mm = number(measurements["safetyMm"])
    except (TypeError, ValueError) as exc:
        raise SalesFolderSanitizationError("Bleed and safety measurements remain unreviewed") from exc
    if bleed_mm <= 0 or bleed_mm > 25 or safety_mm <= 0 or safety_mm > 25:
        raise SalesFolderSanitizationError("Bleed and safety measurements are outside reviewed production bounds")
    if measurements != observed["sourceEvidence"]["productionMeasurements"]:
        raise SalesFolderSanitizationError("Reviewed bleed or safety measurement differs from source evidence")

    policies = contract.get("layers")
    if not isinstance(policies, list) or not policies:
        raise SalesFolderSanitizationError("Contract must classify every source layer")
    by_name: dict[str, dict[str, Any]] = {}
    output_names: dict[str, str] = {}
    for policy in policies:
        if not isinstance(policy, dict):
            raise SalesFolderSanitizationError("Layer policy must be an object")
        name = str(policy.get("name") or "")
        action = policy.get("action")
        role = policy.get("role")
        output_name = str(policy.get("outputNameDa") or "").strip()
        if not name or name in by_name:
            raise SalesFolderSanitizationError(f"Missing or duplicate layer policy: {name!r}")
        if action not in {"preserve", "remove"}:
            raise SalesFolderSanitizationError(f"Layer {name} has an unreviewed action")
        if action == "preserve" and role not in PRESERVED_ROLES:
            raise SalesFolderSanitizationError(f"Layer {name} has invalid preserved role {role}")
        if action == "remove" and role not in REMOVED_ROLES:
            raise SalesFolderSanitizationError(f"Layer {name} has invalid removed role {role}")
        if name in STRUCTURAL_SOURCE_LAYER_NAMES and action != "preserve":
            raise SalesFolderSanitizationError(
                f"Structural layer {name} cannot be removed"
            )
        if name == "CD-Tasche":
            if action != "remove" or role != "unused-accessory":
                raise SalesFolderSanitizationError(
                    "CD-Tasche may only be removed as the exact unused-accessory layer"
                )
        elif role == "unused-accessory":
            raise SalesFolderSanitizationError(
                "unused-accessory removal is restricted to the exact CD-Tasche OCG"
            )
        if action == "preserve":
            if (
                not output_name
                or output_name == "REVIEW_REQUIRED"
                or len(output_name) > 80
            ):
                raise SalesFolderSanitizationError(
                    f"Preserved layer {name} requires a reviewed Danish outputNameDa"
                )
            expected_name = KNOWN_DANISH_LAYER_NAMES.get(name)
            if expected_name is not None and output_name != expected_name:
                raise SalesFolderSanitizationError(
                    f"Preserved layer {name} must use the standard Danish name {expected_name}"
                )
            if re.search(
                r"(?:seite|tasche|rillen|schneiden|verschluss|verchluss|gummiband|abheftvorrichtung)",
                output_name,
                flags=re.IGNORECASE,
            ):
                raise SalesFolderSanitizationError(
                    f"Preserved layer {name} still has a German output name"
                )
            if output_name in output_names.values() or output_name == INFO_LAYER_NAME:
                raise SalesFolderSanitizationError(
                    f"Danish output layer name is duplicated or reserved: {output_name}"
                )
            output_names[name] = output_name
        elif output_name:
            raise SalesFolderSanitizationError(
                f"Removed layer {name} must not have an outputNameDa"
            )
        by_name[name] = policy
    if set(by_name) != set(observed["sourceEvidence"]["layerNames"]):
        unknown = sorted(set(observed["sourceEvidence"]["layerNames"]) - set(by_name))
        extra = sorted(set(by_name) - set(observed["sourceEvidence"]["layerNames"]))
        raise SalesFolderSanitizationError(f"Layer contract mismatch; unknown={unknown}, extra={extra}")
    for feature in observed["sourceEvidence"]["paintingFeatures"]:
        if feature["type"] == "image-xobject":
            policy = by_name.get(feature.get("layer"))
            if policy and policy["action"] == "remove":
                continue
        raise SalesFolderSanitizationError(
            f"Unsupported or unsafe painting feature requires quarantine: {feature['type']}"
        )
    for exact_name, role in (("Rillen", "fold"), ("Schneiden", "cut")):
        policy = by_name.get(exact_name)
        if not policy or policy.get("action") != "preserve" or policy.get("role") != role:
            raise SalesFolderSanitizationError(f"Required semantic layer {exact_name} must be preserved as {role}")
    if not any(item["action"] == "remove" and item["role"] == "supplier-information" for item in policies):
        raise SalesFolderSanitizationError("No supplier-information layer is classified for removal")
    if not any(item["action"] == "remove" and item["role"] == "supplier-branding" for item in policies):
        raise SalesFolderSanitizationError("No supplier-branding layer is classified for removal")

    verified_beschnitt_donor = validate_verified_beschnitt_guide_donor(
        contract,
        source,
        geometry_audit_path,
        observed,
        validation_cache,
    )

    required_roles = contract.get("requiredGeometryRoles")
    if required_roles != ["cut", "fold", "bleed", "safety"]:
        raise SalesFolderSanitizationError("requiredGeometryRoles must be exactly cut, fold, bleed, safety")
    fingerprints = observed["sourceEvidence"]["geometryFingerprints"]
    for role in required_roles:
        matching = [
            item for item in policies
            if item["action"] == "preserve"
            and (item["role"] == role or (item["role"] == "bleed-and-safety" and role in {"bleed", "safety"}))
        ]
        if not matching:
            raise SalesFolderSanitizationError(f"Missing required {role} geometry layer")
        has_source_geometry = any(
            fingerprints.get(item["name"], {}).get("pathOperatorCount", 0) > 0
            and fingerprints.get(item["name"], {}).get("strokePaintCount", 0) > 0
            for item in matching
        )
        donor_supplies_role = bool(
            verified_beschnitt_donor
            and role in {"bleed", "safety"}
            and any(
                item["name"] == "Beschnitt Seite"
                and item["role"] == "bleed-and-safety"
                for item in matching
            )
        )
        if not has_source_geometry and not donor_supplies_role:
            raise SalesFolderSanitizationError(
                f"Required {role} layer contains no stroked vector path geometry"
            )

    source_text = contract.get("sourceText")
    if not isinstance(source_text, dict) or source_text.get("sha256") != observed["sourceEvidence"]["textSha256"]:
        raise SalesFolderSanitizationError("Reviewed source text fingerprint changed")
    required_patterns = source_text.get("requiredPatterns")
    if not isinstance(required_patterns, list) or not required_patterns:
        raise SalesFolderSanitizationError("Contract must record reviewed supplier text patterns")
    text = (
        normalized_extracted_text(PdfReader(str(source), strict=True))
        if full_source_text is None
        else full_source_text
    )
    for pattern in required_patterns:
        if pattern == "REVIEW_REQUIRED" or not isinstance(pattern, str):
            raise SalesFolderSanitizationError("Source text patterns remain unreviewed")
        try:
            matched = re.search(pattern, text, flags=re.IGNORECASE)
        except re.error as exc:
            raise SalesFolderSanitizationError(f"Invalid reviewed source text pattern: {exc}") from exc
        if not matched:
            raise SalesFolderSanitizationError(f"Reviewed source text pattern is missing: {pattern}")

    colors = contract.get("colors")
    if not isinstance(colors, dict) or set(colors) != {
        "allowedDescriptors", "noPrintAreas", "generatedNoPrintBackgrounds"
    }:
        raise SalesFolderSanitizationError("Contract colors must be an object")
    descriptors = colors.get("allowedDescriptors")
    if descriptors != observed["sourceEvidence"]["colorDescriptors"]:
        raise SalesFolderSanitizationError("Unknown, missing, or reordered source color descriptor")
    no_print = colors.get("noPrintAreas")
    if not isinstance(no_print, list):
        raise SalesFolderSanitizationError("colors.noPrintAreas must be an array")
    reviewed_no_print: list[dict[str, Any]] = []
    for index, item in enumerate(no_print):
        if not isinstance(item, dict):
            raise SalesFolderSanitizationError(f"No-print policy {index + 1} is invalid")
        exact_keys = {
            "page", "layer", "operator", "operands", "pathSha256s",
            "expectedPaintCount", "fullPage", "replacementHex"
        }
        if set(item) != exact_keys:
            raise SalesFolderSanitizationError(f"No-print policy {index + 1} must use the exact reviewed schema")
        normalized = {
            "page": int(item["page"]),
            "layer": str(item["layer"]),
            "operator": str(item["operator"]),
            "operands": [round(number(value), 7) for value in item["operands"]],
            "pathSha256s": sorted(str(value) for value in item["pathSha256s"]),
            "expectedPaintCount": int(item["expectedPaintCount"]),
            "fullPage": item["fullPage"],
            "replacementHex": str(item["replacementHex"]).upper(),
        }
        if normalized["page"] < 1 or normalized["page"] > observed["sourceEvidence"]["pageCount"]:
            raise SalesFolderSanitizationError("No-print policy page is outside the source PDF")
        if normalized["layer"] not in by_name or by_name[normalized["layer"]]["action"] != "preserve":
            raise SalesFolderSanitizationError("No-print policy must target a preserved reviewed layer")
        if normalized["operator"] not in {"g", "rg", "k"}:
            raise SalesFolderSanitizationError("No-print conversion supports only exact DeviceGray/RGB/CMYK fills")
        expected_lengths = {"g": 1, "rg": 3, "k": 4}
        if len(normalized["operands"]) != expected_lengths[normalized["operator"]]:
            raise SalesFolderSanitizationError("No-print color operand count is invalid")
        if not is_reviewable_red_or_pink_device_fill(
            normalized["operator"], normalized["operands"]
        ):
            raise SalesFolderSanitizationError(
                "No-print conversion is restricted to an exact reviewed red/pink Device fill"
            )
        if normalized["expectedPaintCount"] < 1 or not isinstance(normalized["fullPage"], bool):
            raise SalesFolderSanitizationError("No-print count/fullPage review is invalid")
        if (
            len(normalized["pathSha256s"]) != normalized["expectedPaintCount"]
            or len(set(normalized["pathSha256s"])) != len(normalized["pathSha256s"])
            or any(not re.fullmatch(r"[a-f0-9]{64}", value) for value in normalized["pathSha256s"])
        ):
            raise SalesFolderSanitizationError("No-print path fingerprints are missing, duplicated, or invalid")
        if normalized["replacementHex"] != NO_PRINT_GRAY:
            raise SalesFolderSanitizationError(f"No-print replacement must be {NO_PRINT_GRAY}")
        descriptor = color_descriptor(
            normalized["page"],
            normalized["layer"],
            normalized["operator"].encode("latin1"),
            normalized["operands"],
        )
        if descriptor not in descriptors:
            raise SalesFolderSanitizationError("No-print policy does not match an exact reviewed source color")
        matching_objects = [
            item for item in observed["sourceEvidence"]["fillPaintObjects"]
            if item["descriptor"] == descriptor
        ]
        if sorted(item["pathSha256"] for item in matching_objects) != normalized["pathSha256s"]:
            raise SalesFolderSanitizationError("No-print policy path fingerprints differ from source paint objects")
        reviewed_no_print.append(normalized)

    generated_no_print = colors.get("generatedNoPrintBackgrounds")
    if not isinstance(generated_no_print, list) or len(generated_no_print) > 1:
        raise SalesFolderSanitizationError(
            "colors.generatedNoPrintBackgrounds must be an array with at most one reviewed entry"
        )
    reviewed_generated_no_print: list[dict[str, Any]] = []
    for item in generated_no_print:
        exact_keys = {
            "page", "rectPt", "mediaBoxSha256", "sourcePattern",
            "replacementHex", "expectedPaintCount", "outputLayerNameDa",
        }
        if not isinstance(item, dict) or set(item) != exact_keys:
            raise SalesFolderSanitizationError(
                "Generated no-print background must use the exact reviewed schema"
            )
        page_number = int(item["page"])
        rect = [round(number(value), 7) for value in item["rectPt"]]
        if geometry["print"] != "4+0" or page_number != 2 or len(rect) != 4:
            raise SalesFolderSanitizationError(
                "A generated no-print background is restricted to page 2 of a 4+0 template"
            )
        media = observed["sourceEvidence"]["pageBoxes"][page_number - 1]["mediabox"]
        expected_rect = [
            media[0], media[1],
            round(media[2] - media[0], 7), round(media[3] - media[1], 7),
        ]
        if rect != expected_rect or item["mediaBoxSha256"] != sha256_json(media):
            raise SalesFolderSanitizationError(
                "Generated no-print background does not match the exact source page-2 mediabox"
            )
        if (
            item["sourcePattern"] != GENERATED_NO_PRINT_SOURCE_PATTERN
            or not re.search(item["sourcePattern"], text, flags=re.IGNORECASE)
        ):
            raise SalesFolderSanitizationError(
                "Generated no-print background lacks the exact reviewed whole-page source statement"
            )
        if (
            str(item["replacementHex"]).upper() != NO_PRINT_GRAY
            or not isinstance(item["expectedPaintCount"], int)
            or isinstance(item["expectedPaintCount"], bool)
            or item["expectedPaintCount"] != 1
            or item["outputLayerNameDa"] != GENERATED_NO_PRINT_LAYER_NAME
        ):
            raise SalesFolderSanitizationError(
                "Generated no-print background must be one exact light-grey helper-layer rectangle"
            )
        if GENERATED_NO_PRINT_LAYER_NAME in output_names.values():
            raise SalesFolderSanitizationError(
                "Generated no-print helper-layer name collides with a preserved source layer"
            )
        if any(policy["fullPage"] for policy in reviewed_no_print):
            raise SalesFolderSanitizationError(
                "Generated and converted full-page no-print policies are mutually exclusive"
            )
        reviewable_bleed_fills = []
        for paint in observed["sourceEvidence"]["fillPaintObjects"]:
            policy = by_name.get(paint["layer"])
            if (
                paint["page"] == page_number
                and policy
                and policy["action"] == "preserve"
                and policy["role"] == "bleed-and-safety"
                and is_reviewable_red_or_pink_device_fill(
                    paint["operator"], paint["operands"]
                )
            ):
                reviewable_bleed_fills.append(paint)
        if reviewable_bleed_fills:
            raise SalesFolderSanitizationError(
                "Generated no-print background is forbidden when a source red/pink bleed-layer fill exists"
            )
        reviewed_generated_no_print.append({
            "page": page_number,
            "rectPt": rect,
            "mediaBoxSha256": item["mediaBoxSha256"],
            "sourcePattern": item["sourcePattern"],
            "replacementHex": NO_PRINT_GRAY,
            "expectedPaintCount": 1,
            "outputLayerNameDa": GENERATED_NO_PRINT_LAYER_NAME,
        })
    has_converted_full_page = any(item["fullPage"] for item in reviewed_no_print)
    has_generated_full_page = bool(reviewed_generated_no_print)
    if geometry["print"] == "4+0" and not (has_converted_full_page or has_generated_full_page):
        raise SalesFolderSanitizationError(
            "4+0 two-page template requires a reviewed converted or generated full-page no-print area"
        )
    if geometry["print"] == "4+4" and (has_converted_full_page or has_generated_full_page):
        raise SalesFolderSanitizationError(
            "4+4 template must not receive a full-page no-print grey area"
        )

    spot = contract.get("spotFinish")
    if not isinstance(spot, dict) or set(spot) != {
        "required", "allowedColorants", "requiredColorants", "requiredLayerNames", "minimumPaintOperators"
    }:
        raise SalesFolderSanitizationError("spotFinish policy is missing or invalid")
    observed_spots = observed["sourceEvidence"]["spotColorants"]
    if spot["allowedColorants"] != observed_spots:
        raise SalesFolderSanitizationError("Unknown or missing reviewed spot colorant")
    mapped_spots = [SPOT_COLORANT_OUTPUT_NAMES.get(name, name) for name in observed_spots]
    if len(set(mapped_spots)) != len(mapped_spots) or any(
        output_name in observed_spots and output_name != source_name
        for source_name, output_name in zip(observed_spots, mapped_spots)
    ):
        raise SalesFolderSanitizationError(
            "Reviewed spot-color rename collides with another source colorant"
        )
    required_spots = spot["requiredColorants"]
    required_spot_layers = spot["requiredLayerNames"]
    minimum_spot_paints = spot["minimumPaintOperators"]
    if (
        not isinstance(spot["required"], bool)
        or not isinstance(required_spots, list)
        or not isinstance(required_spot_layers, list)
        or not isinstance(minimum_spot_paints, int)
    ):
        raise SalesFolderSanitizationError("Spot-finish requirement is invalid")
    if spot["required"] and finish_key not in SPOT_FINISHES:
        raise SalesFolderSanitizationError(
            "A reviewed source finish mask is invalid for a non-spot finish"
        )
    if spot["required"]:
        if not required_spots or not set(required_spots).issubset(observed_spots):
            raise SalesFolderSanitizationError("Required spot-finish colorant is missing")
        if not required_spot_layers or minimum_spot_paints < 1:
            raise SalesFolderSanitizationError("Spot finish must require a preserved finish layer and painted usage")
        for name in required_spot_layers:
            policy = by_name.get(name)
            if not policy or policy["action"] != "preserve" or policy["role"] != "finish":
                raise SalesFolderSanitizationError("Spot finish layer is not preserved with finish role")
        usage = observed["sourceEvidence"]["spotPaintUsage"]
        matching_paints = [
            item for item in usage
            if item["colorant"] in required_spots and item["layer"] in required_spot_layers
        ]
        if len(matching_paints) < minimum_spot_paints:
            raise SalesFolderSanitizationError("Required spot colorant has no reviewed painted usage in finish layer")
    elif required_spots or required_spot_layers or minimum_spot_paints != 0:
        raise SalesFolderSanitizationError("Non-spot contract cannot require spot colorants, layers, or paints")

    finish_instructions = contract.get("finishInstructions")
    if not isinstance(finish_instructions, list):
        raise SalesFolderSanitizationError("finishInstructions must be a reviewed array")
    normalized_finish_instructions = []
    for item in finish_instructions:
        if not isinstance(item, dict) or set(item) != {"category", "danish", "sourcePattern"}:
            raise SalesFolderSanitizationError("Each finish instruction requires category, danish, and sourcePattern")
        category = str(item["category"])
        danish = str(item["danish"]).strip()
        source_pattern = str(item["sourcePattern"])
        if category not in {"spot-color", "overprint", "minimum-size", "clearance", "other"}:
            raise SalesFolderSanitizationError(f"Unknown finish-instruction category: {category}")
        if not danish or len(danish) > 280 or not source_pattern:
            raise SalesFolderSanitizationError("Finish instruction is empty, too long, or unbound")
        try:
            if not re.search(source_pattern, text, flags=re.IGNORECASE):
                raise SalesFolderSanitizationError(
                    f"Finish instruction has no matching source evidence: {category}"
                )
        except re.error as exc:
            raise SalesFolderSanitizationError(f"Invalid finish source pattern: {exc}") from exc
        normalized_finish_instructions.append({
            "category": category,
            "danish": danish,
            "sourcePattern": source_pattern,
        })
    professional_upload_warning = contract.get("professionalUploadWarningDa")
    if spot["required"]:
        required_instruction_categories = {"spot-color", "overprint", "minimum-size", "clearance"}
        actual_categories = {item["category"] for item in normalized_finish_instructions}
        missing_categories = sorted(required_instruction_categories - actual_categories)
        if missing_categories:
            raise SalesFolderSanitizationError(
                f"Spot-finish Danish instructions are incomplete: {missing_categories}"
            )
        if professional_upload_warning is not None:
            raise SalesFolderSanitizationError(
                "A reviewed source finish mask must not carry a professional-upload warning"
            )
    elif finish_key in SPOT_FINISHES:
        if normalized_finish_instructions:
            raise SalesFolderSanitizationError(
                "A spot finish without a reviewed source mask must not invent source-backed or numeric instructions"
            )
        if professional_upload_warning != PROFESSIONAL_UPLOAD_WARNING_DA:
            raise SalesFolderSanitizationError(
                "A spot finish without a reviewed source mask requires the exact generic Danish professional-upload warning"
            )
    else:
        if normalized_finish_instructions:
            raise SalesFolderSanitizationError(
                "A non-spot finish must not carry spot-finish instructions"
            )
        if professional_upload_warning is not None:
            raise SalesFolderSanitizationError(
                "A non-spot finish must not carry a professional-upload warning"
            )

    panels = contract.get("informationPanels")
    if not isinstance(panels, list) or not panels:
        raise SalesFolderSanitizationError("At least one reviewed Danish information-panel rectangle is required")
    seen_pages: set[int] = set()
    normalized_panels = []
    for panel in panels:
        if not isinstance(panel, dict) or set(panel) != {"page", "rectPt"}:
            raise SalesFolderSanitizationError("Information panel must contain exactly page and rectPt")
        page_number = int(panel["page"])
        rect = [number(item) for item in panel["rectPt"]]
        if len(rect) != 4 or page_number in seen_pages:
            raise SalesFolderSanitizationError("Information panel page/rectangle is invalid or duplicated")
        seen_pages.add(page_number)
        if page_number < 1 or page_number > len(observed["sourceEvidence"]["pageBoxes"]):
            raise SalesFolderSanitizationError("Information panel page is outside the PDF")
        x, y, width, height = rect
        media = observed["sourceEvidence"]["pageBoxes"][page_number - 1]["mediabox"]
        if width < 180 or height < 105 or x < media[0] or y < media[1] or x + width > media[2] or y + height > media[3]:
            raise SalesFolderSanitizationError("Information panel is too small or outside its reviewed page box")
        normalized_panels.append({"page": page_number, "rectPt": rect})

    contract["_layerPolicies"] = by_name
    contract["_layerOutputNames"] = output_names
    contract["_noPrintAreas"] = reviewed_no_print
    contract["_generatedNoPrintBackgrounds"] = reviewed_generated_no_print
    contract["_informationPanels"] = normalized_panels
    contract["_measurements"] = {"bleedMm": bleed_mm, "safetyMm": safety_mm}
    contract["_finishInstructions"] = normalized_finish_instructions
    contract["_professionalUploadWarningDa"] = professional_upload_warning
    contract["_verifiedBeschnittGuideDonor"] = verified_beschnitt_donor
    return contract, observed, geometry_audit


def serialize_operations(operations: list[tuple[Any, bytes]], reader: PdfReader) -> bytes:
    stream = ContentStream(DecodedStreamObject(), reader)
    stream.operations = operations
    return stream.get_data()


def clean_dictionary(value: Any) -> None:
    if not isinstance(value, DictionaryObject):
        return
    for key in (
        "/Metadata", "/PieceInfo", "/LastModified", "/AA", "/A", "/AF",
        "/ActualText", "/Alt", "/Thumb",
    ):
        value.pop(NameObject(key), None)


def make_gray_operator() -> tuple[list[FloatObject], bytes]:
    return ([FloatObject(value) for value in NO_PRINT_GRAY_RGB], b"rg")


def make_device_color_operator(
    descriptor: tuple[str, list[float]],
) -> tuple[list[FloatObject], bytes]:
    return (
        [FloatObject(value) for value in descriptor[1]],
        descriptor[0].encode("latin1"),
    )


def sanitize_operations(
    container: Any,
    reader: PdfReader,
    page_number: int,
    layer_policies: dict[str, dict[str, Any]],
    no_print: list[dict[str, Any]],
    conversion_counts: dict[int, int],
    conversion_paths: dict[int, list[str]],
    reclassified_cut_paths: set[str],
    reclassified_cut_counts: dict[str, int],
    inherited_layer: str | None = None,
) -> tuple[list[tuple[Any, bytes]], dict[str, set[str]]]:
    properties = layer_map(container)
    xobjects = xobject_map(container)
    output: list[tuple[Any, bytes]] = []
    layer_stack: list[tuple[str | None, bool]] = []
    layer = inherited_layer
    skip = bool(layer and layer_policies[layer]["action"] == "remove")
    text_depth = 0
    path: list[tuple[Any, bytes]] = []
    fill_descriptor: tuple[str, list[float]] | None = None
    stroke_descriptor: tuple[str, list[float]] | None = None
    pending_fill_operations: list[tuple[Any, bytes]] = []
    pending_stroke_operations: list[tuple[Any, bytes]] = []
    pending_ext_gstate_operations: list[tuple[Any, bytes]] = []
    # A non-Device color state cannot be reconstructed safely from a lone
    # ``scn``/``SCN`` operation: its meaning depends on the active resource
    # color space and tint operands.  Track any suppressed change explicitly
    # and fail only if later preserved paint would consume it.  A preserved
    # colorspace selector or Device color setter establishes a complete new
    # state and clears the corresponding sentinel.
    unresolved_non_device_fill = False
    unresolved_non_device_stroke = False
    active_no_print_index: int | None = None
    state_stack: list[
        tuple[
            tuple[str, list[float]] | None,
            tuple[str, list[float]] | None,
            int | None,
            list[tuple[Any, bytes]],
            list[tuple[Any, bytes]],
            list[tuple[Any, bytes]],
            bool,
            bool,
        ]
    ] = []
    xobject_contexts: dict[str, set[str]] = defaultdict(set)

    for operands, operator in content_operations(container, reader):
        ocg = current_ocg_name(operands, operator, properties)
        if operator in (b"BDC", b"BMC"):
            layer_stack.append((layer, skip))
            if ocg is not None:
                layer = ocg
                skip = skip or layer_policies[layer]["action"] == "remove"
            if not skip:
                output.append((operands, operator))
            continue
        if operator == b"EMC":
            if not skip:
                output.append((operands, operator))
            if not layer_stack:
                raise SalesFolderSanitizationError("Unbalanced EMC marked-content operator")
            previous_layer, previous_skip = layer_stack.pop()
            layer, skip = previous_layer, previous_skip
            continue
        if operator == b"BT":
            text_depth += 1
            continue
        if operator == b"ET" and text_depth:
            text_depth -= 1
            continue
        if operator == b"q":
            state_stack.append((
                copy.deepcopy(fill_descriptor),
                copy.deepcopy(stroke_descriptor),
                active_no_print_index,
                copy.deepcopy(pending_fill_operations),
                copy.deepcopy(pending_stroke_operations),
                copy.deepcopy(pending_ext_gstate_operations),
                unresolved_non_device_fill,
                unresolved_non_device_stroke,
            ))
            output.append((operands, operator)); continue
        if operator == b"Q":
            if not state_stack:
                raise SalesFolderSanitizationError(
                    "Unbalanced PDF graphics-state restore operator"
                )
            output.append((operands, operator))
            (
                fill_descriptor,
                stroke_descriptor,
                active_no_print_index,
                pending_fill_operations,
                pending_stroke_operations,
                pending_ext_gstate_operations,
                unresolved_non_device_fill,
                unresolved_non_device_stroke,
            ) = state_stack.pop()
            continue
        if operator in (b"g", b"rg", b"k"):
            fill_descriptor = (operator.decode("latin1"), [round(number(item), 7) for item in operands])
            unresolved_non_device_fill = False
            matches = [
                index
                for index, policy in enumerate(no_print)
                if policy["page"] == page_number
                and policy["layer"] == layer
                and policy["operator"] == fill_descriptor[0]
                and policy["operands"] == fill_descriptor[1]
            ]
            if len(matches) > 1:
                raise SalesFolderSanitizationError("One source color matches multiple no-print policies")
            active_no_print_index = matches[0] if matches else None
            if skip or text_depth:
                pending_fill_operations = [(copy.deepcopy(operands), operator)]
                continue
            # Keep the reviewed source state intact here.  A no-print color is
            # applied only around the exact allowlisted paint below, then the
            # source fill is restored so later paths and Forms cannot inherit
            # grey accidentally.
            output.append((operands, operator))
            pending_fill_operations = []
            continue
        if operator in (b"G", b"RG", b"K"):
            stroke_descriptor = (
                operator.decode("latin1"),
                [round(number(item), 7) for item in operands],
            )
            unresolved_non_device_stroke = False
            if skip or text_depth:
                pending_stroke_operations = [(copy.deepcopy(operands), operator)]
                continue
            output.append((operands, operator))
            pending_stroke_operations = []
            continue
        if operator in (b"cs", b"sc", b"scn"):
            fill_descriptor = None
            active_no_print_index = None
            if skip or text_depth:
                pending_fill_operations = []
                unresolved_non_device_fill = True
                continue
            output.append((operands, operator))
            pending_fill_operations = []
            if operator == b"cs":
                unresolved_non_device_fill = False
            continue
        if operator in (b"CS", b"SC", b"SCN"):
            stroke_descriptor = None
            if skip or text_depth:
                pending_stroke_operations = []
                unresolved_non_device_stroke = True
                continue
            output.append((operands, operator))
            pending_stroke_operations = []
            if operator == b"CS":
                unresolved_non_device_stroke = False
            continue
        if operator == b"gs":
            # Resolve now so a dangling or malformed resource cannot be copied
            # into the sanitized file.  ExtGState dictionaries are partial
            # updates, therefore every suppressed operation is replayed in
            # source order; retaining only the last resource name is unsafe.
            resolved_ext_gstate_delta(container, operands)
            if skip or text_depth:
                pending_ext_gstate_operations.append(
                    (copy.deepcopy(operands), operator)
                )
                continue
            if pending_ext_gstate_operations:
                output.extend(copy.deepcopy(pending_ext_gstate_operations))
                pending_ext_gstate_operations = []
            output.append((operands, operator))
            continue
        if skip or text_depth:
            continue
        if operator in PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
            path.append((operands, operator))
            if not (layer == "Schneiden" and reclassified_cut_paths):
                output.append((operands, operator))
            continue
        if operator in PATH_PAINT_OPERATORS:
            if layer is None and operator != b"n":
                raise SalesFolderSanitizationError("Unlayered painted geometry is not allowed")
            if operator in FILL_PAINT_OPERATORS and unresolved_non_device_fill:
                raise SalesFolderSanitizationError(
                    "Removed content leaves an unsupported non-Device fill state used by preserved geometry"
                )
            if operator in STROKE_PAINT_OPERATORS and unresolved_non_device_stroke:
                raise SalesFolderSanitizationError(
                    "Removed content leaves an unsupported non-Device stroke state used by preserved geometry"
                )
            if layer == "Schneiden" and reclassified_cut_paths:
                geometry_fingerprint = paint_path_geometry_sha256(page_number, path)
                if geometry_fingerprint in reclassified_cut_paths:
                    if operator != b"S":
                        raise SalesFolderSanitizationError(
                            "Only an exact simple Schneiden stroke may be reclassified"
                        )
                    reclassified_cut_counts[geometry_fingerprint] += 1
                    path = []
                    continue
                output.extend(path)
            no_print_policy: dict[str, Any] | None = None
            if operator in FILL_PAINT_OPERATORS and active_no_print_index is not None:
                index = active_no_print_index
                no_print_policy = no_print[index]
                fingerprint = paint_path_sha256(page_number, layer, path)
                if fingerprint not in no_print_policy["pathSha256s"]:
                    raise SalesFolderSanitizationError(
                        "No-print fill path differs from exact reviewed object fingerprint"
                    )
                conversion_counts[index] += 1
                conversion_paths[index].append(fingerprint)
                output.append(make_gray_operator())
                pending_fill_operations = []
            elif operator in FILL_PAINT_OPERATORS and pending_fill_operations:
                if fill_descriptor is None:
                    raise SalesFolderSanitizationError(
                        "Removed content leaves an unsupported non-Device fill state used by preserved geometry"
                    )
                output.extend(copy.deepcopy(pending_fill_operations))
                pending_fill_operations = []
            if operator in STROKE_PAINT_OPERATORS and pending_stroke_operations:
                if stroke_descriptor is None:
                    raise SalesFolderSanitizationError(
                        "Removed content leaves an unsupported non-Device stroke state used by preserved geometry"
                    )
                output.extend(copy.deepcopy(pending_stroke_operations))
                pending_stroke_operations = []
            if pending_ext_gstate_operations:
                output.extend(copy.deepcopy(pending_ext_gstate_operations))
                pending_ext_gstate_operations = []
            output.append((operands, operator))
            if no_print_policy is not None:
                if fill_descriptor is None:
                    raise SalesFolderSanitizationError(
                        "Reviewed no-print paint does not have a replayable Device fill state"
                    )
                output.append(make_device_color_operator(fill_descriptor))
            path = []
            continue
        if operator == b"Do" and operands:
            key = str(operands[0])
            reference = xobjects.get(operands[0])
            if reference is None:
                raise SalesFolderSanitizationError(f"Missing referenced XObject {key}")
            subtype = str(reference.get_object().get("/Subtype") or "")
            if subtype == "/Image":
                raise SalesFolderSanitizationError(
                    f"Raster image remains in preserved layer {layer or '__unlayered__'}"
                )
            if subtype != "/Form":
                raise SalesFolderSanitizationError(f"Unsupported XObject subtype {subtype}")
            if unresolved_non_device_fill or unresolved_non_device_stroke:
                raise SalesFolderSanitizationError(
                    "Removed content leaves an unsupported non-Device color state used by a preserved Form"
                )
            if pending_fill_operations:
                if fill_descriptor is None:
                    raise SalesFolderSanitizationError(
                        "Removed content leaves an unsupported non-Device fill state used by a preserved Form"
                    )
                output.extend(copy.deepcopy(pending_fill_operations))
                pending_fill_operations = []
            if pending_stroke_operations:
                if stroke_descriptor is None:
                    raise SalesFolderSanitizationError(
                        "Removed content leaves an unsupported non-Device stroke state used by a preserved Form"
                    )
                output.extend(copy.deepcopy(pending_stroke_operations))
                pending_stroke_operations = []
            if pending_ext_gstate_operations:
                output.extend(copy.deepcopy(pending_ext_gstate_operations))
                pending_ext_gstate_operations = []
            xobject_contexts[key].add(layer or "__unlayered__")
            output.append((operands, operator)); continue
        output.append((operands, operator))

    if text_depth or layer_stack or state_stack:
        raise SalesFolderSanitizationError(
            "Unbalanced PDF text, marked-content, or graphics-state operators"
        )
    return output, xobject_contexts


def sanitize_form(
    reference: Any,
    reader: PdfReader,
    page_number: int,
    layer_policies: dict[str, dict[str, Any]],
    no_print: list[dict[str, Any]],
    conversion_counts: dict[int, int],
    conversion_paths: dict[int, list[str]],
    reclassified_cut_paths: set[str],
    reclassified_cut_counts: dict[str, int],
    inherited_layer: str,
) -> DecodedStreamObject:
    form = reference.get_object()
    operations, contexts = sanitize_operations(
        form, reader, page_number, layer_policies, no_print, conversion_counts,
        conversion_paths, reclassified_cut_paths, reclassified_cut_counts,
        inherited_layer
    )
    if any(len(values) != 1 for values in contexts.values()):
        raise SalesFolderSanitizationError("Form XObject is reused across multiple layer contexts")
    resources = form.get("/Resources")
    resources = copy.deepcopy(resources.get_object()) if resources else DictionaryObject()
    rename_spot_colorants_in_resources(resources)
    xobjects = resources.get("/XObject")
    if xobjects:
        xobjects = xobjects.get_object()
        used = {str(operands[0]) for operands, operator in operations if operator == b"Do" and operands}
        for key in list(xobjects.keys()):
            if str(key) not in used:
                del xobjects[key]
                continue
            context = next(iter(contexts[str(key)]))
            if context == "__unlayered__":
                raise SalesFolderSanitizationError("Nested Form XObject has no reviewed layer context")
            xobjects[key] = sanitize_form(
                xobjects[key], reader, page_number, layer_policies, no_print,
                conversion_counts, conversion_paths, reclassified_cut_paths,
                reclassified_cut_counts, context,
            )
        if not xobjects:
            resources.pop(NameObject("/XObject"), None)
    resources.pop(NameObject("/Font"), None)
    resources.pop(NameObject("/Properties"), None)
    clean_dictionary(resources)
    result = DecodedStreamObject()
    for key, value in form.items():
        if str(key) in {"/Length", "/Filter", "/DecodeParms", "/Metadata", "/PieceInfo", "/LastModified", "/OC"}:
            continue
        result[key] = copy.deepcopy(value)
    result[NameObject("/Resources")] = resources
    result.set_data(serialize_operations(operations, reader))
    clean_dictionary(result)
    return result


def sanitize_page(
    page: Any,
    reader: PdfReader,
    page_number: int,
    layer_policies: dict[str, dict[str, Any]],
    no_print: list[dict[str, Any]],
    conversion_counts: dict[int, int],
    conversion_paths: dict[int, list[str]],
    reclassified_cut_paths: set[str],
    reclassified_cut_counts: dict[str, int],
) -> tuple[Any, dict[str, str]]:
    original_properties = layer_map(page)
    operations, contexts = sanitize_operations(
        page, reader, page_number, layer_policies, no_print, conversion_counts,
        conversion_paths, reclassified_cut_paths, reclassified_cut_counts
    )
    if any(len(values) != 1 for values in contexts.values()):
        raise SalesFolderSanitizationError("Page Form XObject is reused across multiple layer contexts")
    resources = page.get("/Resources")
    resources = copy.deepcopy(resources.get_object()) if resources else DictionaryObject()
    rename_spot_colorants_in_resources(resources)
    xobjects = resources.get("/XObject")
    if xobjects:
        xobjects = xobjects.get_object()
        used = {str(operands[0]) for operands, operator in operations if operator == b"Do" and operands}
        for key in list(xobjects.keys()):
            if str(key) not in used:
                del xobjects[key]
                continue
            context = next(iter(contexts[str(key)]))
            if context == "__unlayered__":
                raise SalesFolderSanitizationError("Form XObject has no reviewed layer context")
            xobjects[key] = sanitize_form(
                xobjects[key], reader, page_number, layer_policies, no_print,
                conversion_counts, conversion_paths, reclassified_cut_paths,
                reclassified_cut_counts, context,
            )
        if not xobjects:
            resources.pop(NameObject("/XObject"), None)
    resources.pop(NameObject("/Font"), None)
    resources.pop(NameObject("/Properties"), None)
    clean_dictionary(resources)
    page[NameObject("/Resources")] = resources
    stream = DecodedStreamObject()
    stream.set_data(serialize_operations(operations, reader))
    page[NameObject("/Contents")] = stream
    for key in (
        "/Metadata", "/PieceInfo", "/LastModified", "/Thumb", "/AA", "/A",
        "/AF", "/Annots",
    ):
        page.pop(NameObject(key), None)
    preserved_properties = {
        property_name: layer_name
        for property_name, layer_name in original_properties.items()
        if layer_policies[layer_name]["action"] == "preserve"
    }
    return page, preserved_properties


def wrap_text(text: str, font: str, size: float, width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        if pdfmetrics.stringWidth(word, font, size) > width:
            raise SalesFolderSanitizationError(
                "Danish information contains an unbreakable word wider than the reviewed panel"
            )
        candidate = " ".join((*current, word))
        if current and pdfmetrics.stringWidth(candidate, font, size) > width:
            lines.append(" ".join(current)); current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def geometry_label(geometry: dict[str, Any]) -> str:
    format_labels = {
        "a4": "A4", "a5": "A5", "a6": "A6", "din-lang": "DIN-lang",
        "square-21x21": "21 × 21 cm", "cd-135x135": "CD 135 × 135 mm",
    }
    construction_labels = {
        "2-part-standard": "standardmodel",
        "2-part-standard-window": "standardmodel med vindue",
        "2-part-2-flaps": "2 flapper",
        "2-part-2-flaps-window": "2 flapper med vindue",
        "2-part-3-flaps": "3 flapper",
        "2-part-3-flaps-window": "3 flapper med vindue",
        "2-part-closure": "lukning",
        "3-part-1-flap": "3-delt med 1 flap",
    }
    return (
        f"{format_labels[geometry['format']]} · {construction_labels[geometry['construction']]} · "
        f"{geometry['print']} · {geometry['spineMm']} mm ryg"
    )


def finish_label(finish_key: str) -> str:
    return {
        "none": "Ingen efterbehandling",
        "high-gloss-uv": "Højglans UV-lak",
        "partial-uv": "Partiel UV-lak",
        "matt-lamination": "Mat laminering",
        "gloss-lamination": "Blank laminering",
        "soft-touch-lamination": "Soft-touch-laminering",
        "soft-touch-partial-uv": "Soft-touch + partiel UV-lak",
        "hot-foil-gold": "Guldfoliepræg",
        "hot-foil-silver": "Sølvfoliepræg",
        "blind-emboss": "Blindpræg",
    }[finish_key]


def create_info_overlay(
    page_width: float,
    page_height: float,
    rect: list[float],
    geometry: dict[str, Any],
    finish_key: str,
    measurements: dict[str, float],
    finish_instructions: list[dict[str, str]],
    professional_upload_warning_da: str | None,
) -> Any:
    x, y, width, height = rect
    padding = 9.0
    lines = [
        ("WEBPRINTER TRYKSKABELON", True),
        (geometry_label(geometry), True),
        (f"Efterbehandling: {finish_label(finish_key)}", False),
        (f"Dataformat: inkluderer {measurements['bleedMm']:g} mm udfald", False),
        ("Beskæring og stans: magenta streg", False),
        ("Falselinjer: cyan streg", False),
        (f"Sikkerhedsafstand: blå hjælpelinje, {measurements['safetyMm']:g} mm fra skærekanten", False),
        ("Grå flade: ikke synlig / uden tryk", False),
        ("Hjælpelag vises kun på skærmen og skal ikke med i trykfilen.", False),
    ]
    for instruction in finish_instructions:
        lines.append((instruction["danish"], False))
    if professional_upload_warning_da is not None:
        lines.append((professional_upload_warning_da, False))
    chosen: tuple[float, list[tuple[str, bool]], float] | None = None
    for size in (8.0, 7.5, 7.0, 6.5, 6.0, 5.5):
        wrapped: list[tuple[str, bool]] = []
        for line, bold in lines:
            font = "Helvetica-Bold" if bold else "Helvetica"
            for fragment in wrap_text(line, font, size + (0.8 if bold else 0), width - padding * 2):
                wrapped.append((fragment, bold))
        leading = size * 1.38
        first_size = size + (0.8 if wrapped and wrapped[0][1] else 0)
        last_size = size + (0.8 if wrapped and wrapped[-1][1] else 0)
        first_ascent, _ = pdfmetrics.getAscentDescent(
            "Helvetica-Bold" if wrapped and wrapped[0][1] else "Helvetica",
            first_size,
        )
        _, last_descent = pdfmetrics.getAscentDescent(
            "Helvetica-Bold" if wrapped and wrapped[-1][1] else "Helvetica",
            last_size,
        )
        first_baseline = y + height - padding - size
        last_baseline = first_baseline - leading * max(0, len(wrapped) - 1)
        if (
            first_baseline + first_ascent <= y + height - padding + 0.1
            and last_baseline + last_descent >= y + padding - 0.1
        ):
            chosen = size, wrapped, leading
            break
    if chosen is None:
        raise SalesFolderSanitizationError("Danish information text does not fit inside reviewed panel rectangle")
    size, wrapped, leading = chosen
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_width, page_height), pageCompression=1)
    pdf.setFillColor(HexColor(WEBPRINTER_BLUE))
    pdf.setStrokeColor(HexColor(WEBPRINTER_BLUE_BORDER))
    pdf.setLineWidth(1.2)
    pdf.roundRect(x, y, width, height, 5, fill=1, stroke=1)
    cursor = y + height - padding - size
    last_glyph_bottom: float | None = None
    for line, bold in wrapped:
        font = "Helvetica-Bold" if bold else "Helvetica"
        line_size = size + (0.8 if bold else 0)
        line_width = pdfmetrics.stringWidth(line, font, line_size)
        ascent, descent = pdfmetrics.getAscentDescent(font, line_size)
        if (
            x + padding + line_width > x + width - padding + 0.1
            or cursor + ascent > y + height - padding + 0.1
            or cursor + descent < y + padding - 0.1
        ):
            raise SalesFolderSanitizationError(
                "Danish information text escaped reviewed panel rectangle"
            )
        pdf.setFont(font, line_size)
        pdf.setFillColor(HexColor("#FFFFFF"))
        pdf.drawString(x + padding, cursor, line)
        last_glyph_bottom = cursor + descent
        cursor -= leading
    # ``cursor`` now points one unused leading interval below the final line.
    # Containment is determined by the actual last glyph descent, not by where
    # a hypothetical next baseline would be placed.
    if last_glyph_bottom is None or last_glyph_bottom < y + padding - 0.1:
        raise SalesFolderSanitizationError("Danish information text escaped reviewed panel rectangle")
    pdf.showPage(); pdf.save()
    overlay_reader = PdfReader(io.BytesIO(buffer.getvalue()))
    overlay = overlay_reader.pages[0]
    content = overlay.get_contents().get_data()
    stream = DecodedStreamObject()
    stream.set_data(b"/OC /WPInfo BDC\n" + content + b"\nEMC\n")
    overlay[NameObject("/Contents")] = stream
    resources = overlay["/Resources"].get_object()
    resources[NameObject("/Properties")] = DictionaryObject(
        {NameObject("/WPInfo"): DictionaryObject()}
    )
    return overlay


def ocg_dictionary(name: str) -> DictionaryObject:
    return DictionaryObject({
        NameObject("/Type"): NameObject("/OCG"),
        NameObject("/Name"): TextStringObject(name),
        NameObject("/Usage"): DictionaryObject({
            NameObject("/View"): DictionaryObject({NameObject("/ViewState"): NameObject("/ON")}),
            NameObject("/Print"): DictionaryObject({NameObject("/PrintState"): NameObject("/OFF")}),
            NameObject("/Export"): DictionaryObject({NameObject("/ExportState"): NameObject("/OFF")}),
        }),
    })


def create_generated_no_print_overlay(
    page_width: float,
    page_height: float,
    rect: list[float],
) -> Any:
    """Create one exact neutral-grey helper-layer rectangle for a white 4+0 page."""

    x, y, width, height = rect
    overlay_writer = PdfWriter()
    overlay = overlay_writer.add_blank_page(width=page_width, height=page_height)
    rgb = " ".join(f"{component:.9f}" for component in NO_PRINT_GRAY_RGB)
    geometry = " ".join(f"{value:.7f}" for value in (x, y, width, height))
    stream = DecodedStreamObject()
    stream.set_data(
        (
            "/OC /WPNoPrint BDC\n"
            f"q {rgb} rg {geometry} re f Q\n"
            "EMC\n"
        ).encode("ascii")
    )
    overlay[NameObject("/Contents")] = stream
    overlay[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Properties"): DictionaryObject({
            NameObject("/WPNoPrint"): DictionaryObject(),
        }),
    })
    return overlay


def create_verified_beschnitt_overlay(
    page_width: float,
    page_height: float,
    page_records: list[dict[str, Any]],
    donor_reader: PdfReader,
) -> Any:
    """Re-emit only approved, CTM-aware donor strokes on the Beschnitt helper OCG."""

    operations: list[tuple[Any, bytes]] = [
        ([NameObject("/OC"), NameObject("/WPBeschnittGuide")], b"BDC")
    ]
    ext_gstate_descriptors = {
        canonical_json(record.get("extGState", {}))
        for record in page_records
    }
    if len(ext_gstate_descriptors) != 1:
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor page mixes effective ExtGState values"
        )
    donor_ext_gstate = page_records[0].get("extGState", {}) if page_records else {}
    if donor_ext_gstate not in ({}, VERIFIED_BESCHNITT_DONOR_EXT_GSTATE):
        raise SalesFolderSanitizationError(
            "Verified Beschnitt donor stroke ExtGState differs from the exact approved state"
        )
    for record in page_records:
        if record["operator"] != "S" or not record.get("_pathOperations"):
            raise SalesFolderSanitizationError(
                "Verified Beschnitt donor import supports only exact non-empty simple strokes"
            )
        stroke_color = record.get("_strokeColorOperation")
        if stroke_color is not None and stroke_color[1] not in STROKE_COLOR_OPERATORS:
            raise SalesFolderSanitizationError(
                "Verified Beschnitt donor stroke uses a non-Device color space"
            )
        if record.get("extGState", {}) != donor_ext_gstate:
            raise SalesFolderSanitizationError(
                "Verified Beschnitt donor stroke ExtGState differs from the exact approved state"
            )
        operations.append(([], b"q"))
        if donor_ext_gstate:
            operations.append(([NameObject("/WPDonorGS0")], b"gs"))
        operations.append(
            (
                [FloatObject(value) for value in record["_effectiveCtm"]],
                b"cm",
            )
        )
        for operator, operands in sorted(
            record.get("_lineStyleOperations", {}).items()
        ):
            operations.append((copy.deepcopy(operands), operator))
        if stroke_color is not None:
            operations.append((copy.deepcopy(stroke_color[0]), stroke_color[1]))
        operations.extend(copy.deepcopy(record["_pathOperations"]))
        operations.append(([], b"S"))
        operations.append(([], b"Q"))
    operations.append(([], b"EMC"))
    overlay_writer = PdfWriter()
    overlay = overlay_writer.add_blank_page(width=page_width, height=page_height)
    stream = DecodedStreamObject()
    stream.set_data(serialize_operations(operations, donor_reader))
    overlay[NameObject("/Contents")] = stream
    resources = DictionaryObject({
        NameObject("/Properties"): DictionaryObject({
            NameObject("/WPBeschnittGuide"): DictionaryObject(),
        }),
    })
    if donor_ext_gstate:
        resources[NameObject("/ExtGState")] = DictionaryObject({
            NameObject("/WPDonorGS0"): DictionaryObject({
                NameObject("/Type"): NameObject("/ExtGState"),
                NameObject("/AIS"): BooleanObject(False),
                NameObject("/BM"): NameObject("/Normal"),
                NameObject("/CA"): FloatObject(1),
                NameObject("/OP"): BooleanObject(False),
                NameObject("/OPM"): FloatObject(1),
                NameObject("/SA"): BooleanObject(True),
                NameObject("/SMask"): NameObject("/None"),
                NameObject("/ca"): FloatObject(1),
                NameObject("/op"): BooleanObject(False),
            }),
        })
    overlay[NameObject("/Resources")] = resources
    return overlay


def set_ocproperties(writer: PdfWriter, refs: list[Any]) -> None:
    groups = ArrayObject(refs)
    associations = ArrayObject([
        DictionaryObject({
            NameObject("/Event"): NameObject(f"/{event}"),
            NameObject("/Category"): ArrayObject([NameObject(f"/{event}")]),
            NameObject("/OCGs"): groups,
        })
        for event in ("View", "Print", "Export")
    ])
    writer._root_object[NameObject("/OCProperties")] = DictionaryObject({
        NameObject("/OCGs"): groups,
        NameObject("/D"): DictionaryObject({
            NameObject("/Name"): TextStringObject("Webprinter salgsmappe-skabelon"),
            NameObject("/Order"): groups,
            NameObject("/ON"): groups,
            NameObject("/OFF"): ArrayObject(),
            NameObject("/AS"): associations,
        }),
    })


def build_output(source: Path, target: Path, contract: dict[str, Any]) -> dict[str, Any]:
    reader = PdfReader(str(source), strict=True)
    writer = PdfWriter()
    writer.pdf_header = "%PDF-1.7"
    writer.metadata = None
    preserved_names = [
        item["name"] for item in contract["layers"] if item["action"] == "preserve"
    ]
    layer_refs = {
        name: writer._add_object(ocg_dictionary(contract["_layerOutputNames"][name]))
        for name in preserved_names
    }
    info_ref = writer._add_object(ocg_dictionary(INFO_LAYER_NAME))
    generated_no_print_ref = (
        writer._add_object(ocg_dictionary(GENERATED_NO_PRINT_LAYER_NAME))
        if contract["_generatedNoPrintBackgrounds"]
        else None
    )
    conversion_counts: dict[int, int] = defaultdict(int)
    conversion_paths: dict[int, list[str]] = defaultdict(list)
    donor_policy = contract["_verifiedBeschnittGuideDonor"]
    reclassified_cut_paths = set(
        donor_policy["removeSourceSchneidenPathGeometrySha256s"]
        if donor_policy else []
    )
    reclassified_cut_counts: dict[str, int] = defaultdict(int)
    donor_reader = (
        PdfReader(str(donor_policy["donorPath"]), strict=True)
        if donor_policy else None
    )
    donor_records_by_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    if donor_policy:
        for record in donor_policy["donorStrokeRecords"]:
            donor_records_by_page[record["page"]].append(record)
    panel_by_page = {item["page"]: item["rectPt"] for item in contract["_informationPanels"]}
    generated_no_print_by_page = {
        item["page"]: item for item in contract["_generatedNoPrintBackgrounds"]
    }

    for page_number, source_page in enumerate(reader.pages, 1):
        page, property_layers = sanitize_page(
            source_page,
            reader,
            page_number,
            contract["_layerPolicies"],
            contract["_noPrintAreas"],
            conversion_counts,
            conversion_paths,
            reclassified_cut_paths,
            reclassified_cut_counts,
        )
        writer.add_page(page)
        output_page = writer.pages[-1]
        if page_number in generated_no_print_by_page:
            policy = generated_no_print_by_page[page_number]
            background = create_generated_no_print_overlay(
                float(output_page.mediabox.width),
                float(output_page.mediabox.height),
                policy["rectPt"],
            )
            output_page.merge_page(background, over=False, expand=False)
        if page_number in donor_records_by_page:
            if donor_reader is None:  # pragma: no cover - defensive narrowing
                raise SalesFolderSanitizationError("Verified donor reader is missing")
            guide = create_verified_beschnitt_overlay(
                float(output_page.mediabox.width),
                float(output_page.mediabox.height),
                donor_records_by_page[page_number],
                donor_reader,
            )
            output_page.merge_page(guide, expand=False)
        if page_number in panel_by_page:
            overlay = create_info_overlay(
                float(output_page.mediabox.width),
                float(output_page.mediabox.height),
                panel_by_page[page_number],
                contract["geometry"],
                contract["finishKey"],
                contract["_measurements"],
                contract["_finishInstructions"],
                contract["_professionalUploadWarningDa"],
            )
            output_page.merge_page(overlay, expand=False)
        resources = output_page.get("/Resources").get_object()
        properties = DictionaryObject()
        for property_name, layer_name in property_layers.items():
            properties[NameObject(property_name)] = layer_refs[layer_name]
        properties[NameObject("/WPInfo")] = info_ref
        if generated_no_print_ref is not None:
            properties[NameObject("/WPNoPrint")] = generated_no_print_ref
        if page_number in donor_records_by_page:
            properties[NameObject("/WPBeschnittGuide")] = layer_refs[
                "Beschnitt Seite"
            ]
        resources[NameObject("/Properties")] = properties
        clean_dictionary(resources)

    for index, policy in enumerate(contract["_noPrintAreas"]):
        if conversion_counts[index] != policy["expectedPaintCount"]:
            raise SalesFolderSanitizationError(
                f"No-print policy {index + 1} converted {conversion_counts[index]} paints; "
                f"reviewed count is {policy['expectedPaintCount']}"
            )
        if sorted(conversion_paths[index]) != policy["pathSha256s"]:
            raise SalesFolderSanitizationError(
                f"No-print policy {index + 1} converted a different reviewed path set"
            )
    if donor_policy:
        expected_reclassified = {
            value: 1
            for value in donor_policy["removeSourceSchneidenPathGeometrySha256s"]
        }
        if dict(reclassified_cut_counts) != expected_reclassified:
            raise SalesFolderSanitizationError(
                "Source Schneiden contour reclassification count differs from the exact donor policy"
            )
    all_layer_refs = [*(layer_refs[name] for name in preserved_names), info_ref]
    if generated_no_print_ref is not None:
        all_layer_refs.append(generated_no_print_ref)
    set_ocproperties(writer, all_layer_refs)
    for key in (
        "/Metadata", "/Names", "/Outlines", "/OpenAction", "/AA", "/AF",
        "/AcroForm", "/StructTreeRoot", "/MarkInfo", "/PageLabels",
    ):
        writer._root_object.pop(NameObject(key), None)
    with target.open("wb") as handle:
        writer.write(handle)
    return {
        "conversionCounts": dict(conversion_counts),
        "conversionPathSha256s": {
            str(index): sorted(values) for index, values in conversion_paths.items()
        },
        "verifiedBeschnittGuideDonor": (
            {
                "reportSha256": donor_policy["reportSha256"],
                "entrySha256": donor_policy["entrySha256"],
                "donorSha256": donor_policy["donorSha256"],
                "importedStrokePathGeometrySha256s": donor_policy[
                    "importedStrokePathGeometrySha256s"
                ],
                "reclassifiedSourceSchneidenPathGeometrySha256s": donor_policy[
                    "removeSourceSchneidenPathGeometrySha256s"
                ],
            }
            if donor_policy else None
        ),
    }


def painted_color_events(reader: PdfReader) -> list[dict[str, Any]]:
    events = list(iter_source_events(reader))
    # A small verifier tracks only exact DeviceGray/RGB/CMYK fill state by page/layer.
    output = []
    fill_by_context: dict[tuple[int, str], tuple[str, list[float]]] = {}
    current_paths: dict[tuple[int, str], list[tuple[Any, bytes]]] = defaultdict(list)
    for event in events:
        key = (event["page"], event["layer"] or "__unlayered__")
        if event["kind"] == "color" and event["operator"] in (b"g", b"rg", b"k"):
            fill_by_context[key] = (
                event["operator"].decode("latin1"),
                [round(number(item), 7) for item in event["operands"]],
            )
        elif event["kind"] == "geometry" and event["operator"] in PATH_BUILD_OPERATORS:
            current_paths[key].append((event["operands"], event["operator"]))
        elif event["kind"] == "paint":
            if event["operator"] in FILL_PAINT_OPERATORS:
                output.append({
                    "page": event["page"],
                    "layer": event["layer"],
                    "color": fill_by_context.get(key),
                    "path": current_paths.get(key, []),
                })
            current_paths[key] = []
    return output


def device_paint_style_inventory(reader: PdfReader) -> list[dict[str, Any]]:
    """Return actual path-paint colors, including the generated information panel."""

    output: list[dict[str, Any]] = []
    active_forms: set[int] = set()

    def walk(
        container: Any,
        page_number: int,
        inherited_layer: str | None,
        inherited_fill: tuple[str, list[float]] | None = None,
        inherited_stroke: tuple[str, list[float]] | None = None,
    ) -> None:
        properties = layer_map(container)
        xobjects = xobject_map(container)
        layer = inherited_layer
        layer_stack: list[str | None] = []
        fill = copy.deepcopy(inherited_fill)
        stroke = copy.deepcopy(inherited_stroke)
        path: list[tuple[Any, bytes]] = []
        state_stack: list[
            tuple[tuple[str, list[float]] | None, tuple[str, list[float]] | None]
        ] = []
        for operands, operator in content_operations(container, reader):
            ocg = current_ocg_name(operands, operator, properties)
            if operator in (b"BDC", b"BMC"):
                layer_stack.append(layer)
                if ocg is not None:
                    layer = ocg
                continue
            if operator == b"EMC":
                layer = layer_stack.pop() if layer_stack else inherited_layer
                continue
            if operator == b"q":
                state_stack.append((copy.deepcopy(fill), copy.deepcopy(stroke)))
                continue
            if operator == b"Q":
                fill, stroke = state_stack.pop() if state_stack else (None, None)
                continue
            if operator in (b"g", b"rg", b"k"):
                fill = (
                    operator.decode("latin1"),
                    [round(number(item), 7) for item in operands],
                )
                continue
            if operator in (b"G", b"RG", b"K"):
                stroke = (
                    operator.decode("latin1"),
                    [round(number(item), 7) for item in operands],
                )
                continue
            if operator in (b"cs", b"sc", b"scn"):
                fill = None
                continue
            if operator in (b"CS", b"SC", b"SCN"):
                stroke = None
                continue
            if operator in PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
                path.append((copy.deepcopy(operands), operator))
                continue
            if operator in PATH_PAINT_OPERATORS:
                if operator != b"n":
                    output.append({
                        "page": page_number,
                        "layer": layer,
                        "operator": operator.decode("latin1"),
                        "fill": copy.deepcopy(fill),
                        "stroke": copy.deepcopy(stroke),
                        "pathSha256": paint_path_sha256(
                            page_number, layer or "__unlayered__", path
                        ),
                        "pathGeometrySha256": paint_path_geometry_sha256(
                            page_number, path
                        ),
                    })
                path = []
                continue
            if operator == b"Do" and operands:
                reference = xobjects.get(operands[0])
                if reference is None:
                    raise SalesFolderSanitizationError(
                        f"Missing referenced XObject {operands[0]}"
                    )
                obj = reference.get_object()
                if str(obj.get("/Subtype") or "") != "/Form":
                    continue
                identity = id(obj)
                if identity in active_forms:
                    raise SalesFolderSanitizationError(
                        "Recursive Form XObject is not supported"
                    )
                active_forms.add(identity)
                walk(obj, page_number, layer, fill, stroke)
                active_forms.remove(identity)

    for page_number, page in enumerate(reader.pages, 1):
        walk(page, page_number, None)
    return output


def device_color_rgb(color: tuple[str, list[float]] | None) -> tuple[float, float, float] | None:
    if color is None:
        return None
    operator, operands = color
    operator = operator.lower()
    if operator == "g" and len(operands) == 1:
        return (operands[0], operands[0], operands[0])
    if operator == "rg" and len(operands) == 3:
        return tuple(operands)  # type: ignore[return-value]
    if operator == "k" and len(operands) == 4:
        cyan, magenta, yellow, black = operands
        return (
            1 - min(1, cyan + black),
            1 - min(1, magenta + black),
            1 - min(1, yellow + black),
        )
    return None


def colors_match(
    actual: tuple[str, list[float]] | None,
    operator: str,
    expected: tuple[float, ...],
    tolerance: float = 0.00001,
) -> bool:
    return bool(
        actual
        and actual[0] == operator
        and len(actual[1]) == len(expected)
        and all(abs(left - right) <= tolerance for left, right in zip(actual[1], expected))
    )


def is_supplier_green_paint(color: tuple[str, list[float]] | None) -> bool:
    rgb = device_color_rgb(color)
    if rgb is None:
        return False
    red, green, blue = rgb
    return green >= 0.35 and green - red >= 0.18 and green - blue >= 0.18


def translated_color_descriptor(descriptor: str, output_name: str) -> str:
    value = json.loads(descriptor)
    value["layer"] = output_name
    return canonical_json(value)


def forbidden_interactive_feature_inventory(reader: PdfReader) -> list[str]:
    """Inspect all reachable output objects for actions, attachments, and comments."""

    hits: set[str] = set()
    visited_indirect: set[tuple[int, int]] = set()
    visited_direct: set[int] = set()

    def walk(value: Any, path: str) -> None:
        if hasattr(value, "idnum") and hasattr(value, "generation") and hasattr(value, "get_object"):
            key = (int(value.idnum), int(value.generation))
            if key in visited_indirect:
                return
            visited_indirect.add(key)
            try:
                walk(value.get_object(), f"{path}->obj({key[0]})")
            except Exception as exc:
                raise SalesFolderSanitizationError(
                    f"Cannot inspect reachable PDF object at {path}: {exc}"
                ) from exc
            return
        if isinstance(value, DictionaryObject):
            identity = id(value)
            if identity in visited_direct:
                return
            visited_direct.add(identity)
            type_name = str(value.get("/Type") or "")
            subtype_name = str(value.get("/Subtype") or "")
            action_name = str(value.get("/S") or "")
            if type_name in {"/Filespec", "/Action"}:
                hits.add(f"{path}:{type_name}")
            if subtype_name in {
                "/Text", "/FreeText", "/Popup", "/Stamp", "/Highlight",
                "/Underline", "/Squiggly", "/StrikeOut", "/FileAttachment",
                "/Sound", "/Movie", "/RichMedia", "/3D", "/Link",
            }:
                hits.add(f"{path}:{subtype_name}")
            if action_name in {
                "/JavaScript", "/Launch", "/URI", "/GoToR", "/SubmitForm",
                "/ImportData", "/Rendition", "/Movie", "/Sound",
            }:
                hits.add(f"{path}:/S={action_name}")
            for key, child in value.items():
                key_name = str(key)
                if key_name in FORBIDDEN_INTERACTIVE_KEYS:
                    hits.add(f"{path}:{key_name}")
                walk(child, f"{path}/{key_name.lstrip('/')}")
            return
        if isinstance(value, (list, tuple, ArrayObject)):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]")

    walk(reader.trailer.get("/Root"), "root")
    info = reader.trailer.get("/Info")
    if info is not None:
        walk(info, "info")
    return sorted(hits)


def decoded_pdf_bytes(reader: PdfReader) -> bytes:
    """Collect strings and decoded streams so compressed supplier identity cannot hide."""

    chunks: list[bytes] = []
    visited_indirect: set[tuple[int, int]] = set()
    visited_direct: set[int] = set()

    def walk(value: Any) -> None:
        if hasattr(value, "idnum") and hasattr(value, "generation") and hasattr(value, "get_object"):
            key = (int(value.idnum), int(value.generation))
            if key in visited_indirect:
                return
            visited_indirect.add(key)
            walk(value.get_object())
            return
        if isinstance(value, DictionaryObject):
            identity = id(value)
            if identity in visited_direct:
                return
            visited_direct.add(identity)
            if hasattr(value, "get_data"):
                try:
                    chunks.append(value.get_data())
                except Exception as exc:
                    raise SalesFolderSanitizationError(
                        f"Cannot decode reachable PDF stream: {exc}"
                    ) from exc
            for key, child in value.items():
                chunks.append(str(key).encode("utf-8", errors="ignore"))
                walk(child)
            return
        if isinstance(value, (list, tuple, ArrayObject)):
            for child in value:
                walk(child)
            return
        if isinstance(value, bytes):
            chunks.append(value)
        elif isinstance(value, str):
            chunks.append(value.encode("utf-8", errors="ignore"))
            chunks.append(value.encode("latin1", errors="ignore"))

    walk(reader.trailer.get("/Root"))
    info = reader.trailer.get("/Info")
    if info is not None:
        walk(info)
    return b"\n".join(chunks)


def contains_exact_pdf_token(decoded_lower: bytes, value: str) -> bool:
    """Match one exact decoded PDF token, not a prefix of a translated word.

    Danish ``Magnetpunkter`` legitimately starts with the complete German
    source-layer spelling ``Magnetpunkte``.  A raw substring test therefore
    rejects the clean translation.  PDF names and scalar strings are separated
    by punctuation/whitespace in the decoded-object inventory, so require
    non-name boundaries while still catching a separately reachable exact old
    OCG name.
    """

    needles: set[bytes] = set()
    for encoding in ("utf-8", "latin1"):
        try:
            needles.add(value.encode(encoding).lower())
        except UnicodeEncodeError:
            continue
    for needle in needles:
        pattern = (
            rb"(?<![A-Za-z0-9_])"
            + re.escape(needle)
            + rb"(?![A-Za-z0-9_])"
        )
        if re.search(pattern, decoded_lower):
            return True
    return False


def supplier_identity_hits(reader: PdfReader, raw_bytes: bytes) -> list[str]:
    searchable = raw_bytes + b"\n" + decoded_pdf_bytes(reader)
    return [
        pattern.decode("ascii")
        for pattern in SUPPLIER_IDENTITY_PATTERNS
        if re.search(pattern, searchable, flags=re.IGNORECASE)
    ]


def verify_information_text_containment(
    output: Path,
    panels: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Independently measure written glyph boxes from the completed output PDF."""

    try:
        import pdfplumber
    except ImportError as exc:
        raise SalesFolderSanitizationError(
            "pdfplumber is required for independent information-panel text verification"
        ) from exc
    panel_by_page = {item["page"]: item["rectPt"] for item in panels}
    evidence: list[dict[str, Any]] = []
    with pdfplumber.open(str(output)) as document:
        for page_number, page in enumerate(document.pages, 1):
            characters = [item for item in page.chars if str(item.get("text") or "").strip()]
            panel = panel_by_page.get(page_number)
            if panel is None:
                if characters:
                    raise SalesFolderSanitizationError(
                        f"Output text remains outside reviewed information panels on page {page_number}"
                    )
                continue
            if not characters:
                raise SalesFolderSanitizationError(
                    f"Reviewed information panel on page {page_number} contains no measurable text"
                )
            x, y, width, height = panel
            allowed = (x, y, x + width, y + height)
            tolerance = 0.5
            for character in characters:
                bounds = (
                    number(character["x0"]),
                    number(character["y0"]),
                    number(character["x1"]),
                    number(character["y1"]),
                )
                if (
                    bounds[0] < allowed[0] - tolerance
                    or bounds[1] < allowed[1] - tolerance
                    or bounds[2] > allowed[2] + tolerance
                    or bounds[3] > allowed[3] + tolerance
                ):
                    raise SalesFolderSanitizationError(
                        f"Danish information glyph escaped reviewed panel rectangle on page {page_number}"
                    )
            measured = (
                min(number(item["x0"]) for item in characters),
                min(number(item["y0"]) for item in characters),
                max(number(item["x1"]) for item in characters),
                max(number(item["y1"]) for item in characters),
            )
            evidence.append({
                "page": page_number,
                "characterCount": len(characters),
                "approvedRectPt": [round(value, 6) for value in allowed],
                "measuredTextBoundsPt": [round(value, 6) for value in measured],
            })
    if {item["page"] for item in evidence} != set(panel_by_page):
        raise SalesFolderSanitizationError(
            "Independent information-panel text coverage is incomplete"
        )
    return evidence


def output_layer_details(reader: PdfReader) -> list[dict[str, str]]:
    root = reader.trailer["/Root"]
    properties = root.get("/OCProperties")
    if not properties:
        return []
    groups = properties.get_object().get("/OCGs", [])
    details = []
    for reference in groups:
        group = reference.get_object()
        usage = group.get("/Usage", {})
        details.append({
            "name": str(group.get("/Name") or ""),
            "viewState": str(usage.get("/View", {}).get("/ViewState") or ""),
            "printState": str(usage.get("/Print", {}).get("/PrintState") or ""),
            "exportState": str(usage.get("/Export", {}).get("/ExportState") or ""),
        })
    return details


def reviewed_layer_color_descriptors(reader: PdfReader, layer_names: set[str]) -> set[str]:
    """Return only Device colors that actually paint preserved vector paths.

    Supplier text is deliberately removed.  A color operator used only inside
    such a text object is therefore not a preserved-geometry color and must not
    make the sanitized output fail merely because the text and its unused
    graphics state disappeared together.
    """

    descriptors: set[str] = set()
    for paint in device_paint_style_inventory(reader):
        if paint["layer"] not in layer_names:
            continue
        operator = paint["operator"].encode("latin1")
        if operator in FILL_PAINT_OPERATORS and paint["fill"] is not None:
            fill_operator, operands = paint["fill"]
            descriptors.add(color_descriptor(
                paint["page"], paint["layer"], fill_operator.encode("latin1"), operands
            ))
        if operator in STROKE_PAINT_OPERATORS and paint["stroke"] is not None:
            stroke_operator, operands = paint["stroke"]
            descriptors.add(color_descriptor(
                paint["page"], paint["layer"], stroke_operator.encode("latin1"), operands
            ))
    return descriptors


def public_stroke_record(record: dict[str, Any], *, layer: str) -> dict[str, Any]:
    return {
        key: (layer if key == "layer" else copy.deepcopy(value))
        for key, value in record.items()
        if not key.startswith("_")
    }


def validate_output(source: Path, output: Path, contract: dict[str, Any], observed: dict[str, Any]) -> dict[str, Any]:
    source_reader = PdfReader(str(source), strict=True)
    output_reader = PdfReader(str(output), strict=True)
    if len(source_reader.pages) != len(output_reader.pages):
        raise SalesFolderSanitizationError("Output page count differs from reviewed source")
    output_boxes = page_box_inventory(output_reader)
    if output_boxes != observed["sourceEvidence"]["pageBoxes"]:
        raise SalesFolderSanitizationError("Output Media/Crop/Bleed/Trim/Art boxes changed")

    output_geometry = geometry_inventory(output_reader)
    source_geometry = observed["sourceEvidence"]["geometryFingerprints"]
    preserved = {item["name"] for item in contract["layers"] if item["action"] == "preserve"}
    output_names = contract["_layerOutputNames"]
    donor_policy = contract["_verifiedBeschnittGuideDonor"]
    geometry_exceptions = (
        {"Beschnitt Seite", "Schneiden"}
        if donor_policy else set()
    )
    for name in preserved:
        if name in geometry_exceptions:
            continue
        if output_geometry.get(output_names[name]) != source_geometry.get(name):
            raise SalesFolderSanitizationError(f"Vector geometry fingerprint changed for layer {name}")
        expected_strokes = [
            public_stroke_record(item, layer=output_names[name])
            for item in _stroke_path_inventory(
                source_reader,
                name,
                include_ext_gstate=True,
            )
        ]
        actual_strokes = _stroke_path_inventory(
            output_reader,
            output_names[name],
            include_ext_gstate=True,
        )
        if actual_strokes != expected_strokes:
            raise SalesFolderSanitizationError(
                f"Effective stroke state changed for preserved layer {name}"
            )
    donor_output_validation = None
    if donor_policy:
        output_beschnitt = _stroke_path_inventory(
            output_reader,
            output_names["Beschnitt Seite"],
            include_ext_gstate=True,
        )
        expected_beschnitt = [
            public_stroke_record(item, layer=output_names["Beschnitt Seite"])
            for item in donor_policy["donorStrokeRecords"]
        ]
        if output_beschnitt != expected_beschnitt:
            raise SalesFolderSanitizationError(
                "Output Beschnitt strokes differ from the exact path-pinned donor geometry/style/CTM"
            )
        source_cut = stroke_path_inventory(source_reader, "Schneiden")
        removed_cut = Counter(
            donor_policy["removeSourceSchneidenPathGeometrySha256s"]
        )
        expected_cut = []
        for item in source_cut:
            path_hash = item["pathGeometrySha256"]
            if removed_cut[path_hash] > 0:
                removed_cut[path_hash] -= 1
                continue
            expected_cut.append(
                public_stroke_record(item, layer=output_names["Schneiden"])
            )
        if any(removed_cut.values()):
            raise SalesFolderSanitizationError(
                "Approved Schneiden contour was not present for output validation"
            )
        output_cut = stroke_path_inventory(output_reader, output_names["Schneiden"])
        if output_cut != expected_cut:
            raise SalesFolderSanitizationError(
                "Output Schneiden strokes changed outside exact donor contour reclassification"
            )
        beschnitt_paints = [
            event for event in iter_source_events(output_reader)
            if event["kind"] == "paint"
            and event["layer"] == output_names["Beschnitt Seite"]
            and event["operator"] != b"n"
        ]
        if (
            len(beschnitt_paints) != len(expected_beschnitt)
            or any(event["operator"] != b"S" for event in beschnitt_paints)
        ):
            raise SalesFolderSanitizationError(
                "Output Beschnitt helper layer contains unapproved fill or non-stroke paint"
            )
        donor_output_validation = {
            "reportSha256": donor_policy["reportSha256"],
            "entrySha256": donor_policy["entrySha256"],
            "donorSha256": donor_policy["donorSha256"],
            "pageBoxesSha256": donor_policy["pageBoxesSha256"],
            "importedStrokePathGeometrySha256s": [
                item["pathGeometrySha256"] for item in output_beschnitt
            ],
            "reclassifiedSourceSchneidenPathGeometrySha256s": donor_policy[
                "removeSourceSchneidenPathGeometrySha256s"
            ],
            "sourceFoldCutAndAccessoryAuthorityPreserved": True,
            "fullPdfRebindPerformed": False,
            "textApproximationUsed": False,
            "visualOutputQaPending": True,
        }
    removed = {item["name"] for item in contract["layers"] if item["action"] == "remove"}
    if removed.intersection(output_geometry):
        raise SalesFolderSanitizationError("Removed supplier layer geometry remains in output")

    expected_color_descriptors = {
        translated_color_descriptor(
            descriptor,
            output_names[json.loads(descriptor)["layer"]],
        )
        for descriptor in reviewed_layer_color_descriptors(
            source_reader, preserved
        )
    }
    if donor_policy:
        # Reclassified outer contours stop painting on the source cut layer and
        # reappear exactly once on the imported Beschnitt guide layer.  Rebuild
        # the cut-layer stroke-color set from the retained source strokes so a
        # color used only by a moved contour is not falsely expected on both
        # layers.  Fill colors and unrelated cut strokes remain untouched.
        for record in source_cut:
            stroke_color = record["strokeColor"]
            if stroke_color is not None:
                expected_color_descriptors.discard(
                    color_descriptor(
                        record["page"],
                        output_names["Schneiden"],
                        stroke_color["operator"].encode("latin1"),
                        stroke_color["operands"],
                    )
                )
        for record in expected_cut:
            stroke_color = record["strokeColor"]
            if stroke_color is not None:
                expected_color_descriptors.add(
                    color_descriptor(
                        record["page"],
                        output_names["Schneiden"],
                        stroke_color["operator"].encode("latin1"),
                        stroke_color["operands"],
                    )
                )
        for record in donor_policy["donorStrokeRecords"]:
            stroke_color = record["strokeColor"]
            if stroke_color is not None:
                expected_color_descriptors.add(
                    color_descriptor(
                        record["page"],
                        output_names["Beschnitt Seite"],
                        stroke_color["operator"].encode("latin1"),
                        stroke_color["operands"],
                    )
                )
    source_device_paints = device_paint_style_inventory(source_reader)
    for policy in contract["_noPrintAreas"]:
        source_descriptor = color_descriptor(
            policy["page"], output_names[policy["layer"]],
            policy["operator"].encode("latin1"), policy["operands"]
        )
        if source_descriptor not in expected_color_descriptors:
            raise SalesFolderSanitizationError("Reviewed no-print source color disappeared before conversion")
        same_source_color_remains_on_other_paths = any(
            paint["page"] == policy["page"]
            and paint["layer"] == policy["layer"]
            and paint["operator"].encode("latin1") in FILL_PAINT_OPERATORS
            and paint["fill"] == (policy["operator"], policy["operands"])
            and paint["pathSha256"] not in policy["pathSha256s"]
            for paint in source_device_paints
        )
        if not same_source_color_remains_on_other_paths:
            expected_color_descriptors.remove(source_descriptor)
        expected_color_descriptors.add(color_descriptor(
            policy["page"], output_names[policy["layer"]], b"rg", NO_PRINT_GRAY_RGB
        ))
    output_color_descriptors = reviewed_layer_color_descriptors(
        output_reader, set(output_names.values())
    )
    if output_color_descriptors != expected_color_descriptors:
        raise SalesFolderSanitizationError("Preserved geometry colors changed outside reviewed no-print replacements")

    expected_spot_usage = sorted(
        canonical_json({
            **item,
            "layer": output_names[item["layer"]],
            "colorant": SPOT_COLORANT_OUTPUT_NAMES.get(
                item["colorant"], item["colorant"]
            ),
        })
        for item in observed["sourceEvidence"]["spotPaintUsage"]
        if item["layer"] in preserved
    )
    output_spot_usage = sorted(canonical_json(item) for item in spot_paint_usage(output_reader))
    expected_output_colorants = sorted({
        SPOT_COLORANT_OUTPUT_NAMES.get(name, name)
        for name in observed["sourceEvidence"]["spotColorants"]
    })
    if all_source_colorants(output_reader) != expected_output_colorants:
        raise SalesFolderSanitizationError(
            "Output spot-color declarations differ from the exact reviewed Danish/Webprinter rename"
        )
    if output_spot_usage != expected_spot_usage:
        raise SalesFolderSanitizationError(
            "Source technical/finish spot-color paint usage changed"
        )
    if contract["spotFinish"]["required"]:
        required_colorants = {
            SPOT_COLORANT_OUTPUT_NAMES.get(name, name)
            for name in contract["spotFinish"]["requiredColorants"]
        }
        required_layers = {
            output_names[name] for name in contract["spotFinish"]["requiredLayerNames"]
        }
        output_required_paints = [
            json.loads(item) for item in output_spot_usage
            if json.loads(item)["colorant"] in required_colorants
            and json.loads(item)["layer"] in required_layers
        ]
        if len(output_required_paints) < contract["spotFinish"]["minimumPaintOperators"]:
            raise SalesFolderSanitizationError("Required spot-finish painted usage was not preserved")

    details = output_layer_details(output_reader)
    expected_names = set(output_names.values()) | {INFO_LAYER_NAME}
    if contract["_generatedNoPrintBackgrounds"]:
        expected_names.add(GENERATED_NO_PRINT_LAYER_NAME)
    if {item["name"] for item in details} != expected_names:
        raise SalesFolderSanitizationError("Output optional-content layer set is incomplete or unexpected")
    for item in details:
        if item["viewState"] != "/ON" or item["printState"] != "/OFF" or item["exportState"] != "/OFF":
            raise SalesFolderSanitizationError(f"Layer usage is not View ON / Print OFF / Export OFF: {item['name']}")

    text = normalized_extracted_text(output_reader)
    for pattern in FORBIDDEN_OUTPUT_TEXT:
        if re.search(pattern, text, flags=re.IGNORECASE):
            raise SalesFolderSanitizationError(f"Supplier/German text remains extractable: {pattern}")
    required_danish = (
        "WEBPRINTER TRYKSKABELON",
        "Beskæring og stans",
        "Falselinjer",
        "Sikkerhedsafstand",
        "ikke synlig / uden tryk",
    )
    for required in required_danish:
        if required not in text:
            raise SalesFolderSanitizationError(f"Danish information is incomplete: {required}")
    professional_upload_warning = contract["_professionalUploadWarningDa"]
    if professional_upload_warning is not None and professional_upload_warning not in text:
        raise SalesFolderSanitizationError(
            "The exact generic Danish professional-upload warning is missing from the output"
        )

    panel_styles = device_paint_style_inventory(output_reader)
    exact_blue_panels = [
        item for item in panel_styles
        if item["layer"] == INFO_LAYER_NAME
        and item["operator"] in {"B", "B*", "b", "b*"}
        and colors_match(item["fill"], "rg", WEBPRINTER_BLUE_RGB)
        and colors_match(item["stroke"], "RG", WEBPRINTER_BLUE_BORDER_RGB)
    ]
    if len(exact_blue_panels) != len(contract["_informationPanels"]):
        raise SalesFolderSanitizationError(
            "Information panel is not painted with exact Webprinter blue and border blue"
        )
    green_paints = [
        item for item in panel_styles
        if is_supplier_green_paint(item["fill"])
        or is_supplier_green_paint(item["stroke"])
    ]
    if green_paints:
        raise SalesFolderSanitizationError(
            f"Supplier-green paint remains in output layer {green_paints[0]['layer']}"
        )
    text_bounds = verify_information_text_containment(
        output, contract["_informationPanels"]
    )

    root = output_reader.trailer["/Root"]
    if (
        root.get("/Metadata")
        or output_reader.trailer.get("/Info") is not None
        or output_reader.metadata
    ):
        raise SalesFolderSanitizationError("Supplier metadata/XMP remains in output")
    for page in output_reader.pages:
        if page.get("/Thumb"):
            raise SalesFolderSanitizationError("Supplier page thumbnail remains in output")
    if any(
        event["kind"] == "xobject" and event["subtype"] == "/Image"
        for event in iter_source_events(output_reader)
    ):
        raise SalesFolderSanitizationError("Raster image XObject remains in output")
    unsafe_output_features = painting_feature_inventory(output_reader)
    if unsafe_output_features:
        raise SalesFolderSanitizationError(
            f"Unsafe painting feature remains in output: {unsafe_output_features[0]['type']}"
        )
    interactive_hits = forbidden_interactive_feature_inventory(output_reader)
    if interactive_hits:
        raise SalesFolderSanitizationError(
            f"Attachment, action, link, comment, or interactive object remains: {interactive_hits[0]}"
        )

    output_fill_objects = device_fill_paint_inventory(output_reader)
    gray_full_page = 0
    generated_no_print_validation = []
    for policy in contract["_noPrintAreas"]:
        gray_descriptor = color_descriptor(
            policy["page"], output_names[policy["layer"]], b"rg", NO_PRINT_GRAY_RGB
        )
        expected_output_path_geometry = sorted(
            item["pathGeometrySha256"]
            for item in observed["sourceEvidence"]["fillPaintObjects"]
            if item["pathSha256"] in policy["pathSha256s"]
        )
        matching_output_path_geometry = sorted(
            item["pathGeometrySha256"]
            for item in output_fill_objects
            if item["descriptor"] == gray_descriptor
            and item["pathGeometrySha256"] in expected_output_path_geometry
        )
        if matching_output_path_geometry != expected_output_path_geometry:
            raise SalesFolderSanitizationError(
                "Neutral-grey output does not match exact reviewed no-print path fingerprints"
            )
        if policy["fullPage"]:
            gray_full_page += policy["expectedPaintCount"]
    for policy in contract["_generatedNoPrintBackgrounds"]:
        x, y, width, height = policy["rectPt"]
        expected_geometry_sha = paint_path_geometry_sha256(
            policy["page"],
            [([x, y, width, height], b"re")],
        )
        gray_descriptor = color_descriptor(
            policy["page"],
            GENERATED_NO_PRINT_LAYER_NAME,
            b"rg",
            NO_PRINT_GRAY_RGB,
        )
        matching = [
            item for item in output_fill_objects
            if item["page"] == policy["page"]
            and item["layer"] == GENERATED_NO_PRINT_LAYER_NAME
            and item["descriptor"] == gray_descriptor
            and item["pathGeometrySha256"] == expected_geometry_sha
        ]
        if len(matching) != policy["expectedPaintCount"]:
            raise SalesFolderSanitizationError(
                "Generated no-print background is not the exact reviewed light-grey mediabox rectangle"
            )
        page_paints = [
            event for event in iter_source_events(output_reader)
            if event["kind"] == "paint" and event["page"] == policy["page"]
        ]
        generated_indexes = [
            index for index, event in enumerate(page_paints)
            if event["layer"] == GENERATED_NO_PRINT_LAYER_NAME
        ]
        structural_indexes = [
            index for index, event in enumerate(page_paints)
            if event["layer"] in {
                output_names.get("Rillen"), output_names.get("Schneiden")
            }
        ]
        if (
            len(generated_indexes) != policy["expectedPaintCount"]
            or not structural_indexes
            or max(generated_indexes) >= min(structural_indexes)
        ):
            raise SalesFolderSanitizationError(
                "Generated no-print background is not behind retained cut/fold geometry"
            )
        gray_full_page += policy["expectedPaintCount"]
        generated_no_print_validation.append({
            "page": policy["page"],
            "mediaBoxSha256": policy["mediaBoxSha256"],
            "paintCount": len(matching),
            "pathGeometrySha256": expected_geometry_sha,
            "behindRetainedCutFoldGeometry": True,
            "helperLayerViewOnPrintOffExportOff": True,
        })
    if contract["geometry"]["print"] == "4+0" and gray_full_page < 1:
        raise SalesFolderSanitizationError("4+0 output has no reviewed full-page neutral-grey no-print area")
    if contract["geometry"]["print"] == "4+4" and gray_full_page:
        raise SalesFolderSanitizationError("4+4 output incorrectly contains a full-page neutral-grey no-print area")

    raw_bytes = output.read_bytes()
    identity_hits = supplier_identity_hits(output_reader, raw_bytes)
    if identity_hits:
        raise SalesFolderSanitizationError(
            f"Supplier identity remains in raw or decoded PDF objects: {identity_hits}"
        )
    decoded_lower = decoded_pdf_bytes(output_reader).lower()
    decoded_vocabulary_hits = [
        pattern.decode("ascii")
        for pattern in FORBIDDEN_DECODED_OBJECT_PATTERNS
        if re.search(pattern, decoded_lower, flags=re.IGNORECASE)
    ]
    if decoded_vocabulary_hits:
        raise SalesFolderSanitizationError(
            f"German or supplier vocabulary remains in reachable PDF objects: {decoded_vocabulary_hits}"
        )
    leaked_source_layer_names = [
        name for name in observed["sourceEvidence"]["layerNames"]
        if name != output_names.get(name)
        and contains_exact_pdf_token(decoded_lower, name)
    ]
    if leaked_source_layer_names:
        raise SalesFolderSanitizationError(
            f"German or removed source OCG names remain embedded: {leaked_source_layer_names}"
        )
    finish_workflow = (
        "reviewed_source_finish_mask_present"
        if contract["spotFinish"]["required"]
        else (
            "professional_upload_only_no_source_finish_mask"
            if contract["finishKey"] in SPOT_FINISHES
            else "not_applicable"
        )
    )
    return {
        "pageCount": len(output_reader.pages),
        "pageBoxesPreserved": True,
        "geometryFingerprintsPreserved": {
            name: source_geometry.get(name) for name in sorted(preserved)
        },
        "preservedGeometryColorDescriptorsSha256": sha256_json(sorted(output_color_descriptors)),
        "spotFinishPaintUsagePreserved": (
            True if contract["spotFinish"]["required"] else None
        ),
        "sourceSpotPaintUsagePreserved": True,
        "spotColorantOutputNames": {
            name: SPOT_COLORANT_OUTPUT_NAMES.get(name, name)
            for name in observed["sourceEvidence"]["spotColorants"]
        },
        "spotPaintGeometryAndSemanticsPreserved": True,
        "sourceFinishMaskPresent": bool(contract["spotFinish"]["required"]),
        "finishWorkflow": finish_workflow,
        "onlineDesignerEligibleForFinish": (
            False
            if contract["finishKey"] in SPOT_FINISHES
            and not contract["spotFinish"]["required"]
            else None
        ),
        "professionalUploadWarningDa": professional_upload_warning,
        "professionalUploadWarningVerified": professional_upload_warning is not None,
        "layers": details,
        "fullPageNeutralGrayPaints": gray_full_page,
        "generatedNoPrintBackgrounds": generated_no_print_validation,
        "verifiedBeschnittGuideDonor": donor_output_validation,
        "supplierTextAndBrandingRemoved": True,
        "metadataXmpThumbnailsAttachmentsActionsLinksAndCommentsRemoved": True,
        "danishInformationContained": True,
        "informationTextBounds": text_bounds,
        "webprinterBlue": WEBPRINTER_BLUE,
        "webprinterBlueBorder": WEBPRINTER_BLUE_BORDER,
        "webprinterBluePanelPaintVerified": True,
        "supplierGreenPaintAbsent": True,
        "noPrintGray": NO_PRINT_GRAY,
    }


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(temporary, path)


def stage_bytes(directory: Path, suffix: str, value: bytes) -> Path:
    descriptor, name = tempfile.mkstemp(suffix=suffix, dir=directory)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(value)
    return Path(name)


def run_sanitize(
    source: Path,
    output: Path,
    inspection: Path,
    contract_path: Path,
    geometry_audit_path: Path,
    geometry_supplement_path: Path | None = None,
    template_resolution_plan_path: Path | None = None,
    *,
    validation_cache: BatchValidationCache | None = None,
) -> dict[str, Any]:
    for path_value, label in (
        (source, "Source PDF"),
        (contract_path, "Contract"),
        (geometry_audit_path, "Geometry audit"),
    ):
        if path_value.is_symlink() or not path_value.is_file():
            raise SalesFolderSanitizationError(f"{label} must be a regular non-symlink file")
    if geometry_supplement_path is not None and (
        geometry_supplement_path.is_symlink() or not geometry_supplement_path.is_file()
    ):
        raise SalesFolderSanitizationError(
            "Geometry supplement must be a regular non-symlink file"
        )
    if template_resolution_plan_path is not None and (
        template_resolution_plan_path.is_symlink()
        or not template_resolution_plan_path.is_file()
    ):
        raise SalesFolderSanitizationError(
            "Template-resolution plan must be a regular non-symlink file"
        )
    resolved_paths = {
        "source": source.resolve(),
        "contract": contract_path.resolve(),
        "geometryAudit": geometry_audit_path.resolve(),
        "output": output.resolve(),
        "inspection": inspection.resolve(),
    }
    if geometry_supplement_path is not None:
        resolved_paths["geometrySupplement"] = geometry_supplement_path.resolve()
    if template_resolution_plan_path is not None:
        resolved_paths["templateResolutionPlan"] = template_resolution_plan_path.resolve()
    if len(set(resolved_paths.values())) != len(resolved_paths):
        raise SalesFolderSanitizationError("Source, contract, audit, PDF, and inspection paths must be pairwise distinct")
    output.parent.mkdir(parents=True, exist_ok=True)
    inspection.parent.mkdir(parents=True, exist_ok=True)
    contract_bytes = read_regular_bytes(contract_path, "Contract")
    source_bytes = read_regular_bytes(source, "Source PDF")
    contract_sha256 = sha256_bytes(contract_bytes)
    contract = json.loads(contract_bytes.decode("utf-8"))
    source_sha256 = sha256_bytes(source_bytes)
    staged_inputs: list[Path] = []
    try:
        staged_source = stage_bytes(output.parent, ".source.pdf", source_bytes)
        staged_inputs.append(staged_source)
    except Exception:
        for staged in staged_inputs:
            staged.unlink(missing_ok=True)
        raise
    try:
        contract, observed, geometry_audit = validate_contract(
            contract,
            staged_source,
            geometry_audit_path,
            geometry_supplement_path,
            template_resolution_plan_path,
            validation_cache=validation_cache,
        )
    except Exception:
        for staged in staged_inputs:
            staged.unlink(missing_ok=True)
        raise
    if observed["sourceEvidence"]["sha256"] != source_sha256:
        for staged in staged_inputs:
            staged.unlink(missing_ok=True)
        raise SalesFolderSanitizationError("Staged source SHA-256 differs from original source bytes")
    donor_original_path: Path | None = None
    donor_policy = contract["_verifiedBeschnittGuideDonor"]
    if donor_policy:
        donor_original_path = donor_policy["donorPath"]
        donor_bytes = read_regular_bytes(
            donor_original_path, "Verified Beschnitt donor PDF"
        )
        if (
            sha256_bytes(donor_bytes) != donor_policy["donorSha256"]
            or len(donor_bytes) != donor_policy["donorBytes"]
        ):
            for staged in staged_inputs:
                staged.unlink(missing_ok=True)
            raise SalesFolderSanitizationError(
                "Verified Beschnitt donor changed before staging"
            )
        try:
            staged_donor = stage_bytes(output.parent, ".donor.pdf", donor_bytes)
        except Exception:
            for staged in staged_inputs:
                staged.unlink(missing_ok=True)
            raise
        staged_inputs.append(staged_donor)
        donor_policy["donorPath"] = staged_donor
        if donor_original_path.resolve() in set(resolved_paths.values()):
            for staged in staged_inputs:
                staged.unlink(missing_ok=True)
            raise SalesFolderSanitizationError(
                "Verified Beschnitt donor path must be distinct from all sanitization inputs and outputs"
            )
    reserved_output = False
    reserved_inspection = False
    completed = False
    try:
        reserve_flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        output_fd = os.open(output, reserve_flags, 0o600)
        reserved_output = True
        os.close(output_fd)
        inspection_fd = os.open(inspection, reserve_flags, 0o600)
        reserved_inspection = True
        os.close(inspection_fd)
    except OSError as exc:
        if reserved_output:
            output.unlink(missing_ok=True)
        if reserved_inspection:
            inspection.unlink(missing_ok=True)
        for staged in staged_inputs:
            staged.unlink(missing_ok=True)
        if isinstance(exc, FileExistsError):
            raise SalesFolderSanitizationError(
                "Refusing to overwrite an existing sanitized PDF or inspection"
            ) from exc
        raise SalesFolderSanitizationError(
            f"Cannot reserve sanitized PDF and inspection outputs: {exc}"
        ) from exc
    temporary_fd, temporary_name = tempfile.mkstemp(suffix=".pdf", dir=output.parent)
    os.close(temporary_fd)
    temporary = Path(temporary_name)
    try:
        build = build_output(staged_source, temporary, contract)
        validation = validate_output(staged_source, temporary, contract, observed)
        source_sha = observed["sourceEvidence"]["sha256"]
        inspection_payload = {
            "schemaVersion": SCHEMA_VERSION,
            "state": "sanitized_render_review_required",
            "eligibleForTemplateImport": False,
            "eligibleForImport": False,
            "geometry": contract["geometry"],
            "finishKey": contract["finishKey"],
            "review": contract["review"],
            "contractSha256": contract_sha256,
            "geometryAuditSha256": geometry_audit["reportSha256"],
            "geometryAuditBindingKey": geometry_audit["binding"]["bindingKey"],
            "geometrySupplementSha256": (
                geometry_audit["supplement"]["reportSha256"]
                if geometry_audit["supplement"] else None
            ),
            "geometrySupplementEntrySha256": (
                geometry_audit["supplement"]["entrySha256"]
                if geometry_audit["supplement"] else None
            ),
            "templateResolutionPlanSha256": (
                geometry_audit["resolutionPlan"]["reportSha256"]
                if geometry_audit["resolutionPlan"] else None
            ),
            "templateResolutionPlanEntrySha256": (
                geometry_audit["resolutionPlan"]["entrySha256"]
                if geometry_audit["resolutionPlan"] else None
            ),
            "templateResolutionPlanVerdict": (
                geometry_audit["resolutionPlan"]["verdict"]
                if geometry_audit["resolutionPlan"] else None
            ),
            "templateResolutionPlanResolvedBindingKey": (
                geometry_audit["resolutionPlan"]["resolvedBindingKey"]
                if geometry_audit["resolutionPlan"] else None
            ),
            "sourceSha256": source_sha,
            "outputSha256": sha256_file(temporary),
            "conversionCounts": build["conversionCounts"],
            "conversionPathSha256s": build["conversionPathSha256s"],
            "verifiedBeschnittGuideDonor": build[
                "verifiedBeschnittGuideDonor"
            ],
            "validation": validation,
            "fullPageRasterization": False,
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
        if sha256_bytes(read_regular_bytes(source, "Source PDF")) != source_sha:
            raise SalesFolderSanitizationError("Source PDF changed during sanitization")
        if sha256_bytes(read_regular_bytes(contract_path, "Contract")) != contract_sha256:
            raise SalesFolderSanitizationError("Reviewed contract changed during sanitization")
        if sha256_bytes(read_regular_bytes(geometry_audit_path, "Geometry audit")) != geometry_audit["reportSha256"]:
            raise SalesFolderSanitizationError("Geometry-audit report changed during sanitization")
        if geometry_audit["supplement"]:
            if (
                geometry_supplement_path is None
                or sha256_bytes(read_regular_bytes(
                    geometry_supplement_path, "Geometry supplement"
                ))
                != geometry_audit["supplement"]["reportSha256"]
            ):
                raise SalesFolderSanitizationError(
                    "Geometry-supplement report changed during sanitization"
                )
        if geometry_audit["resolutionPlan"]:
            if (
                template_resolution_plan_path is None
                or sha256_bytes(read_regular_bytes(
                    template_resolution_plan_path, "Template-resolution plan"
                )) != geometry_audit["resolutionPlan"]["reportSha256"]
            ):
                raise SalesFolderSanitizationError(
                    "Template-resolution plan changed during sanitization"
                )
        if donor_policy:
            if donor_original_path is None:  # pragma: no cover - defensive narrowing
                raise SalesFolderSanitizationError(
                    "Verified Beschnitt donor original path is missing"
                )
            if (
                sha256_bytes(read_regular_bytes(
                    donor_original_path, "Verified Beschnitt donor PDF"
                )) != donor_policy["donorSha256"]
                or sha256_bytes(read_regular_bytes(
                    donor_policy["reportPath"], "Verified Beschnitt donor report"
                )) != donor_policy["reportSha256"]
            ):
                raise SalesFolderSanitizationError(
                    "Verified Beschnitt donor PDF or approval report changed during sanitization"
                )
        os.replace(temporary, output)
        try:
            atomic_write_json(inspection, inspection_payload)
        except Exception:
            output.unlink(missing_ok=True)
            raise
        completed = True
        return inspection_payload
    finally:
        temporary.unlink(missing_ok=True)
        for staged in staged_inputs:
            staged.unlink(missing_ok=True)
        if not completed:
            if reserved_output:
                output.unlink(missing_ok=True)
            if reserved_inspection:
                inspection.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    describe = subparsers.add_parser("describe", help="Create a read-only contract candidate")
    describe.add_argument("--source", required=True)
    describe.add_argument("--contract-candidate", required=True)
    describe.add_argument("--format", required=True)
    describe.add_argument("--construction", required=True)
    describe.add_argument("--print", dest="print_mode", required=True)
    describe.add_argument("--spine", type=int, required=True)
    describe.add_argument("--finish", required=True)
    sanitize = subparsers.add_parser("sanitize", help="Sanitize one explicitly reviewed source")
    sanitize.add_argument("--source", required=True)
    sanitize.add_argument("--contract", required=True)
    sanitize.add_argument("--geometry-audit", required=True)
    sanitize.add_argument("--geometry-supplement")
    sanitize.add_argument("--template-resolution-plan")
    sanitize.add_argument("--output", required=True)
    sanitize.add_argument("--inspection", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        source = Path(args.source).absolute()
        if args.command == "describe":
            if source.is_symlink() or not source.is_file():
                raise SalesFolderSanitizationError("Source must be a regular non-symlink PDF")
            geometry = validate_geometry({
                "format": args.format,
                "construction": args.construction,
                "print": args.print_mode,
                "spineMm": args.spine,
            })
            candidate_path = Path(args.contract_candidate).absolute()
            if candidate_path.exists():
                raise SalesFolderSanitizationError("Refusing to overwrite an existing contract candidate")
            atomic_write_json(candidate_path, describe_source(source, geometry, args.finish))
            print(candidate_path)
            return 0
        payload = run_sanitize(
            source,
            Path(args.output).absolute(),
            Path(args.inspection).absolute(),
            Path(args.contract).absolute(),
            Path(args.geometry_audit).absolute(),
            Path(args.geometry_supplement).absolute() if args.geometry_supplement else None,
            Path(args.template_resolution_plan).absolute()
            if args.template_resolution_plan else None,
        )
        print(json.dumps({
            "state": payload["state"],
            "outputSha256": payload["outputSha256"],
            "eligibleForImport": False,
        }, ensure_ascii=False))
        return 0
    except (SalesFolderSanitizationError, ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"REFUSED: unexpected sanitizer failure: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
