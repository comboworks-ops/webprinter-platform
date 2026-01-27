/**
 * ColorProfilesManager
 * 
 * Admin component for managing ICC color profiles per tenant.
 * Allows upload, listing, and deletion of CMYK output profiles
 * used by the Designer's soft proof mode.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Trash2, Palette, FileCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

interface ColorProfile {
    id: string;
    tenant_id: string;
    name: string;
    kind: string;
    description: string | null;
    storage_path: string;
    file_size_bytes: number | null;
    created_at: string;
    created_by: string | null;
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
    cmyk_output: { label: 'CMYK Output', color: 'bg-purple-100 text-purple-800' },
    rgb_working: { label: 'RGB Working', color: 'bg-blue-100 text-blue-800' },
    proof_device: { label: 'Proof Device', color: 'bg-green-100 text-green-800' },
};

export default function ColorProfilesManager() {
    const [profiles, setProfiles] = useState<ColorProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<ColorProfile | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Upload form state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    // Fetch profiles on mount
    const fetchProfiles = useCallback(async () => {
        try {
            setLoading(true);
            const { tenantId: tid } = await resolveAdminTenant();
            if (!tid) {
                toast.error('Kunne ikke bestemme tenant');
                return;
            }
            setTenantId(tid);

            const { data, error } = await supabase
                .from('color_profiles' as any)
                .select('*')
                .eq('tenant_id', tid)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProfiles((data || []) as ColorProfile[]);
        } catch (err) {
            console.error('Failed to fetch color profiles:', err);
            toast.error('Kunne ikke hente farveprofiler');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'icc' && ext !== 'icm') {
            toast.error('Kun .icc eller .icm filer er tilladt');
            return;
        }

        // Auto-populate name from filename if empty
        if (!uploadName) {
            const baseName = file.name.replace(/\.(icc|icm)$/i, '');
            setUploadName(baseName);
        }

        setUploadFile(file);
    };

    // Upload profile
    const handleUpload = async () => {
        if (!uploadFile || !uploadName.trim() || !tenantId) {
            toast.error('Udfyld navn og vælg en fil');
            return;
        }

        try {
            setUploading(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Du skal være logget ind');
                return;
            }

            // Generate a unique ID for the profile (used in storage path)
            const profileId = crypto.randomUUID();
            const storagePath = `${tenantId}/${profileId}.icc`;

            // Upload to storage
            const { error: storageError } = await supabase.storage
                .from('color-profiles')
                .upload(storagePath, uploadFile, {
                    contentType: 'application/vnd.iccprofile',
                    upsert: false,
                });

            if (storageError) {
                // Check if bucket doesn't exist
                if (storageError.message.includes('Bucket not found')) {
                    toast.error('Storage bucket "color-profiles" findes ikke. Kontakt administrator.');
                    return;
                }
                throw storageError;
            }

            // Create database record
            const { error: dbError } = await supabase
                .from('color_profiles' as any)
                .insert({
                    id: profileId,
                    tenant_id: tenantId,
                    name: uploadName.trim(),
                    kind: 'cmyk_output', // Currently only supporting CMYK output profiles
                    description: uploadDescription.trim() || null,
                    storage_path: storagePath,
                    file_size_bytes: uploadFile.size,
                    created_by: user.id,
                });

            if (dbError) {
                // Rollback storage upload on DB error
                await supabase.storage.from('color-profiles').remove([storagePath]);
                throw dbError;
            }

            toast.success(`Farveprofil "${uploadName}" uploadet`);
            setUploadDialogOpen(false);
            setUploadName('');
            setUploadDescription('');
            setUploadFile(null);
            fetchProfiles();

        } catch (err: any) {
            console.error('Upload failed:', err);
            toast.error('Upload fejlede: ' + (err.message || 'Ukendt fejl'));
        } finally {
            setUploading(false);
        }
    };

    // Delete profile
    const handleDelete = async () => {
        if (!profileToDelete) return;

        try {
            setDeleting(true);

            // Delete from storage first
            const { error: storageError } = await supabase.storage
                .from('color-profiles')
                .remove([profileToDelete.storage_path]);

            if (storageError) {
                console.warn('Could not delete storage file:', storageError);
                // Continue anyway - file might already be gone
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('color_profiles' as any)
                .delete()
                .eq('id', profileToDelete.id);

            if (dbError) throw dbError;

            toast.success(`Farveprofil "${profileToDelete.name}" slettet`);
            setDeleteDialogOpen(false);
            setProfileToDelete(null);
            fetchProfiles();

        } catch (err: any) {
            console.error('Delete failed:', err);
            toast.error('Sletning fejlede: ' + (err.message || 'Ukendt fejl'));
        } finally {
            setDeleting(false);
        }
    };

    // Format file size
    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Palette className="h-6 w-6" />
                        Farveprofiler
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Administrer ICC farveprofiler til CMYK soft proofing i designeren
                    </p>
                </div>

                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload profil
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload ICC Farveprofil</DialogTitle>
                            <DialogDescription>
                                Upload en .icc eller .icm fil til brug i designerens soft proof funktion.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="profile-name">Navn *</Label>
                                <Input
                                    id="profile-name"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    placeholder="f.eks. ISO Coated v2"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-description">Beskrivelse</Label>
                                <Textarea
                                    id="profile-description"
                                    value={uploadDescription}
                                    onChange={(e) => setUploadDescription(e.target.value)}
                                    placeholder="Valgfri beskrivelse af profilen..."
                                    rows={2}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-file">ICC Fil *</Label>
                                <Input
                                    id="profile-file"
                                    type="file"
                                    accept=".icc,.icm"
                                    onChange={handleFileChange}
                                />
                                {uploadFile && (
                                    <p className="text-sm text-muted-foreground">
                                        Valgt: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                                Annuller
                            </Button>
                            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}>
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Uploader...
                                    </>
                                ) : (
                                    'Upload'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Info card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="flex items-start gap-3 py-4">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Om farveprofiler</p>
                        <p>
                            ICC farveprofiler bruges til at simulere hvordan farver vil se ud når de trykkes i CMYK.
                            Du kan tildele en standard profil til hvert produkt, så designeren automatisk bruger den rette profil.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Profiles table */}
            <Card>
                <CardHeader>
                    <CardTitle>Dine farveprofiler</CardTitle>
                    <CardDescription>
                        {profiles.length === 0
                            ? 'Ingen farveprofiler uploadet endnu'
                            : `${profiles.length} profil${profiles.length === 1 ? '' : 'er'}`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Ingen farveprofiler endnu</p>
                            <p className="text-sm mt-1">Upload din første ICC profil for at komme i gang</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Navn</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Størrelse</TableHead>
                                    <TableHead>Oprettet</TableHead>
                                    <TableHead className="w-[100px]">Handlinger</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {profiles.map((profile) => {
                                    const kindInfo = KIND_LABELS[profile.kind] || { label: profile.kind, color: 'bg-gray-100' };
                                    return (
                                        <TableRow key={profile.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{profile.name}</p>
                                                    {profile.description && (
                                                        <p className="text-sm text-muted-foreground">{profile.description}</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={kindInfo.color}>
                                                    {kindInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatFileSize(profile.file_size_bytes)}</TableCell>
                                            <TableCell>
                                                {format(new Date(profile.created_at), 'd. MMM yyyy', { locale: da })}
                                            </TableCell>
                                            <TableCell>
                                                <AlertDialog open={deleteDialogOpen && profileToDelete?.id === profile.id}>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => {
                                                                setProfileToDelete(profile);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Slet farveprofil?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Er du sikker på at du vil slette "{profile.name}"?
                                                                Produkter der bruger denne profil vil falde tilbage til standard profilen.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                                                                Annuller
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={handleDelete}
                                                                className="bg-red-500 hover:bg-red-600"
                                                            >
                                                                {deleting ? (
                                                                    <>
                                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                        Sletter...
                                                                    </>
                                                                ) : (
                                                                    'Slet'
                                                                )}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
