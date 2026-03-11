import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import PlatformHeader from '@/components/platform/PlatformHeader';
import PlatformFooter from '@/components/platform/PlatformFooter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShopSettings } from '@/hooks/useShopSettings';

const authSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Adgangskoden skal være mindst 8 tegn').max(100),
  confirmPassword: z.string().min(8, 'Bekræft adgangskoden'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Adgangskoderne matcher ikke',
  path: ['confirmPassword'],
});

type AuthView = 'login' | 'signup' | 'forgot' | 'recovery';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  // Fetch tenant settings to decide context
  const { data: tenant, isLoading } = useShopSettings();

  const [view, setView] = useState<AuthView>(() => {
    if (typeof window === 'undefined') return 'login';
    const search = new URLSearchParams(window.location.search);
    if (search.get('mode') === 'reset') return 'recovery';
    if (window.location.hash.includes('type=recovery')) return 'recovery';
    return 'login';
  });
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  // Determine if we are in "Platform Mode" or "Tenant Mode"
  // If tenant ID is the Master ID or undefined (marking domains), we are in Platform Mode.
  const isPlatformMode = !tenant || tenant.id === '00000000-0000-0000-0000-000000000000';
  const isRecoveryMode = view === 'recovery';
  const isLogin = view === 'login';
  const isSignup = view === 'signup';
  const isForgotPassword = view === 'forgot';
  const redirectTarget = searchParams.get('redirect') || '/min-konto';
  const isLocalhost =
    typeof window !== 'undefined'
      && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const buildTenantAuthQuery = (includeMode?: string) => {
    const params = new URLSearchParams();
    const tenantIdParam = searchParams.get('tenantId') || searchParams.get('tenant_id');
    const forceDomainParam = searchParams.get('force_domain');
    const redirectParam = searchParams.get('redirect');

    if (includeMode) {
      params.set('mode', includeMode);
    }

    if (redirectParam) {
      params.set('redirect', redirectParam);
    }

    if (tenantIdParam) {
      params.set('tenantId', tenantIdParam);
    } else if (forceDomainParam) {
      params.set('force_domain', forceDomainParam);
    } else if (isLocalhost && tenant?.id && tenant.id !== '00000000-0000-0000-0000-000000000000') {
      params.set('tenantId', tenant.id);
    }

    const query = params.toString();
    return query ? `?${query}` : '';
  };

  useEffect(() => {
    const checkUser = async () => {
      if (isRecoveryMode) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(redirectTarget, { replace: true });
      }
    };
    if (!isLoading) {
      checkUser();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('recovery');
        return;
      }

      if (session?.user) {
        if (isRecoveryMode) return;
        navigate(redirectTarget, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isLoading, isRecoveryMode, redirectTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      if (isRecoveryMode) {
        const validation = resetPasswordSchema.safeParse({
          password: resetPassword,
          confirmPassword: confirmResetPassword,
        });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password: resetPassword });
        if (error) {
          toast.error(error.message || 'Kunne ikke opdatere adgangskoden');
          return;
        }

        toast.success('Adgangskoden er opdateret. Du kan nu logge ind.');
        setResetPassword('');
        setConfirmResetPassword('');
        setView('login');
        if (typeof window !== 'undefined') {
          const nextUrl = `${window.location.origin}${window.location.pathname}${buildTenantAuthQuery()}`;
          window.history.replaceState({}, document.title, nextUrl);
        }
        return;
      }

      if (isForgotPassword) {
        const validation = z.string().email('Ugyldig email adresse').safeParse(email.trim());
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          return;
        }

        const redirectTo = `${window.location.origin}/auth${buildTenantAuthQuery('reset')}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });

        if (error) {
          toast.error(error.message || 'Kunne ikke sende nulstillingsmail');
          return;
        }

        toast.success('Hvis emailen findes, er der sendt et link til nulstilling af adgangskode.');
        setView('login');
        return;
      }

      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const message = error.message || '';
          if (message.toLowerCase().includes('email not confirmed')) {
            toast.error('Bekræft din email først. Tjek indbakke og spam, og prøv derefter igen.');
          } else if (message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(message);
          }
          return;
        }

        toast.success('Successfully logged in!');
      } else {
        const redirectUrl = `${window.location.origin}/auth${buildTenantAuthQuery()}`;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please login instead.');
          } else {
            toast.error(error.message);
          }
          return;
        }

        const identities = data.user?.identities ?? [];
        const returnedObfuscatedExistingUser = Boolean(
          data.user && !data.session && identities.length === 0
        );

        if (returnedObfuscatedExistingUser) {
          toast.error('Denne email er allerede registreret eller afventer bekræftelse. Brug log ind eller nulstil adgangskoden.');
          setView('login');
          return;
        }

        if (data.session) {
          toast.success('Konto oprettet. Du er nu logget ind.');
          return;
        }

        toast.success('Konto oprettet. Tjek din email for at bekræfte kontoen, før du logger ind.');
        setView('login');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Conditionally Render Header */}
      {isPlatformMode ? <PlatformHeader /> : <Header />}

      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-12 pt-32">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {isRecoveryMode
                ? 'Vælg ny adgangskode'
                : isForgotPassword
                  ? 'Glemt adgangskode'
                  : isLogin
                    ? t("signIn")
                    : t("signUp")}
            </CardTitle>
            <CardDescription>
              {isRecoveryMode
                ? 'Indtast din nye adgangskode for at fuldføre nulstillingen.'
                : isForgotPassword
                  ? 'Indtast din email, så sender vi et link til nulstilling.'
                  : isLogin
                    ? t("signIn")
                    : t("createAccount")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isRecoveryMode && (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    {t("email")}
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
              )}

              {!isForgotPassword && !isRecoveryMode && (
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    {t("password")}
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
              )}

              {isRecoveryMode && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="reset-password" className="text-sm font-medium">
                      Ny adgangskode
                    </label>
                    <Input
                      id="reset-password"
                      type="password"
                      placeholder="Mindst 8 tegn"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reset-password-confirm" className="text-sm font-medium">
                      Gentag adgangskode
                    </label>
                    <Input
                      id="reset-password-confirm"
                      type="password"
                      placeholder="Gentag adgangskode"
                      value={confirmResetPassword}
                      onChange={(e) => setConfirmResetPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRecoveryMode
                  ? 'Gem ny adgangskode'
                  : isForgotPassword
                    ? 'Send nulstillingslink'
                    : isLogin
                      ? t("signIn")
                      : t("signUp")}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  Glemt adgangskode?
                </button>
              )}
            </div>

            {!isRecoveryMode && (
              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => setView(isLogin ? 'signup' : 'login')}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  {isLogin
                    ? t("dontHaveAccount")
                    : isForgotPassword
                      ? 'Tilbage til log ind'
                      : t("alreadyHaveAccount")}
                </button>
              </div>
            )}

            {isForgotPassword && (
              <div className="mt-2 text-center text-sm">
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  Tilbage til log ind
                </button>
              </div>
            )}

            {isRecoveryMode && (
              <div className="mt-4 text-center text-xs text-muted-foreground">
                Når adgangskoden er gemt, kan du logge ind normalt igen.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conditionally Render Footer */}
      {isPlatformMode ? <PlatformFooter /> : <Footer />}
    </div>
  );
}
