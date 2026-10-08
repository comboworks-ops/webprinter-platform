"""Offline exact-profile dimension contracts from hashed supplier PDFs.

The source's example artwork is not scaled. Only explicit dimension formulas
and primitive shape rules are projected. Own contours and example silhouettes
remain pending. This performs no database/network writes or PDF modification.
"""
import hashlib
import json
import pathlib
import re
from collections import Counter
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/roll-labels-2026-09-30'
BASE = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_rules(text):
    # Do not inherit margins or rounding from a sibling source document.
    compact = re.sub(r'\s+', ' ', text)
    bleed = set(float(n.replace(',', '.')) for n in re.findall(r'(\d+(?:[,.]\d+)?)\s*mm\s+Beschnitt\b', compact))
    safe = set(float(n.replace(',', '.')) for n in re.findall(r'Sicherheitsabstand:\s*(\d+(?:[,.]\d+)?)\s*mm', compact))
    radius = set(float(n.replace(',', '.')) for n in re.findall(r'Radius\s+von\s+(\d+(?:[,.]\d+)?)\s*mm', compact))
    addition = set(float(n.replace(',', '.')) for n in re.findall(r'\+\s*(\d+(?:[,.]\d+)?)\s*mm', compact))
    if len(bleed) != 1 or len(safe) != 1 or len(radius) > 1:
        raise ValueError('Missing or ambiguous explicit margin/radius')
    b, s = next(iter(bleed)), next(iter(safe))
    if b <= 0 or s <= 0 or addition != {2*b} or not re.search(r'auf allen Seiten', compact):
        raise ValueError('Dataformat formula or all-side safety rule unverified')
    return {'bleedMm': b, 'safeMm': s, 'cornerRadiusMm': next(iter(radius)) if radius else None}


def main():
    inventory = {d['url']: d for d in json.loads((SOURCE/'extraction/document-inventory.json').read_text())}
    profiles = [json.loads(line) for line in (BASE/'normalized/article-material-profiles.jsonl').read_text().splitlines()]
    cache, records = {}, []
    for p in profiles:
        if not p['format']['customSize']:
            continue
        record = {'profileKey': p['key'], 'articleId': p['articleId'], 'sourceMaterialId': p['sourceMaterialId'],
                  'familyId': p['familyId'], 'sourceEvidenceSha256': p['sourceEvidenceSha256'],
                  'status': 'source_geometry_pending', 'contract': None, 'blockers': []}
        try:
            material_bytes = (SOURCE/'extraction/articles'/p['articleId']/(p['sourceMaterialId']+'.json')).read_bytes()
            if digest(material_bytes) != p['sourceEvidenceSha256']:
                raise ValueError('Source material hash changed')
            if p['blockers'] or not p['customerArtworkRequired']:
                raise ValueError('Profile is blocked or requires no customer artwork')
            shape = p['format']['shape']
            if shape not in ['rectangle', 'circle']:
                raise ValueError('Exact offset geometry or customer contour contract requires review: '+shape)
            evidence = []
            rules = []
            for role in ['guide', 'template']:
                sources = [d for d in p['documents'] if d['role'] == role]
                if len(sources) != 1:
                    raise ValueError('Missing or ambiguous exact '+role)
                source = sources[0]
                document = inventory.get(source['url'])
                if not document or document['status'] != 'downloaded':
                    raise ValueError('Missing original source PDF')
                raw = (SOURCE/document['local_path']).read_bytes()
                if digest(raw) != document['sha256']:
                    raise ValueError('Source PDF hash changed')
                if document['sha256'] not in cache:
                    reader = PdfReader(SOURCE/document['local_path'])
                    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
                    cache[document['sha256']] = (read_rules(text), len(reader.pages), digest(text.encode()), re.sub(r'\s+', ' ', text).lower())
                rule, pages, text_hash, compact = cache[document['sha256']]
                if (shape == 'rectangle' and 'rechteck' not in compact) or (shape == 'circle' and not re.search(r'\brund\w*\b', compact)):
                    raise ValueError('Source PDF does not echo the selected primitive shape')
                if pages != 1:
                    raise ValueError('Multi-page primitive source requires review')
                rules.append(rule)
                evidence.append({'role':role, 'sourceUrl':document['url'], 'sha256':document['sha256'],
                                 'textSha256':text_hash, 'localPath':document['local_path']})
            if rules[0] != rules[1]:
                raise ValueError('Guide and template disagree on dimension rules')
            rule = rules[0]
            if shape == 'rectangle' and rule['cornerRadiusMm'] is None:
                raise ValueError('Rectangular corner rule not explicit')
            if shape == 'circle' and rule['cornerRadiusMm'] is not None:
                raise ValueError('Unexpected rounding rule for circle')
            contract = {'version':1, 'profileKey':p['key'], 'shape':shape, **rule,
                        'sourceEvidenceSha256':p['sourceEvidenceSha256'], 'evidence':evidence,
                        'geometryMode':'regenerate_physical_offsets_from_explicit_rules',
                        'sourcePagesAreExamples':True, 'onlineDesignerVerified':False}
            contract['sha256'] = digest(json.dumps(contract, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())
            record.update(status='primitive_size_geometry_documented', contract=contract)
        except (ValueError, KeyError) as e:
            record['blockers'].append(str(e))
        records.append(record)
    out = {'schemaVersion':1, 'scope':'hashed exact guide/template formulas; rectangle and circle only',
           'counts':dict(Counter(r['status'] for r in records)), 'profiles':records,
           'sourcePdfsModified':False, 'databaseWrites':False, 'DesignerAcceptance':False}
    (BASE/'source-size-geometry-contracts.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'profiles':len(records), 'counts':out['counts'], 'pdfsRehashed':len(cache), 'databaseWrites':False}))


if __name__ == '__main__':
    main()
