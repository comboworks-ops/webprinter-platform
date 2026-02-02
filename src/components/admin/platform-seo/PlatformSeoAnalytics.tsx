/**
 * Platform SEO Analytics Tab
 * 
 * PageSpeed Insights and Search Console integration.
 * With helpful explanations for each section.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, Gauge, Search, Loader2, AlertCircle, CheckCircle2, Info, ExternalLink } from 'lucide-react';
import { usePlatformPagespeedSnapshots, useSavePagespeedSnapshot } from '@/lib/platform-seo/hooks';
import { PLATFORM_PAGES } from '@/lib/platform-seo/types';
import { FieldTooltip } from './FieldTooltip';
import { SearchConsoleDashboard } from './SearchConsoleDashboard';

// Score color helpers
function getScoreColor(score: number | undefined): string {
    if (score === undefined) return 'text-gray-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-600';
}

function getScoreBgColor(score: number | undefined): string {
    if (score === undefined) return 'bg-gray-100';
    if (score >= 90) return 'bg-green-100';
    if (score >= 50) return 'bg-orange-100';
    return 'bg-red-100';
}

function getScoreLabel(score: number | undefined): string {
    if (score === undefined) return 'Ukendt';
    if (score >= 90) return 'Godt';
    if (score >= 50) return 'Skal forbedres';
    return 'Dårligt';
}

export function PlatformSeoAnalytics() {
    const { toast } = useToast();
    const { data: snapshots, isLoading: snapshotsLoading } = usePlatformPagespeedSnapshots();
    const saveSnapshot = useSavePagespeedSnapshot();

    const [selectedUrl, setSelectedUrl] = useState('/');
    const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');
    const [isRunning, setIsRunning] = useState(false);
    const [latestResult, setLatestResult] = useState<{
        performance?: number;
        accessibility?: number;
        bestPractices?: number;
        seo?: number;
    } | null>(null);

    const runPagespeedTest = async () => {
        setIsRunning(true);
        setLatestResult(null);

        try {
            const fullUrl = `https://webprinter.dk${selectedUrl}`;

            // Note: In production, this should call a server-side function
            // that has the API key. For MVP, we'll simulate the response structure.
            // TODO: Implement Supabase Edge Function or Vercel serverless function

            toast({
                title: 'PageSpeed Test',
                description: 'For fuld funktionalitet skal der konfigureres en PageSpeed API-nøgle på serveren.',
            });

            // Simulated response for MVP UI demonstration
            const mockResult = {
                performance: Math.floor(Math.random() * 30) + 70,
                accessibility: Math.floor(Math.random() * 20) + 80,
                bestPractices: Math.floor(Math.random() * 25) + 75,
                seo: Math.floor(Math.random() * 15) + 85,
            };

            setLatestResult(mockResult);

            // Save to database
            await saveSnapshot.mutateAsync({
                url: fullUrl,
                strategy,
                lighthouse: mockResult,
            });

        } catch (error) {
            console.error('PageSpeed test error:', error);
            toast({ title: 'Fejl', description: 'Kunne ikke køre PageSpeed test.', variant: 'destructive' });
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Help Info Box */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Hvad er Analytics i forhold til SEO?</p>
                    <p>
                        Analytics hjælper dig med at forstå, hvordan din hjemmeside præsterer teknisk (PageSpeed) og
                        hvordan den klarer sig i Google-søgninger (Search Console). Hurtige sider med god tilgængelighed
                        rangerer bedre i Google.
                    </p>
                </div>
            </div>

            {/* PageSpeed Insights */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gauge className="h-5 w-5" />
                        PageSpeed Insights
                        <FieldTooltip
                            content="PageSpeed Insights er Googles værktøj til at måle, hvor hurtigt din hjemmeside loader og hvor brugervenlig den er. Google bruger disse scores til at bestemme din placering i søgeresultater - hurtigere sider rangerer højere."
                        />
                    </CardTitle>
                    <CardDescription>
                        Test dine siders ydeevne med Googles Lighthouse. Scores over 90 er gode, 50-90 kan forbedres,
                        under 50 er problematisk.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <Label className="flex items-center">
                                Side at teste
                                <FieldTooltip
                                    content="Vælg hvilken side du vil teste. Start med forsiden og dine vigtigste sider (priser, kontakt). Test både mobile og desktop versioner."
                                />
                            </Label>
                            <Select value={selectedUrl} onValueChange={setSelectedUrl}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg side" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORM_PAGES.map(({ path, label }) => (
                                        <SelectItem key={path} value={path}>
                                            {label} ({path})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-[150px]">
                            <Label className="flex items-center">
                                Strategi
                                <FieldTooltip
                                    content="'Mobile' tester hvordan siden fungerer på telefoner (vigtigst for Google!). 'Desktop' tester computer-versionen. Google prioriterer mobile scores."
                                />
                            </Label>
                            <Select value={strategy} onValueChange={(v) => setStrategy(v as 'mobile' | 'desktop')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mobile">Mobile 📱</SelectItem>
                                    <SelectItem value="desktop">Desktop 💻</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={runPagespeedTest} disabled={isRunning}>
                            {isRunning ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Gauge className="mr-2 h-4 w-4" />
                            )}
                            Kør test
                        </Button>
                    </div>

                    {/* Latest Result */}
                    {latestResult && (
                        <div className="space-y-4 pt-4">
                            <h4 className="font-medium">Resultater</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    {
                                        label: 'Performance',
                                        score: latestResult.performance,
                                        tip: 'Måler hvor hurtigt din side indlæses og bliver interaktiv. Påvirkes af billeder, scripts og serverrespons.'
                                    },
                                    {
                                        label: 'Accessibility',
                                        score: latestResult.accessibility,
                                        tip: 'Måler om siden kan bruges af alle, inkl. blinde/svagtseende med skærmlæsere. God tilgængelighed hjælper også SEO.'
                                    },
                                    {
                                        label: 'Best Practices',
                                        score: latestResult.bestPractices,
                                        tip: 'Tjekker sikkerhed (HTTPS), moderne kode og fejl. Følger du de nyeste web-standarder?'
                                    },
                                    {
                                        label: 'SEO',
                                        score: latestResult.seo,
                                        tip: 'Teknisk SEO-check: har du meta-tags, er tekst læsbar, virker links? Dette er separate fra indhold og backlinks.'
                                    },
                                ].map(({ label, score, tip }) => (
                                    <div
                                        key={label}
                                        className={`p-4 rounded-lg text-center ${getScoreBgColor(score)}`}
                                    >
                                        <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                                            {score ?? '-'}
                                        </div>
                                        <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                                            {label}
                                            <FieldTooltip content={tip} />
                                        </div>
                                        <div className={`text-xs mt-1 ${getScoreColor(score)}`}>
                                            {getScoreLabel(score)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-amber-800">
                                    💡 <strong>Tip:</strong> Fokuser på Performance for mobile først - det er hvad Google
                                    prioriterer. Komprimer billeder og minimer JavaScript for bedre scores.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Historical Snapshots */}
                    {!snapshotsLoading && snapshots && snapshots.length > 0 && (
                        <div className="pt-4 border-t">
                            <h4 className="font-medium mb-3">Seneste tests</h4>
                            <div className="space-y-2">
                                {snapshots.slice(0, 5).map((snapshot) => (
                                    <div
                                        key={snapshot.id}
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono">{new URL(snapshot.url).pathname}</span>
                                            <span className="text-muted-foreground">({snapshot.strategy})</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={getScoreColor(snapshot.lighthouse.performance)}>
                                                P: {snapshot.lighthouse.performance ?? '-'}
                                            </span>
                                            <span className={getScoreColor(snapshot.lighthouse.seo)}>
                                                SEO: {snapshot.lighthouse.seo ?? '-'}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {new Date(snapshot.created_at).toLocaleDateString('da-DK')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Search Console */}
            <SearchConsoleDashboard />
        </div>
    );
}

export default PlatformSeoAnalytics;
