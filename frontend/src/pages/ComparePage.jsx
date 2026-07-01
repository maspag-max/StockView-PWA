import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Card, LineChart } from '@tremor/react';
import { BarChart3 } from 'lucide-react';
import Layout from '../components/layout/Layout';
import TickerAutocomplete from '../components/TickerAutocomplete';
import { api } from '../lib/api';

const RANGES   = ['1g', '1s', '1m', '3m', '6m', '1y', '3y'];
const LABELS   = ['1G', '1S', '1M', '3M', '6M', '1A', '3A'];
const MAX_TICKERS = 5;

// Tremor color names and matching Tailwind bg classes (same order)
const COLORS       = ['blue', 'emerald', 'orange', 'violet', 'rose'];
const COLOR_DOTS   = ['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-violet-500', 'bg-rose-500'];

const TODAY = new Date().toISOString().slice(0, 10);

const inputCls = [
  'rounded-md border border-slate-300 dark:border-slate-600',
  'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100',
  'text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500',
  '[color-scheme:light] dark:[color-scheme:dark]',
].join(' ');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcPct(prices) {
  if (!prices || prices.length < 2) return null;
  return ((prices[prices.length - 1].close - prices[0].close) / prices[0].close) * 100;
}

function fmtPct(pct) {
  if (pct == null) return '—';
  return (pct >= 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + '%';
}

function pctCls(pct) {
  if (pct == null) return 'text-slate-400 dark:text-slate-500';
  return pct >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';
}

// ---------------------------------------------------------------------------
// ComparePage
// ---------------------------------------------------------------------------

export default function ComparePage() {
  const [slots,          setSlots]          = useState([{ value: '', name: '' }]);
  const [start,          setStart]          = useState('');
  const [end,            setEnd]            = useState('');
  const [compareClicked, setCompareClicked] = useState(false);

  const selectedTickers = slots
    .map(s => s.value.trim().toUpperCase())
    .filter(Boolean);

  // ── Returns table: all ranges × all selected tickers ──────────────────────
  // Flat array: [ticker0×range0, ticker0×range1 … ticker0×range6, ticker1×range0 …]
  const tableQueries = useQueries({
    queries: selectedTickers.flatMap(ticker =>
      RANGES.map(range => ({
        queryKey: ['prices', ticker, range],
        queryFn:  () => api.getPrices(ticker, range),
        staleTime: 60_000,
      }))
    ),
  });

  function getTablePct(tickerIdx, rangeIdx) {
    const q = tableQueries[tickerIdx * RANGES.length + rangeIdx];
    if (!q || q.isLoading || !q.data) return null;
    return calcPct(q.data);
  }

  // ── Comparison chart: 'max' history for each selected ticker ──────────────
  const maxQueries = useQueries({
    queries: selectedTickers.map(ticker => ({
      queryKey: ['prices', ticker, 'max'],
      queryFn:  () => api.getPrices(ticker, 'max'),
      enabled:  compareClicked,
      staleTime: 60_000,
    })),
  });

  const isMaxLoading = compareClicked && maxQueries.some(q => q.isLoading);

  function buildChartData() {
    if (!compareClicked || selectedTickers.length === 0) return [];

    const filtered = selectedTickers.map((_, i) => {
      const prices = maxQueries[i]?.data;
      if (!prices) return null;
      return prices.filter(p => (!start || p.date >= start) && (!end || p.date <= end));
    });

    if (filtered.some(f => f === null)) return [];

    // Merge all dates into one sorted set
    const dateSet = new Set();
    filtered.forEach(series => series.forEach(p => dateSet.add(p.date)));
    const dates = [...dateSet].sort();

    // Per-ticker lookup maps and first-price for normalisation
    const maps        = filtered.map(series => new Map(series.map(p => [p.date, p.close])));
    const firstPrices = filtered.map(series => series.length > 0 ? series[0].close : null);

    return dates.map(date => {
      const row = { date };
      selectedTickers.forEach((ticker, i) => {
        const price = maps[i].get(date);
        if (price != null && firstPrices[i] != null) {
          row[ticker] = parseFloat(((price / firstPrices[i]) * 100 - 100).toFixed(2));
        }
      });
      return row;
    });
  }

  const chartData = buildChartData();

  // Final % values for the custom legend
  const finalValues = selectedTickers.map(ticker => {
    const last = [...chartData].reverse().find(d => d[ticker] != null);
    return last ? last[ticker] : null;
  });

  // ── Slot handlers ──────────────────────────────────────────────────────────

  function addSlot() {
    if (slots.length < MAX_TICKERS) setSlots(s => [...s, { value: '', name: '' }]);
  }

  function removeSlot(idx) {
    setSlots(s => s.filter((_, i) => i !== idx));
    setCompareClicked(false);
  }

  function changeValue(idx, val) {
    setSlots(s => s.map((slot, i) => i === idx ? { value: val, name: '' } : slot));
    setCompareClicked(false);
  }

  function selectTicker(idx, sym, name) {
    setSlots(s => s.map((slot, i) => i === idx ? { value: sym, name } : slot));
    setCompareClicked(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <main className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Confronta titoli
        </h1>

        {/* ── Ticker slots ──────────────────────────────────────────────── */}
        <Card>
          <div className="flex flex-col gap-3">
            {slots.map((slot, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <TickerAutocomplete
                    value={slot.value}
                    onChange={val => changeValue(idx, val)}
                    onSelect={(sym, name) => selectTicker(idx, sym, name)}
                    placeholder={`Ticker ${idx + 1} (es. AAPL)`}
                  />
                  {slot.name && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      {slot.name}
                    </p>
                  )}
                </div>

                {slot.value.trim() && (
                  <div className={`w-3 h-3 rounded-full mt-2.5 shrink-0 ${COLOR_DOTS[idx]}`} />
                )}

                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    aria-label="Rimuovi ticker"
                    className="mt-1.5 text-xl leading-none shrink-0 text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {slots.length < MAX_TICKERS && (
              <button
                type="button"
                onClick={addSlot}
                className="self-start text-sm text-sky-600 dark:text-sky-400 hover:underline"
              >
                + Aggiungi titolo
              </button>
            )}
          </div>
        </Card>

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {selectedTickers.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20
                          text-slate-400 dark:text-slate-500">
            <BarChart3 className="w-12 h-12" />
            <p className="text-sm">
              Seleziona almeno un titolo per iniziare il confronto
            </p>
          </div>
        )}

        {/* ── Returns table ─────────────────────────────────────────────── */}
        {selectedTickers.length > 0 && (
          <Card>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Rendimenti per periodo
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Ticker
                    </th>
                    {LABELS.map(l => (
                      <th key={l} className="text-right py-2 px-3 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedTickers.map((ticker, ti) => (
                    <tr key={ticker} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOTS[ti]}`} />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {ticker}
                          </span>
                        </div>
                      </td>
                      {RANGES.map((_, ri) => {
                        const pct = getTablePct(ti, ri);
                        return (
                          <td key={ri} className={`py-2.5 px-3 text-right tabular-nums font-medium ${pctCls(pct)}`}>
                            {fmtPct(pct)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Comparison chart ──────────────────────────────────────────── */}
        {selectedTickers.length > 0 && (
          <Card>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Performance normalizzata
            </p>

            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Inizio</label>
                <input
                  type="date"
                  value={start}
                  max={end || TODAY}
                  onChange={e => { setStart(e.target.value); setCompareClicked(false); }}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Fine</label>
                <input
                  type="date"
                  value={end}
                  min={start}
                  max={TODAY}
                  onChange={e => { setEnd(e.target.value); setCompareClicked(false); }}
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() => setCompareClicked(true)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white
                           hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Confronta
              </button>
            </div>

            {isMaxLoading && (
              <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm animate-pulse">
                Caricamento dati storici…
              </div>
            )}

            {compareClicked && !isMaxLoading && chartData.length < 2 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nessun dato disponibile nel periodo selezionato.
              </p>
            )}

            {compareClicked && !isMaxLoading && chartData.length >= 2 && (
              <>
                {/* Custom legend */}
                <div className="flex flex-wrap gap-4 mb-3">
                  {selectedTickers.map((ticker, i) => {
                    const val = finalValues[i];
                    return (
                      <div key={ticker} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOTS[i]}`} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {ticker}
                        </span>
                        {val != null && (
                          <span className={`text-xs tabular-nums ${pctCls(val)}`}>
                            {val >= 0 ? '+' : ''}{val.toFixed(1).replace('.', ',')}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <LineChart
                  className="h-72 mt-2"
                  data={chartData}
                  index="date"
                  categories={selectedTickers}
                  colors={COLORS.slice(0, selectedTickers.length)}
                  curveType="monotone"
                  showLegend={false}
                  showAnimation={false}
                  autoMinValue
                  yAxisWidth={58}
                  valueFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                />
              </>
            )}
          </Card>
        )}

      </main>
    </Layout>
  );
}
