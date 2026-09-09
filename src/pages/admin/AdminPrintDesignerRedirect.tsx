import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { Designer } from "@/pages/Designer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function AdminPrintDesignerRedirect() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const domain = searchParams.get('force_domain');
    const designId = searchParams.get('designId');
    const [verifiedDesignId, setVerifiedDesignId] = useState<string | null>(null);
    const [designError, setDesignError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const openDesigner = async () => {
            try {
                const resolution = await resolveAdminTenant();
                if (cancelled) return;
                if (!resolution.tenantId) throw new Error('Butikken kunne ikke identificeres. Vælg en butik og prøv igen.');
                setTenantId(resolution.tenantId);
            } catch (cause) {
                if (!cancelled) setError(cause instanceof Error ? cause.message : 'Designeren kunne ikke åbnes. Prøv igen.');
            }
        };

        openDesigner();

        return () => {
            cancelled = true;
        };
    }, [domain]);

    useEffect(() => {
        if (!tenantId) return;
        const params = new URLSearchParams(searchParams);
        params.set('tenantId', tenantId);
        params.delete('tenant_id');
        if (!params.has('format') && !params.has('templateId') && !params.has('designId') && !params.has('productId')) params.set('format', 'A4');
        if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
    }, [tenantId, searchParams, setSearchParams]);

    useEffect(() => {
        let active = true;
        setDesignError(null);
        setVerifiedDesignId(null);
        if (tenantId && designId) {
            void (async () => {
                try {
                    const { data, error: loadError } = await supabase.from('designer_saved_designs' as any)
                        .select('id, tenant_id').eq('id', designId).eq('tenant_id', tenantId).maybeSingle();
                    if (loadError) throw loadError;
                    if (!data) throw new Error('Designet findes ikke i den valgte butik. Vælg designets butik for at åbne det.');
                    if (active) setVerifiedDesignId(designId);
                } catch (cause) {
                    if (active) setDesignError(cause instanceof Error ? cause.message : 'Designet kunne ikke kontrolleres. Prøv igen.');
                }
            })();
        }
        return () => { active = false; };
    }, [tenantId, designId]);

    if (error) return <div role="alert" className="rounded-md border p-6"><h1>Print Designer</h1><p className="mt-3 text-destructive">{error}</p></div>;
    if (designError) return <div role="alert" className="rounded-md border p-6"><h1>Print Designer</h1><p className="my-4 text-destructive">{designError}</p><Button variant="outline" onClick={() => { const params = new URLSearchParams(); if (domain) params.set('force_domain', domain); params.set('format', 'A4'); setSearchParams(params, { replace: true }); }}>Opret et nyt design i denne butik</Button></div>;
    if (tenantId && searchParams.get('tenantId') === tenantId && (!designId || verifiedDesignId === designId) && (searchParams.has('format') || searchParams.has('templateId') || searchParams.has('designId') || searchParams.has('productId'))) {
        return <section className="admin-designer-workspace"><div className="mb-6"><h1>Print Designer</h1><p className="mt-2 text-muted-foreground">Opret og redigér trykklare designs.</p></div><Designer embedded /></section>;
    }

    return (
        <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
    );
}
