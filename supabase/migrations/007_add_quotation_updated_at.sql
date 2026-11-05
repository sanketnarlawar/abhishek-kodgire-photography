-- Migration 007 — Quotation "last edited" timestamp
-- Run this once in the Supabase SQL Editor.
-- Safe to run multiple times.

alter table public.quotations
  add column if not exists updated_at timestamptz;

create or replace function public.set_quotation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quotations_set_updated_at on public.quotations;
create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function public.set_quotation_updated_at();
