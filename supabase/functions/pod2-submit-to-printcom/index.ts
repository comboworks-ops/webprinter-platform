// POD v2: Submit a paid fulfillment job to Print.com.
//
// Replaces the "Videresend" manual flow with an actual end-to-end API call:
//   1. Ensure tenant has a Print.com contact (create if first time, reuse otherwise).
//   2. If sender_mode = custom and a tenant logo is set, upload it + attach stickySlipImageId.
//   3. Create a cart, add a cart item (returns printjobId), attach senderAddress.
//   4. Upload the customer's print file via Print.com's presigned S3 uploadEndpoints,
//      then startFileHandler + approve design + finalize printjob.
//   5. POST /carts/{id}/order with paymentMethod (defaults to "invoice").
//
// Progress is persisted on pod2_fulfillment_jobs.printcom_submission_step so the
// call is idempotent and resumable. Each step checks the column before re-running.
//
// MASTER ONLY. Called from the Videresend button.
//
// Input:  { jobId: string, paymentMethod?: "invoice" | "psp", dryRun?: boolean }
// Output: { success, job, steps: [{step, ok, detail?}] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

type Step =
    | "contact"
    | "logo"
    | "cart"
    | "sender"
    | "files"
    | "finalize"
    | "submit";

const STEP_ORDER: Step[] = ["contact", "logo", "cart", "sender", "files", "finalize", "submit"];

const stepIndex = (s: Step | null | undefined) =>
    s ? STEP_ORDER.indexOf(s) : -1;

const alreadyPast = (current: Step | null | undefined, target: Step) =>
    stepIndex(current) >= stepIndex(target);

// Format YYYY-MM-DD for tomorrow, skipping Sat/Sun.
const nextBusinessDay = (): string => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return d.toISOString().slice(0, 10);
};

const pickExt = (name: string, fallback = "pdf") => {
    const m = name.match(/\.([a-zA-Z0-9]+)$/);
    return (m?.[1] || fallback).toLowerCase();
};

const guessMime = (name: string) => {
    const ext = pickExt(name);
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "svg") return "image/svg+xml";
    return "application/octet-stream";
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return json({ error: "Unauthorized" }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const { jobId, paymentMethod = "invoice", dryRun = false } = body as {
            jobId?: string;
            paymentMethod?: "invoice" | "psp";
            dryRun?: boolean;
        };

        if (!jobId) return json({ error: "jobId required" }, 400);

        // Master-only.
        const { data: masterRole } = await supabaseClient
            .from("user_roles")
            .select("role, tenant_id")
            .eq("user_id", user.id)
            .eq("tenant_id", MASTER_TENANT_ID)
            .in("role", ["admin", "master_admin"])
            .limit(1)
            .maybeSingle();
        if (!masterRole) {
            return json({ error: "Kun master admin kan indsende POD v2 jobs til Print.com" }, 403);
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // ---------- load job ----------
        const { data: job, error: jobError } = await serviceClient
            .from("pod2_fulfillment_jobs")
            .select("*")
            .eq("id", jobId)
            .maybeSingle();
        if (jobError || !job) return json({ error: "Job not found" }, 404);
        if (job.status !== "paid" && !dryRun) {
            return json({ error: `Job status is ${job.status}, expected paid` }, 400);
        }

        // ---------- load tenant profile (sender + printcom linkage) ----------
        const { data: tenantProfile } = await serviceClient
            .from("tenant_pod_shipping_profile")
            .select("*")
            .eq("tenant_id", job.tenant_id)
            .maybeSingle();

        // ---------- load order + catalog product ----------
        const { data: order } = await serviceClient
            .from("orders")
            .select("id, delivery_address, delivery_city, delivery_zip, customer_name, customer_email, customer_phone, delivery_country, product_configuration")
            .eq("id", job.order_id)
            .maybeSingle();
        if (!order) return json({ error: "Order not found" }, 404);

        const { data: catalog } = await serviceClient
            .from("pod2_catalog_products")
            .select("id, supplier_product_ref, supplier_product_data")
            .eq("id", job.catalog_product_id)
            .maybeSingle();
        if (!catalog) return json({ error: "Catalog product not found" }, 404);

        // ---------- load Print.com connection ----------
        let { data: connection } = await serviceClient
            .from("pod2_supplier_connections")
            .select("*")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
        if (!connection) {
            const { data: v1 } = await serviceClient
                .from("pod_supplier_connections")
                .select("*")
                .eq("is_active", true)
                .limit(1)
                .maybeSingle();
            connection = v1;
        }
        if (!connection) return json({ error: "No active Print.com supplier connection" }, 404);

        const baseUrl: string = connection.base_url || "https://api.print.com";
        const authHeaders = (override?: "x_api_key"): Record<string, string> => {
            const h: Record<string, string> = { Accept: "application/json" };
            const key: string = connection.api_key_encrypted;
            if (override === "x_api_key") {
                h["X-API-Key"] = key;
                return h;
            }
            switch (connection.auth_header_mode) {
                case "authorization_bearer":
                    h["Authorization"] = `Bearer ${key}`;
                    break;
                case "x_api_key":
                    h["X-API-Key"] = key;
                    break;
                case "custom":
                    if (connection.auth_header_name) {
                        const prefix = connection.auth_header_prefix || "";
                        h[connection.auth_header_name] = prefix ? `${prefix} ${key}` : key;
                    }
                    break;
                default:
                    h["Authorization"] = `Bearer ${key}`;
            }
            return h;
        };

        // JSON call to Print.com API with 401 fallback to X-API-Key.
        const callApi = async (
            method: string,
            path: string,
            payload?: unknown,
        ): Promise<{ status: number; data: any; response: Response }> => {
            const url = new URL(path, baseUrl).toString();
            const doFetch = async (override?: "x_api_key") => {
                const headers: Record<string, string> = {
                    ...authHeaders(override),
                    "Content-Type": "application/json",
                };
                const resp = await fetch(url, {
                    method,
                    headers,
                    body: payload === undefined ? undefined : JSON.stringify(payload),
                });
                const ct = resp.headers.get("content-type") || "";
                const data = ct.includes("application/json")
                    ? await resp.json().catch(() => null)
                    : await resp.text();
                return { status: resp.status, data, response: resp };
            };
            let res = await doFetch();
            if (res.status === 401) {
                res = await doFetch("x_api_key");
            }
            if (res.status >= 400) {
                throw new Error(
                    `Print.com ${method} ${path} failed: ${res.status} ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}`,
                );
            }
            return res;
        };

        const steps: { step: string; ok: boolean; detail?: unknown }[] = [];
        let current: Step | null = (job.printcom_submission_step as Step | null) || null;

        const advance = async (step: Step, patch: Record<string, unknown> = {}) => {
            current = step;
            const { error } = await serviceClient
                .from("pod2_fulfillment_jobs")
                .update({
                    printcom_submission_step: step,
                    printcom_last_attempt_at: new Date().toISOString(),
                    printcom_last_error: null,
                    ...patch,
                })
                .eq("id", job.id);
            if (error) throw error;
            steps.push({ step, ok: true });
        };

        const recordError = async (msg: string) => {
            await serviceClient
                .from("pod2_fulfillment_jobs")
                .update({
                    printcom_last_error: msg.slice(0, 2000),
                    printcom_last_attempt_at: new Date().toISOString(),
                })
                .eq("id", job.id);
        };

        try {
            // ============================================================
            // STEP 1 — Contact
            // Custom mode: upsert a Print.com contact with tenant address.
            // Standard/blind: no contact needed (use Print.com account default).
            // ============================================================
            if (!alreadyPast(current, "contact")) {
                if (job.sender_mode === "custom" && tenantProfile) {
                    let contactId = tenantProfile.printcom_contact_id as string | null;
                    const addr = (job.sender_address_json ?? {}) as Record<string, any>;
                    const contactPayload = {
                        companyName: addr.company_name || tenantProfile.sender_company_name || job.sender_name || "",
                        firstName: (addr.contact_name || tenantProfile.sender_contact_name || "").split(" ")[0] || "",
                        lastName: (addr.contact_name || tenantProfile.sender_contact_name || "").split(" ").slice(1).join(" ") || "",
                        fullstreet: addr.street || tenantProfile.sender_street || "",
                        houseNumber: addr.house_number || tenantProfile.sender_house_number || "",
                        postcode: addr.postcode || tenantProfile.sender_postcode || "",
                        city: addr.city || tenantProfile.sender_city || "",
                        country: (addr.country || tenantProfile.sender_country || "DK").toUpperCase(),
                        email: addr.email || tenantProfile.sender_email || "",
                        telephone: addr.phone || tenantProfile.sender_phone || "",
                        vatNr: addr.vat_number || tenantProfile.sender_vat_number || "",
                    };

                    if (!contactId) {
                        if (dryRun) {
                            contactId = "DRYRUN-contact";
                        } else {
                            const res = await callApi("POST", "/contacts", { contact: { ...contactPayload, id: "" } });
                            contactId = res.data?.id || res.data?.contact?.id;
                            if (!contactId) throw new Error("POST /contacts returned no id");
                        }
                        await serviceClient
                            .from("tenant_pod_shipping_profile")
                            .update({
                                printcom_contact_id: contactId,
                                printcom_contact_synced_at: new Date().toISOString(),
                            })
                            .eq("tenant_id", job.tenant_id);
                    }

                    await serviceClient
                        .from("pod2_fulfillment_jobs")
                        .update({ sender_contact_id: contactId })
                        .eq("id", job.id);

                    await advance("contact");
                } else {
                    // Standard/blind — skip.
                    await advance("contact");
                }
            }

            // ============================================================
            // STEP 2 — Logo (stickySlip)
            // Upload to /stickyslip/retrieveUploadUrl → presigned S3 PUT,
            // then PUT /contacts/{id} to attach stickySlipImageId.
            // Only applies to custom mode with a sender_logo_url.
            // Reuses tenant_pod_shipping_profile.printcom_sticky_slip_id if already uploaded.
            // ============================================================
            if (!alreadyPast(current, "logo")) {
                const shouldAttachLogo =
                    job.sender_mode === "custom" &&
                    !!job.sender_logo_url &&
                    !!tenantProfile?.printcom_contact_id;

                if (shouldAttachLogo && !dryRun) {
                    let stickyId = tenantProfile?.printcom_sticky_slip_id as string | null;

                    if (!stickyId) {
                        // (a) get presigned URL + slipId
                        const logoExt = pickExt(String(job.sender_logo_url), "png");
                        const slipRes = await callApi("POST", "/stickyslip/retrieveUploadUrl", {
                            filename: `tenant-${job.tenant_id}.${logoExt}`,
                            contentType: guessMime(String(job.sender_logo_url)),
                        });
                        const uploadUrl: string = slipRes.data?.uploadUrl || slipRes.data?.url;
                        stickyId = slipRes.data?.stickySlipId || slipRes.data?.id;
                        if (!uploadUrl || !stickyId) {
                            throw new Error("stickyslip/retrieveUploadUrl returned unexpected payload");
                        }

                        // (b) fetch logo bytes from our Supabase storage
                        const logoResp = await fetch(job.sender_logo_url);
                        if (!logoResp.ok) throw new Error(`Could not fetch sender_logo_url: ${logoResp.status}`);
                        const logoBytes = new Uint8Array(await logoResp.arrayBuffer());

                        // (c) PUT bytes to the presigned URL
                        const put = await fetch(uploadUrl, {
                            method: "PUT",
                            headers: { "Content-Type": guessMime(String(job.sender_logo_url)) },
                            body: logoBytes,
                        });
                        if (!put.ok) throw new Error(`S3 logo PUT failed: ${put.status}`);

                        // (d) remember the sticky id on the tenant profile for reuse
                        await serviceClient
                            .from("tenant_pod_shipping_profile")
                            .update({ printcom_sticky_slip_id: stickyId })
                            .eq("tenant_id", job.tenant_id);
                    }

                    // (e) attach to the contact
                    const contactId = tenantProfile!.printcom_contact_id as string;
                    await callApi("PUT", `/contacts/${contactId}`, {
                        contact: { id: contactId, stickySlipImageId: stickyId },
                    });
                }

                await advance("logo");
            }

            // ============================================================
            // STEP 3 — Cart + cart item
            // Create cart, then POST /carts/{id}/items with sku/options/shipments.
            // Persist printcom_cart_id, printcom_cart_item_id, printcom_printjob_id.
            // ============================================================
            if (!alreadyPast(current, "cart")) {
                let cartId = job.printcom_cart_id as string | null;
                let cartItemId = job.printcom_cart_item_id as string | null;
                let printjobId = job.printcom_printjob_id as string | null;

                if (!cartId && !dryRun) {
                    const cartRes = await callApi("POST", "/carts", {});
                    cartId = cartRes.data?.id || cartRes.data?.cart?.id;
                    if (!cartId) throw new Error("POST /carts returned no id");
                }

                if (cartId && !cartItemId && !dryRun) {
                    // Build cart item payload.
                    // We use the catalog's supplier_product_data as a TEMPLATE (sku,
                    // options, supplierId, supplierCountry, isLocalProduction) and
                    // merge in dynamics (quantity, shipments, senderAddress, pickupDate).
                    const template = (catalog.supplier_product_data ?? {}) as Record<string, any>;
                    const recipient = {
                        companyName: job.recipient_company || "",
                        firstName: (job.recipient_name || order.customer_name || "").split(" ")[0] || "",
                        lastName: (job.recipient_name || order.customer_name || "").split(" ").slice(1).join(" ") || "",
                        fullstreet: order.delivery_address || "",
                        houseNumber: "",
                        postcode: order.delivery_zip || "",
                        city: order.delivery_city || "",
                        country: (order.delivery_country || "DK").toUpperCase(),
                        email: job.customer_email || order.customer_email || "",
                        telephone: order.customer_phone || "",
                    };

                    const senderAddress = job.sender_mode === "custom"
                        ? {
                            companyName: (job.sender_address_json as any)?.company_name || "",
                            firstName: ((job.sender_address_json as any)?.contact_name || "").split(" ")[0] || "",
                            lastName: ((job.sender_address_json as any)?.contact_name || "").split(" ").slice(1).join(" ") || "",
                            fullstreet: (job.sender_address_json as any)?.street || "",
                            houseNumber: (job.sender_address_json as any)?.house_number || "",
                            postcode: (job.sender_address_json as any)?.postcode || "",
                            city: (job.sender_address_json as any)?.city || "",
                            country: (((job.sender_address_json as any)?.country) || "DK").toString().toUpperCase(),
                            email: (job.sender_address_json as any)?.email || "",
                            telephone: (job.sender_address_json as any)?.phone || "",
                        }
                        : undefined;

                    const itemPayload = {
                        item: {
                            sku: template.sku || catalog.supplier_product_ref,
                            options: template.options || {},
                            quantity: job.qty,
                            supplierId: template.supplierId || null,
                            supplierCountry: template.supplierCountry || "NL",
                            isLocalProduction: template.isLocalProduction ?? false,
                            pickupDate: nextBusinessDay(),
                            shipments: [
                                {
                                    quantity: job.qty,
                                    address: recipient,
                                },
                            ],
                            ...(senderAddress ? { senderAddress } : {}),
                            accessories: template.accessories || [],
                        },
                    };

                    const itemRes = await callApi("POST", `/carts/${cartId}/items`, itemPayload);
                    // Print.com response shape observed in HARs: { id, printjobId, ... }
                    cartItemId = itemRes.data?.id || itemRes.data?.item?.id;
                    printjobId =
                        itemRes.data?.printjobId ||
                        itemRes.data?.item?.printjobId ||
                        itemRes.data?.printjob?.id;
                    if (!cartItemId || !printjobId) {
                        throw new Error("cart item response missing id/printjobId");
                    }
                }

                await advance("cart", {
                    printcom_cart_id: cartId,
                    printcom_cart_item_id: cartItemId,
                    printcom_printjob_id: printjobId,
                });
            }

            // ============================================================
            // STEP 4 — Sender (PUT cart item with senderAddress / contact).
            // This is a separate step in the HAR flow even though we also
            // send senderAddress on create — the PUT carries the contact link.
            // Skipped for standard/blind.
            // ============================================================
            if (!alreadyPast(current, "sender")) {
                if (job.sender_mode === "custom" && !dryRun && job.printcom_cart_id && job.printcom_cart_item_id) {
                    const jobNow = await refreshJob(serviceClient, job.id);
                    const contactId =
                        jobNow?.sender_contact_id || tenantProfile?.printcom_contact_id || null;
                    if (contactId) {
                        await callApi(
                            "PUT",
                            `/carts/${jobNow!.printcom_cart_id}/items/${jobNow!.printcom_cart_item_id}`,
                            {
                                item: {
                                    senderContactId: contactId,
                                    accessories: [],
                                },
                            },
                        );
                    }
                }
                await advance("sender");
            }

            // ============================================================
            // STEP 5 — Files
            // (a) list files from order_files table
            // (b) POST /printjob/{id}/uploadEndpoints → presigned S3
            // (c) PUT bytes to S3
            // (d) POST /startFileHandler { printjobId, fileURLs: [s3://...] }
            // (e) POST /printjob/{id}/designs/{designId}/approve
            // ============================================================
            if (!alreadyPast(current, "files")) {
                if (!dryRun) {
                    const jobNow = await refreshJob(serviceClient, job.id);
                    const printjobId = jobNow?.printcom_printjob_id;
                    if (!printjobId) throw new Error("printcom_printjob_id missing");

                    const { data: files } = await serviceClient
                        .from("order_files")
                        .select("file_name, file_url, file_size, file_type")
                        .eq("order_id", job.order_id)
                        .eq("is_current", true)
                        .order("uploaded_at", { ascending: false });

                    if (!files || files.length === 0) {
                        throw new Error("No print files on order_files for this order");
                    }

                    // Download bytes up-front so we know real sizes.
                    const prepared: { name: string; bytes: Uint8Array; mime: string }[] = [];
                    for (const f of files) {
                        const r = await fetch(f.file_url);
                        if (!r.ok) throw new Error(`fetch ${f.file_name} failed: ${r.status}`);
                        const bytes = new Uint8Array(await r.arrayBuffer());
                        prepared.push({ name: f.file_name, bytes, mime: guessMime(f.file_name) });
                    }

                    // Ask Print.com for upload endpoints.
                    const epRes = await callApi("POST", `/printjob/${printjobId}/uploadEndpoints`, {
                        files: prepared.map((p) => ({ filename: p.name, size: p.bytes.byteLength })),
                    });
                    const endpoints: any[] =
                        epRes.data?.endpoints || epRes.data?.files || epRes.data || [];
                    if (!Array.isArray(endpoints) || endpoints.length !== prepared.length) {
                        throw new Error("uploadEndpoints response shape unexpected");
                    }

                    const s3Urls: string[] = [];
                    for (let i = 0; i < prepared.length; i++) {
                        const p = prepared[i];
                        const ep = endpoints[i];
                        const uploadUrl = ep.uploadUrl || ep.url;
                        const s3Url = ep.fileURL || ep.s3Url || ep.s3Uri || ep.key;
                        if (!uploadUrl) throw new Error(`endpoint[${i}] missing uploadUrl`);
                        const put = await fetch(uploadUrl, {
                            method: "PUT",
                            headers: { "Content-Type": p.mime },
                            body: p.bytes,
                        });
                        if (!put.ok) throw new Error(`S3 PUT ${p.name} failed: ${put.status}`);
                        if (s3Url) s3Urls.push(s3Url);
                    }

                    // Kick off Print.com's file processing.
                    const handlerRes = await callApi("POST", "/startFileHandler", {
                        printjobId,
                        fileURLs: s3Urls,
                    });
                    const designId: string | null =
                        handlerRes.data?.designId ||
                        handlerRes.data?.design?.id ||
                        handlerRes.data?.designs?.[0]?.id ||
                        null;

                    if (designId) {
                        await serviceClient
                            .from("pod2_fulfillment_jobs")
                            .update({ printcom_design_id: designId })
                            .eq("id", job.id);
                        // Approve the design. Print.com returns a design per file; we
                        // approve the one startFileHandler gave us. If this returns 409
                        // ("already approved") we ignore.
                        try {
                            await callApi("POST", `/printjob/${printjobId}/designs/${designId}/approve`, {});
                        } catch (approveErr) {
                            console.warn("design approve warning:", approveErr);
                        }
                    }
                }
                await advance("files");
            }

            // ============================================================
            // STEP 6 — Finalize the printjob.
            // ============================================================
            if (!alreadyPast(current, "finalize")) {
                if (!dryRun) {
                    const jobNow = await refreshJob(serviceClient, job.id);
                    const printjobId = jobNow?.printcom_printjob_id;
                    if (!printjobId) throw new Error("printcom_printjob_id missing");
                    try {
                        await callApi("POST", `/printjob/${printjobId}/finalize`, {});
                    } catch (err) {
                        // Some Print.com flows auto-finalize after approve. Swallow a
                        // 409 "already finalized" but re-throw anything else.
                        const msg = String(err?.message || err);
                        if (!/already|409/.test(msg)) throw err;
                    }
                }
                await advance("finalize");
            }

            // ============================================================
            // STEP 7 — Place order.
            // PUT /carts/{id} with customerReference, then POST /carts/{id}/order.
            // ============================================================
            if (!alreadyPast(current, "submit")) {
                if (!dryRun) {
                    const jobNow = await refreshJob(serviceClient, job.id);
                    const cartId = jobNow?.printcom_cart_id;
                    if (!cartId) throw new Error("printcom_cart_id missing");

                    await callApi("PUT", `/carts/${cartId}`, {
                        customerReference: `wp-${job.id}`,
                    });

                    const orderRes = await callApi("POST", `/carts/${cartId}/order`, {
                        paymentMethod, // "invoice" (default) or "psp"
                    });

                    const printcomOrderId: string | null =
                        orderRes.data?.orderId ||
                        orderRes.data?.id ||
                        orderRes.data?.order?.id ||
                        null;

                    await serviceClient
                        .from("pod2_fulfillment_jobs")
                        .update({
                            status: "submitted",
                            submitted_by_master_at: new Date().toISOString(),
                            submitted_by_master_user_id: user.id,
                            provider_job_ref: printcomOrderId || jobNow?.printcom_printjob_id || null,
                            printcom_order_id: printcomOrderId,
                            printcom_order_raw: orderRes.data ?? null,
                        })
                        .eq("id", job.id);
                }
                await advance("submit");
            }

            const { data: finalJob } = await serviceClient
                .from("pod2_fulfillment_jobs")
                .select("*")
                .eq("id", job.id)
                .maybeSingle();

            return json({ success: true, job: finalJob, steps });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await recordError(msg);
            steps.push({ step: current || "start", ok: false, detail: msg });
            console.error("pod2-submit-to-printcom step error:", msg);
            return json({ success: false, error: msg, steps }, 500);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("pod2-submit-to-printcom fatal:", msg);
        return json({ error: msg }, 500);
    }
});

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

async function refreshJob(client: any, id: string) {
    const { data } = await client
        .from("pod2_fulfillment_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
    return data;
}
