interface SupportReadContext {
    roleReady: boolean;
    isMaster: boolean;
    selectedTenantId: string | null;
    myTenantId: string | null;
}

interface SupportReadQuery extends PromiseLike<{ error: unknown }> {
    eq(column: string, value: string | boolean): SupportReadQuery;
    in(column: string, values: string[]): SupportReadQuery;
}

interface DisplayedSupportMessage {
    id: string;
    tenant_id: string;
    sender_role: string;
    is_read: boolean;
}

interface SupportReadClient {
    from(table: 'platform_messages'): {
        update(values: { is_read: true }): SupportReadQuery;
    };
}

const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export async function markSupportConversationRead(
    client: SupportReadClient,
    context: SupportReadContext,
    messages: DisplayedSupportMessage[],
    isCurrent: () => boolean,
) {
    const { roleReady, isMaster, selectedTenantId, myTenantId } = context;
    // Tenant support opens its own conversation without a separate thread selection.
    const targetTenantId = isMaster ? selectedTenantId : myTenantId;
    if (!roleReady || !targetTenantId || !isCurrent()) return;

    // Opening the platform lead log must preserve its unread intake evidence.
    if (isMaster && selectedTenantId === MASTER_TENANT_ID) return;

    const incomingRole = isMaster ? 'tenant' : 'master';
    const ids = [...new Set(messages.filter(message => message.tenant_id === targetTenantId
        && message.sender_role === incomingRole && !message.is_read).map(message => message.id))];
    for (let offset = 0; offset < ids.length; offset += 100) {
        if (!isCurrent()) return;
        const { error } = await client.from('platform_messages')
            .update({ is_read: true })
            .eq('sender_role', incomingRole)
            .eq('is_read', false)
            .eq('tenant_id', targetTenantId)
            .in('id', ids.slice(offset, offset + 100));
        if (error) throw error;
    }
}
