/**
 * PlatformFooter - Footer component for the Platform marketing site
 * 
 * This footer is ONLY used on webprinter.dk / www.webprinter.dk (Platform pages).
 * It is completely independent of tenant branding and demo shop settings.
 * 
 * Key differences from shop Footer:
 * - Static "Webprinter.dk" brand
 * - Platform-only links (no grafisk vejledning, no product links)
 * - Copyright shows "© 2026 Webprinter.dk"
 */

import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { useCookieConsent } from "@/components/consent";

// Small button component to open cookie settings
const CookieSettingsButton = () => {
    const { openSettings } = useCookieConsent();
    return (
        <button
            onClick={openSettings}
            className="text-gray-500 hover:text-white transition-colors underline text-xs"
        >
            Cookieindstillinger
        </button>
    );
};

// Platform footer links
const PLATFORM_LINKS = {
    funktioner: [
        { label: "White Label Webshop", href: "/white-label" },
        { label: "Smart Prisberegning", href: "/beregning" },
        { label: "Ordre Workflow", href: "/order-flow" },
        { label: "Online Designer", href: "/online-designer" },
    ],
    virksomhed: [
        { label: "Om os", href: "/om-os" },
        { label: "Priser", href: "/priser" },
        { label: "Kontakt", href: "/kontakt" },
    ],
    juridisk: [
        { label: "Privatlivspolitik", href: "/privacy-policy" },
        { label: "Handelsbetingelser", href: "/handelsbetingelser" },
        { label: "Cookiepolitik", href: "/cookiepolitik" },
    ],
};

// Platform contact info
const CONTACT_INFO = {
    email: "info@webprinter.dk",
    phone: "+45 71 99 11 10",
    address: "Webprinter\nDanmark",
};

const PlatformFooter = () => {
    return (
        <footer className="bg-gray-900 text-white">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    {/* Column 1: Brand */}
                    <div>
                        <h3 className="text-xl font-heading font-bold mb-4">
                            <span className="text-white">Web</span>
                            <span className="text-sky-400">printer.dk</span>
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Den komplette platform til moderne trykkerier.
                            Start din egen webshop i dag.
                        </p>
                    </div>

                    {/* Column 2: Funktioner */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4">Funktioner</h4>
                        <ul className="space-y-2">
                            {PLATFORM_LINKS.funktioner.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        to={link.href}
                                        className="text-gray-400 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Virksomhed */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4">Virksomhed</h4>
                        <ul className="space-y-2">
                            {PLATFORM_LINKS.virksomhed.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        to={link.href}
                                        className="text-gray-400 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            {PLATFORM_LINKS.juridisk.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        to={link.href}
                                        className="text-gray-400 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 4: Kontakt */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4">Kontakt</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li className="flex items-center gap-2">
                                <Phone className="h-4 w-4 shrink-0" />
                                <a href={`tel:${CONTACT_INFO.phone}`} className="hover:text-white transition-colors">
                                    {CONTACT_INFO.phone}
                                </a>
                            </li>
                            <li className="flex items-center gap-2">
                                <Mail className="h-4 w-4 shrink-0" />
                                <a href={`mailto:${CONTACT_INFO.email}`} className="hover:text-white transition-colors">
                                    {CONTACT_INFO.email}
                                </a>
                            </li>
                            <li className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                                <span className="whitespace-pre-line">{CONTACT_INFO.address}</span>
                            </li>
                            <li className="mt-4 flex gap-4">
                                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label="Facebook">
                                    <Facebook className="h-5 w-5" />
                                </a>
                                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label="Instagram">
                                    <Instagram className="h-5 w-5" />
                                </a>
                                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label="LinkedIn">
                                    <Linkedin className="h-5 w-5" />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-500">
                    <p className="mb-2">© 2026 Webprinter.dk</p>
                    <CookieSettingsButton />
                </div>
            </div>
        </footer>
    );
};

export default PlatformFooter;
