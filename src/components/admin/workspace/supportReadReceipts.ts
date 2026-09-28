interface SupportReadContext {
    roleReady: boolean;
    isMaster: boolean;
    selectedTenantId: string | null;
    myTenantId: string | null;
}

interface SupportReadQuery extends PromiseLike<{ error: unknown }> {
    eq(column: string, value: string | boolean): SupportReadQuery;
}

interface SupportReadClient {
    from(table: 'platform_messages'): {
        update(values: { is_read: true }): SupportReadQuery;
    };
}

const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export async function markSupportConversationRead(client: SupportReadClient, context: SupportReadContext) {
    const { roleReady, isMaster, selectedTenantId, myTenantId } = context;
    // Tenant support opens its own conversation without a separate thread selection.
    const targetTenantId = isMaster ? selectedTenantId : myTenantId;
    if (!roleReady || !targetTenantId) return;

    // Opening the platform lead log must preserve its unread intake evidence.
    if (isMaster && selectedTenantId === MASTER_TENANT_ID) return;

    const { error } = await client.from('platform_messages')
        .update({ is_read: true })
        .eq('sender_role', isMaster ? 'tenant' : 'master')
        .eq('is_read', false)
        .eq('tenant_id', targetTenantId);
    if (error) throw error;
}
