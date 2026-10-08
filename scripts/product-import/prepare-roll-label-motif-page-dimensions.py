"""Exact PDF page envelopes only; never accept oval/contour geometry.

Default is read-only source audit. --apply adds only pageDimensions to existing
motifDelivery metadata and retains byte-identical before artifacts. No network,
pricing, document generation, order/input model or hosted mutation.
"""
import hashlib
import json
import pathlib
import re
import sys
from collections import Counter
from urllib.parse import urljoin
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT/'docs/roll-labels-2026-09-30'
BASE = ROOT/'output/supplier-imports/roll-labels-catalogue-2026-10-06'
OUT = ROOT/'output/qa/roll-labels-2026-10-06/root-motif-page-dimensions-049'
REGISTRY = BASE/'source-motif-page-dimension-contracts.json'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
canonical = lambda obj: json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def prepare():
    inputs = {}
    def read(path):
        raw = path.read_bytes()
        inputs[str(path.relative_to(ROOT))] = sha(raw)
        return raw
    inventory = {d['url']: d for d in json.loads(read(SOURCE/'extraction/document-inventory.json'))}
    originals = {p['key']: p for file in sorted((BASE/'families').glob('*.json'))
                 for p in json.loads(read(file))['profiles']}
    rows, pdfs, families, before = [], {}, {}, {}
    for file in sorted((BASE/'review/families').glob('*.json')):
        raw_family = read(file)
        family = json.loads(raw_family)
        changed = False
        for p in family['profiles']:
            if not p.get('motifDelivery') or p['blockers'] or p.get('sizeGeometry'):
                continue
            assert p['customerArtworkRequired'] and p['format']['customSize']
            assert p['format']['shape'] in ['oval', 'custom_contour']
            assert 2 <= p['format']['motifCount'] <= 6 and not p['orderReady']
            assert 'pageDimensions' not in p['motifDelivery']
            source = originals[p['key']]
            material_bytes = read(SOURCE/source['sourceEvidencePath'])
            assert sha(material_bytes) == p['sourceEvidenceSha256'] == source['sourceEvidenceSha256']
            material = json.loads(material_bytes)
            assert str(material['article_id']) == p['articleId']
            assert str(material['material']['value']) == p['sourceMaterialId']
            evidence = []
            for role, source_key in [('guide', '1'), ('template', '2')]:
                docs = [d for d in source['documents'] if d['role'] == role]
                assert len(docs) == 1
                doc = inventory[docs[0]['url']]
                assert doc['status'] == 'downloaded'
                for key in ['template_evidence', 'canonical_template_evidence']:
                    captured = material[key]
                    assert captured['response']['code'] == 200
                    assert str(captured['request']['articleId']) == p['articleId']
                    assert str(captured['request']['substrateId']) == p['sourceMaterialId']
                    response = captured['response']['data']['response']
                    assert urljoin('https://www.wir-machen-druck.de/', response[source_key]) == doc['url']
                original_pdf = read(SOURCE/doc['local_path'])
                assert sha(original_pdf) == doc['sha256']
                if doc['sha256'] not in pdfs:
                    reader = PdfReader(SOURCE/doc['local_path'])
                    assert len(reader.pages) == 1
                    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
                    compact = re.sub(r'\s+', ' ', text)
                    # Require the FULL two-axis formula, not a generic +6 number.
                    formula = r'Datenformat:\s*\(X\s*\+\s*6\s*mm\)\s*x\s*\(Y\s*\+\s*6\s*mm\)'
                    assert re.search(formula, compact), doc['local_path']
                    assert re.search(r'Endformat:\s*X\s*x\s*Y\s*mm', compact)
                    bleed = set(float(n.replace(',', '.')) for n in re.findall(r'(\d+(?:[,.]\d+)?)\s*mm\s+Beschnitt\b', compact))
                    assert bleed == {3}, doc['local_path']
                    pdfs[doc['sha256']] = {'path': str((SOURCE/doc['local_path']).relative_to(ROOT)),
                        'sha256': doc['sha256'], 'textSha256': sha(text.encode()), 'pageCount': 1,
                        'formula': '(X + 6 mm) × (Y + 6 mm)',
                        'radiusMentionsMm': sorted(set(re.findall(r'Radius\s+von\s+(\d+)\s*mm', compact))),
                        'cutShapeAccepted': False}
                evidence.append({'role': role, 'sha256': doc['sha256'], 'textSha256': pdfs[doc['sha256']]['textSha256']})
            contract = {'version': 1, 'profileKey': p['key'],
                'sourceEvidenceSha256': p['sourceEvidenceSha256'], 'shape': p['format']['shape'],
                'motifCount': p['format']['motifCount'], 'sizeContract': p['sizeContract'],
                'bleedMm': 3, 'scope': 'pdf_page_dimensions_only', 'evidence': evidence,
                'cutShapeAccepted': False, 'designerAllowed': False, 'orderReady': False}
            contract['sha256'] = sha(canonical(contract))
            rows.append({'familyId': family['familyId'], 'profileKey': p['key'], 'contract': contract})
            p['motifDelivery']['pageDimensions'] = contract
            changed = True
        if changed:
            relative = str(file.relative_to(BASE))
            families[relative] = family
            before[relative] = raw_family
    assert len(rows) == 273 and len({r['profileKey'] for r in rows}) == 273
    assert Counter(r['contract']['shape'] for r in rows) == {'oval': 133, 'custom_contour': 140}
    assert len(pdfs) == 12 and len(families) == 2
    draft_file = BASE/'import-review/product-draft-plans.json'
    draft_bytes = read(draft_file)
    draft = json.loads(draft_bytes)
    by_key = {r['profileKey']: r['contract'] for r in rows}
    changed = 0
    for family in draft['families']:
        for p in family['pricingStructure']['rollLabelConfiguration']['profiles']:
            if p['key'] in by_key:
                assert 'pageDimensions' not in p['motifDelivery']
                assert p['motifDelivery']['sourceEvidenceSha256'] == by_key[p['key']]['sourceEvidenceSha256']
                p['motifDelivery']['pageDimensions'] = by_key[p['key']]
                changed += 1
    assert changed == 273
    families['import-review/product-draft-plans.json'] = draft
    before['import-review/product-draft-plans.json'] = draft_bytes
    protected = ['import-review/proposed-exact-prices.jsonl', 'dimension-documents/exact-size-bindings.jsonl',
                 'source-cut-contour-contracts.json', 'source-size-geometry-contracts.json']
    for relative in protected:
        read(BASE/relative)
    result = {'version': 1, 'scope': 'pdf_page_dimensions_only', 'profiles': rows, 'sourcePdfs': list(pdfs.values()),
              'sourceInputs': [{'path': p, 'sha256': h} for p, h in sorted(inputs.items())],
              'cutShapeAccepted': False, 'designerAllowed': False, 'orderReady': False, 'remoteWrites': False}
    OUT.mkdir(parents=True, exist_ok=True)
    audit = OUT/'source-audit.json'
    with audit.open('x') as out:
        out.write(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    if '--apply' not in sys.argv:
        print(json.dumps({'audit': str(audit.relative_to(ROOT)), 'profiles': len(rows), 'pdfs': len(pdfs), 'applied': False}))
        return
    assert not REGISTRY.exists()
    changes = []
    for relative, payload in families.items():
        target = BASE/relative
        assert target.read_bytes() == before[relative]
        backup = OUT/'before-artifacts'/relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        with backup.open('xb') as out:
            out.write(before[relative])
        after = (json.dumps(payload, ensure_ascii=False, indent=2)+'\n').encode()
        changes.append({'path': str(target.relative_to(ROOT)), 'beforeSha256': sha(before[relative]), 'afterSha256': sha(after)})
    # All before copies and deltas prepared before any catalogue projection.
    for change in changes:
        relative = str(pathlib.Path(change['path']).relative_to(BASE.relative_to(ROOT)))
        (BASE/relative).write_text(json.dumps(families[relative], ensure_ascii=False, indent=2)+'\n')
    with REGISTRY.open('x') as out:
        out.write(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    for relative in protected:
        assert sha((BASE/relative).read_bytes()) == inputs[str((BASE/relative).relative_to(ROOT))]
    receipt = {'version': 1, 'sourceAuditSha256': sha(audit.read_bytes()),
               'registrySha256': sha(REGISTRY.read_bytes()), 'changes': changes,
               'profiles': 273, 'projectionCopies': 546, 'cutShapeAccepted': False, 'remoteWrites': False}
    with (OUT/'preparation.json').open('x') as out:
        out.write(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps({'profiles': 273, 'projectionCopies': 546, 'sourceAuditSha256': receipt['sourceAuditSha256'],
                      'preparationSha256': sha((OUT/'preparation.json').read_bytes()), 'applied': True}))


if __name__ == '__main__':
    prepare()
