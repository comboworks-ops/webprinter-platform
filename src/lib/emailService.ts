import { supabase } from '@/integrations/supabase/client';

interface OrderEmailData {
    type: 'status_change' | 'order_confirmation' | 'problem_notification';
    order: {
        order_number: string;
        product_name: string;
        quantity: number;
        total_price: number;
        status: string;
        tracking_number?: string;
        estimated_delivery?: string;
        problem_description?: string;
    };
    customer: {
        email: string;
        name: string;
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

// Send order confirmation email
export async function sendOrderConfirmation(order: {
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    customer_email: string;
    customer_name: string;
}): Promise<boolean> {
    return sendOrderEmail({
        type: 'order_confirmation',
        order: {
            order_number: order.order_number,
            product_name: order.product_name,
            quantity: order.quantity,
            total_price: order.total_price,
            status: 'pending',
        },
        customer: {
            email: order.customer_email,
            name: order.customer_name,
        },
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
    });
}
