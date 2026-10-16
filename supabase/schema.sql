-- ============================================================
--  Photography Studio Management — Database Schema
--  Run this entire file once in the Supabase SQL Editor
--  (Supabase Dashboard -> SQL Editor -> New query -> paste -> Run)
-- ============================================================

-- Helper: every table is scoped to the logged-in studio owner.
-- owner_id defaults to the current authenticated user.

-- ---------- Business Profile ----------
create table if not exists public.business_profile (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  studio_name text,
  phone text,
  email text,
  address text,
  upi_id text,
  upi_payee_name text,
  logo_url text,
  terms text,
  invoice_prefix text default 'INV',
  quotation_prefix text default 'QT',
  created_at timestamptz default now()
);

-- ---------- Clients ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

-- ---------- Service Packages ----------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  event_type text,
  items jsonb default '[]'::jsonb,
  default_price numeric default 0,
  created_at timestamptz default now()
);

-- ---------- Invoices ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_number text not null,
  client_id uuid references public.clients (id) on delete set null,
  event_type text,
  event_date date,
  issue_date date default now(),
  items jsonb default '[]'::jsonb,
  discount numeric default 0,
  subtotal numeric default 0,
  total numeric default 0,
  notes text,
  status text default 'Unpaid',
  created_at timestamptz default now()
);

-- ---------- Quotations ----------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quotation_number text not null,
  client_id uuid references public.clients (id) on delete set null,
  event_type text,
  event_date date,
  issue_date date default now(),
  valid_until date,
  items jsonb default '[]'::jsonb,
  discount numeric default 0,
  subtotal numeric default 0,
  total numeric default 0,
  notes text,
  status text default 'Draft',
  created_at timestamptz default now()
);

-- ---------- Payments ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  amount numeric not null default 0,
  payment_date date default now(),
  mode text default 'UPI',
  note text,
  is_advance boolean default false,
  created_at timestamptz default now()
);

-- ---------- Expenses ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expense_date date default now(),
  category text,
  description text,
  amount numeric not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
--  Row Level Security (RLS)
--  Ensures each owner can only see and change their own data.
-- ============================================================

alter table public.business_profile enable row level security;
alter table public.clients          enable row level security;
alter table public.packages         enable row level security;
alter table public.invoices         enable row level security;
alter table public.quotations       enable row level security;
alter table public.payments         enable row level security;
alter table public.expenses         enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'business_profile','clients','packages','invoices','quotations','payments','expenses'
  ]
  loop
    execute format('drop policy if exists "owner_all" on public.%I;', t);
    execute format(
      'create policy "owner_all" on public.%I
         for all
         using (owner_id = auth.uid())
         with check (owner_id = auth.uid());',
      t
    );
  end loop;
end $$;

-- ---------- Helpful indexes ----------
create index if not exists idx_clients_owner    on public.clients (owner_id);
create index if not exists idx_invoices_owner   on public.invoices (owner_id);
create index if not exists idx_quotations_owner on public.quotations (owner_id);
create index if not exists idx_payments_invoice on public.payments (invoice_id);
create index if not exists idx_expenses_owner   on public.expenses (owner_id);
