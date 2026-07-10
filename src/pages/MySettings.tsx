import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Settings, User, Mail, Phone, Building2, MapPin, LayoutDashboard, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { AccountLoadingShell } from '@/components/account/AccountLoadingShell';

const profileSchema = z.object({
    first_name: z.string().trim().max(100, 'Fornavn må højst være 100 tegn').optional(),
    last_name: z.string().trim().max(100, 'Efternavn må højst være 100 tegn').optional(),
    phone: z.string().trim().max(20, 'Telefon må højst være 20 tegn').optional(),
    company: z.string().trim().max(200, 'Virksomhedsnavn må højst være 200 tegn').optional(),
});

type ProfileData = z.infer<typeof profileSchema>;

const sidebarItems = [
    { path: '/min-konto', label: 'Oversigt', icon: LayoutDashboard, end: true },
    { path: '/min-konto/ordrer', label: 'Mine Ordrer', icon: Package },
    { path: '/min-konto/adresser', label: 'Leveringsadresser', icon: MapPin },
    { path: '/min-konto/indstillinger', label: 'Indstillinger', icon: Settings },
];

export default function MySettings() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<ProfileData>({
        first_name: '',
        last_name: '',
        phone: '',
        company: '',
    });

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/auth?redirect=/min-konto/indstillinger');
            return;
        }
        setUser(user);
        await fetchProfile(user.id);
        setLoading(false);
    };

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await (supabase as any)
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setProfile({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    phone: data.phone || '',
                    company: data.company || '',
                });
            }
        } catch (e) {
            console.error('Error fetching profile:', e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const validation = profileSchema.safeParse(profile);
        if (!validation.success) {
            toast.error(validation.error.errors[0].message);
            return;
        }

        setSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('profiles')
                .upsert({
                    id: user.id,
                    ...validation.data,
                });

            if (error) throw error;
            toast.success('Profil opdateret!');
        } catch (e: any) {
            console.error('Error updating profile:', e);
            toast.error(e.message || 'Kunne ikke opdatere profil');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof ProfileData, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return <AccountLoadingShell />;
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1 bg-slate-50/70">
                <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
                    {/* Page Header */}
                    <div className="mb-6 rounded-2xl border bg-white px-5 py-5 shadow-sm sm:mb-8 sm:px-6">
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Min Konto</h1>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                            Administrer dine oplysninger og indstillinger
                        </p>
                    </div>

                    <div className="flex flex-col gap-6 lg:flex-row">
                        {/* Sidebar */}
                        <aside className="flex-shrink-0 lg:w-72">
                            <nav className="grid grid-cols-1 gap-1 rounded-2xl border bg-white/95 p-2 shadow-sm backdrop-blur sm:grid-cols-2 lg:sticky lg:top-24 lg:grid-cols-1">
                                {sidebarItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.end
                                        ? location.pathname === item.path
                                        : location.pathname.startsWith(item.path);

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={cn(
                                                "flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                                                isActive
                                                    ? "bg-primary !text-white shadow-sm ring-1 ring-primary/20 hover:!text-white [&_svg]:!text-white"
                                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                                            )}
                                        >
                                            <Icon className="h-5 w-5" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </aside>

                        {/* Main Content */}
                        <div className="flex-1 space-y-6">
                            {/* Profile Settings */}
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="h-5 w-5" />
                                        Personlige oplysninger
                                    </CardTitle>
                                    <CardDescription>
                                        Opdater dine personlige oplysninger
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Email (read-only) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                Email
                                            </Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={user?.email || ''}
                                                disabled
                                                className="bg-muted"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Din email kan ikke ændres
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* First Name */}
                                            <div className="space-y-2">
                                                <Label htmlFor="first_name">Fornavn</Label>
                                                <Input
                                                    id="first_name"
                                                    type="text"
                                                    value={profile.first_name}
                                                    onChange={(e) => handleChange('first_name', e.target.value)}
                                                    placeholder="Indtast dit fornavn"
                                                    maxLength={100}
                                                />
                                            </div>

                                            {/* Last Name */}
                                            <div className="space-y-2">
                                                <Label htmlFor="last_name">Efternavn</Label>
                                                <Input
                                                    id="last_name"
                                                    type="text"
                                                    value={profile.last_name}
                                                    onChange={(e) => handleChange('last_name', e.target.value)}
                                                    placeholder="Indtast dit efternavn"
                                                    maxLength={100}
                                                />
                                            </div>
                                        </div>

                                        {/* Phone */}
                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="flex items-center gap-2">
                                                <Phone className="h-4 w-4" />
                                                Telefon
                                            </Label>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                value={profile.phone}
                                                onChange={(e) => handleChange('phone', e.target.value)}
                                                placeholder="+45 12345678"
                                                maxLength={20}
                                            />
                                        </div>

                                        {/* Company */}
                                        <div className="space-y-2">
                                            <Label htmlFor="company" className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4" />
                                                Virksomhed
                                            </Label>
                                            <Input
                                                id="company"
                                                type="text"
                                                value={profile.company}
                                                onChange={(e) => handleChange('company', e.target.value)}
                                                placeholder="Din virksomhed (valgfrit)"
                                                maxLength={200}
                                            />
                                        </div>

                                        <Button type="submit" disabled={saving} className="w-full md:w-auto">
                                            {saving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Gemmer...
                                                </>
                                            ) : (
                                                'Gem ændringer'
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            {/* Account Actions */}
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Kontoindstillinger
                                    </CardTitle>
                                    <CardDescription>
                                        Administrer din konto
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between py-3 border-b">
                                        <div>
                                            <p className="font-medium">Skift adgangskode</p>
                                            <p className="text-sm text-muted-foreground">
                                                Opdater din adgangskode for at sikre din konto
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={async () => {
                                                if (user?.email) {
                                                    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
                                                    if (error) {
                                                        toast.error('Kunne ikke sende link');
                                                    } else {
                                                        toast.success('Link til nulstilling sendt til din email');
                                                    }
                                                }
                                            }}
                                        >
                                            Send nulstillingslink
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between py-3">
                                        <div>
                                            <p className="font-medium text-destructive">Slet konto</p>
                                            <p className="text-sm text-muted-foreground">
                                                Permanent sletning af din konto og alle data
                                            </p>
                                        </div>
                                        <Button variant="destructive" disabled>
                                            Kontakt support
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
