"""Extract explicit layer rules from exact, hash-bound saved quote descriptions.

This is documentation, not Designer/export approval. No other article's rules,
cutting rules, default material, or failed modal response can fill a missing mask.
"""
import collections, hashlib, html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/roll-labels-2026-09-30'
OUT = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def plain(value):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(value))).strip()

def paragraphs(value):
    return [plain(p) for p in re.split(r'<br\s*/?>|</?p[^>]*>', html.unescape(value), flags=re.I) if plain(p)]

def explicit_rules(description):
    """Require each rule's name, colour and overprint in its own explicit clause."""
    parts = paragraphs(description)
    result = []
    for text in parts:
        if re.search(r'Konturschnitt|Konturlinie|cutkontur|CutContour', text, re.I):
            continue
        if not re.search(r'[Üü]berdrucken', text):
            continue
        kind = None
        if re.search(r'Wei(?:ß|ss).*?Volltonfarbe.*?100\s*%\s*Cyan', text, re.I) and re.search(r'als\s+Wei(?:ß|ss)\s+bezeichnen', text, re.I):
            kind, name, colour = 'white', 'Weiß', [100, 0, 0, 0]
        elif re.search(r'(?:Hei(?:ß|ss)folien|Folienprägung|prägenden).*?praegung', text, re.I) and re.search(r'100\s*%\s*Magenta', text, re.I):
            kind, name, colour = 'hot_foil', 'praegung', [0, 100, 0, 0]
        elif re.search(r'UV-Spotlack.*?Bezeichnung\s+lack\b', text, re.I) and re.search(r'100\s*%\s*Magenta', text, re.I):
            kind, name, colour = 'spot_uv', 'lack', [0, 100, 0, 0]
        if not kind:
            continue
        rule = {'kind': kind, 'sourceSpotName': name, 'alternateCmykPercent': colour, 'overprint': True,
                'vectorRequired': bool(re.search(r'Vektorgraf', text, re.I)), 'sourceTextOriginal': text,
                'sourceClauseSha256': sha(text.encode())}
        stroke = re.search(r'(?:Linienstärke|Mindeststrichstärke)\s+(?:von\s+)?(?:mindestens\s+)?([\d,]+)\s*(Punkt|mm)', text, re.I)
        # Standard foil/varnish clauses can state the size in a separate paragraph.
        ancillary = [p for p in parts if re.search(r'(?:Veredelte|geprägte) Elemente.*?Mindest(?:stärke|abstand)', p, re.I)] if kind != 'white' else []
        if stroke:
            rule['minimumStroke'] = {'value': float(stroke[1].replace(',', '.')), 'unit': 'pt' if stroke[2].lower() == 'punkt' else 'mm'}
        elif ancillary:
            minimum = re.search(r'Mindeststärke\s+von\s+([\d,]+)\s*mm', ancillary[0], re.I)
            if minimum:
                rule['minimumStroke'] = {'value': float(minimum[1].replace(',', '.')), 'unit': 'mm'}
        if ancillary:
            gap = re.search(r'Mindestabstand(?:\s+zur\s+Stanzlinie)?\s+von\s+([\d,]+)\s*mm', ancillary[0], re.I)
            if gap:
                rule['minimumCutDistanceMm'] = float(gap[1].replace(',', '.'))
            rule['ancillarySourceTextOriginal'] = ancillary
        if kind == 'white':
            rule['solidNoRaster'] = bool(re.search(r'voll deckend.*?kein Raster', text, re.I))
        result.append(rule)
    # A changed or duplicated rule is not silently resolved by choosing one.
    if len({r['kind'] for r in result}) != len(result):
        raise ValueError('Ambiguous duplicate production-layer rule')
    return result

def effect_kind(label):
    if re.search(r'Hei(?:ß|ss)folien|(?:Gold|Silber)folienprägung', label, re.I):
        return 'hot_foil'
    if re.search(r'Spotlack|Teillackierung', label, re.I):
        return 'spot_uv'
    return None

def required_masks(signals):
    masks = []
    if signals['whitePrint'] == 'included_by_material':
        masks.append({'kind': 'white', 'condition': {'type': 'material'}})
    for effect in signals['selectiveEffects']:
        kind = effect_kind(effect['labelOriginal'])
        if not kind:
            raise ValueError('Unresolved selective effect')
        condition = ({'type': 'source_option', 'sourceFieldId': effect['sourceFieldId'], 'sourceValueId': effect['sourceValueId']}
                     if effect['origin'] == 'option' else {'type': 'material_or_article'})
        row = {'kind': kind, 'condition': condition}
        if row not in masks:
            masks.append(row)
    return masks

def verify_quote(profile, saved, evidence):
    request = evidence['request']
    response = evidence['response']
    if response.get('code') != 200:
        raise ValueError('Source quote did not succeed')
    quote = response['data']['response']
    if str(request.get('articleId')) != profile['articleId'] or str(request.get('substrateId')) != profile['sourceMaterialId']:
        raise ValueError('Foreign article/material quote')
    if quote.get('currency') != 'EUR' or float(quote.get('price', 0)) <= 0 or float(quote.get('quantity', 0)) != float(request['quantity']):
        raise ValueError('Invalid positive exact quantity quote')
    for axis in ('width', 'height'):
        if axis in request and float(quote.get('dimension', {}).get(axis, 0)) != float(request[axis]):
            raise ValueError('Foreign dimension echo')
    if request.get('priceScaleId') and str(quote.get('priceScaleId')) != str(request['priceScaleId']):
        raise ValueError('Foreign price scale echo')
    for field, selected in request.get('additionalUpsells', {}).items():
        if not any(plain(v.get('value', '')) == plain(selected['value']) for v in quote.get('additionalUpsells', {}).get(field, [])):
            raise ValueError('Foreign option echo')
    description = quote.get('articleDescription', '')
    if not description or plain(saved['material']['label']) not in plain(description):
        raise ValueError('Exact selected material absent from description')
    return description

def audit_profile(profile, signals):
    path = SOURCE / profile['sourceEvidencePath']
    if sha(path.read_bytes()) != profile['sourceEvidenceSha256']:
        raise ValueError('Changed exact source file: ' + profile['key'])
    saved = json.loads(path.read_text())
    if str(saved['article_id']) != profile['articleId'] or saved['material']['value'] != profile['sourceMaterialId']:
        raise ValueError('Source profile identity mismatch')
    row = {'profileKey': profile['key'], 'familyId': profile['familyId'], 'articleId': profile['articleId'],
           'sourceMaterialId': profile['sourceMaterialId'], 'sourceEvidenceSha256': profile['sourceEvidenceSha256'],
           'profileBlockersPreserved': profile['blockers'], 'requiredMasks': required_masks(signals),
           'rules': [], 'evidence': [], 'productionLayerNamesApproved': [], 'onlineDesignerVerified': False}
    if not profile['customerArtworkRequired']:
        return dict(row, documentationStatus='no_customer_artwork', missingKinds=[])
    versions = []
    errors = []
    for q in saved['quotes']:
        try:
            description = verify_quote(profile, saved, q['evidence'])
            rules = explicit_rules(description)
            versions.append(rules)
            row['evidence'].append({'capturedAt': q['evidence']['captured_at'],
                                    'sourceResponseSha256': q['evidence']['response_sha256'],
                                    'descriptionSha256': sha(description.encode()), 'exactContextVerified': True})
        except (ValueError, KeyError, TypeError) as error:
            errors.append(str(error))
    if errors or not versions or any(v != versions[0] for v in versions[1:]):
        return dict(row, documentationStatus='quote_context_quarantined', missingKinds=sorted({r['kind'] for r in row['requiredMasks']}), errors=errors or ['Conflicting quote rules'])
    required = {r['kind'] for r in row['requiredMasks']}
    # Excluded white ink and irrelevant source rules never acquire a runtime mask.
    row['rules'] = [r for r in versions[0] if r['kind'] in required]
    row['missingKinds'] = sorted(required - {r['kind'] for r in row['rules']})
    row['documentationStatus'] = ('source_instructions_pending' if row['missingKinds'] else
                                  'mask_rules_documented' if required else 'no_selective_mask_required_by_signals')
    return row

def main():
    profiles = [json.loads(line) for line in (OUT / 'normalized/article-material-profiles.jsonl').read_text().splitlines()]
    triage = json.loads((OUT / 'artwork-requirements-audit.json').read_text())
    signals = {r['profileKey']: r['signals'] for r in triage['profiles']}
    rows = [audit_profile(p, signals[p['key']]) for p in profiles]
    counts = dict(collections.Counter(r['documentationStatus'] for r in rows))
    counts.update(profiles=len(rows), ruleKinds=dict(collections.Counter(rule['kind'] for row in rows for rule in row['rules'])))
    artifact = {'version': 1, 'scope': 'Exact saved quote-description mask documentation; not Designer/export or pricing acceptance',
                'databaseWrites': False, 'templatesModified': False, 'triageArtifactSha256': sha((OUT / 'artwork-requirements-audit.json').read_bytes()),
                'counts': counts, 'profiles': rows}
    (OUT / 'artwork-instructions.json').write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(counts))

if __name__ == '__main__':
    main()
