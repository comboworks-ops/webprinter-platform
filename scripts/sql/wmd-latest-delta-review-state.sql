-- Read-only WMD supplier-bank delta-review state.
-- Scope: supplier-bank tables only. No product, publishing, or pricing writes.

select
  r.id as review_id,
  r.status,
  r.old_price_snapshot_id,
  r.new_price_snapshot_id,
  r.change_summary ->> 'changedRows' as changed_rows,
  r.change_summary ->> 'addedRows' as added_rows,
  r.change_summary ->> 'removedRows' as removed_rows,
  r.created_at,
  r.updated_at
from public.supplier_bank_price_delta_reviews r
join public.supplier_bank_products p on p.id = r.bank_product_id
join public.supplier_bank_suppliers s on s.id = r.supplier_id
where s.slug = 'wir-machen-druck'
  and p.supplier_product_key = 'wmd-folder-bank'
order by r.created_at desc
limit 3;
