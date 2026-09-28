import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { ADMIN_WORKSPACE_EXIT_EVENT } from "@/lib/admin/workspaceExit";
import { graphicGuideLessons } from "@/components/content/graphicGuideLessons";
import { graphicGuideDetailSections, graphicGuideImageSrc, resolveGraphicGuideSettings, type GraphicGuideLessonEdit, type GraphicGuideSettings } from "@/components/content/graphicGuideSettings";

const imageTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function GraphicGuideEditor() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const context = new URLSearchParams(location.search).get("force_domain") || "";
  const [draft, setDraft] = useState<GraphicGuideSettings | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const loadedKey = useRef("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["graphic-guide-editor", context],
    queryFn: async () => {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) throw new Error("Ingen shop er valgt.");
      const { data: row, error: readError } = await supabase.from("tenants").select("id, name, settings").eq("id", tenantId).maybeSingle();
      if (readError) throw readError;
      if (!row) throw new Error("Shoppen kunne ikke hentes.");
      return row;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    const key = `${context}:${data.id}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setDraft(resolveGraphicGuideSettings((data.settings as Record<string, unknown> | null)?.graphicGuide));
    setPendingFiles({});
    setPreviews({});
  }, [context, data]);

  useEffect(() => () => { Object.values(previews).forEach((url) => URL.revokeObjectURL(url)); }, [previews]);

  const dirty = Boolean(draft && data && (Object.keys(pendingFiles).length > 0
    || JSON.stringify(draft) !== JSON.stringify(resolveGraphicGuideSettings((data.settings as Record<string, unknown> | null)?.graphicGuide))));
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onWorkspaceExit = (event: Event) => {
      if (!window.confirm("Du har ændringer i Grafisk vejledning, som ikke er gemt. Vil du forlade siden?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener(ADMIN_WORKSPACE_EXIT_EVENT, onWorkspaceExit);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener(ADMIN_WORKSPACE_EXIT_EVENT, onWorkspaceExit);
    };
  }, [dirty]);

  const updateTop = (field: keyof Omit<GraphicGuideSettings, "lessons">, value: string) =>
    setDraft((current) => current ? { ...current, [field]: value } : current);
  const updateLesson = (id: string, patch: Partial<GraphicGuideLessonEdit>) =>
    setDraft((current) => current ? { ...current, lessons: { ...current.lessons, [id]: { ...current.lessons[id], ...patch } } } : current);
  const updateDetail = (id: string, patch: Partial<{ title: string; body: string }>) =>
    setDraft((current) => current ? { ...current, detailSections: { ...current.detailSections, [id]: { ...current.detailSections[id], ...patch } } } : current);

  function chooseImage(id: string, file: File | undefined) {
    if (!file) return;
    if (!imageTypes[file.type] || file.size > 5 * 1024 * 1024) {
      toast.error("Vælg PNG, JPG eller WebP på højst 5 MB.");
      return;
    }
    setPendingFiles((current) => ({ ...current, [id]: file }));
    setPreviews((current) => ({ ...current, [id]: URL.createObjectURL(file) }));
  }

  async function save() {
    if (!data || !draft || saving) return;
    if (!draft.heading.trim() || !draft.introduction.trim() || graphicGuideLessons.some(({ id }) => {
      const lesson = draft.lessons[id];
      return !lesson.label.trim() || !lesson.title.trim() || !lesson.description.trim() || !lesson.imageAlt.trim();
    })) {
      toast.error("Udfyld sidens overskrift og de vigtigste felter i alle fem trin.");
      return;
    }
    setSaving(true);
    try {
      const resolution = await resolveAdminTenant();
      if (resolution.tenantId !== data.id) throw new Error("Shop-konteksten er ændret. Genindlæs siden.");
      const next: GraphicGuideSettings = structuredClone(draft);
      for (const [id, file] of Object.entries(pendingFiles)) {
        const path = `branding/${data.id}/graphic-guide/${id}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        next.lessons[id].imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      const { data: latest, error: readError } = await supabase.from("tenants").select("settings").eq("id", data.id).maybeSingle();
      if (readError || !latest) throw readError || new Error("Shoppen kunne ikke hentes.");
      const currentSettings = (latest.settings && typeof latest.settings === "object" && !Array.isArray(latest.settings))
        ? latest.settings as Record<string, unknown> : {};
      const loadedGuide = (data.settings as Record<string, unknown> | null)?.graphicGuide;
      if (JSON.stringify(currentSettings.graphicGuide ?? null) !== JSON.stringify(loadedGuide ?? null)) {
        throw new Error("Vejledningen er ændret i en anden fane. Genindlæs siden før du gemmer.");
      }
      const { data: saved, error: saveError } = await supabase.from("tenants")
        .update({ settings: { ...currentSettings, graphicGuide: next } })
        .eq("id", data.id).select("id, settings").maybeSingle();
      if (saveError || !saved) throw saveError || new Error("Ingen ændring blev gemt.");
      setDraft(next);
      setPendingFiles({});
      setPreviews({});
      queryClient.setQueryData(["graphic-guide-editor", context], { ...data, settings: saved.settings });
      queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
      toast.success("Grafisk vejledning er gemt");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Kunne ikke gemme vejledningen.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || (!draft && !error)) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  if (error || !draft || !data) return <p className="p-6 text-destructive">{error instanceof Error ? error.message : "Vejledningen kunne ikke hentes."}</p>;

  return <div className="workspace-form-page space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Grafisk vejledning</h1><p className="text-muted-foreground">Redigér tekst og referencebilleder for {data.name}. Ændringer vises på shoppens vejledningsside, når du gemmer.</p></div>
      <Button type="button" onClick={save} disabled={saving || !dirty}><Save className="mr-2 h-4 w-4" />{saving ? "Gemmer..." : "Gem ændringer"}</Button>
    </header>
    <Card><CardHeader><CardTitle>Introduktion</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="guide-heading">Overskrift</Label><Input id="guide-heading" value={draft.heading} onChange={(e) => updateTop("heading", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-introduction">Introduktion</Label><Textarea id="guide-introduction" value={draft.introduction} onChange={(e) => updateTop("introduction", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-nav-heading">Overskrift i trinmenu</Label><Input id="guide-nav-heading" value={draft.navHeading} onChange={(e) => updateTop("navHeading", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-nav-note">Hjælpetekst i trinmenu</Label><Textarea id="guide-nav-note" value={draft.navNote} onChange={(e) => updateTop("navNote", e.target.value)} /></div>
    </CardContent></Card>
    {graphicGuideLessons.map((defaultLesson, index) => {
      const lesson = draft.lessons[defaultLesson.id];
      const image = previews[defaultLesson.id] || graphicGuideImageSrc(lesson.imageUrl, defaultLesson.image);
      return <Card key={defaultLesson.id}><CardHeader><CardTitle>Trin {index + 1}: {lesson.label}</CardTitle><CardDescription>Billedet og al tekst i dette trin vises på kundesiden.</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-label`}>Navn i trinmenu</Label><Input id={`${defaultLesson.id}-label`} value={lesson.label} onChange={(e) => updateLesson(defaultLesson.id, { label: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-title`}>Overskrift</Label><Input id={`${defaultLesson.id}-title`} value={lesson.title} onChange={(e) => updateLesson(defaultLesson.id, { title: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-description`}>Forklaring</Label><Textarea id={`${defaultLesson.id}-description`} value={lesson.description} onChange={(e) => updateLesson(defaultLesson.id, { description: e.target.value })} /></div>
        <div className="space-y-3"><Label>Referencebillede</Label><img src={image} alt={lesson.imageAlt} className="w-full max-w-2xl rounded-md border bg-white object-contain" />
          <div className="flex flex-wrap items-center gap-3"><Label htmlFor={`${defaultLesson.id}-image`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 py-2"><Upload className="h-4 w-4" /> Vælg billede</Label><input id={`${defaultLesson.id}-image`} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => chooseImage(defaultLesson.id, e.target.files?.[0])} />
          {(lesson.imageUrl || pendingFiles[defaultLesson.id]) && <Button type="button" variant="outline" onClick={() => { setPendingFiles((current) => { const copy = { ...current }; delete copy[defaultLesson.id]; return copy; }); setPreviews((current) => { const copy = { ...current }; delete copy[defaultLesson.id]; return copy; }); updateLesson(defaultLesson.id, { imageUrl: "" }); }}>Brug standardbillede</Button>}</div>
          <p className="text-sm text-muted-foreground">PNG, JPG eller WebP, højst 5 MB. Billedet erstattes først på kundesiden, når du gemmer.</p>
        </div>
        <div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-alt`}>Billedbeskrivelse til skærmlæsere</Label><Textarea id={`${defaultLesson.id}-alt`} value={lesson.imageAlt} onChange={(e) => updateLesson(defaultLesson.id, { imageAlt: e.target.value })} /></div>
        <div className="grid gap-4 md:grid-cols-2">{lesson.labels.map((label, labelIndex) => <div className="space-y-2" key={labelIndex}><Label htmlFor={`${defaultLesson.id}-label-${labelIndex}`}>Tekst over billede {labelIndex + 1}</Label><Input id={`${defaultLesson.id}-label-${labelIndex}`} value={label} onChange={(e) => { const labels = [...lesson.labels] as [string, string]; labels[labelIndex] = e.target.value; updateLesson(defaultLesson.id, { labels }); }} /></div>)}</div>
        <div className="grid gap-4 md:grid-cols-2">{lesson.tips.map((tip, tipIndex) => <div className="space-y-3" key={tipIndex}><div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-tip-title-${tipIndex}`}>Tip {tipIndex + 1}: overskrift</Label><Input id={`${defaultLesson.id}-tip-title-${tipIndex}`} value={tip.title} onChange={(e) => { const tips = lesson.tips.map((entry) => ({ ...entry })) as GraphicGuideLessonEdit["tips"]; tips[tipIndex].title = e.target.value; updateLesson(defaultLesson.id, { tips }); }} /></div><div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-tip-text-${tipIndex}`}>Tip {tipIndex + 1}: tekst</Label><Textarea id={`${defaultLesson.id}-tip-text-${tipIndex}`} value={tip.text} onChange={(e) => { const tips = lesson.tips.map((entry) => ({ ...entry })) as GraphicGuideLessonEdit["tips"]; tips[tipIndex].text = e.target.value; updateLesson(defaultLesson.id, { tips }); }} /></div></div>)}</div>
        <div className="space-y-2"><Label htmlFor={`${defaultLesson.id}-note`}>Bemærkning under trinnet</Label><Textarea id={`${defaultLesson.id}-note`} value={lesson.note} onChange={(e) => updateLesson(defaultLesson.id, { note: e.target.value })} /></div>
      </CardContent></Card>;
    })}
    <Card><CardHeader><CardTitle>Tekst under trinene</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="guide-template-heading">Overskrift om skabeloner</Label><Input id="guide-template-heading" value={draft.templateHeading} onChange={(e) => updateTop("templateHeading", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-template-text">Om skabeloner</Label><Textarea id="guide-template-text" value={draft.templateText} onChange={(e) => updateTop("templateText", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-detail-heading">Overskrift om særlige filkrav</Label><Input id="guide-detail-heading" value={draft.detailHeading} onChange={(e) => updateTop("detailHeading", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-detail-intro">Introduktion til særlige filkrav</Label><Textarea id="guide-detail-intro" value={draft.detailIntro} onChange={(e) => updateTop("detailIntro", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guide-help-text">Hjælpetekst ved kontaktlink</Label><Input id="guide-help-text" value={draft.helpText} onChange={(e) => updateTop("helpText", e.target.value)} /></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Udførlige råd</CardTitle><CardDescription>Du kan erstatte teksten i hvert udførligt emne. Lad tekstfeltet stå tomt for at beholde den nuværende illustrerede standardvejledning.</CardDescription></CardHeader><CardContent className="space-y-6">
      {graphicGuideDetailSections.map(({ id }) => <div key={id} className="space-y-3 border-t pt-5 first:border-t-0 first:pt-0">
        <div className="space-y-2"><Label htmlFor={`${id}-detail-title`}>Emnets overskrift</Label><Input id={`${id}-detail-title`} value={draft.detailSections[id].title} onChange={(e) => updateDetail(id, { title: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-detail-body`}>Egen tekst (valgfri)</Label><Textarea id={`${id}-detail-body`} rows={5} value={draft.detailSections[id].body} onChange={(e) => updateDetail(id, { body: e.target.value })} placeholder="Tomt felt viser den eksisterende vejledning" /><p className="text-sm text-muted-foreground">Skriver du her, erstatter teksten hele standardindholdet i dette emne. Linjeskift bevares.</p></div>
      </div>)}
    </CardContent></Card>
    <div className="flex justify-end"><Button type="button" onClick={save} disabled={saving || !dirty}><Save className="mr-2 h-4 w-4" />{saving ? "Gemmer..." : "Gem ændringer"}</Button></div>
  </div>;
}
