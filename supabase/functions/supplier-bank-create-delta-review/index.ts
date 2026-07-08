import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeText = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

const isUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const finiteNumberOrNull = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getNormalizedPrice = (row: any) => finiteNumberOrNull(row?.finalPriceDkk ?? row?.proposedPriceDkk);

const getComparableRowKey = (row: any) => {
  const explicitRowKey = normalizeText(row?.sourceIdentifiers?.rowKey);
  if (explicitRowKey) return explicitRowKey;

  const selectionEntries = Object.entries(row?.selections || {})
    .filter(([, value]) => normalizeText(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${normalizeText(value)}`);

  return [
    normalizeText(row?.sourceKey),
    ...selectionEntries,
    `quantity:${Number(row?.quantity || 0)}`,
  ].filter(Boolean).join("||");
};

const describeComparableRow = (row: any) => {
  const selections = row?.selections || row?.labels || {};
  const parts = [
    selections.format,
    selections.material,
    selections.surface,
    selections.fold,
    selections.pages,
    selections.orientation,
    `qty ${row?.quantity}`,
  ].map(normalizeText).filter(Boolean);
  return parts.join(" / ") || getComparableRowKey(row);
};

const indexNormalizedPriceRows = (rows: any[]) => {
  const indexed = new Map<string, any>();
  const duplicates: string[] = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = getComparableRowKey(row);
    if (!key) return;
    if (indexed.has(key)) duplicates.push(key);
    indexed.set(key, row);
  });

  return { indexed, duplicates };
};

const compareNormalizedRows = (oldRowsRaw: any[], newRowsRaw: any[], thresholdPct: number) => {
  const oldRows = indexNormalizedPriceRows(oldRowsRaw);
  const newRows = indexNormalizedPriceRows(newRowsRaw);
  const keys = new Set([...oldRows.indexed.keys(), ...newRows.indexed.keys()]);
  const changed: any[] = [];
  const added: any[] = [];
  const removed: any[] = [];
  let unchanged = 0;

  keys.forEach((key) => {
    const before = oldRows.indexed.get(key);
    const after = newRows.indexed.get(key);

    if (!before && after) {
      added.push({ key, row: after });
      return;
    }

    if (before && !after) {
      removed.push({ key, row: before });
      return;
    }

    const beforePrice = getNormalizedPrice(before);
    const afterPrice = getNormalizedPrice(after);
    if (beforePrice == null || afterPrice == null) return;

    const delta = afterPrice - beforePrice;
    const percent = beforePrice === 0 ? null : (delta / beforePrice) * 100;
    const absPercent = Math.abs(percent ?? 0);

    if (delta === 0 || absPercent < thresholdPct) {
      unchanged += 1;
      return;
    }

    changed.push({ key, row: after, beforePrice, afterPrice, delta, percent });
  });

  changed.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  return {
    oldRows: oldRows.indexed.size,
    newRows: newRows.indexed.size,
    duplicateOldKeys: oldRows.duplicates.length,
    duplicateNewKeys: newRows.duplicates.length,
    changed,
    added,
    removed,
    unchanged,
  };
};

const compactDeltaRow = (change: any) => ({
  key: change.key,
  label: describeComparableRow(change.row),
  quantity: finiteNumberOrNull(change.row?.quantity),
  beforePriceDkk: finiteNumberOrNull(change.beforePrice),
  afterPriceDkk: finiteNumberOrNull(change.afterPrice),
  deltaDkk: finiteNumberOrNull(change.delta),
  deltaPct: change.percent == null ? null : Number(change.percent.toFixed(4)),
  selections: change.row?.selections || null,
});

const compactAddedRemovedRow = (item: any) => ({
  key: item.key,
  label: describeComparableRow(item.row),
  quantity: finiteNumberOrNull(item.row?.quantity),
  priceDkk: getNormalizedPrice(item.row),
  selections: item.row?.selections || null,
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRows, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "master_admin");

    if (roleError) throw roleError;
    if (!Array.isArray(roleRows) || roleRows.length === 0) {
      return json({ error: "Master admin access required" }, 403);
    }

    const body = await req.json();
    const bankProductId = body?.bankProductId;
    const thresholdPct = Math.max(0, finiteNumberOrNull(body?.thresholdPct) ?? 0);
    const notes = normalizeText(body?.notes) || "Manual admin price-delta review";

    if (!isUuid(bankProductId)) return json({ error: "bankProductId required" }, 400);

    const { data: bankProduct, error: productError } = await serviceClient
      .from("supplier_bank_products")
      .select("id,supplier_id,supplier_product_key,product_family,name_da")
      .eq("id", bankProductId)
      .single();

    if (productError || !bankProduct) return json({ error: "Bank product not found" }, 404);

    const { data: snapshots, error: snapshotsError } = await serviceClient
      .from("supplier_bank_price_snapshots")
      .select("id,normalized_price_rows,created_at,metadata")
      .eq("bank_product_id", bankProductId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (snapshotsError) throw snapshotsError;
    if (!Array.isArray(snapshots) || snapshots.length < 2) {
      return json({ error: "At least two price snapshots are required before creating a delta review" }, 409);
    }

    const [newSnapshot, oldSnapshot] = snapshots;

    const { data: existingReview, error: existingError } = await serviceClient
      .from("supplier_bank_price_delta_reviews")
      .select("id,status")
      .eq("bank_product_id", bankProductId)
      .eq("old_price_snapshot_id", oldSnapshot.id)
      .eq("new_price_snapshot_id", newSnapshot.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingReview) {
      return json({
        error: "A delta review already exists for the latest two snapshots",
        reviewId: existingReview.id,
        status: existingReview.status,
      }, 409);
    }

    const result = compareNormalizedRows(
      oldSnapshot.normalized_price_rows || [],
      newSnapshot.normalized_price_rows || [],
      thresholdPct,
    );
    const totalDelta = result.changed.reduce((sum, change) => sum + change.delta, 0);
    const reviewRecord = {
      supplier_id: bankProduct.supplier_id,
      bank_product_id: bankProduct.id,
      old_price_snapshot_id: oldSnapshot.id,
      new_price_snapshot_id: newSnapshot.id,
      supplier_product_key: bankProduct.supplier_product_key,
      product_family: bankProduct.product_family,
      old_snapshot_path: oldSnapshot.metadata?.snapshotPath || null,
      new_snapshot_path: newSnapshot.metadata?.snapshotPath || null,
      threshold_pct: thresholdPct,
      status: "draft",
      change_summary: {
        oldRows: result.oldRows,
        newRows: result.newRows,
        changedRows: result.changed.length,
        increasedRows: result.changed.filter((change) => change.delta > 0).length,
        decreasedRows: result.changed.filter((change) => change.delta < 0).length,
        addedRows: result.added.length,
        removedRows: result.removed.length,
        unchangedRows: result.unchanged,
        duplicateOldKeys: result.duplicateOldKeys,
        duplicateNewKeys: result.duplicateNewKeys,
        netChangedRowDeltaDkk: Number(totalDelta.toFixed(2)),
      },
      changed_rows: result.changed.map(compactDeltaRow),
      added_rows: result.added.map(compactAddedRemovedRow),
      removed_rows: result.removed.map(compactAddedRemovedRow),
      notes,
      created_by: user.id,
    };

    const { data: review, error: reviewError } = await serviceClient
      .from("supplier_bank_price_delta_reviews")
      .insert(reviewRecord)
      .select("id,supplier_id,bank_product_id,supplier_product_key,product_family,old_snapshot_path,new_snapshot_path,threshold_pct,status,change_summary,notes,created_at")
      .single();

    if (reviewError) throw reviewError;

    return json({
      review,
      summary: reviewRecord.change_summary,
      oldPriceSnapshotId: oldSnapshot.id,
      newPriceSnapshotId: newSnapshot.id,
    });
  } catch (error) {
    console.error("supplier-bank-create-delta-review error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
