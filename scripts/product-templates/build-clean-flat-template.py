#!/usr/bin/env python3
"""Build a metadata-free flat-print template with nonprinting vector guides."""

from __future__ import annotations

import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf._page import PageObject
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


PT_PER_MM = 72 / 25.4


def mm(value: float) -> float:
    return value * PT_PER_MM


def pdf_number(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".")


def rectangle_path(x: float, y: float, width: float, height: float) -> str:
    return " ".join(
        [
            pdf_number(x),
            pdf_number(y),
            pdf_number(width),
            pdf_number(height),
            "re",
        ]
    )


def separation_color_space(writer: PdfWriter, name: str, cmyk: tuple[float, float, float, float]):
    tint_function = DictionaryObject(
        {
            NameObject("/FunctionType"): NumberObject(2),
            NameObject("/Domain"): ArrayObject([FloatObject(0), FloatObject(1)]),
            NameObject("/C0"): ArrayObject([FloatObject(0), FloatObject(0), FloatObject(0), FloatObject(0)]),
            NameObject("/C1"): ArrayObject([FloatObject(channel) for channel in cmyk]),
            NameObject("/N"): FloatObject(1),
        }
    )
    tint_ref = writer._add_object(tint_function)
    return ArrayObject(
        [
            NameObject("/Separation"),
            NameObject(f"/{name}"),
            NameObject("/DeviceCMYK"),
            tint_ref,
        ]
    )


def build_template(
    output: Path,
    finished_width_mm: float,
    finished_height_mm: float,
    bleed_mm: float,
    safe_area_mm: float,
) -> None:
    data_width_mm = finished_width_mm + bleed_mm * 2
    data_height_mm = finished_height_mm + bleed_mm * 2
    page_width = mm(data_width_mm)
    page_height = mm(data_height_mm)
    trim_inset = mm(bleed_mm)
    safe_inset = mm(bleed_mm + safe_area_mm)

    writer = PdfWriter()
    writer.pdf_header = "%PDF-1.7"
    writer.metadata = None

    page = PageObject.create_blank_page(width=page_width, height=page_height)
    page.mediabox = RectangleObject([0, 0, page_width, page_height])
    page.cropbox = RectangleObject([0, 0, page_width, page_height])
    page.bleedbox = RectangleObject([0, 0, page_width, page_height])
    page.trimbox = RectangleObject(
        [trim_inset, trim_inset, page_width - trim_inset, page_height - trim_inset]
    )
    page.artbox = RectangleObject(
        [safe_inset, safe_inset, page_width - safe_inset, page_height - safe_inset]
    )

    guide_layer = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/OCG"),
            NameObject("/Name"): TextStringObject("Webprinter guides - do not print"),
            NameObject("/Usage"): DictionaryObject(
                {
                    NameObject("/View"): DictionaryObject(
                        {NameObject("/ViewState"): NameObject("/ON")}
                    ),
                    NameObject("/Print"): DictionaryObject(
                        {NameObject("/PrintState"): NameObject("/OFF")}
                    ),
                    NameObject("/Export"): DictionaryObject(
                        {NameObject("/ExportState"): NameObject("/OFF")}
                    ),
                }
            ),
        }
    )
    guide_layer_ref = writer._add_object(guide_layer)

    guide_state = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/ExtGState"),
            NameObject("/OP"): BooleanObject(True),
            NameObject("/op"): BooleanObject(True),
            NameObject("/OPM"): NumberObject(1),
        }
    )
    guide_state_ref = writer._add_object(guide_state)

    trim_space = separation_color_space(writer, "TrimGuide", (0, 1, 0, 0))
    safe_space = separation_color_space(writer, "SafeGuide", (1, 0, 0, 0))
    data_space = separation_color_space(writer, "DataEdgeGuide", (1, 0.35, 0, 0))

    resources = DictionaryObject(
        {
            NameObject("/Properties"): DictionaryObject(
                {NameObject("/Guides"): guide_layer_ref}
            ),
            NameObject("/ExtGState"): DictionaryObject(
                {NameObject("/GuideState"): guide_state_ref}
            ),
            NameObject("/ColorSpace"): DictionaryObject(
                {
                    NameObject("/TrimCS"): trim_space,
                    NameObject("/SafeCS"): safe_space,
                    NameObject("/DataCS"): data_space,
                }
            ),
        }
    )
    page[NameObject("/Resources")] = resources

    line_width = 0.45
    trim_width = page_width - trim_inset * 2
    trim_height = page_height - trim_inset * 2
    safe_width = page_width - safe_inset * 2
    safe_height = page_height - safe_inset * 2
    content = "\n".join(
        [
            "/OC /Guides BDC",
            "q",
            "/GuideState gs",
            f"{pdf_number(line_width)} w",
            "/DataCS CS 0.55 SCN",
            "[2 2] 0 d",
            rectangle_path(line_width / 2, line_width / 2, page_width - line_width, page_height - line_width),
            "S",
            "/TrimCS CS 1 SCN",
            "[4 2] 0 d",
            rectangle_path(trim_inset, trim_inset, trim_width, trim_height),
            "S",
            "/SafeCS CS 0.85 SCN",
            "[3 2] 0 d",
            rectangle_path(safe_inset, safe_inset, safe_width, safe_height),
            "S",
            "Q",
            "EMC",
        ]
    ).encode("ascii")
    stream = DecodedStreamObject()
    stream.set_data(content)
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.add_page(page)

    writer._root_object[NameObject("/OCProperties")] = DictionaryObject(
        {
            NameObject("/OCGs"): ArrayObject([guide_layer_ref]),
            NameObject("/D"): DictionaryObject(
                {
                    NameObject("/Name"): TextStringObject("Webprinter guide visibility"),
                    NameObject("/Order"): ArrayObject([guide_layer_ref]),
                    NameObject("/ON"): ArrayObject([guide_layer_ref]),
                    NameObject("/OFF"): ArrayObject(),
                    NameObject("/AS"): ArrayObject(
                        [
                            DictionaryObject(
                                {
                                    NameObject("/Event"): NameObject("/View"),
                                    NameObject("/Category"): ArrayObject([NameObject("/View")]),
                                    NameObject("/OCGs"): ArrayObject([guide_layer_ref]),
                                }
                            ),
                            DictionaryObject(
                                {
                                    NameObject("/Event"): NameObject("/Print"),
                                    NameObject("/Category"): ArrayObject([NameObject("/Print")]),
                                    NameObject("/OCGs"): ArrayObject([guide_layer_ref]),
                                }
                            ),
                            DictionaryObject(
                                {
                                    NameObject("/Event"): NameObject("/Export"),
                                    NameObject("/Category"): ArrayObject([NameObject("/Export")]),
                                    NameObject("/OCGs"): ArrayObject([guide_layer_ref]),
                                }
                            ),
                        ]
                    ),
                }
            ),
        }
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as handle:
        writer.write(handle)


def validate_template(
    output: Path,
    finished_width_mm: float,
    finished_height_mm: float,
    bleed_mm: float,
    safe_area_mm: float,
) -> None:
    reader = PdfReader(str(output))
    if len(reader.pages) != 1:
        raise ValueError("Template must contain exactly one page")
    if reader.metadata:
        raise ValueError(f"Unexpected PDF metadata: {reader.metadata}")

    page = reader.pages[0]
    expected_width = finished_width_mm + bleed_mm * 2
    expected_height = finished_height_mm + bleed_mm * 2
    actual_width = float(page.mediabox.width) / PT_PER_MM
    actual_height = float(page.mediabox.height) / PT_PER_MM
    if abs(actual_width - expected_width) > 0.01 or abs(actual_height - expected_height) > 0.01:
        raise ValueError(
            f"Unexpected page size: {actual_width:.3f} x {actual_height:.3f} mm"
        )

    expected_trim_width = finished_width_mm
    expected_trim_height = finished_height_mm
    actual_trim_width = float(page.trimbox.width) / PT_PER_MM
    actual_trim_height = float(page.trimbox.height) / PT_PER_MM
    if abs(actual_trim_width - expected_trim_width) > 0.01 or abs(actual_trim_height - expected_trim_height) > 0.01:
        raise ValueError(
            f"Unexpected trim size: {actual_trim_width:.3f} x {actual_trim_height:.3f} mm"
        )

    expected_art_width = finished_width_mm - safe_area_mm * 2
    expected_art_height = finished_height_mm - safe_area_mm * 2
    actual_art_width = float(page.artbox.width) / PT_PER_MM
    actual_art_height = float(page.artbox.height) / PT_PER_MM
    if abs(actual_art_width - expected_art_width) > 0.01 or abs(actual_art_height - expected_art_height) > 0.01:
        raise ValueError(
            f"Unexpected safe area: {actual_art_width:.3f} x {actual_art_height:.3f} mm"
        )

    raw = output.read_bytes().lower()
    forbidden = [
        b"wir-machen-druck",
        b"wirmachendruck",
        b"manns-partner",
        b"adobe",
        b"illustrator",
        b"flyer_din",
    ]
    hits = [token.decode("ascii") for token in forbidden if token in raw]
    if hits:
        raise ValueError(f"Supplier or source metadata remains: {', '.join(hits)}")

    root = reader.trailer["/Root"]
    oc_properties = root.get("/OCProperties")
    if not oc_properties:
        raise ValueError("Nonprinting guide layer is missing")
    ocg = oc_properties["/OCGs"][0].get_object()
    usage = ocg.get("/Usage", {})
    if usage.get("/Print", {}).get("/PrintState") != "/OFF":
        raise ValueError("Guide layer is not disabled for printing")
    if usage.get("/View", {}).get("/ViewState") != "/ON":
        raise ValueError("Guide layer is not enabled for screen viewing")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--finished-width-mm", type=float, required=True)
    parser.add_argument("--finished-height-mm", type=float, required=True)
    parser.add_argument("--bleed-mm", type=float, default=3)
    parser.add_argument("--safe-area-mm", type=float, default=3)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_template(
        args.output,
        args.finished_width_mm,
        args.finished_height_mm,
        args.bleed_mm,
        args.safe_area_mm,
    )
    validate_template(
        args.output,
        args.finished_width_mm,
        args.finished_height_mm,
        args.bleed_mm,
        args.safe_area_mm,
    )


if __name__ == "__main__":
    main()
