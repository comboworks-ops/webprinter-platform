import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Bell, Shield, Globe, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ShopSettings() {
    // Company Info
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [cvr, setCvr] = useState("");

    // Notifications
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [orderConfirmations, setOrderConfirmations] = useState(true);
    const [marketingEmails, setMarketingEmails] = useState(false);

    // Regional
    const [language, setLanguage] = useState("da");
    const [currency, setCurrency] = useState("DKK");
    const [timezone, setTimezone] = useState("Europe/Copenhagen");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (tenant && (tenant as any).settings) {
                const s = (tenant as any).settings;

                // Company
                if (s.company) {
                    setEmail(s.company.email || "");
                    setPhone(s.company.phone || "");
                    setAddress(s.company.address || "");
                    setCvr(s.company.cvr || "");
                }

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
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get current to merge (branding etc)
            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id, settings')
                .eq('owner_id', user.id)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const current = (tenant as any).settings || {};

            const newSettings = {
                ...current,
                company: {
                    email,
                    phone,
                    address,
                    cvr
                },
                notifications: {
                    new_orders: emailNotifications,
                    order_confirmations: orderConfirmations,
                    marketing: marketingEmails
                },
                regional: {
                    language,
                    currency,
                    timezone
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', (tenant as any).id);

            if (error) throw error;
            toast.success('Indstillinger gemt');
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Kunne ikke gemme indstillinger");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

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

export default ShopSettings;
