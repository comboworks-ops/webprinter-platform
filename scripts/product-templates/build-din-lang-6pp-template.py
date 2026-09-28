#!/usr/bin/env python3
"""Build clean DIN Lang six-page fold templates with nonprinting vector guides."""

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
PAGE_WIDTH_MM = 303.0
PAGE_HEIGHT_MM = 216.0
BLEED_MM = 3.0
SAFE_OFFSET_FROM_DATA_EDGE_MM = 6.0
GUIDE_LINE_WIDTH_PT = 0.75
FOLD_LINE_WIDTH_PT = 1.5

FOLD_POSITIONS_MM = {
    # The inner flap is 97 mm. It changes side between outside and inside.
    "rullefalset": ((100.0, 200.0), (103.0, 203.0)),
    # Three equal 99 mm panels inside the 297 mm trim width.
    "zigzag": ((102.0, 201.0), (102.0, 201.0)),
}


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


def separation_color_space(
    writer: PdfWriter,
    name: str,
    cmyk: tuple[float, float, float, float],
) -> ArrayObject:
    tint_function = DictionaryObject(
        {
            NameObject("/FunctionType"): NumberObject(2),
            NameObject("/Domain"): ArrayObject([FloatObject(0), FloatObject(1)]),
            NameObject("/C0"): ArrayObject([FloatObject(0), FloatObject(0), FloatObject(0), FloatObject(0)]),
            NameObject("/C1"): ArrayObject([FloatObject(channel) for channel in cmyk]),
            NameObject("/N"): FloatObject(1),
        }
    )
    return ArrayObject(
        [
            NameObject("/Separation"),
            NameObject(f"/{name}"),
            NameObject("/DeviceCMYK"),
            writer._add_object(tint_function),
        ]
    )


def build_template(output: Path, fold_type: str) -> None:
    fold_pages = FOLD_POSITIONS_MM[fold_type]
    page_width = mm(PAGE_WIDTH_MM)
    page_height = mm(PAGE_HEIGHT_MM)
    trim_inset = mm(BLEED_MM)
    safe_inset = mm(SAFE_OFFSET_FROM_DATA_EDGE_MM)

    writer = PdfWriter()
    writer.pdf_header = "%PDF-1.7"
    writer.metadata = None

    guide_layer = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/OCG"),
            NameObject("/Name"): TextStringObject("Webprinter guides - do not print"),
            NameObject("/Usage"): DictionaryObject(
                {
                    NameObject("/View"): DictionaryObject({NameObject("/ViewState"): NameObject("/ON")}),
                    NameObject("/Print"): DictionaryObject({NameObject("/PrintState"): NameObject("/OFF")}),
                    NameObject("/Export"): DictionaryObject({NameObject("/ExportState"): NameObject("/OFF")}),
                }
            ),
        }
    )
    guide_layer_ref = writer._add_object(guide_layer)

    guide_state_ref = writer._add_object(
        DictionaryObject(
            {
                NameObject("/Type"): NameObject("/ExtGState"),
                NameObject("/OP"): BooleanObject(True),
                NameObject("/op"): BooleanObject(True),
                NameObject("/OPM"): NumberObject(1),
            }
        )
    )

    color_spaces = {
        NameObject("/DataCS"): separation_color_space(writer, "DataEdgeGuide", (1, 0.35, 0, 0)),
        NameObject("/TrimCS"): separation_color_space(writer, "TrimGuide", (0, 1, 0, 0)),
        NameObject("/FoldCS"): separation_color_space(writer, "FoldGuide", (0, 1, 0, 0)),
        NameObject("/SafeCS"): separation_color_space(writer, "SafeGuide", (1, 0.45, 0, 0)),
    }

    for fold_positions in fold_pages:
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
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Properties"): DictionaryObject({NameObject("/Guides"): guide_layer_ref}),
                NameObject("/ExtGState"): DictionaryObject({NameObject("/GuideState"): guide_state_ref}),
                NameObject("/ColorSpace"): DictionaryObject(color_spaces),
            }
        )

        line_width = GUIDE_LINE_WIDTH_PT
        content_lines = [
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
            rectangle_path(trim_inset, trim_inset, page_width - 2 * trim_inset, page_height - 2 * trim_inset),
            "S",
            "/SafeCS CS 0.85 SCN",
            "[3 2] 0 d",
            rectangle_path(safe_inset, safe_inset, page_width - 2 * safe_inset, page_height - 2 * safe_inset),
            "S",
            f"{pdf_number(FOLD_LINE_WIDTH_PT)} w",
            "/FoldCS CS 1 SCN",
            "[8 3] 0 d",
        ]
        for fold_position in fold_positions:
            fold_x = mm(fold_position)
            content_lines.append(
                f"{pdf_number(fold_x)} 0 m {pdf_number(fold_x)} {pdf_number(page_height)} l S"
            )
        content_lines.extend(["Q", "EMC"])

        stream = DecodedStreamObject()
        stream.set_data("\n".join(content_lines).encode("ascii"))
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


def validate_template(output: Path, fold_type: str) -> None:
    reader = PdfReader(str(output))
    if len(reader.pages) != 2:
        raise ValueError("Template must contain outside and inside pages")
    if reader.metadata:
        raise ValueError(f"Unexpected PDF metadata: {reader.metadata}")

    for index, (page, expected_folds) in enumerate(zip(reader.pages, FOLD_POSITIONS_MM[fold_type]), start=1):
        actual_width = float(page.mediabox.width) / PT_PER_MM
        actual_height = float(page.mediabox.height) / PT_PER_MM
        if abs(actual_width - PAGE_WIDTH_MM) > 0.01 or abs(actual_height - PAGE_HEIGHT_MM) > 0.01:
            raise ValueError(f"Page {index} has unexpected size {actual_width:.3f} x {actual_height:.3f} mm")

        content = page.get_contents().get_data().decode("ascii")
        if f"{pdf_number(FOLD_LINE_WIDTH_PT)} w" not in content:
            raise ValueError(f"Page {index} is missing the strengthened fold-line weight")
        for fold_position in expected_folds:
            fold_x = pdf_number(mm(fold_position))
            if f"{fold_x} 0 m {fold_x} {pdf_number(mm(PAGE_HEIGHT_MM))} l S" not in content:
                raise ValueError(f"Page {index} is missing fold line at {fold_position} mm")

    raw = output.read_bytes().lower()
    forbidden = [b"wir-machen-druck", b"wirmachendruck", b"manns-partner", b"adobe", b"illustrator"]
    hits = [token.decode("ascii") for token in forbidden if token in raw]
    if hits:
        raise ValueError(f"Supplier or source metadata remains: {', '.join(hits)}")

    root = reader.trailer["/Root"]
    ocg = root["/OCProperties"]["/OCGs"][0].get_object()
    usage = ocg["/Usage"]
    if usage["/Print"]["/PrintState"] != "/OFF":
        raise ValueError("Guide layer must be disabled for printing")
    if usage["/Export"]["/ExportState"] != "/OFF":
        raise ValueError("Guide layer must be disabled for export")
    if usage["/View"]["/ViewState"] != "/ON":
        raise ValueError("Guide layer must be visible on screen")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fold-type", choices=sorted(FOLD_POSITIONS_MM), required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_template(args.output, args.fold_type)
    validate_template(args.output, args.fold_type)


if __name__ == "__main__":
    main()
