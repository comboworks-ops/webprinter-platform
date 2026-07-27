import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileImage, Loader2, Save, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PHOTOPEA_EXPORT_MARKER,
  PHOTOPEA_ORIGIN,
  type PhotopeaBridgeState,
  type PhotopeaSource,
  buildPhotopeaExportCommand,
  buildPhotopeaIframeUrl,
  buildPhotopeaOutputFileName,
  getPhotopeaOutputBuffer,
  isTrustedPhotopeaMessage,
  reducePhotopeaBridge,
  validatePhotopeaPngOutput,
  validatePhotopeaSource,
} from "@/lib/designer/photopeaBridge";

interface PhotopeaEditorDialogProps {
  initialSource: PhotopeaSource | null;
  onApplyOutput: (input: {
    bytes: ArrayBuffer;
    fileName: string;
    source: PhotopeaSource;
  }) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const INITIAL_BRIDGE_STATE: PhotopeaBridgeState = {
  phase: "waiting-for-photopea",
};

const SOURCE_ACCEPT = [
  ".psd",
  ".psb",
  ".ai",
  ".pdf",
  ".svg",
  ".eps",
  ".indd",
  ".xd",
  ".fig",
  ".xcf",
  ".sketch",
  ".afphoto",
  ".kra",
  ".clip",
  ".sai",
  ".pxd",
  ".cdr",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".bmp",
  ".avif",
  ".heic",
].join(",");

function getStatusCopy(bridgeState: PhotopeaBridgeState): string {
  if (bridgeState.phase === "waiting-for-photopea") return "Starter Photopea…";
  if (bridgeState.phase === "loading-source") return "Åbner filen i Photopea…";
  if (bridgeState.phase === "exporting") return "Henter en sikker PNG-kopi…";
  return "Klar til redigering";
}

export function PhotopeaEditorDialog({
  initialSource,
  onApplyOutput,
  onOpenChange,
  open,
}: PhotopeaEditorDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sourceRef = useRef<PhotopeaSource | null>(null);
  const bridgeStateRef = useRef<PhotopeaBridgeState>(INITIAL_BRIDGE_STATE);
  const [source, setSource] = useState<PhotopeaSource | null>(initialSource);
  const [bridgeState, setBridgeState] = useState<PhotopeaBridgeState>(INITIAL_BRIDGE_STATE);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const iframeUrl = useMemo(() => buildPhotopeaIframeUrl(), []);

  const updateBridgeState = useCallback((nextState: PhotopeaBridgeState) => {
    bridgeStateRef.current = nextState;
    setBridgeState(nextState);
  }, []);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (!open) return;
    const nextSource = initialSource;
    sourceRef.current = nextSource;
    setSource(nextSource);
    setError(null);
    setIsApplying(false);
    updateBridgeState(INITIAL_BRIDGE_STATE);
  }, [initialSource, open, updateBridgeState]);

  const sendSource = useCallback(() => {
    const currentSource = sourceRef.current;
    const targetWindow = iframeRef.current?.contentWindow;
    if (!currentSource || !targetWindow) {
      setError("Kilden kunne ikke sendes til Photopea.");
      return;
    }

    const transferable = currentSource.bytes.slice(0);
    targetWindow.postMessage(transferable, PHOTOPEA_ORIGIN, [transferable]);
  }, []);

  const acceptOutput = useCallback(async (bytes: ArrayBuffer) => {
    const currentSource = sourceRef.current;
    if (!currentSource) {
      setError("Webprinter mangler kilden til det returnerede billede.");
      return;
    }

    const validation = validatePhotopeaPngOutput(bytes);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      await onApplyOutput({
        bytes,
        fileName: buildPhotopeaOutputFileName(currentSource.fileName),
        source: currentSource,
      });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PNG-kopien kunne ikke tilføjes i Webprinter.");
    } finally {
      setIsApplying(false);
    }
  }, [onApplyOutput, onOpenChange]);

  useEffect(() => {
    if (!open || !source) return;

    const handleMessage = (event: MessageEvent) => {
      if (!isTrustedPhotopeaMessage(event, iframeRef.current?.contentWindow || null)) return;

      const output = getPhotopeaOutputBuffer(event.data);
      const eventType = output
        ? "photopea-output"
        : event.data === "done"
          ? "photopea-done"
          : event.data === PHOTOPEA_EXPORT_MARKER
            ? "photopea-export-marker"
            : null;
      if (!eventType) return;

      const transition = reducePhotopeaBridge(bridgeStateRef.current, { type: eventType });
      updateBridgeState(transition.state);

      if (transition.action === "send-source") {
        sendSource();
      } else if (transition.action === "accept-output" && output) {
        void acceptOutput(output);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [acceptOutput, open, sendSource, source, updateBridgeState]);

  const handleFileSelection = useCallback(async (file: File | null) => {
    if (!file) return;

    const validation = validatePhotopeaSource({
      byteLength: file.size,
      fileName: file.name,
      mimeType: file.type,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    const nextSource: PhotopeaSource = {
      bytes: await file.arrayBuffer(),
      fileName: file.name,
      mimeType: file.type,
      origin: "local-file",
    };
    sourceRef.current = nextSource;
    setSource(nextSource);
    setError(null);
    updateBridgeState(INITIAL_BRIDGE_STATE);
  }, [updateBridgeState]);

  const handleExport = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || bridgeStateRef.current.phase !== "ready") return;

    const transition = reducePhotopeaBridge(bridgeStateRef.current, { type: "request-export" });
    updateBridgeState(transition.state);
    if (transition.action === "send-export-command") {
      targetWindow.postMessage(buildPhotopeaExportCommand(), PHOTOPEA_ORIGIN);
    }
  }, [updateBridgeState]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-background px-5 py-4 pr-14">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Avanceret billedredigering
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Pilot
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1">
                Photopea kører isoleret i denne visning. Webprinter tilføjer kun en valideret PNG-kopi.
              </DialogDescription>
            </div>

            {source && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="max-w-64 truncate text-xs text-muted-foreground" title={source.fileName}>
                  {source.fileName}
                </span>
                <span className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  {bridgeState.phase === "ready" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                  {getStatusCopy(bridgeState)}
                </span>
                <Button
                  type="button"
                  onClick={handleExport}
                  disabled={bridgeState.phase !== "ready" || isApplying}
                >
                  {bridgeState.phase === "exporting" || isApplying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Gem kopi i Webprinter
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </DialogHeader>

        {!source ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 p-6">
            <div className="w-full max-w-xl rounded-xl border bg-background p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Vælg en fil til avanceret redigering</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Brug en lokal PSD-, AI-, PDF-, SVG- eller billedfil på højst 75 MB. Filen sendes som bytes
                til den isolerede editor; en storage-URL eller login-token deles ikke.
              </p>
              <Input
                type="file"
                accept={SOURCE_ACCEPT}
                className="mt-5"
                onChange={(event) => void handleFileSelection(event.target.files?.[0] || null)}
              />
              <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Originalen ændres ikke. Det returnerede billede kontrolleres som PNG, før det tilføjes
                som et nyt lag i designet.
              </div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            title="Photopea – avanceret billedredigering"
            className="min-h-0 flex-1 border-0 bg-neutral-900"
            referrerPolicy="no-referrer"
            sandbox="allow-same-origin allow-scripts"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
