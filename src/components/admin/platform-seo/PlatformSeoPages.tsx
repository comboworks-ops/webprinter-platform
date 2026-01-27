/**
 * Platform SEO Pages Tab
 * 
 * Manage per-page SEO overrides for platform pages.
 * With helpful tooltips explaining each field.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Edit, Trash2, Loader2, Save, Eye, Info } from 'lucide-react';
import { usePlatformSeoPages, useUpsertPlatformSeoPage, useDeletePlatformSeoPage } from '@/lib/platform-seo/hooks';
import { PLATFORM_PAGES, type PlatformSeoPage } from '@/lib/platform-seo/types';
import { FieldTooltip } from './FieldTooltip';

export function PlatformSeoPages() {
    const { toast } = useToast();
    const { data: pages, isLoading } = usePlatformSeoPages();
    const upsertPage = useUpsertPlatformSeoPage();
    const deletePage = useDeletePlatformSeoPage();

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [selectedPage, setSelectedPage] = useState<PlatformSeoPage | null>(null);
    const [selectedPath, setSelectedPath] = useState<string>('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        robots: '',
        canonical_url: '',
        og_title: '',
        og_description: '',
        og_image_url: '',
        jsonld: '',
    });

    const handleEdit = (path: string) => {
        const existing = pages?.find(p => p.path === path && !p.locale);
        setSelectedPath(path);
        setSelectedPage(existing || null);
        setFormData({
            title: existing?.title || '',
            description: existing?.description || '',
            robots: existing?.robots || '',
            canonical_url: existing?.canonical_url || '',
            og_title: existing?.og_title || '',
            og_description: existing?.og_description || '',
            og_image_url: existing?.og_image_url || '',
            jsonld: existing?.jsonld ? JSON.stringify(existing.jsonld, null, 2) : '',
        });
        setEditDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            let jsonld = null;
            if (formData.jsonld.trim()) {
                try {
                    jsonld = JSON.parse(formData.jsonld);
                } catch {
                    toast({ title: 'Fejl', description: 'Ugyldig JSON i JSON-LD felt', variant: 'destructive' });
                    return;
                }
            }

            await upsertPage.mutateAsync({
                path: selectedPath,
                title: formData.title || null,
                description: formData.description || null,
                robots: formData.robots || null,
                canonical_url: formData.canonical_url || null,
                og_title: formData.og_title || null,
                og_description: formData.og_description || null,
                og_image_url: formData.og_image_url || null,
                jsonld,
            });

            toast({ title: 'Gemt', description: `SEO for ${selectedPath} er opdateret.` });
            setEditDialogOpen(false);
        } catch (error) {
            console.error('Error saving page:', error);
            toast({ title: 'Fejl', description: 'Kunne ikke gemme side.', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string, path: string) => {
        if (!confirm(`Er du sikker på, at du vil slette SEO-indstillinger for ${path}?`)) return;

        try {
            await deletePage.mutateAsync(id);
            toast({ title: 'Slettet', description: `SEO for ${path} er slettet.` });
        } catch (error) {
            console.error('Error deleting page:', error);
            toast({ title: 'Fejl', description: 'Kunne ikke slette side.', variant: 'destructive' });
        }
    };

    const handlePreview = (path: string) => {
        setSelectedPath(path);
        const existing = pages?.find(p => p.path === path && !p.locale);
        setSelectedPage(existing || null);
        setPreviewDialogOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Help Info Box */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Hvordan virker side-specifikke SEO-indstillinger?</p>
                    <p>
                        Her kan du tilpasse SEO for hver enkelt side. <strong>Tomme felter</strong> bruger automatisk
                        de standardværdier, du har sat under "Standarder"-fanen. Du behøver altså kun at udfylde felter,
                        hvor du ønsker noget anderledes end standarden.
                    </p>
                    <p className="mt-2">
                        💡 <strong>Tip:</strong> Start med de vigtigste sider (Forside, Priser, Kontakt) og arbejd dig ned.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Platformsider
                    </CardTitle>
                    <CardDescription>
                        Klik på blyanten for at redigere SEO for en specifik side. Grønne badges betyder, at siden har
                        tilpassede indstillinger.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sti</TableHead>
                                <TableHead>Navn</TableHead>
                                <TableHead>Titel</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Handlinger</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {PLATFORM_PAGES.map(({ path, label }) => {
                                const pageConfig = pages?.find(p => p.path === path && !p.locale);
                                const hasConfig = !!pageConfig;

                                return (
                                    <TableRow key={path}>
                                        <TableCell className="font-mono text-sm">{path}</TableCell>
                                        <TableCell>{label}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {pageConfig?.title || <span className="text-muted-foreground italic">Standard</span>}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${hasConfig ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {hasConfig ? 'Konfigureret' : 'Standard'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handlePreview(path)} title="Forhåndsvis meta-tags">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(path)} title="Rediger SEO">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                {hasConfig && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(pageConfig.id, path)}
                                                        title="Slet tilpasning (brug standard)"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Rediger SEO for {selectedPath}</DialogTitle>
                        <DialogDescription>
                            Angiv værdier for at overskrive standardindstillingerne. Lad felter stå tomme for at bruge standarden.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Basic SEO Fields */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="title" className="flex items-center">
                                    Titel
                                    <FieldTooltip
                                        content="Sidens titel som vises i browserens faneblad og i Google-søgeresultater. Skriv en kort, beskrivende titel der lokker folk til at klikke."
                                        example="Prisberegning for Trykkerier - Automatisk & Præcis"
                                    />
                                </Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Sidetitel (tom = brug standard)"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="robots" className="flex items-center">
                                    Robots
                                    <FieldTooltip
                                        content="Fortæller søgemaskiner hvad de må gøre med siden. De fleste sider bør have 'index,follow'. Brug 'noindex' for sider du ikke vil have i Google."
                                        example="index,follow (normal) eller noindex,nofollow (skjul)"
                                    />
                                </Label>
                                <Input
                                    id="robots"
                                    value={formData.robots}
                                    onChange={(e) => setFormData(prev => ({ ...prev, robots: e.target.value }))}
                                    placeholder="index,follow (tom = brug standard)"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description" className="flex items-center">
                                Beskrivelse
                                <FieldTooltip
                                    content="Meta-beskrivelsen vises under titlen i Google. Skriv 1-2 sætninger der forklarer hvad siden handler om og hvorfor man skal klikke. Inkluder vigtige søgeord naturligt."
                                    example="Automatisk prisberegning for trykkerier. Beregn tryksager på sekunder med vores smarte system. Prøv gratis demo."
                                />
                            </Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Meta-beskrivelse (tom = brug standard)"
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                💡 Tip: 150-160 tegn er optimalt. Nuværende: {formData.description.length} tegn
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="canonical_url" className="flex items-center">
                                Kanonisk URL (avanceret)
                                <FieldTooltip
                                    content="Normalt behøver du ikke udfylde dette. Bruges kun hvis denne side er en kopi af en anden side, og du vil fortælle Google hvilken der er originalen."
                                    example="https://webprinter.dk/priser (hvis denne side duplikerer prissiden)"
                                />
                            </Label>
                            <Input
                                id="canonical_url"
                                value={formData.canonical_url}
                                onChange={(e) => setFormData(prev => ({ ...prev, canonical_url: e.target.value }))}
                                placeholder="Lad stå tom medmindre siden er en duplikat"
                            />
                        </div>

                        {/* Open Graph Section */}
                        <div className="border-t pt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <h4 className="font-medium">Open Graph (Sociale medier)</h4>
                                <FieldTooltip
                                    content="Open Graph styrer hvordan siden ser ud når den deles på Facebook, LinkedIn, Twitter osv. Hvis du ikke udfylder disse, bruges titel og beskrivelse fra ovenfor."
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="og_title" className="flex items-center">
                                        OG Titel
                                        <FieldTooltip
                                            content="Titlen der vises når nogen deler siden på sociale medier. Kan være mere fængende end SEO-titlen. Lad tom for at bruge SEO-titlen."
                                            example="🖨️ Automatisk Prisberegning for Trykkerier"
                                        />
                                    </Label>
                                    <Input
                                        id="og_title"
                                        value={formData.og_title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, og_title: e.target.value }))}
                                        placeholder="Titel til sociale medier (tom = brug SEO-titel)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="og_image_url" className="flex items-center">
                                        OG Billede URL
                                        <FieldTooltip
                                            content="Billedet der vises ved deling på sociale medier. Brug et flot, relevant billede i 1200x630 pixels. Lad tom for at bruge standardbilledet."
                                            example="https://webprinter.dk/images/priser-social.jpg"
                                        />
                                    </Label>
                                    <Input
                                        id="og_image_url"
                                        value={formData.og_image_url}
                                        onChange={(e) => setFormData(prev => ({ ...prev, og_image_url: e.target.value }))}
                                        placeholder="Billede-URL (tom = brug standard)"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 mt-4">
                                <Label htmlFor="og_description" className="flex items-center">
                                    OG Beskrivelse
                                    <FieldTooltip
                                        content="Beskrivelsen der vises ved deling på sociale medier. Kan være mere uformel end SEO-beskrivelsen. Lad tom for at bruge SEO-beskrivelsen."
                                        example="Se hvordan du kan spare timer hver dag med automatisk prisberegning. Ingen installation - kør direkte i browseren!"
                                    />
                                </Label>
                                <Textarea
                                    id="og_description"
                                    value={formData.og_description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, og_description: e.target.value }))}
                                    placeholder="Beskrivelse til sociale medier (tom = brug SEO-beskrivelse)"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* JSON-LD Section */}
                        <div className="border-t pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="jsonld" className="flex items-center">
                                    Side-specifik JSON-LD (avanceret)
                                    <FieldTooltip
                                        content="Strukturerede data specifikke for denne side. Bruges til avancerede features som FAQ-sektioner i Google, produktoplysninger, events osv. Kræver JSON-format. Lad stå tom hvis du er usikker."
                                    />
                                </Label>
                                <Textarea
                                    id="jsonld"
                                    value={formData.jsonld}
                                    onChange={(e) => setFormData(prev => ({ ...prev, jsonld: e.target.value }))}
                                    placeholder="Kun til avancerede brugere - lad stå tom hvis usikker"
                                    rows={5}
                                    className="font-mono text-sm"
                                />
                                <details className="text-xs text-muted-foreground">
                                    <summary className="cursor-pointer hover:text-foreground">💡 Eksempel: FAQ-strukturerede data</summary>
                                    <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-x-auto">
                                        {`{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Hvad koster Webprinter?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Se vores priser på /priser siden."
    }
  }]
}`}
                                    </pre>
                                </details>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Annuller
                        </Button>
                        <Button onClick={handleSave} disabled={upsertPage.isPending}>
                            {upsertPage.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Gem
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Forhåndsvisning for {selectedPath}</DialogTitle>
                        <DialogDescription>
                            Sådan vil meta-tags se ud for denne side i HTML-koden.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4 font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        <div>&lt;title&gt;{selectedPage?.title || 'Standard titel'} | Webprinter Platform&lt;/title&gt;</div>
                        <div>&lt;meta name="description" content="{selectedPage?.description || 'Standard beskrivelse...'}"/&gt;</div>
                        <div>&lt;meta name="robots" content="{selectedPage?.robots || 'index,follow'}"/&gt;</div>
                        <div>&lt;link rel="canonical" href="{selectedPage?.canonical_url || `https://webprinter.dk${selectedPath}`}"/&gt;</div>
                        {selectedPage?.og_title && (
                            <div>&lt;meta property="og:title" content="{selectedPage.og_title}"/&gt;</div>
                        )}
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-amber-800">
                            Dette er en forenklet visning. I praksis tilføjes også OG-tags, hreflang og JSON-LD automatisk.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setPreviewDialogOpen(false)}>Luk</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default PlatformSeoPages;
