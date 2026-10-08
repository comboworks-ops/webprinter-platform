#!/usr/bin/env python3
"""Bounded, read-only floor-sticker evidence; reuses the guarded HTTP bridge."""
import hashlib
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("guarded_scrapling", HERE / "scrapling/extract.py")
bridge = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = bridge
spec.loader.exec_module(bridge)
HOSTS = {"www.wir-machen-druck.de"}
BASE = "https://www.wir-machen-druck.de"
ENTRY = BASE + "/outdoor-fussbodenaufkleber--guenstig-drucken,category,24891.html"
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "output/gulvfolie-2026-09-30").resolve()
(ROOT / "raw").mkdir(parents=True, exist_ok=True)
(ROOT / "references").mkdir(exist_ok=True)
pages = []
previous = json.loads((ROOT / "raw/source.json").read_text()) if (ROOT / "raw/source.json").exists() else None
cached = {page["url"]: page for page in previous["pages"]} if previous else {}

def capture(url):
    if url in cached:
        pages.append(cached[url])
        return cached[url]
    bridge.check_robots(url, HOSTS, 30, 8 * 1024 * 1024)
    result = bridge.fetch_with_redirects(url, HOSTS, 30, 8 * 1024 * 1024)
    if int(result.response.status) != 200:
        raise RuntimeError(f"HTTP {result.response.status}: {url}")
    page = result.response
    key = urlsplit(url).path.strip("/").replace(",", "-").replace(".html", "")
    (ROOT / "raw" / f"{key}.html").write_bytes(page.body)
    details = {
        "url": url, "sourceSha256": hashlib.sha256(page.body).hexdigest(),
        "title": bridge.normalize_text(page.css("title::text").get()),
        "headings": [bridge.normalize_text(h.get_all_text(separator=" ", strip=True)) for h in page.css("h1,h4")],
        "text": bridge.normalize_text(page.css("body").first.get_all_text(separator=" ", strip=True)),
        "links": bridge.safe_resource_urls(page, url, "a::attr(href)", HOSTS),
        "images": bridge.safe_resource_urls(page, url, "img::attr(src)", HOSTS),
        "selects": [{"id": s.attrib.get("id"), "name": s.attrib.get("name"),
                     "options": [{"value": o.attrib.get("value"), "text": bridge.normalize_text(o.get_all_text(separator=" ", strip=True))} for o in s.css("option")]} for s in page.css("select")],
    }
    pages.append(details)
    print(f"Captured {key}", flush=True)
    return details

entry = capture(ENTRY)
categories = [u for u in entry["links"] if "/fussbodenaufkleber-outdoor-" in u and ",category," in u]
products = []
for url in categories:
    category = capture(url)
    for product_url in category["links"]:
        if "/hochwertige-zertifizierte-outdoor-fussbodenaufkleber-" in product_url and product_url not in products:
            products.append(product_url)

# The user's scope explicitly includes indoor: discover it through the parent.
parent_url = next(u for u in entry["links"] if "/fussbodenaufkleber-extrem-guenstig-drucken,category," in u)
parent = capture(parent_url)
indoor_url = next(u for u in parent["links"] if "/indoor-fussbodenaufkleber" in u and ",category," in u)
indoor = capture(indoor_url)
indoor_categories = [u for u in indoor["links"] if "/fussbodenaufkleber-indoor-" in u and ",category," in u]
for url in indoor_categories:
    category = capture(url)
    for u in category["links"]:
        if "/hochwertige-zertifizierte-indoor-fussbodenaufkleber-" in u and ",category," not in u and u not in products:
            products.append(u)

# Only exact discovered product pages. Preserve all shape-specific constraints.
if len(products) > 80:
    raise RuntimeError("Product boundary exceeded 80 pages")
for url in products:
    capture(url)

references = []
for page in pages:
    for url in page["images"]:
        if "/product-icon/" not in url or "fussboden" not in url:
            continue
        if any(r["url"] == url for r in references):
            continue
        response = bridge.fetch_with_redirects(url, HOSTS, 30, 8 * 1024 * 1024).response
        if int(response.status) != 200:
            raise RuntimeError(f"Reference download failed: {url}")
        key = url.split("/product-icon/")[1].split("/")[0]
        resolution = url.split("/product-icon/")[1].split("/")[1]
        file = "references/" + key + "--" + resolution + Path(urlsplit(url).path).suffix
        (ROOT / file).write_bytes(response.body)
        references.append({"url": url, "file": file, "sha256": hashlib.sha256(response.body).hexdigest()})

output = {"capturedAt": datetime.now(timezone.utc).isoformat(), "entryUrl": ENTRY,
          "reusedSnapshotCapturedAt": previous["capturedAt"] if previous else None,
          "allowedHosts": sorted(HOSTS), "pages": pages, "references": references,
          "writes": {"database": False, "pricing": False, "publishing": False}}
(ROOT / "raw/source.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"pages": len(pages), "references": len(references), "products": len(products)}))
