import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useCompanyWorkspace } from "@/hooks/useCompanyWorkspace";
import {
  canApproveCompanyOrder,
  canManageCompany,
  canPlaceCompanyOrder,
  withCompanyTenantContext,
  type HubItem,
} from "@/lib/company-hub";
import { writeSiteCheckoutSession } from "@/lib/checkout/siteCheckoutSession";
import { CompanyOverview } from "./CompanyOverview";
import { CompanyLocationsView } from "./CompanyLocationsView";
import { CompanyDesignsView } from "./CompanyDesignsView";
import { CompanyAssetLibrary } from "./CompanyAssetLibrary";
import { CompanyHelpView } from "./CompanyHelpView";
import { CompanyOrderRequestsView } from "./CompanyOrderRequestsView";
import { CompanyWorkspaceHeader } from "./CompanyWorkspaceHeader";
import { CompanyWorkspaceNav, type CompanyWorkspaceView } from "./CompanyWorkspaceNav";

export function CompanyWorkspaceShell() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const requestedView = searchParams.get("view") as CompanyWorkspaceView | null;
  const [activeView, setActiveView] = useState<CompanyWorkspaceView>(
    requestedView && ["overview", "products", "designs", "locations", "approvals", "orders", "help"].includes(requestedView)
      ? requestedView
      : "overview",
  );
  const workspace = useCompanyWorkspace({ selectedCompanyId, selectedOfficeId });

  const memberships = workspace.membershipsQuery.data || [];
  const offices = workspace.officesQuery.data || [];
  const addresses = workspace.addressesQuery.data || [];
  const categories = workspace.categoriesQuery.data || [];
  const templates = workspace.templatesQuery.data || [];
  const assets = workspace.assetsQuery.data || [];
  const orderRequests = workspace.orderRequestsQuery.data || [];
  const consultantRequests = workspace.consultantRequestsQuery.data || [];
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

  const handleOpenProduct = (item: HubItem, companyOrderRequestId: string | null = null) => {
    if (!item.product_slug) return;
    writeSiteCheckoutSession({
      companyId: selectedCompanyId,
      companyOfficeId: selectedOfficeId,
      companyCatalogItemId: item.id,
      companyOrderRequestId,
      companyWorkingDesignId: null,
      productId: item.product_id,
      productSlug: item.product_slug,
      quantity: item.default_quantity,
      createdAt: new Date().toISOString(),
    });
    navigate(withCompanyTenantContext(`/produkt/${encodeURIComponent(item.product_slug)}`), {
      state: {
        companyId: selectedCompanyId,
        companyOfficeId: selectedOfficeId,
        companyCatalogItemId: item.id,
        companyOrderRequestId,
        companyDefaultQuantity: item.default_quantity,
        companyDefaultOptions: item.default_options,
        companyWorkingDesignId: null,
      },
    });
  };

  const handleOpenPersonalizedProduct = (item: HubItem, designId: string) => {
    if (!item.product_slug) return;
    const state = {
      companyId: selectedCompanyId,
      companyOfficeId: selectedOfficeId,
      companyCatalogItemId: item.id,
      companyWorkingDesignId: designId,
      productId: item.product_id,
      productSlug: item.product_slug,
      quantity: item.default_quantity,
      createdAt: new Date().toISOString(),
    };
    writeSiteCheckoutSession(state);
    navigate(withCompanyTenantContext(`/produkt/${encodeURIComponent(item.product_slug)}`), { state });
  };

  const handleOpenAsset = async (asset: (typeof assets)[number]) => {
    const popup = window.open("about:blank", "_blank");
    try {
      const url = await workspace.getAssetUrl(asset);
      if (popup) {
        popup.opener = null;
        popup.location.replace(url);
      } else {
        window.location.assign(url);
      }
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : "Filen kunne ikke åbnes.");
    }
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

  const handleViewChange = (value: string) => {
    const view = value as CompanyWorkspaceView;
    setActiveView(view);
    const next = new URLSearchParams(searchParams);
    if (view === "overview") next.delete("view");
    else next.set("view", view);
    setSearchParams(next, { replace: true });
  };

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
        <Tabs value={activeView} onValueChange={handleViewChange}>
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
          <TabsContent value="designs" className="mt-0">
            <CompanyDesignsView
              company={company}
              office={offices.find((office) => office.id === selectedOfficeId) || null}
              items={items}
              bindings={templates}
              canPersonalize={canPlaceCompanyOrder(company.membership_role)}
              isSaving={workspace.createWorkingDesignMutation.isPending}
              onCreateWorkingDesign={async (bindingId, values) => {
                const result = await workspace.createWorkingDesignMutation.mutateAsync({ bindingId, values });
                return result.designId;
              }}
              onContinue={handleOpenPersonalizedProduct}
            />
            <div className="border-t">
              <CompanyAssetLibrary
                assets={assets}
                offices={offices}
                canUpload={canPlaceCompanyOrder(company.membership_role)}
                canArchive={canManageCompany(company.membership_role)}
                isSaving={workspace.uploadAssetMutation.isPending || workspace.archiveAssetMutation.isPending}
                onUpload={async (input) => { await workspace.uploadAssetMutation.mutateAsync(input); }}
                onOpen={handleOpenAsset}
                onArchive={async (assetId) => { await workspace.archiveAssetMutation.mutateAsync(assetId); }}
              />
            </div>
          </TabsContent>
          <TabsContent value="approvals" className="mt-0">
            <CompanyOrderRequestsView
              mode="approvals"
              requests={orderRequests}
              items={items}
              canApprove={canApproveCompanyOrder(company.membership_role)}
              isSaving={workspace.decideOrderRequestMutation.isPending}
              onDecision={async (requestId, approve) => { await workspace.decideOrderRequestMutation.mutateAsync({ requestId, approve }); }}
              onOpenProduct={handleOpenProduct}
            />
          </TabsContent>
          <TabsContent value="orders" className="mt-0">
            <CompanyOrderRequestsView
              mode="orders"
              requests={orderRequests}
              items={items}
              canApprove={canApproveCompanyOrder(company.membership_role)}
              isSaving={workspace.decideOrderRequestMutation.isPending}
              onDecision={async (requestId, approve) => { await workspace.decideOrderRequestMutation.mutateAsync({ requestId, approve }); }}
              onOpenProduct={handleOpenProduct}
            />
          </TabsContent>
          <TabsContent value="help" className="mt-0">
            <CompanyHelpView
              requests={consultantRequests}
              isSaving={workspace.createConsultantRequestMutation.isPending}
              onCreate={async (input) => { await workspace.createConsultantRequestMutation.mutateAsync(input); }}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
