-- Migration 002 — Items / Services Catalog
-- Run this once in the Supabase SQL Editor if you want items saved permanently
-- in their own table across all devices. Safe to run multiple times.

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  unit text default 'Photo',
  rate numeric default 0,
  created_at timestamptz default now()
);

-- Ensure fast search & uniqueness per studio owner
create index if not exists idx_items_owner on public.items (owner_id);
create unique index if not exists idx_items_owner_name on public.items (owner_id, lower(name));

-- Enable Row Level Security
alter table public.items enable row level security;

drop policy if exists "owner_all" on public.items;
create policy "owner_all" on public.items
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
