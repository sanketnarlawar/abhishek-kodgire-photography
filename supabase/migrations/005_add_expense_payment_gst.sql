-- Migration 005 — Add GST charges and payment details to expenses
-- Run this once in the Supabase SQL Editor.
-- Safe to run multiple times.

alter table public.expenses
  add column if not exists gst_charges numeric default 0,
  add column if not exists payment_mode text,
  add column if not exists payment_ref text;
