#!/usr/bin/env python3
"""Deterministic pixel analysis and contact sheets for sanitized-folder renders.

This helper never opens or writes a PDF.  It only reads page images produced by
Poppler and writes review-only PNG/JSON evidence for the local QA builder.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


WEBPRINTER_BLUE = np.array([14, 165, 233], dtype=np.int16)
WEBPRINTER_BLUE_BORDER = np.array([2, 132, 199], dtype=np.int16)
NO_PRINT_GRAY = np.array([209, 213, 219], dtype=np.int16)


class RenderAnalysisError(ValueError):
    """A fail-closed input or image-analysis error."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RenderAnalysisError(f"Cannot read request JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RenderAnalysisError("Request JSON must be an object")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def bounded_ratio(count: int, total: int) -> float:
    return round(count / total, 9) if total else 0.0


def analyse_image(item: dict[str, Any]) -> dict[str, Any]:
    image_path = Path(str(item.get("path", "")))
    if not image_path.is_file() or image_path.is_symlink():
        raise RenderAnalysisError(f"Render is not a regular non-symlink file: {image_path}")
    try:
        with Image.open(image_path) as source:
            source.load()
            rgb_image = source.convert("RGB")
    except (OSError, ValueError) as exc:
        raise RenderAnalysisError(f"Cannot decode rendered page {image_path}: {exc}") from exc

    pixels = np.asarray(rgb_image, dtype=np.uint8)
    if pixels.ndim != 3 or pixels.shape[2] != 3:
        raise RenderAnalysisError(f"Rendered page did not decode to RGB: {image_path}")
    height, width, _ = pixels.shape
    total = int(width * height)
    if total <= 0:
        raise RenderAnalysisError(f"Rendered page has no pixels: {image_path}")

    signed = pixels.astype(np.int16)
    channel_max = signed.max(axis=2)
    channel_min = signed.min(axis=2)
    non_white = np.any(signed < 248, axis=2)
    blue_fill = np.max(np.abs(signed - WEBPRINTER_BLUE), axis=2) <= 24
    blue_border = np.max(np.abs(signed - WEBPRINTER_BLUE_BORDER), axis=2) <= 24
    webprinter_blue = np.logical_or(blue_fill, blue_border)
    no_print_gray = np.max(np.abs(signed - NO_PRINT_GRAY), axis=2) <= 18
    neutral_gray = np.logical_and.reduce(
        (
            channel_max - channel_min <= 12,
            channel_min >= 175,
            channel_max <= 236,
        )
    )
    # Converted supplier no-print fills intentionally retain their reviewed
    # source transparency.  The exact #D1D5DB operator can therefore composite
    # to a much lighter neutral grey (commonly #F6F7F8) while still remaining
    # visibly distinct from a printable white page.
    effective_no_print_gray = np.logical_and.reduce(
        (
            channel_max - channel_min <= 12,
            channel_min >= 175,
            channel_max <= 250,
        )
    )
    supplier_green = np.logical_and.reduce(
        (
            signed[:, :, 1] >= 89,
            signed[:, :, 1] - signed[:, :, 0] >= 46,
            signed[:, :, 1] - signed[:, :, 2] >= 46,
        )
    )
    colourful = channel_max - channel_min >= 35

    # Five bits per channel are enough to detect a truly uniform/blank page
    # without letting antialiasing create thousands of meaningless colors.
    quantized = (pixels >> 3).astype(np.uint16)
    packed = (quantized[:, :, 0] << 10) | (quantized[:, :, 1] << 5) | quantized[:, :, 2]
    quantized_color_count = int(np.unique(packed).size)
    non_white_count = int(np.count_nonzero(non_white))
    channel_range = int(signed.max() - signed.min())
    non_blank = (
        non_white_count >= max(100, math.ceil(total * 0.0005))
        and quantized_color_count >= 2
        and channel_range >= 8
    )

    blue_count = int(np.count_nonzero(webprinter_blue))
    green_count = int(np.count_nonzero(supplier_green))
    gray_count = int(np.count_nonzero(no_print_gray))
    neutral_gray_count = int(np.count_nonzero(neutral_gray))
    effective_no_print_gray_count = int(np.count_nonzero(effective_no_print_gray))
    colourful_count = int(np.count_nonzero(colourful))

    return {
        "sha256": str(item.get("sha256", "")),
        "widthPx": int(width),
        "heightPx": int(height),
        "pixelCount": total,
        "nonWhitePixels": non_white_count,
        "nonWhiteRatio": bounded_ratio(non_white_count, total),
        "quantizedColorCount": quantized_color_count,
        "channelRange": channel_range,
        "nonBlankPassed": bool(non_blank),
        "webprinterBluePixels": blue_count,
        "webprinterBlueRatio": bounded_ratio(blue_count, total),
        "supplierGreenPixels": green_count,
        "supplierGreenRatio": bounded_ratio(green_count, total),
        "noPrintGrayPixels": gray_count,
        "noPrintGrayRatio": bounded_ratio(gray_count, total),
        "neutralGrayPixels": neutral_gray_count,
        "neutralGrayRatio": bounded_ratio(neutral_gray_count, total),
        "effectiveNoPrintGrayPixels": effective_no_print_gray_count,
        "effectiveNoPrintGrayRatio": bounded_ratio(effective_no_print_gray_count, total),
        "colorfulPixels": colourful_count,
        "colorfulRatio": bounded_ratio(colourful_count, total),
    }


def run_analysis(request: dict[str, Any]) -> dict[str, Any]:
    images = request.get("images")
    if not isinstance(images, list) or not images:
        raise RenderAnalysisError("Analysis request must contain at least one image")
    concurrency = request.get("concurrency", 1)
    if isinstance(concurrency, bool) or not isinstance(concurrency, int) or not 1 <= concurrency <= 8:
        raise RenderAnalysisError("Analysis concurrency must be an integer from 1 to 8")
    seen: set[str] = set()
    validated_items: list[dict[str, Any]] = []
    for item in images:
        if not isinstance(item, dict):
            raise RenderAnalysisError("Every analysis image must be an object")
        digest = str(item.get("sha256", ""))
        if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
            raise RenderAnalysisError("Every analysis image requires a lowercase SHA-256")
        if digest in seen:
            raise RenderAnalysisError(f"Duplicate analysis image SHA-256: {digest}")
        seen.add(digest)
        validated_items.append(item)
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(analyse_image, validated_items))
    results.sort(key=lambda row: row["sha256"])
    return {
        "kind": "wmd_sales_folder_render_pixel_analysis",
        "schemaVersion": 1,
        "palette": {
            "webprinterBlue": "#0EA5E9",
            "webprinterBlueBorder": "#0284C7",
            "noPrintGray": "#D1D5DB",
        },
        "images": results,
    }


def text_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, width: int) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        left, _, right, _ = draw.textbbox((0, 0), candidate, font=font)
        if right - left <= width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def render_contact_sheet(sheet: dict[str, Any]) -> dict[str, Any]:
    output_path = Path(str(sheet.get("outputPath", "")))
    if output_path.suffix.lower() != ".png":
        raise RenderAnalysisError("Contact-sheet output must use .png")
    if output_path.exists():
        raise RenderAnalysisError(f"Refusing to overwrite contact sheet: {output_path}")
    items = sheet.get("items")
    if not isinstance(items, list) or not items or len(items) > 12:
        raise RenderAnalysisError("Each contact sheet must contain 1 to 12 items")

    columns = 3
    card_width = 760
    card_height = 620
    gutter = 30
    outer = 44
    heading_height = 110
    rows = math.ceil(len(items) / columns)
    canvas_width = outer * 2 + columns * card_width + (columns - 1) * gutter
    canvas_height = outer * 2 + heading_height + rows * card_height + (rows - 1) * gutter
    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    title = str(sheet.get("title", "Saniterede PDF-renderinger"))
    draw.text((outer, outer), title, fill=(15, 23, 42), font=font)
    draw.text(
        (outer, outer + 32),
        "Kun lokalt QA-materiale - afventer menneskelig visuel kontrol",
        fill=(71, 85, 105),
        font=font,
    )

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise RenderAnalysisError("Contact-sheet item must be an object")
        column = index % columns
        row = index // columns
        x = outer + column * (card_width + gutter)
        y = outer + heading_height + row * (card_height + gutter)
        status = str(item.get("status", "failed"))
        border = (22, 163, 74) if status == "passed" else (220, 38, 38)
        draw.rounded_rectangle((x, y, x + card_width, y + card_height), radius=18, fill="white", outline=border, width=4)

        label = str(item.get("label", "Uden label"))
        lines = text_lines(draw, label, font, card_width - 36)[:3]
        for line_index, line in enumerate(lines):
            draw.text((x + 18, y + 16 + line_index * 18), line, fill=(15, 23, 42), font=font)
        details = str(item.get("details", ""))
        draw.text((x + 18, y + 74), details[:135], fill=(71, 85, 105), font=font)

        page_paths = item.get("pagePaths")
        if not isinstance(page_paths, list) or not page_paths:
            raise RenderAnalysisError("Contact-sheet item requires pagePaths")
        preview_top = y + 108
        preview_height = card_height - 128
        page_gap = 12
        slot_width = (card_width - 36 - page_gap * (len(page_paths) - 1)) // len(page_paths)
        for page_index, page_path_value in enumerate(page_paths):
            page_path = Path(str(page_path_value))
            if not page_path.is_file() or page_path.is_symlink():
                raise RenderAnalysisError(f"Contact-sheet page is not a regular file: {page_path}")
            try:
                with Image.open(page_path) as page_source:
                    page_source.load()
                    page = page_source.convert("RGB")
            except (OSError, ValueError) as exc:
                raise RenderAnalysisError(f"Cannot decode contact-sheet page {page_path}: {exc}") from exc
            contained = ImageOps.contain(page, (slot_width, preview_height), method=Image.Resampling.LANCZOS)
            slot_x = x + 18 + page_index * (slot_width + page_gap)
            paste_x = slot_x + (slot_width - contained.width) // 2
            paste_y = preview_top + (preview_height - contained.height) // 2
            draw.rectangle(
                (slot_x, preview_top, slot_x + slot_width, preview_top + preview_height),
                fill=(248, 250, 252),
                outline=(203, 213, 225),
                width=1,
            )
            canvas.paste(contained, (paste_x, paste_y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, format="PNG", compress_level=6)
    return {
        "id": str(sheet.get("id", "")),
        "outputPath": str(output_path),
        "widthPx": canvas_width,
        "heightPx": canvas_height,
        "itemCount": len(items),
    }


def run_contact_sheets(request: dict[str, Any]) -> dict[str, Any]:
    sheets = request.get("sheets")
    if not isinstance(sheets, list) or not sheets:
        raise RenderAnalysisError("Contact-sheet request must contain at least one sheet")
    outputs = [render_contact_sheet(sheet) for sheet in sheets]
    return {
        "kind": "wmd_sales_folder_render_contact_sheets",
        "schemaVersion": 1,
        "sheets": outputs,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("analyze", "contact-sheets"))
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    request = read_json(args.request)
    result = run_analysis(request) if args.mode == "analyze" else run_contact_sheets(request)
    if args.output.exists():
        raise RenderAnalysisError(f"Refusing to overwrite helper output: {args.output}")
    write_json(args.output, result)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RenderAnalysisError as exc:
        raise SystemExit(f"REFUSED: {exc}") from exc
