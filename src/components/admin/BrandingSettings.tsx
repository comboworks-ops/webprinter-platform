import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function BrandingSettings() {
    const [shopName, setShopName] = useState('Min Butik');
    const [primaryColor, setPrimaryColor] = useState('#3b82f6');
    const [logoUrl, setLogoUrl] = useState('');

    const handleSave = () => {
        toast.success('Branding indstillinger gemt');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Branding</h1>
                <p className="text-muted-foreground">Tilpas udseendet af din webshop</p>
            </div>

            {/* Shop Name */}
            <Card>
                <CardHeader>
                    <CardTitle>Shop Navn</CardTitle>
                    <CardDescription>Dit shops navn som vises til kunderne</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="shopName">Navn</Label>
                        <Input
                            id="shopName"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="Dit Trykkeri ApS"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Logo */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Logo
                    </CardTitle>
                    <CardDescription>Upload dit logo (anbefalet størrelse: 200x60px)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-6">
                        <div className="w-48 h-16 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                            ) : (
                                <span className="text-sm text-muted-foreground">Intet logo</span>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Button variant="outline">
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Logo
                            </Button>
                            <p className="text-xs text-muted-foreground">PNG, JPG eller SVG (max 2MB)</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Primary Color */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Primær Farve
                    </CardTitle>
                    <CardDescription>Din shops hovedfarve til knapper og accenter</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="color">Farve</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    id="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-12 h-10 rounded border cursor-pointer"
                                />
                                <Input
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-32 font-mono"
                                    placeholder="#3b82f6"
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <Label>Forhåndsvisning</Label>
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    className="px-4 py-2 rounded-lg text-white font-medium"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Eksempel Knap
                                </button>
                                <span
                                    className="px-3 py-1 rounded-full text-sm font-medium"
                                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                                >
                                    Badge
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Preview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Forhåndsvisning
                    </CardTitle>
                    <CardDescription>Sådan vil din shop se ud for kunderne</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        {/* Mock Header */}
                        <div className="p-4 border-b flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="h-8" />
                                ) : (
                                    <span className="text-xl font-bold">{shopName}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">Produkter</span>
                                <span className="text-sm text-muted-foreground">Om os</span>
                                <button
                                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Log ind
                                </button>
                            </div>
                        </div>
                        {/* Mock Content */}
                        <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 text-center">
                            <h2 className="text-2xl font-bold mb-2">{shopName}</h2>
                            <p className="text-muted-foreground mb-4">Din professionelle trykkeriløsning</p>
                            <button
                                className="px-6 py-3 rounded-lg text-white font-medium"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Se Produkter
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} size="lg">
                    Gem Ændringer
                </Button>
            </div>
        </div>
    );
}

export default BrandingSettings;
