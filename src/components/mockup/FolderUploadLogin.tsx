import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrintJourneyDialogContent } from '@/components/storefront/PrintJourneyDialogContent';
import { customerAuthHref } from '@/lib/account/navigation';
import { supabase } from '@/integrations/supabase/client';

/** Sign in without leaving the selected product or starting an order. */
export function FolderUploadLogin({ open, onOpenChange, onSignedIn }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSignedIn: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const authLink = customerAuthHref(window.location.pathname + window.location.search);
  return <Dialog open={open} onOpenChange={value => { setPassword(''); setError(''); onOpenChange(value); }}>
    <PrintJourneyDialogContent className="folder-upload-login sm:max-w-sm">
      <DialogHeader><DialogTitle>Log ind for at uploade</DialogTitle>
        <DialogDescription>Se dit eget design på mappen. Du bliver på produktsiden.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError('');
        try {
          const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (result.error || !result.data.user || result.data.user.is_anonymous) throw new Error();
          setPassword(''); onSignedIn(); onOpenChange(false);
        } catch { setError('Login lykkedes ikke. Kontrollér email og adgangskode, og prøv igen.'); }
        finally { setBusy(false); }
      }}>
        <div className="space-y-1"><Label htmlFor={`${id}-email`}>Email</Label>
          <Input id={`${id}-email`} type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor={`${id}-password`}>Adgangskode</Label>
          <Input id={`${id}-password`} type="password" autoComplete="current-password" required maxLength={100} value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full min-h-11" type="submit" disabled={busy}>{busy ? 'Logger ind…' : 'Log ind'}</Button>
        <div className="flex flex-wrap justify-between gap-3 text-xs">
          <Link to={`${authLink}&mode=forgot`} target="_blank" rel="noopener noreferrer">Glemt adgangskode?</Link>
          <Link to={`${authLink}&mode=signup`} target="_blank" rel="noopener noreferrer">Opret konto</Link>
        </div>
      </form>
    </PrintJourneyDialogContent>
  </Dialog>;
}
