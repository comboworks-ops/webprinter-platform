import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Store, Mail, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import PlatformHeader from '@/components/platform/PlatformHeader';
import PlatformFooter from '@/components/platform/PlatformFooter';
import {
    buildPlatformLegalAcceptanceRows,
    PLATFORM_PRIVACY_ROUTE,
    PLATFORM_TERMS_ROUTE,
} from '@/lib/legal/platformLegal';

const signupSchema = z.object({
    shopName: z.string().min(2, 'Shopnavn skal være mindst 2 tegn').max(100),
    email: z.string().email('Ugyldig email adresse').max(255),
    password: z.string().min(6, 'Adgangskode skal være mindst 6 tegn').max(100),
});

export default function TenantSignup() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [shopName, setShopName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [acceptPlatformTerms, setAcceptPlatformTerms] = useState(false);
    const [signupNeedsAttention, setSignupNeedsAttention] = useState(false);
    const [signupAttentionMessage, setSignupAttentionMessage] = useState('');

    // No auto-redirect - anyone can view this page
    // Logged-in users will see the form but signup will fail if email exists

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validation = signupSchema.safeParse({ shopName, email, password });
        if (!validation.success) {
            toast.error(validation.error.errors[0].message);
            return;
        }

        if (!acceptPlatformTerms) {
            toast.error('Du skal acceptere platformvilkår og privatlivspolitik for at fortsætte.');
            return;
        }

        setLoading(true);
        setSignupNeedsAttention(false);
        setSignupAttentionMessage('');

        try {
            // 1. Create user in Supabase Auth (with timeout)
            const signupPromise = supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/admin`,
                    data: {
                        shop_name: shopName.trim(),
                        is_shop_owner: true,
                    },
                },
            });

            // Add 15 second timeout
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: Email sending might be failing. Check SMTP settings.')), 15000)
            );

            const { data: authData, error: authError } = await Promise.race([signupPromise, timeoutPromise]);

            if (authError) {
                if (authError.message.includes('already registered')) {
                    toast.error('Denne email er allerede registreret. Log venligst ind.');
                } else {
                    toast.error(authError.message);
                }
                return;
            }

            if (!authData.user) {
                toast.error('Kunne ikke oprette bruger');
                return;
            }

            // 2. Create tenant for this shop owner
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .insert({
                    name: shopName.trim(),
                    owner_id: authData.user.id,
                    settings: {
                        type: 'tenant',
                        company: {
                            name: shopName.trim(),
                            email: email.trim().toLowerCase(),
                        },
                    },
                })
                .select('id')
                .single();

            if (tenantError || !tenantData?.id) {
                console.error('Tenant creation error:', tenantError);
                setSignupNeedsAttention(true);
                setSignupAttentionMessage('Din konto er oprettet, men vi kunne ikke færdiggøre shopopsætningen. Kontakt os, så vi kan færdiggøre onboarding.');
                setStep('success');
                toast.error('Konto oprettet, men shopopsætning mangler. Kontakt os.');
                return;
            }

            const tenantId = tenantData.id;

            // 3. Add tenant-scoped admin role to this user
            const { error: roleError } = await supabase
                .from('user_roles')
                .insert({
                    user_id: authData.user.id,
                    role: 'admin',
                    tenant_id: tenantId,
                });

            if (roleError) {
                console.error('Role creation error:', roleError);
                setSignupNeedsAttention(true);
                setSignupAttentionMessage('Din konto og shop er oprettet, men vi kunne ikke færdiggøre adgangsopsætningen. Kontakt os, så vi kan aktivere din tenant korrekt.');
                setStep('success');
                toast.error('Konto oprettet, men adgangsopsætning mangler. Kontakt os.');
                return;
            }

            // 4. Store legal acceptance evidence for the tenant signup
            const { error: acceptanceError } = await supabase
                .from('tenant_legal_acceptances')
                .insert(
                    buildPlatformLegalAcceptanceRows({
                        tenantId,
                        userId: authData.user.id,
                        email: email.trim(),
                        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
                    })
                );

            if (acceptanceError) {
                console.error('Legal acceptance logging error:', acceptanceError);
                setSignupNeedsAttention(true);
                setSignupAttentionMessage('Din konto og shop er oprettet, men vi kunne ikke registrere aftaleaccepten korrekt. Kontakt os, så vi kan færdiggøre onboarding.');
                setStep('success');
                toast.error('Konto oprettet, men aftaleaccept mangler. Kontakt os.');
                return;
            }

            setStep('success');
            toast.success('Shop oprettet! Check din email for at bekræfte.');

        } catch (error) {
            console.error('Signup error:', error);
            toast.error('Der opstod en uventet fejl');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="min-h-screen flex flex-col">
                <PlatformHeader />
                <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-12">
                    <Card className="w-full max-w-md text-center">
                        <CardHeader>
                            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${signupNeedsAttention ? 'bg-amber-100' : 'bg-green-100'}`}>
                                {signupNeedsAttention ? (
                                    <AlertTriangle className="h-8 w-8 text-amber-600" />
                                ) : (
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                )}
                            </div>
                            <CardTitle>{signupNeedsAttention ? 'Konto oprettet, men gennemgå onboarding' : 'Shop Oprettet!'}</CardTitle>
                            <CardDescription>
                                {signupNeedsAttention ? (
                                    <>
                                        {signupAttentionMessage}
                                        <br />
                                        <br />
                                        Vi har sendt en bekræftelsesmail til <strong>{email}</strong>.
                                    </>
                                ) : (
                                    <>
                                        Vi har sendt en bekræftelsesmail til <strong>{email}</strong>.
                                        Klik på linket i mailen for at aktivere din konto. Derefter kan du logge ind og vælge abonnement i admin.
                                    </>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => navigate('/auth')} className="w-full">
                                Gå til Login
                            </Button>
                        </CardContent>
                    </Card>
                </div>
                <PlatformFooter />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <PlatformHeader />
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-12">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5" />
                            Start Din Webshop
                        </CardTitle>
                        <CardDescription>
                            Opret din egen trykkeri-webshop. Når din konto er bekræftet, kan du logge ind og vælge abonnement for at starte prøveperioden.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="shopName" className="text-sm font-medium flex items-center gap-2">
                                    <Store className="h-4 w-4" />
                                    Shopnavn
                                </label>
                                <Input
                                    id="shopName"
                                    type="text"
                                    placeholder="Mit Trykkeri"
                                    value={shopName}
                                    onChange={(e) => setShopName(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    Email
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="din@email.dk"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Adgangskode
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">Dette får du:</p>
                                <ul className="space-y-1">
                                    <li>✓ Komplet webshop med alle produkter</li>
                                    <li>✓ Færdige priser du kan tilpasse</li>
                                    <li>✓ Admin panel til ordrehåndtering</li>
                                    <li>✓ Automatiske opdateringer fra os</li>
                                </ul>
                            </div>

                            <div className="rounded-lg border border-border/70 p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="acceptPlatformTerms"
                                        checked={acceptPlatformTerms}
                                        onCheckedChange={(checked) => setAcceptPlatformTerms(Boolean(checked))}
                                        disabled={loading}
                                        className="mt-1"
                                    />
                                    <label htmlFor="acceptPlatformTerms" className="text-sm text-muted-foreground leading-relaxed">
                                        Jeg accepterer{" "}
                                        <Link to={PLATFORM_TERMS_ROUTE} className="text-primary hover:underline">
                                            platformvilkår
                                        </Link>{" "}
                                        og{" "}
                                        <Link to={PLATFORM_PRIVACY_ROUTE} className="text-primary hover:underline">
                                            privatlivspolitik
                                        </Link>
                                        , og at min accept registreres som en del af onboarding.
                                    </label>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Opret Shop
                            </Button>
                        </form>

                        <div className="mt-4 text-center text-sm">
                            <span className="text-muted-foreground">Har du allerede en konto? </span>
                            <button
                                type="button"
                                onClick={() => navigate('/auth')}
                                className="text-primary hover:underline"
                                disabled={loading}
                            >
                                Log ind her
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <PlatformFooter />
        </div>
    );
}
