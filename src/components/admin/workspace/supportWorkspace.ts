export const SUPPORT_MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export interface SupportWorkspaceContext {
    roleReady: boolean;
    isMaster: boolean;
    myTenantId: string | null;
}

export interface SupportConversationContext extends SupportWorkspaceContext {
    selectedTenantId: string | null;
}

export interface SupportMessageRow {
    id: string;
    tenant_id: string;
    content: string;
    sender_role: 'master' | 'tenant';
    created_at: string;
    is_read: boolean;
    tenants?: { name: string | null } | null;
}

export interface SupportTenantRow {
    id: string;
    name: string | null;
    domain: string | null;
}

interface SupportQuery<T> extends PromiseLike<{ data: T[] | null; error: unknown }> {
    eq(column: string, value: string): SupportQuery<T>;
    order(column: string, options?: { ascending: boolean }): SupportQuery<T>;
    range(from: number, to: number): SupportQuery<T>;
}

interface SupportReadClient {
    from(table: 'platform_messages'): { select(columns: string): SupportQuery<SupportMessageRow> };
}

interface SupportTenantClient {
    from(table: 'tenants'): { select(columns: string): SupportQuery<SupportTenantRow> };
}

interface SupportSendClient {
    auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
    from(table: 'platform_messages'): {
        insert(values: { tenant_id: string; content: string; sender_role: 'master' | 'tenant'; sender_user_id: string }): PromiseLike<{ error: unknown }>;
    };
}

export function resolveSupportWorkspace(context: { tenantId: string | null; isMasterAdmin: boolean }): SupportWorkspaceContext {
    return {
        roleReady: Boolean(context.tenantId),
        isMaster: context.isMasterAdmin && context.tenantId === SUPPORT_MASTER_TENANT_ID,
        myTenantId: context.tenantId,
    };
}

export function supportConversationTarget(context: SupportConversationContext): string | null {
    if (!context.roleReady || !context.myTenantId) return null;
    return context.isMaster ? context.selectedTenantId : context.myTenantId;
}

/** The active workspace, not the account's platform role, chooses the read scope. */
export async function loadSupportMessages(client: SupportReadClient, context: SupportWorkspaceContext, isCurrent: () => boolean) {
    if (!context.roleReady || !context.myTenantId || !isCurrent()) return null;
    const messages: SupportMessageRow[] = [];
    for (let offset = 0; ; offset += 500) {
        if (!isCurrent()) return null;
        let query = client.from('platform_messages').select('*, tenants (name)')
            .order('created_at', { ascending: true }).order('id').range(offset, offset + 499);
        if (!context.isMaster) query = query.eq('tenant_id', context.myTenantId);
        const { data, error } = await query;
        if (!isCurrent()) return null;
        if (error) throw error;
        const page = data || [];
        messages.push(...page);
        if (page.length < 500) break;
    }
    return messages;
}

export async function loadSupportTenants(client: SupportTenantClient, context: SupportWorkspaceContext, isCurrent: () => boolean) {
    if (!context.roleReady || !context.isMaster || !context.myTenantId || !isCurrent()) return null;
    const { data, error } = await client.from('tenants').select('id, name, domain').order('name');
    if (!isCurrent()) return null;
    if (error) throw error;
    return data || [];
}

export async function sendSupportConversationMessage(
    client: SupportSendClient,
    context: SupportConversationContext,
    draft: string,
    hasPlatformLeads: boolean,
    isCurrent: () => boolean,
): Promise<'sent' | 'cancelled'> {
    const targetTenantId = supportConversationTarget(context);
    if (!targetTenantId || !draft.trim() || !isCurrent()) return 'cancelled';
    if (context.isMaster && targetTenantId === SUPPORT_MASTER_TENANT_ID && hasPlatformLeads) return 'cancelled';
    const { data: { user }, error: authError } = await client.auth.getUser();
    // A tenant/workspace switch while refreshing auth must not submit the old draft.
    if (!isCurrent()) return 'cancelled';
    if (authError) throw authError;
    if (!user) throw new Error('Log ind igen for at sende en besked.');
    const { error } = await client.from('platform_messages').insert({
        tenant_id: targetTenantId,
        content: draft.trim(),
        sender_role: context.isMaster ? 'master' : 'tenant',
        sender_user_id: user.id,
    });
    if (error) throw error;
    return 'sent';
}
