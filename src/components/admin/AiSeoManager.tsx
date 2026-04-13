import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Bot, Plus, Trash2, Copy, Download, CheckCircle2,
    Sparkles, HelpCircle, Building2, FileText, AlertCircle, Info
} from "lucide-react";
import {
    DEFAULT_STOREFRONT_AI_SEO_CONFIG,
    generateStorefrontLlmsTxt,
    normalizeStorefrontAiSeoConfig,
    type StorefrontAiSeoConfig,
} from "@/lib/storefront/seo";

interface FaqItem {
    id: string;
    question: string;
    answer: string;
}

export type AiSeoConfig = Omit<StorefrontAiSeoConfig, "faq"> & {
    faq: FaqItem[];
};

const DEFAULT_CONFIG: AiSeoConfig = {
    ...DEFAULT_STOREFRONT_AI_SEO_CONFIG,
    faq: [],
};

function newFaqItem(): FaqItem {
    return { id: Math.random().toString(36).slice(2), question: "", answer: "" };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function IdentitetTab({
    config,
    onChange,
}: {
    config: AiSeoConfig;
    onChange: (patch: Partial<AiSeoConfig>) => void;
}) {
    const setService = (idx: number, value: string) => {
        const next = [...config.services];
        next[idx] = value;
        onChange({ services: next });
    };
    const addService = () => onChange({ services: [...config.services, ""] });
    const removeService = (idx: number) =>
        onChange({ services: config.services.filter((_, i) => i !== idx) });

    const setUsp = (idx: number, value: string) => {
        const next = [...config.usps];
        next[idx] = value;
        onChange({ usps: next });
    };
    const addUsp = () => onChange({ usps: [...config.usps, ""] });
    const removeUsp = (idx: number) =>
        onChange({ usps: config.usps.filter((_, i) => i !== idx) });

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-violet-500" />
                        Virksomhedsidentitet
                    </CardTitle>
                    <CardDescription>
                        Fortæl AI-agenter præcis hvad din virksomhed gør — klart og konkret.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Elevator pitch <span className="text-xs text-muted-foreground">(1 sætning)</span></Label>
                        <Input
                            placeholder="f.eks. Danmarks hurtigste trykkeri med levering på 24 timer til erhvervskunder."
                            value={config.elevatorPitch}
                            onChange={(e) => onChange({ elevatorPitch: e.target.value })}
                            maxLength={160}
                        />
                        <p className="text-xs text-muted-foreground text-right">{config.elevatorPitch.length}/160</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Om virksomheden <span className="text-xs text-muted-foreground">(2-4 sætninger)</span></Label>
                        <Textarea
                            placeholder="Beskriv hvad I tilbyder, hvem I hjælper, og hvad der gør jer unikke. Skriv naturligt — som om du forklarer det til en ny kunde."
                            value={config.aboutParagraph}
                            onChange={(e) => onChange({ aboutParagraph: e.target.value })}
                            rows={5}
                        />
                        <p className="text-xs text-muted-foreground text-right">{config.aboutParagraph.length} tegn</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ydelser / Produkter</CardTitle>
                    <CardDescription>
                        Hvad sælger I? Én ydelse per linje — brug de termer kunder søger med.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {config.services.map((s, i) => (
                        <div key={i} className="flex gap-2">
                            <Input
                                value={s}
                                placeholder={`f.eks. Flyers A5, Visitkort, Rollup bannere`}
                                onChange={(e) => setService(i, e.target.value)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeService(i)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addService} className="mt-1">
                        <Plus className="h-4 w-4 mr-1" /> Tilføj ydelse
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Unikke styrker (USP'er)</CardTitle>
                    <CardDescription>
                        Hvad er jeres konkurrencefordele? AI-agenter bruger disse som faktuelle signaler.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {config.usps.map((u, i) => (
                        <div key={i} className="flex gap-2">
                            <Input
                                value={u}
                                placeholder={`f.eks. Levering på 24 timer, Offset-tryk fra 50 stk.`}
                                onChange={(e) => setUsp(i, e.target.value)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeUsp(i)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addUsp} className="mt-1">
                        <Plus className="h-4 w-4 mr-1" /> Tilføj fordel
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function FaqTab({
    config,
    onChange,
}: {
    config: AiSeoConfig;
    onChange: (patch: Partial<AiSeoConfig>) => void;
}) {
    const setFaq = (id: string, field: "question" | "answer", value: string) => {
        onChange({
            faq: config.faq.map((f) => (f.id === id ? { ...f, [field]: value } : f)),
        });
    };
    const addFaq = () => onChange({ faq: [...config.faq, newFaqItem()] });
    const removeFaq = (id: string) =>
        onChange({ faq: config.faq.filter((f) => f.id !== id) });

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium mb-1">Sådan fungerer AI Spørgsmål &amp; Svar</p>
                        <p>Disse Q&amp;A-par bliver indlejret som <strong>FAQPage schema</strong> i din sides kode. Når Claude, ChatGPT eller Perplexity søger svar om din virksomhed, kan de trække direkte fra disse svar. Skriv præcist og informativt.</p>
                    </div>
                </div>
            </div>

            {config.faq.length === 0 && (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ingen spørgsmål endnu. Tilføj de spørgsmål kunder typisk stiller.</p>
                </div>
            )}

            {config.faq.map((item, i) => (
                <Card key={item.id}>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Spørgsmål {i + 1}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => removeFaq(item.id)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Spørgsmål</Label>
                            <Input
                                placeholder="f.eks. Hvad er jeres leveringstid?"
                                value={item.question}
                                onChange={(e) => setFaq(item.id, "question", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Svar</Label>
                            <Textarea
                                placeholder="Skriv et klart, fyldestgørende svar..."
                                value={item.answer}
                                onChange={(e) => setFaq(item.id, "answer", e.target.value)}
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>
            ))}

            <Button variant="outline" onClick={addFaq} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Tilføj spørgsmål
            </Button>

            {config.faq.length > 0 && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Forslag til spørgsmål:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        <li>Hvad er jeres leveringstid?</li>
                        <li>Hvad er minimumsoplag?</li>
                        <li>Kan I lave tilpassede størrelser?</li>
                        <li>Hvad er jeres returpolitik?</li>
                        <li>Tilbyder I designhjælp?</li>
                        <li>Hvad koster [populær ydelse]?</li>
                    </ul>
                </div>
            )}
        </div>
    );
}

function LlmsTxtTab({
    config,
    shopName,
    domain,
    company,
}: {
    config: AiSeoConfig;
    shopName: string;
    domain: string;
    company: Record<string, string | undefined>;
}) {
    const content = generateStorefrontLlmsTxt(config, shopName, domain, company);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "llms.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
                <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium mb-1">Hvad er llms.txt?</p>
                        <p>
                            <code className="font-mono bg-violet-100 px-1 rounded">llms.txt</code> er en ny standard (ligesom <code className="font-mono bg-violet-100 px-1 rounded">robots.txt</code>) der fortæller AI-modeller hvad din hjemmeside handler om.
                            Den placeres på <code className="font-mono bg-violet-100 px-1 rounded">https://dindomain.dk/llms.txt</code>.
                        </p>
                        <p className="mt-2 text-violet-700">
                            AI-agenter som Claude, ChatGPT og Perplexity bruger dette fil til at forstå din virksomhed og give bedre svar om jer til brugerne.
                        </p>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Genereret llms.txt indhold</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                {copied ? (
                                    <><CheckCircle2 className="h-4 w-4 mr-1 text-green-500" /> Kopieret!</>
                                ) : (
                                    <><Copy className="h-4 w-4 mr-1" /> Kopiér</>
                                )}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-1" /> Download
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <a href="/llms.txt" target="_blank" rel="noreferrer">
                                    <FileText className="h-4 w-4 mr-1" /> Åbn live
                                </a>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <pre className="bg-slate-900 text-slate-200 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {content || "# Udfyld felterne under 'Identitet' og 'Spørgsmål & Svar' for at generere indholdet"}
                    </pre>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Sådan deployer du llms.txt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                        <p>Filen serveres automatisk på <code className="font-mono text-xs bg-muted px-1 rounded">https://dindomain.dk/llms.txt</code> når AI SEO er aktivt og shoppen kører på sit tenant-domæne.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                        <p>Brug download-funktionen som kontrolkopi eller hvis du vil arkivere teksten manuelt.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                        <p>FAQ-svarene herover injiceres automatisk i sidens kode som strukturerede data — det kræver ingen manuel handling.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function SignalerTab({
    config,
    onChange,
}: {
    config: AiSeoConfig;
    onChange: (patch: Partial<AiSeoConfig>) => void;
}) {
    const signals = [
        {
            key: "faqSchema" as const,
            label: "FAQ Schema (JSON-LD)",
            description: "Injicerer dine Q&A-par som FAQPage strukturerede data — læsbart af alle AI-søgemaskiner.",
            icon: <HelpCircle className="h-4 w-4" />,
            color: "emerald",
        },
        {
            key: "enhancedOrg" as const,
            label: "Udvidet virksomhedsdata",
            description: "Tilføjer ydelser, USP'er og elevator pitch til PrintingService schema — giver AI-agenter præcis firmaprofil.",
            icon: <Building2 className="h-4 w-4" />,
            color: "blue",
        },
        {
            key: "speakable" as const,
            label: "Speakable markup",
            description: "Markerer sidens vigtigste tekst som 'talevenlig' — prioriteret af Google Assistant og AI-voice-søgning.",
            icon: <Sparkles className="h-4 w-4" />,
            color: "violet",
        },
    ];

    const completionScore = [
        config.elevatorPitch.length > 20,
        config.aboutParagraph.length > 50,
        config.services.filter((s) => s.trim()).length > 0,
        config.faq.filter((f) => f.question && f.answer).length >= 3,
    ].filter(Boolean).length;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        AI Synlighedsscore
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-3 mb-3">
                        <span className="text-4xl font-bold">{completionScore}</span>
                        <span className="text-muted-foreground text-sm mb-1">/ 4 signaler aktive</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 to-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${(completionScore / 4) * 100}%` }}
                        />
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                        {[
                            { done: config.elevatorPitch.length > 20, label: "Elevator pitch udfyldt" },
                            { done: config.aboutParagraph.length > 50, label: "Om-tekst udfyldt" },
                            { done: config.services.filter((s) => s.trim()).length > 0, label: "Mindst 1 ydelse tilføjet" },
                            { done: config.faq.filter((f) => f.question && f.answer).length >= 3, label: "Mindst 3 FAQ-svar" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                                {item.done ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Aktive signaler</CardTitle>
                    <CardDescription>Kontrollér hvilke AI-signaler der injiceres på din webshop.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {signals.map((sig) => (
                        <div key={sig.key} className="flex items-start gap-3">
                            <Switch
                                checked={config.signals[sig.key]}
                                onCheckedChange={(v) =>
                                    onChange({ signals: { ...config.signals, [sig.key]: v } })
                                }
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium">{sig.label}</span>
                                    {config.signals[sig.key] && (
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 text-green-700 border-green-300 bg-green-50">
                                            Aktiv
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{sig.description}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Hvad er AEO?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        <strong className="text-foreground">Answer Engine Optimization (AEO)</strong> er den nye disciplin for at rangere højt i AI-drevne søgemaskiner som Claude, ChatGPT, Perplexity og Google AI Overviews.
                    </p>
                    <p>
                        I stedet for blot at optimere for klik, optimerer AEO for at blive <em>citeret som kilde</em> når en bruger spørger en AI-agent om tryktjenester i dit område.
                    </p>
                    <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-xs">
                        <p className="font-medium text-foreground">Nøgleteknikker der er aktive her:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Schema.org strukturerede data (PrintingService, FAQPage)</li>
                            <li>llms.txt — maskinlæsbar firmaoversigt</li>
                            <li>Konversationelt FAQ-indhold</li>
                            <li>Entity signals (navn, adresse, ydelser)</li>
                            <li>Speakable markup for voice-søgning</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AiSeoManager() {
    const { data: tenant, isLoading } = useShopSettings();
    const queryClient = useQueryClient();
    const [config, setConfig] = useState<AiSeoConfig>(DEFAULT_CONFIG);
    const [saving, setSaving] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("identitet");

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId: tid }) => setTenantId(tid));
    }, []);

    useEffect(() => {
        if (tenant) {
            const s = tenant as any;
            if (s.ai_seo) {
                setConfig(normalizeStorefrontAiSeoConfig(s.ai_seo));
            } else {
                setConfig(DEFAULT_CONFIG);
            }
        }
    }, [tenant]);

    const handleChange = (patch: Partial<AiSeoConfig>) => {
        setConfig((prev) => ({ ...prev, ...patch }));
    };

    const handleSave = async () => {
        if (!tenantId) return;
        setSaving(true);

        try {
            const { data: tenantRow, error: tenantRowError } = await supabase
                .from("tenants" as any)
                .select("settings")
                .eq("id", tenantId)
                .maybeSingle();

            if (tenantRowError) throw tenantRowError;

            const currentSettings = (((tenantRow as any)?.settings) || {}) as Record<string, unknown>;
            const newSettings = {
                ...currentSettings,
                ai_seo: config,
            };

            const { error } = await supabase
                .from("tenants" as any)
                .update({ settings: newSettings })
                .eq("id", tenantId);

            if (error) throw error;

            toast.success("AI SEO gemt");
            await queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
        } catch (error) {
            toast.error("Kunne ikke gemme AI SEO indstillinger");
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    const s = (tenant as any) || {};
    const shopName =
        s.branding?.header?.logoText || s.company?.name || s.name || "Din Shop";
    const domain = s.domain || "";
    const company = s.company || {};

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <a href="/admin" className="hover:text-foreground transition-colors">
                    ← Tilbage til Admin
                </a>
                <span>/</span>
                <a href="/admin/seo" className="hover:text-foreground transition-colors">
                    SEO Manager
                </a>
                <span>/</span>
                <span className="text-foreground font-medium">AI SEO</span>
            </nav>

            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Bot className="h-7 w-7 text-violet-500" />
                        AI SEO Manager
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Optimer din synlighed i Claude, ChatGPT, Perplexity og andre AI-søgemaskiner.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="ai-seo-enabled" className="text-sm">Aktiveret</Label>
                        <Switch
                            id="ai-seo-enabled"
                            checked={config.enabled}
                            onCheckedChange={(v) => handleChange({ enabled: v })}
                        />
                    </div>
                    <Button onClick={handleSave} disabled={saving || !tenantId}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Gem AI SEO
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="identitet" className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Identitet</span>
                    </TabsTrigger>
                    <TabsTrigger value="faq" className="flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Q&A / FAQ</span>
                    </TabsTrigger>
                    <TabsTrigger value="llms" className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">llms.txt</span>
                    </TabsTrigger>
                    <TabsTrigger value="signaler" className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Signaler</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="identitet" className="mt-6">
                    <IdentitetTab config={config} onChange={handleChange} />
                </TabsContent>

                <TabsContent value="faq" className="mt-6">
                    <FaqTab config={config} onChange={handleChange} />
                </TabsContent>

                <TabsContent value="llms" className="mt-6">
                    <LlmsTxtTab
                        config={config}
                        shopName={shopName}
                        domain={domain}
                        company={company}
                    />
                </TabsContent>

                <TabsContent value="signaler" className="mt-6">
                    <SignalerTab config={config} onChange={handleChange} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
