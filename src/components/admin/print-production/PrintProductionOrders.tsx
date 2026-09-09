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
  Search,
  ArrowDown,
  ArrowUp,
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
import { POD_JOB_STATUS_LABELS, type PodFulfillmentJob } from "@/lib/pod2/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildSubmissionFingerprint,
  buildValidationRequest,
  canReconcileUncertainSubmission,
  canConfirmRealSubmission,
  createSubmissionSessionState,
  getProductionOrderPresentation,
  getValidationOutcomeState,
  interpretDryRunResult,
  isReconciliationBlocked,
  markSubmissionReconciliationRefreshed,
  reconcileUncertainSubmission,
  resolveCurrentJob,
  resolvePendingValidation,
  startUncertainSubmissionReconciliation,
  summarizeDryRunPayload,
  type DryRunInterpretation,
  type PrintcomPaymentMethod,
  type ProductionOrderPresentation,
  type SubmissionSessionState,
  type ValidationBinding,
} from "@/lib/print-production/orderSubmission";
import type { PrintProductionSnapshot } from "@/lib/print-production/types";
import { cn } from "@/lib/utils";

interface PrintProductionOrdersProps {
  snapshot: PrintProductionSnapshot;
  onRefetch: () => Promise<void>;
  forceDomain: string | null;
  selectedJobId: string | null;
}

type ValidationRecord = ValidationBinding & {
  interpretation: DryRunInterpretation;
};

type PendingValidationBinding = {
  jobId: string;
  preValidationVersion: string;
  preValidationFingerprint: string;
  paymentMethod: PrintcomPaymentMethod;
  interpretation: DryRunInterpretation;
  deadlineAt: number;
};

const PENDING_VALIDATION_TIMEOUT_MS = 1500;

const GROUPS = [
  { key: "attention", title: "Kræver handling" },
  { key: "ready", title: "Klar til produktion" },
  { key: "supplier", title: "Hos leverandøren" },
  { key: "completed", title: "Afsluttet" },
  { key: "waiting", title: "Afventer" },
] as const;

export function PrintProductionOrders({
  snapshot,
  onRefetch,
  forceDomain,
  selectedJobId,
}: PrintProductionOrdersProps) {
  const submitToPrintcom = usePodSubmitToPrintcom();
  const syncPrintcomStatus = usePodSyncPrintcomStatus();
  const [paymentMethod, setPaymentMethod] = useState<PrintcomPaymentMethod>("invoice");
  const [inspectedJobId, setInspectedJobId] = useState<string | null>(selectedJobId);
  const [search, setSearch] = useState("");
  const [productionFilter, setProductionFilter] = useState("all");
  const [fileFilter, setFileFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);

  useEffect(() => setInspectedJobId(selectedJobId), [selectedJobId]);
  const [validation, setValidation] = useState<ValidationRecord | null>(null);
  const [pendingValidation, setPendingValidation] = useState<PendingValidationBinding | null>(null);
  const [sessionState, setSessionState] = useState<SubmissionSessionState>(createSubmissionSessionState);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [reconcilingJobId, setReconcilingJobId] = useState<string | null>(null);
  const [activeOperationJobId, setActiveOperationJobId] = useState<string | null>(null);
  const activeOperationRef = useRef<string | null>(null);
  const jobsRef = useRef(snapshot.jobs);
  jobsRef.current = snapshot.jobs;

  const getCurrentJob = (jobId: string | null | undefined) => resolveCurrentJob(jobsRef.current, jobId);
  const getOrderContext = (job: PodFulfillmentJob) => ({
    validation: validation?.jobId === job.id ? validation : null,
    paymentMethod,
    reconciliationBlocked: isReconciliationBlocked(sessionState, job.id),
  });
  const getPresentation = (job: PodFulfillmentJob) => getProductionOrderPresentation(job, getOrderContext(job));
  const fileStates = Array.from(new Set(snapshot.jobs.map(getFileState)));
  const jobStatuses = Array.from(new Set(snapshot.jobs.map((job) => job.status)));
  const filteredJobs = snapshot.jobs.filter((job) => {
    const matchesSearch = [job.id, job.order_id, job.product_name, job.recipient_name, job.customer_email, getTenantLabel(snapshot, job.tenant_id)]
      .filter(Boolean).join(" ").toLocaleLowerCase("da-DK").includes(search.trim().toLocaleLowerCase("da-DK"));
    return matchesSearch && (productionFilter === "all" || getPresentation(job).group === productionFilter)
      && (fileFilter === "all" || getFileState(job) === fileFilter)
      && (statusFilter === "all" || job.status === statusFilter);
  }).sort((a, b) => {
    const aTime = Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.created_at) || 0;
    return newestFirst ? bTime - aTime : aTime - bTime;
  });
  const inspectedJob = filteredJobs.find((job) => job.id === inspectedJobId) || filteredJobs[0] || null;
  const inspectedPresentation = inspectedJob ? getPresentation(inspectedJob) : null;
  const confirmationJob = getCurrentJob(confirmingJobId);
  const confirmationCanSubmit = Boolean(confirmationJob && canSubmitCurrentJob(confirmationJob, validation, paymentMethod, sessionState, getPresentation(confirmationJob)));
  const reconciliationJob = getCurrentJob(reconcilingJobId);
  const reconciliationCanResolve = canReconcileUncertainSubmission(sessionState, reconciliationJob);
  const manualFallbackParams = new URLSearchParams();

  if (forceDomain) manualFallbackParams.set("force_domain", forceDomain);
  const manualFallbackHref = `/admin/pod2-ordrer${manualFallbackParams.size ? `?${manualFallbackParams}` : ""}`;

  useEffect(() => {
    if (!pendingValidation) return;
    const currentJob = resolveCurrentJob(snapshot.jobs, pendingValidation.jobId);
    const resolution = resolvePendingValidation({
      pending: pendingValidation,
      currentJob,
      now: Date.now(),
    });

    if (resolution.kind === "waiting") {
      const remainingMs = Math.max(0, pendingValidation.deadlineAt - Date.now());
      const timeout = window.setTimeout(() => {
        setPendingValidation((current) => current?.jobId === pendingValidation.jobId
          && current.deadlineAt === pendingValidation.deadlineAt
          ? { ...current }
          : current);
      }, remainingMs);
      return () => window.clearTimeout(timeout);
    }

    if (resolution.kind === "rejected") {
      setValidation({
        jobId: pendingValidation.jobId,
        jobVersion: currentJob?.updated_at || pendingValidation.preValidationVersion,
        paymentMethod: pendingValidation.paymentMethod,
        semanticFingerprint: currentJob ? buildSubmissionFingerprint(currentJob) : pendingValidation.preValidationFingerprint,
        passed: false,
        kind: "blocked",
        interpretation: blockedInterpretation(resolution.message),
      });
      setPendingValidation(null);
      return;
    }

    setValidation({
      jobId: resolution.job.id,
      jobVersion: resolution.job.updated_at,
      paymentMethod: pendingValidation.paymentMethod,
      semanticFingerprint: resolution.semanticFingerprint,
      passed: pendingValidation.interpretation.kind === "ready",
      kind: pendingValidation.interpretation.kind,
      interpretation: pendingValidation.interpretation,
    });
    setPendingValidation(null);
  }, [snapshot.jobs, pendingValidation]);

  useEffect(() => {
    if (confirmingJobId && !confirmationCanSubmit) setConfirmingJobId(null);
  }, [confirmingJobId, confirmationCanSubmit]);

  useEffect(() => {
    if (reconcilingJobId && !isReconciliationBlocked(sessionState, reconcilingJobId)) {
      setReconcilingJobId(null);
    }
  }, [reconcilingJobId, sessionState]);

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
    setPendingValidation(null);
    setConfirmingJobId(null);
  };

  const handleValidate = async (jobId: string) => {
    const currentJob = getCurrentJob(jobId);
    if (!currentJob || isReconciliationBlocked(sessionState, jobId) || !getPresentation(currentJob).canValidate) return;
    if (!beginOperation(jobId)) return;

    setValidation(null);
    setPendingValidation(null);
    setConfirmingJobId(null);

    try {
      const result: unknown = await submitToPrintcom.mutateAsync(buildValidationRequest(jobId, paymentMethod));
      const interpretation = interpretDryRunResult(result);
      if (interpretation.kind === "blocked") {
        setValidation({
          jobId,
          jobVersion: currentJob.updated_at,
          paymentMethod,
          semanticFingerprint: buildSubmissionFingerprint(currentJob),
          passed: false,
          kind: "blocked",
          interpretation,
        });
        return;
      }

      try {
        await onRefetch();
      } catch {
        setValidation({
          jobId,
          jobVersion: currentJob.updated_at,
          paymentMethod,
          semanticFingerprint: buildSubmissionFingerprint(currentJob),
          passed: false,
          kind: "blocked",
          interpretation: blockedInterpretation("Kontrolsvaret kom tilbage, men den aktuelle jobtilstand kunne ikke hentes. Kontrollér ordren igen."),
        });
        return;
      }

      setPendingValidation({
        jobId,
        preValidationVersion: currentJob.updated_at,
        preValidationFingerprint: buildSubmissionFingerprint(currentJob),
        paymentMethod,
        interpretation,
        deadlineAt: Date.now() + PENDING_VALIDATION_TIMEOUT_MS,
      });
    } catch (error: unknown) {
      setValidation({
        jobId,
        jobVersion: currentJob.updated_at,
        paymentMethod,
        semanticFingerprint: buildSubmissionFingerprint(currentJob),
        passed: false,
        kind: "blocked",
        interpretation: {
          ...blockedInterpretation("Kontrollen blev afvist. Gennemgå ordren og kontrollér igen."),
          payload: getTechnicalError(error).payload,
          response: getTechnicalError(error).response,
        },
      });
    } finally {
      finishOperation(jobId);
    }
  };

  const handleOpenConfirmation = (jobId: string) => {
    const currentJob = getCurrentJob(jobId);
    if (!currentJob || !canSubmitCurrentJob(currentJob, validation, paymentMethod, sessionState, getPresentation(currentJob))) return;
    setConfirmingJobId(jobId);
  };

  const handleConfirmSubmission = async () => {
    const jobId = confirmingJobId;
    const currentJob = getCurrentJob(jobId);
    if (!jobId || !currentJob || !canSubmitCurrentJob(currentJob, validation, paymentMethod, sessionState, getPresentation(currentJob))) {
      setConfirmingJobId(null);
      return;
    }
    if (!beginOperation(jobId)) return;
    setConfirmingJobId(null);

    try {
      await submitToPrintcom.mutateAsync({ jobId, paymentMethod, dryRun: false });
      setValidation(null);
      await onRefetch();
    } catch (error: unknown) {
      const technicalError = getTechnicalError(error);
      setPendingValidation(null);
      if (technicalError.uncertain === false) {
        setValidation({
          jobId,
          jobVersion: currentJob.updated_at,
          paymentMethod,
          semanticFingerprint: buildSubmissionFingerprint(currentJob),
          passed: false,
          kind: "blocked",
          interpretation: {
            ...blockedInterpretation(technicalError.message || "Leverandørordren blev afvist. Kontrollér ordren igen."),
            payload: technicalError.payload,
            response: technicalError.response,
          },
        });
        try {
          await onRefetch();
        } catch {
          // The definitive server rejection remains visible with the current snapshot.
        }
        return;
      }

      setValidation(null);
      setSessionState((current) => startUncertainSubmissionReconciliation(current, jobId));

      try {
        await syncPrintcomStatus.mutateAsync({ jobIds: [jobId] });
      } catch {
        // Reconciliation remains blocked regardless of the sync result.
      }
      try {
        await onRefetch();
        setSessionState((current) => markSubmissionReconciliationRefreshed(current, jobId));
      } catch {
        // Reconciliation remains blocked when fresh data cannot be loaded.
      }
    } finally {
      finishOperation(jobId);
    }
  };

  const handleReconcile = () => {
    const jobId = reconcilingJobId;
    if (!jobId) return;
    const currentJob = getCurrentJob(jobId);
    setSessionState((current) => reconcileUncertainSubmission(current, {
      jobId,
      job: currentJob,
      operatorConfirmedNoSupplierOrder: true,
    }));
    setValidation(null);
    setPendingValidation(null);
    setReconcilingJobId(null);
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
              disabled={Boolean(activeOperationJobId) || Boolean(confirmingJobId)}
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

      <div className="workspace-production-filters">
        <label><span>Status (produktion)</span><select value={productionFilter} onChange={(event) => setProductionFilter(event.target.value)}><option value="all">Alle</option>{GROUPS.map((group) => <option key={group.key} value={group.key}>{group.title}</option>)}</select></label>
        <label><span>Filstatus</span><select value={fileFilter} onChange={(event) => setFileFilter(event.target.value)}><option value="all">Alle</option>{fileStates.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <label><span>Jobstatus</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Alle</option>{jobStatuses.map((status) => <option key={status} value={status}>{POD_JOB_STATUS_LABELS[status]}</option>)}</select></label>
        <label className="workspace-production-search"><span>Søg i produktionsordrer</span><div><Search className="h-4 w-4" aria-hidden="true" /><Input aria-label="Søg efter ordre, produkt, kunde eller butik" placeholder="Søg ordre, produkt eller kunde …" value={search} onChange={(event) => setSearch(event.target.value)} /></div></label>
        <Button variant="outline" onClick={() => { setSearch(""); setProductionFilter("all"); setFileFilter("all"); setStatusFilter("all"); }}>Ryd filtre</Button>
      </div>

      {snapshot.jobs.length === 0 ? (
        <div className="border-y py-10 text-center">
          <ClipboardCheck className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Ingen produktionsordrer endnu</p>
          <p className="mt-1 text-sm text-muted-foreground">Nye jobs vises her, når en butik har oprettet dem.</p>
        </div>
      ) : (
        <div className="workspace-production-register">
          <div className="min-w-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ordre</TableHead><TableHead>Produkt / kunde</TableHead><TableHead>Filstatus</TableHead><TableHead>Jobstatus</TableHead><TableHead>Produktion</TableHead>
                <TableHead aria-sort={newestFirst ? "descending" : "ascending"}><button type="button" className="inline-flex items-center gap-1" onClick={() => setNewestFirst((current) => !current)}>Oprettet{newestFirst ? <ArrowDown className="h-3 w-3" aria-hidden="true" /> : <ArrowUp className="h-3 w-3" aria-hidden="true" />}</button></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredJobs.map((job) => {
                  const presentation = getPresentation(job);
                  return <TableRow key={job.id} className={inspectedJob?.id === job.id ? "workspace-selected-row" : undefined}>
                    <TableCell><button type="button" className="workspace-row-title" aria-current={inspectedJob?.id === job.id ? "true" : undefined} onClick={() => setInspectedJobId(job.id)} disabled={Boolean(activeOperationJobId)}>{job.order_id.slice(0, 8)}</button><p className="mt-1 text-xs text-muted-foreground">Job {job.id.slice(0, 8)}</p></TableCell>
                    <TableCell><p className="font-medium">{job.product_name || "Printordre"}</p><p className="mt-1 text-xs text-muted-foreground">{job.qty} stk. · {job.recipient_name || "Kunde mangler"}</p><p className="mt-1 text-xs text-muted-foreground">{getTenantLabel(snapshot, job.tenant_id)}</p></TableCell>
                    <TableCell>{getFileState(job)}</TableCell>
                    <TableCell>{POD_JOB_STATUS_LABELS[job.status]}</TableCell>
                    <TableCell><Badge variant={presentation.group === "attention" ? "destructive" : "outline"}>{presentation.label}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatJobDate(job.created_at)}</TableCell>
                  </TableRow>;
                })}
                {filteredJobs.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Ingen produktionsordrer matcher filtrene.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">Viser {filteredJobs.length} af {snapshot.jobs.length} produktionsjobs</p>
          </div>
          <aside className="workspace-production-inspector" aria-label="Valgt produktionsordre">
            {inspectedJob && inspectedPresentation ? <>
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold">Produktionsordre {inspectedJob.order_id.slice(0, 8)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{formatJobDate(inspectedJob.created_at)} · Print.com</p>
              </div>
              <div className="workspace-priority-strip my-5">
                <h4 className="text-sm font-semibold">Næste skridt</h4>
                <p className="mt-2 text-sm text-muted-foreground">{inspectedPresentation.nextAction}</p>
              </div>
              <OrderRow
                key={inspectedJob.id}
                job={inspectedJob}
                tenantLabel={getTenantLabel(snapshot, inspectedJob.tenant_id)}
                presentation={inspectedPresentation}
                isSelected={false}
                isBusy={Boolean(activeOperationJobId)}
                isCurrentOperation={activeOperationJobId === inspectedJob.id}
                validation={validation?.jobId === inspectedJob.id ? validation : null}
                paymentMethod={paymentMethod}
                reconciliationBlocked={isReconciliationBlocked(sessionState, inspectedJob.id)}
                onValidate={() => handleValidate(inspectedJob.id)}
                onConfirm={() => handleOpenConfirmation(inspectedJob.id)}
                onOpenReconciliation={() => setReconcilingJobId(inspectedJob.id)}
              />
            </> : <p className="text-sm text-muted-foreground">Vælg et job i produktionsoversigten.</p>}
          </aside>
        </div>
      )}

      <div className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <Link to={manualFallbackHref} className="underline-offset-4 hover:text-foreground hover:underline">
          Avanceret manuel videresendelse
        </Link>
      </div>

      <SubmissionConfirmation
        job={confirmationJob}
        tenantLabel={confirmationJob ? getTenantLabel(snapshot, confirmationJob.tenant_id) : ""}
        paymentMethod={paymentMethod}
        isSubmitting={activeOperationJobId === confirmationJob?.id}
        open={Boolean(confirmingJobId && confirmationJob && confirmationCanSubmit)}
        onOpenChange={(open) => {
          if (!open && !activeOperationJobId) setConfirmingJobId(null);
        }}
        onConfirm={handleConfirmSubmission}
      />
      <ReconciliationConfirmation
        job={reconciliationJob}
        open={Boolean(reconcilingJobId && reconciliationJob && isReconciliationBlocked(sessionState, reconcilingJobId))}
        canReconcile={reconciliationCanResolve}
        onOpenChange={(open) => {
          if (!open) setReconcilingJobId(null);
        }}
        onConfirm={handleReconcile}
      />
    </div>
  );
}

function OrderRow({
  job,
  tenantLabel,
  presentation,
  isSelected,
  isBusy,
  isCurrentOperation,
  validation,
  paymentMethod,
  reconciliationBlocked,
  onValidate,
  onConfirm,
  onOpenReconciliation,
}: {
  job: PodFulfillmentJob;
  tenantLabel: string;
  presentation: ProductionOrderPresentation;
  isSelected: boolean;
  isBusy: boolean;
  isCurrentOperation: boolean;
  validation: ValidationRecord | null;
  paymentMethod: PrintcomPaymentMethod;
  reconciliationBlocked: boolean;
  onValidate: () => void;
  onConfirm: () => void;
  onOpenReconciliation: () => void;
}) {
  return (
    <article className={cn("px-4 py-4", isSelected && "bg-primary/5")}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-medium">{job.product_name || "Printordre"}</p>
            <Badge variant={presentation.group === "attention" ? "destructive" : "outline"}>{presentation.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{job.qty} stk. · {job.recipient_name || "Kunde mangler"}</p>
          {job.customer_email && <p className="break-all text-xs text-muted-foreground">{job.customer_email}</p>}
        </div>
        <OrderFact label="Butik" value={tenantLabel} />
        <OrderFact label="Levering" value={job.delivery_summary || job.shipping_method || "Ikke angivet"} />
        <div className="min-w-0 space-y-1">
          <OrderFact label="Fil" value={getFileState(job)} />
          <OrderFact label="Leverandør" value={getSupplierState(job, presentation)} />
        </div>
        <div className="flex flex-col items-stretch gap-2 xl:items-end">
          {presentation.canValidate && (
            <Button size="sm" variant="outline" onClick={onValidate} disabled={isBusy}>
              {isCurrentOperation ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
              Kontrollér ordre
            </Button>
          )}
          {presentation.canSubmit && (
            <Button size="sm" onClick={onConfirm} disabled={isBusy}>
              <Send aria-hidden="true" />
              Opret leverandørordre
            </Button>
          )}
          {!presentation.canValidate && !presentation.canSubmit && <p className="text-xs text-muted-foreground xl:text-right">{presentation.nextAction}</p>}
          {presentation.canValidate && !presentation.canSubmit && !validation && <p className="text-xs text-muted-foreground xl:text-right">{presentation.nextAction}</p>}
        </div>
      </div>

      {validation && (
        <ValidationOutcome
          job={job}
          validation={validation}
          paymentMethod={paymentMethod}
          onRetry={onValidate}
          isBusy={isBusy}
        />
      )}
      {reconciliationBlocked && <ReconciliationOutcome onOpen={onOpenReconciliation} />}
      <TechnicalDetails job={job} validation={validation} />
    </article>
  );
}

function ValidationOutcome({
  job,
  validation,
  paymentMethod,
  onRetry,
  isBusy,
}: {
  job: PodFulfillmentJob;
  validation: ValidationRecord;
  paymentMethod: PrintcomPaymentMethod;
  onRetry: () => void;
  isBusy: boolean;
}) {
  const outcome = getValidationOutcomeState(job, validation, paymentMethod);
  const canRetry = getProductionOrderPresentation(job, { paymentMethod }).canValidate;

  if (outcome === "blocked") {
    return (
      <Alert variant="destructive" className="mt-3 rounded-md">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{validation.interpretation.label}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{validation.interpretation.description}</span>
          {canRetry && <Button size="sm" variant="outline" onClick={onRetry} disabled={isBusy}>Kontrollér igen</Button>}
        </AlertDescription>
      </Alert>
    );
  }

  if (outcome === "stale") {
    return (
      <Alert className="mt-3 rounded-md border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <AlertTitle>Kontrollen er ikke længere aktuel</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>Ordregrundlaget, betalingsmetoden eller jobtilstanden er ændret. Kontrollér ordren igen før indsendelse.</span>
          {canRetry && <Button size="sm" variant="outline" onClick={onRetry} disabled={isBusy}>Kontrollér igen</Button>}
        </AlertDescription>
      </Alert>
    );
  }

  if (outcome === "none") return null;

  const isManualCheck = outcome === "manual_check";
  const summary = outcome === "ready" ? summarizeDryRunPayload(validation.interpretation.payload) : "";
  return (
    <Alert className={cn(
      "mt-3 rounded-md",
      isManualCheck
        ? "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        : "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
    )}>
      <CheckCircle2 className={cn("h-4 w-4", isManualCheck ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")} aria-hidden="true" />
      <AlertTitle>{validation.interpretation.label}</AlertTitle>
      <AlertDescription>
        {validation.interpretation.description}{summary ? ` ${summary}.` : ""}
      </AlertDescription>
    </Alert>
  );
}

function ReconciliationOutcome({ onOpen }: { onOpen: () => void }) {
  return (
    <Alert className="mt-3 rounded-md border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <AlertTitle>Leverandørordre skal afklares</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>Indsendelsen kunne være nået frem. Kontrollér Print.com og den gemte leverandørreference, før du fortsætter.</span>
        <Button size="sm" variant="outline" onClick={onOpen}>Afklar ordre</Button>
      </AlertDescription>
    </Alert>
  );
}

function SubmissionConfirmation({
  job,
  tenantLabel,
  paymentMethod,
  isSubmitting,
  open,
  onOpenChange,
  onConfirm,
}: {
  job: PodFulfillmentJob | null;
  tenantLabel: string;
  paymentMethod: PrintcomPaymentMethod;
  isSubmitting: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret leverandørordre?</DialogTitle>
          <DialogDescription>Denne handling opretter en ordre hos Print.com og bliver aldrig gentaget automatisk.</DialogDescription>
        </DialogHeader>
        {job && (
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <ConfirmationFact label="Leverandør" value="Print.com" />
            <ConfirmationFact label="Butik" value={tenantLabel} />
            <ConfirmationFact label="Modtager" value={job.recipient_name || "Ikke angivet"} />
            <ConfirmationFact label="Webprinter-pris til butik" value={formatCurrency(job.tenant_cost, job.currency)} />
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

function ReconciliationConfirmation({
  job,
  open,
  canReconcile,
  onOpenChange,
  onConfirm,
}: {
  job: PodFulfillmentJob | null;
  open: boolean;
  canReconcile: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Afklar mulig leverandørordre</DialogTitle>
          <DialogDescription>
            Bekræft kun, når du har kontrolleret Print.com og den aktuelle jobtilstand, og der ikke findes en leverandørordre eller gemt leverandørreference.
          </DialogDescription>
        </DialogHeader>
        {job?.printcom_order_id ? (
          <Alert variant="destructive" className="rounded-md">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Leverandørreference er gemt</AlertTitle>
            <AlertDescription>Ordren forbliver blokeret for ny indsendelse.</AlertDescription>
          </Alert>
        ) : canReconcile ? (
          <p className="text-sm text-muted-foreground">Efter bekræftelsen kræves en ny kontrol, før en leverandørordre kan oprettes.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Afventer en vellykket statusopdatering og dataopfriskning. Ordren forbliver blokeret.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
          <Button onClick={onConfirm} disabled={!canReconcile}>Bekræft ingen leverandørordre</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}

function ConfirmationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
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
        <RawData label="Kontrol-payload" value={validation?.interpretation.payload} />
        <RawData label="Leverandørsvar" value={validation?.interpretation.response ?? job.printcom_order_raw} />
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

function canSubmitCurrentJob(
  job: PodFulfillmentJob,
  validation: ValidationRecord | null,
  paymentMethod: PrintcomPaymentMethod,
  sessionState: SubmissionSessionState,
  presentation: ProductionOrderPresentation,
): boolean {
  return !isReconciliationBlocked(sessionState, job.id)
    && presentation.canSubmit
    && canConfirmRealSubmission({
      jobId: job.id,
      status: job.status,
      printcomOrderId: job.printcom_order_id ?? null,
      submissionLockToken: job.printcom_submission_lock_token ?? null,
      validatedJobId: validation?.jobId ?? "",
      validationPassed: validation?.passed === true,
      paymentMethod,
      validatedPaymentMethod: validation?.paymentMethod ?? "" as PrintcomPaymentMethod,
      jobVersion: job.updated_at,
      validatedJobVersion: validation?.jobVersion ?? "",
      currentSemanticFingerprint: buildSubmissionFingerprint(job),
      validatedSemanticFingerprint: validation?.semanticFingerprint ?? "",
    });
}

function getTenantLabel(snapshot: PrintProductionSnapshot, tenantId: string): string {
  const tenant = snapshot.tenants.find((candidate) => candidate.id === tenantId);
  return tenant?.domain || tenant?.name || "Ukendt butik";
}

function getFileState(job: PodFulfillmentJob): string {
  if (job.printcom_design_id || job.printcom_printjob_id) return "Registreret hos leverandøren";
  if (job.status === "failed" || job.printcom_last_error) return "Kræver kontrol";
  return "Afventer kontrol";
}

function getSupplierState(job: PodFulfillmentJob, presentation: ProductionOrderPresentation): string {
  if (presentation.group === "supplier") return "Ordre registreret";
  if (job.status === "submitted" || job.status === "processing") return "Mangler leverandørreference";
  if (presentation.group === "attention") return "Kræver afklaring";
  return "Ikke bekræftet";
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

function blockedInterpretation(description: string): DryRunInterpretation {
  return { kind: "blocked", label: "Ordren kan ikke sendes", description };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getTechnicalError(error: unknown): {
  message?: string;
  payload?: unknown;
  response?: unknown;
  uncertain?: boolean;
} {
  const record = asRecord(error);
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    payload: record.payload,
    response: record.response,
    uncertain: typeof record.uncertain === "boolean" ? record.uncertain : undefined,
  };
}

function formatJobDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Dato ikke oplyst" : date.toLocaleString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
