import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useCompanyWorkspace } from "@/hooks/useCompanyWorkspace";
import { canManageCompany, type HubItem } from "@/lib/company-hub";
import { writeSiteCheckoutSession } from "@/lib/checkout/siteCheckoutSession";
import { CompanyOverview } from "./CompanyOverview";
import { CompanyLocationsView } from "./CompanyLocationsView";
import { CompanyWorkspaceHeader } from "./CompanyWorkspaceHeader";
import { CompanyWorkspaceNav, type CompanyWorkspaceView } from "./CompanyWorkspaceNav";

function withCurrentTenant(path: string): string {
  if (typeof window === "undefined" || !window.location.search) return path;
  return `${path}${window.location.search}`;
}

export function CompanyWorkspaceShell() {
  const navigate = useNavigate();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CompanyWorkspaceView>("overview");
  const workspace = useCompanyWorkspace({ selectedCompanyId, selectedOfficeId });

  const memberships = workspace.membershipsQuery.data || [];
  const offices = workspace.officesQuery.data || [];
  const addresses = workspace.addressesQuery.data || [];
  const categories = workspace.categoriesQuery.data || [];
  const items = workspace.catalogQuery.data || [];

  useEffect(() => {
    if (!selectedCompanyId && memberships.length) {
      setSelectedCompanyId(memberships[0].id);
    }
  }, [memberships, selectedCompanyId]);

  useEffect(() => {
    if (!offices.length) {
      setSelectedOfficeId(null);
      return;
    }
    if (!selectedOfficeId || !offices.some((office) => office.id === selectedOfficeId)) {
      setSelectedOfficeId((offices.find((office) => office.is_default) || offices[0]).id);
    }
  }, [offices, selectedOfficeId]);

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedOfficeId(null);
    setActiveView("overview");
  };

  const handleOpenProduct = (item: HubItem) => {
    if (!item.product_slug) return;
    writeSiteCheckoutSession({
      companyId: selectedCompanyId,
      companyOfficeId: selectedOfficeId,
      companyCatalogItemId: item.id,
      productId: item.product_id,
      productSlug: item.product_slug,
      quantity: item.default_quantity,
      createdAt: new Date().toISOString(),
    });
    navigate(withCurrentTenant(`/produkt/${encodeURIComponent(item.product_slug)}`), {
      state: {
        companyId: selectedCompanyId,
        companyOfficeId: selectedOfficeId,
        companyCatalogItemId: item.id,
        companyDefaultQuantity: item.default_quantity,
        companyDefaultOptions: item.default_options,
        companyWorkingDesignId: null,
      },
    });
  };

  if (workspace.membershipsQuery.isLoading || !selectedCompanyId) {
    if (!workspace.membershipsQuery.isLoading && memberships.length === 0) {
      return (
        <div className="flex min-h-screen flex-col bg-muted/15">
          <Header />
          <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-16">
            <div className="max-w-md text-center">
              <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Ingen firmaadgang</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Din bruger er ikke tilknyttet et firma. Kontakt firmaets administrator eller Webprinter.
              </p>
            </div>
          </main>
          <Footer />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/15">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Indlæser firmahub" />
      </div>
    );
  }

  const company = workspace.selectedMembership || memberships[0];

  return (
    <div className="flex min-h-screen flex-col bg-muted/15">
      <Header />
      <CompanyWorkspaceHeader
        company={company}
        companies={memberships}
        offices={offices}
        selectedOfficeId={selectedOfficeId}
        onCompanyChange={handleCompanyChange}
        onOfficeChange={setSelectedOfficeId}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as CompanyWorkspaceView)}>
          <CompanyWorkspaceNav />
          <TabsContent value="overview" className="mt-0">
            <CompanyOverview
              items={items}
              offices={offices}
              addresses={addresses}
              categories={categories}
              isLoading={workspace.catalogQuery.isLoading}
              onOpenProduct={handleOpenProduct}
            />
          </TabsContent>
          <TabsContent value="products" className="mt-0">
            <CompanyOverview
              items={items}
              offices={offices}
              addresses={addresses}
              categories={categories}
              isLoading={workspace.catalogQuery.isLoading}
              showAllProducts
              onOpenProduct={handleOpenProduct}
            />
          </TabsContent>
          <TabsContent value="locations" className="mt-0">
            <CompanyLocationsView
              offices={offices}
              addresses={addresses}
              selectedOfficeId={selectedOfficeId}
              canManage={canManageCompany(company.membership_role)}
              isSaving={
                workspace.createOfficeMutation.isPending
                || workspace.updateOfficeMutation.isPending
                || workspace.archiveOfficeMutation.isPending
                || workspace.createAddressMutation.isPending
                || workspace.updateAddressMutation.isPending
                || workspace.archiveAddressMutation.isPending
              }
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
                if (selectedOfficeId === officeId) setSelectedOfficeId(null);
              }}
              onCreateAddress={async (input) => {
                await workspace.createAddressMutation.mutateAsync(input);
              }}
              onUpdateAddress={async (addressId, input) => {
                await workspace.updateAddressMutation.mutateAsync({ addressId, input });
              }}
              onArchiveAddress={async (addressId) => {
                await workspace.archiveAddressMutation.mutateAsync(addressId);
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
