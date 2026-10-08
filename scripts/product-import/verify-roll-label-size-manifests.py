"""Independent read-only hash/identity/PDF audit of dimensional schema-2 slices."""
from pathlib import Path
import hashlib
import json
import argparse
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'
PACKAGES = BASE / 'canonical-size-manifests'
SOURCE = ROOT / 'docs/roll-labels-2026-09-30'

def read(file):
    return json.loads(file.read_text())

def lines(file):
    return [json.loads(line) for line in file.read_text().splitlines() if line]

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def signature(selection):
    return json.dumps(selection, sort_keys=True, separators=(',', ':'))

def close(a, b):
    assert abs(float(a) - float(b)) < 1e-5, (a, b)

def contained(directory, relative):
    file = (directory / relative).resolve()
    assert file.is_relative_to(directory.resolve()), 'Foreign package path'
    return file

def audit(receipt_name='size-manifests-independent-latest.json'):
    registry = read(PACKAGES / 'registry.json')
    price_path = BASE / 'import-review/proposed-exact-prices.jsonl'
    assert sha(price_path) == registry['sourceExactPricesSha256']
    source_prices = {row['extraData']['signature']: row for row in lines(price_path)}
    profiles = {row['key']: row for row in lines(BASE / 'normalized/article-material-profiles.jsonl')}
    candidates = {row['sourceQuoteSignature']: row for row in lines(BASE / 'dimension-documents/exact-size-bindings.jsonl')}
    allowed = {'mask_rules_documented', 'no_selective_mask_required_by_signals'}
    checked_pdfs = {}
    counts = {'slices': 0, 'profiles': 0, 'priceRows': 0, 'documentBindings': 0, 'excludedMaterialRuleRows': 0}
    all_keys = set()
    assert len(registry['families']) == 42
    assert not registry['databaseWrites'] and not registry['fullCatalogueComplete'] and not registry['ordinaryDesignerBindingVerified']
    for family in registry['families']:
        directory = PACKAGES / family['familyId']
        coverage = read(directory / 'coverage.json')
        assert not coverage['fullFamilyComplete'] and not coverage['retailReady']
        counts['excludedMaterialRuleRows'] += len(coverage['excluded'])
        for excluded in coverage['excluded']:
            assert candidates[excluded['sourceQuoteSignature']]['materialArtworkDocumentationStatus'] not in allowed
        if not family['canonicalManifestValidated']:
            assert family['priceRows'] == 0 and not coverage['eligibleProfileKeys']
            continue
        manifest_path = contained(PACKAGES, family['manifestPath'])
        assert sha(manifest_path) == family['manifestSha256']
        manifest = read(manifest_path)
        assert manifest['target']['state'] == 'extracted' and manifest['target']['tenantId'] is None
        for key in ['writeBank', 'writeProduct', 'writeLivePricing', 'publishProduct']:
            assert manifest['target'][key] is False
        assert manifest['pricing']['conversionApproval'] == 'proposed_unapproved'
        assert manifest['pricing']['interpolationAllowed'] is False
        assert all(value is False for key, value in manifest['readiness'].items() if key.startswith('approvedFor'))
        assert not manifest['readiness']['fullFamilyComplete']
        for descriptor in [manifest['pricing']['recordsArtifact'], manifest['documents']['recordsArtifact']]:
            file = contained(directory, descriptor['path'])
            assert sha(file) == descriptor['sha256'] and file.stat().st_size == descriptor['bytes']
            assert len(lines(file)) == descriptor['rowCount']
        prices = lines(directory / manifest['pricing']['recordsArtifact']['path'])
        documents = lines(directory / manifest['documents']['recordsArtifact']['path'])
        by_match = {signature(d['match']): d for d in documents}
        assert len(by_match) == len(documents)
        used = set()
        for index, row in enumerate(prices):
            assert row['sourceOrder'] == index
            key = row['extraData']['signature']
            source = source_prices[key]
            # The only allowed price-row change is the local JSONL row ordering.
            assert {k: v for k, v in row.items() if k != 'sourceOrder'} == {k: v for k, v in source.items() if k != 'sourceOrder'}
            candidate = candidates[key]
            assert candidate['familyId'] == family['familyId'] and candidate['profileKey'] == row['sourceKey']
            profile = profiles[row['sourceKey']]
            assert not profile['blockers'] and profile['format']['customSize'] and not profile['orderReady']
            source_file = contained(SOURCE, profile['sourceEvidencePath'])
            assert sha(source_file) == profile['sourceEvidenceSha256']
            document = by_match[signature(row['selections'])]
            assert document['supplierIdentity'] == {'articleId': candidate['articleId'], 'materialId': candidate['materialId']}
            assert document['template']['sanitizedPdfSha256'] == candidate['template']['sha256']
            assert document['guide']['nativeGuideSha256'] == candidate['guide']['sha256']
            assert document['template']['derivation']['sourceGeometryContractSha256'] == candidate['sourceGeometryContractSha256']
            assert key in document['template']['derivation']['sourceQuoteSignatures']
            used.add(signature(document['match']))
        assert used == set(by_match)
        for index, document in enumerate(documents):
            assert document['sourceOrder'] == index
            template = document['template']
            assert template['artworkMode'] == 'professional_pdf_upload_only' and template['onlineDesignerAllowed'] is False
            assert template['designerTemplateId'] is None and template['verificationStatus'] == 'not_applicable'
            assert template['hostedBindingVerified'] is False
            assert document['guide']['materialArtworkDocumentationStatus'] in allowed and not document['guide']['maskExportVerified']
            pdf_file = contained(directory, template['sanitizedPdfPath'])
            guide_file = contained(directory, document['guide']['nativeGuidePath'])
            assert sha(pdf_file) == template['sanitizedPdfSha256']
            assert sha(guide_file) == document['guide']['nativeGuideSha256']
            guide = read(guide_file)
            for key, field in [('finishedWidthMm', 'widthMm'), ('finishedHeightMm', 'heightMm'), ('bleedMm', 'bleedMm'), ('safeAreaMm', 'safeMm')]:
                close(guide[key], template[field])
            assert guide['vectorGuide']['geometryContractSha256'] == template['derivation']['sourceGeometryContractSha256']
            # Read actual bytes independently of metadata dimensions.
            if template['sanitizedPdfSha256'] not in checked_pdfs:
                reader = PdfReader(pdf_file)
                assert len(reader.pages) == 1
                page = reader.pages[0]
                pt = 72 / 25.4
                close(page.mediabox.width / pt, template['widthMm'] + 2 * template['bleedMm'])
                close(page.mediabox.height / pt, template['heightMm'] + 2 * template['bleedMm'])
                close(page.trimbox.width / pt, template['widthMm'])
                close(page.trimbox.height / pt, template['heightMm'])
                assert not page.images
                text = page.extract_text()
                legend = template['legend']
                if legend.get('layout') == 'bleed_bands':
                    assert all(label in text for label in ['Sikkerhed', 'Data', 'Stans'])
                    assert legend['fontPt'] >= 5
                    for panel in legend['panelsPt']:
                        assert panel[0] >= 0 and panel[2] <= float(page.mediabox.width)
                        assert panel[1] >= 0 and panel[3] <= float(page.mediabox.height)
                        assert panel[3] < template['bleedMm'] * pt or panel[1] > (template['heightMm'] + template['bleedMm']) * pt
                    for line in legend['textBounds']:
                        box = line['bboxPt']
                        assert any(box[0] >= panel[0] + legend['paddingPt'] and box[2] <= panel[2] - legend['paddingPt'] + .001
                                   and box[1] >= panel[1] + legend['paddingPt'] and box[3] <= panel[3] - legend['paddingPt'] + .001
                                   for panel in legend['panelsPt'])
                else:
                    assert 'Sikkerhedsafstand' in text and 'Dataformat' in text and 'Stans' in text
                assert 'wir-machen-druck' not in text.lower() and 'wirmachendruck' not in str(reader.metadata).lower()
                checked_pdfs[template['sanitizedPdfSha256']] = [template['widthMm'], template['heightMm'], template['bleedMm']]
            assert checked_pdfs[template['sanitizedPdfSha256']] == [template['widthMm'], template['heightMm'], template['bleedMm']]
            for source in template['derivation']['sourcePdfEvidence']:
                assert sha(contained(SOURCE, source['localPath'])) == source['sha256']
        keys = set(coverage['eligibleProfileKeys'])
        assert keys == {row['sourceKey'] for row in prices} and not keys.intersection(all_keys)
        all_keys.update(keys)
        counts['slices'] += 1
        counts['profiles'] += len(keys)
        counts['priceRows'] += len(prices)
        counts['documentBindings'] += len(documents)
    assert counts == {'slices': registry['validSlices'], 'profiles': registry['validProfiles'], 'priceRows': registry['exactPriceRows'],
                      'documentBindings': registry['documentBindings'], 'excludedMaterialRuleRows': registry['excludedMaterialRulePriceRows']}
    combined = read(BASE / 'combined-document-review-008.json')
    assert combined['sourceExactPricesSha256'] == registry['sourceExactPricesSha256']
    assert combined['totalFamilies'] == len(combined['families']) == 42
    assert combined['totalProfiles'] == sum(len(f['profiles']) for f in combined['families']) == 2551
    union_keys, union_quotes, union_documents = set(), set(), 0
    union_coverage = {}
    for family in combined['families']:
        assert not family['fullFamilyComplete'] and family['tenantId'] is None
        assert all(family[key] is False for key in ['bankWriteApproved', 'productWriteApproved', 'livePricingApproved', 'publicationApproved'])
        for profile in family['profiles']:
            union_coverage[profile['status']] = union_coverage.get(profile['status'], 0) + 1
            assert not profile['retailReady']
        for package in family['packages']:
            file = contained(BASE, package['manifestPath'])
            assert sha(file) == package['manifestSha256']
            manifest = read(file)
            rows = lines(contained(file.parent, manifest['pricing']['recordsArtifact']['path']))
            documents = lines(contained(file.parent, manifest['documents']['recordsArtifact']['path']))
            keys = {row['sourceKey'] for row in rows}
            assert len(keys) == package['profiles'] and not keys.intersection(union_keys)
            union_keys.update(keys)
            for row in rows:
                source = source_prices[row['extraData']['signature']]
                assert {k: v for k, v in row.items() if k != 'sourceOrder'} == {k: v for k, v in source.items() if k != 'sourceOrder'}
                assert row['extraData']['signature'] not in union_quotes
                union_quotes.add(row['extraData']['signature'])
            assert len(documents) == package['documentBindings'] and len(rows) == package['priceRows']
            union_documents += len(documents)
    assert union_coverage == combined['coverage']
    assert len(union_keys) == combined['structuralDocumentSliceProfiles'] == registry['validProfiles'] + 500
    assert len(union_quotes) == combined['exactPriceRowsInSlices'] == registry['exactPriceRows'] + 1500
    assert union_documents == combined['documentBindingsInSlices'] == registry['documentBindings'] + 500
    assert not combined['databaseWrites'] and not combined['retailReady'] and not combined['fullCatalogueComplete']
    assert sha(price_path) == registry['sourceExactPricesSha256']
    result = {'status': 'passed', 'counts': counts, 'uniquePdfsPhysicallyInspected': len(checked_pdfs),
              'sourceExactPricesSha256': registry['sourceExactPricesSha256'], 'monetaryRowsChanged': 0,
              'sourceFilesAndPdfBytesRehashed': True,
              'combinedFixedAndDimensionSlices': {'profiles': len(union_keys), 'priceRows': len(union_quotes), 'documentBindings': union_documents,
                                                'families': combined['familiesWithDocumentSlices'], 'coverage': union_coverage},
              'hostedAcceptance': False, 'databaseWrites': False, 'fullCatalogueComplete': False}
    assert Path(receipt_name).name == receipt_name and receipt_name.endswith('.json')
    receipt = BASE / '../../qa/roll-labels-2026-10-06' / receipt_name
    receipt.resolve().write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--receipt-name', default='size-manifests-independent-latest.json')
    audit(parser.parse_args().receipt_name)
