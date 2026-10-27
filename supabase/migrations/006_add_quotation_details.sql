-- Migration 006 — Quotation PDF details (services, deliverables, schedule, payments, delivery status)
-- Run this once in the Supabase SQL Editor before saving quotations with the new app version.
-- Safe to run multiple times.

alter table public.quotations
  add column if not exists details jsonb default '{}'::jsonb;
