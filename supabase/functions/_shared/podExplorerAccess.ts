/** POD v1 catalog and quote operations used by PodAdmin. Never an order proxy. */
export function validatePodExplorerRequest(input: any) {
  const method=String(input?.method || 'GET').toUpperCase();
  const path=String(input?.path || '');
  const sku='[A-Za-z0-9_-]+';
  const allowed = method==='GET' && new RegExp(`^/products(?:/${sku})?$`).test(path)
    || method==='POST' && (new RegExp(`^/products/${sku}/price$`).test(path) || path==='/products/batch/prices');
  if(!allowed)throw new Error('pod_explorer_operation_not_allowed');
  const query=input.query || {};
  if(typeof query!=='object'||Array.isArray(query)||Object.keys(query).length>50
    || Object.values(query).some(value=>value!==null && !['string','number','boolean'].includes(typeof value))) {
    throw new Error('pod_explorer_invalid_query');
  }
  return {method,path,query,requestBody:input.requestBody,connectionId:input.connectionId,baseUrlOverride:input.baseUrlOverride};
}

export async function boundedExplorerText(body: ReadableStream<Uint8Array> | null, limit: number) {
  if(!body)return '';
  const reader=body.getReader(),chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
    if(length>limit){await reader.cancel();throw new Error('pod_explorer_payload_too_large');}chunks.push(value);}
  const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(all);
}
