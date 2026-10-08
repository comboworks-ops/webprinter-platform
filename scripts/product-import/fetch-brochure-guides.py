#!/usr/bin/env python3
"""Fetch native guide PDFs using captured print-template responses; local evidence only."""
import hashlib, json, re, urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse
from pypdf import PdfReader

root = Path('output/brochure-2026-10-06')
templates = json.loads((root / 'documents/templates.json').read_text())
by_key = {template['key']: template for template in templates}
guides = []
for mapping in sorted((root / 'documents/source-map').glob('*.json')):
    source = json.loads(mapping.read_text())
    inventory = json.loads((root / 'inventory' / f"{source['articleId']}.json").read_text())
    key = 'free' if inventory['orientation'] == 'free' else f"{inventory['widthMm']}x{inventory['heightMm']}"
    response = source['response']
    urls = [urljoin('https://www.wir-machen-druck.de/', response[str(role)]) for role in [1, 2]]
    if urls[0] == urls[1] or any(urlparse(url).hostname != 'www.wir-machen-druck.de' or not urlparse(url).path.endswith('.pdf') for url in urls):
        raise ValueError(f'Invalid native guide/template mapping: {key}')
    if key != 'free' and by_key[key]['sourceUrl'] != urls[1]:
        raise ValueError(f'Native template mapping changed: {key}')
    guide_file = root / 'documents/source' / f'{key}-guide.pdf'
    if not guide_file.exists():
        with urllib.request.urlopen(urls[0], timeout=45) as remote:
            if urlparse(remote.url).hostname != 'www.wir-machen-druck.de': raise ValueError('Guide redirect outside supplier')
            payload = remote.read()
        temporary = guide_file.with_suffix('.pdf.part')
        temporary.write_bytes(payload); temporary.replace(guide_file)
    reader = PdfReader(guide_file)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    if not text.strip() or not re.search(r'Beschnitt|Datenformat|Druckdaten', text, re.I):
        raise ValueError(f'Unrecognized guide: {key}')
    if not all(re.search(pattern, text, re.I) for pattern in [r'3\s*mm\s*Beschnitt', r'Sicherheitsabstand:\s*3\s*mm', r'CMYK', r'300\s*dpi', r'PDF', r'Schriften']):
        raise ValueError(f'Guide production facts changed: {key}')
    if key == 'free':
        if not re.search(r'Datenformat:\s*\(X\+6\)\s*x\s*\(Y\+6\)\s*mm', text): raise ValueError('Free guide geometry changed')
    else:
        data_format = re.search(r'Datenformat:\s*(\d+)\s*x\s*(\d+)\s*mm', text)
        if not data_format or (int(data_format[1]), int(data_format[2])) != (inventory['widthMm'] + 6, inventory['heightMm'] + 6):
            raise ValueError(f'Guide and selected format differ: {key}')
    text_file = root / 'documents/source' / f'{key}-guide.txt'
    text_file.write_text(text)
    guides.append({'key': key, 'sourceArticleId': source['articleId'], 'substrateId': source['substrateId'],
        'guideSourceUrl': urls[0], 'templateSourceUrl': urls[1], 'guidePath': str(guide_file.relative_to(root)),
        'guideSha256': hashlib.sha256(guide_file.read_bytes()).hexdigest(), 'guidePages': len(reader.pages),
        'textPath': str(text_file.relative_to(root)), 'factsReviewed': True,
        'reviewedFacts': {'bleedMm': 3, 'sourceSafetyMm': 3, 'designerSafeInsetFromTrimMm': 3, 'colorMode': 'CMYK', 'minimumDpi': 300, 'fileType': 'PDF', 'embedFonts': True}})
    print(f'Captured native guide {key}: {len(reader.pages)} pages', flush=True)
(root / 'documents/native-guides.json').write_text(json.dumps(guides, ensure_ascii=False, indent=2))
