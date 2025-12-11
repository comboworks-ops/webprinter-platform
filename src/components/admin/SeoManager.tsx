
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Save, Globe, Loader2 } from "lucide-react";

interface PageSeo {
    id: string;
    slug: string;
    title: string;
    meta_description: string;
    og_image_url: string;
}

export function SeoManager() {
    const [pages, setPages] = useState<PageSeo[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PageSeo>>({});
    const [saving, setSaving] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [isMaster, setIsMaster] = useState(false);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Resolve Tenant
        let currentTenantId = null;

        // 1. Check if Master
        const { data: masterTenant } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('id', '00000000-0000-0000-0000-000000000000')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (masterTenant) {
            currentTenantId = (masterTenant as any).id;
            setIsMaster(true);
        } else {
            // 2. Check Role
            const { data: roleData } = await supabase
                .from('user_roles' as any)
                .select('tenant_id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (roleData) {
                currentTenantId = (roleData as any).tenant_id;
            } else {
                // 3. Fallback Owner
                const { data: myTenant } = await supabase
                    .from('tenants' as any)
                    .select('id')
                    .eq('owner_id', user.id)
                    .maybeSingle();
                if (myTenant) currentTenantId = (myTenant as any).id;
            }
        }

        setTenantId(currentTenantId);
        if (currentTenantId) {
            await fetchPages(currentTenantId);
        }
        setLoading(false);
    };

    const fetchPages = async (tid: string) => {
        // 1. Define System Pages (Template)
        const systemPages = [
            { slug: '/', title: 'Forside' },
            { slug: '/shop', title: 'Shop' },
            { slug: '/om-os', title: 'Om Os' },
            { slug: '/kontakt', title: 'Kontakt' },
            { slug: '/handelsbetingelser', title: 'Handelsbetingelser' },
            { slug: '/gdpr', title: 'Persondatapolitik' },
            { slug: '/login', title: 'Log ind' },
        ];

        // 2. Fetch Tenant Products
        const { data: products } = await supabase
            .from('products' as any)
            .select('slug, name')
            .eq('tenant_id', tid);

        const productPages = (products || []).map((p: any) => ({
            slug: `/produkt/${p.slug}`,
            title: p.name || 'Produkt'
        }));

        const availablePages = [...systemPages, ...productPages];

        // 3. Fetch Existing SEO Overrides
        const { data: seoOverrides } = await supabase
            .from('page_seo' as any)
            .select('*')
            .eq('tenant_id', tid);

        const overrideMap = new Map((seoOverrides || []).map((o: any) => [o.slug, o]));

        // 4. Merge
        const mergedPages: PageSeo[] = availablePages.map((page, index) => {
            const override = overrideMap.get(page.slug);
            return {
                id: override?.id || `virtual-${index}`, // Use real ID if exists, or virtual
                slug: page.slug,
                title: override?.title || page.title,
                meta_description: override?.meta_description || '',
                og_image_url: override?.og_image_url || '',
                is_virtual: !override // Flag to know if we need to insert or update
            } as any;
        });

        // Add any orphan SEO pages (custom pages created manually)
        (seoOverrides || []).forEach((o: any) => {
            if (!availablePages.find(ap => ap.slug === o.slug)) {
                mergedPages.push(o as PageSeo);
            }
        });

        // Sort: System first, then Products
        mergedPages.sort((a, b) => a.slug.localeCompare(b.slug));

        setPages(mergedPages);
    };

    const handleEdit = (page: PageSeo) => {
        setEditingId(page.id);
        setEditForm(page);
    };

    const handleSave = async () => {
        if (!editingId || !tenantId) return;
        setSaving(true);

        // Check if it's a virtual page (needs INSERT)
        const isVirtual = editingId.startsWith('virtual-');

        const payload = {
            tenant_id: tenantId,
            slug: editForm.slug, // Ensure slug is preserved
            title: editForm.title,
            meta_description: editForm.meta_description,
            og_image_url: editForm.og_image_url
        };

        let error;
        if (isVirtual) {
            // INSERT
            const { error: insertError } = await supabase
                .from('page_seo' as any)
                .insert([payload]);
            error = insertError;
        } else {
            // UPDATE
            const { error: updateError } = await supabase
                .from('page_seo' as any)
                .update(payload)
                .eq('id', editingId);
            error = updateError;
        }

        if (error) {
            toast.error('Kunne ikke gemme ændringer');
            console.error(error);
        } else {
            toast.success('SEO opdateret');
            setEditingId(null);
            fetchPages(tenantId);
        }
        setSaving(false);
    };

    const handleCreateNew = async () => {
        if (!tenantId) return;
        const slug = prompt("Indtast URL sti (f.eks. /om-os):");
        if (!slug) return;

        const { error } = await supabase
            .from('page_seo' as any)
            .insert([{
                slug,
                tenant_id: tenantId,
                title: 'Ny Side Titel',
                meta_description: 'Beskrivelse her...'
            }]);

        if (error) {
            toast.error('Kunne ikke oprette side');
            console.error(error);
        } else {
            toast.success('Side oprettet');
            fetchPages(tenantId!);
        }
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <a href="/admin" className="hover:text-foreground transition-colors flex items-center gap-1">
                    ← Tilbage til Admin
                </a>
                <span>/</span>
                <span className="text-foreground font-medium">SEO Manager</span>
            </nav>

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">SEO Manager</h2>
                    <p className="text-muted-foreground">Administrer meta titler og beskrivelser for dine sider.</p>
                </div>
                <Button onClick={handleCreateNew}>
                    <Globe className="mr-2 h-4 w-4" />
                    Tilføj Ny Side
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sider</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="animate-spin h-6 w-6" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>URL</TableHead>
                                            <TableHead>Titel</TableHead>
                                            <TableHead className="w-[100px]">Handling</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pages.map((page) => (
                                            <TableRow key={page.id} className={editingId === page.id ? "bg-muted/50" : ""}>
                                                <TableCell className="font-mono text-sm">{page.slug}</TableCell>
                                                <TableCell className="max-w-[300px] truncate">{page.title}</TableCell>
                                                <TableCell>
                                                    <Button variant="outline" size="sm" onClick={() => handleEdit(page)}>
                                                        Rediger
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {pages.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                                    Ingen sider fundet. Opret en ny for at starte.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div>
                    {editingId ? (
                        <Card className="sticky top-6 border-primary/20 shadow-lg">
                            <CardHeader className="bg-muted/30">
                                <CardTitle>Rediger SEO</CardTitle>
                                <CardDescription className="font-mono">{editForm.slug}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Meta Titel</label>
                                    <Input
                                        value={editForm.title || ''}
                                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground text-right">
                                        {(editForm.title?.length || 0)} / 60 tegn
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Meta Beskrivelse</label>
                                    <Textarea
                                        value={editForm.meta_description || ''}
                                        onChange={e => setEditForm({ ...editForm, meta_description: e.target.value })}
                                        rows={4}
                                    />
                                    <p className="text-xs text-muted-foreground text-right">
                                        {(editForm.meta_description?.length || 0)} / 160 tegn
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">OG Image (Social Sharing)</label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={editForm.og_image_url || ''}
                                            onChange={e => setEditForm({ ...editForm, og_image_url: e.target.value })}
                                            placeholder="https://... eller upload"
                                            className="flex-1"
                                        />
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    const fileName = `seo/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                                                    const { data, error } = await supabase.storage
                                                        .from('images')
                                                        .upload(fileName, file);

                                                    if (error) {
                                                        toast.error('Kunne ikke uploade billede');
                                                        console.error(error);
                                                        return;
                                                    }

                                                    const { data: urlData } = supabase.storage
                                                        .from('images')
                                                        .getPublicUrl(fileName);

                                                    setEditForm({ ...editForm, og_image_url: urlData.publicUrl });
                                                    toast.success('Billede uploadet!');
                                                }}
                                            />
                                            <div className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80 transition-colors">
                                                Upload
                                            </div>
                                        </label>
                                    </div>
                                    {editForm.og_image_url && (
                                        <div className="mt-2 relative">
                                            <img
                                                src={editForm.og_image_url}
                                                alt="OG Preview"
                                                className="w-full h-32 object-cover rounded-lg border"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Size Guide */}
                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                                        <p className="font-medium text-blue-800 mb-2">📐 Størrelses-guide</p>
                                        <ul className="text-blue-700 space-y-1 text-xs">
                                            <li><strong>Anbefalet:</strong> 1200 × 630 px (Facebook, LinkedIn, Google)</li>
                                            <li><strong>Minimum:</strong> 600 × 315 px</li>
                                            <li><strong>Format:</strong> JPG eller PNG, maks 5MB</li>
                                        </ul>
                                        <div className="mt-2 pt-2 border-t border-blue-200">
                                            <p className="text-blue-600 text-xs">
                                                💡 <strong>Pro tip:</strong> Hold logo og vigtig tekst i midten af billedet - nogle platforme beskærer kanterne.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Google Preview */}
                                <div className="mt-6 p-4 bg-white border rounded-lg">
                                    <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Google Preview</h4>
                                    <div className="font-sans">
                                        <div className="flex items-center gap-1 text-sm text-[#202124] mb-1">
                                            <div className="bg-gray-200 rounded-full w-7 h-7 flex items-center justify-center text-xs">Fav</div>
                                            <div className="flex flex-col">
                                                <span className="text-[#202124]">Webprinter.dk</span>
                                                <span className="text-[#5f6368] text-xs">https://webprinter.dk{editForm.slug}</span>
                                            </div>
                                        </div>
                                        <div className="text-[#1a0dab] text-xl font-normal hover:underline cursor-pointer truncate">
                                            {editForm.title || 'Side Titel'}
                                        </div>
                                        <div className="text-[#4d5156] text-sm mt-1 line-clamp-2">
                                            {editForm.meta_description || 'Din beskrivelse vil blive vist her i søgeresultaterne...'}
                                        </div>
                                    </div>

                                    {/* Google Tools Links */}
                                    <div className="mt-4 pt-3 border-t flex flex-wrap gap-2">
                                        <a
                                            href="https://ads.google.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Opret betalte annoncer der vises øverst i Google søgeresultater"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-green-500 text-white text-xs font-medium rounded-full hover:opacity-90 transition-opacity"
                                        >
                                            <span>📢</span> Google Ads
                                        </a>
                                        <a
                                            href="https://search.google.com/search-console"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Se hvordan din side performer i Google søgning, indsend sitemap og find fejl"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full hover:bg-gray-200 transition-colors"
                                        >
                                            <span>🔍</span> Search Console
                                        </a>
                                        <a
                                            href="https://analytics.google.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Se besøgstal, brugeradfærd og trafikkilder på din hjemmeside"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full hover:bg-gray-200 transition-colors"
                                        >
                                            <span>📊</span> Analytics
                                        </a>
                                    </div>
                                </div>

                                {/* Schema Preview - Collapsible */}
                                <details className="mt-4">
                                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                        Vis Structured Data (for udviklere)
                                    </summary>
                                    <div className="mt-2 p-4 bg-slate-900 border rounded-lg">
                                        <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                                            {editForm.slug?.startsWith('/produkt/') ?
                                                `{
  "@type": "Product",
  "name": "${editForm.title?.replace(' - Bestil Online', '') || 'Product'}",
  "offers": { "lowPrice": "99", "currency": "DKK" }
}` : editForm.slug === '/' ?
                                                    `{
  "@type": "Organization",
  "name": "Webprinter.dk"
}` :
                                                    `{
  "@type": "WebPage",
  "name": "${editForm.title || 'Page'}"
}`}
                                        </pre>
                                        <p className="text-xs text-slate-500 mt-2">
                                            ✅ Auto-genereret for Google & AI
                                        </p>
                                    </div>
                                </details>

                                <div className="flex gap-2 pt-4">
                                    <Button className="w-full" onClick={handleSave} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Gem Ændringer
                                    </Button>
                                    <Button variant="outline" onClick={() => setEditingId(null)}>
                                        Annuller
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="bg-muted/10 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                <Search className="h-10 w-10 mb-4 opacity-20" />
                                <p>Vælg en side til venstre for at redigere SEO indstillinger</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
