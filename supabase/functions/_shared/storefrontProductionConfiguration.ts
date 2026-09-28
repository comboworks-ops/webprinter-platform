import {CheckoutError, UUID} from './storefrontCheckout.ts';

export type ProductionConfiguration = {
  version: 1;
  format: string | null;
  variant: string | null;
  description: string;
  dimensions: {widthMm:number;heightMm:number} | null;
  selections: Array<{id:string;name:string}>;
};

/** Accept only server-resolved catalogue rows, never browser display labels. */
export function freezeProductionConfiguration(format:string|null, selections:Array<{id:string;name?:string}>, dimensions:ProductionConfiguration['dimensions']=null):ProductionConfiguration {
  const frozen=selections.map(row=>({id:row.id,name:String(row.name||row.id)}));
  const size=dimensions ? `${dimensions.widthMm} × ${dimensions.heightMm} mm` : null;
  const formatLabel=[format,size].filter(Boolean).join(' · ')||null;
  const variant=frozen.map(row=>row.name).join(' · ')||null;
  return {version:1,format:formatLabel,variant,description:[formatLabel,variant].filter(Boolean).join(' | '),dimensions:dimensions?{...dimensions}:null,selections:frozen};
}

export async function loadMatrixProductionConfiguration(client:any, tenantId:string, productId:string, priceRow:any) {
  const ids=Array.from(new Set([priceRow.selectionMapFormat,priceRow.selectionMapMaterial,...(priceRow.selectionMapVariantValueIds||[])].filter(id=>UUID.test(String(id))))) as string[];
  let rows:any[]=[];
  if(ids.length){
    const {data,error}=await client.from('product_attribute_values').select('id,name,width_mm,height_mm').eq('tenant_id',tenantId).eq('product_id',productId).in('id',ids);
    if(error||!Array.isArray(data)||ids.some(id=>!data.some(row=>row.id===id))) throw new CheckoutError('checkout_configuration_unavailable',409);
    rows=data;
  }
  const format=rows.find(row=>row.id===priceRow.selectionMapFormat);
  const dimensions=format&&Number(format.width_mm)>0&&Number(format.height_mm)>0
    ? {widthMm:Number(format.width_mm),heightMm:Number(format.height_mm)} : null;
  const selections=ids.filter(id=>id!==format?.id).map(id=>rows.find(row=>row.id===id));
  if(!ids.length&&priceRow.variant_name&&priceRow.variant_name!=='none') selections.push({id:priceRow.id,name:priceRow.variant_name});
  return freezeProductionConfiguration(format?.name||priceRow.extra_data?.source_format||null,selections,dimensions);
}
