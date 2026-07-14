import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePodSubmitToPrintcom, usePodSyncPrintcomStatus } from "@/lib/pod2/hooks";
import type { PodFulfillmentJob } from "@/lib/pod2/types";
import {
  buildValidationRequest,
  canConfirmRealSubmission,
  classifySupplierResponse,
  groupProductionJobs,
  type PrintcomPaymentMethod,
  type SupplierResponseClassification,
} from "@/lib/print-production/orderSubmission";
import { classifyOrder } from "@/lib/print-production/readiness";
import type { PrintProductionSnapshot } from "@/lib/print-production/types";
import { cn } from "@/lib/utils";

interface PrintProductionOrdersProps {
  snapshot: PrintProductionSnapshot;
  onRefetch: () => Promise<void>;
  forceDomain: string | null;
  selectedJobId: string | null;
}

type ValidationRecord = {
  jobId: string;
  jobVersion: string;
  paymentMethod: PrintcomPaymentMethod;
  passed: boolean;
  classification?: SupplierResponseClassification;
  summary: string;
  message?: string;
  payload?: unknown;
  response?: unknown;
};

type UncertainSubmission = {
  jobId: string;
  message: string;
};

const GROUPS = [
  { key: "attention", title: "Kræver handling" },
  { key: "ready", title: "Klar til produktion" },
  { key: "supplier", title: "Hos leverandøren" },
  { key: "completed", title: "Afsluttet" },
  { key: "waiting", title: "Afventer" },
] as const;

const SUBMITTABLE_STATUSES = new Set<PodFulfillmentJob["status"]>([
  "awaiting_approval",
  "paid",
  "processing",
  "submitted",
]);

export function PrintProductionOrders({
  snapshot,
  onRefetch,
  forceDomain,
  selectedJobId,
}: PrintProductionOrdersProps) {
  const submitToPrintcom = usePodSubmitToPrintcom();
  const syncPrintcomStatus = usePodSyncPrintcomStatus();
  const [paymentMethod, setPaymentMethod] = useState<PrintcomPaymentMethod>("invoice");
  const [validation, setValidation] = useState<ValidationRecord | null>(null);
  const [confirmingJob, setConfirmingJob] = useState<PodFulfillmentJob | null>(null);
  const [uncertainSubmission, setUncertainSubmission] = useState<UncertainSubmission | null>(null);
  const [activeOperationJobId, setActiveOperationJobId] = useState<string | null>(null);
  const activeOperationRef = useRef<string | null>(null);
  const groupedJobs = groupProductionJobs(snapshot.jobs);
  const manualFallbackParams = new URLSearchParams();

  if (forceDomain) manualFallbackParams.set("force_domain", forceDomain);
  const manualFallbackHref = `/admin/pod2-ordrer${manualFallbackParams.size ? `?${manualFallbackParams}` : ""}`;

  useEffect(() => {
    if (!validation) return;
    const currentJob = snapshot.jobs.find((job) => job.id === validation.jobId);
    if (!currentJob || currentJob.updated_at !== validation.jobVersion) {
      setValidation(null);
    }
  }, [snapshot.jobs, validation]);

  const beginOperation = (jobId: string): boolean => {
    if (activeOperationRef.current) return false;
    activeOperationRef.current = jobId;
    setActiveOperationJobId(jobId);
    return true;
  };

  const finishOperation = (jobId: string) => {
    if (activeOperationRef.current !== jobId) return;
    activeOperationRef.current = null;
    setActiveOperationJobId(null);
  };

  const handlePaymentMethodChange = (value: PrintcomPaymentMethod) => {
    setPaymentMethod(value);
    setValidation(null);
    setUncertainSubmission(null);
  };

  const handleValidate = async (job: PodFulfillmentJob) => {
    if (!beginOperation(job.id)) return;
    setValidation(null);
    setUncertainSubmission(null);

    try {
      const result: unknown = await submitToPrintcom.mutateAsync(
        buildValidationRequest(job.id, paymentMethod),
      );
      const resultData = asRecord(result);
      const response = resultData.response ?? result;
      setValidation({
        jobId: job.id,
        jobVersion: job.updated_at,
        paymentMethod,
        passed: true,
        classification: classifySupplierResponse(response),
        summary: getValidationSummary(result),
        payload: resultData.payload,
        response,
      });
    } catch (error: unknown) {
      const technicalError = getTechnicalError(error);
      setValidation({
        jobId: job.id,
        jobVersion: job.updated_at,
        paymentMethod,
        passed: false,
        summary: "",
        message: "Kontrollen blev afvist af leverandøren. Gennemgå ordren og kontrollér igen.",
        payload: technicalError.payload,
        response: technicalError.response,
      });
    } finally {
      finishOperation(job.id);
    }
  };

  const canSubmit = (job: PodFulfillmentJob) => canConfirmRealSubmission({
    jobId: job.id,
    status: job.status,
    printcomOrderId: job.printcom_order_id,
    validatedJobId: validation?.jobId,
    validationPassed: validation?.passed === true,
    paymentMethod,
    validatedPaymentMethod: validation?.paymentMethod,
    jobVersion: job.updated_at,
    validatedJobVersion: validation?.jobVersion,
  });

  const handleOpenConfirmation = (job: PodFulfillmentJob) => {
    if (!canSubmit(job) || activeOperationRef.current) return;
    setConfirmingJob(job);
  };

  const handleConfirmSubmission = async () => {
    if (!confirmingJob || !canSubmit(confirmingJob) || !beginOperation(confirmingJob.id)) return;
    const job = confirmingJob;

    try {
      await submitToPrintcom.mutateAsync({
        jobId: job.id,
        paymentMethod,
        dryRun: false,
      });
      setValidation(null);
      setConfirmingJob(null);
      await onRefetch();
    } catch {
      setValidation(null);
      setConfirmingJob(null);
      setUncertainSubmission({
        jobId: job.id,
        message: "Indsendelsen kunne være nået frem til leverandøren. Kontrollér først, om en leverandørordre-reference er gemt, før du gør mere.",
      });

      try {
        await syncPrintcomStatus.mutateAsync({ jobIds: [job.id] });
      } catch {
        // The required data refresh below still gives the operator the current stored state.
      } finally {
        try {
          await onRefetch();
        } catch {
          // Keep the explicit verification instruction visible when refresh is unavailable.
        }
      }
    } finally {
      finishOperation(job.id);
    }
  };

  const handleSync = async () => {
    const syncOperationId = "sync";
    if (!beginOperation(syncOperationId)) return;
    try {
      await syncPrintcomStatus.mutateAsync();
      await onRefetch();
    } finally {
      finishOperation(syncOperationId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Produktionsordrer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kontrollér først. Opret kun en leverandørordre efter en godkendt kontrol.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 text-sm">
            <span className="text-muted-foreground">Betaling</span>
            <select
              value={paymentMethod}
              onChange={(event) => handlePaymentMethodChange(event.target.value as PrintcomPaymentMethod)}
              disabled={Boolean(activeOperationJobId) || Boolean(confirmingJob)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Betalingsmetode til leverandør"
            >
              <option value="invoice">Faktura</option>
              <option value="psp">PSP</option>
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={Boolean(activeOperationJobId)}>
            {activeOperationJobId === "sync" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Opdatér leverandørstatus
          </Button>
        </div>
      </div>

      {uncertainSubmission && (
        <Alert className="rounded-md border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <AlertTitle>Bekræft leverandørordre før nyt forsøg</AlertTitle>
          <AlertDescription>{uncertainSubmission.message}</AlertDescription>
        </Alert>
      )}

      {snapshot.jobs.length === 0 ? (
        <div className="border-y py-10 text-center">
          <ClipboardCheck className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Ingen produktionsordrer endnu</p>
          <p className="mt-1 text-sm text-muted-foreground">Nye jobs vises her, når en butik har oprettet dem.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {GROUPS.map(({ key, title }) => {
            const jobs = groupedJobs[key];
            if (!jobs.length) return null;
            return (
              <section key={key} aria-labelledby={`production-order-group-${key}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 id={`production-order-group-${key}`} className="text-sm font-semibold">{title}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{jobs.length}</span>
                </div>
                <div className="overflow-x-auto border-y">
                  <div className="min-w-[760px] divide-y">
                    {jobs.map((job) => (
                      <OrderRow
                        key={job.id}
                        job={job}
                        tenantLabel={getTenantLabel(snapshot, job.tenant_id)}
                        isSelected={selectedJobId === job.id}
                        isBusy={Boolean(activeOperationJobId)}
                        isCurrentOperation={activeOperationJobId === job.id}
                        canValidate={canValidate(job)}
                        canSubmit={canSubmit(job)}
                        validation={validation?.jobId === job.id ? validation : null}
                        showUncertainInstruction={uncertainSubmission?.jobId === job.id}
                        onValidate={() => handleValidate(job)}
                        onConfirm={() => handleOpenConfirmation(job)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <Link to={manualFallbackHref} className="underline-offset-4 hover:text-foreground hover:underline">
          Avanceret manuel videresendelse
        </Link>
      </div>

      <SubmissionConfirmation
        job={confirmingJob}
        tenantLabel={confirmingJob ? getTenantLabel(snapshot, confirmingJob.tenant_id) : ""}
        paymentMethod={paymentMethod}
        isSubmitting={activeOperationJobId === confirmingJob?.id}
        onOpenChange={(open) => {
          if (!open && !activeOperationJobId) setConfirmingJob(null);
        }}
        onConfirm={handleConfirmSubmission}
      />
    </div>
  );
}

function OrderRow({
  job,
  tenantLabel,
  isSelected,
  isBusy,
  isCurrentOperation,
  canValidate: allowValidation,
  canSubmit: allowSubmission,
  validation,
  showUncertainInstruction,
  onValidate,
  onConfirm,
}: {
  job: PodFulfillmentJob;
  tenantLabel: string;
  isSelected: boolean;
  isBusy: boolean;
  isCurrentOperation: boolean;
  canValidate: boolean;
  canSubmit: boolean;
  validation: ValidationRecord | null;
  showUncertainInstruction: boolean;
  onValidate: () => void;
  onConfirm: () => void;
}) {
  const presentation = classifyOrder(job);
  const validationLabel = validation?.classification?.label;

  return (
    <article className={cn("px-4 py-4", isSelected && "bg-primary/5")}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium" title={job.product_name || "Printordre"}>{job.product_name || "Printordre"}</p>
            <Badge variant={presentation.group === "attention" ? "destructive" : "outline"}>{presentation.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{job.qty} stk. · {job.recipient_name || "Kunde mangler"}</p>
          {job.customer_email && <p className="truncate text-xs text-muted-foreground">{job.customer_email}</p>}
        </div>
        <OrderFact label="Butik" value={tenantLabel} />
        <OrderFact label="Levering" value={job.delivery_summary || job.shipping_method || "Ikke angivet"} />
        <div className="min-w-0 space-y-1">
          <OrderFact label="Fil" value={getFileState(job)} />
          <OrderFact label="Leverandør" value={getSupplierState(job)} />
        </div>
        <div className="flex min-w-[178px] flex-col items-stretch gap-2 xl:items-end">
          {allowValidation && (
            <Button size="sm" variant="outline" onClick={onValidate} disabled={isBusy}>
              {isCurrentOperation ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
              Kontrollér ordre
            </Button>
          )}
          {allowSubmission && (
            <Button size="sm" onClick={onConfirm} disabled={isBusy}>
              <Send aria-hidden="true" />
              Opret leverandørordre
            </Button>
          )}
          {!allowValidation && !allowSubmission && <p className="text-right text-xs text-muted-foreground">{getNextAction(job)}</p>}
          {allowValidation && !allowSubmission && !validation && <p className="text-right text-xs text-muted-foreground">{getNextAction(job)}</p>}
          {validationLabel && <p className="text-right text-xs text-muted-foreground">{validationLabel}</p>}
        </div>
      </div>

      {validation && <ValidationOutcome validation={validation} onRetry={onValidate} isBusy={isBusy} />}
      {showUncertainInstruction && (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
          Vent på opdateringen og kontrollér leverandørstatus, før ordren eventuelt behandles manuelt.
        </p>
      )}
      <TechnicalDetails job={job} validation={validation} />
    </article>
  );
}

function ValidationOutcome({
  validation,
  onRetry,
  isBusy,
}: {
  validation: ValidationRecord;
  onRetry: () => void;
  isBusy: boolean;
}) {
  if (!validation.passed) {
    return (
      <Alert variant="destructive" className="mt-3 rounded-md">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Ordren kan ikke sendes</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{validation.message}</span>
          <Button size="sm" variant="outline" onClick={onRetry} disabled={isBusy}>Kontrollér igen</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const isManualCheck = validation.classification?.kind === "manual_check";
  return (
    <Alert className={cn(
      "mt-3 rounded-md",
      isManualCheck
        ? "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        : "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
    )}>
      <CheckCircle2 className={cn("h-4 w-4", isManualCheck ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")} aria-hidden="true" />
      <AlertTitle>{validation.classification?.label || "Klar til produktion"}</AlertTitle>
      <AlertDescription>
        {validation.classification?.description} {validation.summary}
      </AlertDescription>
    </Alert>
  );
}

function SubmissionConfirmation({
  job,
  tenantLabel,
  paymentMethod,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: {
  job: PodFulfillmentJob | null;
  tenantLabel: string;
  paymentMethod: PrintcomPaymentMethod;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(job)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret leverandørordre?</DialogTitle>
          <DialogDescription>
            Denne handling opretter en ordre hos Print.com. Den kan ikke gentages automatisk.
          </DialogDescription>
        </DialogHeader>
        {job && (
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <ConfirmationFact label="Leverandør" value="Print.com" />
            <ConfirmationFact label="Butik" value={tenantLabel} />
            <ConfirmationFact label="Modtager" value={job.recipient_name || "Ikke angivet"} />
            <ConfirmationFact label="Forventet leverandørpris" value={formatCurrency(job.tenant_cost, job.currency)} />
            <ConfirmationFact label="Betaling" value={paymentMethod === "invoice" ? "Faktura" : "PSP"} />
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Annullér</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Opret leverandørordre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm" title={value}>{value}</p>
    </div>
  );
}

function ConfirmationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium" title={value}>{value}</dd>
    </div>
  );
}

function TechnicalDetails({ job, validation }: { job: PodFulfillmentJob; validation: ValidationRecord | null }) {
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer select-none underline-offset-4 hover:text-foreground hover:underline">Tekniske detaljer</summary>
      <div className="mt-2 grid gap-3 border-l pl-3 lg:grid-cols-2">
        <div>
          <p className="font-medium text-foreground">Job-ID</p>
          <p className="break-all font-mono">{job.id}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Variantsignatur</p>
          <p className="break-all font-mono">{job.variant_signature}</p>
        </div>
        <RawData label="Kontrol-payload" value={validation?.payload} />
        <RawData label="Leverandørsvar" value={validation?.response ?? job.printcom_order_raw} />
      </div>
    </details>
  );
}

function RawData({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded border bg-muted/40 p-2 font-mono text-[11px] leading-4 text-muted-foreground">
        {formatRawData(value)}
      </pre>
    </div>
  );
}

function canValidate(job: PodFulfillmentJob): boolean {
  return !job.printcom_order_id && (classifyOrder(job).canValidate || SUBMITTABLE_STATUSES.has(job.status));
}

function getTenantLabel(snapshot: PrintProductionSnapshot, tenantId: string): string {
  const tenant = snapshot.tenants.find((candidate) => candidate.id === tenantId);
  return tenant?.domain || tenant?.name || "Ukendt butik";
}

function getFileState(job: PodFulfillmentJob): string {
  if (job.printcom_design_id || job.printcom_printjob_id) return "Registreret hos leverandøren";
  if (job.status === "failed" || job.printcom_last_error) return "Kræver kontrol";
  return "Afventer leverandørkontrol";
}

function getSupplierState(job: PodFulfillmentJob): string {
  if (job.printcom_order_id) return "Ordre registreret";
  if (job.printcom_last_error) return "Seneste forsøg kræver kontrol";
  if (job.status === "submitted") return "Mangler ordre-reference";
  return "Ikke sendt";
}

function getNextAction(job: PodFulfillmentJob): string {
  if (job.status === "completed") return "Ingen handling";
  if (job.status === "processing" || job.printcom_order_id) return "Følg leverandørstatus";
  if (job.status === "awaiting_approval" || job.status === "payment_pending") return "Afventer betaling";
  if (job.status === "failed") return "Gennemgå og kontrollér";
  return "Kontrollér ordre";
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatRawData(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) || "";
  } catch {
    return String(value);
  }
}

function getValidationSummary(result: unknown): string {
  const resultData = asRecord(result);
  const response = asRecord(resultData.response);
  const payload = asRecord(resultData.payload);
  const options = resultData.options
    ?? response.options
    ?? payload.options
    ?? response.configuration;
  const labels = Array.isArray(options)
    ? options.map((option) => {
      if (typeof option === "string") return option;
      if (option && typeof option === "object") {
        const record = asRecord(option);
        return firstTextValue(record.label, record.name, record.value, record.key);
      }
      return "";
    }).filter((label): label is string => typeof label === "string" && label.trim().length > 0).slice(0, 3)
    : [];

  return labels.length
    ? `Valg: ${labels.join(" · ")}.`
    : "Ordregrundlag, levering og fil er valideret.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getTechnicalError(error: unknown): { payload?: unknown; response?: unknown } {
  const record = asRecord(error);
  return { payload: record.payload, response: record.response };
}
