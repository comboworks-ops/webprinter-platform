/**
 * Search Console Dashboard Component
 * 
 * Displays Search Console metrics and data visualization.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Search,
    Loader2,
    TrendingUp,
    MousePointer,
    Eye,
    BarChart3,
    ExternalLink,
    Unlink,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Info
} from 'lucide-react';
import {
    useSearchConsoleStatus,
    useSearchConsoleAuthUrl,
    useSearchConsoleConnect,
    useSearchConsoleDisconnect,
    useSearchConsoleSites,
    useSearchConsoleMetrics,
} from '@/lib/platform-seo/search-console-hooks';
import { FieldTooltip } from './FieldTooltip';

export function SearchConsoleDashboard() {
    const { data: status, isLoading: statusLoading } = useSearchConsoleStatus();
    const { data: sites } = useSearchConsoleSites();
    const getAuthUrl = useSearchConsoleAuthUrl();
    const disconnect = useSearchConsoleDisconnect();

    const [selectedSite, setSelectedSite] = useState<string>('https://webprinter.dk/');
    const { data: metrics, isLoading: metricsLoading, error: metricsError } = useSearchConsoleMetrics(selectedSite);

    const handleConnect = async () => {
        try {
            const { authUrl } = await getAuthUrl.mutateAsync();
            window.location.href = authUrl;
        } catch (error) {
            console.error('Failed to get auth URL:', error);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Er du sikker på, at du vil afbryde forbindelsen til Google Search Console?')) return;
        await disconnect.mutateAsync();
    };

    if (statusLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Not connected state
    if (!status?.connected) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Google Search Console
                    </CardTitle>
                    <CardDescription>
                        Forbind til Google Search Console for at se søgeperformance.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 p-6 bg-muted/50 rounded-lg">
                        <Search className="h-12 w-12 text-blue-500" />
                        <div className="flex-1">
                            <h4 className="font-medium mb-1">Forbind din Search Console konto</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                Klik på knappen nedenfor for at godkende adgang til Google Search Console.
                                Du vil blive omdirigeret til Google for at logge ind.
                            </p>
                            <Button onClick={handleConnect} disabled={getAuthUrl.isPending}>
                                {getAuthUrl.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="mr-2 h-4 w-4" />
                                )}
                                Forbind til Search Console
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-amber-800">
                            <p className="font-medium">Før du forbinder:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>Sørg for, at webprinter.dk er verificeret i din Search Console</li>
                                <li>Du skal logge ind med den Google-konto, der ejer Search Console</li>
                                <li>Vi anmoder kun om læseadgang - vi ændrer ikke noget</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Connected state
    return (
        <div className="space-y-6">
            {/* Connection Status */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <CardTitle className="text-lg">Forbundet til Search Console</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            {sites?.siteEntry && sites.siteEntry.length > 0 && (
                                <Select value={selectedSite} onValueChange={setSelectedSite}>
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Vælg site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites.siteEntry.map((site) => (
                                            <SelectItem key={site.siteUrl} value={site.siteUrl}>
                                                {site.siteUrl}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button variant="outline" size="sm" onClick={handleDisconnect}>
                                <Unlink className="mr-2 h-4 w-4" />
                                Afbryd
                            </Button>
                        </div>
                    </div>
                    <CardDescription>
                        Data fra de seneste 28 dage. Forbundet: {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString('da-DK') : 'Ukendt'}
                    </CardDescription>
                </CardHeader>
            </Card>

            {metricsLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : metricsError ? (
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-red-800">
                            <AlertCircle className="h-5 w-5" />
                            <span>Fejl ved hentning af data: {(metricsError as Error).message}</span>
                        </div>
                    </CardContent>
                </Card>
            ) : metrics ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Klik
                                            <FieldTooltip content="Antal gange nogen klikkede på dit søgeresultat i Google." />
                                        </p>
                                        <p className="text-2xl font-bold">{metrics.totalClicks.toLocaleString('da-DK')}</p>
                                    </div>
                                    <MousePointer className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Visninger
                                            <FieldTooltip content="Antal gange dit site blev vist i søgeresultater (også selvom ingen klikkede)." />
                                        </p>
                                        <p className="text-2xl font-bold">{metrics.totalImpressions.toLocaleString('da-DK')}</p>
                                    </div>
                                    <Eye className="h-8 w-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            CTR
                                            <FieldTooltip content="Click-Through Rate: Procentdel af visninger der resulterede i klik. Høj CTR = folk finder din titel/beskrivelse attraktiv." />
                                        </p>
                                        <p className="text-2xl font-bold">{(metrics.averageCtr * 100).toFixed(1)}%</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Position
                                            <FieldTooltip content="Din gennemsnitlige placering i Google. Position 1 = øverst. Position 10 = bund af side 1." />
                                        </p>
                                        <p className="text-2xl font-bold">{metrics.averagePosition.toFixed(1)}</p>
                                    </div>
                                    <BarChart3 className="h-8 w-8 text-orange-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Queries */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Top søgeord
                                <FieldTooltip content="De ord og sætninger folk søger på, når dit site vises i Google. Brug disse til at optimere dit indhold!" />
                            </CardTitle>
                            <CardDescription>
                                Hvilke søgninger bringer folk til dit site?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Søgeord</TableHead>
                                        <TableHead className="text-right">Klik</TableHead>
                                        <TableHead className="text-right">Visninger</TableHead>
                                        <TableHead className="text-right">CTR</TableHead>
                                        <TableHead className="text-right">Position</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.topQueries.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{row.keys[0]}</TableCell>
                                            <TableCell className="text-right">{row.clicks}</TableCell>
                                            <TableCell className="text-right">{row.impressions}</TableCell>
                                            <TableCell className="text-right">{(row.ctr * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{row.position.toFixed(1)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Top Pages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Top sider
                                <FieldTooltip content="Hvilke af dine sider får mest trafik fra Google-søgning." />
                            </CardTitle>
                            <CardDescription>
                                Dine bedst performende sider i søgeresultater.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Side</TableHead>
                                        <TableHead className="text-right">Klik</TableHead>
                                        <TableHead className="text-right">Visninger</TableHead>
                                        <TableHead className="text-right">CTR</TableHead>
                                        <TableHead className="text-right">Position</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.topPages.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium max-w-[300px] truncate">
                                                <a
                                                    href={row.keys[0]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 hover:underline"
                                                >
                                                    {new URL(row.keys[0]).pathname || '/'}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </TableCell>
                                            <TableCell className="text-right">{row.clicks}</TableCell>
                                            <TableCell className="text-right">{row.impressions}</TableCell>
                                            <TableCell className="text-right">{(row.ctr * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{row.position.toFixed(1)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}

export default SearchConsoleDashboard;
