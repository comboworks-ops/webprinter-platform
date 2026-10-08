"""Offline semantic proposal preparation; no source geometry is accepted here.

Reads every exact oval profile and its original material/PDF evidence. The
result is a separate review artifact, never a sizeGeometry/canonical registry.
"""
import hashlib
import html
import importlib.util
import json
import pathlib
import re
from collections import Counter
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/roll-labels-2026-09-30'
BASE = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'
TARGET = ROOT / 'output/qa/roll-labels-2026-10-06/semantic-014'
spec = importlib.util.spec_from_file_location('size_rules', ROOT/'scripts/product-import/audit-roll-label-size-geometry.py')
rules_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rules_module)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def compact(raw):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(html.unescape(raw)))).strip()


def restrictions(text):
    """Signals require review; absence is not proof of a production exemption."""
    found = []
    for key, pattern in [
        ('sandwich_inner_cutouts', r'sandwich|innenausstanz|innenstanz'),
        ('variable_data_files', r'nummerierung|codierung|excelliste|exceldatei|_ansicht'),
        ('supplier_creates_cutline', r'keine Konturlinie|Erstellen der Konturlinie.*übernehmen wir'),
        ('customer_cutline', r'vektorisierte Konturlinie|cutkontur'),
        ('multiple_motif_pages', r'Seite 1\s*=\s*Motiv|mehrseitige PDF'),
        ('corner_rounding_rule', r'Radius von 2\s*mm'),
    ]:
        match = re.search(pattern, text, re.I)
        if match:
            found.append({'kind': key, 'excerpt': text[max(0, match.start()-70):match.end()+160]})
    return found


def main():
    inventory = {d['url']: d for d in json.loads((SOURCE/'extraction/document-inventory.json').read_text())}
    cache, records = {}, []
    for file in sorted((BASE/'families').glob('*.json')):
        family = json.loads(file.read_text())
        current = json.loads((BASE/'review/families'/file.name).read_text())
        current_profiles = {p['key']: p for p in current['profiles']}
        for profile in family['profiles']:
            if profile['format']['shape'] != 'oval' or not profile['format']['customSize']:
                continue
            p = current_profiles[profile['key']]
            raw_bytes = (SOURCE/profile['sourceEvidencePath']).read_bytes()
            if sha(raw_bytes) != profile['sourceEvidenceSha256']:
                raise ValueError('Changed source material: '+profile['key'])
            raw = json.loads(raw_bytes)
            if str(raw['article_id']) != profile['articleId'] or str(raw['material']['value']) != profile['sourceMaterialId']:
                raise ValueError('Foreign source material identity')
            if p.get('artworkInstructions') and p['artworkInstructions']['sourceEvidenceSha256'] != profile['sourceEvidenceSha256']:
                raise ValueError('Changed current material binding')
            descriptions = sorted(set(compact(q['evidence']['response']['data']['response'].get('articleDescription', '')) for q in raw['quotes']))
            article_text = '\n'.join(descriptions)
            conditions = [{**c, 'role': 'article_description', 'textSha256': sha(article_text.encode())} for c in restrictions(article_text)]
            docs, problems = [], []
            for role in ['guide', 'template']:
                bindings = [d for d in profile['documents'] if d['role'] == role]
                if len(bindings) != 1:
                    problems.append('missing_or_ambiguous_'+role)
                    continue
                doc = inventory.get(bindings[0]['url'])
                if not doc or doc['status'] != 'downloaded':
                    problems.append('missing_source_'+role)
                    continue
                path = SOURCE/doc['local_path']
                original = path.read_bytes()
                if sha(original) != doc['sha256']:
                    raise ValueError('Changed source PDF: '+str(path))
                if doc['sha256'] not in cache:
                    reader = PdfReader(path)
                    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
                    try:
                        rules, error = rules_module.read_rules(text), None
                    except ValueError as e:
                        rules, error = None, str(e)
                    cache[doc['sha256']] = {'sha256': doc['sha256'], 'textSha256': sha(text.encode()),
                        'localPath': doc['local_path'], 'sourceUrl': doc['url'], 'pageCount': len(reader.pages),
                        'explicitRules': rules, 'ruleError': error, 'ovalLabel': bool(re.search(r'\boval\b', text, re.I)),
                        'restrictions': restrictions(compact(text))}
                document = {**cache[doc['sha256']], 'role': role}
                docs.append(document)
                conditions.extend({**c, 'role': role, 'textSha256': document['textSha256']} for c in document['restrictions'])
            if len(docs) == 2:
                if any(d['pageCount'] != 1 or not d['ovalLabel'] for d in docs):
                    problems.append('single_page_oval_pair_unproved')
                if not docs[0]['explicitRules'] or docs[0]['explicitRules'] != docs[1]['explicitRules']:
                    problems.append('consistent_margin_pair_unproved')
            if p['blockers']:
                problems.extend(p['blockers'])
            if not p['customerArtworkRequired']:
                problems.append('no_customer_artwork')
            if any(c['kind'] == 'sandwich_inner_cutouts' for c in conditions) or profile['key'] == '63738:1269564':
                problems.append('sandwich_not_plain_oval')
            records.append({'version': 1, 'familyId': current['familyId'], 'productId': current['productId'],
                'profileKey': p['key'], 'articleId': p['articleId'], 'materialId': p['sourceMaterialId'],
                'sourceEvidenceSha256': profile['sourceEvidenceSha256'], 'sourceEvidencePath': profile['sourceEvidencePath'],
                'sourceTitle': next(a['titleOriginal'] for a in family['articles'] if a['articleId'] == p['articleId']),
                'materialLabelDa': profile['labelDa'], 'articleDescriptionText': article_text,
                'articleDescriptionTextSha256': sha(article_text.encode()), 'sourceDocuments': docs,
                'sourceRestrictions': conditions, 'proposalEligible': not problems, 'blockers': problems,
                'supplierEllipseIdentityProved': False, 'sourceGeometryAccepted': False, 'onlineDesignerVerified': False, 'orderReady': False})
    if len(records) != 302 or len({r['profileKey'] for r in records}) != 302:
        raise ValueError('Incomplete exact oval coverage')
    result = {'version': 1, 'records': records, 'counts': {'profiles': len(records), 'families': len({r['familyId'] for r in records}),
        'proposals': sum(r['proposalEligible'] for r in records), 'originalPdfsRehashed': len(cache),
        'restrictions': dict(Counter(c['kind'] for r in records for c in r['sourceRestrictions']))},
        'sourceGeometryAccepted': False, 'catalogueRegenerated': False, 'remoteWrites': False}
    TARGET.mkdir(exist_ok=True, parents=True)
    target = TARGET/'oval-source-review.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'path': str(target), 'sha256': sha(target.read_bytes()), 'counts': result['counts']}))


if __name__ == '__main__':
    main()
