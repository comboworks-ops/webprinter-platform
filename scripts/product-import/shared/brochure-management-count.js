/** Server-only read-only count fallback for large, owned brochure imports. */
export function brochureManagementCounter({projectRef,accessToken,fetchImpl=fetch}) {
  if(!/^[a-z]{20}$/.test(projectRef)||!accessToken)throw Error('Management count configuration missing');
  return async(table,plan)=>{
    if(!['generic_product_prices','product_attribute_groups','product_attribute_values'].includes(table)
      ||![plan.tenantId,plan.proposedProductId].every(id=>/^[a-f0-9-]{36}$/.test(id)))throw Error('Invalid owned count scope');
    const query=`select count(*)::text as count from public.${table} where tenant_id = $1::uuid and product_id = $2::uuid`;
    const response=await fetchImpl(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`,{
      method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({query,parameters:[plan.tenantId,plan.proposedProductId]}),signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw Error(`Read-only management count HTTP ${response.status}`);
    const rows=await response.json(),count=Array.isArray(rows)&&rows.length===1?Number(rows[0].count):NaN;
    if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid read-only owned count result');
    return count;
  };
}
