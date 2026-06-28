-- Migration 003: add price_change_pct alert kind
-- Run in Supabase SQL editor. Idempotent.

ALTER TABLE alerts
  DROP CONSTRAINT IF EXISTS alerts_kind_check;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_kind_check
  CHECK (kind IN (
    'consecutive_down_days',
    'consecutive_up_days',
    'price_change_pct'
  ));
