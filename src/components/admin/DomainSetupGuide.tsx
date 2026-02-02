/**
 * Domain Setup Guide Component
 * 
 * Provides step-by-step DNS configuration instructions for popular Danish hosting providers.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type DnsProvider = 'one.com' | 'simply.dk' | 'dandomain' | 'cloudflare' | 'other';

interface DomainSetupGuideProps {
    provider: DnsProvider;
    domain: string;
}

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

const Step = ({ number, title, children }: StepProps) => (
    <div className="flex gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            {number}
        </div>
        <div className="flex-1 pb-6">
            <h4 className="font-semibold mb-2">{title}</h4>
            <div className="text-sm text-muted-foreground space-y-2">
                {children}
            </div>
        </div>
    </div>
);

const CopyValue = ({ label, value }: { label: string; value: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('Kopieret til udklipsholder');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-xs">
            <span className="text-muted-foreground">{label}:</span>
            <span className="flex-1 font-semibold">{value}</span>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
            >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
        </div>
    );
};

const DnsRecordsInfo = ({ domain }: { domain: string }) => {
    const isWww = domain.startsWith('www.');
    const rootDomain = isWww ? domain.replace('www.', '') : domain;

    return (
        <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    DNS Records der skal oprettes
                    <Badge variant="outline" className="text-xs">Påkrævet</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* CNAME Record */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge>CNAME</Badge>
                        <span className="text-sm text-muted-foreground">For www.{rootDomain}</span>
                    </div>
                    <div className="grid gap-2">
                        <CopyValue label="Navn/Host" value="www" />
                        <CopyValue label="Værdi" value="cname.vercel-dns.com" />
                    </div>
                </div>

                {/* A Record (optional for root) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">A Record</Badge>
                        <span className="text-sm text-muted-foreground">For {rootDomain} (uden www)</span>
                    </div>
                    <div className="grid gap-2">
                        <CopyValue label="Navn/Host" value="@" />
                        <CopyValue label="Værdi" value="76.76.21.21" />
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    💡 TTL kan sættes til automatisk eller 3600 (1 time)
                </p>
            </CardContent>
        </Card>
    );
};

// Provider-specific guides
const OneComGuide = ({ domain }: { domain: string }) => (
    <div className="space-y-4">
        <div className="border-l-2 border-primary pl-4 space-y-0">
            <Step number={1} title="Log ind på One.com">
                <p>Gå til <a href="https://www.one.com/admin" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">one.com/admin <ExternalLink className="h-3 w-3" /></a> og log ind med dine oplysninger.</p>
            </Step>

            <Step number={2} title="Vælg dit domæne">
                <p>Klik på domænet <strong>{domain}</strong> i listen over dine domæner.</p>
            </Step>

            <Step number={3} title="Åbn DNS-indstillinger">
                <p>Find og klik på <strong>"DNS-indstillinger"</strong> eller <strong>"Avanceret DNS"</strong> i menuen.</p>
            </Step>

            <Step number={4} title="Tilføj DNS records">
                <p>Klik på <strong>"Tilføj record"</strong> og opret følgende records:</p>
            </Step>
        </div>

        <DnsRecordsInfo domain={domain} />

        <Step number={5} title="Gem og vent">
            <p>Klik <strong>"Gem"</strong>. DNS-ændringer kan tage op til 24 timer at træde i kraft, men normalt virker det inden for 5-30 minutter.</p>
        </Step>
    </div>
);

const SimplyGuide = ({ domain }: { domain: string }) => (
    <div className="space-y-4">
        <div className="border-l-2 border-primary pl-4 space-y-0">
            <Step number={1} title="Log ind på Simply.dk">
                <p>Gå til <a href="https://www.simply.com/dk/controlpanel/" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">Simply.com Kontrolpanel <ExternalLink className="h-3 w-3" /></a> og log ind.</p>
            </Step>

            <Step number={2} title="Gå til Mine domæner">
                <p>Klik på <strong>"Mine domæner"</strong> i menuen til venstre.</p>
            </Step>

            <Step number={3} title="Vælg domænet">
                <p>Find <strong>{domain}</strong> og klik på <strong>"Administrer"</strong> eller <strong>"DNS"</strong>.</p>
            </Step>

            <Step number={4} title="Tilføj DNS records">
                <p>Under DNS-indstillinger, klik <strong>"Tilføj record"</strong>:</p>
            </Step>
        </div>

        <DnsRecordsInfo domain={domain} />

        <Step number={5} title="Gem ændringer">
            <p>Klik <strong>"Gem"</strong>. Vent 5-30 minutter og kom tilbage for at verificere.</p>
        </Step>
    </div>
);

const DandomainGuide = ({ domain }: { domain: string }) => (
    <div className="space-y-4">
        <div className="border-l-2 border-primary pl-4 space-y-0">
            <Step number={1} title="Log ind på DanDomain">
                <p>Gå til <a href="https://www.dandomain.dk/controlpanel" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">DanDomain Kontrolpanel <ExternalLink className="h-3 w-3" /></a> og log ind med dit brugernavn og kodeord.</p>
            </Step>

            <Step number={2} title="Find dit domæne">
                <p>Naviger til <strong>"Domæner"</strong> → <strong>"Mine domæner"</strong> og find <strong>{domain}</strong>.</p>
            </Step>

            <Step number={3} title="Åbn DNS-administration">
                <p>Klik på domænet og vælg <strong>"DNS"</strong> eller <strong>"Avanceret DNS"</strong>.</p>
            </Step>

            <Step number={4} title="Opret DNS records">
                <p>Tilføj følgende records:</p>
            </Step>
        </div>

        <DnsRecordsInfo domain={domain} />

        <Step number={5} title="Gem og verificer">
            <p>Gem ændringerne og vent 5-30 minutter. Kom derefter tilbage og klik "Verificér" for at tjekke forbindelsen.</p>
        </Step>
    </div>
);

const CloudflareGuide = ({ domain }: { domain: string }) => (
    <div className="space-y-4">
        <div className="border-l-2 border-primary pl-4 space-y-0">
            <Step number={1} title="Log ind på Cloudflare">
                <p>Gå til <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">Cloudflare Dashboard <ExternalLink className="h-3 w-3" /></a> og log ind.</p>
            </Step>

            <Step number={2} title="Vælg dit domæne">
                <p>Klik på <strong>{domain}</strong> fra listen over dine sites.</p>
            </Step>

            <Step number={3} title="Gå til DNS">
                <p>Klik på <strong>"DNS"</strong> i venstre sidebar (eller top-menu).</p>
            </Step>

            <Step number={4} title="Tilføj records">
                <p>Klik <strong>"Add record"</strong> og opret følgende:</p>
            </Step>
        </div>

        <DnsRecordsInfo domain={domain} />

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
                ⚠️ <strong>Vigtigt:</strong> Sæt "Proxy status" til <strong>"DNS only"</strong> (grå sky) - ikke "Proxied" (orange sky).
            </p>
        </div>

        <Step number={5} title="Gem">
            <p>Cloudflare DNS opdateres normalt inden for få minutter.</p>
        </Step>
    </div>
);

const OtherProviderGuide = ({ domain }: { domain: string }) => (
    <div className="space-y-4">
        <div className="border-l-2 border-primary pl-4 space-y-0">
            <Step number={1} title="Log ind hos din domæneudbyder">
                <p>Åbn kontrolpanelet hos den udbyder, hvor dit domæne er registreret.</p>
            </Step>

            <Step number={2} title="Find DNS-indstillinger">
                <p>Kig efter <strong>"DNS"</strong>, <strong>"DNS-zoner"</strong>, <strong>"Navneservere"</strong> eller lignende.</p>
            </Step>

            <Step number={3} title="Tilføj DNS records">
                <p>Opret følgende DNS records for <strong>{domain}</strong>:</p>
            </Step>
        </div>

        <DnsRecordsInfo domain={domain} />

        <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> Hvis du er i tvivl, kontakt din domæneudbyders support og bed dem om hjælp til at oprette en CNAME record.
            </p>
        </div>

        <Step number={4} title="Vent og verificer">
            <p>DNS-ændringer kan tage op til 24 timer. Normalt virker det inden for 5-30 minutter.</p>
        </Step>
    </div>
);

export function DomainSetupGuide({ provider, domain }: DomainSetupGuideProps) {
    const [isOpen, setIsOpen] = useState(true);

    const providerNames: Record<DnsProvider, string> = {
        'one.com': 'One.com',
        'simply.dk': 'Simply.dk',
        'dandomain': 'DanDomain',
        'cloudflare': 'Cloudflare',
        'other': 'Anden udbyder'
    };

    const getGuideComponent = () => {
        switch (provider) {
            case 'one.com':
                return <OneComGuide domain={domain} />;
            case 'simply.dk':
                return <SimplyGuide domain={domain} />;
            case 'dandomain':
                return <DandomainGuide domain={domain} />;
            case 'cloudflare':
                return <CloudflareGuide domain={domain} />;
            default:
                return <OtherProviderGuide domain={domain} />;
        }
    };

    return (
        <Card>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">
                                    Opsætningsguide: {providerNames[provider]}
                                </CardTitle>
                                <CardDescription>
                                    Sådan forbinder du {domain} til din shop
                                </CardDescription>
                            </div>
                            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent>
                        {getGuideComponent()}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

export default DomainSetupGuide;
