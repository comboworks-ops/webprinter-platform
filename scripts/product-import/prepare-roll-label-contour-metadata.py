"""Apply only the reviewed459 absent cutContourContract fields locally.

No shape acceptance, prices, core inputs, original PDFs or hosted mutation.
Exact byte before copies and all source evidence are retained for provenance.
"""
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'output/supplier-imports/roll-labels-catalogue-2026-10-06'
SOURCE = ROOT/'docs/roll-labels-2026-09-30'
OUT = ROOT/'output/qa/roll-labels-2026-10-06/root-contour-metadata-050'
sha = lambda b: hashlib.sha256(b).hexdigest()
inputs = {}


def read(path):
    raw = path.read_bytes()
    inputs[str(path.relative_to(ROOT))] = sha(raw)
    return raw


def main():
    proposal_path = ROOT/'output/qa/roll-labels-2026-10-06/predecessor006-complete-catalogue-replay-056/proposed459-contour-metadata-deltas.json'
    proposal_bytes = read(proposal_path)
    assert sha(proposal_bytes) == 'e5f905da1a9bf1699ac35da21c1521eeddb1e056d77dbd5589ffe573e3c7285a'
    proposal = json.loads(proposal_bytes)
    source_registry = json.loads(read(ROOT/proposal['sourceContractRegistryPath']))
    assert inputs[proposal['sourceContractRegistryPath']] == proposal['sourceContractRegistrySha256']
    source_audit_path = ROOT/'output/qa/roll-labels-2026-10-06/pending-contour-source-audit-013.json'
    source_audit_bytes = read(source_audit_path)
    assert sha(source_audit_bytes) == source_registry['sourceAuditSha256']
    audit = {r['profileKey']: r for r in json.loads(source_audit_bytes)['records'] if r['familyId'] == '25143'}
    contracts = {c['profileKey']: c for c in source_registry['contracts']}
    original = json.loads(read(BASE/'families/25143.json'))
    originals = {p['key']: p for p in original['profiles']}
    assert len(contracts) == len(audit) == len(proposal['profiles']) == 459
    pdfs = {}
    for item in proposal['profiles']:
        c = item['contract']
        assert c == contracts[item['profileKey']] and c['familyId'] == '25143'
        assert c['requirements'] == {'version': 1, 'spotName': 'Cutkontur', 'lineWidthPt': .25,
              'tint': 1, 'alternateCmyk': [0, 1, 0, 0], 'separateLayer': True, 'strokeOverprint': True}
        assert c['geometryVerified'] is c['onlineDesignerVerified'] is c['orderReady'] is False
        p, a = originals[item['profileKey']], audit[item['profileKey']]
        raw = read(SOURCE/p['sourceEvidencePath'])
        assert sha(raw) == p['sourceEvidenceSha256'] == c['sourceEvidenceSha256'] == a['sourceEvidenceSha256']
        material = json.loads(raw)
        assert str(material['article_id']) == p['articleId'] and str(material['material']['value']) == p['sourceMaterialId']
        guide = next(d for d in a['documents'] if d['role'] == 'guide')
        assert guide['sha256'] == c['guideSha256'] and guide['textSha256'] == c['guideTextSha256']
        assert a['guideCutContractComplete'] is True
        assert all(guide[k] is True for k in ['cutName', 'cutWidthPt025', 'spotColor', 'magenta100', 'overprint', 'separateLayer'])
        assert guide['sourceUrl'] == next(d['url'] for d in p['documents'] if d['role'] == 'guide')
        pdf = read(SOURCE/guide['localPath'])
        assert sha(pdf) == guide['sha256']
        if guide['sha256'] not in pdfs:
            reader = PdfReader(SOURCE/guide['localPath'])
            text = '\n'.join(page.extract_text() or '' for page in reader.pages)
            assert sha(text.encode()) == c['guideTextSha256']
            pdfs[guide['sha256']] = {'path': str((SOURCE/guide['localPath']).relative_to(ROOT)), 'sha256': sha(pdf), 'textSha256': sha(text.encode())}
    changes, after = [], {}
    for key in ['currentFamily', 'currentProductDraft']:
        target = ROOT/proposal[key+'Path']
        before = read(target)
        assert sha(before) == proposal[key+'Sha256']
        payload = json.loads(before)
        profiles = payload['profiles'] if key == 'currentFamily' else next(f for f in payload['families'] if f['familyId'] == '25143')['pricingStructure']['rollLabelConfiguration']['profiles']
        assert len(profiles) == 459
        for p in profiles:
            assert 'cutContourContract' not in p
            assert p['artworkInstructions']['sourceEvidenceSha256'] == contracts[p['key']]['sourceEvidenceSha256']
            assert p['format']['shape'] == 'source_specific' and p['customerArtworkRequired'] and p['orderReady'] is False
            p['cutContourContract'] = contracts[p['key']]
        encoded = (json.dumps(payload, ensure_ascii=False, indent=2)+'\n').encode()
        relative = str(target.relative_to(BASE))
        backup = OUT/'before-artifacts'/relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        with backup.open('xb') as f:
            f.write(before)
        after[str(target.relative_to(ROOT))] = encoded
        changes.append({'path': str(target.relative_to(ROOT)), 'beforeSha256': sha(before), 'afterSha256': sha(encoded)})
    for name in ['import-review/proposed-exact-prices.jsonl', 'dimension-documents/exact-size-bindings.jsonl', 'source-size-geometry-contracts.json']:
        read(BASE/name)
    # Revalidate all original bytes before the two bounded projections.
    for name, expected in inputs.items():
        assert sha((ROOT/name).read_bytes()) == expected
    for name, raw in after.items():
        (ROOT/name).write_bytes(raw)
    receipt = {'version': 1, 'profiles': 459, 'projectionCopies': 918, 'changes': changes,
        'proposalPath': str(proposal_path.relative_to(ROOT)), 'proposalSha256': sha(proposal_bytes),
        'sourceInputs': [{'path': p, 'sha256': h} for p, h in sorted(inputs.items())],
        'guidePdfs': list(pdfs.values()), 'geometryAccepted': False, 'designerAllowed': False,
        'orderReady': False, 'remoteWrites': False}
    with (OUT/'preparation.json').open('x') as file:
        file.write(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps({'profiles': 459, 'copies': 918, 'guides': len(pdfs), 'inputs': len(inputs),
                       'receiptSha256': sha((OUT/'preparation.json').read_bytes())}))


if __name__ == '__main__':
    main()
