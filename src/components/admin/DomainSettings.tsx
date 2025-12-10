import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function DomainSettings() {
    const [customDomain, setCustomDomain] = useState('');
    const [verifying, setVerifying] = useState(false);

    // Mock data - would come from database
    const currentSubdomain = 'min-butik';
    const connectedDomain = null; // or 'www.min-trykkeri.dk' if connected

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Kopieret til udklipsholder');
    };

    const handleVerifyDomain = async () => {
        if (!customDomain.trim()) {
            toast.error('Indtast et domæne');
            return;
        }

        setVerifying(true);
        // Simulate verification
        setTimeout(() => {
            setVerifying(false);
            toast.info('DNS records verificeres... Dette kan tage op til 48 timer.');
        }, 2000);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Domæne Indstillinger</h1>
                <p className="text-muted-foreground">Administrer dit shops domæne og tilslut dit eget domæne</p>
            </div>

            {/* Current Domain */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Nuværende Domæne
                    </CardTitle>
                    <CardDescription>Din shop er tilgængelig på dette domæne</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                            {currentSubdomain}.webprinter.dk
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aktiv
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`https://${currentSubdomain}.webprinter.dk`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Besøg
                            </a>
                        </Button>
                    </div>

                    {connectedDomain && (
                        <div className="flex items-center gap-4 pt-4 border-t">
                            <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                                {connectedDomain}
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Tilsluttet
                            </Badge>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Connect Custom Domain */}
            <Card>
                <CardHeader>
                    <CardTitle>Tilslut Eget Domæne</CardTitle>
                    <CardDescription>
                        Brug dit eget domæne i stedet for et webprinter.dk subdomæne
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
                            <Button onClick={handleVerifyDomain} disabled={verifying}>
                                {verifying ? 'Verificerer...' : 'Verificer'}
                            </Button>
                        </div>
                    </div>

                    {/* DNS Instructions */}
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            <h3 className="font-semibold">DNS Instruktioner</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Tilføj disse DNS records hos din domæneudbyder (fx Simply, DanDomain, One.com):
                        </p>

                        <div className="space-y-4">
                            {/* CNAME Record */}
                            <div className="p-4 bg-background rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">For www subdomain</span>
                                    <Badge variant="outline">CNAME</Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Type:</span>
                                        <p className="font-mono">CNAME</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Navn/Host:</span>
                                        <p className="font-mono">www</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Værdi/Peger på:</span>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono">cname.webprinter.dk</p>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => copyToClipboard('cname.webprinter.dk')}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* A Record */}
                            <div className="p-4 bg-background rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">For root domæne (@)</span>
                                    <Badge variant="outline">A</Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Type:</span>
                                        <p className="font-mono">A</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Navn/Host:</span>
                                        <p className="font-mono">@</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Værdi/IP:</span>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono">76.76.21.21</p>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => copyToClipboard('76.76.21.21')}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Det kan tage op til 48 timer før DNS ændringerne træder i kraft.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default DomainSettings;
