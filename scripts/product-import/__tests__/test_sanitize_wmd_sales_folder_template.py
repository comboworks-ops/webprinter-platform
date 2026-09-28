#!/usr/bin/env python3
"""Contract and output tests for the isolated sales-folder PDF sanitizer."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    RectangleObject,
    TextStringObject,
)


ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts/product-templates/sanitize_wmd_sales_folder_template.py"
SPEC = importlib.util.spec_from_file_location("sales_folder_sanitizer", MODULE_PATH)
assert SPEC and SPEC.loader
sanitizer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sanitizer)


LAYER_ROLES = {
    "Beschnitt Seite": ("preserve", "bleed-and-safety"),
    "Rillen": ("preserve", "fold"),
    "Schneiden": ("preserve", "cut"),
    "Visitenkartentasche": ("preserve", "accessory"),
    "Info Seite": ("remove", "supplier-information"),
    "Logo": ("remove", "supplier-branding"),
}
OUTPUT_NAMES_DA = {
    name: sanitizer.KNOWN_DANISH_LAYER_NAMES[name]
    for name, (action, _role) in LAYER_ROLES.items()
    if action == "preserve"
}


def ocg(name: str) -> DictionaryObject:
    return DictionaryObject({
        NameObject("/Type"): NameObject("/OCG"),
        NameObject("/Name"): TextStringObject(name),
    })


def build_fixture(
    path: Path,
    print_mode: str = "4+0",
    *,
    safety_path: bool = True,
    spot_color: bool = False,
    paint_spot: bool = True,
    technical_cut_spot: bool = False,
    include_cd_layer: bool = False,
    include_magnetpunkte_layer: bool = False,
    interactive_supplier_payloads: bool = True,
    source_no_print_fill: bool = True,
    hidden_german_resource: bool = False,
    cut_outer_contour: bool = False,
    beschnitt_outer_contour: bool = False,
    repeated_positioned_cut_shape: bool = False,
    preserved_text_only_fill_color: bool = False,
    preserved_text_stroke_used_after_text: bool = False,
    removed_cd_stroke_state_used_after_layer: bool = False,
    removed_cd_ext_gstate_used_after_layer: bool = False,
    removed_cd_partial_ext_gstates_used_after_layer: bool = False,
    removed_cd_cross_boundary_q: bool = False,
    removed_cd_q_restore_then_stroke_state: bool = False,
    removed_cd_same_spot_different_tint: bool = False,
    beschnitt_ext_gstate: bool = False,
    malformed_graphics_state: str | None = None,
    regular_form_after_no_print: bool = False,
) -> None:
    if removed_cd_same_spot_different_tint and not technical_cut_spot:
        raise ValueError(
            "The same-spot/different-tint fixture requires technical_cut_spot"
        )
    if malformed_graphics_state not in (None, "Q-underflow", "leftover-q"):
        raise ValueError("Unknown malformed graphics-state fixture mode")
    writer = PdfWriter()
    layer_names = list(LAYER_ROLES)
    if include_cd_layer:
        layer_names.append("CD-Tasche")
    if include_magnetpunkte_layer:
        layer_names.append("Magnetpunkte")
    if spot_color:
        layer_names.append("Efterbehandling")
    refs = {name: writer._add_object(ocg(name)) for name in layer_names}
    font = writer._add_object(DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    }))
    image = DecodedStreamObject()
    image[NameObject("/Type")] = NameObject("/XObject")
    image[NameObject("/Subtype")] = NameObject("/Image")
    image[NameObject("/Width")] = NumberObject(1)
    image[NameObject("/Height")] = NumberObject(1)
    image[NameObject("/ColorSpace")] = NameObject("/DeviceRGB")
    image[NameObject("/BitsPerComponent")] = NumberObject(8)
    image.set_data(b"\x00\xff\x00")
    image_ref = writer._add_object(image)

    for page_number in (1, 2):
        page = writer.add_blank_page(width=600, height=800)
        page.cropbox = RectangleObject([0, 0, 600, 800])
        page.bleedbox = RectangleObject([0, 0, 600, 800])
        page.trimbox = RectangleObject([8, 8, 592, 792])
        page.artbox = RectangleObject([12, 12, 588, 788])
        properties = DictionaryObject({
            NameObject(f"/MC{index}"): refs[name]
            for index, name in enumerate(layer_names)
        })
        xobjects = DictionaryObject({NameObject("/LogoImage"): image_ref})
        color_spaces = DictionaryObject()
        if spot_color or technical_cut_spot:
            tint = writer._add_object(DictionaryObject({
                NameObject("/FunctionType"): NumberObject(2),
                NameObject("/Domain"): ArrayObject([NumberObject(0), NumberObject(1)]),
                NameObject("/C0"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0), NumberObject(0)]),
                NameObject("/C1"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0), NumberObject(1)]),
                NameObject("/N"): NumberObject(1),
            }))
            if spot_color:
                color_spaces[NameObject("/SpotUV")] = ArrayObject([
                    NameObject("/Separation"), NameObject("/lack"), NameObject("/DeviceCMYK"), tint,
                ])
            if technical_cut_spot:
                color_spaces[NameObject("/CutSpot")] = ArrayObject([
                    NameObject("/Separation"), NameObject("/stanzen"), NameObject("/DeviceCMYK"), tint,
                ])
        if print_mode == "4+0" and page_number == 2 and source_no_print_fill:
            no_print_form = DecodedStreamObject()
            no_print_form[NameObject("/Type")] = NameObject("/XObject")
            no_print_form[NameObject("/Subtype")] = NameObject("/Form")
            no_print_form[NameObject("/BBox")] = RectangleObject([0, 0, 600, 800])
            no_print_form[NameObject("/Resources")] = DictionaryObject()
            no_print_form.set_data(b"0 1 1 0 k 0 0 600 800 re f\n")
            xobjects[NameObject("/NoPrintForm")] = writer._add_object(no_print_form)
            if regular_form_after_no_print:
                regular_form = DecodedStreamObject()
                regular_form[NameObject("/Type")] = NameObject("/XObject")
                regular_form[NameObject("/Subtype")] = NameObject("/Form")
                regular_form[NameObject("/BBox")] = RectangleObject([0, 0, 60, 60])
                regular_form[NameObject("/Resources")] = DictionaryObject()
                regular_form.set_data(b"0 0 60 60 re f\n")
                xobjects[NameObject("/RegularInheritedForm")] = writer._add_object(
                    regular_form
                )
        resources = DictionaryObject({
            NameObject("/Properties"): properties,
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
            NameObject("/XObject"): xobjects,
            NameObject("/ColorSpace"): color_spaces,
        })
        if (
            removed_cd_ext_gstate_used_after_layer
            or removed_cd_partial_ext_gstates_used_after_layer
            or beschnitt_ext_gstate
        ):
            ext_gstates = DictionaryObject()
            if removed_cd_ext_gstate_used_after_layer:
                ext_gstates.update({
                    NameObject("/GSOverprintOn"): DictionaryObject({
                        NameObject("/Type"): NameObject("/ExtGState"),
                        NameObject("/AIS"): BooleanObject(False),
                        NameObject("/BM"): NameObject("/Normal"),
                        NameObject("/CA"): NumberObject(1),
                        NameObject("/OP"): BooleanObject(True),
                        NameObject("/OPM"): NumberObject(1),
                        NameObject("/SA"): BooleanObject(True),
                        NameObject("/SMask"): NameObject("/None"),
                        NameObject("/ca"): NumberObject(1),
                        NameObject("/op"): BooleanObject(True),
                    }),
                    NameObject("/GSOverprintOff"): DictionaryObject({
                        NameObject("/Type"): NameObject("/ExtGState"),
                        NameObject("/AIS"): BooleanObject(False),
                        NameObject("/BM"): NameObject("/Normal"),
                        NameObject("/CA"): NumberObject(1),
                        NameObject("/OP"): BooleanObject(False),
                        NameObject("/OPM"): NumberObject(1),
                        NameObject("/SA"): BooleanObject(True),
                        NameObject("/SMask"): NameObject("/None"),
                        NameObject("/ca"): NumberObject(1),
                        NameObject("/op"): BooleanObject(False),
                    }),
                })
            if removed_cd_partial_ext_gstates_used_after_layer:
                ext_gstates.update({
                    NameObject("/GSWidth"): DictionaryObject({
                        NameObject("/Type"): NameObject("/ExtGState"),
                        NameObject("/LW"): NumberObject(5),
                    }),
                    NameObject("/GSAlpha"): DictionaryObject({
                        NameObject("/Type"): NameObject("/ExtGState"),
                        NameObject("/ca"): FloatObject(0.5),
                    }),
                })
            if beschnitt_ext_gstate:
                ext_gstates[NameObject("/GSBeschnitt")] = DictionaryObject({
                    NameObject("/Type"): NameObject("/ExtGState"),
                    NameObject("/AIS"): BooleanObject(False),
                    NameObject("/BM"): NameObject("/Normal"),
                    NameObject("/CA"): NumberObject(1),
                    NameObject("/OP"): BooleanObject(False),
                    NameObject("/OPM"): NumberObject(1),
                    NameObject("/SA"): BooleanObject(True),
                    NameObject("/SMask"): NameObject("/None"),
                    NameObject("/ca"): NumberObject(1),
                    NameObject("/op"): BooleanObject(False),
                })
            resources[NameObject("/ExtGState")] = ext_gstates
        if hidden_german_resource:
            resources[NameObject("/TITELSEITE")] = TextStringObject(
                "Hinweise zur Druckdatenerstellung und Zusatzoptionen"
            )
        page[NameObject("/Resources")] = resources
        page[NameObject("/Thumb")] = image_ref
        commands = []
        if safety_path:
            beschnitt_paths = "0.1843 0.502 0.9294 RG 20 20 560 760 re S"
            if beschnitt_outer_contour:
                beschnitt_paths += " 0 0 0 0.8 K 0 0 600 800 re S"
            if beschnitt_ext_gstate:
                beschnitt_paths = f"q /GSBeschnitt gs {beschnitt_paths} Q"
            commands.append(f"/OC /MC0 BDC {beschnitt_paths} EMC")
        else:
            beschnitt_paths = (
                "0 0 0 0.8 K 0 0 600 800 re S"
                if beschnitt_outer_contour else ""
            )
            commands.append(f"/OC /MC0 BDC {beschnitt_paths} EMC")
        cut_paths = "0 1 0 0 K 30 30 540 740 re S"
        if repeated_positioned_cut_shape:
            cut_paths += (
                " q 1 0 0 1 100 100 cm 0 0 m 3 0 l S Q"
                " q 1 0 0 1 100 700 cm 0 0 m 3 0 l S Q"
            )
        if cut_outer_contour:
            cut_paths += " 0 0 0 0.8 K 0 0 600 800 re S"
        if preserved_text_stroke_used_after_text:
            preserved_text = (
                " BT 0 1 0 0 K /F1 8 Tf 100 100 Td "
                "(Lieferantentext) Tj ET 200 220 m 400 220 l S"
            )
        elif preserved_text_only_fill_color:
            preserved_text = (
                " BT 0 0.98 0 0 k /F1 8 Tf 100 100 Td "
                "(Lieferantentext) Tj ET"
            )
        else:
            preserved_text = ""
        commands.extend([
            "/OC /MC1 BDC 1 0 0 0 K 50 400 m 550 400 l S EMC",
            (
                f"/OC /MC2 BDC {cut_paths} "
                "/CutSpot CS 1 SCN 35 35 530 730 re S EMC"
                if technical_cut_spot
                else f"/OC /MC2 BDC {cut_paths} EMC"
            ),
            "/OC /MC3 BDC 0 0 0 1 K 90 90 110 65 re S "
            f"0 0 0 1 k 105 170 20 20 re f{preserved_text} EMC",
        ])
        if print_mode == "4+0" and page_number == 2 and source_no_print_fill:
            if regular_form_after_no_print:
                commands.append(
                    "/OC /MC0 BDC 0 1 1 0 k 0 0 600 800 re f "
                    "/RegularInheritedForm Do EMC"
                )
            else:
                commands.append("/OC /MC0 BDC /NoPrintForm Do EMC")
        whole_page_note = (
            " Dieser Bereich ist nicht bedruckbar. Hier werden die Zusatzoptionen eingeblendet."
            if print_mode == "4+0"
            else ""
        )
        commands.extend([
            "/OC /MC4 BDC 0.33 0.03 0.75 0 k 25 650 250 100 re f "
            "BT /F1 12 Tf 40 700 Td (Datenformat, 5 mm Beschnitt, Sicherheitsabstand: 3 mm. "
            "Sonderfarbe lack. Ueberdrucken. Mindestgroesse 2 mm. Abstand zu Falzlinien 3 mm."
            + whole_page_note + ") Tj ET EMC",
            "/OC /MC5 BDC BT /F1 14 Tf 420 720 Td (WIRmachenDRUCK) Tj ET "
            "q 20 0 0 20 430 670 cm /LogoImage Do Q EMC",
        ])
        if include_cd_layer:
            cd_index = layer_names.index("CD-Tasche")
            if removed_cd_ext_gstate_used_after_layer:
                commands.append(
                    "/OC /MC3 BDC /GSOverprintOn gs "
                    "180 250 m 190 250 l S EMC"
                )
            if removed_cd_same_spot_different_tint:
                commands.append(
                    "/OC /MC3 BDC /CutSpot CS 0.25 SCN "
                    "180 250 m 190 250 l S EMC"
                )
            if removed_cd_same_spot_different_tint:
                cd_stroke = "/CutSpot CS 0.75 SCN"
            elif removed_cd_stroke_state_used_after_layer:
                cd_stroke = "0 1 0 0 K"
            else:
                cd_stroke = "0 0 0 1 K"
            scoped_distractor = (
                "q 1 0 0 0 K 145 215 150 80 re S Q "
                if removed_cd_stroke_state_used_after_layer else ""
            )
            ext_gstate = (
                "/GSOverprintOff gs "
                if removed_cd_ext_gstate_used_after_layer else ""
            )
            if removed_cd_partial_ext_gstates_used_after_layer:
                ext_gstate += "/GSWidth gs /GSAlpha gs "
            commands.append(
                f"/OC /MC{cd_index} BDC {scoped_distractor}{ext_gstate}{cd_stroke} "
                "140 210 160 90 re S "
                "0.1 0.1 0.1 rg 150 220 40 30 re f EMC"
            )
            if removed_cd_q_restore_then_stroke_state:
                commands.append(
                    f"q /OC /MC{cd_index} BDC Q 0 1 0 0 K "
                    "310 210 30 20 re S EMC"
                )
            if (
                removed_cd_stroke_state_used_after_layer
                or removed_cd_ext_gstate_used_after_layer
                or removed_cd_partial_ext_gstates_used_after_layer
                or removed_cd_q_restore_then_stroke_state
                or removed_cd_same_spot_different_tint
            ):
                commands.append(
                    "/OC /MC3 BDC 200 260 m 400 260 l S EMC"
                )
            if removed_cd_cross_boundary_q:
                if page_number == 1:
                    commands.append(
                        f"q /OC /MC{cd_index} BDC 0 1 0 0 K "
                        "310 210 30 20 re S Q EMC"
                    )
                else:
                    commands.append(
                        f"/OC /MC{cd_index} BDC q 0 1 0 0 K "
                        "310 210 30 20 re S EMC Q"
                    )
        if malformed_graphics_state == "Q-underflow":
            commands.append("Q")
        elif malformed_graphics_state == "leftover-q":
            commands.append("q")
        if include_magnetpunkte_layer:
            magnet_index = layer_names.index("Magnetpunkte")
            commands.append(
                f"/OC /MC{magnet_index} BDC 0 1 0 0 K "
                "240 300 30 30 re S EMC"
            )
        if spot_color:
            spot_paint = "/SpotUV cs 1 scn 120 120 80 80 re f" if paint_spot else ""
            finish_index = layer_names.index("Efterbehandling")
            commands.append(f"/OC /MC{finish_index} BDC {spot_paint} EMC")
        stream = DecodedStreamObject()
        stream.set_data(("\n".join(commands) + "\n").encode("ascii"))
        page[NameObject("/Contents")] = stream

    groups = ArrayObject(list(refs.values()))
    writer._root_object[NameObject("/OCProperties")] = DictionaryObject({
        NameObject("/OCGs"): groups,
        NameObject("/D"): DictionaryObject({NameObject("/Order"): groups}),
    })
    xmp = DecodedStreamObject()
    xmp[NameObject("/Type")] = NameObject("/Metadata")
    xmp[NameObject("/Subtype")] = NameObject("/XML")
    xmp.set_data(b"<xmp>WIRmachenDRUCK Adobe Illustrator</xmp>")
    writer._root_object[NameObject("/Metadata")] = writer._add_object(xmp)
    writer.add_metadata({"/Title": "WIRmachenDRUCK Vorlage", "/Creator": "Adobe Illustrator"})
    if interactive_supplier_payloads:
        writer.add_attachment(
            "supplier-notes.txt",
            b"WIRmachenDRUCK attachment that must never survive",
        )
        writer._root_object[NameObject("/OpenAction")] = DictionaryObject({
            NameObject("/S"): NameObject("/URI"),
            NameObject("/URI"): TextStringObject("https://www.wir-machen-druck.de/"),
        })
        writer._root_object[NameObject("/AA")] = DictionaryObject({
            NameObject("/WC"): DictionaryObject({
                NameObject("/S"): NameObject("/JavaScript"),
                NameObject("/JS"): TextStringObject("app.alert('WIRmachenDRUCK')"),
            }),
        })
        writer.pages[0][NameObject("/Annots")] = ArrayObject([
            writer._add_object(DictionaryObject({
                NameObject("/Type"): NameObject("/Annot"),
                NameObject("/Subtype"): NameObject("/Text"),
                NameObject("/Rect"): RectangleObject([10, 10, 40, 40]),
                NameObject("/Contents"): TextStringObject("WIRmachenDRUCK comment"),
            }))
        ])
    with path.open("wb") as handle:
        writer.write(handle)


def approved_contract(
    source: Path,
    print_mode: str = "4+0",
    finish_key: str = "none",
) -> dict:
    geometry = {
        "format": "a4",
        "construction": "2-part-2-flaps",
        "print": print_mode,
        "spineMm": 1,
    }
    contract = sanitizer.describe_source(source, geometry, finish_key)
    contract["reviewState"] = "approved_for_sanitization"
    contract["review"] = {
        "reviewer": "Automated fixture reviewer",
        "reviewedAt": "2026-08-31T12:00:00Z",
        "note": "Fixture contract",
    }
    contract["verifiedBeschnittGuideDonor"] = None
    contract["layers"] = []
    for name in contract["sourceEvidence"]["layerNames"]:
        if name == "CD-Tasche":
            contract["layers"].append({
                "name": name,
                "action": "remove",
                "role": "unused-accessory",
                "outputNameDa": None,
            })
            continue
        action, role = LAYER_ROLES.get(
            name,
            (
                "preserve",
                "accessory" if name == "Magnetpunkte" else "finish",
            ),
        )
        contract["layers"].append({
            "name": name,
            "action": action,
            "role": role,
            "outputNameDa": (
                sanitizer.KNOWN_DANISH_LAYER_NAMES.get(name, name)
                if action == "preserve"
                else None
            ),
        })
    contract["sourceText"] = {
        "sha256": contract["sourceEvidence"]["textSha256"],
        "requiredPatterns": [r"WIRmachenDRUCK", r"Datenformat", r"Sicherheitsabstand"],
    }
    if print_mode == "4+0":
        no_print_paths = [
            item["pathSha256"]
            for item in contract["sourceEvidence"]["fillPaintObjects"]
            if item["page"] == 2
            and item["layer"] == "Beschnitt Seite"
            and item["operator"] == "k"
            and item["operands"] == [0.0, 1.0, 1.0, 0.0]
        ]
        if no_print_paths:
            contract["colors"]["noPrintAreas"] = [{
                "page": 2,
                "layer": "Beschnitt Seite",
                "operator": "k",
                "operands": [0, 1, 1, 0],
                "pathSha256s": no_print_paths,
                "expectedPaintCount": 1,
                "fullPage": True,
                "replacementHex": "#D1D5DB",
            }]
        else:
            media = contract["sourceEvidence"]["pageBoxes"][1]["mediabox"]
            contract["colors"]["generatedNoPrintBackgrounds"] = [{
                "page": 2,
                "rectPt": [
                    media[0], media[1], media[2] - media[0], media[3] - media[1],
                ],
                "mediaBoxSha256": sanitizer.sha256_json(media),
                "sourcePattern": sanitizer.GENERATED_NO_PRINT_SOURCE_PATTERN,
                "replacementHex": sanitizer.NO_PRINT_GRAY,
                "expectedPaintCount": 1,
                "outputLayerNameDa": sanitizer.GENERATED_NO_PRINT_LAYER_NAME,
            }]
    contract["informationPanels"] = [{"page": 1, "rectPt": [300, 35, 270, 140]}]
    if (
        finish_key in sanitizer.SPOT_FINISHES
        and "Efterbehandling" in contract["sourceEvidence"]["layerNames"]
        and "lack" in contract["sourceEvidence"]["spotColorants"]
    ):
        contract["spotFinish"] = {
            "required": True,
            "allowedColorants": contract["sourceEvidence"]["spotColorants"],
            "requiredColorants": ["lack"],
            "requiredLayerNames": ["Efterbehandling"],
            "minimumPaintOperators": 1,
        }
    if finish_key in sanitizer.SPOT_FINISHES:
        if contract["spotFinish"]["required"]:
            contract["finishInstructions"] = [
                {"category": "spot-color", "danish": "Brug den aftalte staffagefarve lack.", "sourcePattern": r"Sonderfarbe\s+lack"},
                {"category": "overprint", "danish": "Staffagefarven skal følge leverandørens overprint-regel.", "sourcePattern": r"Ueberdrucken"},
                {"category": "minimum-size", "danish": "Mindste elementstørrelse er 2 mm.", "sourcePattern": r"Mindestgroesse\s+2\s*mm"},
                {"category": "clearance", "danish": "Hold 3 mm afstand til falselinjer.", "sourcePattern": r"Abstand\s+zu\s+Falzlinien\s+3\s*mm"},
            ]
            contract["professionalUploadWarningDa"] = None
        else:
            contract["finishInstructions"] = []
            contract["professionalUploadWarningDa"] = (
                sanitizer.PROFESSIONAL_UPLOAD_WARNING_DA
            )
        contract["informationPanels"] = [{"page": 1, "rectPt": [240, 25, 340, 250]}]
    return contract


def write_geometry_audit(
    source: Path,
    contract: dict,
    path: Path,
    *,
    verified: bool = True,
    blocker_codes: list[str] | None = None,
) -> None:
    binding_key = "https://www.wir-machen-druck.de/fixture.html|fixture-material"
    geometry = contract["geometry"]
    blockers = [] if verified else [
        {"code": code, "message": f"Fixture blocker: {code}"}
        for code in (blocker_codes or ["FIXTURE_BLOCKED"])
    ]
    payload = {
        "schemaVersion": 1,
        "bindingAudits": [{
            "bindingKey": binding_key,
            "finishKey": contract["finishKey"],
            "templateSha256": sanitizer.sha256_file(source),
            "templateSourceUrl": "https://www.wir-machen-druck.de/fixture-template_2.pdf",
            "templateLocalRelativePath": "documents/fixture-template_2.pdf",
            "expectedGeometry": {
                "format": geometry["format"],
                "construction": geometry["construction"],
                "print": geometry["print"],
                "spine": geometry["spineMm"],
                "problems": [],
            },
            "geometryVerified": verified,
            "templateReadyForSanitization": verified,
            "templateReadyForImport": False,
            "blockers": blockers,
        }],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    contract["geometryAudit"] = {
        "reportSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bindingKey": binding_key,
    }


def write_verified_beschnitt_donor_report(
    run_root: Path,
    contract: dict,
    source: Path,
    donor: Path,
) -> tuple[Path, dict]:
    source_reader = PdfReader(str(source), strict=True)
    donor_reader = PdfReader(str(donor), strict=True)

    def identities(path: Path) -> dict:
        return {
            "localRelativePath": path.relative_to(run_root).as_posix(),
            "sha256": sanitizer.sha256_file(path),
            "bytes": path.stat().st_size,
        }

    def strokes(reader: PdfReader, layer: str) -> list[dict]:
        return sanitizer.stroke_path_inventory(reader, layer)

    def hashes(items: list[dict]) -> list[str]:
        return [item["pathGeometrySha256"] for item in items]

    def beschnitt_summary(items: list[dict]) -> dict:
        values = hashes(items)
        return {
            "layerName": "Beschnitt Seite",
            "strokePaintCount": len(values),
            "orderedPathGeometrySha256s": values,
            "orderedSha256": sanitizer.sha256_json(values),
            "sortedMultisetSha256": sanitizer.stroke_multiset_sha256(values),
        }

    source_beschnitt = strokes(source_reader, "Beschnitt Seite")
    donor_beschnitt = strokes(donor_reader, "Beschnitt Seite")
    source_rillen = strokes(source_reader, "Rillen")
    donor_rillen = strokes(donor_reader, "Rillen")
    source_cut = strokes(source_reader, "Schneiden")
    donor_cut = strokes(donor_reader, "Schneiden")
    source_cut_hashes = hashes(source_cut)
    donor_cut_hashes = hashes(donor_cut)
    source_only = sanitizer.source_only_in_paint_order(
        source_cut_hashes, donor_cut_hashes
    )
    source_cut_by_hash = {item["pathGeometrySha256"]: item for item in source_cut}
    donor_beschnitt_by_hash = {
        item["pathGeometrySha256"]: item for item in donor_beschnitt
    }
    reclassified = [
        {
            "page": source_cut_by_hash[value]["page"],
            "pathGeometrySha256": value,
            "effectiveBbox": source_cut_by_hash[value]["effectiveBbox"],
            "equalsDonorBeschnittPath": (
                donor_beschnitt_by_hash[value]["effectiveBbox"]
                == source_cut_by_hash[value]["effectiveBbox"]
            ),
            "fullMediaBoxOuterContour": True,
        }
        for value in source_only
    ]
    rillen_source_hashes = hashes(source_rillen)
    rillen_donor_hashes = hashes(donor_rillen)
    page_boxes = sanitizer.page_box_inventory(source_reader)
    geometry = contract["geometry"]
    entry = {
        "geometryKey": sanitizer.expected_geometry_key(geometry),
        "source": identities(source),
        "donor": identities(donor),
        "pageCount": len(source_reader.pages),
        "pageBoxesSha256": sanitizer.sha256_json(page_boxes),
        "sourceBeschnitt": beschnitt_summary(source_beschnitt),
        "donorBeschnitt": beschnitt_summary(donor_beschnitt),
        "rillen": {
            "layerName": "Rillen",
            "sourceStrokeCount": len(rillen_source_hashes),
            "donorStrokeCount": len(rillen_donor_hashes),
            "sourceSortedMultisetSha256": sanitizer.stroke_multiset_sha256(
                rillen_source_hashes
            ),
            "donorSortedMultisetSha256": sanitizer.stroke_multiset_sha256(
                rillen_donor_hashes
            ),
            "exactMultisetEqual": True,
        },
        "schneiden": {
            "layerName": "Schneiden",
            "sourceStrokeCount": len(source_cut_hashes),
            "donorStrokeCount": len(donor_cut_hashes),
            "sourceSortedMultisetSha256": sanitizer.stroke_multiset_sha256(
                source_cut_hashes
            ),
            "donorSortedMultisetSha256": sanitizer.stroke_multiset_sha256(
                donor_cut_hashes
            ),
            "donorIsExactMultisetSubset": True,
            "sourceOnlyReclassified": reclassified,
            "sourceOnlySortedMultisetSha256": sanitizer.stroke_multiset_sha256(
                source_only
            ),
        },
        "importPolicy": {
            "exclusiveDonorLayerName": "Beschnitt Seite",
            "importedStrokePathGeometrySha256s": hashes(donor_beschnitt),
            "removeSourceSchneidenPathGeometrySha256s": source_only,
            "preserveOriginalSourceForAllOtherGeometry": True,
            "noFullPdfRebind": True,
            "noTextApproximation": True,
        },
        "optionalAccessoryGeometryPreservedFromSource": True,
    }
    entry["entrySha256"] = sanitizer.sha256_json(entry)
    report = {
        "kind": sanitizer.VERIFIED_BESCHNITT_GUIDE_DONOR_KIND,
        "schemaVersion": 1,
        "reviewState": "approved_user_directed_deterministic_correction",
        "approval": {
            "decisionMode": "user_directed_deterministic_correction",
            "individualJsonEntryReviewClaimed": False,
            "reviewer": "Synthetic deterministic policy fixture",
            "reviewedAt": "2026-08-31T15:00:00Z",
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
        "entries": [entry],
    }
    report_path = run_root / sanitizer.VERIFIED_BESCHNITT_GUIDE_DONOR_PATH
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report), encoding="utf-8")
    report_bytes = report_path.read_bytes()
    report_sha = sanitizer.sha256_bytes(report_bytes)
    contract["verifiedBeschnittGuideDonor"] = {
        "reportSha256": report_sha,
        "entrySha256": entry["entrySha256"],
    }
    contract["batchEvidence"] = {
        "verifiedBeschnittGuideDonors": {
            "path": sanitizer.VERIFIED_BESCHNITT_GUIDE_DONOR_PATH,
            "sha256": report_sha,
            "bytes": len(report_bytes),
        }
    }
    return report_path, entry


def write_geometry_supplement(
    source: Path,
    contract: dict,
    audit_path: Path,
    supplement_path: Path,
) -> dict:
    base_audit = json.loads(audit_path.read_text(encoding="utf-8"))
    base_entry = base_audit["bindingAudits"][0]
    reader = PdfReader(str(source), strict=True)
    page_boxes_sha = sanitizer.sha256_json(sanitizer.page_box_inventory(reader))
    geometry = sanitizer.geometry_inventory(reader)

    def comparison(layer: str, *, equal: bool, more_paths: bool = False, more_strokes: bool = False):
        source_geometry = geometry[layer]
        return {
            "sourceFingerprint": source_geometry["sha256"],
            "counterpartFingerprint": (
                source_geometry["sha256"]
                if equal
                else sanitizer.sha256_json({"counterpart": layer})
            ),
            "sourcePathOperatorCount": source_geometry["pathOperatorCount"],
            "counterpartPathOperatorCount": (
                source_geometry["pathOperatorCount"] + (1 if more_paths else 0)
            ),
            "sourceStrokePaintCount": source_geometry["strokePaintCount"],
            "counterpartStrokePaintCount": (
                source_geometry["strokePaintCount"] + (1 if more_strokes else 0)
            ),
        }

    expected = base_entry["expectedGeometry"]
    expected_geometry = {
        "format": expected["format"],
        "construction": expected["construction"],
        "print": expected["print"],
        "spine": expected["spine"],
    }
    entry = {
        "sourceTemplateSha256": sanitizer.sha256_file(source),
        "expectedGeometry": expected_geometry,
        "finishKey": contract["finishKey"],
        "coveredBindingKeys": [base_entry["bindingKey"]],
        "sourceTemplate": {
            "sourceUrl": base_entry["templateSourceUrl"],
            "localRelativePath": base_entry["templateLocalRelativePath"],
            "sha256": sanitizer.sha256_file(source),
        },
        "verifiedWindowCounterpart": {
            "sourceUrl": "https://www.wir-machen-druck.de/fixture-window-template_2.pdf",
            "localRelativePath": "documents/fixture-window-template_2.pdf",
            "sha256": "a" * 64,
            "geometry": {
                **expected_geometry,
                "construction": f"{expected_geometry['construction']}-window",
            },
        },
        "baseBlockerAssessment": {
            "blockerCodes": [
                "PDF_TEXT_CONSTRUCTION_MISMATCH",
                "CONSTRUCTION_SOURCE_CONFLICT",
            ],
            "constructionSourceConflictDerivedFromTitleMismatch": True,
        },
        "comparisons": {
            "pageBoxes": {
                "equal": True,
                "sourceSha256": page_boxes_sha,
                "counterpartSha256": page_boxes_sha,
            },
            "rillen": comparison("Rillen", equal=True),
            "schneiden": comparison("Schneiden", equal=False, more_strokes=True),
            "beschnitt": comparison("Beschnitt Seite", equal=False, more_paths=True),
        },
        "renderedReviewEvidence": {
            "status": "passed",
            "sourceRenderSha256s": ["b" * 64, "c" * 64],
            "counterpartRenderSha256s": ["d" * 64, "e" * 64],
            "sourceHasWindowCut": False,
            "counterpartHasWindowCut": True,
            "reviewerNote": "Fixture render proves the source has no window cut.",
        },
        "verdict": "title_only_construction_text_error",
    }
    payload = {
        "kind": "wmd_sales_folder_geometry_supplement",
        "schemaVersion": 1,
        "baseAuditSha256": sanitizer.sha256_file(audit_path),
        "reviewState": "approved_title_only_construction_text_error",
        "reviewer": "Independent fixture reviewer",
        "reviewedAt": "2026-08-31T13:00:00Z",
        "entries": [entry],
    }
    supplement_path.write_text(json.dumps(payload), encoding="utf-8")
    contract["geometrySupplement"] = {
        "reportSha256": sanitizer.sha256_file(supplement_path),
        "entrySha256": sanitizer.sha256_json(entry),
    }
    return entry


def write_resolution_audit(
    source: Path,
    contract: dict,
    path: Path,
    *,
    target_blocker_codes: list[str] | None = None,
) -> tuple[dict, dict]:
    geometry = contract["geometry"]
    geometry_key = (
        f"{geometry['format']}|{geometry['construction']}|"
        f"{geometry['print']}|{geometry['spineMm']}mm"
    )
    expected = {
        "format": geometry["format"],
        "construction": geometry["construction"],
        "print": geometry["print"],
        "spine": geometry["spineMm"],
        "problems": [],
    }
    target_blockers = sorted(target_blocker_codes or sanitizer.REUSED_SPINE_ALIAS_BLOCKERS)
    target = {
        "bindingKey": "https://www.wir-machen-druck.de/target.html|target-material",
        "finishKey": contract["finishKey"],
        "templateSha256": "9" * 64,
        "templateSourceUrl": "https://www.wir-machen-druck.de/bad-alias-template_2.pdf",
        "templateLocalRelativePath": "documents/bad-alias-template_2.pdf",
        "expectedGeometry": expected,
        "expectedGeometryKey": geometry_key,
        "geometryVerified": False,
        "templateReadyForSanitization": False,
        "templateReadyForImport": False,
        "blockers": [
            {"code": code, "message": f"Fixture blocker: {code}"}
            for code in target_blockers
        ],
    }
    resolved = {
        "bindingKey": "https://www.wir-machen-druck.de/resolved.html|resolved-material",
        "finishKey": contract["finishKey"],
        "templateSha256": sanitizer.sha256_file(source),
        "templateSourceUrl": "https://www.wir-machen-druck.de/resolved-template_2.pdf",
        "templateLocalRelativePath": "documents/resolved-template_2.pdf",
        "expectedGeometry": expected,
        "expectedGeometryKey": geometry_key,
        "geometryVerified": True,
        "templateReadyForSanitization": True,
        "templateReadyForImport": False,
        "blockers": [],
    }
    payload = {"schemaVersion": 1, "bindingAudits": [target, resolved]}
    path.write_text(json.dumps(payload), encoding="utf-8")
    contract["geometryAudit"] = {
        "reportSha256": sanitizer.sha256_file(path),
        "bindingKey": target["bindingKey"],
    }
    return target, resolved


def plan_identity(row: dict) -> dict:
    return {
        "bindingKey": row["bindingKey"],
        "sourceUrl": row["templateSourceUrl"],
        "localRelativePath": row["templateLocalRelativePath"],
        "sha256": row["templateSha256"],
    }


def plan_audit_state(row: dict) -> dict:
    return {
        "geometryVerified": row["geometryVerified"],
        "templateReadyForSanitization": row["templateReadyForSanitization"],
        "templateReadyForImport": row["templateReadyForImport"],
        "blockerCodes": sorted(item["code"] for item in row["blockers"]),
    }


def plan_evidence(
    row: dict,
    base_audit_sha: str,
    source_binding_keys: list[str],
    *,
    geometry_axes_verified: bool,
    source_geometry_verified: bool,
) -> dict:
    return {
        "blockerCodes": sorted(item["code"] for item in row["blockers"]),
        "exactExpectedGeometryKey": row["expectedGeometryKey"],
        "exactFinishKey": row["finishKey"],
        "sourceEvidenceBindingKeys": sorted(source_binding_keys),
        "dependencies": {
            "baseAuditSha256": base_audit_sha,
            "titleSupplementReportSha256": None,
            "titleSupplementEntrySha256s": [],
            "extendedEvidenceTargetSha256": None,
            "extendedEvidenceFamilySha256": None,
        },
        "resolutionFacts": {
            "geometryAxesVerified": geometry_axes_verified,
            "sourceGeometryVerified": source_geometry_verified,
            "supplementVerdict": None,
            "supplementReviewState": None,
            "renderedReviewStatus": None,
            "extendedFamilyKey": None,
            "extendedRequirements": [],
        },
    }


def refresh_resolution_plan_hashes(plan: dict) -> None:
    fingerprints = [
        {
            "bindingKey": entry["bindingKey"],
            "entrySha256": sanitizer.sha256_json(entry),
        }
        for entry in plan["bindingClassifications"]
    ]
    plan["bindingClassificationFingerprints"] = fingerprints
    plan["approvedEntryHashes"] = [item["entrySha256"] for item in fingerprints]


def write_approved_resolution_plan(
    contract: dict,
    audit_path: Path,
    plan_path: Path,
    target: dict,
    resolved: dict,
    *,
    mutate=None,
) -> dict:
    base_sha = sanitizer.sha256_file(audit_path)
    direct = {
        "bindingKey": target["bindingKey"],
        "selectionKey": "fixture-direct-selection",
        "classification": "exact_verified_rebind",
        "expectedGeometryKey": target["expectedGeometryKey"],
        "finishKey": target["finishKey"],
        "oldTemplate": plan_identity(target),
        "newTemplate": plan_identity(resolved),
        "reason": "rebind_to_unique_base_verified_exact_geometry_and_finish_source",
        "entryReviewState": "approved",
        "sanitizerVerdictAfterApproval": "exact_verified_rebind",
        "baseAuditState": plan_audit_state(target),
        "ambiguityResult": {
            "status": "passed_unique_base_verified_identity",
            "candidateTemplateIdentityCount": 1,
            "candidateBindingKeys": [resolved["bindingKey"]],
        },
        "aliasQuarantineResult": {
            "required": True,
            "status": "passed_bad_alias_replaced",
            "quarantinedBindingKeys": [target["bindingKey"]],
        },
        "evidence": plan_evidence(
            target,
            base_sha,
            [resolved["bindingKey"]],
            geometry_axes_verified=False,
            source_geometry_verified=True,
        ),
    }
    base = {
        "bindingKey": resolved["bindingKey"],
        "selectionKey": "fixture-base-selection",
        "classification": "base_verified",
        "expectedGeometryKey": resolved["expectedGeometryKey"],
        "finishKey": resolved["finishKey"],
        "oldTemplate": plan_identity(resolved),
        "newTemplate": plan_identity(resolved),
        "reason": "strict_base_audit_verified_exact_geometry",
        "entryReviewState": "approved",
        "sanitizerVerdictAfterApproval": None,
        "baseAuditState": plan_audit_state(resolved),
        "ambiguityResult": {
            "status": "not_applicable_base_verified",
            "candidateTemplateIdentityCount": 1,
            "candidateBindingKeys": [resolved["bindingKey"]],
        },
        "aliasQuarantineResult": {
            "required": False,
            "status": "not_applicable_base_verified",
            "quarantinedBindingKeys": [],
        },
        "evidence": plan_evidence(
            resolved,
            base_sha,
            [resolved["bindingKey"]],
            geometry_axes_verified=True,
            source_geometry_verified=True,
        ),
    }
    prohibited = {key: False for key in sanitizer.PROHIBITED_RESOLUTION_ACTIONS}
    supplement_sha = "b" * 64
    classifications = {
        "base_verified": 1,
        "pending_title_only": 0,
        "exact_verified_rebind": 1,
        "collateral_original_after_bad_alias_quarantine": 0,
        "indirect_pending_title_rebind": 0,
        "extended_exact_evidence": 0,
    }
    plan = {
        "kind": "wmd_sales_folder_template_resolution_plan",
        "schemaVersion": 1,
        "reviewState": "approved",
        "approval": {
            "approved": True,
            "reviewer": "Independent fixture plan reviewer",
            "reviewedAt": "2026-08-31T14:00:00Z",
        },
        "approvalContract": {
            "currentArtifactMayAuthorizeSanitization": True,
            "requiredArtifactReviewState": "approved",
            "requiredEntryReviewState": "approved",
            "requireNonEmptyReviewer": True,
            "requireIsoReviewedAt": True,
            "approvedEntryHashesMustExactlyMatchFingerprints": True,
            "inputHashesMustRemainEqual": True,
            "pendingSupplementRequiresPlanRegenerationAfterApproval": True,
        },
        "approvedEntryHashes": [],
        "inputEvidence": {
            "baseAudit": {
                "path": "review/base-audit.json",
                "sha256": base_sha,
                "bytes": len(audit_path.read_bytes()),
            },
            "geometrySupplement": {
                "path": "review/geometry-supplement.json", "sha256": supplement_sha, "bytes": 1,
            },
            "templateProjectionStubs": {
                "path": "review/template-projection.json", "sha256": "c" * 64, "bytes": 1,
            },
            "proposedCompatibility": {
                "path": "review/compatibility.json", "sha256": "d" * 64, "bytes": 1,
            },
            "proposedPriceRows": {
                "path": "review/prices.json", "sha256": "e" * 64, "bytes": 1,
            },
            "extendedEvidenceFiles": [],
        },
        "resolutionPolicy": {
            "exactRebindAxes": ["expectedGeometryKey", "finishKey"],
            "baseVerifiedRequiresStrictAuditPass": True,
            "pendingTitleOnlyRequiresExactSupplementCoverage": True,
            "indirectPendingRebindMayUseOnlyExactSupplementCoveredSources": True,
            "extendedEvidenceRequiresExactFamilyAndFileHashes": True,
            "crossGeometryAliasReuseAllowed": False,
            "unresolvedSelectionsWithheldFromStorefrontAndDesigner": True,
            "pricesRecalculated": False,
            "proposalMutated": False,
        },
        "counts": {
            "totalBindings": 2,
            "classifications": classifications,
            "baseVerifiedBindings": 1,
            "recoveredBindingsPendingReview": 0,
            "extendedEvidenceFamilies": 0,
            "extendedEvidenceTargets": 0,
            "unresolvedBindings": 0,
        },
        "filteredCandidates": {
            "policy": "all_bindings_have_a_hash_pinned_candidate_and_are_approved",
            "templateProjection": {"inputBindings": 2, "candidateBindings": 2, "withheldBindings": 0},
            "compatibility": {"inputSelections": 2, "candidateSelections": 2, "withheldSelections": 0},
            "proposedPriceRows": {"inputRows": 1, "candidateRows": 1, "withheldRows": 0},
            "pendingReviewBoundary": {
                "candidateDoesNotMeanApproved": False,
                "nonBaseRecoveryBindingsPendingReview": 0,
                "titleOnlyBindingsPendingReview": 0,
                "indirectRebindBindingsPendingTitleOnlyDependency": 0,
                "extendedEvidenceBindingsPendingReview": 0,
            },
            "candidateBindingKeys": [target["bindingKey"], resolved["bindingKey"]],
        },
        "extendedEvidence": {
            "kind": "wmd_sales_folder_extended_exact_evidence",
            "schemaVersion": 1,
            "reviewState": "approved",
            "baseAuditSha256": base_sha,
            "titleSupplementSha256": supplement_sha,
            "familyFingerprints": [],
            "targetFingerprints": [],
            "families": [],
            "prohibitedActionsPerformed": prohibited,
        },
        "bindingClassificationFingerprints": [],
        "bindingClassifications": [direct, base],
        "prohibitedActionsPerformed": prohibited,
        "nextGate": "sanitization_may_run_but_import_and_publish_remain_separate",
    }
    if mutate is not None:
        mutate(plan)
    refresh_resolution_plan_hashes(plan)
    plan_path.write_text(json.dumps(plan), encoding="utf-8")
    contract["templateResolutionPlan"] = {
        "reportSha256": sanitizer.sha256_file(plan_path),
        "entrySha256": sanitizer.sha256_json(plan["bindingClassifications"][0]),
    }
    return plan


def write_cd_scoped_projection_fixture(directory: Path):
    run_root = directory / "cd-scope-run"
    review = run_root / "review"
    review.mkdir(parents=True)
    plan_path = review / "template-resolution-plan.json"
    plan_path.write_text("{}", encoding="utf-8")
    audits = []
    stub_lines = []
    axes = ["folder_model", "print", "spine", "paper", "finish"]
    for index in range(sanitizer.CD_SCOPE_PROPOSED_BINDING_COUNT):
        source_url = f"https://www.wir-machen-druck.de/fixture-folder-{index}.html"
        material_id = str(1000000 + index)
        source_product_id = str(19000 + (index % 400))
        paper_key = f"fixture-paper-{index}"
        template_url = (
            "https://www.wir-machen-druck.de/tpl/manns-partner/media/ddb/"
            f"druckdatenskizzen/0/fixture-folder-{index}_2.pdf"
        )
        expected = {
            "format": "a4",
            "construction": "2-part-2-flaps",
            "print": "4+4",
            "spine": 1,
            "problems": [],
        }
        binding_key = f"{source_url}|{material_id}"
        audits.append({
            "bindingKey": binding_key,
            "sourceProductId": source_product_id,
            "sourceSku": source_product_id,
            "sourceUrl": source_url,
            "materialId": material_id,
            "paperKey": paper_key,
            "finishKey": "none",
            "expectedGeometry": expected,
            "expectedGeometryKey": "a4|2-part-2-flaps|4+4|1mm",
            "templateSourceUrl": template_url,
        })
        match = {
            "folder_model": "a4--2-part-2-flaps",
            "print": "4+4",
            "spine": "1mm",
            "paper": paper_key,
            "finish": "none",
        }
        stub_lines.append(json.dumps({
            "sourceOrder": index,
            "key": f"fixture-stub-{index}",
            "match": match,
            "selectionConstraintProfile": "sales_folder_v1",
            "selectionConstraintSections": {},
            "selectionConstraintStatus": "fixture_pending_ids",
            "structuredBinding": {
                "profile": "sales_folder_v1",
                "semanticAxisKeys": axes,
                "semanticConstraints": match,
            },
            "sourceBinding": {
                "sourceUrl": source_url,
                "sourceProductId": source_product_id,
                "sourceSku": source_product_id,
                "materialId": material_id,
            },
            "guide": {},
            "template": {"sourceUrl": template_url},
        }, separators=(",", ":")))
    for index in range(sanitizer.CD_SCOPE_EXCLUDED_BINDING_COUNT):
        source_product_id = str(46600 + (index % 20))
        source_url = (
            "https://www.wir-machen-druck.de/"
            f"mappe-fuer-cdverpackung-135-x-135-cm-fixture-{index}.html"
        )
        material_id = str(2000000 + index)
        print_mode = "4+0" if index < 26 else "4+4"
        expected = {
            "format": "cd-135x135",
            "construction": "2-part-closure",
            "print": print_mode,
            "spine": 3,
            "problems": [],
        }
        audits.append({
            "bindingKey": f"{source_url}|{material_id}",
            "sourceProductId": source_product_id,
            "sourceSku": source_product_id,
            "sourceUrl": source_url,
            "materialId": material_id,
            "paperKey": f"cd-paper-{index}",
            "finishKey": "none",
            "expectedGeometry": expected,
            "expectedGeometryKey": f"cd-135x135|2-part-closure|{print_mode}|3mm",
            "templateSourceUrl": (
                "https://www.wir-machen-druck.de/tpl/manns-partner/media/ddb/"
                f"druckdatenskizzen/0/mappe_cd_fixture_{index}_2.pdf"
            ),
        })
    report = {"schemaVersion": 1, "bindingAudits": audits}
    audit_path = review / "template-geometry-audit.json"
    audit_path.write_text(json.dumps(report, separators=(",", ":")), encoding="utf-8")
    stubs_path = review / "template-projection-stubs.jsonl"
    stubs_path.write_text("\n".join(stub_lines) + "\n", encoding="utf-8")
    projection_evidence = {
        "path": "review/template-projection-stubs.jsonl",
        "sha256": sanitizer.sha256_file(stubs_path),
        "bytes": len(stubs_path.read_bytes()),
    }
    return plan_path, report, projection_evidence, stubs_path


class SalesFolderSanitizerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def sanitize(self, print_mode: str = "4+0"):
        source = self.directory / f"source-{print_mode.replace('+', '')}.pdf"
        output = self.directory / f"output-{print_mode.replace('+', '')}.pdf"
        inspection = self.directory / f"inspection-{print_mode.replace('+', '')}.json"
        contract_path = self.directory / f"contract-{print_mode.replace('+', '')}.json"
        audit_path = self.directory / f"audit-{print_mode.replace('+', '')}.json"
        build_fixture(source, print_mode)
        contract = approved_contract(source, print_mode)
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract, ensure_ascii=False), encoding="utf-8")
        payload = sanitizer.run_sanitize(source, output, inspection, contract_path, audit_path)
        return source, output, inspection, contract, payload

    def donor_case(
        self,
        name: str = "donor-case",
        *,
        repeated_positioned_cut_shape: bool = False,
    ) -> dict:
        run_root = self.directory / name
        source_directory = run_root / "documents/source-pdfs"
        source_directory.mkdir(parents=True)
        source = source_directory / "source-zero-beschnitt.pdf"
        donor = source_directory / "donor-reviewed-beschnitt.pdf"
        build_fixture(
            source,
            "4+0",
            safety_path=False,
            source_no_print_fill=False,
            cut_outer_contour=True,
            repeated_positioned_cut_shape=repeated_positioned_cut_shape,
        )
        build_fixture(
            donor,
            "4+0",
            safety_path=True,
            source_no_print_fill=False,
            beschnitt_outer_contour=True,
            beschnitt_ext_gstate=True,
            repeated_positioned_cut_shape=repeated_positioned_cut_shape,
        )
        contract = approved_contract(source, "4+0")
        review = run_root / "review"
        review.mkdir(parents=True)
        audit = review / "template-geometry-audit.json"
        write_geometry_audit(source, contract, audit)
        report, entry = write_verified_beschnitt_donor_report(
            run_root, contract, source, donor
        )
        contract_path = run_root / "documents/sanitization-contracts/fixture.json"
        contract_path.parent.mkdir(parents=True)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        return {
            "runRoot": run_root,
            "source": source,
            "donor": donor,
            "contract": contract,
            "contractPath": contract_path,
            "audit": audit,
            "report": report,
            "entry": entry,
            "output": run_root / "documents/sanitized-pdfs/fixture.pdf",
            "inspection": run_root / "documents/sanitization-inspections/fixture.json",
            "allowedSources": {sanitizer.sha256_file(source)},
        }

    def test_4_plus_0_preserves_layers_and_geometry_and_converts_only_reviewed_no_print_page(self):
        source, output, inspection, contract, payload = self.sanitize("4+0")
        self.assertTrue(output.is_file())
        self.assertTrue(inspection.is_file())
        self.assertEqual(payload["state"], "sanitized_render_review_required")
        self.assertFalse(payload["eligibleForTemplateImport"])
        self.assertFalse(payload["eligibleForImport"])
        self.assertEqual(payload["validation"]["fullPageNeutralGrayPaints"], 1)
        source_reader = PdfReader(str(source), strict=True)
        output_reader = PdfReader(str(output), strict=True)
        self.assertEqual(sanitizer.page_box_inventory(source_reader), sanitizer.page_box_inventory(output_reader))
        self.assertIsNone(output_reader.metadata)
        self.assertIsNone(output_reader.trailer.get("/Info"))
        self.assertIsNone(output_reader.trailer["/Root"].get("/Metadata"))
        self.assertTrue(all(page.get("/Thumb") is None for page in output_reader.pages))
        text = sanitizer.normalized_extracted_text(output_reader)
        self.assertIn("WEBPRINTER TRYKSKABELON", text)
        self.assertIn("Beskæring og stans: magenta streg", text)
        self.assertIn("Falselinjer: cyan streg", text)
        self.assertIn("Sikkerhedsafstand: blå hjælpelinje, 3 mm", text)
        self.assertNotIn("WIRmachenDRUCK", text)
        self.assertNotIn("Datenformat", text)
        painted_colors = [event["color"] for event in sanitizer.painted_color_events(output_reader)]
        self.assertNotIn(("k", [0.33, 0.03, 0.75, 0.0]), painted_colors)
        layer_details = sanitizer.output_layer_details(output_reader)
        self.assertEqual(
            {item["name"] for item in layer_details},
            set(OUTPUT_NAMES_DA.values()) | {sanitizer.INFO_LAYER_NAME},
        )
        for item in layer_details:
            self.assertEqual((item["viewState"], item["printState"], item["exportState"]), ("/ON", "/OFF", "/OFF"))
        expected_fingerprints = contract["sourceEvidence"]["geometryFingerprints"]
        for name in ("Beschnitt Seite", "Rillen", "Schneiden", "Visitenkartentasche"):
            self.assertEqual(payload["validation"]["geometryFingerprintsPreserved"][name], expected_fingerprints[name])
        self.assertNotIn(b"wirmachendruck", output.read_bytes().lower())
        self.assertEqual(sanitizer.forbidden_interactive_feature_inventory(output_reader), [])
        self.assertEqual(sanitizer.supplier_identity_hits(output_reader, output.read_bytes()), [])
        self.assertTrue(payload["validation"]["webprinterBluePanelPaintVerified"])
        self.assertTrue(payload["validation"]["supplierGreenPaintAbsent"])
        self.assertGreater(payload["validation"]["informationTextBounds"][0]["characterCount"], 40)

    def test_4_plus_4_never_receives_a_full_page_grey_no_print_area(self):
        _source, _output, _inspection, _contract, payload = self.sanitize("4+4")
        self.assertEqual(payload["validation"]["fullPageNeutralGrayPaints"], 0)

    def test_no_print_gray_is_path_scoped_and_does_not_recolor_later_form(self):
        source = self.directory / "path-scoped-no-print-source.pdf"
        output = self.directory / "path-scoped-no-print-output.pdf"
        inspection = self.directory / "path-scoped-no-print-inspection.json"
        contract_path = self.directory / "path-scoped-no-print-contract.json"
        audit_path = self.directory / "path-scoped-no-print-audit.json"
        build_fixture(source, "4+0", regular_form_after_no_print=True)
        contract = approved_contract(source, "4+0")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        fills = [
            paint["fill"]
            for paint in sanitizer.device_paint_style_inventory(output_reader)
            if paint["page"] == 2
            and paint["layer"] == "Udfald og sikkerhedsafstand"
            and paint["operator"] in {"f", "F", "f*", "B", "B*", "b", "b*"}
        ]
        self.assertIn(
            ("rg", [round(value, 7) for value in sanitizer.NO_PRINT_GRAY_RGB]),
            fills,
        )
        self.assertIn(("k", [0.0, 1.0, 1.0, 0.0]), fills)

    def test_generated_white_page_no_print_background_is_exact_helper_ocg_behind_geometry(self):
        source = self.directory / "white-no-print-page-source.pdf"
        output = self.directory / "white-no-print-page-output.pdf"
        inspection = self.directory / "white-no-print-page-inspection.json"
        contract_path = self.directory / "white-no-print-page-contract.json"
        audit_path = self.directory / "white-no-print-page-audit.json"
        build_fixture(source, "4+0", source_no_print_fill=False)
        contract = approved_contract(source, "4+0")
        self.assertEqual(contract["colors"]["noPrintAreas"], [])
        self.assertEqual(len(contract["colors"]["generatedNoPrintBackgrounds"]), 1)
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        payload = sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        generated = payload["validation"]["generatedNoPrintBackgrounds"]
        self.assertEqual(len(generated), 1)
        self.assertTrue(generated[0]["behindRetainedCutFoldGeometry"])
        self.assertTrue(generated[0]["helperLayerViewOnPrintOffExportOff"])
        self.assertEqual(payload["validation"]["fullPageNeutralGrayPaints"], 1)
        source_reader = PdfReader(str(source), strict=True)
        output_reader = PdfReader(str(output), strict=True)
        self.assertEqual(
            sanitizer.page_box_inventory(source_reader),
            sanitizer.page_box_inventory(output_reader),
        )
        source_geometry = sanitizer.geometry_inventory(source_reader)
        preserved_geometry = payload["validation"]["geometryFingerprintsPreserved"]
        self.assertEqual(preserved_geometry["Rillen"], source_geometry["Rillen"])
        self.assertEqual(preserved_geometry["Schneiden"], source_geometry["Schneiden"])
        layer_details = sanitizer.output_layer_details(
            output_reader
        )
        generated_layer = next(
            item for item in layer_details
            if item["name"] == sanitizer.GENERATED_NO_PRINT_LAYER_NAME
        )
        self.assertEqual(
            (generated_layer["viewState"], generated_layer["printState"], generated_layer["exportState"]),
            ("/ON", "/OFF", "/OFF"),
        )

        original_set_ocproperties = sanitizer.set_ocproperties

        def add_unexpected_layer(writer, refs):
            extra = writer._add_object(sanitizer.ocg_dictionary("Uventet hjælpelag"))
            original_set_ocproperties(writer, [*refs, extra])

        try:
            sanitizer.set_ocproperties = add_unexpected_layer
            with self.assertRaisesRegex(
                sanitizer.SalesFolderSanitizationError,
                "layer set is incomplete or unexpected",
            ):
                sanitizer.run_sanitize(
                    source,
                    self.directory / "extra-generated-ocg-output.pdf",
                    self.directory / "extra-generated-ocg-inspection.json",
                    contract_path,
                    audit_path,
                )
        finally:
            sanitizer.set_ocproperties = original_set_ocproperties

    def test_verified_beschnitt_donor_imports_only_pinned_strokes_and_reclassifies_outer_contours_once(self):
        case = self.donor_case()
        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            case["allowedSources"],
        ):
            payload = sanitizer.run_sanitize(
                case["source"],
                case["output"],
                case["inspection"],
                case["contractPath"],
                case["audit"],
            )

        source_reader = PdfReader(str(case["source"]), strict=True)
        output_reader = PdfReader(str(case["output"]), strict=True)
        self.assertEqual(
            sanitizer.page_box_inventory(output_reader),
            sanitizer.page_box_inventory(source_reader),
        )
        proof = payload["validation"]["verifiedBeschnittGuideDonor"]
        self.assertEqual(
            proof["importedStrokePathGeometrySha256s"],
            case["entry"]["importPolicy"]["importedStrokePathGeometrySha256s"],
        )
        self.assertTrue(proof["sourceFoldCutAndAccessoryAuthorityPreserved"])
        self.assertFalse(proof["fullPdfRebindPerformed"])
        self.assertTrue(proof["visualOutputQaPending"])
        output_beschnitt_hashes = [
            item["pathGeometrySha256"]
            for item in sanitizer.stroke_path_inventory(
                output_reader, sanitizer.KNOWN_DANISH_LAYER_NAMES["Beschnitt Seite"]
            )
        ]
        output_cut_hashes = [
            item["pathGeometrySha256"]
            for item in sanitizer.stroke_path_inventory(
                output_reader, sanitizer.KNOWN_DANISH_LAYER_NAMES["Schneiden"]
            )
        ]
        for path_hash in case["entry"]["importPolicy"][
            "removeSourceSchneidenPathGeometrySha256s"
        ]:
            self.assertEqual(output_beschnitt_hashes.count(path_hash), 1)
            self.assertNotIn(path_hash, output_cut_hashes)
        self.assertEqual(
            sanitizer.stroke_multiset_sha256(
                item["pathGeometrySha256"]
                for item in sanitizer.stroke_path_inventory(output_reader, "Falselinjer")
            ),
            sanitizer.stroke_multiset_sha256(
                item["pathGeometrySha256"]
                for item in sanitizer.stroke_path_inventory(source_reader, "Rillen")
            ),
        )
        self.assertEqual(
            sanitizer.stroke_multiset_sha256(
                item["pathGeometrySha256"]
                for item in sanitizer.stroke_path_inventory(output_reader, "Visitkortlomme")
            ),
            sanitizer.stroke_multiset_sha256(
                item["pathGeometrySha256"]
                for item in sanitizer.stroke_path_inventory(
                    source_reader, "Visitenkartentasche"
                )
            ),
        )

    def test_verified_beschnitt_donor_overlay_preserves_effective_extgstate(self):
        case = self.donor_case("donor-effective-extgstate")
        donor_reader = PdfReader(str(case["donor"]), strict=True)
        donor_records = sanitizer._stroke_path_inventory(
            donor_reader,
            "Beschnitt Seite",
            include_ext_gstate=True,
        )
        self.assertTrue(donor_records)
        self.assertTrue(all(
            record["extGState"]["/SA"] == "True"
            for record in donor_records
        ))
        self.assertTrue(all(
            record["extGState"] == sanitizer.VERIFIED_BESCHNITT_DONOR_EXT_GSTATE
            for record in donor_records
        ))

        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            case["allowedSources"],
        ):
            sanitizer.run_sanitize(
                case["source"],
                case["output"],
                case["inspection"],
                case["contractPath"],
                case["audit"],
            )

        output_records = sanitizer._stroke_path_inventory(
            PdfReader(str(case["output"]), strict=True),
            sanitizer.KNOWN_DANISH_LAYER_NAMES["Beschnitt Seite"],
            include_ext_gstate=True,
        )
        self.assertEqual(
            [
                (
                    record["page"],
                    record["pathGeometrySha256"],
                    record["effectiveBbox"],
                    record["extGState"],
                )
                for record in output_records
            ],
            [
                (
                    record["page"],
                    record["pathGeometrySha256"],
                    record["effectiveBbox"],
                    record["extGState"],
                )
                for record in donor_records
            ],
        )
        self.assertTrue(all(
            record["extGState"]["/SA"] == "True"
            for record in output_records
        ))

    def test_verified_beschnitt_donor_allows_repeated_cut_shape_at_distinct_positions(self):
        case = self.donor_case(
            "donor-positioned-cut-repeat",
            repeated_positioned_cut_shape=True,
        )
        source_reader = PdfReader(str(case["source"]), strict=True)
        source_cut = sanitizer.stroke_path_inventory(source_reader, "Schneiden")
        duplicate_hashes = {
            path_hash
            for path_hash, count in Counter(
                item["pathGeometrySha256"] for item in source_cut
            ).items()
            if count > 1
        }
        self.assertEqual(len(duplicate_hashes), 2)
        for path_hash in duplicate_hashes:
            occurrences = [
                item for item in source_cut
                if item["pathGeometrySha256"] == path_hash
            ]
            self.assertEqual(len(occurrences), 2)
            self.assertEqual(len({tuple(item["effectiveBbox"]) for item in occurrences}), 2)

        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            case["allowedSources"],
        ):
            sanitizer.run_sanitize(
                case["source"],
                case["output"],
                case["inspection"],
                case["contractPath"],
                case["audit"],
            )

        output_cut = sanitizer.stroke_path_inventory(
            PdfReader(str(case["output"]), strict=True),
            sanitizer.KNOWN_DANISH_LAYER_NAMES["Schneiden"],
        )
        for path_hash in duplicate_hashes:
            source_occurrences = [
                item for item in source_cut
                if item["pathGeometrySha256"] == path_hash
            ]
            output_occurrences = [
                item for item in output_cut
                if item["pathGeometrySha256"] == path_hash
            ]
            self.assertEqual(
                [item["effectiveBbox"] for item in output_occurrences],
                [item["effectiveBbox"] for item in source_occurrences],
            )

    def test_verified_beschnitt_occurrence_identity_rejects_bbox_tamper_and_exact_duplicate(self):
        case = self.donor_case("donor-occurrence-identity-tamper")
        report = json.loads(case["report"].read_text(encoding="utf-8"))
        entry = report["entries"][0]
        reviewed = entry["schneiden"]["sourceOnlyReclassified"][0]

        source_records = sanitizer.stroke_path_inventory(
            PdfReader(str(case["source"]), strict=True), "Schneiden"
        )
        exact_record = sanitizer.exact_stroke_occurrence(
            source_records,
            reviewed["page"],
            reviewed["pathGeometrySha256"],
            reviewed["effectiveBbox"],
            "synthetic source",
        )
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "occurrence is missing or ambiguous",
        ):
            sanitizer.exact_stroke_occurrence(
                [*source_records, copy.deepcopy(exact_record)],
                reviewed["page"],
                reviewed["pathGeometrySha256"],
                reviewed["effectiveBbox"],
                "synthetic source",
            )

        reviewed["effectiveBbox"][0] += 1
        entry["entrySha256"] = sanitizer.sha256_json({
            key: value for key, value in entry.items() if key != "entrySha256"
        })
        case["report"].write_text(json.dumps(report), encoding="utf-8")
        report_bytes = case["report"].read_bytes()
        contract = json.loads(case["contractPath"].read_text(encoding="utf-8"))
        contract["verifiedBeschnittGuideDonor"] = {
            "reportSha256": sanitizer.sha256_bytes(report_bytes),
            "entrySha256": entry["entrySha256"],
        }
        contract["batchEvidence"]["verifiedBeschnittGuideDonors"].update({
            "sha256": sanitizer.sha256_bytes(report_bytes),
            "bytes": len(report_bytes),
        })
        case["contractPath"].write_text(json.dumps(contract), encoding="utf-8")
        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            case["allowedSources"],
        ), self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "source Schneiden occurrence is missing or ambiguous",
        ):
            sanitizer.run_sanitize(
                case["source"], case["output"], case["inspection"],
                case["contractPath"], case["audit"],
            )
        self.assertFalse(case["output"].exists())
        self.assertFalse(case["inspection"].exists())

    def test_verified_beschnitt_donor_fails_closed_on_donor_or_policy_tampering(self):
        byte_case = self.donor_case("donor-byte-tamper")
        byte_case["donor"].write_bytes(byte_case["donor"].read_bytes() + b"\n%tamper")
        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            byte_case["allowedSources"],
        ), self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "donor PDF bytes or SHA-256 changed",
        ):
            sanitizer.run_sanitize(
                byte_case["source"], byte_case["output"], byte_case["inspection"],
                byte_case["contractPath"], byte_case["audit"],
            )

        policy_case = self.donor_case("donor-policy-tamper")
        report = json.loads(policy_case["report"].read_text(encoding="utf-8"))
        entry = report["entries"][0]
        entry["importPolicy"]["removeSourceSchneidenPathGeometrySha256s"] = []
        entry["entrySha256"] = sanitizer.sha256_json({
            key: value for key, value in entry.items() if key != "entrySha256"
        })
        policy_case["report"].write_text(json.dumps(report), encoding="utf-8")
        report_bytes = policy_case["report"].read_bytes()
        contract = json.loads(policy_case["contractPath"].read_text(encoding="utf-8"))
        contract["verifiedBeschnittGuideDonor"] = {
            "reportSha256": sanitizer.sha256_bytes(report_bytes),
            "entrySha256": entry["entrySha256"],
        }
        contract["batchEvidence"]["verifiedBeschnittGuideDonors"].update({
            "sha256": sanitizer.sha256_bytes(report_bytes),
            "bytes": len(report_bytes),
        })
        policy_case["contractPath"].write_text(json.dumps(contract), encoding="utf-8")
        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            policy_case["allowedSources"],
        ), self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "import policy is not exact",
        ):
            sanitizer.run_sanitize(
                policy_case["source"], policy_case["output"],
                policy_case["inspection"], policy_case["contractPath"],
                policy_case["audit"],
            )

    def test_verified_beschnitt_output_validation_rejects_duplicate_imported_stroke(self):
        case = self.donor_case("donor-output-tamper")
        original = sanitizer.create_verified_beschnitt_overlay

        def duplicate_first_stroke(page_width, page_height, records, donor_reader):
            return original(
                page_width, page_height, [*records, copy.deepcopy(records[0])], donor_reader
            )

        with mock.patch.object(
            sanitizer,
            "VERIFIED_BESCHNITT_GUIDE_DONOR_SOURCES",
            case["allowedSources"],
        ), mock.patch.object(
            sanitizer,
            "create_verified_beschnitt_overlay",
            side_effect=duplicate_first_stroke,
        ), self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "Output Beschnitt strokes differ",
        ):
            sanitizer.run_sanitize(
                case["source"], case["output"], case["inspection"],
                case["contractPath"], case["audit"],
            )
        self.assertFalse(case["output"].exists())
        self.assertFalse(case["inspection"].exists())

    def test_generated_no_print_background_cannot_replace_a_real_reviewable_source_fill(self):
        source = self.directory / "real-no-print-fill-source.pdf"
        contract_path = self.directory / "wrong-generated-background-contract.json"
        audit_path = self.directory / "wrong-generated-background-audit.json"
        build_fixture(source, "4+0")
        contract = approved_contract(source, "4+0")
        media = contract["sourceEvidence"]["pageBoxes"][1]["mediabox"]
        contract["colors"]["noPrintAreas"] = []
        contract["colors"]["generatedNoPrintBackgrounds"] = [{
            "page": 2,
            "rectPt": [media[0], media[1], media[2] - media[0], media[3] - media[1]],
            "mediaBoxSha256": sanitizer.sha256_json(media),
            "sourcePattern": sanitizer.GENERATED_NO_PRINT_SOURCE_PATTERN,
            "replacementHex": sanitizer.NO_PRINT_GRAY,
            "expectedPaintCount": 1,
            "outputLayerNameDa": sanitizer.GENERATED_NO_PRINT_LAYER_NAME,
        }]
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "forbidden when a source red/pink bleed-layer fill exists",
        ):
            sanitizer.run_sanitize(
                source,
                self.directory / "wrong-generated-background-output.pdf",
                self.directory / "wrong-generated-background-inspection.json",
                contract_path,
                audit_path,
            )

    def test_removes_only_exact_cd_tasche_unused_accessory_without_geometry_or_box_drift(self):
        source = self.directory / "cd-accessory-source.pdf"
        output = self.directory / "cd-accessory-output.pdf"
        inspection = self.directory / "cd-accessory-inspection.json"
        contract_path = self.directory / "cd-accessory-contract.json"
        audit_path = self.directory / "cd-accessory-audit.json"
        build_fixture(source, "4+4", include_cd_layer=True)
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        payload = sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        source_reader = PdfReader(str(source), strict=True)
        output_reader = PdfReader(str(output), strict=True)
        self.assertEqual(
            sanitizer.page_box_inventory(source_reader),
            sanitizer.page_box_inventory(output_reader),
        )
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )
        self.assertNotIn(b"cd-tasche", sanitizer.decoded_pdf_bytes(output_reader).lower())
        self.assertNotIn(
            "CD-Tasche", payload["validation"]["geometryFingerprintsPreserved"]
        )
        for source_name in ("Beschnitt Seite", "Rillen", "Schneiden"):
            self.assertEqual(
                payload["validation"]["geometryFingerprintsPreserved"][source_name],
                contract["sourceEvidence"]["geometryFingerprints"][source_name],
            )

        wrong_layer = copy.deepcopy(contract)
        for policy in wrong_layer["layers"]:
            if policy["name"] == "Visitenkartentasche":
                policy.update({
                    "action": "remove",
                    "role": "unused-accessory",
                    "outputNameDa": None,
                })
        wrong_contract_path = self.directory / "wrong-unused-accessory-contract.json"
        wrong_contract_path.write_text(json.dumps(wrong_layer), encoding="utf-8")
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "restricted to the exact CD-Tasche",
        ):
            sanitizer.run_sanitize(
                source,
                self.directory / "wrong-unused-accessory-output.pdf",
                self.directory / "wrong-unused-accessory-inspection.json",
                wrong_contract_path,
                audit_path,
            )

    def test_technical_cut_spot_is_preserved_without_inventing_a_finish_mask(self):
        source = self.directory / "technical-cut-spot-source.pdf"
        output = self.directory / "technical-cut-spot-output.pdf"
        inspection = self.directory / "technical-cut-spot-inspection.json"
        contract_path = self.directory / "technical-cut-spot-contract.json"
        audit_path = self.directory / "technical-cut-spot-audit.json"
        build_fixture(source, "4+4", technical_cut_spot=True)
        contract = approved_contract(source, "4+4", "soft-touch-partial-uv")
        self.assertFalse(contract["spotFinish"]["required"])
        self.assertEqual(contract["spotFinish"]["allowedColorants"], ["stanzen"])
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        payload = sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        self.assertTrue(payload["validation"]["sourceSpotPaintUsagePreserved"])
        self.assertFalse(payload["validation"]["sourceFinishMaskPresent"])
        self.assertFalse(payload["validation"]["onlineDesignerEligibleForFinish"])
        self.assertEqual(
            payload["validation"]["professionalUploadWarningDa"],
            sanitizer.PROFESSIONAL_UPLOAD_WARNING_DA,
        )
        self.assertTrue(payload["validation"]["professionalUploadWarningVerified"])
        self.assertEqual(
            payload["validation"]["finishWorkflow"],
            "professional_upload_only_no_source_finish_mask",
        )
        usage = sanitizer.spot_paint_usage(PdfReader(str(output), strict=True))
        self.assertTrue(any(
            item["colorant"] == sanitizer.SPOT_COLORANT_OUTPUT_NAMES["stanzen"]
            and item["layer"] == "Beskæring og stans"
            and item["paint"] == "stroke"
            for item in usage
        ))
        self.assertFalse(any(item["layer"] == "Efterbehandling" for item in usage))
        decoded = sanitizer.decoded_pdf_bytes(PdfReader(str(output), strict=True)).lower()
        self.assertNotIn(b"stanzen", decoded)
        self.assertIn(
            sanitizer.SPOT_COLORANT_OUTPUT_NAMES["stanzen"].lower().encode("ascii"),
            decoded,
        )
        text = sanitizer.normalized_extracted_text(PdfReader(str(output), strict=True))
        self.assertIn(sanitizer.PROFESSIONAL_UPLOAD_WARNING_DA, text)
        self.assertNotIn("Mindste elementstørrelse", text)

    def test_no_mask_spot_finish_rejects_invented_rules_or_missing_generic_warning(self):
        source = self.directory / "no-mask-contract-source.pdf"
        build_fixture(source, "4+4", technical_cut_spot=True)
        contract = approved_contract(source, "4+4", "hot-foil-gold")
        audit_path = self.directory / "no-mask-contract-audit.json"
        write_geometry_audit(source, contract, audit_path)

        invented = copy.deepcopy(contract)
        invented["finishInstructions"] = [{
            "category": "minimum-size",
            "danish": "Mindste elementstørrelse er 2 mm.",
            "sourcePattern": r"Mindestgroesse\s+2\s*mm",
        }]
        invented_path = self.directory / "invented-no-mask-contract.json"
        invented_path.write_text(json.dumps(invented), encoding="utf-8")
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "must not invent source-backed or numeric instructions",
        ):
            sanitizer.run_sanitize(
                source,
                self.directory / "invented-no-mask-output.pdf",
                self.directory / "invented-no-mask-inspection.json",
                invented_path,
                audit_path,
            )

        missing_warning = copy.deepcopy(contract)
        missing_warning["professionalUploadWarningDa"] = None
        missing_warning_path = self.directory / "missing-no-mask-warning-contract.json"
        missing_warning_path.write_text(json.dumps(missing_warning), encoding="utf-8")
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "requires the exact generic Danish professional-upload warning",
        ):
            sanitizer.run_sanitize(
                source,
                self.directory / "missing-no-mask-warning-output.pdf",
                self.directory / "missing-no-mask-warning-inspection.json",
                missing_warning_path,
                audit_path,
            )

    def test_output_validation_checks_actual_blue_panel_paint(self):
        source = self.directory / "wrong-panel-color-source.pdf"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        audit_path = self.directory / "wrong-panel-color-audit.json"
        write_geometry_audit(source, contract, audit_path)
        contract_path = self.directory / "wrong-panel-color-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        original_blue = sanitizer.WEBPRINTER_BLUE
        try:
            sanitizer.WEBPRINTER_BLUE = "#00FF00"
            with self.assertRaisesRegex(
                sanitizer.SalesFolderSanitizationError,
                "exact Webprinter blue and border blue",
            ):
                sanitizer.run_sanitize(
                    source,
                    self.directory / "wrong-panel-color-output.pdf",
                    self.directory / "wrong-panel-color-inspection.json",
                    contract_path,
                    audit_path,
                )
        finally:
            sanitizer.WEBPRINTER_BLUE = original_blue

    def test_preserved_geometry_color_validation_ignores_removed_text_only_fill_state(self):
        source = self.directory / "preserved-text-color-source.pdf"
        output = self.directory / "preserved-text-color-output.pdf"
        inspection = self.directory / "preserved-text-color-inspection.json"
        contract_path = self.directory / "preserved-text-color-contract.json"
        audit_path = self.directory / "preserved-text-color-audit.json"
        build_fixture(
            source,
            "4+4",
            preserved_text_only_fill_color=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        source_reader = PdfReader(str(source), strict=True)
        output_reader = PdfReader(str(output), strict=True)
        text_only_source_descriptor = sanitizer.color_descriptor(
            1,
            "Visitenkartentasche",
            b"k",
            [0.0, 0.98, 0.0, 0.0],
        )
        self.assertIn(
            text_only_source_descriptor,
            {
                event["descriptor"] for event in sanitizer.iter_source_events(
                    source_reader
                )
                if event["kind"] == "color"
            },
        )
        self.assertNotIn("Lieferantentext", output_reader.pages[0].extract_text())
        self.assertEqual(
            sanitizer.geometry_inventory(output_reader)["Visitkortlomme"],
            sanitizer.geometry_inventory(source_reader)["Visitenkartentasche"],
        )

    def test_removed_cd_layer_state_still_colors_later_preserved_vector_stroke(self):
        source = self.directory / "removed-cd-state-source.pdf"
        output = self.directory / "removed-cd-state-output.pdf"
        inspection = self.directory / "removed-cd-state-inspection.json"
        contract_path = self.directory / "removed-cd-state-contract.json"
        audit_path = self.directory / "removed-cd-state-audit.json"
        build_fixture(
            source,
            "4+4",
            include_cd_layer=True,
            removed_cd_stroke_state_used_after_layer=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        preserved_strokes = [
            paint
            for paint in sanitizer.device_paint_style_inventory(output_reader)
            if paint["page"] == 1
            and paint["layer"] == "Visitkortlomme"
            and paint["operator"] == "S"
        ]
        self.assertTrue(preserved_strokes)
        self.assertEqual(
            {tuple(paint["stroke"][1]) for paint in preserved_strokes},
            {(0.0, 0.0, 0.0, 1.0), (0.0, 1.0, 0.0, 0.0)},
        )
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )

    def test_removed_cd_extgstate_is_replayed_for_later_preserved_stroke(self):
        source = self.directory / "removed-cd-extgstate-source.pdf"
        output = self.directory / "removed-cd-extgstate-output.pdf"
        inspection = self.directory / "removed-cd-extgstate-inspection.json"
        contract_path = self.directory / "removed-cd-extgstate-contract.json"
        audit_path = self.directory / "removed-cd-extgstate-audit.json"
        build_fixture(
            source,
            "4+4",
            include_cd_layer=True,
            removed_cd_ext_gstate_used_after_layer=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        preserved_stroke_overprint: list[bool] = []
        replay_layers: list[str | None] = []
        for page in output_reader.pages:
            properties = sanitizer.layer_map(page)
            resources = page["/Resources"].get_object()
            ext_gstates = resources["/ExtGState"].get_object()
            layer: str | None = None
            layer_stack: list[str | None] = []
            stroke_overprint = False
            state_stack: list[bool] = []
            for operands, operator in sanitizer.content_operations(
                page, output_reader
            ):
                ocg_name = sanitizer.current_ocg_name(
                    operands, operator, properties
                )
                if operator in (b"BDC", b"BMC"):
                    layer_stack.append(layer)
                    if ocg_name is not None:
                        layer = ocg_name
                    continue
                if operator == b"EMC":
                    layer = layer_stack.pop()
                    continue
                if operator == b"q":
                    state_stack.append(stroke_overprint)
                    continue
                if operator == b"Q":
                    stroke_overprint = state_stack.pop()
                    continue
                if operator == b"gs":
                    state = ext_gstates[operands[0]].get_object()
                    value = state.get("/OP")
                    stroke_overprint = bool(getattr(value, "value", value))
                    if str(operands[0]) == "/GSOverprintOff":
                        replay_layers.append(layer)
                    continue
                if operator == b"S" and layer == "Visitkortlomme":
                    preserved_stroke_overprint.append(stroke_overprint)

        self.assertGreaterEqual(len(preserved_stroke_overprint), 3)
        self.assertEqual(preserved_stroke_overprint[-2:], [True, False])
        self.assertIn("Visitkortlomme", replay_layers)
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )

    def test_removed_cd_partial_extgstates_replay_in_order_and_accumulate(self):
        source = self.directory / "removed-cd-partial-extgstates-source.pdf"
        output = self.directory / "removed-cd-partial-extgstates-output.pdf"
        inspection = (
            self.directory / "removed-cd-partial-extgstates-inspection.json"
        )
        contract_path = (
            self.directory / "removed-cd-partial-extgstates-contract.json"
        )
        audit_path = self.directory / "removed-cd-partial-extgstates-audit.json"
        build_fixture(
            source,
            "4+4",
            include_cd_layer=True,
            removed_cd_partial_ext_gstates_used_after_layer=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        page = output_reader.pages[0]
        properties = sanitizer.layer_map(page)
        resources = page["/Resources"].get_object()
        ext_gstates = resources["/ExtGState"].get_object()
        layer: str | None = None
        layer_stack: list[str | None] = []
        state_stack: list[tuple[float, float]] = []
        line_width = 1.0
        fill_alpha = 1.0
        replay_names: list[str] = []
        preserved_stroke_states: list[tuple[float, float]] = []

        for operands, operator in sanitizer.content_operations(
            page, output_reader
        ):
            ocg_name = sanitizer.current_ocg_name(
                operands, operator, properties
            )
            if operator in (b"BDC", b"BMC"):
                layer_stack.append(layer)
                if ocg_name is not None:
                    layer = ocg_name
                continue
            if operator == b"EMC":
                layer = layer_stack.pop()
                continue
            if operator == b"q":
                state_stack.append((line_width, fill_alpha))
                continue
            if operator == b"Q":
                line_width, fill_alpha = state_stack.pop()
                continue
            if operator == b"w":
                line_width = float(operands[0])
                continue
            if operator == b"gs":
                state_name = str(operands[0])
                state = ext_gstates[operands[0]].get_object()
                if "/LW" in state:
                    line_width = float(state["/LW"])
                if "/ca" in state:
                    fill_alpha = float(state["/ca"])
                if layer == "Visitkortlomme":
                    replay_names.append(state_name)
                continue
            if operator == b"S" and layer == "Visitkortlomme":
                preserved_stroke_states.append((line_width, fill_alpha))

        self.assertEqual(replay_names[-2:], ["/GSWidth", "/GSAlpha"])
        self.assertTrue(preserved_stroke_states)
        self.assertEqual(preserved_stroke_states[-1], (5.0, 0.5))
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )

    def test_malformed_graphics_state_balance_fails_closed(self):
        cases = (
            (
                "Q-underflow",
                "Unbalanced PDF graphics-state restore operator",
            ),
            (
                "leftover-q",
                "Unbalanced PDF text, marked-content, or graphics-state operators",
            ),
        )
        for mode, message in cases:
            with self.subTest(mode=mode):
                source = self.directory / f"malformed-{mode}-source.pdf"
                output = self.directory / f"malformed-{mode}-output.pdf"
                inspection = self.directory / f"malformed-{mode}-inspection.json"
                contract_path = self.directory / f"malformed-{mode}-contract.json"
                audit_path = self.directory / f"malformed-{mode}-audit.json"
                build_fixture(
                    source,
                    "4+4",
                    malformed_graphics_state=mode,
                )
                contract = approved_contract(source, "4+4")
                write_geometry_audit(source, contract, audit_path)
                contract_path.write_text(json.dumps(contract), encoding="utf-8")

                with self.assertRaisesRegex(
                    sanitizer.SalesFolderSanitizationError,
                    message,
                ):
                    sanitizer.run_sanitize(
                        source,
                        output,
                        inspection,
                        contract_path,
                        audit_path,
                    )
                self.assertFalse(output.exists())
                self.assertFalse(inspection.exists())

    def test_removed_cd_layer_keeps_cross_boundary_q_and_Q_balanced(self):
        source = self.directory / "removed-cd-cross-q-source.pdf"
        output = self.directory / "removed-cd-cross-q-output.pdf"
        inspection = self.directory / "removed-cd-cross-q-inspection.json"
        contract_path = self.directory / "removed-cd-cross-q-contract.json"
        audit_path = self.directory / "removed-cd-cross-q-audit.json"
        build_fixture(
            source,
            "4+4",
            include_cd_layer=True,
            removed_cd_cross_boundary_q=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        for page_number, page in enumerate(output_reader.pages, 1):
            depth = 0
            for _operands, operator in sanitizer.content_operations(
                page, output_reader
            ):
                if operator == b"q":
                    depth += 1
                elif operator == b"Q":
                    depth -= 1
                    self.assertGreaterEqual(
                        depth,
                        0,
                        f"Page {page_number} contains a retained Q without q",
                    )
            self.assertEqual(
                depth,
                0,
                f"Page {page_number} ends with an unclosed retained q",
            )
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )

    def test_removed_cd_q_restore_then_magenta_state_replays_to_preserved_stroke(self):
        source = self.directory / "removed-cd-q-restore-magenta-source.pdf"
        output = self.directory / "removed-cd-q-restore-magenta-output.pdf"
        inspection = self.directory / "removed-cd-q-restore-magenta-inspection.json"
        contract_path = self.directory / "removed-cd-q-restore-magenta-contract.json"
        audit_path = self.directory / "removed-cd-q-restore-magenta-audit.json"
        build_fixture(
            source,
            "4+4",
            include_cd_layer=True,
            removed_cd_q_restore_then_stroke_state=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        source_reader = PdfReader(str(source), strict=True)
        source_pocket_strokes = [
            paint
            for paint in sanitizer.device_paint_style_inventory(source_reader)
            if paint["page"] == 1
            and paint["layer"] == "Visitenkartentasche"
            and paint["operator"] == "S"
        ]
        self.assertGreaterEqual(len(source_pocket_strokes), 2)
        self.assertEqual(
            source_pocket_strokes[-1]["stroke"],
            ("K", [0.0, 1.0, 0.0, 0.0]),
        )

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        output_pocket_strokes = [
            paint
            for paint in sanitizer.device_paint_style_inventory(output_reader)
            if paint["page"] == 1
            and paint["layer"] == "Visitkortlomme"
            and paint["operator"] == "S"
        ]
        self.assertGreaterEqual(len(output_pocket_strokes), 2)
        self.assertEqual(
            output_pocket_strokes[-1]["stroke"],
            ("K", [0.0, 1.0, 0.0, 0.0]),
        )

        for label, reader in (("source", source_reader), ("output", output_reader)):
            for page_number, page in enumerate(reader.pages, 1):
                depth = 0
                for _operands, operator in sanitizer.content_operations(
                    page, reader
                ):
                    if operator == b"q":
                        depth += 1
                    elif operator == b"Q":
                        depth -= 1
                        self.assertGreaterEqual(
                            depth,
                            0,
                            f"{label} page {page_number} contains Q without q",
                        )
                self.assertEqual(
                    depth,
                    0,
                    f"{label} page {page_number} ends with an unclosed q",
                )
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )

    def test_removed_cd_same_nondevice_spot_with_different_tint_fails_closed(self):
        source = self.directory / "removed-cd-same-spot-tint-source.pdf"
        output = self.directory / "removed-cd-same-spot-tint-output.pdf"
        inspection = self.directory / "removed-cd-same-spot-tint-inspection.json"
        contract_path = self.directory / "removed-cd-same-spot-tint-contract.json"
        audit_path = self.directory / "removed-cd-same-spot-tint-audit.json"
        build_fixture(
            source,
            "4+4",
            include_cd_layer=True,
            technical_cut_spot=True,
            removed_cd_same_spot_different_tint=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "unsupported non-Device stroke state",
        ):
            sanitizer.run_sanitize(
                source, output, inspection, contract_path, audit_path
            )
        self.assertFalse(output.exists())
        self.assertFalse(inspection.exists())

    def test_removed_text_state_still_colors_later_preserved_vector_stroke(self):
        source = self.directory / "removed-text-state-source.pdf"
        output = self.directory / "removed-text-state-output.pdf"
        inspection = self.directory / "removed-text-state-inspection.json"
        contract_path = self.directory / "removed-text-state-contract.json"
        audit_path = self.directory / "removed-text-state-audit.json"
        build_fixture(
            source,
            "4+4",
            preserved_text_stroke_used_after_text=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        sanitizer.run_sanitize(
            source, output, inspection, contract_path, audit_path
        )

        output_reader = PdfReader(str(output), strict=True)
        colors = sanitizer.reviewed_layer_color_descriptors(
            output_reader, {"Visitkortlomme"}
        )
        self.assertIn(
            sanitizer.color_descriptor(
                1, "Visitkortlomme", b"K", [0.0, 1.0, 0.0, 0.0]
            ),
            colors,
        )
        self.assertNotIn("Lieferantentext", output_reader.pages[0].extract_text())

    def test_real_job1_authors_when_preserved_layer_has_text_only_cmyk_state(self):
        run_root = ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
        job_id = (
            "salgsmappe-a4-2-part-2-flaps-window-4plus0-1mm-"
            "blind-emboss-e7758da8dc0d6017"
        )
        source = run_root / (
            "documents/source-pdfs/32ed944cb17b0814-"
            "mappe_din_a4_2teilig_2laschen_1mm_fenster_40plus_2.pdf"
        )
        contract_path = run_root / f"documents/sanitization-contracts/{job_id}.json"
        audit_path = run_root / "review/template-geometry-audit.json"
        if not all(path.is_file() for path in (source, contract_path, audit_path)):
            self.skipTest("Exact promoted real-job1 evidence is not present")
        self.assertEqual(
            sanitizer.sha256_file(source),
            "e7758da8dc0d601770f31d8a53fd1ecb6d726e28cfd4b6a1fbc4b0f1194e8225",
        )
        output = self.directory / "real-job1-output.pdf"
        inspection = self.directory / "real-job1-inspection.json"

        payload = sanitizer.run_sanitize(
            source,
            output,
            inspection,
            contract_path,
            audit_path,
        )

        source_reader = PdfReader(str(source), strict=True)
        output_reader = PdfReader(str(output), strict=True)
        text_only_descriptor = sanitizer.color_descriptor(
            2,
            "Abheftvorrichtung",
            b"k",
            [0.0, 0.98, 0.0, 0.0],
        )
        self.assertIn(
            text_only_descriptor,
            {
                event["descriptor"] for event in sanitizer.iter_source_events(
                    source_reader
                )
                if event["kind"] == "color"
            },
        )
        self.assertNotIn(
            text_only_descriptor,
            sanitizer.reviewed_layer_color_descriptors(
                source_reader, {"Abheftvorrichtung"}
            ),
        )
        self.assertEqual(
            sanitizer.geometry_inventory(output_reader)["Arkiveringsmekanisme"],
            sanitizer.geometry_inventory(source_reader)["Abheftvorrichtung"],
        )
        self.assertTrue(payload["validation"]["supplierTextAndBrandingRemoved"])
        self.assertTrue(output.is_file())
        self.assertTrue(inspection.is_file())

    def test_real_job2_preserves_cd_layer_state_used_by_later_pocket_guides(self):
        run_root = ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
        job_id = (
            "salgsmappe-a4-2-part-2-flaps-window-4plus0-3mm-"
            "blind-emboss-f5a614958c559ff5"
        )
        source = run_root / (
            "documents/source-pdfs/83f0060636950d5f-"
            "mappe_din_a4_2teilig_2laschen_3mm_fenster_40plus_2.pdf"
        )
        contract_path = run_root / f"documents/sanitization-contracts/{job_id}.json"
        audit_path = run_root / "review/template-geometry-audit.json"
        if not all(path.is_file() for path in (source, contract_path, audit_path)):
            self.skipTest("Exact promoted real-job2 evidence is not present")
        self.assertEqual(
            sanitizer.sha256_file(source),
            "f5a614958c559ff54bc6f7d17d8c8f85463f108526f003d3398957a8241ac470",
        )
        output = self.directory / "real-job2-output.pdf"
        inspection = self.directory / "real-job2-inspection.json"

        payload = sanitizer.run_sanitize(
            source,
            output,
            inspection,
            contract_path,
            audit_path,
        )

        source_reader = PdfReader(str(source), strict=True)
        output_reader = PdfReader(str(output), strict=True)
        colors = sanitizer.reviewed_layer_color_descriptors(
            output_reader,
            {"Kombineret visitkortlomme", "Visitkortlomme"},
        )
        for layer in ("Kombineret visitkortlomme", "Visitkortlomme"):
            self.assertIn(
                sanitizer.color_descriptor(2, layer, b"K", [0.0, 1.0, 0.0, 0.0]),
                colors,
            )
            self.assertNotIn(
                sanitizer.color_descriptor(2, layer, b"K", [1.0, 0.0, 0.0, 0.0]),
                colors,
            )
        self.assertEqual(
            sanitizer.geometry_inventory(output_reader)["Kombineret visitkortlomme"],
            sanitizer.geometry_inventory(source_reader)["Kombi Visitenkartentasche"],
        )
        self.assertEqual(
            sanitizer.geometry_inventory(output_reader)["Visitkortlomme"],
            sanitizer.geometry_inventory(source_reader)["Visitenkartentasche"],
        )
        self.assertNotIn(
            "CD-Tasche",
            {item["name"] for item in sanitizer.output_layer_details(output_reader)},
        )
        self.assertNotIn(b"cd-tasche", sanitizer.decoded_pdf_bytes(output_reader).lower())
        self.assertTrue(payload["validation"]["supplierTextAndBrandingRemoved"])

    def test_real_a6_blind_emboss_information_text_fits_exact_reviewed_panel(self):
        run_root = ROOT / "tmp/supplier-imports/wmd-sales-folders-20260831-full"
        job_id = (
            "salgsmappe-a6-2-part-closure-4plus4-1mm-"
            "blind-emboss-251449430aa0a690"
        )
        source = run_root / (
            "documents/source-pdfs/27d57ed9e6444a60-"
            "mappe_din_a6_3laschen_verschluss_1mm_44plus_2.pdf"
        )
        contract_path = run_root / f"documents/sanitization-contracts/{job_id}.json"
        if not all(path.is_file() for path in (source, contract_path)):
            self.skipTest("Exact promoted A6 blind-emboss evidence is not present")
        self.assertEqual(
            sanitizer.sha256_file(source),
            "251449430aa0a69083e44999745156969be17696d61354cb43012e11b43046db",
        )
        self.assertEqual(
            sanitizer.sha256_file(contract_path),
            "130cf37fa3362e55961495b8473d63cb8be6e8e00a300f422b0e028ec9e3e635",
        )

        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        panel = contract["informationPanels"][0]
        self.assertEqual(
            panel,
            {"page": 1, "rectPt": [241.6535, 484.466, 180.0, 186.104]},
        )
        source_reader = PdfReader(str(source), strict=True)
        first_page = source_reader.pages[0]
        overlay = sanitizer.create_info_overlay(
            float(first_page.mediabox.width),
            float(first_page.mediabox.height),
            panel["rectPt"],
            contract["geometry"],
            contract["finishKey"],
            contract["productionMeasurements"],
            contract["finishInstructions"],
            contract["professionalUploadWarningDa"],
        )

        output = self.directory / "a6-blind-emboss-contained-panel.pdf"
        writer = PdfWriter()
        for page_number, source_page in enumerate(source_reader.pages, 1):
            output_page = writer.add_blank_page(
                width=float(source_page.mediabox.width),
                height=float(source_page.mediabox.height),
            )
            for box_name in (
                "mediabox", "cropbox", "bleedbox", "trimbox", "artbox"
            ):
                setattr(
                    output_page,
                    box_name,
                    RectangleObject([
                        float(value) for value in getattr(source_page, box_name)
                    ]),
                )
            if page_number == panel["page"]:
                output_page.merge_page(overlay, expand=False)
        with output.open("wb") as handle:
            writer.write(handle)

        output_reader = PdfReader(str(output), strict=True)
        self.assertEqual(
            sanitizer.page_box_inventory(output_reader),
            sanitizer.page_box_inventory(source_reader),
        )
        bounds = sanitizer.verify_information_text_containment(
            output, contract["informationPanels"]
        )
        self.assertEqual(len(bounds), 1)
        x, y, width, height = panel["rectPt"]
        measured = bounds[0]["measuredTextBoundsPt"]
        self.assertGreaterEqual(measured[0], x)
        self.assertGreaterEqual(measured[1], y)
        self.assertLessEqual(measured[2], x + width)
        self.assertLessEqual(measured[3], y + height)

        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "Danish information text does not fit inside reviewed panel rectangle",
        ):
            sanitizer.create_info_overlay(
                float(first_page.mediabox.width),
                float(first_page.mediabox.height),
                [x, y, width, 50.0],
                contract["geometry"],
                contract["finishKey"],
                contract["productionMeasurements"],
                contract["finishInstructions"],
                contract["professionalUploadWarningDa"],
            )

    def test_rejects_german_vocabulary_hidden_in_reachable_nontext_objects(self):
        source = self.directory / "hidden-german-resource-source.pdf"
        contract_path = self.directory / "hidden-german-resource-contract.json"
        audit_path = self.directory / "hidden-german-resource-audit.json"
        build_fixture(source, "4+4", hidden_german_resource=True)
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "German or supplier vocabulary remains in reachable PDF objects",
        ):
            sanitizer.run_sanitize(
                source,
                self.directory / "hidden-german-resource-output.pdf",
                self.directory / "hidden-german-resource-inspection.json",
                contract_path,
                audit_path,
            )

    def test_danish_magnetpunkter_does_not_hide_exact_magnetpunkte_leak(self):
        source = self.directory / "magnetpunkte-prefix-source.pdf"
        contract_path = self.directory / "magnetpunkte-prefix-contract.json"
        audit_path = self.directory / "magnetpunkte-prefix-audit.json"
        build_fixture(
            source,
            "4+4",
            include_magnetpunkte_layer=True,
        )
        contract = approved_contract(source, "4+4")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        valid_output = self.directory / "magnetpunkter-valid-output.pdf"
        valid_inspection = self.directory / "magnetpunkter-valid-inspection.json"
        sanitizer.run_sanitize(
            source,
            valid_output,
            valid_inspection,
            contract_path,
            audit_path,
        )
        valid_reader = PdfReader(str(valid_output), strict=True)
        self.assertIn(
            "Magnetpunkter",
            {item["name"] for item in sanitizer.output_layer_details(valid_reader)},
        )

        original_set_ocproperties = sanitizer.set_ocproperties

        def embed_exact_source_name(writer, refs):
            original_set_ocproperties(writer, refs)
            writer._root_object[NameObject("/LayerLeakProbe")] = TextStringObject(
                "Magnetpunkte"
            )

        leaked_output = self.directory / "magnetpunkte-exact-leak-output.pdf"
        leaked_inspection = self.directory / "magnetpunkte-exact-leak-inspection.json"
        with mock.patch.object(
            sanitizer,
            "set_ocproperties",
            side_effect=embed_exact_source_name,
        ), self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            r"German or removed source OCG names remain embedded: \['Magnetpunkte'\]",
        ):
            sanitizer.run_sanitize(
                source,
                leaked_output,
                leaked_inspection,
                contract_path,
                audit_path,
            )
        self.assertFalse(leaked_output.exists())
        self.assertFalse(leaked_inspection.exists())

    def test_output_glyph_measurement_catches_panel_shift_independently(self):
        source = self.directory / "shifted-panel-source.pdf"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        audit_path = self.directory / "shifted-panel-audit.json"
        write_geometry_audit(source, contract, audit_path)
        contract_path = self.directory / "shifted-panel-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        original_create = sanitizer.create_info_overlay

        def create_shifted(
            page_width,
            page_height,
            rect,
            geometry,
            finish_key,
            measurements,
            finish_instructions,
            professional_upload_warning_da,
        ):
            return original_create(
                page_width,
                page_height,
                [10, rect[1], rect[2], rect[3]],
                geometry,
                finish_key,
                measurements,
                finish_instructions,
                professional_upload_warning_da,
            )

        try:
            sanitizer.create_info_overlay = create_shifted
            with self.assertRaisesRegex(
                sanitizer.SalesFolderSanitizationError,
                "glyph escaped reviewed panel rectangle",
            ):
                sanitizer.run_sanitize(
                    source,
                    self.directory / "shifted-panel-output.pdf",
                    self.directory / "shifted-panel-inspection.json",
                    contract_path,
                    audit_path,
                )
        finally:
            sanitizer.create_info_overlay = original_create

    def test_spot_finish_preserves_painted_colorant_and_source_bound_danish_rules(self):
        source = self.directory / "spot-source.pdf"
        output = self.directory / "spot-output.pdf"
        inspection = self.directory / "spot-inspection.json"
        contract_path = self.directory / "spot-contract.json"
        audit_path = self.directory / "spot-audit.json"
        build_fixture(source, "4+4", spot_color=True)
        contract = approved_contract(source, "4+4", "partial-uv")
        write_geometry_audit(source, contract, audit_path)
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        payload = sanitizer.run_sanitize(source, output, inspection, contract_path, audit_path)

        self.assertTrue(payload["validation"]["spotFinishPaintUsagePreserved"])
        usage = sanitizer.spot_paint_usage(PdfReader(str(output), strict=True))
        self.assertTrue(any(
            item["colorant"] == sanitizer.SPOT_COLORANT_OUTPUT_NAMES["lack"]
            and item["layer"] == "Efterbehandling"
            for item in usage
        ))
        text = sanitizer.normalized_extracted_text(PdfReader(str(output), strict=True))
        self.assertIn("Mindste elementstørrelse er 2 mm", text)
        self.assertNotIn("Mindestgroesse", text)

    def test_refuses_declared_but_unpainted_spot_finish_and_incomplete_finish_rules(self):
        unpainted = self.directory / "unpainted-spot.pdf"
        build_fixture(unpainted, "4+4", spot_color=True, paint_spot=False)
        unpainted_contract = approved_contract(unpainted, "4+4", "partial-uv")
        unpainted_audit = self.directory / "unpainted-audit.json"
        write_geometry_audit(unpainted, unpainted_contract, unpainted_audit)
        unpainted_contract_path = self.directory / "unpainted-contract.json"
        unpainted_contract_path.write_text(json.dumps(unpainted_contract), encoding="utf-8")
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "no reviewed painted usage",
        ):
            sanitizer.run_sanitize(
                unpainted,
                self.directory / "unpainted-output.pdf",
                self.directory / "unpainted-inspection.json",
                unpainted_contract_path,
                unpainted_audit,
            )

        incomplete = self.directory / "incomplete-spot.pdf"
        build_fixture(incomplete, "4+4", spot_color=True)
        incomplete_contract = approved_contract(incomplete, "4+4", "partial-uv")
        incomplete_contract["finishInstructions"] = incomplete_contract["finishInstructions"][:-1]
        incomplete_audit = self.directory / "incomplete-audit.json"
        write_geometry_audit(incomplete, incomplete_contract, incomplete_audit)
        incomplete_contract_path = self.directory / "incomplete-contract.json"
        incomplete_contract_path.write_text(json.dumps(incomplete_contract), encoding="utf-8")
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "Danish instructions are incomplete",
        ):
            sanitizer.run_sanitize(
                incomplete,
                self.directory / "incomplete-output.pdf",
                self.directory / "incomplete-inspection.json",
                incomplete_contract_path,
                incomplete_audit,
            )

    def test_refuses_non_red_pink_no_print_fill_even_when_exact_path_is_allowlisted(self):
        source = self.directory / "black-no-print-source.pdf"
        build_fixture(source, "4+0")
        contract = approved_contract(source, "4+0")
        black_objects = [
            item for item in contract["sourceEvidence"]["fillPaintObjects"]
            if item["page"] == 1
            and item["layer"] == "Visitenkartentasche"
            and item["operator"] == "k"
            and item["operands"] == [0.0, 0.0, 0.0, 1.0]
        ]
        self.assertEqual(len(black_objects), 1)
        contract["colors"]["noPrintAreas"].append({
            "page": 1,
            "layer": "Visitenkartentasche",
            "operator": "k",
            "operands": [0, 0, 0, 1],
            "pathSha256s": [black_objects[0]["pathSha256"]],
            "expectedPaintCount": 1,
            "fullPage": False,
            "replacementHex": "#D1D5DB",
        })
        audit_path = self.directory / "black-no-print-audit.json"
        write_geometry_audit(source, contract, audit_path)
        contract_path = self.directory / "black-no-print-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "exact reviewed red/pink Device fill",
        ):
            sanitizer.run_sanitize(
                source,
                self.directory / "black-no-print-output.pdf",
                self.directory / "black-no-print-inspection.json",
                contract_path,
                audit_path,
            )

    def test_refuses_unreviewed_contract_source_layer_color_text_safety_spot_and_no_print_mismatches(self):
        source = self.directory / "source.pdf"
        build_fixture(source, "4+0")
        original = approved_contract(source, "4+0")
        audit_path = self.directory / "refusal-audit.json"
        write_geometry_audit(source, original, audit_path)
        cases = []

        value = copy.deepcopy(original); value["reviewState"] = "candidate_requires_human_review"
        cases.append(("unreviewed", value, "not been explicitly approved"))
        value = copy.deepcopy(original); value["sourceEvidence"]["sha256"] = "0" * 64
        cases.append(("source", value, "source evidence changed: sha256"))
        value = copy.deepcopy(original); value["geometry"]["spineMm"] = 10
        cases.append(("geometry", value, "Geometry-audit tuple differs"))
        value = copy.deepcopy(original); value["layers"] = value["layers"][:-1]
        cases.append(("layer", value, "Layer contract mismatch"))
        value = copy.deepcopy(original)
        next(item for item in value["layers"] if item["name"] == "Rillen")["outputNameDa"] = "Rillen"
        cases.append(("german-layer-name", value, "standard Danish name Falselinjer"))
        value = copy.deepcopy(original)
        next(item for item in value["layers"] if item["name"] == "Schneiden").update({
            "action": "remove", "role": "supplier-information", "outputNameDa": None,
        })
        cases.append(("structural-layer-removal", value, "Structural layer Schneiden cannot be removed"))
        value = copy.deepcopy(original); value["colors"]["allowedDescriptors"] = value["colors"]["allowedDescriptors"][:-1]
        cases.append(("color", value, "source color descriptor"))
        value = copy.deepcopy(original); value["sourceText"]["sha256"] = "1" * 64
        cases.append(("text", value, "source text fingerprint"))
        value = copy.deepcopy(original)
        for item in value["layers"]:
            if item["role"] == "bleed-and-safety": item["role"] = "technical"
        cases.append(("safety", value, "Missing required bleed geometry"))
        value = copy.deepcopy(original); value["finishKey"] = "hot-foil-gold"
        cases.append(("spot", value, "Geometry-audit finish differs"))
        value = copy.deepcopy(original); value["colors"]["noPrintAreas"] = []
        cases.append((
            "noprint",
            value,
            "requires a reviewed converted or generated full-page no-print area",
        ))

        for name, contract, message in cases:
            with self.subTest(name=name):
                contract_path = self.directory / f"{name}.json"
                contract_path.write_text(json.dumps(contract), encoding="utf-8")
                with self.assertRaisesRegex(sanitizer.SalesFolderSanitizationError, message):
                    sanitizer.run_sanitize(
                        source,
                        self.directory / f"refusal-{name}.pdf",
                        self.directory / f"{name}-inspection.json",
                        contract_path,
                        audit_path,
                    )

    def test_refuses_one_path_for_pdf_and_json_outputs(self):
        source = self.directory / "same-path-source.pdf"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        audit_path = self.directory / "same-path-audit.json"
        write_geometry_audit(source, contract, audit_path)
        contract_path = self.directory / "same-path-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        collision = self.directory / "same-path-output"
        with self.assertRaisesRegex(sanitizer.SalesFolderSanitizationError, "must be pairwise distinct"):
            sanitizer.run_sanitize(source, collision, collision, contract_path, audit_path)
        self.assertFalse(collision.exists())

    def test_refuses_source_with_missing_safety_vectors_even_when_contract_claims_safety_role(self):
        source = self.directory / "missing-safety.pdf"
        build_fixture(source, "4+0", safety_path=False)
        contract = approved_contract(source, "4+0")
        audit_path = self.directory / "missing-safety-audit.json"
        write_geometry_audit(source, contract, audit_path)
        contract_path = self.directory / "missing-safety.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        with self.assertRaisesRegex(sanitizer.SalesFolderSanitizationError, "Required bleed layer contains no stroked vector path geometry"):
            sanitizer.run_sanitize(
                source,
                self.directory / "missing-safety-output.pdf",
                self.directory / "missing-safety-inspection.json",
                contract_path,
                audit_path,
            )

    def test_refuses_binding_that_geometry_audit_quarantined(self):
        source = self.directory / "blocked-source.pdf"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        audit_path = self.directory / "blocked-audit.json"
        write_geometry_audit(source, contract, audit_path, verified=False)
        contract_path = self.directory / "blocked-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        with self.assertRaisesRegex(sanitizer.SalesFolderSanitizationError, "blocked or not sanitizer-ready"):
            sanitizer.run_sanitize(
                source,
                self.directory / "blocked-output.pdf",
                self.directory / "blocked-inspection.json",
                contract_path,
                audit_path,
            )

    def test_accepts_only_independently_hashed_title_error_geometry_supplement(self):
        source = self.directory / "supplement-source.pdf"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        audit_path = self.directory / "supplement-base-audit.json"
        write_geometry_audit(
            source,
            contract,
            audit_path,
            verified=False,
            blocker_codes=[
                "PDF_TEXT_CONSTRUCTION_MISMATCH",
                "CONSTRUCTION_SOURCE_CONFLICT",
            ],
        )
        supplement_path = self.directory / "geometry-supplement.json"
        write_geometry_supplement(source, contract, audit_path, supplement_path)
        contract_path = self.directory / "supplement-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        payload = sanitizer.run_sanitize(
            source,
            self.directory / "supplement-output.pdf",
            self.directory / "supplement-inspection.json",
            contract_path,
            audit_path,
            supplement_path,
        )

        self.assertEqual(
            payload["geometrySupplementSha256"],
            sanitizer.sha256_file(supplement_path),
        )
        self.assertEqual(
            payload["geometrySupplementEntrySha256"],
            contract["geometrySupplement"]["entrySha256"],
        )
        self.assertFalse(payload["eligibleForImport"])

    def test_geometry_supplement_cannot_override_print_or_third_blocker(self):
        for blocker_codes in (
            ["PDF_TEXT_PRINT_MISMATCH"],
            [
                "PDF_TEXT_CONSTRUCTION_MISMATCH",
                "CONSTRUCTION_SOURCE_CONFLICT",
                "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES",
            ],
        ):
            with self.subTest(blocker_codes=blocker_codes):
                suffix = str(len(blocker_codes))
                source = self.directory / f"supplement-refusal-{suffix}.pdf"
                build_fixture(source, "4+4")
                contract = approved_contract(source, "4+4")
                audit_path = self.directory / f"supplement-refusal-audit-{suffix}.json"
                write_geometry_audit(
                    source,
                    contract,
                    audit_path,
                    verified=False,
                    blocker_codes=blocker_codes,
                )
                supplement_path = self.directory / f"supplement-refusal-{suffix}.json"
                write_geometry_supplement(source, contract, audit_path, supplement_path)
                contract_path = self.directory / f"supplement-refusal-contract-{suffix}.json"
                contract_path.write_text(json.dumps(contract), encoding="utf-8")
                with self.assertRaisesRegex(
                    sanitizer.SalesFolderSanitizationError,
                    "cannot override print, spine, reuse, or non-title blockers",
                ):
                    sanitizer.run_sanitize(
                        source,
                        self.directory / f"supplement-refusal-output-{suffix}.pdf",
                        self.directory / f"supplement-refusal-inspection-{suffix}.json",
                        contract_path,
                        audit_path,
                        supplement_path,
                    )

    def test_accepts_only_fully_approved_hash_pinned_exact_verified_rebind_plan(self):
        source = self.directory / "resolution-source.pdf"
        output = self.directory / "resolution-output.pdf"
        inspection = self.directory / "resolution-inspection.json"
        contract_path = self.directory / "resolution-contract.json"
        audit_path = self.directory / "resolution-audit.json"
        plan_path = self.directory / "resolution-plan.json"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        target, resolved = write_resolution_audit(source, contract, audit_path)
        plan = write_approved_resolution_plan(
            contract, audit_path, plan_path, target, resolved
        )
        contract_path.write_text(json.dumps(contract), encoding="utf-8")

        payload = sanitizer.run_sanitize(
            source,
            output,
            inspection,
            contract_path,
            audit_path,
            None,
            plan_path,
        )

        self.assertTrue(output.is_file())
        self.assertEqual(
            payload["templateResolutionPlanSha256"],
            sanitizer.sha256_file(plan_path),
        )
        self.assertEqual(
            payload["templateResolutionPlanEntrySha256"],
            sanitizer.sha256_json(plan["bindingClassifications"][0]),
        )
        self.assertEqual(
            payload["templateResolutionPlanVerdict"], "exact_verified_rebind"
        )
        self.assertEqual(
            payload["templateResolutionPlanResolvedBindingKey"], resolved["bindingKey"]
        )
        self.assertEqual(payload["geometryAuditBindingKey"], target["bindingKey"])
        self.assertIsNone(payload["geometrySupplementSha256"])
        self.assertFalse(payload["eligibleForImport"])

    def test_batch_validation_cache_revalidates_contract_and_rehashes_all_inputs(self):
        source = self.directory / "cache-source.pdf"
        audit_path = self.directory / "cache-audit.json"
        plan_path = self.directory / "cache-plan.json"
        build_fixture(source, "4+4")
        contract = approved_contract(source, "4+4")
        target, resolved = write_resolution_audit(source, contract, audit_path)
        write_approved_resolution_plan(
            contract, audit_path, plan_path, target, resolved
        )
        cache = sanitizer.BatchValidationCache()

        first = sanitizer.validate_contract(
            copy.deepcopy(contract),
            source,
            audit_path,
            None,
            plan_path,
            validation_cache=cache,
        )
        second = sanitizer.validate_contract(
            copy.deepcopy(contract),
            source,
            audit_path,
            None,
            plan_path,
            validation_cache=cache,
        )
        self.assertEqual(first, second)
        self.assertEqual(len(cache._resolution_plans), 1)
        _plan_bytes, _plan_sha, cached_plan = cache.read_json(
            plan_path, "Template-resolution plan"
        )
        with self.assertRaisesRegex(TypeError, "immutable"):
            cached_plan["reviewState"] = "pending_review"
        with self.assertRaisesRegex(TypeError, "immutable"):
            cached_plan["bindingClassifications"][0]["reason"] = "poisoned"

        bad_contract = copy.deepcopy(contract)
        bad_contract["informationPanels"][0]["rectPt"][2] = 1
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "Information panel is too small",
        ):
            sanitizer.validate_contract(
                bad_contract,
                source,
                audit_path,
                None,
                plan_path,
                validation_cache=cache,
            )

        original_plan = plan_path.read_bytes()
        tampered_plan = original_plan.replace(
            b'"reviewState": "approved"', b'"reviewState": "approveD"', 1
        )
        self.assertEqual(len(tampered_plan), len(original_plan))
        self.assertNotEqual(tampered_plan, original_plan)
        plan_path.write_bytes(tampered_plan)
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "report SHA-256 differs",
        ):
            sanitizer.validate_contract(
                copy.deepcopy(contract),
                source,
                audit_path,
                None,
                plan_path,
                validation_cache=cache,
            )
        plan_path.write_bytes(original_plan)

        original_audit = audit_path.read_bytes()
        tampered_audit = original_audit.replace(b"target.html", b"targeT.html", 1)
        self.assertEqual(len(tampered_audit), len(original_audit))
        self.assertNotEqual(tampered_audit, original_audit)
        audit_path.write_bytes(tampered_audit)
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "Geometry-audit report SHA-256 differs",
        ):
            sanitizer.validate_contract(
                copy.deepcopy(contract),
                source,
                audit_path,
                None,
                plan_path,
                validation_cache=cache,
            )
        audit_path.write_bytes(original_audit)

        original_source = source.read_bytes()
        tampered_source = original_source.replace(b"WIRmachenDRUCK", b"XIRmachenDRUCK", 1)
        self.assertEqual(len(tampered_source), len(original_source))
        self.assertNotEqual(tampered_source, original_source)
        source.write_bytes(tampered_source)
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "source PDF|source evidence|template SHA-256",
        ):
            sanitizer.validate_contract(
                copy.deepcopy(contract),
                source,
                audit_path,
                None,
                plan_path,
                validation_cache=cache,
            )

    def test_cd_scoped_projection_accepts_only_exact_3744_to_3692_evidence(self):
        plan_path, report, evidence, stubs_path = write_cd_scoped_projection_fixture(
            self.directory
        )
        scoped = sanitizer.validate_cd_scoped_projection(
            copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_CATALOG),
            copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_SOURCE_PROJECTION),
            report,
            evidence,
            plan_path,
        )
        self.assertEqual(len(scoped["rawBindingKeys"]), 3744)
        self.assertEqual(len(scoped["proposedBindingKeys"]), 3692)
        self.assertEqual(len(scoped["excludedBindingKeys"]), 52)
        self.assertTrue(all(
            "cdverpackung" in key for key in scoped["excludedBindingKeys"]
        ))

        approved_package = plan_path.parent / "approved-template-package"
        approved_package.mkdir()
        approved_plan_path = approved_package / "template-resolution-plan.json"
        approved_plan_path.write_bytes(plan_path.read_bytes())
        approved_scoped = sanitizer.validate_cd_scoped_projection(
            copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_CATALOG),
            copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_SOURCE_PROJECTION),
            report,
            evidence,
            approved_plan_path,
        )
        self.assertEqual(
            approved_scoped["proposedBindingKeys"], scoped["proposedBindingKeys"]
        )

        arbitrary_package = plan_path.parent / "not-approved"
        arbitrary_package.mkdir()
        arbitrary_plan_path = arbitrary_package / "template-resolution-plan.json"
        arbitrary_plan_path.write_bytes(plan_path.read_bytes())
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "exact pending or approved review path",
        ):
            sanitizer.validate_cd_scoped_projection(
                copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_CATALOG),
                copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_SOURCE_PROJECTION),
                report,
                evidence,
                arbitrary_plan_path,
            )

        ordered_bindings = sorted(scoped["proposedBindingKeys"])
        classifications = []
        for classification, count in sanitizer.CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED.items():
            classifications.extend([classification] * count)
        entry_by_binding = {
            binding_key: {
                "selectionKey": scoped["stubByBinding"][binding_key]["selectionKey"],
                "classification": classifications[index],
            }
            for index, binding_key in enumerate(ordered_bindings)
        }
        extended_index = {"familyCount": 4, "coveredBindings": set()}
        sanitizer.validate_scoped_resolution_coverage(
            scoped,
            entry_by_binding,
            copy.deepcopy(sanitizer.CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED),
            extended_index,
        )

        mutated_catalog = copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_CATALOG)
        mutated_catalog["rawSupplierEvidenceMutated"] = True
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "exact approved CD-model/CD-Tasche exclusion",
        ):
            sanitizer.validate_cd_scoped_projection(
                mutated_catalog,
                copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_SOURCE_PROJECTION),
                report,
                evidence,
                plan_path,
            )

        mutated_scope = copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_SOURCE_PROJECTION)
        mutated_scope["excludedBindingCount"] = 53
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "immutable 3744-to-3692 CD exclusion",
        ):
            sanitizer.validate_cd_scoped_projection(
                copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_CATALOG),
                mutated_scope,
                report,
                evidence,
                plan_path,
            )

        missing_entry = copy.deepcopy(entry_by_binding)
        missing_entry.pop(ordered_bindings[0])
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "exactly audit minus the 52 CD bindings",
        ):
            sanitizer.validate_scoped_resolution_coverage(
                scoped,
                missing_entry,
                copy.deepcopy(sanitizer.CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED),
                extended_index,
            )

        wrong_selection = copy.deepcopy(entry_by_binding)
        wrong_selection[ordered_bindings[0]]["selectionKey"] = "folder_model=wrong"
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "differs from its exact proposed stub",
        ):
            sanitizer.validate_scoped_resolution_coverage(
                scoped,
                wrong_selection,
                copy.deepcopy(sanitizer.CD_SCOPE_CLASSIFICATION_COUNTS_PROPOSED),
                extended_index,
            )

        lines = stubs_path.read_text(encoding="utf-8").splitlines()
        substituted_stub = json.loads(lines[0])
        excluded_audit = next(
            row for row in report["bindingAudits"]
            if row["bindingKey"] in scoped["excludedBindingKeys"]
        )
        substituted_stub["sourceBinding"]["sourceUrl"] = excluded_audit["sourceUrl"]
        substituted_stub["sourceBinding"]["materialId"] = excluded_audit["materialId"]
        lines[0] = json.dumps(substituted_stub, separators=(",", ":"))
        stubs_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        substituted_evidence = {
            **evidence,
            "sha256": sanitizer.sha256_file(stubs_path),
            "bytes": len(stubs_path.read_bytes()),
        }
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "differs from its immutable base-audit binding",
        ):
            sanitizer.validate_cd_scoped_projection(
                copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_CATALOG),
                copy.deepcopy(sanitizer.CD_SCOPE_EXPECTED_SOURCE_PROJECTION),
                report,
                substituted_evidence,
                plan_path,
            )

    def test_extended_fingerprint_index_preserves_reviewed_numeric_spine_order(self):
        expected = [
            {
                "targetKey": "a4|2-part-2-flaps|4+4|3mm|blind-emboss|source",
                "entrySha256": "3" * 64,
            },
            {
                "targetKey": "a4|2-part-2-flaps|4+4|5mm|blind-emboss|source",
                "entrySha256": "5" * 64,
            },
            {
                "targetKey": "a4|2-part-2-flaps|4+4|10mm|blind-emboss|source",
                "entrySha256": "a" * 64,
            },
        ]
        sanitizer.validate_exact_fingerprint_sequence(
            copy.deepcopy(expected),
            expected,
            {"targetKey", "entrySha256"},
        )

        lexical_order = sorted(expected, key=lambda item: item["targetKey"])
        self.assertNotEqual(lexical_order, expected)
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "family or target fingerprints drifted",
        ):
            sanitizer.validate_exact_fingerprint_sequence(
                lexical_order,
                expected,
                {"targetKey", "entrySha256"},
            )

        tampered = copy.deepcopy(expected)
        tampered[1]["entrySha256"] = "0" * 64
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "family or target fingerprints drifted",
        ):
            sanitizer.validate_exact_fingerprint_sequence(
                tampered,
                expected,
                {"targetKey", "entrySha256"},
            )

        duplicate_key = copy.deepcopy(expected)
        duplicate_key[1]["targetKey"] = duplicate_key[0]["targetKey"]
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "family or target fingerprints drifted",
        ):
            sanitizer.validate_exact_fingerprint_sequence(
                duplicate_key,
                expected,
                {"targetKey", "entrySha256"},
            )

    def test_resolution_plan_refuses_fingerprint_and_approved_hash_drift(self):
        for field, message in (
            ("bindingClassificationFingerprints", "classification fingerprints drifted"),
            ("approvedEntryHashes", "approvedEntryHashes do not exactly match"),
        ):
            with self.subTest(field=field):
                source = self.directory / f"{field}-source.pdf"
                build_fixture(source, "4+4")
                contract = approved_contract(source, "4+4")
                audit_path = self.directory / f"{field}-audit.json"
                plan_path = self.directory / f"{field}-plan.json"
                target, resolved = write_resolution_audit(source, contract, audit_path)
                plan = write_approved_resolution_plan(
                    contract, audit_path, plan_path, target, resolved
                )
                if field == "bindingClassificationFingerprints":
                    plan[field][0]["entrySha256"] = "0" * 64
                else:
                    plan[field][0] = "0" * 64
                plan_path.write_text(json.dumps(plan), encoding="utf-8")
                contract["templateResolutionPlan"]["reportSha256"] = (
                    sanitizer.sha256_file(plan_path)
                )
                contract_path = self.directory / f"{field}-contract.json"
                contract_path.write_text(json.dumps(contract), encoding="utf-8")
                with self.assertRaisesRegex(
                    sanitizer.SalesFolderSanitizationError,
                    message,
                ):
                    sanitizer.run_sanitize(
                        source,
                        self.directory / f"{field}-output.pdf",
                        self.directory / f"{field}-inspection.json",
                        contract_path,
                        audit_path,
                        None,
                        plan_path,
                    )

    def test_resolution_plan_refuses_pending_drift_wrong_axes_source_ambiguity_alias_and_extra_blocker(self):
        cases = [
            (
                "pending-plan",
                lambda plan: plan.update({"reviewState": "pending_review"}),
                None,
                "pending, malformed, or not approved",
                False,
            ),
            (
                "pending-entry",
                lambda plan: plan["bindingClassifications"][0].update(
                    {"entryReviewState": "pending_review"}
                ),
                None,
                "is not approved",
                False,
            ),
            (
                "wrong-geometry",
                lambda plan: plan["bindingClassifications"][0].update(
                    {"expectedGeometryKey": "a4|2-part-2-flaps|4+4|10mm"}
                ),
                None,
                "target geometry or finish differs",
                False,
            ),
            (
                "wrong-finish",
                lambda plan: plan["bindingClassifications"][0].update(
                    {"finishKey": "matt-lamination"}
                ),
                None,
                "target geometry or finish differs",
                False,
            ),
            (
                "wrong-source",
                lambda plan: plan["bindingClassifications"][0]["newTemplate"].update(
                    {"sha256": "8" * 64}
                ),
                None,
                "resolved source URL/path/hash differs",
                False,
            ),
            (
                "ambiguous",
                lambda plan: plan["bindingClassifications"][0]["ambiguityResult"].update(
                    {"candidateTemplateIdentityCount": 2}
                ),
                None,
                "ambiguity was not resolved",
                False,
            ),
            (
                "alias-not-quarantined",
                lambda plan: plan["bindingClassifications"][0]["aliasQuarantineResult"].update(
                    {"quarantinedBindingKeys": []}
                ),
                None,
                "exact verified rebind drifted",
                False,
            ),
            (
                "extra-blocker",
                None,
                sorted(sanitizer.REUSED_SPINE_ALIAS_BLOCKERS | {"PDF_TEXT_PRINT_MISMATCH"}),
                "exact verified rebind drifted",
                False,
            ),
            (
                "report-byte-drift",
                None,
                None,
                "report SHA-256 differs",
                True,
            ),
        ]
        for name, mutate, blocker_codes, message, drift_file in cases:
            with self.subTest(name=name):
                source = self.directory / f"{name}-source.pdf"
                output = self.directory / f"{name}-output.pdf"
                inspection = self.directory / f"{name}-inspection.json"
                contract_path = self.directory / f"{name}-contract.json"
                audit_path = self.directory / f"{name}-audit.json"
                plan_path = self.directory / f"{name}-plan.json"
                build_fixture(source, "4+4")
                contract = approved_contract(source, "4+4")
                target, resolved = write_resolution_audit(
                    source,
                    contract,
                    audit_path,
                    target_blocker_codes=blocker_codes,
                )
                write_approved_resolution_plan(
                    contract,
                    audit_path,
                    plan_path,
                    target,
                    resolved,
                    mutate=mutate,
                )
                contract_path.write_text(json.dumps(contract), encoding="utf-8")
                if drift_file:
                    plan_path.write_bytes(plan_path.read_bytes() + b"\n")
                with self.assertRaisesRegex(
                    sanitizer.SalesFolderSanitizationError, message
                ):
                    sanitizer.run_sanitize(
                        source,
                        output,
                        inspection,
                        contract_path,
                        audit_path,
                        None,
                        plan_path,
                    )
                self.assertFalse(output.exists())
                self.assertFalse(inspection.exists())

    def test_describe_mode_is_read_only_and_never_self_approves(self):
        source = self.directory / "describe-source.pdf"
        build_fixture(source, "4+4")
        candidate = sanitizer.describe_source(source, {
            "format": "a4",
            "construction": "2-part-2-flaps",
            "print": "4+4",
            "spineMm": 3,
        }, "none")
        self.assertEqual(candidate["reviewState"], "candidate_requires_human_review")
        self.assertTrue(all(item["action"] == "REVIEW_REQUIRED" for item in candidate["layers"]))
        self.assertTrue(all(item["outputNameDa"] == "REVIEW_REQUIRED" for item in candidate["layers"]))
        self.assertEqual(candidate["productionMeasurements"], {"bleedMm": 5.0, "safetyMm": 3.0})
        self.assertEqual(candidate["sourceEvidence"]["sha256"], sanitizer.sha256_file(source))

    def test_refuses_symlinked_source_before_reserving_outputs(self):
        source = self.directory / "regular-source.pdf"
        build_fixture(source, "4+4")
        linked_source = self.directory / "linked-source.pdf"
        linked_source.symlink_to(source)
        contract = approved_contract(source, "4+4")
        audit_path = self.directory / "linked-source-audit.json"
        write_geometry_audit(source, contract, audit_path)
        contract_path = self.directory / "linked-source-contract.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        output = self.directory / "linked-source-output.pdf"
        inspection = self.directory / "linked-source-inspection.json"
        with self.assertRaisesRegex(
            sanitizer.SalesFolderSanitizationError,
            "regular non-symlink file",
        ):
            sanitizer.run_sanitize(
                linked_source,
                output,
                inspection,
                contract_path,
                audit_path,
            )
        self.assertFalse(output.exists())
        self.assertFalse(inspection.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
