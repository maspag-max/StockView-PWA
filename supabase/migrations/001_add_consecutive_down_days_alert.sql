-- Migration 001: add consecutive_down_days alert kind
-- Run in Supabase SQL editor. Idempotent.

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_kind_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_kind_check
    CHECK (kind IN (
        'price_above',
        'price_below',
        'earnings_in_days',
        'news_keyword',
        'consecutive_down_days'
    ));
