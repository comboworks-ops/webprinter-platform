import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Package, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useShopSettings } from "@/hooks/useShopSettings";

type SenderMode = "standard" | "blind" | "custom";

interface PodShippingProfileRow {
    tenant_id: string;
    sender_mode: SenderMode;
    sender_company_name: string | null;
    sender_contact_name: string | null;
    sender_email: string | null;
    sender_phone: string | null;
    sender_street: string | null;
    sender_house_number: string | null;
    sender_postcode: string | null;
    sender_city: string | null;
    sender_country: string | null;
    sender_vat_number: string | null;
    sender_logo_url: string | null;
    notes: string | null;
}

const EMPTY_PROFILE = (tenantId: string): PodShippingProfileRow => ({
    tenant_id: tenantId,
    sender_mode: "standard",
    sender_company_name: null,
    sender_contact_name: null,
    sender_email: null,
    sender_phone: null,
    sender_street: null,
    sender_house_number: null,
    sender_postcode: null,
    sender_city: null,
    sender_country: "DK",
    sender_vat_number: null,
    sender_logo_url: null,
    notes: null,
});

/**
 * Attempts to split an existing "address" string from settings.company into
 * { street, houseNumber, postcode, city } so the tenant doesn't have to
 * retype it. Supports the two common shapes the field holds today:
 *   - "Virksomhedsvej 123\n1234 By"
 *   - "Virksomhedsvej 123, 1234 By"
 * Anything we can't confidently parse is returned untouched in `street`.
 */
function splitCompanyAddress(raw: string | null | undefined): {
    street?: string;
    houseNumber?: string;
    postcode?: string;
    city?: string;
} {
    if (!raw) return {};
    const lines = raw.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return {};

    const firstLine = lines[0];
    // Try to pull the trailing house number off the first line
    const streetMatch = firstLine.match(/^(.*\S)\s+(\d+[A-Za-z]?(?:\s*-\s*\d+[A-Za-z]?)?)\s*$/);
    const street = streetMatch ? streetMatch[1].trim() : firstLine;
    const houseNumber = streetMatch ? streetMatch[2].trim() : undefined;

    // Second line: "1234 By" or "DK-1234 By"
    let postcode: string | undefined;
    let city: string | undefined;
    const tail = lines.slice(1).join(" ").trim();
    if (tail) {
        const cityMatch = tail.match(/^(?:[A-Z]{2}-)?(\d{3,5})\s+(.+)$/);
        if (cityMatch) {
            postcode = cityMatch[1];
            city = cityMatch[2].trim();
        } else {
            city = tail;
        }
    }

    return { street, houseNumber, postcode, city };
}

export function TenantPodShippingProfile() {
    const { data: tenant, isLoading: tenantLoading } = useShopSettings();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState<PodShippingProfileRow | null>(null);

    const tenantId: string | undefined = (tenant as any)?.id;
    const company = useMemo(() => ((tenant as any)?.company || {}) as {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
        cvr?: string;
    }, [tenant]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!tenantId) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("tenant_pod_shipping_profile" as any)
                    .select("*")
                    .eq("tenant_id", tenantId)
                    .maybeSingle();

                if (error && (error as any).code !== "PGRST116") {
                    throw error;
                }

                if (cancelled) return;

                if (data) {
                    setProfile(data as unknown as PodShippingProfileRow);
                } else {
                    // Prefill from company settings so the tenant sees their own
                    // info the first time they open this card.
                    const split = splitCompanyAddress(company.address);
                    setProfile({
                        ...EMPTY_PROFILE(tenantId),
                        sender_company_name: company.name ?? null,
                        sender_email: company.email ?? null,
                        sender_phone: company.phone ?? null,
                        sender_vat_number: company.cvr ?? null,
                        sender_street: split.street ?? null,
                        sender_house_number: split.houseNumber ?? null,
                        sender_postcode: split.postcode ?? null,
                        sender_city: split.city ?? null,
                    });
                }
            } catch (err) {
                console.error("[TenantPodShippingProfile] load failed", err);
                toast.error("Kunne ikke indlæse POD-afsenderprofil");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [tenantId, company]);

    function updateField<K extends keyof PodShippingProfileRow>(
        key: K,
        value: PodShippingProfileRow[K],
    ) {
        setProfile(prev => (prev ? { ...prev, [key]: value } : prev));
    }

    async function handleSave() {
        if (!profile || !tenantId) return;
        // Light validation: if custom mode, require the minimum set Print.com needs.
        if (profile.sender_mode === "custom") {
            const missing: string[] = [];
            if (!profile.sender_company_name?.trim()) missing.push("Firmanavn");
            if (!profile.sender_street?.trim()) missing.push("Vejnavn");
            if (!profile.sender_house_number?.trim()) missing.push("Husnummer");
            if (!profile.sender_postcode?.trim()) missing.push("Postnummer");
            if (!profile.sender_city?.trim()) missing.push("By");
            if (!profile.sender_country?.trim()) missing.push("Land");
            if (missing.length > 0) {
                toast.error(`Udfyld: ${missing.join(", ")}`);
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                tenant_id: tenantId,
                sender_mode: profile.sender_mode,
                sender_company_name: profile.sender_company_name,
                sender_contact_name: profile.sender_contact_name,
                sender_email: profile.sender_email,
                sender_phone: profile.sender_phone,
                sender_street: profile.sender_street,
                sender_house_number: profile.sender_house_number,
                sender_postcode: profile.sender_postcode,
                sender_city: profile.sender_city,
                sender_country: profile.sender_country,
                sender_vat_number: profile.sender_vat_number,
                sender_logo_url: profile.sender_logo_url,
                notes: profile.notes,
            };

            const { error } = await supabase
                .from("tenant_pod_shipping_profile" as any)
                .upsert(payload, { onConflict: "tenant_id" });

            if (error) throw error;
            toast.success("POD-afsenderprofil gemt");
        } catch (err) {
            console.error("[TenantPodShippingProfile] save failed", err);
            toast.error("Kunne ikke gemme POD-afsenderprofil");
        } finally {
            setSaving(false);
        }
    }

    async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files || event.target.files.length === 0 || !tenantId) return;
        const file = event.target.files[0];
        event.target.value = ""; // allow re-selecting same file later

        // Accept PNG/JPG/SVG up to 3MB
        const maxSize = 3 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error("Logoet er for stort. Max 3MB.");
            return;
        }

        setUploading(true);
        try {
            const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `pod-shipping/${tenantId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("product-images")
                .upload(filePath, file, { upsert: false });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("product-images")
                .getPublicUrl(filePath);

            updateField("sender_logo_url", publicUrl);
            toast.success("Logo uploadet – husk at gemme");
        } catch (err) {
            console.error("[TenantPodShippingProfile] logo upload failed", err);
            toast.error("Kunne ikke uploade logo");
        } finally {
            setUploading(false);
        }
    }

    if (tenantLoading || loading || !profile) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Afsenderidentitet på POD-pakker
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Indlæser…
                    </div>
                </CardContent>
            </Card>
        );
    }

    const mode = profile.sender_mode;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Afsenderidentitet på POD-pakker
                </CardTitle>
                <CardDescription>
                    Bestem hvordan dit trykkeri fremstår som afsender, når en POD-ordre sendes direkte til kunden
                    fra vores produktionspartner. Denne indstilling gælder <strong>kun POD-produkter</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Mode selector */}
                <div className="space-y-3">
                    <Label>Afsenderlæggelse</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <ModeCard
                            active={mode === "standard"}
                            title="Standard"
                            body="Brug platformens standardafsender. Kunden ser intet om os eller produktionspartneren."
                            onClick={() => updateField("sender_mode", "standard")}
                        />
                        <ModeCard
                            active={mode === "blind"}
                            title="Blind forsendelse"
                            body="Pakken sendes helt uden afsenderinformation. Ingen navn eller logo på pakkesedlen."
                            onClick={() => updateField("sender_mode", "blind")}
                        />
                        <ModeCard
                            active={mode === "custom"}
                            title="Dit eget firma"
                            body="Pakken vises som afsendt af dit firma. Logo bruges på pakkeseddel / etiket, hvor produktionspartneren understøtter det."
                            onClick={() => updateField("sender_mode", "custom")}
                        />
                    </div>
                </div>

                {mode === "custom" && (
                    <div className="space-y-6 border rounded-lg p-4 bg-muted/30">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pod_company_name">Firmanavn</Label>
                                    <Input
                                        id="pod_company_name"
                                        value={profile.sender_company_name ?? ""}
                                        onChange={(e) => updateField("sender_company_name", e.target.value || null)}
                                        placeholder="Dit Trykkeri ApS"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pod_contact_name">Kontaktperson (valgfri)</Label>
                                    <Input
                                        id="pod_contact_name"
                                        value={profile.sender_contact_name ?? ""}
                                        onChange={(e) => updateField("sender_contact_name", e.target.value || null)}
                                        placeholder="Anders Andersen"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pod_email">Email (valgfri)</Label>
                                    <Input
                                        id="pod_email"
                                        type="email"
                                        value={profile.sender_email ?? ""}
                                        onChange={(e) => updateField("sender_email", e.target.value || null)}
                                        placeholder="info@dit-trykkeri.dk"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pod_phone">Telefon (valgfri)</Label>
                                    <Input
                                        id="pod_phone"
                                        value={profile.sender_phone ?? ""}
                                        onChange={(e) => updateField("sender_phone", e.target.value || null)}
                                        placeholder="+45 12 34 56 78"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pod_street">Vejnavn</Label>
                                    <Input
                                        id="pod_street"
                                        value={profile.sender_street ?? ""}
                                        onChange={(e) => updateField("sender_street", e.target.value || null)}
                                        placeholder="Virksomhedsvej"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pod_housenr">Husnummer</Label>
                                    <Input
                                        id="pod_housenr"
                                        value={profile.sender_house_number ?? ""}
                                        onChange={(e) => updateField("sender_house_number", e.target.value || null)}
                                        placeholder="123"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_160px] gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pod_postcode">Postnummer</Label>
                                    <Input
                                        id="pod_postcode"
                                        value={profile.sender_postcode ?? ""}
                                        onChange={(e) => updateField("sender_postcode", e.target.value || null)}
                                        placeholder="1234"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pod_city">By</Label>
                                    <Input
                                        id="pod_city"
                                        value={profile.sender_city ?? ""}
                                        onChange={(e) => updateField("sender_city", e.target.value || null)}
                                        placeholder="København"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pod_country">Land (ISO)</Label>
                                    <Input
                                        id="pod_country"
                                        maxLength={2}
                                        value={profile.sender_country ?? ""}
                                        onChange={(e) => updateField("sender_country", (e.target.value || "").toUpperCase() || null)}
                                        placeholder="DK"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pod_vat">CVR / momsnummer (valgfri)</Label>
                                <Input
                                    id="pod_vat"
                                    value={profile.sender_vat_number ?? ""}
                                    onChange={(e) => updateField("sender_vat_number", e.target.value || null)}
                                    placeholder="12345678"
                                />
                            </div>
                        </div>

                        {/* Logo uploader */}
                        <div className="space-y-3">
                            <Label>Logo til pakkeseddel</Label>
                            <div className="flex items-start gap-4">
                                <div className="w-28 h-28 border-2 border-dashed rounded-lg flex items-center justify-center bg-background overflow-hidden shrink-0">
                                    {profile.sender_logo_url ? (
                                        <img
                                            src={profile.sender_logo_url}
                                            alt="POD logo"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={uploading}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {uploading
                                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                : <Upload className="mr-2 h-4 w-4" />}
                                            {profile.sender_logo_url ? "Skift logo" : "Upload logo"}
                                        </Button>
                                        {profile.sender_logo_url && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => updateField("sender_logo_url", null)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Fjern
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        PNG, JPG eller SVG. Max 3MB. Logoet printes på pakkeseddel / etiket, når
                                        produktionspartneren understøtter det.
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/svg+xml"
                                        className="hidden"
                                        onChange={handleLogoUpload}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pod_notes">Interne noter (valgfri)</Label>
                            <Textarea
                                id="pod_notes"
                                rows={3}
                                value={profile.notes ?? ""}
                                onChange={(e) => updateField("notes", e.target.value || null)}
                                placeholder="Fx særlige ønsker til afsenderetiket"
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <Save className="mr-2 h-4 w-4" />}
                        Gem afsenderindstillinger
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

interface ModeCardProps {
    active: boolean;
    title: string;
    body: string;
    onClick: () => void;
}

function ModeCard({ active, title, body, onClick }: ModeCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                "text-left rounded-lg border-2 p-4 transition-colors "
                + (active
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/40")
            }
        >
            <div className="font-medium mb-1">{title}</div>
            <div className="text-sm text-muted-foreground">{body}</div>
        </button>
    );
}

export default TenantPodShippingProfile;
