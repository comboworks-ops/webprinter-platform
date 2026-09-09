/**
 * ColorProfilesManager
 * 
 * Admin component for managing ICC color profiles per tenant.
 * Allows upload, listing, and deletion of CMYK output profiles
 * used by the Designer's soft proof mode.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { OUTPUT_PROFILES, SRGB_INPUT_PROFILE } from '@/lib/color/iccProofing';
import { inspectIccProfile, MAX_ICC_PROFILE_BYTES, type IccProfileMetadata } from '@/lib/color/iccValidation';
import { installedRecipeForPath, resolveColorProfile } from '@/lib/color/profileResolver';
import { PRINT_PROCESS_GUIDANCE } from '@/lib/color/profileGuidance';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
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
    const [uploadKind, setUploadKind] = useState<'cmyk_output' | 'rgb_working'>('cmyk_output');
    const [uploadMetadata, setUploadMetadata] = useState<IccProfileMetadata | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [validating, setValidating] = useState(false);
    const uploadValidationVersion = useRef(0);
    const [usageCount, setUsageCount] = useState<number | null>(null);
    const [usageError, setUsageError] = useState<string | null>(null);
    const usageVersion = useRef(0);
    const [selectedMetadata, setSelectedMetadata] = useState<IccProfileMetadata | null>(null);
    const [selectedMetadataError, setSelectedMetadataError] = useState<string | null>(null);
    const [standardStatus, setStandardStatus] = useState<Record<string, { error?: string; source?: string }>>({});

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
            setProfiles((data || []) as unknown as ColorProfile[]);
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
        setUploadFile(null);
        setUploadMetadata(null);
        setUploadError(null);
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

    useEffect(() => {
        const version = ++uploadValidationVersion.current;
        setUploadMetadata(null);
        setUploadError(null);
        if (!uploadFile) { setValidating(false); return; }
        setValidating(true);
        void (async () => {
            try {
                if (uploadFile.size > MAX_ICC_PROFILE_BYTES) throw new Error('ICC-filen må højst fylde 16 MB.');
                const metadata = await inspectIccProfile(await uploadFile.arrayBuffer(), uploadKind === 'cmyk_output'
                    ? { expectedColorSpace: 'CMYK', expectedClass: 'prtr' }
                    : { expectedColorSpace: 'RGB' });
                if (uploadKind === 'rgb_working' && !['mntr', 'scnr', 'spac'].includes(metadata.deviceClass)) {
                    throw new Error('En RGB kilde-/arbejdsprofil skal være en monitor-, input- eller farverumsprofil.');
                }
                if (version === uploadValidationVersion.current) setUploadMetadata(metadata);
            } catch (error) {
                if (version === uploadValidationVersion.current) setUploadError(error instanceof Error ? error.message : 'ICC-profilen kunne ikke valideres.');
            } finally {
                if (version === uploadValidationVersion.current) setValidating(false);
            }
        })();
        return () => { uploadValidationVersion.current++; };
    }, [uploadFile, uploadKind]);

    useEffect(() => {
        if (!tenantId) return;
        let active = true;
        setStandardStatus({});
        void Promise.all(OUTPUT_PROFILES.map(async profile => {
            try {
                const resolved = await resolveColorProfile({ id: profile.id, tenantId });
                if (active) setStandardStatus(previous => ({ ...previous, [profile.id]: { source: resolved.source } }));
            } catch (error) {
                if (active) setStandardStatus(previous => ({ ...previous, [profile.id]: { error: error instanceof Error ? error.message : 'Profilen er ikke klar.' } }));
            }
        }));
        return () => { active = false; };
    }, [tenantId, profiles]);

    const getUsageCount = async (profile: ColorProfile) => {
        const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true })
            .eq('tenant_id', profile.tenant_id).filter('output_color_profile_id', 'eq', profile.id);
        if (error || count === null) throw new Error('Produktbrugen kunne ikke kontrolleres. Profilen er ikke slettet.');
        const recipe = installedRecipeForPath(profile.storage_path);
        let total = count;
        if (recipe) {
            const { count: recipeCount, error: recipeError } = await supabase.from('products').select('id', { count: 'exact', head: true })
                .eq('tenant_id', profile.tenant_id).eq('technical_specs->color_management->>outputProfileId', recipe.id);
            if (recipeError || recipeCount === null) throw new Error('Produktets standardprofilvalg kunne ikke kontrolleres.');
            total += recipeCount;
        }
        const { count: designCount, error: designError } = await supabase.from('designer_saved_designs' as never)
            .select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id)
            .in('editor_json->__webprinterColor->>id', recipe ? [profile.id, recipe.id] : [profile.id]);
        if (designError || designCount === null) throw new Error('Gemte designs kunne ikke kontrolleres. Profilen er ikke slettet.');
        return total + designCount;
    };

    const prepareDelete = async (profile: ColorProfile) => {
        const version = ++usageVersion.current;
        setProfileToDelete(profile);
        setUsageCount(null);
        setUsageError(null);
        setDeleteDialogOpen(true);
        try { const count = await getUsageCount(profile); if (version === usageVersion.current) setUsageCount(count); }
        catch (error) { if (version === usageVersion.current) setUsageError(error instanceof Error ? error.message : 'Brugen kunne ikke kontrolleres.'); }
    };

    // Upload profile
    const handleUpload = async () => {
        if (!uploadFile || !uploadName.trim() || !tenantId || !uploadMetadata || validating) {
            toast.error('Udfyld navn og vælg en fil');
            return;
        }

        try {
            setUploading(true);
            const verifiedMetadata = await inspectIccProfile(await uploadFile.arrayBuffer(), uploadKind === 'cmyk_output'
                ? { expectedColorSpace: 'CMYK', expectedClass: 'prtr' }
                : { expectedColorSpace: 'RGB' });
            if (uploadKind === 'rgb_working' && !['mntr', 'scnr', 'spac'].includes(verifiedMetadata.deviceClass)) {
                throw new Error('Profilklassen passer ikke til en RGB kilde-/arbejdsprofil.');
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Du skal være logget ind');
                return;
            }

            // Generate a unique ID for the profile (used in storage path)
            const profileId = crypto.randomUUID();
            // Immutable checksum-bearing path also recognizes an installed standard recipe.
            const storagePath = `${tenantId}/${profileId}/${verifiedMetadata.sha256}.icc`;

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
                    kind: uploadKind,
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
            setUploadMetadata(null);
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
            // Recheck immediately before deletion; never remove the file of an assigned profile.
            const currentUsage = await getUsageCount(profileToDelete);
            setUsageCount(currentUsage);
            if (currentUsage > 0) throw new Error('Profilen bruges af produkter eller gemte designs. Fjern deres profilvalg før sletning.');
            // Remove metadata first so a rejected database delete cannot leave a broken profile.
            const { error: dbError } = await supabase
                .from('color_profiles' as any)
                .delete()
                .eq('id', profileToDelete.id)
                .eq('tenant_id', profileToDelete.tenant_id)
                .select('id').single();

            if (dbError) throw dbError;
            const { error: storageError } = await supabase.storage.from('color-profiles').remove([profileToDelete.storage_path]);
            if (storageError) toast.warning('Profilen er fjernet fra oversigten, men den ubrugte lagringsfil kunne ikke ryddes op.');

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

    const selectedProfile = profiles.find(profile => profile.id === selectedProfileId) || profiles[0];

    useEffect(() => {
        let active = true;
        setSelectedMetadata(null);
        setSelectedMetadataError(null);
        if (!selectedProfile || !tenantId) return;
        void resolveColorProfile({ id: selectedProfile.id, tenantId, role: selectedProfile.kind === 'rgb_working' ? 'rgb_working' : 'cmyk_output' })
            .then(result => { if (active) setSelectedMetadata(result.metadata); })
            .catch(error => { if (active) setSelectedMetadataError(error instanceof Error ? error.message : 'Profilen kunne ikke valideres.'); });
        return () => { active = false; };
    }, [selectedProfile?.id, tenantId]);

    return (
        <div className="space-y-6 workspace-surface">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Palette className="h-6 w-6" />
                        Farveprofiler
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Farveprofiler, filernes farverum og vejledning til trykmetoden
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
                                <Label>Profilens rolle</Label>
                                <Select value={uploadKind} onValueChange={value => setUploadKind(value as typeof uploadKind)} disabled={uploading}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cmyk_output">CMYK output – tryk / soft proof</SelectItem>
                                        <SelectItem value="rgb_working">RGB kilde- / arbejdsprofil</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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

                        {validating && <p className="text-sm" role="status">Kontrollerer ICC-header, tags og checksum…</p>}
                        {uploadError && <p className="text-sm text-destructive" role="alert">{uploadError}</p>}
                        {uploadMetadata && <div className="text-sm space-y-1 break-all">
                            <p>{uploadMetadata.description || 'ICC-profil'} · {uploadMetadata.colorSpace} · {uploadMetadata.deviceClass} · v{uploadMetadata.version}</p>
                            <p className="text-xs text-muted-foreground">SHA-256: {uploadMetadata.sha256}</p>
                            <p className="text-xs text-muted-foreground">Strukturen er kontrolleret. Dette er ikke en certificering af maskinens kalibrering.</p>
                        </div>}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                                Annuller
                            </Button>
                            <Button onClick={handleUpload} disabled={uploading || validating || !uploadMetadata || !uploadFile || !uploadName.trim()}>
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

            <Card>
                <CardHeader>
                    <CardTitle>Standardprofiler</CardTitle>
                    <CardDescription>Vælg efter leverandørens trykbetingelse. Installation ændrer ingen eksisterende produktvalg.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">{SRGB_INPUT_PROFILE.name} · RGB kilde-/arbejdsrum</p>
                        <p className="text-muted-foreground">{SRGB_INPUT_PROFILE.description}</p>
                    </div>
                    {OUTPUT_PROFILES.map(profile => <div key={profile.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{profile.name}</p>
                            <Badge variant={standardStatus[profile.id]?.source ? 'secondary' : 'outline'}>
                                {!standardStatus[profile.id] ? 'Kontrollerer…' : standardStatus[profile.id].error ? 'Kræver handling' : standardStatus[profile.id].source === 'tenant' ? 'Installeret i butikken' : profile.availability === 'install_required' ? 'Tilgængelig lokalt' : 'Inkluderet'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{profile.description} {profile.usageNote}</p>
                        {standardStatus[profile.id]?.error && <p className="text-sm text-amber-700">{standardStatus[profile.id].error}</p>}
                        {profile.downloadUrl && <div className="flex flex-wrap items-center gap-3 text-sm">
                            <a className="text-primary underline" href={profile.downloadUrl} target="_blank" rel="noreferrer">Hent officiel ICC-fil</a>
                            <Button size="sm" variant="outline" onClick={() => { setUploadName(profile.name); setUploadKind('cmyk_output'); setUploadDescription(profile.description); setUploadFile(null); setUploadDialogOpen(true); }}>Upload til butikken</Button>
                        </div>}
                        <p className="text-xs text-muted-foreground">{profile.licenseNote}</p>
                    </div>)}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Hvilken profil passer til opgaven?</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    {PRINT_PROCESS_GUIDANCE.filter(process => process.id !== 'unspecified').map(process => <div key={process.id} className="text-sm space-y-1">
                        <h3 className="font-medium">{process.label}</h3><p className="text-muted-foreground">{process.guidance}</p>
                    </div>)}
                </CardContent>
            </Card>

            {/* Profiles table and selected profile context */}
            <div className="workspace-split">
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
                                        <TableRow key={profile.id} className={selectedProfile?.id === profile.id ? "workspace-active-row" : ""}>
                                            <TableCell>
                                                <div>
                                                    <button type="button" className="font-medium text-left text-primary hover:underline focus-visible:outline-primary" onClick={() => setSelectedProfileId(profile.id)}>{profile.name}</button>
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
                                                            onClick={() => void prepareDelete(profile)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Slet farveprofil?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Er du sikker på at du vil slette "{profile.name}"?
                                                                Profilen kan kun slettes, når kontrollen ikke finder produkter eller gemte designs, der bruger den.
                                                            </AlertDialogDescription>
                                                            {usageCount === null && !usageError && <p className="text-sm" role="status">Kontrollerer produkter og gemte designs…</p>}
                                                            {usageCount !== null && <p className="text-sm">{usageCount > 0 ? `Profilen bruges i ${usageCount} produktvalg eller gemte designs. Fjern disse valg først.` : 'Ingen profilvalg fundet i de produkter og designs, du har adgang til.'}</p>}
                                                            {usageError && <p className="text-sm text-destructive" role="alert">{usageError}</p>}
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                                                                Annuller
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={handleDelete}
                                                                disabled={deleting || usageCount === null || usageCount > 0 || Boolean(usageError)}
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
            <aside className="workspace-inline-detail" aria-label="Valgt farveprofil">
                {selectedProfile ? <>
                    <h2>{selectedProfile.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedProfile.description || 'Ingen beskrivelse angivet.'}</p>
                    <dl>
                        <div><dt>Type</dt><dd>{KIND_LABELS[selectedProfile.kind]?.label || selectedProfile.kind}</dd></div>
                        <div><dt>Filnavn</dt><dd>{selectedProfile.storage_path.split('/').pop()}</dd></div>
                        <div><dt>Størrelse</dt><dd>{formatFileSize(selectedProfile.file_size_bytes)}</dd></div>
                        <div><dt>Oprettet</dt><dd>{format(new Date(selectedProfile.created_at), 'd. MMM yyyy', { locale: da })}</dd></div>
                        {selectedMetadata && <>
                            <div><dt>ICC</dt><dd>v{selectedMetadata.version} · {selectedMetadata.deviceClass} · {selectedMetadata.colorSpace}/{selectedMetadata.pcs}</dd></div>
                            <div><dt>Profilnavn i filen</dt><dd>{selectedMetadata.description || 'Ikke angivet'}</dd></div>
                            <div><dt>SHA-256</dt><dd className="break-all text-xs">{selectedMetadata.sha256}</dd></div>
                        </>}
                    </dl>
                    {selectedMetadataError && <p className="text-sm text-destructive" role="alert">{selectedMetadataError}</p>}
                </> : <p className="text-sm text-muted-foreground">Upload en profil for at se dens oplysninger.</p>}
            </aside>
            </div>
        </div>
    );
}
