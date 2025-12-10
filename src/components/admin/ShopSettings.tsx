import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Mail, Bell, Shield, Globe } from 'lucide-react';
import { toast } from 'sonner';

export function ShopSettings() {
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [orderConfirmations, setOrderConfirmations] = useState(true);
    const [marketingEmails, setMarketingEmails] = useState(false);

    const handleSave = () => {
        toast.success('Indstillinger gemt');
    };

    return (
        <div className="space-y-6">
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
                    <CardDescription>Disse oplysninger vises på din webshop</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="info@dit-trykkeri.dk" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefon</Label>
                            <Input id="phone" placeholder="+45 12 34 56 78" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Adresse</Label>
                        <Textarea id="address" placeholder="Virksomhedsvej 123&#10;1234 By" rows={3} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cvr">CVR-nummer</Label>
                        <Input id="cvr" placeholder="12345678" />
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
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Marketing emails</p>
                            <p className="text-sm text-muted-foreground">Modtag tips og nyheder fra Webprinter</p>
                        </div>
                        <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} />
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
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="language">Sprog</Label>
                            <select id="language" className="w-full rounded-md border py-2 px-3">
                                <option value="da">Dansk</option>
                                <option value="en">English</option>
                                <option value="de">Deutsch</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Valuta</Label>
                            <select id="currency" className="w-full rounded-md border py-2 px-3">
                                <option value="DKK">DKK (kr)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="SEK">SEK (kr)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Tidszone</Label>
                            <select id="timezone" className="w-full rounded-md border py-2 px-3">
                                <option value="Europe/Copenhagen">København (CET)</option>
                                <option value="Europe/London">London (GMT)</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Sikkerhed
                    </CardTitle>
                    <CardDescription>Adgangskode og sikkerhedsindstillinger</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Skift adgangskode</p>
                            <p className="text-sm text-muted-foreground">Sidst ændret for 30 dage siden</p>
                        </div>
                        <Button variant="outline">Skift</Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">To-faktor godkendelse</p>
                            <p className="text-sm text-muted-foreground">Tilføj et ekstra lag af sikkerhed</p>
                        </div>
                        <Button variant="outline">Aktiver</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} size="lg">
                    Gem Indstillinger
                </Button>
            </div>
        </div>
    );
}

export default ShopSettings;
