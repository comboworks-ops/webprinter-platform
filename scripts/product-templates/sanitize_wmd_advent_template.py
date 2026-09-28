#!/usr/bin/env python3
"""Build supplier-neutral Danish vector templates from WMD source PDFs.

The supplier geometry is retained as vector PDF operators. Supplier information
and logo layers are removed, all inherited text is stripped, and a controlled
Webprinter-blue Danish information panel is added on a separate non-printing
optional-content layer.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import subprocess
from pathlib import Path
from typing import Any

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
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


MM_PER_POINT = 25.4 / 72.0
NODE_BINARY = "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
PDF_TEXT_EXTRACTOR = str(Path(__file__).with_name("extract-pdf-text-items.cjs"))
WEBPRINTER_BLUE = "#0EA5E9"
WEBPRINTER_BLUE_DARK = "#0284C7"
GEOMETRY_LAYER_NAME = "Skære-, fals- og sikkerhedslinjer - ikke til tryk"
INFO_LAYER_NAME = "Webprinter-information - ikke til tryk"
CUT_MAGENTA = "#EC008C"
SAFETY_BLUE = "#2F80ED"
FOLD_CYAN = "#00A7C4"
DATAFORMAT_GRAY = "#374151"
NONVISIBLE_GRAY = "#D1D5DB"
NONVISIBLE_GRAY_K = 0.18

PATH_BUILD_OPERATORS = {b"m", b"l", b"c", b"v", b"y", b"h", b"re"}
PATH_PAINT_OPERATORS = {
    b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*", b"n"
}
FILL_PAINT_OPERATORS = {b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*"}
STROKE_PAINT_OPERATORS = {b"S", b"s", b"B", b"B*", b"b", b"b*"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--product-name", required=True)
    parser.add_argument("--inspection", required=True)
    # Kept for command compatibility. Vector output does not use a render DPI.
    parser.add_argument("--dpi", type=int, default=200)
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_dimension_text(text: str | None) -> str | None:
    if not text:
        return None
    return re.sub(r"\s+x\s+", " × ", text.strip(), flags=re.IGNORECASE)


def parse_measurement(items: list[dict[str, Any]], label: str) -> str | None:
    pattern = re.compile(rf"^{label}\s*:\s*(.+)$", flags=re.IGNORECASE)
    for item in items:
        match = pattern.match(str(item.get("text") or "").strip())
        if match:
            return normalize_dimension_text(match.group(1))
    return None


def parse_first_mm(items: list[dict[str, Any]], pattern: str) -> float | None:
    regex = re.compile(pattern, flags=re.IGNORECASE)
    for item in items:
        match = regex.search(str(item.get("text") or ""))
        if match:
            return float(match.group(1).replace(",", "."))
    return None


def extract_text_pages(source: Path) -> list[list[dict[str, Any]]]:
    process = subprocess.run(
        [NODE_BINARY, PDF_TEXT_EXTRACTOR, str(source)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    payload = json.loads(process.stdout)
    pages = []
    for page in payload["pages"]:
        items = []
        for item in page["items"]:
            matrix = [float(value) for value in item["matrix"]]
            items.append(
                {
                    "text": str(item.get("str") or item.get("text") or "").strip(),
                    "matrix": matrix,
                    "fontPt": max(
                        math.hypot(matrix[0], matrix[1]),
                        math.hypot(matrix[2], matrix[3]),
                        float(item.get("heightPt") or 0),
                        1.0,
                    ),
                    "widthPt": float(item.get("widthPt") or 0),
                }
            )
        pages.append(items)
    return pages


def layer_name_map(page: Any) -> dict[str, str]:
    resources = page.get("/Resources")
    if not resources:
        return {}
    properties = resources.get_object().get("/Properties", {})
    output: dict[str, str] = {}
    for key, reference in properties.items():
        try:
            output[str(key)] = str(reference.get_object().get("/Name") or "")
        except Exception:
            output[str(key)] = ""
    return output


def keep_source_layer(name: str) -> bool:
    normalized = name.casefold()
    if "logo" in normalized or "info" in normalized or "zahlen" in normalized:
        return False
    return any(
        token in normalized
        for token in ("beschnitt", "kontur", "türchen", "tur", "artwork")
    )


def filter_optional_content(
    operations: list[tuple[Any, bytes]],
    property_layers: dict[str, str],
) -> list[tuple[Any, bytes]]:
    output: list[tuple[Any, bytes]] = []
    visibility_stack: list[tuple[bool, bool]] = []
    visible = True

    for operands, operator in operations:
        if operator in (b"BDC", b"BMC"):
            is_ocg = (
                operator == b"BDC"
                and len(operands) >= 2
                and str(operands[0]) == "/OC"
                and str(operands[1]) in property_layers
            )
            if is_ocg:
                layer_visible = keep_source_layer(property_layers[str(operands[1])])
                visibility_stack.append((visible, True))
                visible = visible and layer_visible
                if visible:
                    output.append(
                        ([NameObject("/OC"), NameObject("/Geometry")], b"BDC")
                    )
            else:
                visibility_stack.append((visible, False))
                if visible:
                    output.append((operands, operator))
            continue

        if operator == b"EMC":
            if not visibility_stack:
                if visible:
                    output.append((operands, operator))
                continue
            parent_visible, _was_ocg = visibility_stack.pop()
            if visible:
                output.append((operands, operator))
            visible = parent_visible
            continue

        if visible:
            output.append((operands, operator))

    return output


def numeric_tuple(operands: Any) -> tuple[float, ...]:
    try:
        return tuple(float(value) for value in operands)
    except Exception:
        return ()


def unwanted_green(fill_color: tuple[str, tuple[float, ...]] | None) -> bool:
    if not fill_color or fill_color[0] != "cmyk" or len(fill_color[1]) != 4:
        return False
    c, m, y, k = fill_color[1]
    return (
        abs(c - 0.33) <= 0.08
        and abs(m - 0.03) <= 0.08
        and y >= 0.72
        and k <= 0.12
    )


def unwanted_black_fill(fill_color: tuple[str, tuple[float, ...]] | None) -> bool:
    """Remove outlined supplier copy and example numbers without touching guide strokes."""
    if not fill_color:
        return False
    model, values = fill_color
    if model == "cmyk" and len(values) == 4:
        c, m, y, k = values
        return c <= 0.12 and m <= 0.12 and y <= 0.12 and k >= 0.58
    if model == "gray" and len(values) == 1:
        return values[0] <= 0.22
    if model == "rgb" and len(values) == 3:
        return max(values) <= 0.22
    return False


def unwanted_instruction_red(
    stroke_color: tuple[str, tuple[float, ...]] | None,
) -> bool:
    if not stroke_color:
        return False
    model, values = stroke_color
    if model == "cmyk" and len(values) == 4:
        c, m, y, k = values
        return c <= 0.08 and m >= 0.92 and y >= 0.92 and k <= 0.08
    if model == "rgb" and len(values) == 3:
        r, g, b = values
        return r >= 0.92 and g <= 0.08 and b <= 0.08
    return False


def source_nonvisible_red(
    fill_color: tuple[str, tuple[float, ...]] | None,
) -> bool:
    """Match supplier red fills used for hidden or print-limited production areas."""
    if not fill_color:
        return False
    model, values = fill_color
    if model == "cmyk" and len(values) == 4:
        c, m, y, k = values
        return c <= 0.08 and m >= 0.92 and y >= 0.92 and k <= 0.08
    if model == "rgb" and len(values) == 3:
        r, g, b = values
        return r >= 0.92 and g <= 0.08 and b <= 0.08
    return False


def converted_nonvisible_gray(
    fill_color: tuple[str, tuple[float, ...]] | None,
) -> bool:
    if not fill_color:
        return False
    model, values = fill_color
    if model == "cmyk" and len(values) == 4:
        c, m, y, k = values
        return c <= 0.01 and m <= 0.01 and y <= 0.01 and abs(k - NONVISIBLE_GRAY_K) <= 0.01
    if model == "gray" and len(values) == 1:
        return abs(values[0] - (1.0 - NONVISIBLE_GRAY_K)) <= 0.01
    return False


def serialize_operations(
    operations: list[tuple[Any, bytes]], reader: PdfReader
) -> bytes:
    stream = ContentStream(DecodedStreamObject(), reader)
    stream.operations = operations
    return stream.get_data()


def nonvisible_spot_color_names(
    resources: DictionaryObject | None,
) -> set[str]:
    if not resources:
        return set()
    color_spaces = resources.get("/ColorSpace")
    if not color_spaces:
        return set()
    output: set[str] = set()
    for key, reference in color_spaces.get_object().items():
        try:
            definition = reference.get_object()
            if (
                len(definition) >= 2
                and str(definition[0]) == "/Separation"
                and "inkvarnishfree" in str(definition[1]).casefold()
            ):
                output.add(str(key))
        except Exception:
            continue
    return output


def strip_text_and_nontechnical_shapes(
    operations: list[tuple[Any, bytes]],
    resources: DictionaryObject | None,
) -> list[tuple[Any, bytes]]:
    output: list[tuple[Any, bytes]] = []
    text_depth = 0
    path_buffer: list[tuple[Any, bytes]] = []
    fill_color: tuple[str, tuple[float, ...]] | None = None
    stroke_color: tuple[str, tuple[float, ...]] | None = None
    state_stack: list[
        tuple[
            tuple[str, tuple[float, ...]] | None,
            tuple[str, tuple[float, ...]] | None,
            bool,
        ]
    ] = []
    xobjects = resources.get("/XObject", {}) if resources else {}
    nonvisible_spot_names = nonvisible_spot_color_names(resources)
    nonvisible_spot_active = False

    def flush_path() -> None:
        nonlocal path_buffer
        if path_buffer:
            output.extend(path_buffer)
            path_buffer = []

    for operands, operator in operations:
        if operator == b"BT":
            text_depth += 1
            continue
        if text_depth:
            if operator == b"BT":
                text_depth += 1
            elif operator == b"ET":
                text_depth -= 1
            continue

        if operator == b"q":
            flush_path()
            state_stack.append((fill_color, stroke_color, nonvisible_spot_active))
            output.append((operands, operator))
            continue
        if operator == b"Q":
            flush_path()
            output.append((operands, operator))
            if state_stack:
                fill_color, stroke_color, nonvisible_spot_active = state_stack.pop()
            continue

        values = numeric_tuple(operands)
        if operator == b"k":
            flush_path()
            fill_color = ("cmyk", values)
            if source_nonvisible_red(fill_color):
                fill_color = ("cmyk", (0.0, 0.0, 0.0, NONVISIBLE_GRAY_K))
                output.append(
                    (
                        [
                            FloatObject(0),
                            FloatObject(0),
                            FloatObject(0),
                            FloatObject(NONVISIBLE_GRAY_K),
                        ],
                        b"k",
                    )
                )
            else:
                output.append((operands, operator))
            continue
        if operator == b"K":
            flush_path()
            stroke_color = ("cmyk", values)
            output.append((operands, operator))
            continue
        if operator == b"rg":
            flush_path()
            fill_color = ("rgb", values)
            if source_nonvisible_red(fill_color):
                fill_color = ("gray", (1.0 - NONVISIBLE_GRAY_K,))
                output.append(([FloatObject(1.0 - NONVISIBLE_GRAY_K)], b"g"))
            else:
                output.append((operands, operator))
            continue
        if operator == b"RG":
            flush_path()
            stroke_color = ("rgb", values)
            output.append((operands, operator))
            continue
        if operator == b"g":
            flush_path()
            fill_color = ("gray", values)
            output.append((operands, operator))
            continue
        if operator == b"G":
            flush_path()
            stroke_color = ("gray", values)
            output.append((operands, operator))
            continue

        if operator == b"cs":
            flush_path()
            nonvisible_spot_active = bool(operands and str(operands[0]) in nonvisible_spot_names)
            if nonvisible_spot_active:
                fill_color = ("gray", (1.0 - NONVISIBLE_GRAY_K,))
                output.append(([FloatObject(1.0 - NONVISIBLE_GRAY_K)], b"g"))
            else:
                output.append((operands, operator))
            continue
        if operator in (b"sc", b"scn") and nonvisible_spot_active:
            flush_path()
            continue

        if operator in PATH_BUILD_OPERATORS or operator in (b"W", b"W*"):
            path_buffer.append((operands, operator))
            continue

        if operator in PATH_PAINT_OPERATORS:
            drop_shape = (
                operator in FILL_PAINT_OPERATORS
                and (unwanted_green(fill_color) or unwanted_black_fill(fill_color))
            ) or (
                operator in STROKE_PAINT_OPERATORS
                and unwanted_instruction_red(stroke_color)
            )
            if not drop_shape:
                flush_path()
                output.append((operands, operator))
            else:
                path_buffer = []
            continue

        if operator == b"Do" and operands:
            flush_path()
            reference = xobjects.get(operands[0]) if xobjects else None
            if reference is not None:
                try:
                    if reference.get_object().get("/Subtype") == "/Image":
                        continue
                except Exception:
                    pass
            output.append((operands, operator))
            continue

        flush_path()
        output.append((operands, operator))

    flush_path()
    return output


def used_xobject_names(operations: list[tuple[Any, bytes]]) -> set[str]:
    return {
        str(operands[0])
        for operands, operator in operations
        if operator == b"Do" and operands
    }


def used_colorspace_names(operations: list[tuple[Any, bytes]]) -> set[str]:
    return {
        str(operands[0])
        for operands, operator in operations
        if operator in (b"cs", b"CS") and operands
    }


def prune_unused_colorspaces(
    resources: DictionaryObject | None,
    operations: list[tuple[Any, bytes]],
) -> None:
    if not resources:
        return
    color_spaces = resources.get("/ColorSpace")
    if not color_spaces:
        return
    used = used_colorspace_names(operations)
    color_spaces = color_spaces.get_object()
    for key in list(color_spaces.keys()):
        if str(key) not in used:
            del color_spaces[key]
    if not color_spaces:
        resources.pop(NameObject("/ColorSpace"), None)


def clean_dictionary_metadata(value: Any) -> None:
    if not isinstance(value, DictionaryObject):
        return
    for key in (
        "/Metadata", "/PieceInfo", "/LastModified", "/AA", "/A", "/ActualText", "/Alt"
    ):
        value.pop(NameObject(key), None)


def sanitize_form(reference: Any, reader: PdfReader) -> DecodedStreamObject | None:
    form = reference.get_object()
    if form.get("/Subtype") == "/Image":
        return None
    if form.get("/Subtype") != "/Form":
        return form

    resources = form.get("/Resources")
    if resources:
        resources = resources.get_object()
    operations = ContentStream(form, reader).operations
    operations = strip_text_and_nontechnical_shapes(operations, resources)
    used = used_xobject_names(operations)
    prune_unused_colorspaces(resources, operations)

    if resources:
        xobjects = resources.get("/XObject")
        if xobjects:
            xobjects = xobjects.get_object()
            for key in list(xobjects.keys()):
                if str(key) not in used:
                    del xobjects[key]
                    continue
                original = xobjects[key].get_object()
                cleaned = sanitize_form(xobjects[key], reader)
                if cleaned is None:
                    del xobjects[key]
                elif cleaned is not original:
                    xobjects[key] = cleaned
            if not xobjects:
                resources.pop(NameObject("/XObject"), None)
        resources.pop(NameObject("/Font"), None)
        resources.pop(NameObject("/Properties"), None)
        clean_dictionary_metadata(resources)

    cleaned_form = DecodedStreamObject()
    for key, value in form.items():
        if str(key) in {
            "/Length", "/Filter", "/DecodeParms", "/Metadata", "/PieceInfo", "/LastModified", "/OC"
        }:
            continue
        cleaned_form[key] = value
    cleaned_form.set_data(serialize_operations(operations, reader))
    clean_dictionary_metadata(cleaned_form)
    return cleaned_form


def sanitize_source_page(page: Any, reader: PdfReader) -> Any:
    properties = layer_name_map(page)
    resources = page.get("/Resources")
    resources = resources.get_object() if resources else DictionaryObject()
    operations = ContentStream(page.get_contents(), reader).operations
    operations = filter_optional_content(operations, properties)
    operations = strip_text_and_nontechnical_shapes(operations, resources)
    used = used_xobject_names(operations)
    prune_unused_colorspaces(resources, operations)

    xobjects = resources.get("/XObject")
    if xobjects:
        xobjects = xobjects.get_object()
        for key in list(xobjects.keys()):
            if str(key) not in used:
                del xobjects[key]
                continue
            original = xobjects[key].get_object()
            cleaned = sanitize_form(xobjects[key], reader)
            if cleaned is None:
                del xobjects[key]
            elif cleaned is not original:
                xobjects[key] = cleaned
        if not xobjects:
            resources.pop(NameObject("/XObject"), None)

    resources.pop(NameObject("/Font"), None)
    resources[NameObject("/Properties")] = DictionaryObject(
        {NameObject("/Geometry"): DictionaryObject()}
    )
    clean_dictionary_metadata(resources)
    page[NameObject("/Resources")] = resources

    stream = DecodedStreamObject()
    stream.set_data(serialize_operations(operations, reader))
    page[NameObject("/Contents")] = stream
    for key in ("/Metadata", "/PieceInfo", "/LastModified", "/Thumb", "/AA"):
        page.pop(NameObject(key), None)
    page.pop(NameObject("/Annots"), None)
    return page


def measurement_anchor(items: list[dict[str, Any]]) -> tuple[float, float] | None:
    pattern = re.compile(
        r"^(Datenformat|Endformat|Sicherheitsabstand|Beschnitt|Falzlinien|Stanzlinien|Schnittlinien)",
        flags=re.IGNORECASE,
    )
    matching = [item for item in items if pattern.match(item["text"])]
    if not matching:
        return None
    return (
        min(float(item["matrix"][4]) for item in matching),
        min(float(item["matrix"][5]) for item in matching),
    )


def wrap_line(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        if current and pdfmetrics.stringWidth(candidate, font_name, font_size) > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def panel_lines(
    product_name: str,
    items: list[dict[str, Any]],
    page_width: float,
    page_height: float,
) -> list[tuple[str, bool]]:
    data_format = parse_measurement(items, "Datenformat")
    final_format = parse_measurement(items, "Endformat")
    bleed_mm = parse_first_mm(items, r"(\d+(?:[.,]\d+)?)\s*mm\s+Beschnitt")
    safe_mm = parse_first_mm(
        items, r"Sicherheitsabstand\s*:\s*(\d+(?:[.,]\d+)?)\s*mm"
    )
    text_blob = "\n".join(item["text"] for item in items)
    lines: list[tuple[str, bool]] = [
        ("WEBPRINTER TRYKSKABELON", True),
        (product_name, True),
        (
            f"Dataformat: {data_format or f'{page_width * MM_PER_POINT:.1f} × {page_height * MM_PER_POINT:.1f} mm'}",
            False,
        ),
    ]
    if final_format:
        lines.append((f"Slutformat: {final_format}", False))
    if bleed_mm is not None:
        lines.append((f"Beskæring: {bleed_mm:g} mm", False))
    if safe_mm is not None:
        lines.append((f"Sikkerhedsafstand: {safe_mm:g} mm", False))
    if re.search(r"Falzlinien|Stanzlinien|Schnittlinien", text_blob, flags=re.IGNORECASE):
        lines.append(("Se tegnforklaringen nedenfor.", False))
    lines.append(("Hjælpelag printes og eksporteres ikke.", False))
    return lines


def fit_panel_text(
    lines: list[tuple[str, bool]],
    width: float,
    height: float,
    padding: float,
) -> tuple[float, list[tuple[str, bool]], float, float, float]:
    legend_rows = 5
    for body_size in [7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5]:
        wrapped: list[tuple[str, bool]] = []
        for text, bold in lines:
            font_name = "Helvetica-Bold" if bold else "Helvetica"
            font_size = body_size + (1.2 if bold else 0)
            for fragment in wrap_line(text, font_name, font_size, width - padding * 2):
                wrapped.append((fragment, bold))
        leading = body_size * 1.28
        legend_size = max(4.8, body_size - 1.0)
        legend_leading = max(8.0, legend_size * 1.55)
        legend_height = legend_leading * (legend_rows + 1) + 8.0
        total_height = leading * len(wrapped) + body_size * 0.5 + legend_height + 5.0
        if total_height <= height - padding * 2:
            return body_size, wrapped, leading, legend_size, legend_height
    raise ValueError("Danish template text does not fit inside the Webprinter panel")


def create_overlay_page(
    page_width: float,
    page_height: float,
    product_name: str,
    items: list[dict[str, Any]],
) -> tuple[Any | None, dict[str, Any] | None]:
    anchor = measurement_anchor(items)
    if anchor is None:
        return None, None

    panel_width = max(180.0, min(265.0, page_width * 0.29))
    panel_height = max(142.0, min(178.0, page_height * 0.26))
    panel_x = min(max(8.0, anchor[0] - 8.0), page_width - panel_width - 8.0)
    panel_y = min(max(8.0, anchor[1] - 16.0), page_height - panel_height - 8.0)
    padding = max(7.0, min(10.0, panel_width * 0.045))

    lines = panel_lines(product_name, items, page_width, page_height)
    body_size, wrapped, leading, legend_size, legend_height = fit_panel_text(
        lines, panel_width, panel_height, padding
    )

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_width, page_height), pageCompression=1)
    cleanup_padding = 12.0
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setStrokeColor(HexColor("#FFFFFF"))
    pdf.roundRect(
        panel_x - cleanup_padding,
        panel_y - cleanup_padding,
        panel_width + cleanup_padding * 2,
        panel_height + cleanup_padding * 2,
        7.0,
        fill=1,
        stroke=0,
    )
    pdf.setFillColor(HexColor(WEBPRINTER_BLUE))
    pdf.setStrokeColor(HexColor(WEBPRINTER_BLUE_DARK))
    pdf.setLineWidth(1.0)
    pdf.roundRect(panel_x, panel_y, panel_width, panel_height, 5.0, fill=1, stroke=1)
    pdf.setFillColor(HexColor("#FFFFFF"))
    y = panel_y + panel_height - padding - body_size
    for text, bold in wrapped:
        font_name = "Helvetica-Bold" if bold else "Helvetica"
        font_size = body_size + (1.2 if bold else 0)
        pdf.setFont(font_name, font_size)
        pdf.drawString(panel_x + padding, y, text)
        y -= leading
    legend_x = panel_x + padding
    legend_y = panel_y + padding
    legend_width = panel_width - padding * 2
    if y < legend_y + legend_height + 4.0:
        raise ValueError("Webprinter panel text overflowed its bounding box")

    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setStrokeColor(HexColor("#D7E9F4"))
    pdf.setLineWidth(0.7)
    pdf.roundRect(legend_x, legend_y, legend_width, legend_height, 3.5, fill=1, stroke=1)
    pdf.setFillColor(HexColor("#08253A"))
    pdf.setFont("Helvetica-Bold", legend_size + 0.6)
    legend_line = max(8.0, legend_size * 1.55)
    legend_text_y = legend_y + legend_height - 7.0 - legend_size
    pdf.drawString(legend_x + 6.0, legend_text_y, "TEGNFORKLARING")

    legend_rows = [
        ("data", "Dataformat / udfald"),
        ("cut", "Skæring / stansning"),
        ("safe", "Sikkerhedsafstand"),
        ("fold", "Falselinje"),
        ("gray", "Ikke synlig / trykbegrænset"),
    ]
    sample_x = legend_x + 7.0
    sample_width = min(28.0, legend_width * 0.2)
    label_x = sample_x + sample_width + 7.0
    for kind, label in legend_rows:
        legend_text_y -= legend_line
        sample_y = legend_text_y + legend_size * 0.45
        pdf.setLineWidth(1.25)
        pdf.setDash()
        if kind == "data":
            pdf.setStrokeColor(HexColor(DATAFORMAT_GRAY))
            pdf.line(sample_x, sample_y, sample_x + sample_width, sample_y)
        elif kind == "cut":
            pdf.setStrokeColor(HexColor(CUT_MAGENTA))
            pdf.setDash(4, 2)
            pdf.line(sample_x, sample_y, sample_x + sample_width, sample_y)
        elif kind == "safe":
            pdf.setStrokeColor(HexColor(SAFETY_BLUE))
            pdf.line(sample_x, sample_y, sample_x + sample_width, sample_y)
        elif kind == "fold":
            pdf.setStrokeColor(HexColor(FOLD_CYAN))
            pdf.setDash(1.5, 1.5)
            pdf.line(sample_x, sample_y, sample_x + sample_width, sample_y)
        else:
            pdf.setFillColor(HexColor(NONVISIBLE_GRAY))
            pdf.setStrokeColor(HexColor("#9CA3AF"))
            pdf.rect(sample_x, sample_y - 3.0, sample_width, 6.0, fill=1, stroke=1)
        pdf.setDash()
        pdf.setFillColor(HexColor("#08253A"))
        pdf.setFont("Helvetica", legend_size)
        pdf.drawString(label_x, legend_text_y, label)
    pdf.showPage()
    pdf.save()

    overlay_reader = PdfReader(io.BytesIO(buffer.getvalue()))
    overlay = overlay_reader.pages[0]
    content = overlay.get_contents().get_data()
    wrapped_stream = DecodedStreamObject()
    wrapped_stream.set_data(b"/OC /Info BDC\n" + content + b"\nEMC\n")
    overlay[NameObject("/Contents")] = wrapped_stream
    resources = overlay["/Resources"].get_object()
    resources[NameObject("/Properties")] = DictionaryObject(
        {NameObject("/Info"): DictionaryObject()}
    )
    return overlay, {
        "xPt": round(panel_x, 3),
        "yPt": round(panel_y, 3),
        "widthPt": round(panel_width, 3),
        "heightPt": round(panel_height, 3),
        "fontSizePt": body_size,
        "lineCount": len(wrapped),
        "textContained": True,
        "legendContained": True,
        "legendRows": [label for _kind, label in legend_rows],
        "fillHex": WEBPRINTER_BLUE,
        "nonVisibleFillHex": NONVISIBLE_GRAY,
    }


def ocg_dictionary(name: str) -> DictionaryObject:
    return DictionaryObject(
        {
            NameObject("/Type"): NameObject("/OCG"),
            NameObject("/Name"): TextStringObject(name),
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


def set_ocg_root(writer: PdfWriter, geometry_ref: Any, info_ref: Any) -> None:
    groups = ArrayObject([geometry_ref, info_ref])
    writer._root_object[NameObject("/OCProperties")] = DictionaryObject(
        {
            NameObject("/OCGs"): groups,
            NameObject("/D"): DictionaryObject(
                {
                    NameObject("/Name"): TextStringObject("Webprinter skabelonlag"),
                    NameObject("/Order"): groups,
                    NameObject("/ON"): groups,
                    NameObject("/OFF"): ArrayObject(),
                    NameObject("/AS"): ArrayObject(
                        [
                            DictionaryObject(
                                {
                                    NameObject("/Event"): NameObject("/View"),
                                    NameObject("/Category"): ArrayObject([NameObject("/View")]),
                                    NameObject("/OCGs"): groups,
                                }
                            ),
                            DictionaryObject(
                                {
                                    NameObject("/Event"): NameObject("/Print"),
                                    NameObject("/Category"): ArrayObject([NameObject("/Print")]),
                                    NameObject("/OCGs"): groups,
                                }
                            ),
                            DictionaryObject(
                                {
                                    NameObject("/Event"): NameObject("/Export"),
                                    NameObject("/Category"): ArrayObject([NameObject("/Export")]),
                                    NameObject("/OCGs"): groups,
                                }
                            ),
                        ]
                    ),
                }
            ),
        }
    )


def iter_content_objects(page: Any, reader: PdfReader):
    visited: set[int] = set()

    def walk(container: Any, resources: Any):
        object_id = id(container)
        if object_id in visited:
            return
        visited.add(object_id)
        yield container
        resources = resources.get_object() if resources else None
        if not resources:
            return
        for reference in resources.get("/XObject", {}).values():
            obj = reference.get_object()
            if obj.get("/Subtype") == "/Form":
                yield from walk(obj, obj.get("/Resources"))

    yield from walk(page, page.get("/Resources"))


def box_values(page: Any, key: str) -> list[float]:
    box = getattr(page, key)
    return [round(float(value), 4) for value in box]


def structural_counts(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    image_count = 0
    form_count = 0
    path_count = 0
    text_show_count = 0
    red_area_fill_color_operators = 0
    gray_area_fill_color_operators = 0
    page_boxes = []
    for page in reader.pages:
        page_boxes.append(
            {
                key: box_values(page, key)
                for key in ("mediabox", "cropbox", "bleedbox", "trimbox", "artbox")
            }
        )
        for container in iter_content_objects(page, reader):
            try:
                operations = ContentStream(
                    container.get_contents() if hasattr(container, "get_contents") else container,
                    reader,
                ).operations
            except Exception:
                operations = ContentStream(container, reader).operations
            for operands, operator in operations:
                if operator in PATH_BUILD_OPERATORS:
                    path_count += 1
                elif operator in (b"Tj", b"TJ"):
                    text_show_count += 1
                elif operator in (b"k", b"rg", b"g"):
                    values = numeric_tuple(operands)
                    model = {b"k": "cmyk", b"rg": "rgb", b"g": "gray"}[operator]
                    fill_color = (model, values)
                    red_area_fill_color_operators += source_nonvisible_red(fill_color)
                    gray_area_fill_color_operators += converted_nonvisible_gray(fill_color)
            resources = container.get("/Resources")
            resources = resources.get_object() if resources else None
            if resources:
                for reference in resources.get("/XObject", {}).values():
                    subtype = reference.get_object().get("/Subtype")
                    image_count += subtype == "/Image"
                    form_count += subtype == "/Form"

    root = reader.trailer["/Root"]
    oc_properties = root.get("/OCProperties")
    layer_details = []
    if oc_properties:
        for reference in oc_properties.get_object().get("/OCGs", []):
            group = reference.get_object()
            usage = group.get("/Usage", {})
            layer_details.append(
                {
                    "name": str(group.get("/Name") or ""),
                    "viewState": str(usage.get("/View", {}).get("/ViewState") or ""),
                    "printState": str(usage.get("/Print", {}).get("/PrintState") or ""),
                    "exportState": str(usage.get("/Export", {}).get("/ExportState") or ""),
                }
            )
    return {
        "pages": len(reader.pages),
        "pageBoxes": page_boxes,
        "images": image_count,
        "forms": form_count,
        "vectorPathOperators": path_count,
        "textShowOperators": text_show_count,
        "redAreaFillColorOperators": red_area_fill_color_operators,
        "grayAreaFillColorOperators": gray_area_fill_color_operators,
        "layers": layer_details,
    }


def build_template(
    source: Path,
    output: Path,
    product_name: str,
    text_pages: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    reader = PdfReader(str(source))
    if len(reader.pages) != len(text_pages):
        raise ValueError("Source page and extracted text page counts differ")

    writer = PdfWriter()
    writer.pdf_header = "%PDF-1.7"
    writer.metadata = None
    geometry_ref = writer._add_object(ocg_dictionary(GEOMETRY_LAYER_NAME))
    info_ref = writer._add_object(ocg_dictionary(INFO_LAYER_NAME))
    panel_inspections: list[dict[str, Any]] = []

    for page_index, source_page in enumerate(reader.pages):
        page = sanitize_source_page(source_page, reader)
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)
        overlay, panel = create_overlay_page(
            page_width, page_height, product_name, text_pages[page_index]
        )
        if overlay is not None:
            page.merge_page(overlay, expand=False)
        writer.add_page(page)
        written_page = writer.pages[-1]
        resources = written_page["/Resources"].get_object()
        resources[NameObject("/Properties")] = DictionaryObject(
            {NameObject("/Geometry"): geometry_ref, NameObject("/Info"): info_ref}
        )
        panel_inspections.append(
            {"page": page_index + 1, "panel": panel, "panelPresent": panel is not None}
        )

    set_ocg_root(writer, geometry_ref, info_ref)
    for key in ("/Metadata", "/Names", "/Outlines", "/OpenAction", "/AA"):
        writer._root_object.pop(NameObject(key), None)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as stream:
        writer.write(stream)
    return panel_inspections


def validate_output(source: Path, output: Path) -> dict[str, Any]:
    source_counts = structural_counts(source)
    output_counts = structural_counts(output)
    if source_counts["pages"] != output_counts["pages"]:
        raise ValueError("Output page count does not match source")
    if source_counts["pageBoxes"] != output_counts["pageBoxes"]:
        raise ValueError("Output page boxes do not match source exactly")
    if output_counts["images"] != 0:
        raise ValueError("Sanitized template contains raster image XObjects")
    if output_counts["vectorPathOperators"] <= 0:
        raise ValueError("Sanitized template contains no vector paths")
    if output_counts["redAreaFillColorOperators"] != 0:
        raise ValueError("Sanitized template still contains supplier red area fills")
    if (
        source_counts["redAreaFillColorOperators"] > 0
        and output_counts["grayAreaFillColorOperators"] == 0
    ):
        raise ValueError("Supplier red production areas were not converted to neutral grey")

    expected_layers = {GEOMETRY_LAYER_NAME, INFO_LAYER_NAME}
    actual_layers = {layer["name"] for layer in output_counts["layers"]}
    if actual_layers != expected_layers:
        raise ValueError(f"Unexpected output layers: {sorted(actual_layers)}")
    for layer in output_counts["layers"]:
        if layer["viewState"] != "/ON":
            raise ValueError(f"Layer is not visible on screen: {layer['name']}")
        if layer["printState"] != "/OFF" or layer["exportState"] != "/OFF":
            raise ValueError(f"Layer is not disabled for print/export: {layer['name']}")

    reader = PdfReader(str(output))
    if reader.metadata:
        raise ValueError(f"Unexpected output metadata: {reader.metadata}")
    extracted = "\n".join((page.extract_text() or "") for page in reader.pages)
    forbidden_patterns = [
        r"wir\s*-?\s*machen\s*-?\s*druck",
        r"wirmachendruck",
        r"druckerei",
        r"vorlage\s+zur",
        r"datenformat",
        r"endformat",
        r"sicherheitsabstand",
        r"falzlinien",
        r"stanzlinien",
        r"adobe",
        r"illustrator",
    ]
    hits = [
        pattern for pattern in forbidden_patterns
        if re.search(pattern, extracted, flags=re.IGNORECASE)
    ]
    if hits:
        raise ValueError(f"Supplier/German text remains extractable: {hits}")
    required_danish_legend = [
        "TEGNFORKLARING",
        "Skæring / stansning",
        "Sikkerhedsafstand",
        "Ikke synlig / trykbegrænset",
    ]
    missing_legend = [label for label in required_danish_legend if label not in extracted]
    if missing_legend:
        raise ValueError(f"Danish line legend is incomplete: {missing_legend}")
    raw_lower = output.read_bytes().lower()
    raw_forbidden = [b"wirmachendruck", b"wir-machen-druck", b"adobe illustrator"]
    raw_hits = [token.decode("ascii") for token in raw_forbidden if token in raw_lower]
    if raw_hits:
        raise ValueError(f"Supplier metadata remains in raw PDF: {raw_hits}")
    return {
        "source": source_counts,
        "output": output_counts,
        "outputExtractedTextLength": len(extracted.strip()),
    }


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    inspection_path = Path(args.inspection).resolve()
    text_pages = extract_text_pages(source)
    panel_inspections = build_template(source, output, args.product_name, text_pages)
    validation = validate_output(source, output)

    reader = PdfReader(str(output))
    first_page = reader.pages[0]
    all_items = [item for page_items in text_pages for item in page_items]
    inspection = {
        "schemaVersion": 3,
        "sourcePath": str(source),
        "outputPath": str(output),
        "sourceSha256": sha256(source),
        "outputSha256": sha256(output),
        "pageCount": len(reader.pages),
        "pageWidthPt": round(float(first_page.mediabox.width), 4),
        "pageHeightPt": round(float(first_page.mediabox.height), 4),
        "pageWidthMm": round(float(first_page.mediabox.width) * MM_PER_POINT, 3),
        "pageHeightMm": round(float(first_page.mediabox.height) * MM_PER_POINT, 3),
        "dataFormat": parse_measurement(all_items, "Datenformat"),
        "finalFormat": parse_measurement(all_items, "Endformat"),
        "bleedMm": parse_first_mm(all_items, r"(\d+(?:[.,]\d+)?)\s*mm\s+Beschnitt"),
        "safeMm": parse_first_mm(
            all_items, r"Sicherheitsabstand\s*:\s*(\d+(?:[.,]\d+)?)\s*mm"
        ),
        "vectorGeometryPreserved": True,
        "fullPageRasterization": False,
        "webprinterPanelHex": WEBPRINTER_BLUE,
        "nonVisibleAreaHex": NONVISIBLE_GRAY,
        "lineLegend": {
            "dataFormat": DATAFORMAT_GRAY,
            "cutAndDie": CUT_MAGENTA,
            "safeArea": SAFETY_BLUE,
            "fold": FOLD_CYAN,
            "notVisibleOrPrintLimited": NONVISIBLE_GRAY,
        },
        "sourceRedAreaFillOperators": validation["source"]["redAreaFillColorOperators"],
        "redAreaFillsRemaining": validation["output"]["redAreaFillColorOperators"],
        "grayAreaFillOperators": validation["output"]["grayAreaFillColorOperators"],
        "redAreasConvertedToNeutralGray": (
            validation["output"]["redAreaFillColorOperators"] == 0
            and (
                validation["source"]["redAreaFillColorOperators"] == 0
                or validation["output"]["grayAreaFillColorOperators"] > 0
            )
        ),
        "panelTextContained": all(
            not page["panelPresent"]
            or (
                page["panel"]["textContained"]
                and page["panel"]["legendContained"]
            )
            for page in panel_inspections
        ),
        "panelPages": panel_inspections,
        "layers": validation["output"]["layers"],
        "sourceVectorPathOperators": validation["source"]["vectorPathOperators"],
        "outputVectorPathOperators": validation["output"]["vectorPathOperators"],
        "outputRasterImageCount": validation["output"]["images"],
        "supplierMetadataRemoved": True,
        "supplierBrandingRemoved": True,
        "danishOverlay": True,
        "visualReviewPending": True,
    }
    inspection_path.parent.mkdir(parents=True, exist_ok=True)
    inspection_path.write_text(
        json.dumps(inspection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
