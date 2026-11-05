-- Migration 008 — Invoice numbers must be unique per owner
-- Run this once in the Supabase SQL Editor. Safe to run multiple times.
--
-- If it stops with "Duplicate invoice numbers exist", list them with:
--   select invoice_number, count(*), array_agg(id) from public.invoices
--   group by owner_id, invoice_number having count(*) > 1;
-- Rename the extra ones (Invoices tab -> Edit), then run this file again.

do $$
begin
  if exists (
    select 1 from public.invoices
    group by owner_id, invoice_number
    having count(*) > 1
  ) then
    raise exception 'Duplicate invoice numbers exist. Rename them first (see the query at the top of this file).';
  end if;
end $$;

create unique index if not exists idx_invoices_owner_number
  on public.invoices (owner_id, invoice_number);
