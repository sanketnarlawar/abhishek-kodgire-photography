-- Migration 004 — Add party details, items list, and extra charges to expenses
-- Run this once in the Supabase SQL Editor.
-- Safe to run multiple times.

alter table public.expenses
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists transportation numeric default 0,
  add column if not exists other_charges numeric default 0;

-- Clean up duplicate column if it was previously created
alter table public.expenses
  drop column if exists mobile_number;

-- Optional index for faster searches by party name
create index if not exists idx_expenses_name on public.expenses (owner_id, name);
