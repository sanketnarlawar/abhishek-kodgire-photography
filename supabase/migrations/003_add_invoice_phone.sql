-- Migration 003 — WhatsApp phone stored on each invoice
-- Run this once in the Supabase SQL Editor before saving invoices with the new app version.
-- Safe to run multiple times.

alter table public.invoices
  add column if not exists phone text;
