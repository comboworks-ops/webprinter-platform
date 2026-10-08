"""Offline source-bound triage, never a production-layer approval.

Re-extracts original PDF text without editing originals or template candidates.
Material and selectable-effect signals cannot establish a spot-color name,
overprint behavior or online Designer compatibility.
"""
import collections, hashlib, json, pathlib, re
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/roll-labels-2026-09-30'
OUT = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def source_signals(material_label, article_title, option_fields, artwork_required):
    if not artwork_required:
        return {'whitePrint': 'not_applicable', 'selectiveEffects': [], 'factoryCoating': [], 'maskReviewRequired': False}
    white = ('explicitly_excluded' if re.search(r'ohne\s+Wei(?:ß|ss)druck', material_label, re.I)
             else 'included_by_material' if re.search(r'mit\s+(?:partiellem\s+)?Wei(?:ß|ss)druck', material_label, re.I)
             else 'not_stated')
    selective = []
    pattern = re.compile(r'Hei(?:ß|ss)folien|(?:Gold|Silber)folienpr[äa]gung|Spotlack|Teillackierung', re.I)
    for origin, text in [('material', material_label), ('article', article_title)]:
        if pattern.search(text):
            selective.append({'origin': origin, 'labelOriginal': text})
    for field in option_fields:
        for value in field['values']:
            text = value['sourceValue']
            if pattern.search(text):
                selective.append({'origin': 'option', 'sourceFieldId': field['sourceFieldId'],
                                  'sourceValueId': value['sourceValueId'], 'labelOriginal': text})
    coatings = [name for name, regex in [('lamination', r'Folienkaschierung'), ('full_surface_uv', r'(?:Glanz|Matt)-UV-Lack')]
                if re.search(regex, material_label + ' ' + article_title, re.I)]
    return {'whitePrint': white, 'selectiveEffects': selective, 'factoryCoating': coatings,
            'maskReviewRequired': white == 'included_by_material' or bool(selective)}

def main():
    profiles = [json.loads(line) for line in (OUT / 'normalized/article-material-profiles.jsonl').read_text().splitlines() if line]
    inventory = json.loads((SOURCE / 'extraction/document-inventory.json').read_text())
    structures = {row['local_path']: row for row in json.loads((SOURCE / 'extraction/pdf-structure-inventory.json').read_text())}
    documents = {}
    terms = re.compile(r'Wei(?:ß|ss)druck|\bWhite\b|Volltonfarbe|Sonderfarbe|Hei(?:ß|ss)folien|Spotlack|Teillackierung|Cutkontur|CutContour', re.I)
    for document in inventory:
        path = SOURCE / document['local_path']
        if sha(path.read_bytes()) != document['sha256'] or structures[document['local_path']]['sha256'] != document['sha256']:
            raise ValueError('Changed original document: ' + str(path))
        reader = PdfReader(path)
        pages = [page.extract_text() or '' for page in reader.pages]
        excerpts = []
        for number, text in enumerate(pages, 1):
            for match in terms.finditer(text):
                excerpt = re.sub(r'\s+', ' ', text[max(0, match.start()-120):match.end()+180]).strip()
                item = {'page': number, 'matchedTerm': match.group(), 'textOriginal': excerpt}
                if item not in excerpts:
                    excerpts.append(item)
        documents[document['url']] = {'url': document['url'], 'path': document['local_path'],
            'sha256': document['sha256'], 'textSha256': sha('\n\n'.join(pages).encode()),
            'pageCount': len(pages), 'excerpts': excerpts, 'sourceOnly': True}
    articles = {article['articleId']: article for file in (OUT / 'families').glob('*.json')
                for article in json.loads(file.read_text())['articles']}
    rows = []
    for profile in profiles:
        source = SOURCE / profile['sourceEvidencePath']
        if sha(source.read_bytes()) != profile['sourceEvidenceSha256']:
            raise ValueError('Changed source profile: ' + profile['key'])
        signals = source_signals(profile['labelOriginal'], articles[profile['articleId']]['titleOriginal'],
                                 profile['optionFields'], profile['customerArtworkRequired'])
        bound = [documents[doc['url']] for doc in profile['documents'] if doc['url'] in documents]
        missing = [doc['url'] for doc in profile['documents'] if doc['url'] not in documents]
        white_or_effect = any(re.search(r'Wei(?:ß|ss)druck|\bWhite\b|Hei(?:ß|ss)folien|Spotlack|Teillackierung',
                                       excerpt['matchedTerm'], re.I) for doc in bound for excerpt in doc['excerpts'])
        rows.append({'profileKey': profile['key'], 'familyId': profile['familyId'],
            'articleId': profile['articleId'], 'sourceMaterialId': profile['sourceMaterialId'],
            'sourceEvidenceSha256': profile['sourceEvidenceSha256'], 'signals': signals,
            'documentEvidence': [{'url': doc['url'], 'sha256': doc['sha256'], 'textSha256': doc['textSha256']}
                                 for doc in bound], 'missingDocumentReferences': missing,
            'whiteOrEffectInstructionFoundInBoundPdfs': white_or_effect,
            'productionLayerNamesApproved': [], 'onlineDesignerVerified': False,
            'reviewStatus': 'no_customer_artwork' if not profile['customerArtworkRequired'] else
                            'mask_instructions_pending' if signals['maskReviewRequired'] else 'geometry_and_special_rules_pending',
            'profileBlockersPreserved': profile['blockers']})
    counts = {'profiles': len(rows), 'originalPdfsRehashedAndRead': len(documents),
              'whitePrintIncluded': sum(row['signals']['whitePrint'] == 'included_by_material' for row in rows),
              'whitePrintExplicitlyExcluded': sum(row['signals']['whitePrint'] == 'explicitly_excluded' for row in rows),
              'selectiveEffectProfiles': sum(bool(row['signals']['selectiveEffects']) for row in rows),
              'maskReviewRequired': sum(row['signals']['maskReviewRequired'] for row in rows),
              'noCustomerArtwork': sum(row['reviewStatus'] == 'no_customer_artwork' for row in rows),
              'boundWhiteOrEffectInstructionsFound': sum(row['whiteOrEffectInstructionFoundInBoundPdfs'] for row in rows)}
    artifact = {'version': 1, 'scope': 'Exact saved article/material triage; not production layer or Designer approval',
                'databaseWrites': False, 'templatesModified': False, 'counts': counts,
                'reviewStatuses': dict(collections.Counter(row['reviewStatus'] for row in rows)),
                'documents': list(documents.values()), 'profiles': rows}
    (OUT / 'artwork-requirements-audit.json').write_text(json.dumps(artifact, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(counts))

if __name__ == '__main__':
    main()
