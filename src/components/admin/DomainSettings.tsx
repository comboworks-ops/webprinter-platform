import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

export function DomainSettings() {
    const [customDomain, setCustomDomain] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tenantData, setTenantData] = useState<{ subdomain: string; domain: string | null } | null>(null);

    useEffect(() => {
        fetchDomainSettings();
    }, []);

    const fetchDomainSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('subdomain, domain')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (tenant) {
                setTenantData({
                    subdomain: (tenant as any).subdomain,
                    domain: (tenant as any).domain
                });
                if ((tenant as any).domain) {
                    setCustomDomain((tenant as any).domain);
                }
            }
        } catch (error) {
            console.error('Error fetching domain settings:', error);
            toast.error('Kunne ikke hente domæne indstillinger');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDomain = async () => {
        if (!customDomain.trim()) return;

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Simple validation
            let domainToSave = customDomain.trim().toLowerCase();
            if (domainToSave.startsWith('http://')) domainToSave = domainToSave.replace('http://', '');
            if (domainToSave.startsWith('https://')) domainToSave = domainToSave.replace('https://', '');
            if (domainToSave.endsWith('/')) domainToSave = domainToSave.slice(0, -1);

            const { error } = await supabase
                .from('tenants' as any)
                .update({ domain: domainToSave })
                .eq('owner_id', user.id);

            if (error) throw error;

            setTenantData(prev => prev ? { ...prev, domain: domainToSave } : null);
            toast.success('Domæne gemt. Husk at opsætte DNS.');
        } catch (error: any) {
            console.error('Error saving domain:', error);
            toast.error(error.message || 'Kunne ikke gemme domæne');
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Kopieret til udklipsholder');
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const subdomainUrl = tenantData?.subdomain ? `https://${tenantData.subdomain}.webprinter.dk` : '#';

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Domæne Indstillinger</h1>
                <p className="text-muted-foreground">Administrer dit shops domæne og tilslut dit eget domæne</p>
            </div>

            {/* Current Subdomain */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Gratis Subdomæne
                    </CardTitle>
                    <CardDescription>Din shop er altid tilgængelig på dette domæne</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                            {tenantData?.subdomain}.webprinter.dk
                        </div>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aktiv
                        </Badge>
                        {/* Only show "Visit" if NOT localhost, or provide warning/localhost handling */}
                        <Button variant="outline" size="sm" asChild>
                            <a href={subdomainUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Besøg
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Connect Custom Domain */}
            <Card>
                <CardHeader>
                    <CardTitle>Tilslut Eget Domæne</CardTitle>
                    <CardDescription>
                        Brug dit eget domæne (f.eks. www.dit-trykkeri.dk)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="domain">Dit domæne</Label>
                        <div className="flex gap-2">
                            <Input
                                id="domain"
                                placeholder="www.dit-trykkeri.dk"
                                value={customDomain}
                                onChange={(e) => setCustomDomain(e.target.value)}
                            />
                            <Button onClick={handleSaveDomain} disabled={saving}>
                                {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Gem Domæne'}
                            </Button>
                        </div>
                        {tenantData?.domain && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span>Domæne gemt: {tenantData.domain}</span>
                            </div>
                        )}
                    </div>

                    {/* DNS Instructions */}
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            <h3 className="font-semibold">DNS Konfiguration (Kræves)</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            For at dit domæne virker, skal du oprette en <strong>CNAME Record</strong> hos din domæneudbyder:
                        </p>

                        <div className="p-4 bg-background rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">CNAME Record</span>
                                <Badge variant="outline">CNAME</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Navn/Host:</span>
                                    <p className="font-mono">www</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Værdi/Destination:</span>
                                    <div className="flex items-center gap-2">
                                        <p className="font-mono">cname.vercel-dns.com</p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => copyToClipboard('cname.vercel-dns.com')}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="col-span-1"></div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                                * Hvis du bruger et root-domæne (uden www), brug en A-record der peger på <b>76.76.21.21</b>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default DomainSettings;
