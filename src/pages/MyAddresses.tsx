import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MapPin, Plus, Pencil, Trash2, Star, LayoutDashboard, Package, Settings, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useShopSettings } from '@/hooks/useShopSettings';
import { getPageBackgroundStyle } from '@/lib/branding/background';

interface Address {
    id: string;
    label: string | null;
    company_name: string | null;
    first_name: string;
    last_name: string;
    street_address: string;
    street_address_2: string | null;
    postal_code: string;
    city: string;
    country: string;
    phone: string | null;
    is_default: boolean;
}

const emptyAddress: Omit<Address, 'id'> = {
    label: '',
    company_name: '',
    first_name: '',
    last_name: '',
    street_address: '',
    street_address_2: '',
    postal_code: '',
    city: '',
    country: 'Danmark',
    phone: '',
    is_default: false,
};

const sidebarItems = [
    { path: '/min-konto', label: 'Oversigt', icon: LayoutDashboard, end: true },
    { path: '/min-konto/ordrer', label: 'Mine Ordrer', icon: Package },
    { path: '/min-konto/adresser', label: 'Leveringsadresser', icon: MapPin },
    { path: '/min-konto/indstillinger', label: 'Indstillinger', icon: Settings },
];

export default function MyAddresses() {
    const { data: settings } = useShopSettings();
    const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [formData, setFormData] = useState<Omit<Address, 'id'>>(emptyAddress);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/auth?redirect=/min-konto/adresser');
            return;
        }
        setUser(user);
        await fetchAddresses(user.id);
        setLoading(false);
    };

    const fetchAddresses = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('customer_addresses' as any)
                .select('*')
                .eq('user_id', userId)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAddresses((data as Address[]) || []);
        } catch (e) {
            console.error('Error fetching addresses:', e);
            toast.error('Kunne ikke hente adresser');
        }
    };

    const handleOpenDialog = (address?: Address) => {
        if (address) {
            setEditingAddress(address);
            setFormData({
                label: address.label || '',
                company_name: address.company_name || '',
                first_name: address.first_name,
                last_name: address.last_name,
                street_address: address.street_address,
                street_address_2: address.street_address_2 || '',
                postal_code: address.postal_code,
                city: address.city,
                country: address.country,
                phone: address.phone || '',
                is_default: address.is_default,
            });
        } else {
            setEditingAddress(null);
            setFormData({ ...emptyAddress, is_default: addresses.length === 0 });
        }
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!user) return;

        // Validate required fields
        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            toast.error('Udfyld venligst fornavn og efternavn');
            return;
        }
        if (!formData.street_address.trim()) {
            toast.error('Udfyld venligst adresse');
            return;
        }
        if (!formData.postal_code.trim() || !formData.city.trim()) {
            toast.error('Udfyld venligst postnummer og by');
            return;
        }

        setSaving(true);
        try {
            const addressData = {
                user_id: user.id,
                label: formData.label || null,
                company_name: formData.company_name || null,
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                street_address: formData.street_address.trim(),
                street_address_2: formData.street_address_2 || null,
                postal_code: formData.postal_code.trim(),
                city: formData.city.trim(),
                country: formData.country,
                phone: formData.phone || null,
                is_default: formData.is_default,
            };

            if (editingAddress) {
                const { error } = await supabase
                    .from('customer_addresses' as any)
                    .update(addressData)
                    .eq('id', editingAddress.id);

                if (error) throw error;
                toast.success('Adresse opdateret');
            } else {
                const { error } = await supabase
                    .from('customer_addresses' as any)
                    .insert(addressData);

                if (error) throw error;
                toast.success('Adresse tilføjet');
            }

            setDialogOpen(false);
            fetchAddresses(user.id);
        } catch (e) {
            console.error('Error saving address:', e);
            toast.error('Kunne ikke gemme adresse');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingAddress || !user) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('customer_addresses' as any)
                .delete()
                .eq('id', editingAddress.id);

            if (error) throw error;

            toast.success('Adresse slettet');
            setDeleteDialogOpen(false);
            setDialogOpen(false);
            fetchAddresses(user.id);
        } catch (e) {
            console.error('Error deleting address:', e);
            toast.error('Kunne ikke slette adresse');
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (addressId: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('customer_addresses' as any)
                .update({ is_default: true })
                .eq('id', addressId);

            if (error) throw error;
            toast.success('Standardadresse opdateret');
            fetchAddresses(user.id);
        } catch (e) {
            console.error('Error setting default:', e);
            toast.error('Kunne ikke opdatere standardadresse');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1" style={pageBackgroundStyle}>
                <div className="container mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold">Min Konto</h1>
                        <p className="text-muted-foreground mt-1">
                            Administrer dine oplysninger og indstillinger
                        </p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Sidebar */}
                        <aside className="lg:w-64 flex-shrink-0">
                            <nav className="space-y-1 sticky top-24">
                                {sidebarItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.end
                                        ? location.pathname === item.path
                                        : location.pathname.startsWith(item.path);

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="h-5 w-5" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </aside>

                        {/* Main Content */}
                        <div className="flex-1">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <MapPin className="h-5 w-5" />
                                                Leveringsadresser
                                            </CardTitle>
                                            <CardDescription>
                                                Administrer dine leveringsadresser for hurtigere checkout
                                            </CardDescription>
                                        </div>
                                        <Button onClick={() => handleOpenDialog()}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Tilføj adresse
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {addresses.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                            <h3 className="text-lg font-semibold mb-2">Ingen adresser endnu</h3>
                                            <p className="mb-4">Tilføj en leveringsadresse for hurtigere checkout</p>
                                            <Button onClick={() => handleOpenDialog()}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Tilføj din første adresse
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {addresses.map((address) => (
                                                <div
                                                    key={address.id}
                                                    className={cn(
                                                        "p-4 rounded-lg border transition-all relative group",
                                                        address.is_default && "border-primary bg-primary/5 ring-1 ring-primary"
                                                    )}
                                                >
                                                    {/* Actions */}
                                                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!address.is_default && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleSetDefault(address.id)}
                                                                title="Sæt som standard"
                                                            >
                                                                <Star className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleOpenDialog(address)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    {/* Header */}
                                                    <div className="flex items-start justify-between mb-3 pr-20">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold">
                                                                {address.label || 'Leveringsadresse'}
                                                            </p>
                                                            {address.is_default && (
                                                                <Badge className="bg-primary text-primary-foreground">
                                                                    <Check className="h-3 w-3 mr-1" />
                                                                    Standard
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Address details */}
                                                    <div className="text-sm text-muted-foreground space-y-1">
                                                        {address.company_name && (
                                                            <p className="font-medium text-foreground">{address.company_name}</p>
                                                        )}
                                                        <p>{address.first_name} {address.last_name}</p>
                                                        <p>{address.street_address}</p>
                                                        {address.street_address_2 && <p>{address.street_address_2}</p>}
                                                        <p>{address.postal_code} {address.city}</p>
                                                        <p>{address.country}</p>
                                                        {address.phone && <p className="mt-2">Tlf: {address.phone}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />

            {/* Add/Edit Address Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAddress ? 'Rediger adresse' : 'Tilføj ny adresse'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAddress
                                ? 'Opdater oplysningerne for denne adresse'
                                : 'Tilføj en ny leveringsadresse til din konto'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Label */}
                        <div>
                            <Label htmlFor="label">Adressenavn (valgfrit)</Label>
                            <Input
                                id="label"
                                placeholder="f.eks. Hjem, Arbejde, Sommerhus"
                                value={formData.label || ''}
                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            />
                        </div>

                        {/* Company */}
                        <div>
                            <Label htmlFor="company">Virksomhedsnavn (valgfrit)</Label>
                            <Input
                                id="company"
                                placeholder="Virksomhedsnavn"
                                value={formData.company_name || ''}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            />
                        </div>

                        {/* Name */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="first_name">Fornavn *</Label>
                                <Input
                                    id="first_name"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="last_name">Efternavn *</Label>
                                <Input
                                    id="last_name"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* Street Address */}
                        <div>
                            <Label htmlFor="street_address">Adresse *</Label>
                            <Input
                                id="street_address"
                                placeholder="Gadenavn og husnummer"
                                value={formData.street_address}
                                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                                required
                            />
                        </div>

                        {/* Street Address 2 */}
                        <div>
                            <Label htmlFor="street_address_2">Adresse 2 (valgfrit)</Label>
                            <Input
                                id="street_address_2"
                                placeholder="Etage, dør, etc."
                                value={formData.street_address_2 || ''}
                                onChange={(e) => setFormData({ ...formData, street_address_2: e.target.value })}
                            />
                        </div>

                        {/* Postal Code & City */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="postal_code">Postnummer *</Label>
                                <Input
                                    id="postal_code"
                                    value={formData.postal_code}
                                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="city">By *</Label>
                                <Input
                                    id="city"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* Country */}
                        <div>
                            <Label htmlFor="country">Land</Label>
                            <Input
                                id="country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <Label htmlFor="phone">Telefon (valgfrit)</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+45 12345678"
                                value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        {/* Default checkbox */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_default"
                                checked={formData.is_default}
                                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label htmlFor="is_default" className="font-normal cursor-pointer">
                                Brug som standardadresse
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2">
                        {editingAddress && (
                            <Button
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={saving}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Slet
                            </Button>
                        )}
                        <div className="flex-1" />
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            Annuller
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gemmer...
                                </>
                            ) : (
                                editingAddress ? 'Opdater' : 'Tilføj'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Slet adresse?</DialogTitle>
                        <DialogDescription>
                            Er du sikker på, at du vil slette denne adresse? Denne handling kan ikke fortrydes.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
                            Annuller
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Sletter...
                                </>
                            ) : (
                                'Slet adresse'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
