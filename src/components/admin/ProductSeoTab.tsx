import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Globe } from "lucide-react";
import { toast } from "sonner";

interface ProductSeoTabProps {
    productSlug: string;
    productName: string;
    tenantId: string;
}

export function ProductSeoTab({ productSlug, productName, tenantId }: ProductSeoTabProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [ogImageUrl, setOgImageUrl] = useState("");
    const [seoId, setSeoId] = useState<string | null>(null);
    const [shopDomain, setShopDomain] = useState("");
    const [shopName, setShopName] = useState("Webshop");

    const fullSlug = `/produkt/${productSlug}`;

    useEffect(() => {
        fetchSeoData();
    }, [productSlug, tenantId]);

    useEffect(() => {
        let active = true;
        setShopDomain("");
        setShopName("Webshop");
        (supabase.from('tenants' as any) as any).select('name, domain').eq('id', tenantId).maybeSingle().then(({ data }: { data: { name?: string | null; domain?: string | null } | null }) => {
            if (!active) return;
            setShopDomain(data?.domain || "");
            setShopName(data?.name || "Webshop");
        });
        return () => { active = false; };
    }, [tenantId]);

    const fetchSeoData = async () => {
        try {
            setLoading(true);
            const { data: rawData, error } = await supabase
                .from('page_seo' as any)
                .select('*')
                .eq('slug', fullSlug)
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (error) throw error;
            const data = rawData as any;

            if (data) {
                setSeoId(data.id);
                setTitle(data.title || "");
                setMetaDescription(data.meta_description || "");
                setOgImageUrl(data.og_image_url || "");
            } else {
                // No override exists, default to product name (but don't save yet)
                setSeoId(null);
                setTitle(productName);
                setMetaDescription("");
                setOgImageUrl("");
            }
        } catch (error) {
            console.error("Error fetching SEO data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                tenant_id: tenantId,
                slug: fullSlug,
                title: title,
                meta_description: metaDescription,
                og_image_url: ogImageUrl
            };

            let error;
            if (seoId) {
                const { error: updateError } = await supabase
                    .from('page_seo' as any)
                    .update(payload)
                    .eq('id', seoId);
                error = updateError;
            } else {
                const { data, error: insertError } = await supabase
                    .from('page_seo' as any)
                    .insert([payload])
                    .select()
                    .single();
                if (data) setSeoId((data as any).id);
                error = insertError;
            }

            if (error) throw error;
            toast.success("SEO indstillinger gemt");
        } catch (error: any) {
            console.error("Error saving SEO:", error);
            toast.error("Kunne ikke gemme SEO: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
    }

    return (
        <Card className="admin-product-seo">
            <CardHeader>
                <CardTitle>SEO & Meta</CardTitle>
                <CardDescription>
                    Disse informationer er usynlige på selve siden, men bruges af Google og sociale medier.
                </CardDescription>
            </CardHeader>
            <CardContent className="admin-product-seo-columns">

                {/* Google Preview */}
                <div className="admin-product-seo-preview p-6 bg-card border rounded-lg">
                    <h4 className="text-base font-semibold text-foreground mb-6">Forhåndsvisning i søgeresultater</h4>
                    <div className="font-sans">
                        <div className="flex items-center gap-1 text-sm text-foreground mb-1">
                            <Globe className="h-7 w-7 text-muted-foreground mr-2" aria-hidden="true" />
                            <div className="flex flex-col">
                                <span className="text-foreground">{shopName}</span>
                                <span className="text-muted-foreground text-xs break-all">{shopDomain ? `https://${shopDomain}` : ''}{fullSlug}</span>
                            </div>
                        </div>
                        <div className="text-blue-800 dark:text-blue-400 text-xl font-normal break-words">
                            {title || productName}
                        </div>
                        <div className="text-muted-foreground text-sm mt-1 line-clamp-2">
                            {metaDescription || 'Din beskrivelse vil blive vist her i søgeresultaterne...'}
                        </div>
                    </div>
                    {ogImageUrl && <img src={ogImageUrl} alt="Billede til deling" className="mt-6 max-h-56 w-full rounded object-contain" />}
                    <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">Eksempel på visning. Søgemaskinen kan vælge en anden titel eller beskrivelse.</p>
                </div>

                <div className="admin-product-seo-fields space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>SEO-titel</Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={productName}
                            />
                            <p className="text-xs text-muted-foreground text-right">{title.length} / 60 tegn</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Metabeskrivelse</Label>
                            <Textarea
                                value={metaDescription}
                                onChange={(e) => setMetaDescription(e.target.value)}
                                rows={4}
                                placeholder="En kort, sælgende beskrivelse der får folk til at klikke fra Google..."
                            />
                            <p className="text-xs text-muted-foreground text-right">{metaDescription.length} / 160 tegn</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-muted/10 p-4 rounded-lg border">
                            <Label className="mb-2 block">Social Share Billede (OG Image)</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={ogImageUrl}
                                    onChange={(e) => setOgImageUrl(e.target.value)}
                                    placeholder="https://..."
                                />
                                <Button variant="outline" size="sm" className="shrink-0 relative">
                                    Upload
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const fileName = `seo/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                                            const toastId = toast.loading("Uploader...");
                                            const { error } = await supabase.storage.from('product-images').upload(fileName, file);
                                            if (error) {
                                                toast.dismiss(toastId);
                                                toast.error("Upload fejlede");
                                                return;
                                            }
                                            const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
                                            setOgImageUrl(data.publicUrl);
                                            toast.dismiss(toastId);
                                            toast.success("Billede uploadet");
                                        }}
                                    />
                                </Button>
                            </div>
                            {ogImageUrl && (
                                <img src={ogImageUrl} alt="OG Preview" className="mt-2 w-full h-32 object-cover rounded border" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="admin-product-seo-actions flex justify-start pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Gem SEO Information
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
