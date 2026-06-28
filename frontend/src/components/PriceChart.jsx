import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Card, AreaChart, TabGroup, TabList, Tab } from '@tremor/react';
import { api } from '../lib/api';
import CustomPeriodPanel from './CustomPeriodPanel';

const RANGES = ['1m', '3m', '6m', '1y', '3y', '5y', 'max'];
const PRELOAD_COUNT = 4; // 1m–1y preloaded at mount; 3y/5y/max only on click
const DEFAULT_IDX = 4;  // '3y'

function formatDate(dateStr, range) {
  const d = new Date(dateStr + 'T00:00:00');
  if (['1m', '3m'].includes(range))
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  if (['6m', '1y'].includes(range))
    return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
}

function formatFullDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function calcPct(prices) {
  if (!prices || prices.length < 2) return null;
  const first = prices[0].close;
  const last  = prices[prices.length - 1].close;
  return ((last - first) / first) * 100;
}

function fmtPct(pct) {
  return (pct >= 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + '%';
}

function PriceTooltip({ payload, active }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{formatFullDate(point.isoDate)}</p>
      <p className="font-semibold text-slate-900 dark:text-slate-100">${point.Chiusura.toFixed(2)}</p>
    </div>
  );
}

export default function PriceChart({ ticker }) {
  const [rangeIdx,    setRangeIdx]    = useState(DEFAULT_IDX);
  const [maxEnabled,  setMaxEnabled]  = useState(false);

  // Single useQueries for all 7 ranges.
  // 1m–1y: always enabled (preload). 3y/5y: on click. max: on click OR when
  // CustomPeriodPanel requests it via onNeedMaxData.
  const rangeQueries = useQueries({
    queries: RANGES.map((r, i) => ({
      queryKey: ['prices', ticker, r],
      queryFn:  () => api.getPrices(ticker, r),
      enabled:  i < PRELOAD_COUNT || rangeIdx === i || (i === 6 && maxEnabled),
    })),
  });

  const { data: prices, isLoading, isError } = rangeQueries[rangeIdx];

  const chartData = prices?.map((p) => ({
    date:    formatDate(p.date, RANGES[rangeIdx]),
    isoDate: p.date,
    Chiusura: p.close,
  })) ?? [];

  const rangeStats = RANGES.map((r, i) => ({
    label: r.toUpperCase(),
    pct:   calcPct(rangeQueries[i].data),
  }));

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Andamento prezzi
          </span>

          <TabGroup index={rangeIdx} onIndexChange={setRangeIdx}>
            <TabList variant="solid">
              {RANGES.map((r, i) => {
                const pct = calcPct(rangeQueries[i].data);
                return (
                  <Tab key={r} className="text-xs !px-2 !py-0.5 flex flex-col items-center gap-0">
                    <span className="leading-tight">{r.toUpperCase()}</span>
                    {pct != null ? (
                      <span className={`text-[10px] leading-tight font-normal tabular-nums ${
                        pct >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                      }`}>
                        {fmtPct(pct)}
                      </span>
                    ) : (
                      <span className="text-[10px] leading-tight font-normal text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </Tab>
                );
              })}
            </TabList>
          </TabGroup>
        </div>

        {isLoading && (
          <div className="h-72 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm animate-pulse">
            Caricamento…
          </div>
        )}

        {isError && (
          <div className="h-72 flex items-center justify-center text-rose-500 dark:text-rose-400 text-sm">
            Errore nel caricamento dei prezzi.
          </div>
        )}

        {!isLoading && !isError && (
          <AreaChart
            className="h-72 mt-2"
            data={chartData}
            index="date"
            categories={['Chiusura']}
            colors={['blue']}
            curveType="monotone"
            showLegend={false}
            showAnimation
            autoMinValue
            yAxisWidth={58}
            valueFormatter={(v) => `$${v.toFixed(2)}`}
            customTooltip={PriceTooltip}
          />
        )}
      </Card>

      <CustomPeriodPanel
        ticker={ticker}
        maxPrices={rangeQueries[6].data}
        maxLoading={rangeQueries[6].isLoading}
        onNeedMaxData={() => setMaxEnabled(true)}
        rangeStats={rangeStats}
      />
    </>
  );
}
