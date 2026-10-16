-- Migration 001 — Advance / booking payments
-- Run this once in the Supabase SQL Editor if you created your database
-- before this feature was added. Safe to run multiple times.

alter table public.payments
  add column if not exists is_advance boolean default false;
