"""Independent readback of current024 application projections and raw witnesses.

No source recapture, price transfer or acceptance of coding production artwork.
"""
from pathlib import Path
from decimal import Decimal
import gzip
import hashlib
import json

root = Path(__file__).resolve().parents[2]
base = root / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'
out = root / 'output/qa/roll-labels-2026-10-06/coding-options-024'
bridge_dir = root / 'output/qa/roll-labels-2026-10-06/predecessor006-coding-canonical-identity-bridge-048'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
dump = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
hash_text = lambda value: hashlib.sha256(value.encode()).hexdigest()


def read(p):
    return json.loads(gzip.decompress(p.read_bytes()) if p.name.endswith('.gz') else p.read_bytes())


assert sha(bridge_dir / 'canonical-identity-bindings.json') == 'f2a38355a8d25ca47f3e5350f909fe36789ea65dfe78a8382ee29198e66f6c46'
assert sha(bridge_dir / 'independent-readback.json') == 'ef01d5b7989779e4834b863b9d2d1ce141804a463ddd8d9f1f9124dc202c27a6'
bridge = read(bridge_dir / 'canonical-identity-bindings.json')
family_path = base / 'review/families/30968.json'
family = read(family_path)
profiles = {p['key']: p for p in family['profiles']}
historical = read(out / 'before-artifacts/review/families/30968.json')
old_profiles = {p['key']: p for p in historical['profiles']}
before023_path = root / 'output/qa/roll-labels-2026-10-06/coding-display-023/before-artifacts/review/families/30968.json'
assert sha(before023_path) == '0ff75bb37c5837fe0d8aa4a3c8aeb85b5c9a0191c3e47279861db6faa7918d67'
states_by_id = {(p['key'], s['id']): s for p in family['profiles'] for s in p['optionStates']['states']}
assert len(profiles) == 16 and len(states_by_id) == len(bridge['bindings']) == 1980
signatures, matched, history_rows = set(), set(), 0
for binding in bridge['bindings']:
    p = profiles[binding['profileKey']]
    receipt_path = root / binding['sourceReceiptPath']
    assert sha(receipt_path) == binding['sourceReceiptSha256']
    raw = read(receipt_path)
    request = raw['quoteEvidence']['request']
    response = raw['quoteEvidence']['response']['data']['response']
    assert str(request['articleId']) == p['articleId'] and str(request['substrateId']) == p['sourceMaterialId']
    assert Decimal(str(request['width'])) * 10 == Decimal(str(response['dimension']['width'])) * 10 == 50
    assert Decimal(str(request['height'])) * 10 == Decimal(str(response['dimension']['height'])) * 10 == 50
    assert Decimal(str(request['quantity'])) == Decimal(str(response['quantity'])) == 1000
    # JS serializes integer-index keys numerically regardless of insertion order.
    options = {k: str(request['additionalUpsells'][k]['id']) for k in sorted(request['additionalUpsells'], key=int)}
    selections = {'article': p['articleId'], 'material': p['sourceMaterialId'], 'options': dump(options),
                  'width_mm': '50', 'height_mm': '50', 'motif_allocation': dump(request.get('enhancedSize', {})),
                  'delivery': str(request['deliveryOption']), 'article_services': dump(request.get('articleOptions', [])),
                  'additional_options': dump(request.get('additionalOptions', [])), 'artwork_mode': str(request['ownPrintData'])}
    signature = hash_text(dump({'selections': selections, 'quantity': 1000}))
    state_id = hash_text(dump({'profileKey': p['key'], 'options': dump(options)}))
    assert binding['selections'] == selections and binding['canonicalSelectionSignature'] == signature
    assert signature not in signatures and binding['optionStateId'] == state_id
    signatures.add(signature)
    state = states_by_id[p['key'], state_id]
    assert state['options'] == options and raw['quoteEvidence']['response_sha256'] == binding['responseSha256']
    witness = {'signature': signature, 'responseSha256': binding['responseSha256'], 'widthMm': 50, 'heightMm': 50,
               'quantity': 1000, 'sourceReceiptPath': binding['sourceReceiptPath'],
               'sourceReceiptSha256': binding['sourceReceiptSha256'], 'qaRequestFingerprint': binding['qaRequestFingerprint']}
    previous = next((s for s in old_profiles[p['key']]['optionStates']['states'] if s['id'] == state_id), None)
    prior_evidence = previous['evidence'] if previous else []
    assert state['evidence'] == prior_evidence + [witness]
    history_rows += len(prior_evidence)
    if binding['priorLedgerStatus'] == 'same_exact_source_total':
        matched.add(p['key'])
    assert p['optionStates']['pricingReady'] is False and p['optionStates']['orderReady'] is False
    assert p['orderReady'] is False and p['codingDeliveryDisplay']['codingDeliveryVerified'] is False
assert len(matched) == 16 and history_rows == 48

receipt = read(out / 'option-preparation.json')
for change in receipt['changes']:
    current_path = root / change['path']
    backup_path = out / 'before-artifacts' / current_path.relative_to(base)
    assert sha(current_path) == change['afterSha256'] and sha(backup_path) == change['beforeSha256']
    current, old = read(current_path), read(backup_path)
    if current_path.name == 'product-draft-plans.json':
        a = next(f for f in current['families'] if f['familyId'] == '30968')['pricingStructure']['rollLabelConfiguration']
        b = next(f for f in old['families'] if f['familyId'] == '30968')['pricingStructure']['rollLabelConfiguration']
    else:
        a, b = current, old
    for i, profile in enumerate(a['profiles']):
        key = profile.get('key', profile.get('profileKey'))
        if key not in profiles:
            continue
        previous = next(p for p in b['profiles'] if p.get('key', p.get('profileKey')) == key)
        if 'key' in profile:
            assert profile['optionStates'] == profiles[key]['optionStates']
            profile['optionStates'] = previous['optionStates']
        else:
            assert profile == profiles[key]['optionStates']
            a['profiles'][i] = previous
    if current_path.name == 'source-option-states.json':
        assert current['counts']['states'] == 9103 and old['counts']['states'] == 7139
        current['counts']['states'] = old['counts']['states']
    assert current == old, change['path']

# Reconstruct exactly the historical projection; no other changed input passes.
restored = read(family_path)
for p in restored['profiles']:
    p['optionStates'] = old_profiles[p['key']]['optionStates']
    del p['sourceEvidenceSha256']
    del p['codingDeliveryDisplay']
assert restored == read(before023_path)
verified_inputs = 0
for item in bridge['sourceInputs']:
    file = root / item['path']
    if file == family_path:
        assert item['sha256'] == sha(before023_path)
    else:
        assert sha(file) == item['sha256'], item['path']
    verified_inputs += 1
for file, digest in receipt['protectedArtifacts']:
    assert sha(base / file) == digest
result = {'status': 'passed_independent_current_application_and_raw_receipt_readback',
          'profiles': 16, 'canonicalRawBoundStates': 1980, 'unchangedBaselineIds': 16,
          'historicalEvidenceRowsPreserved': 48, 'sourceInputsVerified': verified_inputs,
          'applicationArtifactDeltasVerified': 3, 'allCatalogueStates': 9103,
          'referencePoint': {'widthMm': 50, 'heightMm': 50, 'quantity': 1000},
          'onlyCodingOptionsAndAggregateCountChanged': True, 'priceRowsTransferred': 0,
          'rawWireByteRehash': False, 'codingDeliveryVerified': False, 'orderReady': False,
          'productionAcceptance': False, 'hostedAcceptance': False, 'fullGoalComplete': False}
with (out / 'independent-readback.json').open('x') as f:
    json.dump(result, f, indent=2)
    f.write('\n')
print(json.dumps(result))
