#!/usr/bin/env python3
"""Acquire official ECI profiles for local use, never for app redistribution."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile


PROFILES = [
    ("pso-coated_v3.zip", "PSOcoated_v3.icc", "c30ad2c01e8f93135ec7682c535e0a81bc2d177c301e196376c5f5838b5c8e86"),
    ("pso-uncoated_v3_fogra52.zip", "PSOuncoated_v3_FOGRA52.icc", "7c39f74fbede1e8c85f8fbb9df7d359aea638b9b68dd0854fdd3ba386e3a02c0"),
]


def main():
    destination = Path(__file__).resolve().parents[1] / "tmp/local-color-profiles"
    destination.mkdir(parents=True, exist_ok=True)
    for archive, filename, expected in PROFILES:
        target = destination / filename
        if target.exists() and sha256(target.read_bytes()).hexdigest() == expected:
            print(f"Already installed for local use: {filename}")
            continue
        request = Request(f"https://eci.org/lib/exe/{archive}", headers={"User-Agent": "Webprinter local profile setup"})
        with urlopen(request, timeout=30) as response:
            data = response.read(5_000_001)
        if len(data) > 5_000_000:
            raise ValueError("Profile archive exceeds the expected size limit")
        with ZipFile(BytesIO(data)) as package:
            matches = [entry for entry in package.infolist()
                       if Path(entry.filename).name == filename
                       and not entry.filename.startswith("__MACOSX/")]
            if len(matches) != 1 or matches[0].file_size > 4_000_000:
                raise ValueError(f"Unexpected archive contents: {archive}")
            profile = package.read(matches[0])
        if sha256(profile).hexdigest() != expected:
            raise ValueError(f"Publisher bytes changed; review before installing: {filename}")
        # Only write this known filename; never extract arbitrary archive paths.
        target.write_bytes(profile)
        print(f"Installed for local use: {filename}")
    print("ECI permits use and embedding. Do not bundle these files for redistribution without ECI permission.")


if __name__ == "__main__":
    main()
