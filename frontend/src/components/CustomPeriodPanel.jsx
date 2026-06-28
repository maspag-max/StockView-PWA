import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, AreaChart, Button } from '@tremor/react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

const TODAY = new Date().toISOString().slice(0, 10);
const ONE_YEAR_AGO = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
})();

function calcPct(prices) {
  if (!prices || prices.length < 2) return null;
  return ((prices[prices.length - 1].close - prices[0].close) / prices[0].close) * 100;
}

function fmtPct(pct) {
  if (pct == null) return '—';
  return (pct >= 0 ? '+' : '') + pct.toFixed(2).replace('.', ',') + '%';
}

function autoFormat(dateStr, durationDays) {
  const d = new Date(dateStr + 'T00:00:00');
  if (durationDays <= 90)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  if (durationDays <= 548)
    return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
}

// Injects print CSS, opens browser print dialog, cleans up after 2s
function triggerPrint() {
  const existing = document.getElementById('sv-print-style');
  if (existing) existing.parentNode.removeChild(existing);

  const style = document.createElement('style');
  style.id = 'sv-print-style';
  style.textContent = `
    @page { size: A4 portrait; margin: 1.5cm; }
    @media print {
      body > *:not(#sv-print) { display: none !important; }
      #sv-print {
        display: block !important;
        position: static !important;
        top: auto !important; left: auto !important;
        width: 100% !important; height: auto !important;
        overflow: visible !important;
        font-family: system-ui, -apple-system, sans-serif;
        color: #111111 !important;
        background-color: #ffffff !important;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => {
    const el = document.getElementById('sv-print-style');
    if (el) el.parentNode.removeChild(el);
  }, 2000);
}

export default function CustomPeriodPanel({ ticker, maxPrices, maxLoading, onNeedMaxData, rangeStats }) {
  const [start, setStart] = useState(ONE_YEAR_AGO);
  const [end,   setEnd]   = useState(TODAY);
  const [calcClicked, setCalcClicked] = useState(false);

  const metaQ = useQuery({ queryKey: ['meta', ticker], queryFn: () => api.getStock(ticker) });
  const fxQ   = useQuery({ queryKey: ['exchange-rate'], queryFn: api.getExchangeRate, staleTime: 60 * 60 * 1000 });
  const rate  = fxQ.data?.rate ?? null;

  function handleCalcola() {
    onNeedMaxData();
    setCalcClicked(true);
  }

  const durationDays = Math.round((new Date(end) - new Date(start)) / 86400000);
  const filtered     = calcClicked && maxPrices
    ? maxPrices.filter(p => p.date >= start && p.date <= end)
    : null;
  const customPct  = calcPct(filtered);
  const chartData  = filtered?.map(p => ({
    date:    autoFormat(p.date, durationDays),
    isoDate: p.date,
    Chiusura: p.close,
  })) ?? [];

  const hasResult = calcClicked && !maxLoading && filtered && filtered.length >= 2;
  const noData    = calcClicked && !maxLoading && filtered && filtered.length < 2;
  const pctCls    = customPct == null ? '' :
    customPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  // ── Excel Export (SheetJS community edition — widths only, no bold) ────────
  function handleExportXLSX() {
    if (!filtered || filtered.length < 2) return;
    const firstClose = filtered[0].close;
    const wb = XLSX.utils.book_new();

    // Foglio 1 — Dati periodo
    const dataRows = [
      ['Data', 'Prezzo USD', 'Prezzo EUR', 'Variazione% cumulativa'],
      ...filtered.map(p => {
        const varPct = (p.close - firstClose) / firstClose * 100;
        return [
          p.date,
          parseFloat(p.close.toFixed(2)),
          rate ? parseFloat((p.close / rate).toFixed(2)) : '',
          parseFloat(varPct.toFixed(2)),
        ];
      }),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(dataRows);
    ws1['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Dati periodo');

    // Foglio 2 — Riepilogo periodi
    const summaryRows = [
      ['Periodo', 'Variazione%'],
      ...rangeStats.map(({ label, pct }) => [label, pct != null ? parseFloat(pct.toFixed(2)) : '']),
      [`Personalizzato (${start} - ${end})`, customPct != null ? parseFloat(customPct.toFixed(2)) : ''],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws2['!cols'] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Riepilogo periodi');

    XLSX.writeFile(wb, `StockView_${ticker}_${start}_${end}.xlsx`);
  }

  // ── Shared input style ─────────────────────────────────────────────────────
  const inputCls = [
    'rounded-md border border-slate-300 dark:border-slate-600',
    'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100',
    'text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500',
    '[color-scheme:light] dark:[color-scheme:dark]', // calendar icon follows theme
  ].join(' ');

  // ── Print area cell helper (always explicit colours) ───────────────────────
  const th = { backgroundColor: '#1e3a5f', color: '#ffffff', padding: '6px 10px', textAlign: 'left', fontSize: '12px' };
  const td = { padding: '5px 10px', fontSize: '12px', borderBottom: '1px solid #e2e8f0', color: '#111111', backgroundColor: '#ffffff' };

  const metaName = metaQ.data?.name;

  return (
    <>
      {/* ── Visible panel ─────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Periodo personalizzato
        </p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">Inizio</label>
            <input type="date" value={start} max={end}
              onChange={e => { setStart(e.target.value); setCalcClicked(false); }}
              className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">Fine</label>
            <input type="date" value={end} min={start} max={TODAY}
              onChange={e => { setEnd(e.target.value); setCalcClicked(false); }}
              className={inputCls} />
          </div>
          <Button size="sm" onClick={handleCalcola} loading={calcClicked && maxLoading}>
            Calcola
          </Button>
        </div>

        {calcClicked && maxLoading && (
          <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">
            Caricamento dati storici…
          </p>
        )}

        {noData && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nessun dato disponibile nel periodo selezionato.
          </p>
        )}

        {hasResult && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">Variazione periodo:</span>
              <span className={`text-xl font-bold tabular-nums ${pctCls}`}>{fmtPct(customPct)}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {start} → {end} &middot; {filtered.length} sessioni
              </span>
            </div>
            <AreaChart
              className="h-44"
              data={chartData}
              index="date"
              categories={['Chiusura']}
              colors={['violet']}
              curveType="monotone"
              showLegend={false}
              showAnimation={false}
              autoMinValue
              yAxisWidth={58}
              valueFormatter={v => `$${v.toFixed(2)}`}
            />
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <Button size="sm" variant="secondary" onClick={handleExportXLSX}>Esporta Excel</Button>
              <Button size="sm" variant="secondary" onClick={triggerPrint}>Esporta PDF</Button>
            </div>
          </>
        )}
      </Card>

      {/* ── Print portal — off-screen but rendered so Recharts measures width ─ */}
      {createPortal(
        <div
          id="sv-print"
          aria-hidden="true"
          style={{
            position: 'fixed', top: '-200vh', left: 0,
            width: '794px', background: '#ffffff', color: '#111111',
            fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0',
          }}
        >
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', color: '#111111' }}>
            {metaName ? `${metaName} (${ticker})` : ticker}
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
            Report del {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '16px 0 8px', color: '#1e3a5f' }}>
            Variazioni per periodo
          </h2>
          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '12px' }}>
            <thead>
              <tr><th style={th}>Periodo</th><th style={th}>Variazione</th></tr>
            </thead>
            <tbody>
              {rangeStats.map(({ label, pct }) => (
                <tr key={label}>
                  <td style={td}>{label}</td>
                  <td style={{ ...td, color: pct == null ? '#94a3b8' : pct >= 0 ? '#16a34a' : '#dc2626', fontWeight: pct != null ? 600 : 400 }}>
                    {fmtPct(pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {customPct != null && filtered && (
            <>
              <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '16px 0 8px', color: '#1e3a5f' }}>
                Periodo personalizzato
              </h2>
              <div style={{ backgroundColor: '#f0f9ff', borderLeft: '3px solid #0284c7', padding: '8px 12px', marginBottom: '16px', fontSize: '13px', color: '#111111' }}>
                <strong>{start} → {end}</strong>:{' '}
                <span style={{ color: customPct >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: '16px' }}>
                  {fmtPct(customPct)}
                </span>
                {' '}({filtered.length} sessioni)
              </div>
              {chartData.length >= 2 && (
                <div style={{ width: '100%', height: '220px' }}>
                  <AreaChart
                    className="h-full"
                    data={chartData}
                    index="date"
                    categories={['Chiusura']}
                    colors={['blue']}
                    curveType="monotone"
                    showLegend={false}
                    showAnimation={false}
                    autoMinValue
                    yAxisWidth={58}
                    valueFormatter={v => `$${v.toFixed(2)}`}
                  />
                </div>
              )}
            </>
          )}

          <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            Generato automaticamente da fonti pubbliche. Non costituisce consulenza finanziaria.
          </p>
        </div>,
        document.body
      )}
    </>
  );
}
