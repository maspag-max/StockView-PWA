import { useQuery } from '@tanstack/react-query';
import { Grid, Text } from '@tremor/react';
import { api } from '../lib/api';

const it = (v, minD, maxD) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: minD, maximumFractionDigits: maxD }).format(v);

function format(value, fmt) {
  if (value == null) return '—';
  switch (fmt) {
    case 'ratio':      return it(value, 2, 2);
    case 'pct':        return it(value * 100, 1, 1) + '%';
    case 'pct_direct': return it(value, 2, 2) + '%';
    case 'price':      return it(value, 2, 2) + ' USD';
    case 'eps':        return it(value, 2, 2) + ' USD';
    case 'large_usd':
      if (value >= 1e12) return it(value / 1e12, 1, 1) + ' T USD';
      if (value >= 1e9)  return it(value / 1e9,  1, 1) + ' Mld USD';
      if (value >= 1e6)  return it(value / 1e6,  1, 1) + ' Mln USD';
      return it(value, 0, 0) + ' USD';
    case 'large_num':
      if (value >= 1e12) return it(value / 1e12, 1, 1) + ' T';
      if (value >= 1e9)  return it(value / 1e9,  1, 1) + ' Mld';
      if (value >= 1e6)  return it(value / 1e6,  1, 1) + ' Mln';
      return it(value, 0, 0);
    default: return String(value);
  }
}

const SECTIONS = [
  {
    label: 'Valutazione', borderClass: 'border-blue-500 dark:border-blue-400', titleClass: 'text-blue-500 dark:text-blue-400',
    rows: [
      { key: 'pe_trailing',    label: 'P/E trailing',  fmt: 'ratio' },
      { key: 'pe_forward',     label: 'P/E forward',   fmt: 'ratio' },
      { key: 'price_to_book',  label: 'P/B',           fmt: 'ratio' },
      { key: 'price_to_sales', label: 'P/S',           fmt: 'ratio' },
      { key: 'ev_to_ebitda',   label: 'EV/EBITDA',     fmt: 'ratio' },
      { key: 'peg_ratio',      label: 'PEG',           fmt: 'ratio' },
    ],
  },
  {
    label: 'Redditività', borderClass: 'border-emerald-500 dark:border-emerald-400', titleClass: 'text-emerald-500 dark:text-emerald-400',
    rows: [
      { key: 'roe',              label: 'ROE',              fmt: 'pct' },
      { key: 'roa',              label: 'ROA',              fmt: 'pct' },
      { key: 'profit_margin',    label: 'Profit margin',    fmt: 'pct' },
      { key: 'gross_margin',     label: 'Gross margin',     fmt: 'pct' },
      { key: 'operating_margin', label: 'Operating margin', fmt: 'pct' },
      { key: 'ebitda_margin',    label: 'EBITDA margin',    fmt: 'pct' },
    ],
  },
  {
    label: 'Crescita', borderClass: 'border-orange-500 dark:border-orange-400', titleClass: 'text-orange-500 dark:text-orange-400',
    rows: [
      { key: 'revenue_growth',  label: 'Revenue growth YoY',  fmt: 'pct' },
      { key: 'earnings_growth', label: 'Earnings growth YoY', fmt: 'pct' },
    ],
  },
  {
    label: 'Bilancio', borderClass: 'border-amber-500 dark:border-amber-400', titleClass: 'text-amber-500 dark:text-amber-400',
    rows: [
      { key: 'debt_to_equity', label: 'Debt/Equity',   fmt: 'ratio' },
      { key: 'current_ratio',  label: 'Current ratio', fmt: 'ratio' },
      { key: 'quick_ratio',    label: 'Quick ratio',   fmt: 'ratio' },
    ],
  },
  {
    label: 'Dividendo', borderClass: 'border-violet-500 dark:border-violet-400', titleClass: 'text-violet-500 dark:text-violet-400',
    rows: [
      { key: 'dividend_yield', label: 'Dividend yield', fmt: 'pct_direct' },
      { key: 'payout_ratio',   label: 'Payout ratio',  fmt: 'pct' },
    ],
  },
  {
    label: 'Mercato', borderClass: 'border-cyan-500 dark:border-cyan-400', titleClass: 'text-cyan-500 dark:text-cyan-400',
    rows: [
      { key: 'market_cap',          label: 'Market cap',      fmt: 'large_usd' },
      { key: 'beta',                label: 'Beta',            fmt: 'ratio' },
      { key: 'fifty_two_week_high', label: '52w high',        fmt: 'price' },
      { key: 'fifty_two_week_low',  label: '52w low',         fmt: 'price' },
      { key: 'shares_outstanding',  label: 'Azioni in circ.', fmt: 'large_num' },
    ],
  },
  {
    label: 'Cash flow & EPS', borderClass: 'border-rose-500 dark:border-rose-400', titleClass: 'text-rose-500 dark:text-rose-400',
    rows: [
      { key: 'total_revenue', label: 'Revenue TTM',    fmt: 'large_usd' },
      { key: 'free_cashflow', label: 'Free cash flow', fmt: 'large_usd' },
      { key: 'eps_trailing',  label: 'EPS trailing',   fmt: 'eps' },
      { key: 'eps_forward',   label: 'EPS forward',    fmt: 'eps' },
    ],
  },
];

function SectionCard({ section, fund }) {
  return (
    <div className={`bg-slate-50 dark:bg-slate-800 rounded-xl shadow p-6 border-2 ${section.borderClass}`}>
      <p className={`text-sm font-bold uppercase tracking-wide mb-3 ${section.titleClass}`}>
        {section.label}
      </p>
      <dl className="space-y-0.5">
        {section.rows.map((row) => (
          <div key={row.key} className="flex justify-between items-baseline py-0.5">
            <dt className="text-sm text-slate-500 dark:text-slate-400 truncate pr-2">
              {row.label}
            </dt>
            <dd className="text-sm font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {format(fund[row.key], row.fmt)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function FundamentalsTable({ ticker }) {
  const { data: fund, isLoading, isError } = useQuery({
    queryKey: ['fundamentals', ticker],
    queryFn: () => api.getFundamentals(ticker),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">
        Caricamento fondamentali…
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-rose-500 dark:text-rose-400">
        Impossibile caricare i fondamentali.
      </p>
    );
  }

  const fetchedAt = fund.fetched_at
    ? new Date(fund.fetched_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
        Fondamentali
      </h2>
      <Grid numItemsSm={2} numItemsLg={3} className="gap-4">
        {SECTIONS.map((section) => (
          <SectionCard key={section.label} section={section} fund={fund} />
        ))}
      </Grid>
      {fetchedAt && (
        <Text className="mt-2 text-slate-400 dark:text-slate-500">
          Dati aggiornati al {fetchedAt}
        </Text>
      )}
    </div>
  );
}
