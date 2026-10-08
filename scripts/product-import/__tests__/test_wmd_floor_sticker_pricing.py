import importlib.util
from pathlib import Path
import sys,unittest
p=Path(__file__).resolve().parents[1]/'fetch-wmd-floor-sticker-pricing.py'
spec=importlib.util.spec_from_file_location('floor_pricing',p);module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)

class QuoteValidation(unittest.TestCase):
    def response(self):return {'code':200,'data':{'response':{'currency':'EUR','price':12.6,'basePrice':3.7,'quantity':1,'dimension':{'width':50,'height':50},'discount':0,'articleDiscount':0,'articleOptions':{'option08_jn':8.9}}}}
    def test_total_preserves_setup(self):
        result=module.validated_quote(self.response(),50,50,1)
        self.assertEqual(result['supplierPriceEurNet'],12.6);self.assertEqual(result['setupEur'],8.9)
    def test_reject_supplier_dimension_or_quantity_changes(self):
        for field in ['quantity','dimension']:
            data=self.response();data['data']['response'][field]=2 if field=='quantity' else {'width':49,'height':50}
            with self.assertRaises(ValueError):module.validated_quote(data,50,50,1)
    def test_reject_discount_or_configuration_warning(self):
        data=self.response();data['data']['response']['discount']=1
        with self.assertRaises(ValueError):module.validated_quote(data,50,50,1)
        data=self.response();data['data']['info']={'message':'Changed size'}
        with self.assertRaises(ValueError):module.validated_quote(data,50,50,1)
    def test_redact_nested_transient_tokens(self):
        self.assertEqual(module.redact({'token':'secret','data':[{'keyword':'secret','price':12.6}]}),{'token':'[redacted]','data':[{'keyword':'[redacted]','price':12.6}]})
    def test_reject_foreign_resource_hosts(self):
        with self.assertRaises(module.bridge.ExtractionError):module.bridge.validate_url('https://example.com/guide.pdf',module.HOSTS)
    def test_continuation_rejects_unbounded_nonfinite_or_fractional_count_requests(self):
        for samples in [[], [[10,10,1]]*101, [[float('inf'),10,1]], [[10,float('nan'),1]], [[10,10,1.5]], [[10,10,True]], [[0,10,1]]]:
            with self.assertRaises(ValueError):module.continuation_samples(samples)
        self.assertEqual(module.continuation_samples([[37,61,3]]),[[37,61,3]])

if __name__=='__main__':unittest.main()
