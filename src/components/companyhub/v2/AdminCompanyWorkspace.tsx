import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminCompanyWorkspace,
  type CompanyIdentityInput,
} from "@/hooks/useAdminCompanyWorkspace";
import type { CompanyAccount } from "@/lib/company-hub";
import { AdminCompanyCatalog } from "./AdminCompanyCatalog";
import { AdminCompanyMembers } from "./AdminCompanyMembers";
import { AdminCompanyOffices } from "./AdminCompanyOffices";
import { AdminCompanySetupProgress } from "./AdminCompanySetupProgress";

interface AdminCompanyWorkspaceProps {
  tenantId: string;
}

const emptyCompany: CompanyIdentityInput = {
  name: "",
  slug: "",
  industryKey: "",
  contactEmail: "",
  contactPhone: "",
  billingEmail: "",
  logoUrl: "",
  status: "active",
};

function formFromCompany(company: CompanyAccount): CompanyIdentityInput {
  return {
    name: company.name,
    slug: company.slug || "",
    industryKey: company.industry_key || "",
    contactEmail: company.contact_email || "",
    contactPhone: company.contact_phone || "",
    billingEmail: company.billing_email || "",
    logoUrl: company.logo_url || "",
    status: company.status || "active",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ændringen kunne ikke gemmes.";
}

export function AdminCompanyWorkspace({ tenantId }: AdminCompanyWorkspaceProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState("setup");
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyIdentityInput>(emptyCompany);
  const workspace = useAdminCompanyWorkspace(tenantId, selectedCompanyId);

  const companies = workspace.companiesQuery.data || [];
  const offices = workspace.officesQuery.data || [];
  const addresses = workspace.addressesQuery.data || [];
  const members = workspace.membersQuery.data || [];
  const items = workspace.catalogQuery.data || [];
  const metrics = workspace.metricsQuery.data || { templateCount: 0, orderRequestCount: 0 };
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) || null;

  useEffect(() => {
    if (!selectedCompanyId && companies.length) setSelectedCompanyId(companies[0].id);
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (!offices.length) {
      setSelectedOfficeId(null);
      return;
    }
    if (!selectedOfficeId || !offices.some((office) => office.id === selectedOfficeId)) {
      setSelectedOfficeId((offices.find((office) => office.is_default) || offices[0]).id);
    }
  }, [offices, selectedOfficeId]);

  const chooseCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedOfficeId(null);
    setActiveView("setup");
  };

  const openNewCompany = () => {
    setEditingCompanyId(null);
    setCompanyForm(emptyCompany);
    setCompanyDialogOpen(true);
  };

  const openCompany = (company: CompanyAccount) => {
    setEditingCompanyId(company.id);
    setCompanyForm(formFromCompany(company));
    setCompanyDialogOpen(true);
  };

  const saveCompany = async () => {
    try {
      if (editingCompanyId) {
        await workspace.updateCompanyMutation.mutateAsync({ companyId: editingCompanyId, input: companyForm });
        toast.success("Firmaoplysningerne er opdateret");
      } else {
        const company = await workspace.createCompanyMutation.mutateAsync(companyForm);
        setSelectedCompanyId(company.id);
        toast.success("Firmaet er oprettet");
      }
      setCompanyDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (workspace.companiesQuery.isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Indlæser firmaer" />
      </div>
    );
  }

  const locationsSaving = workspace.createOfficeMutation.isPending
    || workspace.updateOfficeMutation.isPending
    || workspace.archiveOfficeMutation.isPending
    || workspace.createAddressMutation.isPending
    || workspace.updateAddressMutation.isPending
    || workspace.archiveAddressMutation.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Kundeportal</p>
          <h1 className="text-2xl font-semibold">Firmahub</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Opsæt firmaer, kontorer, adgang og genbestillingsprodukter i en samlet arbejdsgang.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link to="/company" target="_blank">
            Åbn kundevisning
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-3 lg:border-r lg:pr-6" aria-label="Firmaer">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Kunder</p>
              <h2 className="text-base font-semibold">Firmaer</h2>
            </div>
            <Button variant="outline" size="icon" onClick={openNewCompany} title="Opret firma">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Opret firma</span>
            </Button>
          </div>
          <div className="space-y-1">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  company.id === selectedCompanyId
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => chooseCompany(company.id)}
              >
                <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{company.name}</span>
              </button>
            ))}
          </div>
          {!companies.length && (
            <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
              Opret det første firma for at begynde.
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {selectedCompany ? (
            <>
              <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
                    {selectedCompany.logo_url ? (
                      <img src={selectedCompany.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{selectedCompany.name}</h2>
                    <p className="truncate text-sm text-muted-foreground">
                      {selectedCompany.contact_email || "Kontaktoplysninger mangler"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => openCompany(selectedCompany)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Rediger firma
                </Button>
              </div>

              <AdminCompanySetupProgress
                company={selectedCompany}
                officeCount={offices.length}
                addressCount={addresses.length}
                memberCount={members.filter((member) => member.status !== "disabled").length}
                catalogCount={items.length}
                templateCount={metrics.templateCount}
                orderRequestCount={metrics.orderRequestCount}
              />

              <Tabs value={activeView} onValueChange={setActiveView} className="mt-5">
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
                  <TabsTrigger value="setup" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Overblik</TabsTrigger>
                  <TabsTrigger value="locations" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Kontorer</TabsTrigger>
                  <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Medlemmer</TabsTrigger>
                  <TabsTrigger value="catalog" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Produkter</TabsTrigger>
                </TabsList>

                <TabsContent value="setup" className="mt-0 py-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <button type="button" className="rounded-md border bg-background p-5 text-left transition-colors hover:border-primary/50" onClick={() => setActiveView("locations")}>
                      <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                      <h3 className="mt-4 text-sm font-semibold">Kontorer og adresser</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{offices.length} kontorer · {addresses.length} adresser</p>
                    </button>
                    <button type="button" className="rounded-md border bg-background p-5 text-left transition-colors hover:border-primary/50" onClick={() => setActiveView("members")}>
                      <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                      <h3 className="mt-4 text-sm font-semibold">Medlemmer og godkendelse</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{members.filter((member) => member.status !== "disabled").length} aktive medlemmer</p>
                    </button>
                    <button type="button" className="rounded-md border bg-background p-5 text-left transition-colors hover:border-primary/50" onClick={() => setActiveView("catalog")}>
                      <Package className="h-5 w-5 text-primary" aria-hidden="true" />
                      <h3 className="mt-4 text-sm font-semibold">Produkter og skabeloner</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{items.length} produkter · {metrics.templateCount} skabeloner</p>
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="locations" className="mt-0">
                  <AdminCompanyOffices
                    offices={offices}
                    addresses={addresses}
                    selectedOfficeId={selectedOfficeId}
                    isSaving={locationsSaving}
                    onSelectOffice={setSelectedOfficeId}
                    onCreateOffice={async (input) => {
                      const office = await workspace.createOfficeMutation.mutateAsync(input);
                      setSelectedOfficeId(office.id);
                    }}
                    onUpdateOffice={async (officeId, input) => {
                      await workspace.updateOfficeMutation.mutateAsync({ officeId, input });
                    }}
                    onArchiveOffice={async (officeId) => {
                      await workspace.archiveOfficeMutation.mutateAsync(officeId);
                      if (officeId === selectedOfficeId) setSelectedOfficeId(null);
                    }}
                    onCreateAddress={async (input) => { await workspace.createAddressMutation.mutateAsync(input); }}
                    onUpdateAddress={async (addressId, input) => {
                      await workspace.updateAddressMutation.mutateAsync({ addressId, input });
                    }}
                    onArchiveAddress={async (addressId) => { await workspace.archiveAddressMutation.mutateAsync(addressId); }}
                  />
                </TabsContent>

                <TabsContent value="members" className="mt-0">
                  <AdminCompanyMembers
                    members={members}
                    tenantUsers={workspace.tenantUsersQuery.data || []}
                    offices={offices}
                    isSaving={workspace.saveMemberMutation.isPending || workspace.disableMemberMutation.isPending}
                    onSave={async (input) => { await workspace.saveMemberMutation.mutateAsync(input); }}
                    onDisable={async (userId) => { await workspace.disableMemberMutation.mutateAsync(userId); }}
                  />
                </TabsContent>

                <TabsContent value="catalog" className="mt-0 py-6">
                  <AdminCompanyCatalog
                    items={items}
                    categories={workspace.categoriesQuery.data || []}
                    products={workspace.productCandidatesQuery.data || []}
                    offices={offices}
                    itemOfficeIds={workspace.itemOfficesQuery.data || {}}
                    isSaving={
                      workspace.createCategoryMutation.isPending
                      || workspace.saveCatalogItemMutation.isPending
                      || workspace.archiveCatalogItemMutation.isPending
                    }
                    onCreateCategory={async (input) => { await workspace.createCategoryMutation.mutateAsync(input); }}
                    onSaveItem={async (payload) => { await workspace.saveCatalogItemMutation.mutateAsync(payload); }}
                    onArchiveItem={async (itemId) => { await workspace.archiveCatalogItemMutation.mutateAsync(itemId); }}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed text-center">
              <Building2 className="mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
              <h2 className="text-base font-semibold">Opret det første firma</h2>
              <Button size="sm" className="mt-4 gap-2" onClick={openNewCompany}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Opret firma
              </Button>
            </div>
          )}
        </main>
      </div>

      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingCompanyId ? "Rediger firma" : "Opret firma"}</DialogTitle>
            <DialogDescription>Disse oplysninger vises i firmahubben og kan bruges som skabelondata.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company-name">Firmanavn</Label>
              <Input id="company-name" value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-slug">Kort navn</Label>
              <Input id="company-slug" value={companyForm.slug || ""} onChange={(event) => setCompanyForm({ ...companyForm, slug: event.target.value })} placeholder="firma-navn" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-industry">Branche</Label>
              <Input id="company-industry" value={companyForm.industryKey || ""} onChange={(event) => setCompanyForm({ ...companyForm, industryKey: event.target.value })} placeholder="Ejendomsmægler" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-contact-email">Kontaktmail</Label>
              <Input id="company-contact-email" type="email" value={companyForm.contactEmail || ""} onChange={(event) => setCompanyForm({ ...companyForm, contactEmail: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-billing-email">Faktureringsmail</Label>
              <Input id="company-billing-email" type="email" value={companyForm.billingEmail || ""} onChange={(event) => setCompanyForm({ ...companyForm, billingEmail: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Telefon</Label>
              <Input id="company-phone" value={companyForm.contactPhone || ""} onChange={(event) => setCompanyForm({ ...companyForm, contactPhone: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={companyForm.status || "active"} onValueChange={(status) => setCompanyForm({ ...companyForm, status: status as CompanyAccount["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Klargøring</SelectItem>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="paused">Sat på pause</SelectItem>
                  <SelectItem value="archived">Arkiveret</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company-logo">Logo-URL</Label>
              <Input id="company-logo" value={companyForm.logoUrl || ""} onChange={(event) => setCompanyForm({ ...companyForm, logoUrl: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Annuller</Button>
            <Button onClick={saveCompany} disabled={workspace.createCompanyMutation.isPending || workspace.updateCompanyMutation.isPending}>Gem firma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
