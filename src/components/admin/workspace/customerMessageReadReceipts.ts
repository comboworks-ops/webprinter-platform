interface CustomerMessage {
    id: string;
    order_id: string;
    sender_type: string;
    is_read: boolean;
}

interface ReadQuery extends PromiseLike<{ error: unknown }> {
    eq(column: string, value: string | boolean): ReadQuery;
    in(column: string, values: string[]): ReadQuery;
}

export interface CustomerMessageReadClient {
    from(table: 'order_messages'): { update(values: { is_read: true }): ReadQuery };
}

/** Call only with the displayed order loaded from the active shop's order list. */
export async function markDisplayedCustomerMessagesRead(
    client: CustomerMessageReadClient,
    orderId: string,
    messages: CustomerMessage[],
    isCurrent: () => boolean,
): Promise<string[]> {
    const ids = [...new Set(messages.filter(message =>
        message.order_id === orderId && message.sender_type === 'customer' && !message.is_read,
    ).map(message => message.id))];
    if (!orderId || !isCurrent()) return [];
    for (let offset = 0; offset < ids.length; offset += 100) {
        if (!isCurrent()) return [];
        const { error } = await client.from('order_messages').update({ is_read: true })
            .eq('order_id', orderId).eq('sender_type', 'customer').eq('is_read', false)
            .in('id', ids.slice(offset, offset + 100));
        if (error) throw error;
    }
    return isCurrent() ? ids : [];
}
