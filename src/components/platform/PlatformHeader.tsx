/**
 * PlatformHeader - Header component for the Platform marketing site
 * 
 * This header is ONLY used on webprinter.dk / www.webprinter.dk (Platform pages).
 * It is completely independent of tenant branding and demo shop settings.
 * 
 * Key differences from shop Header:
 * - Brand name is static "Webprinter.dk" and NOT clickable
 * - No product queries or tenant data dependencies
 * - Simplified navigation for marketing pages
 * - ALWAYS white background (never transparent)
 */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, User, Shield, ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { platformNavLink } from "@/lib/platform/context";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// Platform feature pages for Funktioner dropdown
const FUNKTIONER_PAGES = [
    { label: "White Label Webshop", path: "/white-label" },
    { label: "Smart Prisberegning", path: "/beregning" },
    { label: "Ordre Workflow", path: "/order-flow" },
    { label: "Online Designer", path: "/online-designer" },
];

const PlatformHeader = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(true);
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const location = useLocation();
    const { toast } = useToast();
    const { isAdmin } = useUserRole();
    const shouldReduceMotion = useReducedMotion();
    const headerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast({
                title: "Fejl",
                description: "Kunne ikke logge ud",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Succes",
                description: "Du er nu logget ud",
            });
        }
    };

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!mobileMenuOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileMenuOpen]);

    // DK Blue color used across the platform
    const DK_BLUE = "#0EA5E9";

    return (
        <header
            ref={headerRef}
            className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100"
            style={{
                height: '72px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
        >
            <div className="container mx-auto px-4 h-full">
                <div className="flex items-center justify-between h-full">
                    {/* Brand Name - Static "Webprinter.dk", NOT clickable */}
                    {/* Uses font-heading (Poppins) to match the main title */}
                    <span className="text-2xl md:text-3xl font-heading font-bold tracking-tight select-none">
                        <span className="text-gray-900">Web</span>
                        <span style={{ color: DK_BLUE }}>printer.dk</span>
                    </span>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-8">
                        <Link
                            to={platformNavLink("/platform")}
                            className={`text-sm font-medium transition-colors duration-200 ${isActive('/platform') ? 'text-primary' : 'text-gray-700 hover:text-primary'
                                }`}
                        >
                            Platform
                        </Link>

                        {/* Funktioner Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="text-sm font-medium text-gray-700 hover:text-primary transition-colors duration-200 inline-flex items-center gap-1">
                                    Funktioner
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                {FUNKTIONER_PAGES.map((page) => (
                                    <DropdownMenuItem key={page.path} asChild>
                                        <Link to={platformNavLink(page.path)} className="cursor-pointer">
                                            {page.label}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Link
                            to={platformNavLink("/priser")}
                            className={`text-sm font-medium transition-colors duration-200 ${isActive('/priser') ? 'text-primary' : 'text-gray-700 hover:text-primary'
                                }`}
                        >
                            Priser
                        </Link>

                        <Link
                            to={platformNavLink("/kontakt")}
                            className={`text-sm font-medium transition-colors duration-200 ${isActive('/kontakt') ? 'text-primary' : 'text-gray-700 hover:text-primary'
                                }`}
                        >
                            Kontakt
                        </Link>
                    </nav>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3">
                        {/* CTA Button */}
                        <Link to={platformNavLink("/opret-shop")}>
                            <Button size="sm" className="hidden md:flex">
                                Start gratis
                            </Button>
                        </Link>

                        {/* User Menu */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-gray-700">
                                        <User className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem asChild>
                                        <Link to="/profil" className="cursor-pointer">
                                            <User className="mr-2 h-4 w-4" />
                                            Min profil
                                        </Link>
                                    </DropdownMenuItem>
                                    {isAdmin && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild>
                                                <Link to={platformNavLink("/admin")} className="cursor-pointer">
                                                    <Shield className="mr-2 h-4 w-4" />
                                                    Admin
                                                </Link>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Log ud
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link to="/admin/login">
                                <Button size="sm" className="hidden border-transparent bg-slate-900 text-white shadow-none hover:bg-slate-800 hover:text-white md:flex">
                                    Log ind
                                </Button>
                            </Link>
                        )}

                        {/* Mobile Menu Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden text-gray-700"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Luk menu"
                            className="fixed inset-0 z-[49] bg-slate-950/20 backdrop-blur-[2px] lg:hidden"
                            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.nav
                            className="fixed left-3 right-3 top-20 z-[60] max-h-[calc(100dvh-5.75rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl lg:hidden"
                            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="max-h-[inherit] overflow-y-auto overscroll-contain p-3">
                                <div className="space-y-1 rounded-xl bg-slate-50 p-1">
                                    <Link
                                        to={platformNavLink("/platform")}
                                        className={`flex min-h-12 items-center rounded-lg px-3 text-base font-medium transition-colors ${isActive('/platform') ? 'bg-primary/10 text-primary' : 'text-slate-800 hover:bg-white hover:text-primary'
                                            }`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Platform
                                    </Link>

                                    <button
                                        type="button"
                                        className="flex min-h-12 w-full touch-manipulation items-center justify-between rounded-lg px-3 text-left text-base font-medium text-slate-800 transition-colors hover:bg-white hover:text-primary"
                                        onClick={() => setMobileFeaturesOpen((open) => !open)}
                                        aria-expanded={mobileFeaturesOpen}
                                    >
                                        <span>Funktioner</span>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${mobileFeaturesOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {mobileFeaturesOpen && (
                                            <motion.div
                                                initial={shouldReduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={shouldReduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                                                transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                                                className="overflow-hidden"
                                            >
                                                <div className="grid gap-1 px-1 pb-1 sm:grid-cols-2">
                                                    {FUNKTIONER_PAGES.map((page) => (
                                                        <Link
                                                            key={page.path}
                                                            to={platformNavLink(page.path)}
                                                            className={`flex min-h-11 touch-manipulation items-center rounded-lg px-3 text-sm font-medium transition-colors ${isActive(page.path) ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-white hover:text-primary'
                                                                }`}
                                                            onClick={() => setMobileMenuOpen(false)}
                                                        >
                                                            {page.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <Link
                                        to={platformNavLink("/priser")}
                                        className={`flex min-h-12 items-center rounded-lg px-3 text-base font-medium transition-colors ${isActive('/priser') ? 'bg-primary/10 text-primary' : 'text-slate-800 hover:bg-white hover:text-primary'
                                            }`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Priser
                                    </Link>

                                    <Link
                                        to={platformNavLink("/kontakt")}
                                        className={`flex min-h-12 items-center rounded-lg px-3 text-base font-medium transition-colors ${isActive('/kontakt') ? 'bg-primary/10 text-primary' : 'text-slate-800 hover:bg-white hover:text-primary'
                                            }`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Kontakt
                                    </Link>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <Link to={platformNavLink("/opret-shop")} onClick={() => setMobileMenuOpen(false)}>
                                        <Button className="min-h-12 w-full">Start gratis</Button>
                                    </Link>
                                    {!user ? (
                                        <Link to="/admin/login" onClick={() => setMobileMenuOpen(false)}>
                                            <Button className="min-h-12 w-full border-transparent bg-slate-900 text-white shadow-none hover:bg-slate-800 hover:text-white">Log ind</Button>
                                        </Link>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="min-h-12 w-full"
                                            onClick={() => {
                                                handleLogout();
                                                setMobileMenuOpen(false);
                                            }}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Log ud
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.nav>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
};

export default PlatformHeader;
