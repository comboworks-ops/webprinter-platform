import copy, importlib.util, json, pathlib, unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts/product-import' / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result
audit = module('artwork_instructions', 'audit-roll-label-artwork-instructions.py')
capture = module('artwork_capture', 'capture-roll-label-artwork-instructions.py')
OUT = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06'
profiles = [json.loads(line) for line in (OUT / 'normalized/article-material-profiles.jsonl').read_text().splitlines()]

class Instructions(unittest.TestCase):
    def test_exact_quote_identity_dimensions_material_and_options_are_required(self):
        profile = next(p for p in profiles if p['key'] == '54008:1003764')
        saved = json.loads((audit.SOURCE / profile['sourceEvidencePath']).read_text())
        evidence = saved['quotes'][0]['evidence']
        rules = audit.explicit_rules(audit.verify_quote(profile, saved, evidence))
        self.assertEqual(rules[0]['sourceSpotName'], 'Weiß')
        self.assertEqual(rules[0]['minimumStroke'], {'value': 1, 'unit': 'pt'})
        self.assertTrue(rules[0]['solidNoRaster'])
        for change in ('material', 'article', 'width', 'quantity', 'option', 'description'):
            changed = copy.deepcopy(evidence)
            response = changed['response']['data']['response']
            if change == 'material': changed['request']['substrateId'] = 'foreign'
            elif change == 'article': changed['request']['articleId'] = '55058'
            elif change == 'width': response['dimension']['width'] = 7
            elif change == 'quantity': response['quantity'] = 1
            elif change == 'option': response['additionalUpsells'] = {}
            else: response['articleDescription'] = 'Indoor: weißes Papier'
            with self.subTest(change=change), self.assertRaises(ValueError):
                audit.verify_quote(profile, saved, changed)

    def test_cutting_ink_coating_and_an_unrelated_colour_cannot_establish_a_mask(self):
        self.assertEqual(audit.explicit_rules('Konturschnitt als Volltonfarbe Weiß mit 100% Cyan als Weiß bezeichnen und auf Überdrucken.'), [])
        self.assertEqual(audit.explicit_rules('PP Haftfolie weiß mit Glanz-UV-Lack'), [])
        self.assertEqual(audit.explicit_rules('Für den UV-Spotlack: Bezeichnung lack, 80 % Magenta, Einstellung auf Überdrucken.'), [])
        text = 'Für die Folienprägung legen Sie bitte eine Sonderfarbe an, welche Sie als praegung bezeichnen, in 100 % Magenta einfärben und auf überdrucken stellen.'
        self.assertEqual(audit.explicit_rules(text)[0]['kind'], 'hot_foil')
        with self.assertRaises(ValueError): audit.explicit_rules(text + '<br>' + text)

    def test_complete_inventory_documents_only_exact_evidence_and_preserves_pending_masks(self):
        packet = json.loads((OUT / 'artwork-instructions.json').read_text())
        self.assertEqual(packet['counts']['profiles'], 2551)
        self.assertEqual(packet['counts']['mask_rules_documented'], 716)
        self.assertEqual(packet['counts']['source_instructions_pending'], 130)
        self.assertEqual(packet['counts']['ruleKinds'], {'white': 200, 'hot_foil': 516, 'spot_uv': 336})
        rows = {r['profileKey']: r for r in packet['profiles']}
        self.assertEqual(rows['55058:1006954']['missingKinds'], ['white'])
        self.assertEqual(rows['51752:973531']['missingKinds'], ['spot_uv'])
        self.assertEqual(rows['55626:1024912']['rules'], [])
        for profile in profiles:
            row = rows[profile['key']]
            self.assertEqual(row['sourceEvidenceSha256'], profile['sourceEvidenceSha256'])
            self.assertEqual(row['profileBlockersPreserved'], profile['blockers'])
            self.assertFalse(row['onlineDesignerVerified'])
            self.assertEqual(row['productionLayerNamesApproved'], [])

    def test_only_the_public_print_details_query_is_allowed(self):
        query = {'ajax_call':'details','c':'55058','sid':'a'*32,'info':'druckdaten','bu':'','menge':'1',
                 'auflage':'1 Stück','sorte':'Transparent mit Weißdruck','auflageid':'54041571','bookCategoryFlag':'0'}
        self.assertTrue(capture.modal_url(query).startswith('https://www.wir-machen-druck.de/product_detail_info.htm?'))
        for delta in ({'ajax_call':'order'}, {'info':'account'}, {'c':'https://evil.example'}, {'sid':''}, {'cart':'1'}):
            with self.subTest(delta=delta), self.assertRaises(ValueError): capture.modal_url({**query, **delta})

if __name__ == '__main__': unittest.main()
