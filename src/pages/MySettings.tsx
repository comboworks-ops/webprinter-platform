import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccountShell, AccountState } from '@/components/account/AccountShell';
import { useCustomerAccount } from '@/components/account/CustomerAccountContext';
import { customerAuthHref } from '@/lib/account/navigation';
import '@/styles/customerAccountForms.css';

const profileSchema = z.object({
  first_name: z.string().trim().max(100, 'Fornavn må højst være 100 tegn'),
  last_name: z.string().trim().max(100, 'Efternavn må højst være 100 tegn'),
  phone: z.string().trim().max(20, 'Telefon må højst være 20 tegn'),
  company: z.string().trim().max(200, 'Virksomhedsnavn må højst være 200 tegn'),
});
type ProfileData = z.infer<typeof profileSchema>;
const emptyProfile: ProfileData = { first_name: '', last_name: '', phone: '', company: '' };

export default function MySettings() {
  const account = useCustomerAccount();
  const location = useLocation();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    setProfile(emptyProfile);
    setDirty(false);
    setSaved(false);
    setSaveError('');
    setResetNotice('');
    setResetError('');
  }, [account.user?.id]);

  useEffect(() => {
    if (!dirty) {
      setProfile({
        first_name: account.profile?.first_name || '',
        last_name: account.profile?.last_name || '',
        phone: account.profile?.phone || '',
        company: account.profile?.company || '',
      });
    }
  }, [account.profile, dirty]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!account.user || saving) return;
    setSaveError('');
    setSaved(false);
    const validation = profileSchema.safeParse(profile);
    if (!validation.success) {
      const errors: Partial<Record<keyof ProfileData, string>> = {};
      for (const issue of validation.error.issues) errors[issue.path[0] as keyof ProfileData] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const { data, error } = await supabase.from('profiles')
        .upsert({ id: account.user.id, ...validation.data })
        .select('id, first_name, last_name, phone, company').single();
      if (error || !data) throw error || new Error('Missing saved profile');
      setProfile({ first_name: data.first_name || '', last_name: data.last_name || '', phone: data.phone || '', company: data.company || '' });
      const refreshed = await account.refetchProfile() as { error?: unknown };
      if (refreshed?.error) {
        setSaveError('Oplysningerne er gemt, men kontoen kunne ikke opdateres. Hent kontoen igen.');
        return;
      }
      setDirty(false);
      setSaved(true);
    } catch {
      setSaveError('Dine oplysninger kunne ikke gemmes og bekræftes. Dine ændringer er bevaret. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!account.user?.email || resetting) return;
    setResetting(true);
    setResetNotice('');
    setResetError('');
    try {
      const callback = customerAuthHref('/min-konto/indstillinger', location.search, 'reset');
      const { error } = await supabase.auth.resetPasswordForEmail(account.user.email, {
        redirectTo: `${window.location.origin}${callback}`,
      });
      if (error) throw error;
      setResetNotice('Vi har sendt et nulstillingslink til din email. Tjek også din spammappe.');
    } catch {
      setResetError('Nulstillingslinket kunne ikke sendes. Prøv igen.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <AccountShell title="Indstillinger" description="Dine kontaktoplysninger, din adgangskode og hjælp til din konto.">
      {account.loading ? <AccountState kind="loading" /> : account.error ? (
        <AccountState kind="error" description={account.error} onRetry={account.retry} />
      ) : account.user ? (
        <div className="customer-account-forms">
          <section className="account-form-section">
            <div className="account-section-intro"><UserRound aria-hidden="true" /><div><h2>Personlige oplysninger</h2><p>Vi bruger dine gemte oplysninger, når du starter en ny bestilling.</p></div></div>
            <form onSubmit={handleSubmit} className="account-profile-form">
              <div className="account-field">
                <Label htmlFor="account-email">Email</Label>
                <Input id="account-email" type="email" value={account.user.email || ''} readOnly className="account-readonly" aria-describedby="account-email-help" />
                <p id="account-email-help" className="account-field-help">Din email bruges til login. Kontakt os, hvis den skal ændres.</p>
              </div>
              <div className="account-field-grid">
                {([
                  ['first_name', 'Fornavn', 'given-name', 'text', 100],
                  ['last_name', 'Efternavn', 'family-name', 'text', 100],
                  ['phone', 'Telefon', 'tel', 'tel', 20],
                  ['company', 'Virksomhed (valgfrit)', 'organization', 'text', 200],
                ] as const).map(([field, label, autocomplete, type, maxLength]) => (
                  <div className="account-field" key={field}>
                    <Label htmlFor={`account-${field}`}>{label}</Label>
                    <Input id={`account-${field}`} type={type} autoComplete={autocomplete} value={profile[field]} maxLength={maxLength} disabled={saving}
                      onChange={(event) => { setProfile((previous) => ({ ...previous, [field]: event.target.value })); setDirty(true); setSaved(false); }}
                      aria-invalid={!!fieldErrors[field]} aria-describedby={fieldErrors[field] ? `error-${field}` : undefined} />
                    {fieldErrors[field] && <p id={`error-${field}`} className="account-field-error">{fieldErrors[field]}</p>}
                  </div>
                ))}
              </div>
              {saveError && <p role="alert" className="account-form-notice account-form-notice--error">{saveError}</p>}
              {saved && <p role="status" className="account-form-notice account-form-notice--success">Dine oplysninger er gemt.</p>}
              <Button type="submit" disabled={saving || !dirty} className="account-primary-button">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {saving ? 'Gemmer…' : 'Gem ændringer'}</Button>
            </form>
          </section>
          <section className="account-form-section">
            <div className="account-section-intro"><LockKeyhole aria-hidden="true" /><div><h2>Adgangskode</h2><p>Få et link til din email, og vælg en ny adgangskode.</p></div></div>
            <Button variant="outline" onClick={handleResetPassword} disabled={resetting}>{resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} {resetting ? 'Sender…' : 'Send nulstillingslink'}</Button>
            {resetNotice && <p role="status" className="account-form-notice account-form-notice--success">{resetNotice}</p>}
            {resetError && <p role="alert" className="account-form-notice account-form-notice--error">{resetError}</p>}
          </section>
          <section className="account-form-section account-help-row">
            <div><h2>Brug for hjælp til din konto?</h2><p>Kontakt os, hvis du vil ændre din email eller anmode om at få din konto slettet.</p></div>
            <Button variant="outline" asChild><Link to={account.link('/kontakt')}>Kontakt os</Link></Button>
          </section>
        </div>
      ) : null}
    </AccountShell>
  );
}
