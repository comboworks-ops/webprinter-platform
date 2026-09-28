#!/usr/bin/env python3
"""Guarded, read-only Scrapling extraction for supplier import evidence."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import re
import socket
import sys
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit

from protego import Protego
from scrapling.fetchers import Fetcher


USER_AGENT = "WebprinterSupplierImporter/1.0"
MAX_URL_LENGTH = 4_096
MAX_SELECTOR_LENGTH = 1_024
MAX_REDIRECTS = 3
MAX_LINKS = 1_000
DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 30


class ExtractionError(RuntimeError):
    pass


@dataclass(frozen=True)
class FetchResult:
    response: Any
    final_url: str
    redirects: tuple[str, ...]


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_host(value: str) -> str:
    host = value.strip().rstrip(".").lower()
    if not host or "://" in host or "/" in host or "@" in host or "*" in host:
        raise ExtractionError(f"Invalid allowlisted host: {value!r}")
    try:
        return host.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ExtractionError(f"Invalid allowlisted host: {value!r}") from exc


def validate_url(raw_url: str, allowed_hosts: set[str]) -> str:
    if not isinstance(raw_url, str) or not 1 <= len(raw_url) <= MAX_URL_LENGTH:
        raise ExtractionError("URL must contain 1-4096 characters")

    parsed = urlsplit(raw_url.strip())
    if parsed.scheme.lower() != "https":
        raise ExtractionError("Only HTTPS supplier URLs are allowed")
    if parsed.username or parsed.password:
        raise ExtractionError("Credentials in supplier URLs are forbidden")
    if not parsed.hostname:
        raise ExtractionError("Supplier URL has no hostname")

    host = normalize_host(parsed.hostname)
    if host not in allowed_hosts:
        raise ExtractionError(f"Supplier host is not allowlisted: {host}")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ExtractionError("Supplier URL has an invalid port") from exc
    if port not in (None, 443):
        raise ExtractionError("Only the standard HTTPS port is allowed")

    return urlunsplit(("https", parsed.netloc, parsed.path or "/", parsed.query, ""))


def assert_public_dns(host: str) -> list[str]:
    try:
        records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ExtractionError(f"Could not resolve supplier host {host}: {exc}") from exc

    addresses = sorted({record[4][0].split("%", 1)[0] for record in records})
    if not addresses:
        raise ExtractionError(f"Supplier host {host} resolved no addresses")
    for address in addresses:
        parsed_ip = ipaddress.ip_address(address)
        if not parsed_ip.is_global:
            raise ExtractionError(
                f"Supplier host {host} resolves to a non-public address; request refused"
            )
    return addresses


def response_text(response: Any) -> str:
    encoding = getattr(response, "encoding", None) or "utf-8"
    return bytes(response.body).decode(encoding, errors="replace")


def fetch_with_redirects(
    url: str,
    allowed_hosts: set[str],
    timeout_seconds: int,
    max_response_bytes: int,
) -> FetchResult:
    current_url = validate_url(url, allowed_hosts)
    redirects: list[str] = []

    for _ in range(MAX_REDIRECTS + 1):
        host = normalize_host(urlsplit(current_url).hostname or "")
        assert_public_dns(host)
        response = Fetcher.get(
            current_url,
            timeout=timeout_seconds,
            retries=1,
            retry_delay=1,
            follow_redirects=False,
            stealthy_headers=True,
            headers={"User-Agent": USER_AGENT},
        )
        body_size = len(response.body)
        if body_size > max_response_bytes:
            raise ExtractionError(
                f"Supplier response exceeds {max_response_bytes} bytes ({body_size} bytes)"
            )

        status = int(response.status)
        if status not in {301, 302, 303, 307, 308}:
            return FetchResult(response=response, final_url=current_url, redirects=tuple(redirects))

        location = response.headers.get("location") or response.headers.get("Location")
        if not location:
            raise ExtractionError(f"Supplier returned HTTP {status} without a redirect target")
        if len(redirects) >= MAX_REDIRECTS:
            raise ExtractionError(f"Supplier exceeded the {MAX_REDIRECTS}-redirect limit")
        current_url = validate_url(urljoin(current_url, location), allowed_hosts)
        redirects.append(current_url)

    raise ExtractionError("Supplier redirect handling failed")


def check_robots(
    target_url: str,
    allowed_hosts: set[str],
    timeout_seconds: int,
    max_response_bytes: int,
) -> dict[str, Any]:
    parsed = urlsplit(target_url)
    robots_url = urlunsplit(("https", parsed.netloc, "/robots.txt", "", ""))
    result = fetch_with_redirects(
        robots_url,
        allowed_hosts,
        min(timeout_seconds, 15),
        min(max_response_bytes, 1024 * 1024),
    )
    status = int(result.response.status)

    if status in {404, 410}:
        return {"url": result.final_url, "status": status, "allowed": True}
    if status != 200:
        raise ExtractionError(f"robots.txt returned HTTP {status}; refusing to crawl")

    parser = Protego.parse(response_text(result.response))
    allowed = bool(parser.can_fetch(target_url, USER_AGENT))
    if not allowed:
        raise ExtractionError("robots.txt disallows this supplier URL")
    return {"url": result.final_url, "status": status, "allowed": True}


def safe_resource_urls(document: Any, base_url: str, selector: str, allowed_hosts: set[str]) -> list[str]:
    values: list[str] = []
    for raw_value in document.css(selector).getall():
        if len(values) >= MAX_LINKS:
            break
        candidate = urljoin(base_url, str(raw_value).strip())
        try:
            values.append(validate_url(candidate, allowed_hosts))
        except ExtractionError:
            continue
    return list(dict.fromkeys(values))


def extract_document(document: Any, final_url: str, selector: str, allowed_hosts: set[str]) -> dict[str, Any]:
    targets = document.css(selector)
    li_texts: list[str] = []
    for target in targets:
        for item in target.css("li"):
            text = normalize_text(item.get_all_text(separator=" ", strip=True))
            if text:
                li_texts.append(text)
    li_texts = list(dict.fromkeys(li_texts))
    if not li_texts:
        raise ExtractionError(f"Scrapling found no LI texts under selector: {selector}")

    links = safe_resource_urls(document, final_url, "a::attr(href)", allowed_hosts)
    images = safe_resource_urls(document, final_url, "img::attr(src)", allowed_hosts)
    pdf_urls = [url for url in links if re.search(r"\.pdf(?:$|[?#])", url, re.IGNORECASE)]

    title = normalize_text(document.css("title::text").get() or "")
    heading = normalize_text(document.css("h1").first.get_all_text(separator=" ", strip=True)) if document.css("h1").first else ""
    description = normalize_text(
        document.css('meta[name="description"]::attr(content)').get() or ""
    )

    return {
        "selector": selector,
        "itemCount": len(li_texts),
        "liTexts": li_texts,
        "title": title,
        "heading": heading,
        "description": description,
        "links": links,
        "imageUrls": images,
        "pdfUrls": pdf_urls,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract read-only supplier evidence with Scrapling")
    parser.add_argument("--url", required=True)
    parser.add_argument("--selector", required=True)
    parser.add_argument("--allowed-host", action="append", required=True)
    parser.add_argument("--timeout-seconds", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--max-response-bytes", type=int, default=DEFAULT_MAX_RESPONSE_BYTES)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not 5 <= args.timeout_seconds <= 90:
        raise ExtractionError("timeout-seconds must be between 5 and 90")
    if not 1024 <= args.max_response_bytes <= 20 * 1024 * 1024:
        raise ExtractionError("max-response-bytes must be between 1 KiB and 20 MiB")
    if not 1 <= len(args.selector) <= MAX_SELECTOR_LENGTH or "\x00" in args.selector:
        raise ExtractionError("selector must contain 1-1024 safe characters")

    allowed_hosts = {normalize_host(value) for value in args.allowed_host}
    target_url = validate_url(args.url, allowed_hosts)
    robots = check_robots(
        target_url,
        allowed_hosts,
        args.timeout_seconds,
        args.max_response_bytes,
    )
    result = fetch_with_redirects(
        target_url,
        allowed_hosts,
        args.timeout_seconds,
        args.max_response_bytes,
    )
    status = int(result.response.status)
    if status != 200:
        raise ExtractionError(f"Supplier page returned HTTP {status}")

    extracted = extract_document(result.response, result.final_url, args.selector, allowed_hosts)
    output = {
        "provider": "scrapling-http",
        "engineVersion": "0.4.8",
        "entryUrl": target_url,
        "finalUrl": result.final_url,
        "redirects": list(result.redirects),
        "status": status,
        "robots": robots,
        "contentBytes": len(result.response.body),
        "sourceSha256": hashlib.sha256(result.response.body).hexdigest(),
        **extracted,
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ExtractionError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
