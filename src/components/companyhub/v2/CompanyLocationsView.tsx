import { useState } from "react";
import { Building2, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CompanyAddress,
  CompanyAddressType,
  CompanyOffice,
  CreateCompanyAddressInput,
  CreateCompanyOfficeInput,
  UpdateCompanyAddressInput,
  UpdateCompanyOfficeInput,
} from "@/lib/company-hub";
import { AddressSummary } from "./AddressSummary";

interface CompanyLocationsViewProps {
  offices: CompanyOffice[];
  addresses: CompanyAddress[];
  selectedOfficeId: string | null;
  canManage: boolean;
  isSaving?: boolean;
  onSelectOffice: (officeId: string) => void;
  onCreateOffice: (input: CreateCompanyOfficeInput) => Promise<void>;
  onUpdateOffice: (officeId: string, input: UpdateCompanyOfficeInput) => Promise<void>;
  onArchiveOffice: (officeId: string) => Promise<void>;
  onCreateAddress: (input: CreateCompanyAddressInput) => Promise<void>;
  onUpdateAddress: (addressId: string, input: UpdateCompanyAddressInput) => Promise<void>;
  onArchiveAddress: (addressId: string) => Promise<void>;
}

interface OfficeFormState {
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  isDefault: boolean;
}

interface AddressFormState {
  type: CompanyAddressType;
  label: string;
  recipientName: string;
  companyName: string;
  streetAddress: string;
  streetAddress2: string;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string;
  isDefault: boolean;
}

const emptyOffice: OfficeFormState = {
  name: "",
  code: "",
  email: "",
  phone: "",
  website: "",
  isDefault: false,
};

const emptyAddress: AddressFormState = {
  type: "delivery",
  label: "",
  recipientName: "",
  companyName: "",
  streetAddress: "",
  streetAddress2: "",
  postalCode: "",
  city: "",
  countryCode: "DK",
  phone: "",
  isDefault: false,
};

type ArchiveTarget =
  | { kind: "office"; id: string; label: string }
  | { kind: "address"; id: string; label: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ændringen kunne ikke gemmes.";
}

export function CompanyLocationsView({
  offices,
  addresses,
  selectedOfficeId,
  canManage,
  isSaving,
  onSelectOffice,
  onCreateOffice,
  onUpdateOffice,
  onArchiveOffice,
  onCreateAddress,
  onUpdateAddress,
  onArchiveAddress,
}: CompanyLocationsViewProps) {
  const selectedOffice = offices.find((office) => office.id === selectedOfficeId) || null;
  const inheritedAddresses = addresses.filter((address) => address.office_id === null);
  const officeAddresses = addresses.filter((address) => address.office_id === selectedOfficeId);
  const availableAddresses = [...officeAddresses, ...inheritedAddresses];
  const defaultDelivery = availableAddresses.find(
    (address) => address.is_default && (address.type === "delivery" || address.type === "both"),
  );
  const defaultBilling = availableAddresses.find(
    (address) => address.is_default && (address.type === "billing" || address.type === "both"),
  );
  const addressGroups = [
    {
      key: "delivery",
      label: "Leveringsadresser",
      rows: availableAddresses.filter((address) => address.type === "delivery"),
    },
    {
      key: "billing",
      label: "Faktureringsadresser",
      rows: availableAddresses.filter((address) => address.type === "billing"),
    },
    {
      key: "both",
      label: "Levering og fakturering",
      rows: availableAddresses.filter((address) => address.type === "both"),
    },
  ].filter((group) => group.rows.length > 0);
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<CompanyOffice | null>(null);
  const [officeForm, setOfficeForm] = useState<OfficeFormState>(emptyOffice);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CompanyAddress | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddress);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

  const openNewOffice = () => {
    setEditingOffice(null);
    setOfficeForm({ ...emptyOffice, isDefault: offices.length === 0 });
    setOfficeDialogOpen(true);
  };

  const openOffice = (office: CompanyOffice) => {
    setEditingOffice(office);
    setOfficeForm({
      name: office.name,
      code: office.code || "",
      email: office.email || "",
      phone: office.phone || "",
      website: office.website || "",
      isDefault: office.is_default,
    });
    setOfficeDialogOpen(true);
  };

  const saveOffice = async () => {
    try {
      if (editingOffice) {
        await onUpdateOffice(editingOffice.id, officeForm);
        toast.success("Kontoret er opdateret");
      } else {
        await onCreateOffice(officeForm);
        toast.success("Kontoret er oprettet");
      }
      setOfficeDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const openNewAddress = () => {
    setEditingAddress(null);
    setAddressForm({ ...emptyAddress, isDefault: officeAddresses.length === 0 });
    setAddressDialogOpen(true);
  };

  const openAddress = (address: CompanyAddress) => {
    setEditingAddress(address);
    setAddressForm({
      type: address.type,
      label: address.label,
      recipientName: address.recipient_name,
      companyName: address.company_name || "",
      streetAddress: address.street_address,
      streetAddress2: address.street_address_2 || "",
      postalCode: address.postal_code,
      city: address.city,
      countryCode: address.country_code,
      phone: address.phone || "",
      isDefault: address.is_default,
    });
    setAddressDialogOpen(true);
  };

  const saveAddress = async () => {
    const countryCode = addressForm.countryCode.trim().toUpperCase();
    const postalCode = addressForm.postalCode.trim();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      toast.error("Landekoden skal bestå af to bogstaver.");
      return;
    }
    if (countryCode === "DK" && !/^\d{4}$/.test(postalCode)) {
      toast.error("Et dansk postnummer skal bestå af fire cifre.");
      return;
    }

    try {
      const input = {
        ...addressForm,
        countryCode,
        postalCode,
        officeId: selectedOfficeId,
      };
      if (editingAddress) {
        await onUpdateAddress(editingAddress.id, input);
        toast.success("Adressen er opdateret");
      } else {
        await onCreateAddress(input);
        toast.success("Adressen er oprettet");
      }
      setAddressDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      if (archiveTarget.kind === "office") {
        await onArchiveOffice(archiveTarget.id);
        toast.success("Kontoret er arkiveret");
      } else {
        await onArchiveAddress(archiveTarget.id);
        toast.success("Adressen er arkiveret");
      }
      setArchiveTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="grid gap-8 py-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="space-y-3 lg:border-r lg:pr-6" aria-label="Firmaets kontorer">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Lokationer</p>
            <h2 className="text-lg font-semibold">Kontorer</h2>
          </div>
          {canManage && (
            <Button variant="outline" size="icon" onClick={openNewOffice} title="Opret kontor">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Opret kontor</span>
            </Button>
          )}
        </div>

        <div className="space-y-1">
          {offices.map((office) => (
            <button
              key={office.id}
              type="button"
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                office.id === selectedOfficeId
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
              onClick={() => onSelectOffice(office.id)}
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{office.name}</span>
              {office.is_default && <span className="text-[10px] opacity-75">Standard</span>}
            </button>
          ))}
        </div>

        {!offices.length && (
          <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Intet kontor er oprettet.
          </div>
        )}
      </aside>

      <section aria-labelledby="selected-office-heading" className="min-w-0 space-y-8">
        {selectedOffice ? (
          <>
            <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="selected-office-heading" className="text-xl font-semibold">{selectedOffice.name}</h2>
                  {selectedOffice.code && (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{selectedOffice.code}</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {selectedOffice.email && (
                    <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{selectedOffice.email}</span>
                  )}
                  {selectedOffice.phone && (
                    <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{selectedOffice.phone}</span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openOffice(selectedOffice)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Rediger
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setArchiveTarget({ kind: "office", id: selectedOffice.id, label: selectedOffice.name })}
                  >
                    Arkivér
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Forsendelse</p>
                  <h3 className="text-base font-semibold">Adresser</h3>
                </div>
                {canManage && (
                  <Button size="sm" className="gap-2" onClick={openNewAddress}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Tilføj adresse
                  </Button>
                )}
              </div>

              {availableAddresses.length > 0 && (
                <div className="grid divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="py-3 sm:pr-5">
                    <p className="text-xs font-medium text-muted-foreground">Standardlevering</p>
                    <p className="mt-1 text-sm font-medium">{defaultDelivery?.label || "Ikke valgt"}</p>
                  </div>
                  <div className="py-3 sm:pl-5">
                    <p className="text-xs font-medium text-muted-foreground">Standardfakturering</p>
                    <p className="mt-1 text-sm font-medium">{defaultBilling?.label || "Ikke valgt"}</p>
                  </div>
                </div>
              )}

              {addressGroups.map((group) => (
                <section key={group.key} aria-labelledby={`address-group-${group.key}`} className="space-y-3">
                  <h4 id={`address-group-${group.key}`} className="text-sm font-semibold">{group.label}</h4>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {group.rows.map((address) => {
                      const inherited = address.office_id === null;
                      return (
                        <AddressSummary
                          key={address.id}
                          address={address}
                          inherited={inherited}
                          canManage={canManage}
                          onEdit={openAddress}
                          onArchive={(row) => setArchiveTarget({ kind: "address", id: row.id, label: row.label })}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              {!availableAddresses.length && (
                <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed text-center">
                  <MapPin className="mb-2 h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-sm font-medium">Ingen adresser endnu</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed text-center">
            <Building2 className="mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
            <h2 className="text-base font-semibold">Vælg eller opret et kontor</h2>
          </div>
        )}
      </section>

      <Dialog open={officeDialogOpen} onOpenChange={setOfficeDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingOffice ? "Rediger kontor" : "Opret kontor"}</DialogTitle>
            <DialogDescription>Kontorets oplysninger kan bruges i godkendte skabeloner og leveringsvalg.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="office-name">Kontornavn</Label>
              <Input id="office-name" value={officeForm.name} onChange={(event) => setOfficeForm({ ...officeForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-code">Kontorkode</Label>
              <Input id="office-code" value={officeForm.code} onChange={(event) => setOfficeForm({ ...officeForm, code: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-phone">Telefon</Label>
              <Input id="office-phone" value={officeForm.phone} onChange={(event) => setOfficeForm({ ...officeForm, phone: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="office-email">E-mail</Label>
              <Input id="office-email" type="email" value={officeForm.email} onChange={(event) => setOfficeForm({ ...officeForm, email: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="office-website">Webadresse</Label>
              <Input id="office-website" value={officeForm.website} onChange={(event) => setOfficeForm({ ...officeForm, website: event.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={officeForm.isDefault} onCheckedChange={(checked) => setOfficeForm({ ...officeForm, isDefault: checked === true })} />
              Brug som standardkontor
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfficeDialogOpen(false)}>Annuller</Button>
            <Button onClick={saveOffice} disabled={isSaving}>Gem kontor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingAddress ? "Rediger adresse" : "Tilføj adresse"}</DialogTitle>
            <DialogDescription>Adressen bliver tilgængelig som leverings- eller faktureringsadresse for kontoret.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Adressetype</Label>
              <Select value={addressForm.type} onValueChange={(value) => setAddressForm({ ...addressForm, type: value as CompanyAddressType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Levering</SelectItem>
                  <SelectItem value="billing">Fakturering</SelectItem>
                  <SelectItem value="both">Begge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-label">Navn</Label>
              <Input id="address-label" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} placeholder="Hovedkontor" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-recipient">Modtager</Label>
              <Input id="address-recipient" value={addressForm.recipientName} onChange={(event) => setAddressForm({ ...addressForm, recipientName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-company">Firmanavn</Label>
              <Input id="address-company" value={addressForm.companyName} onChange={(event) => setAddressForm({ ...addressForm, companyName: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address-street">Adresse</Label>
              <Input id="address-street" value={addressForm.streetAddress} onChange={(event) => setAddressForm({ ...addressForm, streetAddress: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address-street-2">Adresse, linje 2</Label>
              <Input id="address-street-2" value={addressForm.streetAddress2} onChange={(event) => setAddressForm({ ...addressForm, streetAddress2: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-postal">Postnummer</Label>
              <Input id="address-postal" inputMode="numeric" value={addressForm.postalCode} onChange={(event) => setAddressForm({ ...addressForm, postalCode: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-city">By</Label>
              <Input id="address-city" value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-country">Landekode</Label>
              <Input id="address-country" maxLength={2} value={addressForm.countryCode} onChange={(event) => setAddressForm({ ...addressForm, countryCode: event.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-phone">Telefon</Label>
              <Input id="address-phone" value={addressForm.phone} onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={addressForm.isDefault} onCheckedChange={(checked) => setAddressForm({ ...addressForm, isDefault: checked === true })} />
              Brug som standardadresse
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>Annuller</Button>
            <Button onClick={saveAddress} disabled={isSaving}>Gem adresse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivér {archiveTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Elementet fjernes fra aktive valg, men historiske ordrer og referencer bevares.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Arkivér</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
