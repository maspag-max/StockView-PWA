-- StockView schema for Supabase (Postgres)
-- Run in Supabase SQL editor or via `psql`.
-- Idempotent: safe to re-run.

-- =====================================================================
-- 1. Anagrafica ticker
-- =====================================================================
CREATE TABLE IF NOT EXISTS tickers (
    symbol        TEXT PRIMARY KEY,            -- es. AAPL, MSFT, VWCE.DE
    exchange      TEXT,                        -- NASDAQ, NYSE, XETRA, ...
    name          TEXT NOT NULL,
    sector        TEXT,
    industry      TEXT,
    country       TEXT,
    currency      TEXT,
    isin          TEXT,
    instrument    TEXT CHECK (instrument IN ('stock','etf','reit','adr')),
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickers_isin ON tickers(isin);
CREATE INDEX IF NOT EXISTS idx_tickers_sector ON tickers(sector);

-- =====================================================================
-- 2. Cache narrative AI (sezioni 1, 2, 4, 5 dello SPEC)
-- =====================================================================
CREATE TABLE IF NOT EXISTS narrative_cache (
    id            BIGSERIAL PRIMARY KEY,
    symbol        TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
    lang          TEXT NOT NULL DEFAULT 'it',
    payload       JSONB NOT NULL,              -- output completo del prompt
    model         TEXT NOT NULL,               -- es. claude-sonnet-4-6
    input_hash    TEXT NOT NULL,               -- sha256 degli input usati
    created_at    TIMESTAMPTZ DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_narrative_lookup
    ON narrative_cache (symbol, lang, expires_at DESC);

-- =====================================================================
-- 3. Cache prezzi storici (OHLCV daily)
-- =====================================================================
CREATE TABLE IF NOT EXISTS price_history_cache (
    symbol        TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
    date          DATE NOT NULL,
    open          NUMERIC(16,6),
    high          NUMERIC(16,6),
    low           NUMERIC(16,6),
    close         NUMERIC(16,6),
    adj_close     NUMERIC(16,6),
    volume        BIGINT,
    fetched_at    TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (symbol, date)
);
CREATE INDEX IF NOT EXISTS idx_prices_symbol_date
    ON price_history_cache (symbol, date DESC);

-- =====================================================================
-- 4. Cache fondamentali e multipli
-- =====================================================================
CREATE TABLE IF NOT EXISTS fundamentals_cache (
    symbol        TEXT PRIMARY KEY REFERENCES tickers(symbol) ON DELETE CASCADE,
    payload       JSONB NOT NULL,              -- P/E, P/B, ROE, debt/eq, yield, ecc.
    fetched_at    TIMESTAMPTZ DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
);

-- =====================================================================
-- 5. Cache analyst consensus
-- =====================================================================
CREATE TABLE IF NOT EXISTS consensus_cache (
    symbol        TEXT PRIMARY KEY REFERENCES tickers(symbol) ON DELETE CASCADE,
    target_mean   NUMERIC(16,6),
    target_high   NUMERIC(16,6),
    target_low    NUMERIC(16,6),
    n_analysts    INTEGER,
    rating_dist   JSONB,                       -- {strongBuy, buy, hold, sell, strongSell}
    fetched_at    TIMESTAMPTZ DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
);

-- =====================================================================
-- 6. Cache news
-- =====================================================================
CREATE TABLE IF NOT EXISTS news_cache (
    id            BIGSERIAL PRIMARY KEY,
    symbol        TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
    headline      TEXT NOT NULL,
    url           TEXT NOT NULL,
    source        TEXT,
    published_at  TIMESTAMPTZ NOT NULL,
    sentiment     NUMERIC(4,3),                -- -1..+1
    summary       TEXT,
    fetched_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_symbol_pub
    ON news_cache (symbol, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_news_symbol_url
    ON news_cache (symbol, url);

-- =====================================================================
-- 7. Watchlist (utente singolo, no auth per ora)
-- =====================================================================
CREATE TABLE IF NOT EXISTS watchlist (
    symbol        TEXT PRIMARY KEY REFERENCES tickers(symbol) ON DELETE CASCADE,
    added_at      TIMESTAMPTZ DEFAULT now(),
    notes         TEXT
);

-- =====================================================================
-- 8. Tesi di investimento personale
-- =====================================================================
CREATE TABLE IF NOT EXISTS investment_thesis (
    symbol        TEXT PRIMARY KEY REFERENCES tickers(symbol) ON DELETE CASCADE,
    thesis        TEXT NOT NULL,               -- 2-10 righe, perché ho/voglio comprare
    target_horizon TEXT,                       -- short/mid/long
    invalidation  TEXT,                        -- cosa mi farebbe cambiare idea
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Storico revisioni tesi (audit trail)
CREATE TABLE IF NOT EXISTS investment_thesis_history (
    id            BIGSERIAL PRIMARY KEY,
    symbol        TEXT NOT NULL,
    thesis        TEXT NOT NULL,
    target_horizon TEXT,
    invalidation  TEXT,
    revised_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_thesis_history_symbol
    ON investment_thesis_history (symbol, revised_at DESC);

-- =====================================================================
-- 9. Alert
-- =====================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id            BIGSERIAL PRIMARY KEY,
    symbol        TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('price_above','price_below','earnings_in_days','news_keyword')),
    config        JSONB NOT NULL,              -- es. {"threshold": 250.00} oppure {"days": 7}
    active        BOOLEAN NOT NULL DEFAULT true,
    last_triggered TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(symbol, active) WHERE active = true;

-- =====================================================================
-- 10. Trigger per updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickers_touch ON tickers;
CREATE TRIGGER trg_tickers_touch BEFORE UPDATE ON tickers
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_thesis_touch ON investment_thesis;
CREATE TRIGGER trg_thesis_touch BEFORE UPDATE ON investment_thesis
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =====================================================================
-- 11. Vista helper: narrative valida più recente per ticker+lang
-- =====================================================================
CREATE OR REPLACE VIEW v_latest_narrative AS
SELECT DISTINCT ON (symbol, lang)
    symbol, lang, payload, model, input_hash, created_at, expires_at
FROM narrative_cache
WHERE expires_at > now()
ORDER BY symbol, lang, created_at DESC;
