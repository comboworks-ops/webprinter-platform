import {UUID} from './storefrontCheckout.ts';
/** Public storefront quote: only an existing published variant, never free-form supplier input. */
export function validatePodShippingInput(body: any) {
  if (!body || !UUID.test(body.productId || '') || !Number.isSafeInteger(body.quantity)
    || body.quantity < 1 || body.quantity > 1000000
    || typeof body.variantKey !== 'string' || !body.variantKey || body.variantKey.length > 500
    || !UUID.test(body.verticalValueId || '') || !/^[A-Z]{2}$/.test(body.address?.country || '')
    || Object.keys(body).some(key=>!['productId','quantity','variantKey','verticalValueId','address'].includes(key))
    || Object.keys(body.address).some(key=>key!=='country')) throw new Error('Invalid shipping quote');
  return body as {productId:string;quantity:number;variantKey:string;verticalValueId:string;address:{country:string}};
}
