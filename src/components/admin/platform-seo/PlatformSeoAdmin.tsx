/**
 * Platform SEO Admin Page
 * 
 * Master-admin only module for managing Platform SEO.
 * Only affects webprinter.dk / www.webprinter.dk pages.
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, FileText, Languages, BarChart3, Info, HelpCircle } from 'lucide-react';
import { PlatformSeoDefaults } from './PlatformSeoDefaults';
import { PlatformSeoPages } from './PlatformSeoPages';
import { PlatformSeoInternational } from './PlatformSeoInternational';
import { PlatformSeoAnalytics } from './PlatformSeoAnalytics';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function PlatformSeoAdmin() {
    const [activeTab, setActiveTab] = useState('defaults');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        Platform SEO Center
                        <Tooltip>
                            <TooltipTrigger>
                                <HelpCircle className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[350px] p-3">
                                <p className="font-medium mb-2">Hvad er SEO?</p>
                                <p className="text-sm">
                                    SEO (Search Engine Optimization) handler om at gøre din hjemmeside synlig i Google
                                    og andre søgemaskiner. God SEO betyder flere besøgende uden at betale for annoncer.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Administrer SEO for webprinter.dk platformen
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                    <Globe className="h-4 w-4" />
                    <span>webprinter.dk</span>
                </div>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Hvad er dette modul?</p>
                            <p>
                                Dette SEO-center styrer, hvordan platform-siderne (webprinter.dk) vises i Google-søgeresultater.
                                Du kan sætte titler, beskrivelser, billeder til sociale medier og meget mere.
                            </p>
                            <p className="mt-2">
                                <strong>Bemærk:</strong> Tenant-shops og demo-shoppen har deres egne separate SEO-indstillinger.
                                Ændringer her påvirker kun platform-marketingsiderne.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Guide */}
            <Card>
                <CardContent className="py-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <Globe className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-medium">Standarder</p>
                                <p className="text-muted-foreground text-xs">Grundlæggende SEO-indstillinger der gælder for hele platformen</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                                <p className="font-medium">Sider</p>
                                <p className="text-muted-foreground text-xs">Tilpas SEO for hver enkelt side individuelt</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                <Languages className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-medium">International</p>
                                <p className="text-muted-foreground text-xs">Flersprogede indstillinger og hreflang-tags</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                <BarChart3 className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                                <p className="font-medium">Analytics</p>
                                <p className="text-muted-foreground text-xs">PageSpeed test og Google Search Console</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="defaults" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Standarder</span>
                    </TabsTrigger>
                    <TabsTrigger value="pages" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Sider</span>
                    </TabsTrigger>
                    <TabsTrigger value="international" className="flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        <span className="hidden sm:inline">International</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Analytics</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="defaults">
                    <PlatformSeoDefaults />
                </TabsContent>

                <TabsContent value="pages">
                    <PlatformSeoPages />
                </TabsContent>

                <TabsContent value="international">
                    <PlatformSeoInternational />
                </TabsContent>

                <TabsContent value="analytics">
                    <PlatformSeoAnalytics />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default PlatformSeoAdmin;
