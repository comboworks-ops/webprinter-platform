/**
 * Glassmorphism Theme - Header Component
 *
 * A frosted glass effect header with modern styling.
 * Features: backdrop blur, glass effect, floating navigation.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Search, User, ShoppingCart } from 'lucide-react';
import type { ThemeComponentProps } from '@/lib/themes/types';
import { cn } from '@/lib/utils';
import { BorderBeam } from '@/components/ui/border-beam';

export function GlassHeader({ branding, tenantName }: ThemeComponentProps) {
    const navigate = useNavigate();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const headerSettings = branding?.header || {};
    const logoText = headerSettings.logoText || tenantName;
    const logoUrl = headerSettings.logoImageUrl;
    const logoType = headerSettings.logoType || 'text';
    const navItems = headerSettings.navItems?.filter((item: any) => item.isVisible) || [];
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 overflow-hidden",
                isScrolled
                    ? "bg-white/70 backdrop-blur-xl shadow-lg"
                    : "bg-white/30 backdrop-blur-md"
            )}
        >
            {/* Animated border beam when scrolled */}
            {isScrolled && (
                <BorderBeam
                    size={100}
                    duration={8}
                    colorFrom={primaryColor}
                    colorTo={`${primaryColor}66`}
                    borderWidth={2}
                />
            )}
            <div className="container mx-auto px-4">
                <div className="h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link
                        to="/"
                        className="flex items-center gap-2 group"
                    >
                        {logoType === 'image' && logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={tenantName}
                                className="h-8 w-auto object-contain"
                            />
                        ) : (
                            <span
                                className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r"
                                style={{
                                    backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                                }}
                            >
                                {logoText}
                            </span>
                        )}
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item: any) => (
                            <Link
                                key={item.id}
                                to={item.href || '/'}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                                    "text-gray-700 hover:text-gray-900",
                                    "hover:bg-white/50 hover:shadow-sm"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            className={cn(
                                "p-2 rounded-full transition-all",
                                "text-gray-600 hover:text-gray-900",
                                "hover:bg-white/50 hover:shadow-sm"
                            )}
                        >
                            <Search className="h-5 w-5" />
                        </button>
                        <button
                            className={cn(
                                "p-2 rounded-full transition-all",
                                "text-gray-600 hover:text-gray-900",
                                "hover:bg-white/50 hover:shadow-sm"
                            )}
                            onClick={() => navigate('/min-konto')}
                        >
                            <User className="h-5 w-5" />
                        </button>

                        {/* CTA Button */}
                        {headerSettings.cta?.enabled && (
                            <Link
                                to={headerSettings.cta.href || '/shop'}
                                className={cn(
                                    "hidden sm:flex items-center gap-2 px-4 py-2 rounded-full",
                                    "text-white font-medium text-sm",
                                    "shadow-lg hover:shadow-xl transition-all",
                                    "hover:scale-105"
                                )}
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                                }}
                            >
                                <ShoppingCart className="h-4 w-4" />
                                {headerSettings.cta.label || 'Shop'}
                            </Link>
                        )}

                        {/* Mobile Menu Toggle */}
                        <button
                            className="md:hidden p-2 rounded-full hover:bg-white/50"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-white/20">
                        <nav className="flex flex-col gap-2">
                            {navItems.map((item: any) => (
                                <Link
                                    key={item.id}
                                    to={item.href || '/'}
                                    className="px-4 py-2 rounded-lg text-gray-700 hover:bg-white/50"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}
