import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Card, AreaChart, TabGroup, TabList, Tab } from '@tremor/react';
import { api } from '../lib/api';
import CustomPeriodPanel from './CustomPeriodPanel';

const RANGES = ['1g', '1s', '1m', '3m', '6m', '1y', '3y'];
const LABELS = ['1G', '1S', '1M', '3M', '6M', '1A', '3A'];
const PRELOAD_COUNT = 4; // 1g, 1s, 1m, 3m preloaded at mount
const DEFAULT_IDX = 0;  // '1g'

function formatDate(dateStr, range) {
  if (['1g', '1s'].includes(range)) {
    return dateStr.slice(11, 16); // "HH:MM" from "YYYY-MM-DDTHH:MM:SS"
  }
  const d = new Date(dateStr + 'T00:00:00');
  if (['1m', '3m'].includes(range))
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  if (['6m', '1y'].includes(range))
    return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
}

function formatFullDate(dateStr) {
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return d.toLocaleString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
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
  const [rangeIdx,   setRangeIdx]   = useState(DEFAULT_IDX);
  const [maxEnabled, setMaxEnabled] = useState(false);

  // RANGES tabs: 1g, 1s, 1m, 3m, 6m, 1y, 3y — preload first 4.
  const rangeQueries = useQueries({
    queries: RANGES.map((r, i) => ({
      queryKey: ['prices', ticker, r],
      queryFn:  () => api.getPrices(ticker, r),
      enabled:  i < PRELOAD_COUNT || rangeIdx === i,
    })),
  });

  // Separate query for "max" — used only by CustomPeriodPanel, not shown as tab.
  const maxQuery = useQuery({
    queryKey: ['prices', ticker, 'max'],
    queryFn:  () => api.getPrices(ticker, 'max'),
    enabled:  maxEnabled,
  });

  const { data: prices, isLoading, isError } = rangeQueries[rangeIdx];

  const chartData = prices?.map((p) => ({
    date:    formatDate(p.date, RANGES[rangeIdx]),
    isoDate: p.date,
    Chiusura: p.close,
  })) ?? [];

  const rangeStats = RANGES.map((r, i) => ({
    label: LABELS[i],
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
                    <span className="leading-tight">{LABELS[i]}</span>
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
        maxPrices={maxQuery.data}
        maxLoading={maxQuery.isLoading}
        onNeedMaxData={() => setMaxEnabled(true)}
        rangeStats={rangeStats}
      />
    </>
  );
}
