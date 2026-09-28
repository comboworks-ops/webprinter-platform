interface WorkspaceJobSummaryProps {
    job: {
        id: string; order_id: string; variant_signature: string; qty: number;
        tenant_cost: number; currency: string; created_at: string;
        product_name?: string; recipient_name?: string; delivery_summary?: string;
        provider_job_ref?: string; error_message?: string;
    } | null;
    statusLabel?: string;
}

/** Read-only selected job context. Production actions remain in the original queue. */
export function WorkspaceJobSummary({ job, statusLabel }: WorkspaceJobSummaryProps) {
    return <aside className="workspace-inline-detail workspace-job-summary" aria-label="Valgt produktionsjob">
        {job ? <>
            <p className="text-sm text-muted-foreground">Ordre {job.order_id.slice(0, 8)}</p>
            <h3>{job.product_name || `Job ${job.id.slice(0, 8)}`}</h3>
            <p className="workspace-job-status">{statusLabel}</p>
            <dl className="workspace-key-values">
                <div><dt>Job ID</dt><dd>{job.id}</dd></div>
                <div><dt>Variant</dt><dd>{job.variant_signature || "Ikke oplyst"}</dd></div>
                <div><dt>Antal</dt><dd>{job.qty}</dd></div>
                <div><dt>Webprinter-pris</dt><dd>{Number(job.tenant_cost).toFixed(2)} {job.currency}</dd></div>
                {job.recipient_name && <div><dt>Modtager</dt><dd>{job.recipient_name}</dd></div>}
                {job.delivery_summary && <div><dt>Levering</dt><dd>{job.delivery_summary}</dd></div>}
                <div><dt>Oprettet</dt><dd>{new Date(job.created_at).toLocaleString("da-DK")}</dd></div>
                <div><dt>Leverandørreference</dt><dd>{job.provider_job_ref || "Ikke tilføjet"}</dd></div>
            </dl>
            {job.error_message && <p className="mt-5 text-sm text-destructive">{job.error_message}</p>}
        </> : <p className="text-muted-foreground">Vælg et job i produktionskøen for at se oplysningerne.</p>}
    </aside>;
}
