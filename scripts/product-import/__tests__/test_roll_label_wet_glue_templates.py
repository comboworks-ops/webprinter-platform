import importlib.util
import json
import pathlib
import unittest
import pymupdf as fitz
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[3]
BASE = ROOT/'docs/roll-labels-2026-09-30'
spec = importlib.util.spec_from_file_location('wet_templates',BASE/'prepare-wet-glue-templates.py')
wet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wet)


class WetGlueTemplates(unittest.TestCase):
    def test_all_fixed_profiles_have_exact_candidates_or_explicit_conflicts(self):
        audit = json.loads((wet.OUT/'geometry-audit.json').read_text())
        candidates = json.loads((wet.OUT/'candidates.json').read_text())
        self.assertEqual(len(audit),54)
        self.assertEqual(sum(len(r['bindings']) for r in audit),270)
        self.assertEqual(len(candidates),32)
        self.assertEqual({r['article_id'] for r in candidates}, {r['article_id'] for r in audit if not r['semantic_blockers']})
        wrong_size = next(r for r in audit if r['article_id']=='44339')
        self.assertEqual([wrong_size['width_mm'],wrong_size['height_mm']],[168,64])
        self.assertAlmostEqual(wrong_size['source_page_mm'][0],114,places=3)
        self.assertTrue(any('page dimensions' in b for b in wrong_size['semantic_blockers']))
        self.assertTrue(next(r for r in audit if r['article_id']=='44327')['semantic_blockers'])
        self.assertEqual(next(r for r in audit if r['article_id']=='44336')['shape'],'source_specific')

    def test_each_candidate_preserves_exact_source_operators_boxes_and_nonprinting_layers(self):
        candidates = json.loads((wet.OUT/'candidates.json').read_text())
        for c in candidates:
            source = PdfReader(BASE/c['source_pdf']['local_path'])
            clean = PdfReader(BASE/c['pdf'])
            self.assertEqual(wet.digest(BASE/c['source_pdf']['local_path']),c['source_pdf']['sha256'])
            self.assertEqual(wet.digest(BASE/c['pdf']),c['sha256'])
            self.assertFalse(clean.metadata)
            self.assertEqual(set(clean.pages[0].extract_text().splitlines()),{'Dataformat','Beskæring','Sikkerhed'})
            for box in ['mediabox','cropbox','trimbox','bleedbox','artbox']:
                self.assertEqual(list(getattr(clean.pages[0],box)),list(getattr(source.pages[0],box)))
            for layer in clean.trailer['/Root']['/OCProperties']['/OCGs']:
                self.assertEqual(layer.get_object()['/Usage']['/Print']['/PrintState'],'/OFF')
                self.assertEqual(layer.get_object()['/Usage']['/Export']['/ExportState'],'/OFF')
            original = fitz.open(BASE/c['source_pdf']['local_path'])
            paths = wet.select_source_paths(original[0])
            for role in ['cut','safe']:
                self.assertEqual(c['source_paths'][role],[item for p in paths[role] for item in wet.standard.path_json(p)])
            clean_doc = fitz.open(BASE/c['pdf'])
            self.assertFalse(clean_doc[0].get_images(full=True))
            for role in ['cut','safe']:
                for source_path in paths[role]:
                    matches = [p for p in clean_doc[0].get_drawings() if wet.standard.same(list(p['rect']),list(source_path['rect']),0.003)]
                    self.assertEqual(len(matches),1)
                    original_items = wet.standard.path_json(source_path)
                    actual_items = wet.standard.path_json(matches[0])
                    self.assertEqual(len(original_items),len(actual_items))
                    for a,b in zip(actual_items,original_items):
                        self.assertEqual(a[0],b[0])
                        for x,y in zip(a[1:],b[1:]):
                            if isinstance(x,list):
                                self.assertTrue(wet.standard.same(x,y,0.003))
                            else:
                                self.assertEqual(x,y)

    def test_missing_or_displaced_boundaries_never_create_fallback_contours(self):
        c = json.loads((wet.OUT/'candidates.json').read_text())[0]
        original = fitz.open(BASE/c['source_pdf']['local_path'])
        paths = wet.select_source_paths(original[0])
        style,blockers = wet.geometry_checks(c['width_mm'],c['height_mm'],{'cut':[],'safe':paths['safe']})
        self.assertEqual(style,'unverified')
        self.assertTrue(blockers)
        style,blockers = wet.geometry_checks(c['width_mm']+1,c['height_mm'],paths)
        self.assertTrue(blockers)
        self.assertEqual(style,'unverified')
        style,blockers = wet.geometry_checks(c['width_mm'],c['height_mm'],{'cut':paths['cut'][:3],'safe':paths['safe']})
        self.assertTrue(blockers)


if __name__=='__main__':
    unittest.main()
