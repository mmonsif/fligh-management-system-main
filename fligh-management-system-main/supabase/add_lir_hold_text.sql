-- ============================================================================
-- Migration: free-text hold entries for the Loading Instruction Report (LIR)
-- ----------------------------------------------------------------------------
-- Adds two nullable text columns to loading_instruction_holds so a load planner
-- can enter a note such as "remaining" in a compartment before the bag count is
-- known. The numeric columns (planned_bags / actual_bags) are unchanged and keep
-- driving all totals; the text is shown verbatim until it is replaced by a number.
--
-- Safe to run repeatedly (add column if not exists).
-- Run this in the Supabase SQL editor if the LIR shows "remaining" as NIL.
-- ============================================================================

alter table public.loading_instruction_holds
  add column if not exists planned_text text;

alter table public.loading_instruction_holds
  add column if not exists actual_text text;

-- The app reads/writes these columns directly through PostgREST, so the existing
-- row-level-security policies already cover them. Nothing else to change.
