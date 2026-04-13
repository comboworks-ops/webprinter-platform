import { supabase } from '@/integrations/supabase/client';

interface OrderEmailData {
    type: 'status_change' | 'order_confirmation' | 'problem_notification' | 'admin_new_order';
    order: {
        order_number: string;
        product_name: string;
        quantity: number;
        total_price: number;
        status: string;
        tracking_number?: string;
        estimated_delivery?: string;
        problem_description?: string;
        customer_phone?: string;
        delivery_type?: string;
        delivery_summary?: string;
        billing_summary?: string;
        blind_shipping?: boolean;
        sender_summary?: string;
    };
    customer: {
        email: string;
        name: string;
    };
    recipient?: {
        email: string;
        name?: string;
    };
    shop?: {
        name?: string;
        supportEmail?: string;
        orderUrl?: string;
        adminOrderUrl?: string;
        homepageUrl?: string;
    };
}

export async function sendOrderEmail(data: OrderEmailData): Promise<boolean> {
    try {
        const { data: result, error } = await supabase.functions.invoke('send-order-email', {
            body: data,
        });

        if (error) {
            console.error('Error sending email:', error);
            return false;
        }

        console.log('Email sent successfully:', result);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
}

interface ShopEmailContext {
    name?: string;
    supportEmail?: string;
    orderUrl?: string;
    adminOrderUrl?: string;
    homepageUrl?: string;
}

// Send order confirmation email
export async function sendOrderConfirmation(order: {
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    customer_email: string;
    customer_name: string;
    customer_phone?: string;
    delivery_type?: string;
    delivery_summary?: string;
    billing_summary?: string;
    blind_shipping?: boolean;
    sender_summary?: string;
    shop?: ShopEmailContext;
}): Promise<boolean> {
    return sendOrderEmail({
        type: 'order_confirmation',
        order: {
            order_number: order.order_number,
            product_name: order.product_name,
            quantity: order.quantity,
            total_price: order.total_price,
            status: 'pending',
            customer_phone: order.customer_phone,
            delivery_type: order.delivery_type,
            delivery_summary: order.delivery_summary,
            billing_summary: order.billing_summary,
            blind_shipping: order.blind_shipping,
            sender_summary: order.sender_summary,
        },
        customer: {
            email: order.customer_email,
            name: order.customer_name,
        },
        shop: order.shop,
    });
}

export async function sendAdminNewOrderNotification(order: {
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    customer_email: string;
    customer_name: string;
    customer_phone?: string;
    delivery_type?: string;
    delivery_summary?: string;
    billing_summary?: string;
    blind_shipping?: boolean;
    sender_summary?: string;
    admin_email: string;
    admin_name?: string;
    shop?: ShopEmailContext;
}): Promise<boolean> {
    return sendOrderEmail({
        type: 'admin_new_order',
        order: {
            order_number: order.order_number,
            product_name: order.product_name,
            quantity: order.quantity,
            total_price: order.total_price,
            status: 'pending',
            customer_phone: order.customer_phone,
            delivery_type: order.delivery_type,
            delivery_summary: order.delivery_summary,
            billing_summary: order.billing_summary,
            blind_shipping: order.blind_shipping,
            sender_summary: order.sender_summary,
        },
        customer: {
            email: order.customer_email,
            name: order.customer_name,
        },
        recipient: {
            email: order.admin_email,
            name: order.admin_name,
        },
        shop: order.shop,
    });
}

// Send status change notification
export async function sendStatusChangeEmail(order: {
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    status: string;
    tracking_number?: string;
    estimated_delivery?: string;
    customer_email: string;
    customer_name: string;
    shop?: ShopEmailContext;
}): Promise<boolean> {
    return sendOrderEmail({
        type: 'status_change',
        order: {
            order_number: order.order_number,
            product_name: order.product_name,
            quantity: order.quantity,
            total_price: order.total_price,
            status: order.status,
            tracking_number: order.tracking_number,
            estimated_delivery: order.estimated_delivery,
        },
        customer: {
            email: order.customer_email,
            name: order.customer_name,
        },
        shop: order.shop,
    });
}

// Send problem notification
export async function sendProblemNotification(order: {
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    problem_description: string;
    customer_email: string;
    customer_name: string;
    shop?: ShopEmailContext;
}): Promise<boolean> {
    return sendOrderEmail({
        type: 'problem_notification',
        order: {
            order_number: order.order_number,
            product_name: order.product_name,
            quantity: order.quantity,
            total_price: order.total_price,
            status: 'problem',
            problem_description: order.problem_description,
        },
        customer: {
            email: order.customer_email,
            name: order.customer_name,
        },
        shop: order.shop,
    });
}
