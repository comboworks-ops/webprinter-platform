import {sha256,UUID} from './storefrontCheckout.ts';
export function completedOrderProof(attempt:any,order:any):boolean {
  return !!attempt && attempt.order_id===order.id && attempt.tenant_id===order.tenant_id
    && attempt.state==='completed' && typeof attempt.payment_intent_id==='string'
    && attempt.payment_intent_id.startsWith('pi_') && Number.isSafeInteger(attempt.amount_ore)
    && attempt.amount_ore>0 && attempt.amount_ore===Math.round(Number(order.total_price)*100);
}
export async function ownsCompletedCheckout(attempt:any,order:any,token:unknown):Promise<boolean> {
  return typeof token==='string' && UUID.test(token) && completedOrderProof(attempt,order)
    && attempt.access_token_hash===await sha256(token);
}
export async function canManagePod2Jobs(client:any,userId:string,tenantId:string):Promise<boolean> {
  const [{data:roles,error:roleError},{data:tenant,error:tenantError}]=await Promise.all([
    client.from('user_roles').select('role,tenant_id').eq('user_id',userId),
    client.from('tenants').select('owner_id').eq('id',tenantId).maybeSingle(),
  ]);
  if(roleError||tenantError)return false;
  return tenant?.owner_id===userId || (roles||[]).some((role:any)=>role.role==='master_admin'
    || (role.role==='admin' && role.tenant_id===tenantId));
}
