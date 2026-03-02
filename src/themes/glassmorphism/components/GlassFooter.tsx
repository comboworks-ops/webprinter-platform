/**
 * Glassmorphism Theme - Footer Component
 *
 * A modern glass-effect footer with gradient accents.
 */

import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import type { ThemeComponentProps } from '@/lib/themes/types';
import { cn } from '@/lib/utils';

export function GlassFooter({ branding, tenantName }: ThemeComponentProps) {
    const footerSettings = branding?.footer || {};
    const primaryColor = branding?.colors?.primary || '#0EA5E9';
    const links = footerSettings.links?.filter((link: any) => link.isVisible) || [];
    const social = footerSettings.social || {};

    const currentYear = new Date().getFullYear();
    const copyrightText = (footerSettings.copyrightText || '© {year} {shopName}. Alle rettigheder forbeholdes.')
        .replace('{year}', String(currentYear))
        .replace('{shopName}', tenantName);

    const socialLinks = [
        { platform: 'facebook', icon: Facebook, settings: social.facebook },
        { platform: 'instagram', icon: Instagram, settings: social.instagram },
        { platform: 'linkedin', icon: Linkedin, settings: social.linkedin },
        { platform: 'youtube', icon: Youtube, settings: social.youtube },
    ].filter(s => s.settings?.enabled && s.settings?.url);

    return (
        <footer className="relative overflow-hidden">
            {/* Glass Background */}
            <div
                className="absolute inset-0 bg-gradient-to-br opacity-90"
                style={{
                    backgroundImage: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
                }}
            />
            <div className="absolute inset-0 backdrop-blur-sm" />

            <div className="relative container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Brand */}
                    <div className="space-y-4">
                        <h3
                            className="text-xl font-bold"
                            style={{ color: primaryColor }}
                        >
                            {tenantName}
                        </h3>
                        {footerSettings.text && (
                            <p className="text-gray-600 text-sm leading-relaxed">
                                {footerSettings.text}
                            </p>
                        )}
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-800">Hurtige links</h4>
                        <nav className="flex flex-col gap-2">
                            {links.map((link: any) => (
                                <Link
                                    key={link.id}
                                    to={link.href || '/'}
                                    className={cn(
                                        "text-gray-600 hover:text-gray-900 transition-colors text-sm",
                                        "hover:translate-x-1 transform transition-transform"
                                    )}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Contact & Social */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-800">Kontakt</h4>
                        <div className="space-y-2 text-sm text-gray-600">
                            {branding?.contactPage?.contactInfo?.email && (
                                <a
                                    href={`mailto:${branding.contactPage.contactInfo.email}`}
                                    className="flex items-center gap-2 hover:text-gray-900"
                                >
                                    <Mail className="h-4 w-4" />
                                    {branding.contactPage.contactInfo.email}
                                </a>
                            )}
                            {branding?.contactPage?.contactInfo?.phone && (
                                <a
                                    href={`tel:${branding.contactPage.contactInfo.phone}`}
                                    className="flex items-center gap-2 hover:text-gray-900"
                                >
                                    <Phone className="h-4 w-4" />
                                    {branding.contactPage.contactInfo.phone}
                                </a>
                            )}
                        </div>

                        {/* Social Links */}
                        {socialLinks.length > 0 && (
                            <div className="flex gap-3 pt-2">
                                {socialLinks.map(({ platform, icon: Icon, settings }) => (
                                    <a
                                        key={platform}
                                        href={settings.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "p-2 rounded-full transition-all",
                                            "bg-white/50 hover:bg-white hover:shadow-md",
                                            "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-8 pt-8 border-t border-gray-200/50 text-center">
                    <p className="text-sm text-gray-500">{copyrightText}</p>
                </div>
            </div>
        </footer>
    );
}
