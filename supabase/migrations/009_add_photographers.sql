-- Migration 009 — Photographers directory
-- Run this once in the Supabase SQL Editor. Safe to run multiple times.

create table if not exists public.photographers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz default now()
);

create index if not exists idx_photographers_owner on public.photographers (owner_id);
create unique index if not exists idx_photographers_owner_name on public.photographers (owner_id, lower(name));

alter table public.photographers enable row level security;

drop policy if exists "owner_all" on public.photographers;
create policy "owner_all" on public.photographers
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
