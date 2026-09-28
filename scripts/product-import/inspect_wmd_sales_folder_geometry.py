#!/usr/bin/env python3
"""Read-only batch PDF text extraction for WMD sales-folder geometry audits."""

from __future__ import annotations

import hashlib
from io import BytesIO
import json
from pathlib import Path
import sys

try:
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover - environment failure reported to caller
    print(f"pypdf import failed: {exc}", file=sys.stderr)
    raise SystemExit(2)


MAX_FILES = 100
MAX_FILE_BYTES = 100 * 1024 * 1024
MAX_TEXT_CHARS = 2_000_000


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def inspect_file(item: dict) -> dict:
    key = str(item.get("key") or "")
    pathname = Path(str(item.get("path") or ""))
    if not key:
        return {"key": key, "error": "missing key"}
    try:
        stat = pathname.stat()
        if not pathname.is_file():
            raise ValueError("path is not a regular file")
        if stat.st_size > MAX_FILE_BYTES:
            raise ValueError(f"PDF exceeds {MAX_FILE_BYTES} byte limit")
        pdf_bytes = pathname.read_bytes()
        reader = PdfReader(BytesIO(pdf_bytes), strict=False)
        if reader.is_encrypted:
            raise ValueError("encrypted PDF is not supported")
        pages = []
        total_chars = 0
        for page_number, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text() or ""
            total_chars += len(page_text)
            if total_chars > MAX_TEXT_CHARS:
                raise ValueError(f"extracted text exceeds {MAX_TEXT_CHARS} character limit")
            pages.append({
                "pageNumber": page_number,
                "characterCount": len(page_text),
                "textSha256": sha256_text(page_text),
                "text": page_text,
            })
        combined = "\n\f\n".join(page["text"] for page in pages)
        return {
            "key": key,
            "fileSha256": hashlib.sha256(pdf_bytes).hexdigest(),
            "byteSize": len(pdf_bytes),
            "pageCount": len(pages),
            "characterCount": len(combined),
            "textSha256": sha256_text(combined),
            "text": combined,
            "pages": pages,
            "error": None,
        }
    except Exception as exc:  # fail one document closed without hiding other results
        return {"key": key, "error": f"{type(exc).__name__}: {exc}"}


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        print(f"invalid JSON input: {exc}", file=sys.stderr)
        return 2
    files = payload.get("files") if isinstance(payload, dict) else None
    if not isinstance(files, list) or not files or len(files) > MAX_FILES:
        print(f"files must be a non-empty array with at most {MAX_FILES} entries", file=sys.stderr)
        return 2
    results = [inspect_file(item if isinstance(item, dict) else {}) for item in files]
    json.dump({"schemaVersion": 1, "inspector": "pypdf", "results": results}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
