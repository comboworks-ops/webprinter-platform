#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

from scrapling import Selector


MODULE_PATH = Path(__file__).with_name("extract.py")
SPEC = importlib.util.spec_from_file_location("webprinter_scrapling_extract", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ScraplingExtractTests(unittest.TestCase):
    def test_extracts_ordered_text_and_same_host_resources(self) -> None:
        html = """
        <html><head><title>Folder</title><meta name="description" content="Folder guide"></head>
        <body><h1>DIN Lang</h1>
          <ul class="prices"><li>50 Stück (27,77 Euro netto)</li><li>100 Stück (31,20 Euro netto)</li></ul>
          <a href="/guide.pdf">Guide</a><a href="https://tracking.example/pixel">Tracking</a>
          <img src="/folder.png">
        </body></html>
        """
        document = Selector(html, url="https://supplier.example/product")
        result = MODULE.extract_document(
            document,
            "https://supplier.example/product",
            "ul.prices",
            {"supplier.example"},
        )

        self.assertEqual(
            result["liTexts"],
            ["50 Stück (27,77 Euro netto)", "100 Stück (31,20 Euro netto)"],
        )
        self.assertEqual(result["pdfUrls"], ["https://supplier.example/guide.pdf"])
        self.assertEqual(result["imageUrls"], ["https://supplier.example/folder.png"])
        self.assertEqual(result["heading"], "DIN Lang")

    def test_rejects_non_https_and_non_allowlisted_urls(self) -> None:
        with self.assertRaisesRegex(MODULE.ExtractionError, "Only HTTPS"):
            MODULE.validate_url("http://supplier.example/product", {"supplier.example"})
        with self.assertRaisesRegex(MODULE.ExtractionError, "not allowlisted"):
            MODULE.validate_url("https://other.example/product", {"supplier.example"})

    def test_rejects_private_dns_results(self) -> None:
        with self.assertRaisesRegex(MODULE.ExtractionError, "non-public"):
            original = MODULE.socket.getaddrinfo
            try:
                MODULE.socket.getaddrinfo = lambda *_args, **_kwargs: [
                    (MODULE.socket.AF_INET, MODULE.socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))
                ]
                MODULE.assert_public_dns("supplier.example")
            finally:
                MODULE.socket.getaddrinfo = original


if __name__ == "__main__":
    unittest.main()
