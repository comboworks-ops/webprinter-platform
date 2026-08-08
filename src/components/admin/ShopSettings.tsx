import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Bell, Shield, Globe, Loader2, Save, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useShopSettings } from "@/hooks/useShopSettings";
import { TenantPodShippingProfile } from "./TenantPodShippingProfile";
import {
    BusinessIdentityEvidence,
    type TenantBusinessEvidenceDisplay,
} from "./BusinessIdentityEvidence";
import {
    buildTenantSettingsUpdate,
    canVerifyDanishBusinessIdentity,
    createDanishBusinessIdentityDraft,
    mergeDanishBusinessIdentitySettings,
    isCurrentTenantOperation,
    normalizeBusinessEvidenceState,
    normalizeDanishCvr,
    readEditableCompanyName,
    readSavedStructuredViesIdentifier,
    type DanishBusinessIdentityDraft,
    type DanishStructuredAddress,
} from "@/lib/onboarding/danishBusinessIdentity";
import {
    readLatestTenantBusinessEvidence,
    type TenantBusinessEvidenceReadClient,
} from "@/lib/onboarding/businessEvidenceRead";

export function ShopSettings() {
    const { data: tenant, isLoading } = useShopSettings();
    const queryClient = useQueryClient();
    const tenantId = typeof tenant?.id === "string" ? tenant.id : null;
    const activeTenantIdRef = useRef<string | null>(tenantId);
    activeTenantIdRef.current = tenantId;
    const previousTenantIdRef = useRef<string | null>(tenantId);
    const saveGenerationRef = useRef(0);
    if (previousTenantIdRef.current !== tenantId) {
        previousTenantIdRef.current = tenantId;
        saveGenerationRef.current += 1;
    }

    // Company Info
    const [companyName, setCompanyName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [cvr, setCvr] = useState("");
    const [adminName, setAdminName] = useState("");
    const [structuredAddress, setStructuredAddress] = useState<DanishStructuredAddress>(() =>
        createDanishBusinessIdentityDraft({}).address,
    );
    const [legacyAddressWasParsed, setLegacyAddressWasParsed] = useState(false);
    const [savedIdentityFingerprint, setSavedIdentityFingerprint] = useState("");
    const [savedViesIdentifier, setSavedViesIdentifier] = useState<string | null>(null);
    const [businessEvidence, setBusinessEvidence] = useState<TenantBusinessEvidenceDisplay | null>(null);
    const [verifyingBusiness, setVerifyingBusiness] = useState(false);

    // Notifications
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [orderConfirmations, setOrderConfirmations] = useState(true);
    const [marketingEmails, setMarketingEmails] = useState(false);

    // Regional
    const [language, setLanguage] = useState("da");
    const [currency, setCurrency] = useState("DKK");
    const [timezone, setTimezone] = useState("Europe/Copenhagen");
    const [canvaEnabled, setCanvaEnabled] = useState(false);
    const [canvaButtonLabel, setCanvaButtonLabel] = useState("Design i Canva");
    const [canvaHelperText, setCanvaHelperText] = useState("Åbn en Canva-template i et nyt vindue og vend tilbage med din færdige fil.");

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (tenant) {
            const s = tenant as unknown as ShopSettingsView;
            const company = s.company;

            // Company
            const identity = createDanishBusinessIdentityDraft(company ?? {});
            const companyCvr = identity.cvrInput || company?.cvr || "";
            const companyAddress = company?.address || "";
            setCompanyName(readEditableCompanyName(company, s.tenant_name));
            setEmail(company?.email || "");
            setPhone(company?.phone || "");
            setAddress(companyAddress);
            setCvr(companyCvr);
            setAdminName(company?.admin_name || "");
            setStructuredAddress(identity.address);
            setLegacyAddressWasParsed(identity.legacyAddressWasParsed);
            setSavedIdentityFingerprint(
                identityFingerprint({
                    cvr: companyCvr,
                    legacyAddress: companyAddress,
                    structuredAddress: identity.address,
                }),
            );
            setSavedViesIdentifier(readSavedStructuredViesIdentifier(company));

            // Notifications
            if (s.notifications) {
                setEmailNotifications(s.notifications.new_orders ?? true);
                setOrderConfirmations(s.notifications.order_confirmations ?? true);
                setMarketingEmails(s.notifications.marketing ?? false);
            }

            // Regional
            if (s.regional) {
                setLanguage(s.regional.language || "da");
                setCurrency(s.regional.currency || "DKK");
                setTimezone(s.regional.timezone || "Europe/Copenhagen");
            }

            if (s.canva) {
                setCanvaEnabled(s.canva.enabled === true);
                setCanvaButtonLabel(s.canva.button_label || "Design i Canva");
                setCanvaHelperText(
                    s.canva.helper_text
                    || "Åbn en Canva-template i et nyt vindue og vend tilbage med din færdige fil.",
                );
            }
        }
    }, [tenant]);

    useEffect(() => {
        let active = true;
        setBusinessEvidence(null);
        setVerifyingBusiness(false);
        setSaving(false);
        if (!tenantId || !savedViesIdentifier) {
            return () => {
                active = false;
            };
        }

        void readLatestTenantBusinessEvidence(
            businessEvidenceReadClient,
            tenantId,
            savedViesIdentifier,
        ).then((evidence) => {
            if (active) setBusinessEvidence(evidence);
        });
        return () => {
            active = false;
        };
    }, [tenantId, savedViesIdentifier]);

    const identityDraft: DanishBusinessIdentityDraft = {
        cvrInput: cvr,
        address: structuredAddress,
        legacyAddressWasParsed,
    };
    const currentIdentityFingerprint = identityFingerprint({
        cvr,
        legacyAddress: address,
        structuredAddress,
    });
    const currentViesIdentifier = normalizeDanishCvr(cvr).viesVatId;
    const hasUnsavedIdentityChanges =
        currentIdentityFingerprint !== savedIdentityFingerprint ||
        currentViesIdentifier !== savedViesIdentifier;
    const canVerifyBusinessIdentity = canVerifyDanishBusinessIdentity(identityDraft);
    const displayedBusinessEvidence =
        !hasUnsavedIdentityChanges &&
            businessEvidence?.normalizedIdentifier === savedViesIdentifier
            ? businessEvidence
            : null;

    const updateStructuredAddress = (
        field: Exclude<keyof DanishStructuredAddress, "country">,
        value: string,
    ) => {
        setStructuredAddress((current) => ({ ...current, [field]: value, country: "DK" }));
        setLegacyAddressWasParsed(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;

        const requestedTenantId = tenantId;
        const requestedGeneration = saveGenerationRef.current + 1;
        saveGenerationRef.current = requestedGeneration;
        const operationScope = {
            tenantId: requestedTenantId,
            generation: requestedGeneration,
        } as const;
        const requestedIdentityFingerprint = currentIdentityFingerprint;
        const requestedViesIdentifier = currentViesIdentifier;
        const previousSavedViesIdentifier = savedViesIdentifier;
        const isCurrentSave = () => isCurrentTenantOperation(operationScope, {
            tenantId: activeTenantIdRef.current,
            generation: saveGenerationRef.current,
        });

        setSaving(true);
        try {
            const { data: tenantRow, error: tenantRowError } = await shopSettingsSupabase
                .from('tenants')
                .select('settings')
                .eq('id', requestedTenantId)
                .maybeSingle();

            if (tenantRowError) throw tenantRowError;
            if (!tenantRow) throw new Error("tenant settings unavailable");
            if (!isCurrentSave()) return;

            const current = isPlainRecord(tenantRow?.settings) ? tenantRow.settings : {};

            const settingsWithSections = {
                ...current,
                notifications: {
                    new_orders: emailNotifications,
                    order_confirmations: orderConfirmations,
                    marketing: marketingEmails
                },
                regional: {
                    language,
                    currency,
                    timezone
                },
                canva: {
                    enabled: canvaEnabled,
                    button_label: canvaButtonLabel.trim() || "Design i Canva",
                    helper_text: canvaHelperText.trim() || null,
                }
            };
            const newSettings = mergeDanishBusinessIdentitySettings(settingsWithSections, {
                companyPatch: {
                    name: companyName.trim() || null,
                    email,
                    phone,
                    address,
                    cvr,
                    admin_name: adminName.trim() || null,
                },
                identity: identityDraft,
            });

            const tenantUpdate = buildTenantSettingsUpdate(
                newSettings as Json,
                companyName,
            );

            const { error } = await shopSettingsSupabase
                .from('tenants')
                .update(tenantUpdate)
                .eq('id', requestedTenantId);

            if (error) throw error;
            if (!isCurrentSave()) return;

            toast.success('Indstillinger gemt');
            setSavedIdentityFingerprint(requestedIdentityFingerprint);
            setSavedViesIdentifier(requestedViesIdentifier);
            if (requestedViesIdentifier !== previousSavedViesIdentifier) {
                setBusinessEvidence(null);
            }

            // Invalidate query to force refresh
            queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
        } catch (error) {
            if (!isCurrentSave()) return;
            console.error("Error saving settings:", error);
            toast.error("Kunne ikke gemme indstillinger");
        } finally {
            if (isCurrentSave()) setSaving(false);
        }
    };

    const handleVerifyBusiness = async () => {
        if (
            !tenantId ||
            verifyingBusiness ||
            hasUnsavedIdentityChanges ||
            !canVerifyBusinessIdentity
        ) {
            return;
        }
        const normalizedCvr = normalizeDanishCvr(cvr).normalizedCvr;
        if (!normalizedCvr) return;
        const normalizedIdentifier = `DK${normalizedCvr}`;
        const requestedTenantId = tenantId;

        setVerifyingBusiness(true);
        setBusinessEvidence((current) => ({
            normalizedIdentifier,
            status: "pending",
            provider: current?.provider ?? "EU VIES",
            checkedAt: current?.checkedAt ?? null,
        }));
        try {
            const { data, error } = await supabase.functions.invoke("tenant-business-evidence", {
                body: {
                    operation: "vies",
                    tenantId: requestedTenantId,
                    cvr: normalizedCvr,
                },
            });
            if (error) throw new Error("business evidence unavailable");
            if (activeTenantIdRef.current !== requestedTenantId) return;

            const response = isPlainRecord(data) ? data : {};
            const responseState = normalizeBusinessEvidenceState(response.status).status;
            setBusinessEvidence({
                normalizedIdentifier,
                status: responseState,
                provider: boundedDisplayText(response.provider, 80) || "EU VIES",
                checkedAt: readIsoInstant(response.checkedAt),
            });
            const storedEvidence = await readLatestTenantBusinessEvidence(
                businessEvidenceReadClient,
                requestedTenantId,
                normalizedIdentifier,
            );
            if (activeTenantIdRef.current !== requestedTenantId) return;
            if (storedEvidence) setBusinessEvidence(storedEvidence);

            if (responseState === "valid") {
                toast.success("Virksomhedsoplysningerne blev bekræftet");
            } else if (responseState === "invalid") {
                toast.info("VIES kunne ikke bekræfte CVR-nummeret. Oplysningerne er stadig gemt.");
            } else {
                toast.info("Kontroltjenesten er utilgængelig. Oplysningerne er stadig gemt.");
            }
        } catch {
            if (activeTenantIdRef.current !== requestedTenantId) return;
            setBusinessEvidence({
                normalizedIdentifier,
                status: "unavailable",
                provider: "EU VIES",
                checkedAt: null,
            });
            toast.info("Kontroltjenesten er utilgængelig. Prøv igen senere.");
        } finally {
            if (activeTenantIdRef.current === requestedTenantId) {
                setVerifyingBusiness(false);
            }
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Indstillinger</h1>
                <p className="text-muted-foreground">Generelle indstillinger for din webshop</p>
            </div>

            {/* Contact Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Kontaktoplysninger
                    </CardTitle>
                    <CardDescription>Disse oplysninger bruges på fakturaer og kontaktsiden</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Firmanavn</Label>
                        <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Dit Trykkeri ApS"
                        />
                        <p className="text-xs text-muted-foreground">Dette navn vises i admin panelet</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="adminName">Navn på administrator</Label>
                        <Input
                            id="adminName"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="F.eks. Anders Andersen"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="info@dit-trykkeri.dk"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefon</Label>
                            <Input
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+45 12 34 56 78"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Adresse</Label>
                        <Textarea
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Virksomhedsvej 123&#10;1234 By"
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cvr">CVR-nummer</Label>
                        <Input
                            id="cvr"
                            value={cvr}
                            onChange={(e) => setCvr(e.target.value)}
                            placeholder="12345678"
                        />
                    </div>
                    <div className="space-y-4 rounded-lg border p-4">
                        <div>
                            <p className="font-medium">Struktureret dansk adresse</p>
                            <p className="text-sm text-muted-foreground">
                                Bruges kun til frivillig adressekontrol. Den eksisterende fritekstadresse ovenfor bevares.
                            </p>
                            {legacyAddressWasParsed ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Felterne er udfyldt fra den entydige fritekstadresse. Kontrollér dem før gemning.
                                </p>
                            ) : null}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_9rem]">
                            <div className="space-y-2">
                                <Label htmlFor="businessStreet">Vejnavn</Label>
                                <Input
                                    id="businessStreet"
                                    value={structuredAddress.streetName}
                                    onChange={(event) => updateStructuredAddress("streetName", event.target.value)}
                                    placeholder="Virksomhedsvej"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessHouseNumber">Husnummer</Label>
                                <Input
                                    id="businessHouseNumber"
                                    value={structuredAddress.houseNumber}
                                    onChange={(event) => updateStructuredAddress("houseNumber", event.target.value)}
                                    placeholder="12B"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                            <div className="space-y-2">
                                <Label htmlFor="businessFloor">Etage</Label>
                                <Input
                                    id="businessFloor"
                                    value={structuredAddress.floor}
                                    onChange={(event) => updateStructuredAddress("floor", event.target.value)}
                                    placeholder="2."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessDoor">Dør</Label>
                                <Input
                                    id="businessDoor"
                                    value={structuredAddress.door}
                                    onChange={(event) => updateStructuredAddress("door", event.target.value)}
                                    placeholder="th"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessPostcode">Postnr.</Label>
                                <Input
                                    id="businessPostcode"
                                    inputMode="numeric"
                                    value={structuredAddress.postcode}
                                    onChange={(event) => updateStructuredAddress("postcode", event.target.value)}
                                    placeholder="2100"
                                />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <Label htmlFor="businessCity">By</Label>
                                <Input
                                    id="businessCity"
                                    value={structuredAddress.city}
                                    onChange={(event) => updateStructuredAddress("city", event.target.value)}
                                    placeholder="København Ø"
                                />
                            </div>
                        </div>
                        <div className="max-w-32 space-y-2">
                            <Label htmlFor="businessCountry">Land</Label>
                            <Input id="businessCountry" value="DK" disabled readOnly />
                        </div>
                    </div>
                    <BusinessIdentityEvidence
                        evidence={displayedBusinessEvidence}
                        canVerify={canVerifyBusinessIdentity}
                        hasUnsavedChanges={hasUnsavedIdentityChanges}
                        verifying={verifyingBusiness}
                        onVerify={() => void handleVerifyBusiness()}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Canva
                    </CardTitle>
                    <CardDescription>
                        Pro-niveau integration: vis en Canva-knap på produkter med en kurateret Canva-template.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Tilbyd Canva til kunder</p>
                            <p className="text-sm text-muted-foreground">
                                Aktiver Canva-knappen på produkter, der har en specifik Canva-template URL.
                            </p>
                        </div>
                        <Switch checked={canvaEnabled} onCheckedChange={setCanvaEnabled} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="canvaButtonLabel">Knaptekst</Label>
                        <Input
                            id="canvaButtonLabel"
                            value={canvaButtonLabel}
                            onChange={(e) => setCanvaButtonLabel(e.target.value)}
                            placeholder="Design i Canva"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="canvaHelperText">Hjælpetekst</Label>
                        <Textarea
                            id="canvaHelperText"
                            value={canvaHelperText}
                            onChange={(e) => setCanvaHelperText(e.target.value)}
                            rows={3}
                            placeholder="Fortæl kunden hvordan Canva-flowet fungerer."
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Regional Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Regionale Indstillinger
                    </CardTitle>
                    <CardDescription>Sprog, valuta og tidszone</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="language">Sprog</Label>
                            <select
                                id="language"
                                className="w-full rounded-md border py-2 px-3 bg-background"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            >
                                <option value="da">Dansk</option>
                                <option value="en">English</option>
                                <option value="de">Deutsch</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Valuta</Label>
                            <select
                                id="currency"
                                className="w-full rounded-md border py-2 px-3 bg-background"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                            >
                                <option value="DKK">DKK (kr)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="SEK">SEK (kr)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Tidszone</Label>
                            <select
                                id="timezone"
                                className="w-full rounded-md border py-2 px-3 bg-background"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                            >
                                <option value="Europe/Copenhagen">København (CET)</option>
                                <option value="Europe/London">London (GMT)</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* POD sender identity (white-label POD shipments) */}
            <TenantPodShippingProfile />

            {/* Notifications */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notifikationer
                    </CardTitle>
                    <CardDescription>Vælg hvilke emails du vil modtage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Nye ordrer</p>
                            <p className="text-sm text-muted-foreground">Modtag email når en kunde afgiver en ordre</p>
                        </div>
                        <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Ordrebekræftelser</p>
                            <p className="text-sm text-muted-foreground">Send automatisk bekræftelse til kunder</p>
                        </div>
                        <Switch checked={orderConfirmations} onCheckedChange={setOrderConfirmations} />
                    </div>
                </CardContent>
            </Card>
            {/* Save Button */}
            <div className="flex justify-end pt-4 pb-8">
                <Button onClick={handleSave} size="lg" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Gem Indstillinger
                </Button>
            </div>
        </div>
    );
}

function identityFingerprint(input: {
    cvr: string;
    legacyAddress: string;
    structuredAddress: DanishStructuredAddress;
}) {
    return JSON.stringify({
        cvr: input.cvr.trim(),
        legacyAddress: input.legacyAddress.trim(),
        structuredAddress: input.structuredAddress,
    });
}

function boundedDisplayText(value: unknown, maximum: number): string | null {
    if (typeof value !== "string") return null;
    const text = value.replace(/\s+/g, " ").trim();
    return text && text.length <= maximum ? text : null;
}

function readIsoInstant(value: unknown): string | null {
    if (typeof value !== "string" || value.length > 40) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

type ShopSettingsView = Readonly<{
    tenant_name?: string | null;
    company?: Readonly<{
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        cvr?: string | null;
        admin_name?: string | null;
        business_identity_v1?: unknown;
    }> | null;
    notifications?: Readonly<{
        new_orders?: boolean | null;
        order_confirmations?: boolean | null;
        marketing?: boolean | null;
    }> | null;
    regional?: Readonly<{
        language?: string | null;
        currency?: string | null;
        timezone?: string | null;
    }> | null;
    canva?: Readonly<{
        enabled?: boolean | null;
        button_label?: string | null;
        helper_text?: string | null;
    }> | null;
}>;

type ShopSettingsDatabase = Omit<Database, "public"> & {
    public: Omit<Database["public"], "Tables"> & {
        Tables: Database["public"]["Tables"] & {
            tenants: {
                Row: { id: string; name: string; settings: Json | null };
                Insert: { id?: string; name: string; settings?: Json | null };
                Update: { name?: string; settings?: Json | null };
                Relationships: [];
            };
            tenant_business_evidence: {
                Row: {
                    checked_at: string;
                    evidence_type: "vies" | "danish_company" | "danish_address";
                    provider: string;
                    normalized_identifier: string;
                    result_status: string;
                    tenant_id: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
        };
    };
};

const shopSettingsSupabase = supabase as unknown as SupabaseClient<ShopSettingsDatabase>;
const businessEvidenceReadClient = shopSettingsSupabase as unknown as TenantBusinessEvidenceReadClient;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export default ShopSettings;
