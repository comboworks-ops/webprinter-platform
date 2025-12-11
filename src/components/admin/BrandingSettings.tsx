import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";

export function BrandingSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [primaryColor, setPrimaryColor] = useState("#000000");
    const [secondaryColor, setSecondaryColor] = useState("#ffffff");
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchBranding();
    }, []);

    const fetchBranding = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (tenant && (tenant as any).settings?.branding) {
                const branding = (tenant as any).settings.branding;
                if (branding.logo_url) setLogoUrl(branding.logo_url);
                if (branding.primary_color) setPrimaryColor(branding.primary_color);
                if (branding.secondary_color) setSecondaryColor(branding.secondary_color);
            }
        } catch (error) {
            console.error("Error fetching branding:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        setUploading(true);
        try {
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Math.random()}.${fileExt}`;
            const filePath = `branding/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images') // Reusing existing bucket for now, or create 'tenant-assets'
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            setLogoUrl(publicUrl);
            toast.success("Logo uploadet");
        } catch (error) {
            console.error("Error uploading logo:", error);
            toast.error("Kunne ikke uploade logo");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch current settings first to merge
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id, settings')
                .eq('owner_id', user.id)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const currentSettings = (tenant as any).settings || {};
            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentSettings.branding,
                    logo_url: logoUrl,
                    primary_color: primaryColor,
                    secondary_color: secondaryColor
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', (tenant as any).id);

            if (error) throw error;
            toast.success("Branding gemt");
        } catch (error) {
            console.error("Error saving branding:", error);
            toast.error("Kunne ikke gemme branding");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Branding</h1>
                <p className="text-muted-foreground">Tilpas din shops udseende</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Logo</CardTitle>
                        <CardDescription>Upload dit virksomhedslogo (PNG med gennemsigtig baggrund anbefales)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center min-h-[200px] bg-muted/5 relative">
                            {logoUrl ? (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <img src={logoUrl} alt="Shop Logo" className="max-h-[160px] object-contain" />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-0 right-0"
                                        onClick={() => setLogoUrl(null)}
                                    >
                                        Fjern
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                                    <p>Inget logo uploadet</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <Button asChild variant="outline" disabled={uploading}>
                                <label className="cursor-pointer">
                                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    {logoUrl ? 'Skift Logo' : 'Upload Logo'}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Farver</CardTitle>
                        <CardDescription>Vælg dine primære brand farver</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Primær Farve</Label>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full border shadow-sm overflow-hidden">
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="h-full w-full cursor-pointer p-0 border-none"
                                    />
                                </div>
                                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono" />
                            </div>
                            <p className="text-xs text-muted-foreground">Bruges til knapper, links og aktive elementer.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Sekundær Farve</Label>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full border shadow-sm overflow-hidden">
                                    <input
                                        type="color"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        className="h-full w-full cursor-pointer p-0 border-none"
                                    />
                                </div>
                                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono" />
                            </div>
                            <p className="text-xs text-muted-foreground">Bruges til accenter og baggrunde.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <Button size="lg" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gem Branding
                </Button>
            </div>
        </div>
    );
}

export default BrandingSettings;
