import { useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Dashboard } from '@/components/admin/Dashboard';
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
import { TenantOverview } from '@/components/admin/TenantOverview';
import { AdminUpdates } from '@/components/admin/AdminUpdates';
import { TenantUpdates } from '@/components/admin/TenantUpdates';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    const checkAccess = async () => {
      if (!roleLoading && !isAdmin) {
        // If user is logged out (no session), just redirect quietly
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Logged in but no admin role -> Real access denied
          toast.error('Adgang nægtet. Administrator rettigheder påkrævet.');
        }

        navigate('/');
      }
    };

    checkAccess();
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
    <div className="min-h-screen flex flex-col bg-muted/10">
      <SidebarProvider>
        <div className="flex-1 flex w-full">
          <AdminSidebar />

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <AdminHeader />

            <div className="flex-1 p-6 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} /> {/* Changed to Dashboard */}
                <Route path="/products" element={<ProductOverview />} /> {/* Moved ProductOverview to /products */}
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
                {/* Platform Admin Routes */}
                <Route path="/tenants" element={<TenantOverview />} />
                <Route path="/updates" element={<AdminUpdates />} />
                <Route path="/tenant-updates" element={<TenantUpdates />} />
              </Routes>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
