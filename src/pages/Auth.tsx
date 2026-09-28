import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FolderOpen, Loader2, Mail, Package, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useShopSettings } from '@/hooks/useShopSettings';
import { customerAuthHref, customerLink, safeCustomerReturnTarget } from '@/lib/account/navigation';
import '@/styles/customerAccountForms.css';

const authSchema = z.object({
  email: z.string().email('Indtast en gyldig emailadresse').max(255),
  password: z.string().min(6, 'Adgangskoden skal være mindst 6 tegn').max(100),
});
const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Adgangskoden skal være mindst 8 tegn').max(100),
  confirmPassword: z.string().min(8, 'Bekræft adgangskoden'),
}).refine((data) => data.password === data.confirmPassword, { message: 'Adgangskoderne matcher ikke', path: ['confirmPassword'] });
type AuthView = 'login' | 'signup' | 'forgot' | 'recovery';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: tenant, isLoading } = useShopSettings();
  const [view, setView] = useState<AuthView>(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get('mode') === 'reset' || window.location.hash.includes('type=recovery')) return 'recovery';
    if (search.get('mode') === 'signup') return 'signup';
    if (search.get('mode') === 'forgot') return 'forgot';
    return 'login';
  });
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [recoverySaved, setRecoverySaved] = useState(false);
  const recoverySession = useRef(view === 'recovery');
  const isRecoveryMode = view === 'recovery';
  const isLogin = view === 'login';
  const isForgotPassword = view === 'forgot';
  const redirectTarget = customerLink(safeCustomerReturnTarget(searchParams.get('redirect')), location.search);
  const shopName = tenant?.tenant_name || 'webshoppen';

  useEffect(() => {
    let active = true;
    if (!isLoading && !isRecoveryMode && !recoverySession.current) {
      supabase.auth.getUser().then(({ data }) => {
        if (active && data.user && !recoverySession.current) navigate(redirectTarget, { replace: true });
      }).catch(() => {
        if (active) setErrorMessage('Din session kunne ikke kontrolleres. Prøv at logge ind igen.');
      });
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { recoverySession.current = true; setView('recovery'); return; }
      if (session?.user && !isRecoveryMode && !recoverySession.current) navigate(redirectTarget, { replace: true });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate, isLoading, isRecoveryMode, redirectTarget]);

  const changeView = (nextView: AuthView) => {
    setView(nextView);
    setErrorMessage('');
    setNotice('');
    setFieldErrors({});
    setPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setErrorMessage('');
    setNotice('');
    setFieldErrors({});
    setLoading(true);
    try {
      if (isRecoveryMode) {
        const validation = resetPasswordSchema.safeParse({ password: resetPassword, confirmPassword: confirmResetPassword });
        if (!validation.success) {
          setFieldErrors(Object.fromEntries(validation.error.issues.map((issue) => [issue.path[0], issue.message])));
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: resetPassword });
        if (error) { setErrorMessage('Adgangskoden kunne ikke opdateres. Dit link kan være udløbet. Bed om et nyt nulstillingslink.'); return; }
        setResetPassword('');
        setConfirmResetPassword('');
        setRecoverySaved(true);
        return;
      }
      if (isForgotPassword) {
        const validation = z.string().email('Indtast en gyldig emailadresse').max(255).safeParse(email.trim());
        if (!validation.success) { setFieldErrors({ email: validation.error.issues[0].message }); return; }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}${customerAuthHref(redirectTarget, location.search, 'reset')}`,
        });
        if (error) { setErrorMessage('Nulstillingslinket kunne ikke sendes. Prøv igen om et øjeblik.'); return; }
        setNotice('Hvis emailadressen er tilknyttet en konto, har vi sendt et link til nulstilling. Tjek din indbakke og spammappe.');
        return;
      }
      const validation = authSchema.safeParse({ email: email.trim(), password });
      if (!validation.success) {
        setFieldErrors(Object.fromEntries(validation.error.issues.map((issue) => [issue.path[0], issue.message])));
        return;
      }
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setErrorMessage(error.message.toLowerCase().includes('email not confirmed')
            ? 'Bekræft din email først. Tjek din indbakke og spammappe, og prøv derefter igen.'
            : error.message.includes('Invalid login credentials') ? 'Email eller adgangskode er forkert. Prøv igen.'
              : 'Du kunne ikke logges ind. Prøv igen om et øjeblik.');
        }
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
        options: { emailRedirectTo: `${window.location.origin}${customerAuthHref(redirectTarget, location.search)}` },
      });
      if (error) {
        setErrorMessage(error.message.includes('already registered')
          ? 'Denne email er allerede registreret. Log ind eller nulstil din adgangskode.'
          : 'Kontoen kunne ikke oprettes. Prøv igen om et øjeblik.');
        return;
      }
      if (data.user && !data.session && (data.user.identities ?? []).length === 0) {
        setErrorMessage('Denne email er allerede registreret eller afventer bekræftelse. Log ind eller nulstil din adgangskode.');
        return;
      }
      if (!data.session) {
        setNotice('Din konto er oprettet. Åbn bekræftelseslinket i din email. Derefter er du klar til at logge ind.');
        setPassword('');
      }
    } catch {
      setErrorMessage('Vi kunne ikke oprette forbindelse. Dine oplysninger er bevaret. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  const title = isRecoveryMode ? 'Vælg ny adgangskode' : isForgotPassword ? 'Glemt adgangskode?' : isLogin ? 'Velkommen tilbage' : 'Opret din kundekonto';
  const description = isRecoveryMode ? 'Vælg en ny adgangskode til din konto.' : isForgotPassword ? 'Indtast din email, så hjælper vi dig videre.' : isLogin ? 'Log ind for at følge dine ordrer og fortsætte dine designs.' : 'Saml dine bestillinger, filer og oplysninger ét sted.';
  const fieldError = (field: string) => fieldErrors[field] && <p id={`auth-error-${field}`} className="account-field-error">{fieldErrors[field]}</p>;

  return (
    <div className="customer-auth-page min-h-screen flex flex-col">
      <Header />
      <main className="customer-auth-main">
        <Link className="customer-auth-back" to={customerLink('/', location.search)}><ArrowLeft className="h-4 w-4" />Tilbage til webshoppen</Link>
        <div className="customer-auth-layout">
          <section className="customer-auth-intro" aria-label="Din kundekonto">
            <span className="customer-auth-eyebrow">DIN KONTO HOS {shopName}</span>
            <h1>Fra første idé<br />{' '}til færdigt tryk.</h1>
            <p>Her har du overblikket over dine bestillinger – og en direkte vej til os, når du har brug for hjælp.</p>
            <ul><li><Package aria-hidden="true" /><div><strong>Følg dine ordrer</strong><span>Se status og beskeder fra trykkeriet.</span></div></li><li><FolderOpen aria-hidden="true" /><div><strong>Hold styr på dine filer</strong><span>Find dine designs og upload en rettet trykfil.</span></div></li><li><ShieldCheck aria-hidden="true" /><div><strong>Klar til næste bestilling</strong><span>Gem kontaktoplysninger og leveringsadresser.</span></div></li></ul>
          </section>
          <section className="customer-auth-form customer-account-forms" aria-labelledby="auth-title">
            {recoverySaved ? <div className="customer-auth-complete"><CheckCircle2 className="h-9 w-9" /><h2 id="auth-title">Din adgangskode er opdateret</h2><p>Du er klar til at fortsætte til din konto.</p><Button asChild className="account-primary-button"><Link to={redirectTarget}>Fortsæt<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div> : <>
              <h2 id="auth-title">{title}</h2><p className="customer-auth-description">{description}</p>
              {notice ? <div className="account-form-notice account-form-notice--success" role="status"><Mail className="mb-3 h-6 w-6" /><p>{notice}</p><Button type="button" variant="outline" className="mt-4" onClick={() => changeView('login')}>Til log ind</Button></div> : (
                <form onSubmit={handleSubmit} className="customer-auth-fields">
                  {!isRecoveryMode && <div className="account-field"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="din@email.dk" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} required disabled={loading} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'auth-error-email' : undefined} />{fieldError('email')}</div>}
                  {!isForgotPassword && !isRecoveryMode && <div className="account-field"><Label htmlFor="auth-password">Adgangskode</Label><Input id="auth-password" name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={100} required disabled={loading} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'auth-error-password' : undefined} />{fieldError('password')}{!isLogin && <p className="account-field-help">Mindst 6 tegn.</p>}</div>}
                  {isRecoveryMode && <><div className="account-field"><Label htmlFor="auth-reset-password">Ny adgangskode</Label><Input id="auth-reset-password" type="password" autoComplete="new-password" placeholder="Mindst 8 tegn" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} maxLength={100} required disabled={loading} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'auth-error-password' : undefined} />{fieldError('password')}</div><div className="account-field"><Label htmlFor="auth-confirm-password">Gentag adgangskode</Label><Input id="auth-confirm-password" type="password" autoComplete="new-password" value={confirmResetPassword} onChange={(event) => setConfirmResetPassword(event.target.value)} maxLength={100} required disabled={loading} aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={fieldErrors.confirmPassword ? 'auth-error-confirmPassword' : undefined} />{fieldError('confirmPassword')}</div></>}
                  {errorMessage && <p role="alert" className="account-form-notice account-form-notice--error">{errorMessage}</p>}
                  {isLogin && <button type="button" onClick={() => changeView('forgot')} className="customer-auth-text-button customer-auth-forgot" disabled={loading}>Glemt adgangskode?</button>}
                  <Button type="submit" className="w-full account-primary-button" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isRecoveryMode ? 'Gem ny adgangskode' : isForgotPassword ? 'Send nulstillingslink' : isLogin ? 'Log ind' : 'Opret konto'}{!loading && <ArrowRight className="ml-2 h-4 w-4" />}</Button>
                </form>
              )}
              {!notice && <div className="customer-auth-switch">{isLogin && <span>Har du ikke en konto? </span>}<button type="button" className="customer-auth-text-button" disabled={loading} onClick={() => changeView(isRecoveryMode ? 'forgot' : isLogin ? 'signup' : 'login')}>{isRecoveryMode ? 'Bed om et nyt nulstillingslink' : isLogin ? 'Opret konto' : 'Tilbage til log ind'}</button></div>}
            </>}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
