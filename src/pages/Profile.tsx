import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Building2, Loader2, Package, ArrowRight, Clock, Truck, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getPageBackgroundStyle } from "@/lib/branding/background";

const profileSchema = z.object({
  first_name: z.string().trim().max(100, "First name must be less than 100 characters").optional(),
  last_name: z.string().trim().max(100, "Last name must be less than 100 characters").optional(),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  company: z.string().trim().max(200, "Company name must be less than 200 characters").optional(),
});

type ProfileData = z.infer<typeof profileSchema>;

interface Order {
  id: string;
  order_number: string;
  product_name: string;
  total_price: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Afventer', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  processing: { label: 'Behandles', color: 'bg-blue-100 text-blue-800', icon: Package },
  production: { label: 'Under produktion', color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped: { label: 'Afsendt', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  delivered: { label: 'Leveret', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Annulleret', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
  problem: { label: 'Problem', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const Profile = () => {
  const { data: settings } = useShopSettings();
  const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    phone: "",
    company: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await fetchProfile(session.user.id);
      await fetchRecentOrders(session.user.id);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        await fetchProfile(session.user.id);
        await fetchRecentOrders(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
          company: data.company || "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders' as any)
        .select('id, order_number, product_name, total_price, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentOrders((data as Order[]) || []);
    } catch (error) {
      console.debug('Orders not available yet');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Validate
    const validation = profileSchema.safeParse(profile);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .upsert({
          id: user.id,
          ...validation.data,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
    }).format(price);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen py-12" style={pageBackgroundStyle}>
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("myProfile")}
              </CardTitle>
              <CardDescription>
                {t("personalInfo")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("emailCannotChange")}
                  </p>
                </div>

                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("firstName")}</Label>
                  <Input
                    id="first_name"
                    type="text"
                    value={profile.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    placeholder={t("enterFirstName")}
                    maxLength={100}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("lastName")}</Label>
                  <Input
                    id="last_name"
                    type="text"
                    value={profile.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    placeholder={t("enterLastName")}
                    maxLength={100}
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t("phone")}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder={t("enterPhone")}
                    maxLength={20}
                  />
                </div>

                {/* Company */}
                <div className="space-y-2">
                  <Label htmlFor="company" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {t("company")}
                  </Label>
                  <Input
                    id="company"
                    type="text"
                    value={profile.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    placeholder={t("enterCompany")}
                    maxLength={200}
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("saving")}
                    </>
                  ) : (
                    t("saveChanges")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Orders Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Seneste Ordrer
                  </CardTitle>
                  <CardDescription>
                    Dine seneste bestillinger
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/mine-ordrer">
                    Se alle
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Du har ingen ordrer endnu</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/produkter">Se produkter</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => {
                    const status = statusConfig[order.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    return (
                      <Link
                        key={order.id}
                        to="/mine-ordrer"
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">#{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">{order.product_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                          <p className="text-sm font-medium mt-1">{formatPrice(order.total_price)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Profile;
