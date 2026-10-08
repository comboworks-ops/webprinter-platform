import importlib.util, json, pathlib, unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('roll_artwork_audit', ROOT / 'scripts/product-import/audit-roll-label-artwork-requirements.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class Requirements(unittest.TestCase):
    def test_white_paper_and_factory_coating_are_not_white_ink_or_selective_mask(self):
        signals = audit.source_signals('Haftfolie weiß glänzend (kratzfest mit Glanz-UV-Lack)', '', [], True)
        self.assertEqual(signals['whitePrint'], 'not_stated')
        self.assertEqual(signals['factoryCoating'], ['full_surface_uv'])
        self.assertFalse(signals['maskReviewRequired'])
        excluded = audit.source_signals('Transparent ohne Weißdruck', '', [], True)
        self.assertEqual(excluded['whitePrint'], 'explicitly_excluded')
        included = audit.source_signals('Transparent mit partiellem Weißdruck', '', [], True)
        self.assertEqual(included['whitePrint'], 'included_by_material')
        self.assertTrue(included['maskReviewRequired'])

    def test_selective_option_preserves_exact_source_identity_without_promoting_the_layer_contract(self):
        field = {'sourceFieldId': '2861', 'values': [{'sourceValueId': '16886', 'sourceValue': 'Heißfolienveredelung Gold mit 3D Effekt'}]}
        signals = audit.source_signals('Haftpapier weiß', '', [field], True)
        self.assertTrue(signals['maskReviewRequired'])
        self.assertEqual(signals['selectiveEffects'][0]['sourceValueId'], '16886')
        self.assertEqual(audit.source_signals('Haftpapier weiß', '', [field], False)['selectiveEffects'], [])

    def test_full_saved_inventory_retains_every_profile_and_blocks_inferred_layer_approval(self):
        packet = json.loads((ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06/artwork-requirements-audit.json').read_text())
        self.assertEqual(packet['counts']['profiles'], 2551)
        self.assertEqual(packet['counts']['originalPdfsRehashedAndRead'], 365)
        self.assertEqual(packet['counts']['noCustomerArtwork'], 94)
        self.assertEqual(len({row['profileKey'] for row in packet['profiles']}), 2551)
        self.assertFalse(packet['databaseWrites'])
        self.assertFalse(packet['templatesModified'])
        for row in packet['profiles']:
            self.assertEqual(row['productionLayerNamesApproved'], [])
            self.assertFalse(row['onlineDesignerVerified'])
            if row['signals']['maskReviewRequired']:
                self.assertEqual(row['reviewStatus'], 'mask_instructions_pending')

if __name__ == '__main__':
    unittest.main()
