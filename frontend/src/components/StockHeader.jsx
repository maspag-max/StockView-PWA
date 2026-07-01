import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt(v, d = 2) { return v != null ? v.toFixed(d) : '—'; }

function formatMarketCap(v) {
  if (v == null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v}`;
}

function formatVolume(v) {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

function deriveQuote(prices) {
  if (!prices || prices.length < 2) {
    return { price: null, changePct: null, changeAbs: null, open: null, high: null, low: null, volume: null };
  }
  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  return {
    price:     last.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    changeAbs: last.close - prev.close,
    open:      last.open,
    high:      last.high,
    low:       last.low,
    volume:    last.volume ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ExchangeBadge({ label }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
                     bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {label}
    </span>
  );
}

function CurrencyToggle({ currency, onChange }) {
  return (
    <div className="flex items-center rounded overflow-hidden border border-slate-200 dark:border-slate-700">
      {['USD', 'EUR'].map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            currency === c
              ? 'bg-sky-600 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function WatchlistButton({ inWatchlist, isPending, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${inWatchlist
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'border border-sky-600 text-sky-600 bg-transparent hover:bg-sky-50 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-950'
                  }`}
    >
      {inWatchlist ? '✓ In watchlist' : '+ Watchlist'}
    </button>
  );
}

// Cell 4 — 52-week range with mini progress bar
function RangeCell({ low52, high52, price, fmtPrice }) {
  let pct = null;
  if (low52 != null && high52 != null && high52 > low52 && price != null) {
    pct = Math.min(100, Math.max(0, ((price - low52) / (high52 - low52)) * 100));
  }

  return (
    <div className="flex flex-col justify-center gap-1.5 px-5 min-w-[140px]">
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
        Range 52W
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{fmtPrice(low52)}</span>
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden min-w-[48px]">
          {pct != null && (
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{fmtPrice(high52)}</span>
      </div>
    </div>
  );
}

// Cell 5 — intraday range with mini progress bar
function DayRangeCell({ dayLow, dayHigh, price, fmtPrice }) {
  let pct = null;
  if (dayLow != null && dayHigh != null && dayHigh > dayLow && price != null) {
    pct = Math.min(100, Math.max(0, ((price - dayLow) / (dayHigh - dayLow)) * 100));
  }

  return (
    <div className="flex flex-col justify-center gap-1.5 px-5 min-w-[140px]">
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
        Intervallo giornaliero
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{fmtPrice(dayLow)}</span>
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden min-w-[48px]">
          {pct != null && (
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{fmtPrice(dayHigh)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StockHeader({ ticker }) {
  const [currency, setCurrency] = useState('USD');
  const queryClient = useQueryClient();

  const metaQ      = useQuery({ queryKey: ['meta', ticker],         queryFn: () => api.getStock(ticker) });
  const pricesQ    = useQuery({ queryKey: ['prices', ticker, '1m'], queryFn: () => api.getPrices(ticker, '1m') });
  const fundQ      = useQuery({ queryKey: ['fundamentals', ticker], queryFn: () => api.getFundamentals(ticker) });
  const watchlistQ = useQuery({ queryKey: ['watchlist'],            queryFn: api.getWatchlist });
  const fxQ        = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: api.getExchangeRate,
    staleTime: 60 * 60 * 1000,
  });

  const rate = fxQ.data?.rate ?? null;

  function convert(usdValue) {
    if (usdValue == null) return null;
    return currency === 'EUR' && rate ? usdValue / rate : usdValue;
  }

  function fmtPrice(usdValue, decimals = 2) {
    const v = convert(usdValue);
    if (v == null) return '—';
    const sym = currency === 'EUR' ? '€' : '$';
    return `${sym}${v.toFixed(decimals)}`;
  }

  const inWatchlist = watchlistQ.data?.some((w) => w.symbol === ticker) ?? false;

  const addMutation = useMutation({
    mutationFn: () => api.addToWatchlist(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });
  const removeMutation = useMutation({
    mutationFn: () => api.removeFromWatchlist(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  // 404 — ticker non trovato
  if (metaQ.error?.message?.includes('API 404')) {
    return (
      <div className="h-20 flex items-center px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
          Ticker non trovato: {ticker}
        </span>
      </div>
    );
  }

  const meta = metaQ.data;
  const { price, changePct, changeAbs, volume } = deriveQuote(pricesQ.data);
  const fund = fundQ.data;

  const changePositive = changePct != null && changePct >= 0;
  const changeColor = changePct == null
    ? 'text-slate-400 dark:text-slate-500'
    : changePositive
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="flex h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">

      {/* Cell 1 — Identità titolo */}
      <div className="flex flex-col justify-center px-5 gap-0.5 min-w-[180px] border-r border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none">
            {ticker}
          </span>
          <ExchangeBadge label={meta?.exchange} />
          <WatchlistButton
            inWatchlist={inWatchlist}
            isPending={addMutation.isPending || removeMutation.isPending}
            onClick={() => inWatchlist ? removeMutation.mutate() : addMutation.mutate()}
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
          {meta?.name ?? <span className="animate-pulse">caricamento…</span>}
        </span>
        {meta?.sector && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
            {meta.sector}
          </span>
        )}
      </div>

      {/* Cell 2 — Prezzo + toggle valuta */}
      <div className="flex flex-col justify-center px-5 gap-1 min-w-[130px] border-r border-slate-200 dark:border-slate-800">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Prezzo
        </span>
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-none">
          {price != null ? fmtPrice(price) : <span className="text-slate-300 dark:text-slate-700">—</span>}
        </span>
        <CurrencyToggle currency={currency} onChange={setCurrency} />
      </div>

      {/* Cell 3 — Variazione giornaliera */}
      <div className="flex flex-col justify-center px-5 gap-0.5 min-w-[110px] border-r border-slate-200 dark:border-slate-800">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Oggi
        </span>
        <span className={`text-base font-semibold leading-none ${changeColor}`}>
          {changePct != null ? `${changePositive ? '+' : ''}${fmt(changePct)}%` : '—'}
        </span>
        <span className={`text-xs ${changeColor}`}>
          {changeAbs != null ? `${changePositive ? '+' : ''}${fmtPrice(changeAbs)}` : '—'}
        </span>
      </div>

      {/* Cell 4 — Range 52 settimane */}
      <div className="border-r border-slate-200 dark:border-slate-800">
        <RangeCell
          low52={fund?.fifty_two_week_low}
          high52={fund?.fifty_two_week_high}
          price={price}
          fmtPrice={fmtPrice}
        />
      </div>

      {/* Cell 5 — Intervallo giornaliero */}
      <div className="border-r border-slate-200 dark:border-slate-800">
        <DayRangeCell
          dayLow={fund?.day_low}
          dayHigh={fund?.day_high}
          price={price}
          fmtPrice={fmtPrice}
        />
      </div>

      {/* Cell 6 — Market cap + volume */}
      <div className="flex flex-col justify-center px-5 gap-0.5 min-w-[120px]">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Mercato
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {formatMarketCap(fund?.market_cap ?? null)}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Vol {formatVolume(volume ?? fund?.volume ?? null)}
        </span>
      </div>

    </div>
  );
}
