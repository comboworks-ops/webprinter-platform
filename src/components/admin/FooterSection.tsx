/**
 * Footer Branding Section
 * 
 * Shared UI section for configuring footer content, links, and social icons.
 * Used by both Master and Tenant branding editors.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import {
    type FooterSettings,
    type FooterLinkItem,
    type FooterStyleType,
    type FooterBackgroundType,
    DEFAULT_FOOTER,
} from "@/lib/branding";
import {
    Plus,
    Trash2,
    GripVertical,
    Columns,
    AlignCenter,
    Minus,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    Link as LinkIcon,
    Globe,
    Eye,
    EyeOff,
} from "lucide-react";

interface FooterSectionProps {
    footer: FooterSettings;
    onChange: (footer: FooterSettings) => void;
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
}

export function FooterSection({ footer, onChange, savedSwatches, onSaveSwatch, onRemoveSwatch }: FooterSectionProps) {
    // Ensure footer has all required fields
    const safeFooter: FooterSettings = {
        ...DEFAULT_FOOTER,
        ...footer,
        social: { ...DEFAULT_FOOTER.social, ...footer?.social },
    };

    const updateFooter = (partial: Partial<FooterSettings>) => {
        onChange({ ...safeFooter, ...partial });
    };

    const updateSocial = (platform: keyof FooterSettings['social'], data: Partial<FooterSettings['social']['facebook']>) => {
        onChange({
            ...safeFooter,
            social: {
                ...safeFooter.social,
                [platform]: { ...safeFooter.social[platform], ...data },
            },
        });
    };

    // Add a new link
    const addLink = () => {
        const newLink: FooterLinkItem = {
            id: `link_${Date.now()}`,
            label: 'Ny link',
            href: '/',
            isVisible: true,
            order: safeFooter.links.length,
        };
        updateFooter({ links: [...safeFooter.links, newLink] });
    };

    // Update a link
    const updateLink = (id: string, data: Partial<FooterLinkItem>) => {
        const newLinks = safeFooter.links.map(link =>
            link.id === id ? { ...link, ...data } : link
        );
        updateFooter({ links: newLinks });
    };

    // Remove a link
    const removeLink = (id: string) => {
        updateFooter({ links: safeFooter.links.filter(link => link.id !== id) });
    };

    return (
        <div className="space-y-4">
            {/* Footer Layout */}
            <CollapsibleCard
                title="Layout & Stil"
                description="Vælg layout og baggrund for footeren"
                icon={<Columns className="h-4 w-4" />}
                defaultOpen={true}
            >
                <div className="space-y-4">
                    {/* Style selector */}
                    <div className="space-y-3">
                        <Label>Layout stil</Label>
                        <RadioGroup
                            value={safeFooter.style}
                            onValueChange={(v) => updateFooter({ style: v as FooterStyleType })}
                            className="grid grid-cols-3 gap-4"
                        >
                            <div className="relative">
                                <RadioGroupItem value="minimal" id="footer-minimal" className="peer sr-only" />
                                <label
                                    htmlFor="footer-minimal"
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <Minus className="h-6 w-6" />
                                    <span className="text-sm font-medium">Minimal</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="columns" id="footer-columns" className="peer sr-only" />
                                <label
                                    htmlFor="footer-columns"
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <Columns className="h-6 w-6" />
                                    <span className="text-sm font-medium">Kolonner</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="centered" id="footer-centered" className="peer sr-only" />
                                <label
                                    htmlFor="footer-centered"
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <AlignCenter className="h-6 w-6" />
                                    <span className="text-sm font-medium">Centreret</span>
                                </label>
                            </div>
                        </RadioGroup>
                    </div>

                    <Separator />

                    {/* Background */}
                    <div className="space-y-3">
                        <Label>Baggrund</Label>
                        <RadioGroup
                            value={safeFooter.background}
                            onValueChange={(v) => updateFooter({ background: v as FooterBackgroundType })}
                            className="grid grid-cols-3 gap-4"
                        >
                            <div className="relative">
                                <RadioGroupItem value="themeDark" id="footer-bg-dark" className="peer sr-only" />
                                <label
                                    htmlFor="footer-bg-dark"
                                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <div className="w-8 h-8 rounded bg-gray-800 border" />
                                    <span className="text-xs">Mørk</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="themeLight" id="footer-bg-light" className="peer sr-only" />
                                <label
                                    htmlFor="footer-bg-light"
                                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <div className="w-8 h-8 rounded bg-gray-100 border" />
                                    <span className="text-xs">Lys</span>
                                </label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="solid" id="footer-bg-solid" className="peer sr-only" />
                                <label
                                    htmlFor="footer-bg-solid"
                                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                                >
                                    <div
                                        className="w-8 h-8 rounded border"
                                        style={{ backgroundColor: safeFooter.bgColor }}
                                    />
                                    <span className="text-xs">Brugerdefineret</span>
                                </label>
                            </div>
                        </RadioGroup>

                        {safeFooter.background === 'solid' && (
                            <div className="flex flex-col gap-2 mt-3">
                                <Label>Baggrundsfarve</Label>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <ColorPickerWithSwatches
                                            value={safeFooter.bgColor}
                                            onChange={(color) => updateFooter({ bgColor: color })}
                                            savedSwatches={savedSwatches}
                                            onSaveSwatch={onSaveSwatch}
                                            onRemoveSwatch={onRemoveSwatch}
                                        />
                                    </div>
                                    <Input
                                        value={safeFooter.bgColor}
                                        onChange={(e) => updateFooter({ bgColor: e.target.value })}
                                        className="font-mono w-28"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleCard>

            {/* Footer Content */}
            <CollapsibleCard
                title="Indhold"
                description="Tekst og copyright information"
                icon={<Globe className="h-4 w-4" />}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Footer tekst</Label>
                        <Textarea
                            value={safeFooter.text}
                            onChange={(e) => updateFooter({ text: e.target.value })}
                            placeholder="Din professionelle tryksagspartner..."
                            rows={2}
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Vis copyright</Label>
                            <p className="text-xs text-muted-foreground">
                                Vis copyright-linje i bunden af footeren
                            </p>
                        </div>
                        <Switch
                            checked={safeFooter.showCopyright}
                            onCheckedChange={(v) => updateFooter({ showCopyright: v })}
                        />
                    </div>

                    {safeFooter.showCopyright && (
                        <div className="space-y-2">
                            <Label>Copyright tekst</Label>
                            <Input
                                value={safeFooter.copyrightText}
                                onChange={(e) => updateFooter({ copyrightText: e.target.value })}
                                placeholder="© {year} {shopName}. Alle rettigheder forbeholdes."
                            />
                            <p className="text-xs text-muted-foreground">
                                Brug {"{year}"} for dynamisk årstal og {"{shopName}"} for shopnavnet
                            </p>
                        </div>
                    )}
                </div>
            </CollapsibleCard>

            {/* Footer Links */}
            <CollapsibleCard
                title="Links"
                description="Tilføj links til footer (privatlivspolitik, handelsbetingelser osv.)"
                icon={<LinkIcon className="h-4 w-4" />}
            >
                <div className="space-y-4">
                    {safeFooter.links.map((link, index) => (
                        <div key={link.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="cursor-grab text-muted-foreground mt-2">
                                <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Label</Label>
                                    <Input
                                        value={link.label}
                                        onChange={(e) => updateLink(link.id, { label: e.target.value })}
                                        placeholder="Link navn"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">URL</Label>
                                    <Input
                                        value={link.href}
                                        onChange={(e) => updateLink(link.id, { href: e.target.value })}
                                        placeholder="/side-url"
                                    />
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="mt-6"
                                onClick={() => updateLink(link.id, { isVisible: !link.isVisible })}
                            >
                                {link.isVisible ? (
                                    <Eye className="h-4 w-4" />
                                ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="mt-6 text-destructive hover:text-destructive"
                                onClick={() => removeLink(link.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={addLink}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Tilføj link
                    </Button>
                </div>
            </CollapsibleCard>

            {/* Social Media Icons */}
            <CollapsibleCard
                title="Sociale Medier"
                description="Aktiver sociale medie-ikoner og indtast dine profil-URLer"
                icon={<Facebook className="h-4 w-4" />}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <Label>Vis sociale ikoner i footer</Label>
                        <Switch
                            checked={safeFooter.showSocialIcons}
                            onCheckedChange={(v) => updateFooter({ showSocialIcons: v })}
                        />
                    </div>

                    {safeFooter.showSocialIcons && (
                        <div className="space-y-4">
                            {/* Facebook */}
                            <div className="flex items-center gap-4 p-3 rounded-lg border">
                                <Facebook className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <Input
                                        value={safeFooter.social.facebook.url}
                                        onChange={(e) => updateSocial('facebook', { url: e.target.value })}
                                        placeholder="https://facebook.com/din-side"
                                        disabled={!safeFooter.social.facebook.enabled}
                                        className={!safeFooter.social.facebook.enabled ? 'opacity-50' : ''}
                                    />
                                </div>
                                <Switch
                                    checked={safeFooter.social.facebook.enabled}
                                    onCheckedChange={(v) => updateSocial('facebook', { enabled: v })}
                                />
                            </div>

                            {/* Instagram */}
                            <div className="flex items-center gap-4 p-3 rounded-lg border">
                                <Instagram className="h-5 w-5 text-pink-600" />
                                <div className="flex-1">
                                    <Input
                                        value={safeFooter.social.instagram.url}
                                        onChange={(e) => updateSocial('instagram', { url: e.target.value })}
                                        placeholder="https://instagram.com/din-profil"
                                        disabled={!safeFooter.social.instagram.enabled}
                                        className={!safeFooter.social.instagram.enabled ? 'opacity-50' : ''}
                                    />
                                </div>
                                <Switch
                                    checked={safeFooter.social.instagram.enabled}
                                    onCheckedChange={(v) => updateSocial('instagram', { enabled: v })}
                                />
                            </div>

                            {/* LinkedIn */}
                            <div className="flex items-center gap-4 p-3 rounded-lg border">
                                <Linkedin className="h-5 w-5 text-blue-700" />
                                <div className="flex-1">
                                    <Input
                                        value={safeFooter.social.linkedin.url}
                                        onChange={(e) => updateSocial('linkedin', { url: e.target.value })}
                                        placeholder="https://linkedin.com/company/din-virksomhed"
                                        disabled={!safeFooter.social.linkedin.enabled}
                                        className={!safeFooter.social.linkedin.enabled ? 'opacity-50' : ''}
                                    />
                                </div>
                                <Switch
                                    checked={safeFooter.social.linkedin.enabled}
                                    onCheckedChange={(v) => updateSocial('linkedin', { enabled: v })}
                                />
                            </div>

                            {/* YouTube */}
                            <div className="flex items-center gap-4 p-3 rounded-lg border">
                                <Youtube className="h-5 w-5 text-red-600" />
                                <div className="flex-1">
                                    <Input
                                        value={safeFooter.social.youtube.url}
                                        onChange={(e) => updateSocial('youtube', { url: e.target.value })}
                                        placeholder="https://youtube.com/@din-kanal"
                                        disabled={!safeFooter.social.youtube.enabled}
                                        className={!safeFooter.social.youtube.enabled ? 'opacity-50' : ''}
                                    />
                                </div>
                                <Switch
                                    checked={safeFooter.social.youtube.enabled}
                                    onCheckedChange={(v) => updateSocial('youtube', { enabled: v })}
                                />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Ikoner vises kun i footeren når de er aktiveret OG har en gyldig URL.
                            </p>
                        </div>
                    )}
                </div>
            </CollapsibleCard>
        </div>
    );
}

export default FooterSection;
