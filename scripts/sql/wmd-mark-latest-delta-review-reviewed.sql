-- Mark the latest WMD supplier-bank delta review as reviewed.
-- Scope: supplier-bank review status only. No product, publishing, or pricing writes.
-- Allowed transition: draft -> reviewed.

with latest_review as (
  select
    r.id,
    r.status,
    r.old_price_snapshot_id,
    r.new_price_snapshot_id,
    r.change_summary
  from public.supplier_bank_price_delta_reviews r
  join public.supplier_bank_products p on p.id = r.bank_product_id
  join public.supplier_bank_suppliers s on s.id = r.supplier_id
  where s.slug = 'wir-machen-druck'
    and p.supplier_product_key = 'wmd-folder-bank'
  order by r.created_at desc
  limit 1
),
updated as (
  update public.supplier_bank_price_delta_reviews r
  set
    status = 'reviewed',
    updated_at = now()
  from latest_review lr
  where r.id = lr.id
    and lr.status = 'draft'
  returning
    r.id,
    r.status,
    r.old_price_snapshot_id,
    r.new_price_snapshot_id,
    r.change_summary,
    r.updated_at
)
select
  'updated' as result,
  u.id as review_id,
  u.status,
  u.old_price_snapshot_id,
  u.new_price_snapshot_id,
  u.change_summary ->> 'changedRows' as changed_rows,
  u.change_summary ->> 'addedRows' as added_rows,
  u.change_summary ->> 'removedRows' as removed_rows,
  u.updated_at
from updated u
union all
select
  'not_updated_latest_status_' || lr.status as result,
  lr.id as review_id,
  lr.status,
  lr.old_price_snapshot_id,
  lr.new_price_snapshot_id,
  lr.change_summary ->> 'changedRows' as changed_rows,
  lr.change_summary ->> 'addedRows' as added_rows,
  lr.change_summary ->> 'removedRows' as removed_rows,
  null::timestamptz as updated_at
from latest_review lr
where not exists (select 1 from updated);
