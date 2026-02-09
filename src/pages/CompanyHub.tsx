import { useState, useEffect } from "react";
import { useCompanyHub } from "@/hooks/useCompanyHub";
import { CompanyHubGrid } from "@/components/companyhub/CompanyHubGrid";
import { CompanyAccount } from "@/components/companyhub/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getPageBackgroundStyle } from "@/lib/branding/background";

export default function CompanyHub() {
    const navigate = useNavigate();
    const { myMembershipsQuery } = useCompanyHub();
    const [selectedCompany, setSelectedCompany] = useState<CompanyAccount | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const { data: settings } = useShopSettings();
    const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);

    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/auth?redirect=/company");
            } else {
                setCurrentUser(user);
                setCheckingAuth(false);
            }
        }
        checkAuth();
    }, [navigate]);

    useEffect(() => {
        // Auto-select if only one company
        if (myMembershipsQuery.data?.length === 1 && !selectedCompany) {
            setSelectedCompany(myMembershipsQuery.data[0]);
        }
    }, [myMembershipsQuery.data, selectedCompany]);

    if (checkingAuth || myMembershipsQuery.isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!myMembershipsQuery.data || myMembershipsQuery.data.length === 0) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-24 flex items-center justify-center text-center" style={pageBackgroundStyle}>
                    <div className="max-w-md space-y-4">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                        <h1 className="text-2xl font-bold">Ingen firma-adgang</h1>
                        <p className="text-muted-foreground italic">
                            Din bruger er ikke tilknyttet nogen firma-konti i dette system.
                            Venligst kontakt administratoren hvis du mener dette er en fejl.
                        </p>
                        <p className="text-[10px] text-muted-foreground bg-muted p-2 rounded border font-mono">
                            Bruger ID: {currentUser?.id}
                        </p>
                        <div className="flex gap-2 justify-center pt-4">
                            <Button variant="outline" onClick={() => navigate("/")}>Forside</Button>
                            <Button variant="default" onClick={() => myMembershipsQuery.refetch()}>
                                <Loader2 className={`mr-2 h-4 w-4 ${myMembershipsQuery.isRefetching ? 'animate-spin' : ''}`} />
                                Opdater
                            </Button>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-8" style={pageBackgroundStyle}>
                {!selectedCompany ? (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="text-center space-y-2">
                            <h1 className="text-3xl font-bold">Vælg Firma</h1>
                            <p className="text-muted-foreground">Du har adgang til flere firma-hubber. Vælg venligst en.</p>
                        </div>
                        <div className="grid gap-4">
                            {myMembershipsQuery.data.map((company) => (
                                <Card
                                    key={company.id}
                                    className="cursor-pointer hover:border-primary transition-colors bg-white"
                                    onClick={() => setSelectedCompany(company)}
                                >
                                    <CardHeader className="flex flex-row items-center gap-4 p-4">
                                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border">
                                            {company.logo_url ? (
                                                <img src={company.logo_url} alt={company.name} className="object-cover w-full h-full" />
                                            ) : (
                                                <Building2 className="h-6 w-6 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-lg">{company.name}</CardTitle>
                                            <CardDescription>Klik for at åbne firma-hub</CardDescription>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden border p-2">
                                    {selectedCompany.logo_url ? (
                                        <img src={selectedCompany.logo_url} alt={selectedCompany.name} className="object-contain w-full h-full" />
                                    ) : (
                                        <Building2 className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">{selectedCompany.name}</h1>
                                    <p className="text-muted-foreground font-medium">Firma B2B Reorder Portal</p>
                                </div>
                            </div>

                            {myMembershipsQuery.data.length > 1 && (
                                <Button variant="ghost" className="gap-2" onClick={() => setSelectedCompany(null)}>
                                    <ArrowLeft className="h-4 w-4" />
                                    Skift firma
                                </Button>
                            )}
                        </div>

                        <CompanyHubGrid company={selectedCompany} />
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
