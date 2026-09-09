import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Loader2, MapPin, Plus, Pencil, Trash2, Star, Check } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AccountShell, AccountState } from '@/components/account/AccountShell';
import { useCustomerAccount } from '@/components/account/CustomerAccountContext';
import '@/styles/customerAccountForms.css';

const addressSchema = z.object({
  label: z.string().trim().max(100),
  company_name: z.string().trim().max(200),
  first_name: z.string().trim().min(1, 'Udfyld fornavn').max(100),
  last_name: z.string().trim().min(1, 'Udfyld efternavn').max(100),
  street_address: z.string().trim().min(1, 'Udfyld adresse').max(300),
  street_address_2: z.string().trim().max(300),
  postal_code: z.string().trim().min(1, 'Udfyld postnummer').max(20),
  city: z.string().trim().min(1, 'Udfyld by').max(100),
  country: z.string().trim().min(1, 'Udfyld land').max(100),
  phone: z.string().trim().max(30),
  is_default: z.boolean(),
});
type AddressForm = z.infer<typeof addressSchema>;
type Address = AddressForm & { id: string };
// This existing table is not yet present in the generated database type snapshot.
type AddressDatabase = { public: {
  Tables: { customer_addresses: {
    Row: Address & { user_id: string; created_at: string; updated_at: string };
    Insert: AddressForm & { user_id: string };
    Update: Partial<AddressForm>;
    Relationships: [];
  } };
  Views: Record<string, never>;
  Functions: Record<string, never>;
} };
const addressDb = supabase as unknown as SupabaseClient<AddressDatabase>;
const emptyAddress: AddressForm = { label: '', company_name: '', first_name: '', last_name: '', street_address: '', street_address_2: '', postal_code: '', city: '', country: 'Danmark', phone: '', is_default: false };
const fields = [
  ['label', 'Adressenavn (valgfrit)', 'off', 100],
  ['company_name', 'Virksomhed (valgfrit)', 'organization', 200],
  ['first_name', 'Fornavn', 'given-name', 100],
  ['last_name', 'Efternavn', 'family-name', 100],
  ['street_address', 'Adresse', 'address-line1', 300],
  ['street_address_2', 'Adresse 2 (valgfrit)', 'address-line2', 300],
  ['postal_code', 'Postnummer', 'postal-code', 20],
  ['city', 'By', 'address-level2', 100],
  ['country', 'Land', 'country-name', 100],
  ['phone', 'Telefon (valgfrit)', 'tel', 30],
] as const;

export default function MyAddresses() {
  const account = useCustomerAccount();
  const userId = account.user?.id;
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<AddressForm>(emptyAddress);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const addressesQuery = useQuery({
    queryKey: ['customer-account', 'addresses', userId],
    enabled: !!userId && !account.loading && !account.error,
    retry: false,
    queryFn: async () => {
      const { data, error } = await addressDb.from('customer_addresses').select('*')
        .eq('user_id', userId!).order('is_default', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Address[];
    },
  });
  const addresses = addressesQuery.data || [];

  useEffect(() => {
    setDialogOpen(false);
    setDeleteDialogOpen(false);
    setEditingAddress(null);
    setFormData(emptyAddress);
    setFormError('');
    setActionError('');
    setNotice('');
  }, [userId]);

  const openDialog = (address?: Address) => {
    setEditingAddress(address || null);
    const form = { ...emptyAddress, ...address, is_default: address ? address.is_default : addresses.length === 0 };
    for (const [field] of fields) form[field] = address?.[field] || emptyAddress[field];
    setFormData(form);
    setFieldErrors({});
    setFormError('');
    setDialogOpen(true);
  };

  const finishMutation = async (message: string) => {
    setDialogOpen(false);
    setDeleteDialogOpen(false);
    setNotice(message);
    const result = await addressesQuery.refetch();
    if (result.error) setActionError('Ændringen er gemt, men adresselisten kunne ikke opdateres. Hent listen igen.');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || saving) return;
    setFormError('');
    setActionError('');
    const validation = addressSchema.safeParse(formData);
    if (!validation.success) {
      setFieldErrors(Object.fromEntries(validation.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const table = addressDb.from('customer_addresses');
      const payload = { ...validation.data, user_id: userId };
      const result = editingAddress
        ? await table.update(validation.data).eq('id', editingAddress.id).eq('user_id', userId).select('id').single()
        : await table.insert(payload).select('id').single();
      if (result.error || !result.data) throw result.error || new Error('Missing saved address');
      await finishMutation(editingAddress ? 'Adressen er opdateret.' : 'Adressen er tilføjet.');
    } catch {
      setFormError('Adressen kunne ikke gemmes og bekræftes. Dine oplysninger er bevaret. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAddress || !userId || saving) return;
    setFormError('');
    setSaving(true);
    try {
      const { data, error } = await addressDb.from('customer_addresses').delete()
        .eq('id', editingAddress.id).eq('user_id', userId).select('id').single();
      if (error || !data) throw error || new Error('Missing deleted address');
      await finishMutation('Adressen er slettet.');
    } catch {
      setFormError('Adressen kunne ikke slettes og bekræftes. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!userId || saving) return;
    setActionError('');
    setNotice('');
    setSaving(true);
    try {
      // The existing database trigger maintains one default per user.
      const { data, error } = await addressDb.from('customer_addresses').update({ is_default: true })
        .eq('id', addressId).eq('user_id', userId).select('id, is_default').single();
      if (error || !data) throw error || new Error('Missing updated address');
      await finishMutation('Din standardadresse er opdateret.');
    } catch {
      setActionError('Standardadressen kunne ikke opdateres og bekræftes. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell title="Adresser" description="Gem dine leveringsadresser, så de er klar til din næste bestilling."
      actions={<Button className="account-primary-button" onClick={() => openDialog()} disabled={account.loading || !!account.error || addressesQuery.isPending || addressesQuery.isError || saving}><Plus className="mr-2 h-4 w-4" />Tilføj adresse</Button>}>
      {account.loading ? <AccountState kind="loading" /> : account.error ? <AccountState kind="error" description={account.error} onRetry={account.retry} /> : !userId ? null : addressesQuery.isPending ? <AccountState kind="loading" /> : (
        <div className="customer-account-forms">
          {notice && <p role="status" className="account-form-notice account-form-notice--success">{notice}</p>}
          {(addressesQuery.isError || actionError) && <div role="alert" className="account-form-notice account-form-notice--error"><p>{actionError || 'Dine adresser kunne ikke hentes. Prøv igen.'}</p><Button variant="outline" className="mt-3" onClick={() => { setActionError(''); void addressesQuery.refetch(); }}>Hent adresser igen</Button></div>}
          {!addressesQuery.isError && addresses.length === 0 ? (
            <AccountState kind="empty" title="Din første adresse" description="Tilføj en leveringsadresse. Du kan vælge den, næste gang du bestiller."><Button className="account-primary-button" onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" />Tilføj adresse</Button></AccountState>
          ) : (
            <div className="account-address-grid">
              {addresses.map((address) => (
                <section key={address.id} className={`account-address${address.is_default ? ' account-address--default' : ''}`}>
                  <div className="account-address-heading"><MapPin className="h-5 w-5" aria-hidden="true" /><h2>{address.label || 'Leveringsadresse'}</h2>{address.is_default && <span className="account-address-badge"><Check className="h-3.5 w-3.5" />Standard</span>}</div>
                  <address>{address.company_name && <strong>{address.company_name}</strong>}<span>{address.first_name} {address.last_name}</span><span>{address.street_address}</span>{address.street_address_2 && <span>{address.street_address_2}</span>}<span>{address.postal_code} {address.city}</span><span>{address.country}</span>{address.phone && <span className="mt-2">Tlf. {address.phone}</span>}</address>
                  <div className="account-address-actions"><Button variant="outline" onClick={() => openDialog(address)} disabled={saving} aria-label={`Rediger ${address.label || address.street_address}`}><Pencil className="mr-2 h-4 w-4" />Rediger</Button>{!address.is_default && <Button variant="ghost" onClick={() => handleSetDefault(address.id)} disabled={saving} aria-label={`Brug ${address.label || address.street_address} som standard`}><Star className="mr-2 h-4 w-4" />Brug som standard</Button>}</div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="account-address-dialog max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingAddress ? 'Rediger adresse' : 'Tilføj adresse'}</DialogTitle><DialogDescription>Gem en adresse til dine kommende bestillinger.</DialogDescription></DialogHeader>
          <form onSubmit={handleSave} className="customer-account-forms">
            <div className="account-field-grid">
              {fields.map(([field, label, autocomplete, maxLength]) => (
                <div key={field} className={`account-field${field.startsWith('street_') ? ' account-field--wide' : ''}`}>
                  <Label htmlFor={`address-${field}`}>{label}</Label>
                  <Input id={`address-${field}`} autoComplete={autocomplete} maxLength={maxLength} type={field === 'phone' ? 'tel' : 'text'} value={formData[field]} disabled={saving}
                    required={['first_name', 'last_name', 'street_address', 'postal_code', 'city', 'country'].includes(field)}
                    onChange={(event) => setFormData((previous) => ({ ...previous, [field]: event.target.value }))}
                    aria-invalid={!!fieldErrors[field]} aria-describedby={fieldErrors[field] ? `address-error-${field}` : undefined} />
                  {fieldErrors[field] && <p id={`address-error-${field}`} className="account-field-error">{fieldErrors[field]}</p>}
                </div>
              ))}
            </div>
            <div className="account-default-check"><input type="checkbox" id="address-is-default" checked={formData.is_default} disabled={saving} onChange={(event) => setFormData((previous) => ({ ...previous, is_default: event.target.checked }))} /><Label htmlFor="address-is-default">Brug som standardadresse</Label></div>
            {formError && !deleteDialogOpen && <p role="alert" className="account-form-notice account-form-notice--error">{formError}</p>}
            <DialogFooter className="account-address-dialog-actions">
              {editingAddress && <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={() => { setFormError(''); setDeleteDialogOpen(true); }} disabled={saving}><Trash2 className="mr-2 h-4 w-4" />Slet adresse</Button>}
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuller</Button>
              <Button type="submit" disabled={saving} className="account-primary-button">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Gemmer…' : 'Gem adresse'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!saving) setDeleteDialogOpen(open); }}>
        <DialogContent><DialogHeader><DialogTitle>Slet adresse?</DialogTitle><DialogDescription>{editingAddress?.label || editingAddress?.street_address} fjernes fra dine gemte leveringsadresser. Du kan tilføje den igen senere.</DialogDescription></DialogHeader>
          {formError && <p role="alert" className="account-form-notice account-form-notice--error">{formError}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>Behold adresse</Button><Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Sletter…' : 'Slet adresse'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}
