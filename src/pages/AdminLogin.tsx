import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { customerAuthHref, customerLink } from "@/lib/account/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { z } from "zod";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedUserId, setSubmittedUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { isAdmin, loading: roleLoading, userId: checkedUserId } = useUserRole();
  const checkingAccess = !!submittedUserId && (roleLoading || checkedUserId !== submittedUserId);
  const busy = loading || checkingAccess;
  const accessDenied = !!submittedUserId && !checkingAccess && !isAdmin;

  useEffect(() => {
    if (!roleLoading && isAdmin && (!submittedUserId || checkedUserId === submittedUserId)) {
      navigate(customerLink('/admin', location.search), { replace: true });
    }
  }, [isAdmin, roleLoading, checkedUserId, submittedUserId, navigate, location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErrorMessage("");
    setSubmittedUserId(null);

    const adminAuthSchema = z.object({
      email: z.string().trim().email(t("invalidEmail")),
      password: z.string().min(6, t("passwordMinLength")),
    });
    const validation = adminAuthSchema.safeParse({ email, password });
    if (!validation.success) {
      setErrorMessage(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) throw error;
      if (data.user) setSubmittedUserId(data.user.id);
      else setErrorMessage(t("loginFailed"));
    } catch (error: unknown) {
      console.error("Admin login error:", error);
      setErrorMessage(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t("adminLogin")}</CardTitle>
          <CardDescription>
            {t("accessRestricted")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            {(errorMessage || accessDenied) && <p role="alert" className="text-sm text-destructive">{errorMessage || t("noAdminPrivileges")}</p>}
            {accessDenied && <Button asChild variant="outline" className="w-full"><Link to={customerLink('/min-konto', location.search)}>{t("customerLogin")}</Link></Button>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {checkingAccess ? t("checkingAdminAccess") : t("signingIn")}
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  {t("signInAsAdmin")}
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground space-y-3">
              <div><Link to={customerAuthHref('/min-konto', location.search)} className="hover:text-primary">{t("customerLogin")}</Link></div>
              <Link to={customerLink('/', location.search)} className="hover:text-primary">
                {t("backToHome")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
