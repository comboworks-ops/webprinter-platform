import { supabase } from '@/integrations/supabase/client';

export interface OrderEmailIdentity { id: string; tenant_id: string }
type OrderEmailType = 'status_change' | 'problem_notification' | 'order_confirmation' | 'admin_new_order';

export async function sendOrderEmail(data: { type: OrderEmailType; order_id: string; tenant_id: string }): Promise<boolean> {
    // Payment confirmations belong to the server outbox; the browser cannot trigger them.
    if (data.type !== 'status_change' && data.type !== 'problem_notification') return false;
    try {
        const { data: result, error } = await supabase.functions.invoke('send-order-email', {
            body: { type: data.type, order_id: data.order_id, tenant_id: data.tenant_id },
        });
        return !error && result?.success === true && result?.accepted === true;
    } catch {
        return false;
    }
}

// Retain old imports without reopening the confirmation bypass.
export async function sendOrderConfirmation(_order: unknown): Promise<boolean> { return false; }
export async function sendAdminNewOrderNotification(_order: unknown): Promise<boolean> { return false; }

export async function sendStatusChangeEmail(order: OrderEmailIdentity): Promise<boolean> {
    return sendOrderEmail({ type: 'status_change', order_id: order.id, tenant_id: order.tenant_id });
}

export async function sendProblemNotification(order: OrderEmailIdentity): Promise<boolean> {
    return sendOrderEmail({ type: 'problem_notification', order_id: order.id, tenant_id: order.tenant_id });
}
