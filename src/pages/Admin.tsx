import { useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ProductOverview } from '@/components/admin/ProductOverview';
import { ProductPriceManager } from '@/components/admin/ProductPriceManager';
import { ProductCreator } from '@/components/admin/ProductCreator';
import { SeoManager } from '@/components/admin/SeoManager';
import { OrderManager } from '@/components/admin/OrderManager';
import AdminMessages from '@/components/admin/AdminMessages';
import DomainSettings from '@/components/admin/DomainSettings';
import BrandingSettings from '@/components/admin/BrandingSettings';
import SubscriptionSettings from '@/components/admin/SubscriptionSettings';
import ShopSettings from '@/components/admin/ShopSettings';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error('Adgang nægtet. Administrator rettigheder påkrævet.');
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <SidebarProvider>
        <div className="flex-1 flex w-full">
          <AdminSidebar />

          <main className="flex-1 p-6 overflow-auto">
            <div className="flex items-center gap-4 mb-6">
              <SidebarTrigger />
            </div>

            <Routes>
              <Route path="/" element={<ProductOverview />} />
              <Route path="/product/:slug" element={<ProductPriceManager />} />
              <Route path="/create-product" element={<ProductCreator />} />
              <Route path="/seo" element={<SeoManager />} />
              <Route path="/kunder" element={<OrderManager />} />
              <Route path="/beskeder" element={<AdminMessages />} />
              {/* Min Konto routes */}
              <Route path="/domaene" element={<DomainSettings />} />
              <Route path="/branding" element={<BrandingSettings />} />
              <Route path="/abonnement" element={<SubscriptionSettings />} />
              <Route path="/indstillinger" element={<ShopSettings />} />
            </Routes>
          </main>
        </div>
      </SidebarProvider>

      <Footer />
    </div>
  );
}
