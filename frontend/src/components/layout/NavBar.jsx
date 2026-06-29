import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ThemeToggle from './ThemeToggle';
import { api } from '../../lib/api';

// Sezioni a cui i chip tab fanno scroll — i wrapper con questi id
// vengono aggiunti in StockPage (App.jsx).
const TABS = [
  { id: 'section-overview',      label: 'Overview' },
  { id: 'section-fundamentals',  label: 'Fondamentali' },
  { id: 'section-ai',            label: 'AI' },
  { id: 'section-thesis',        label: 'Tesi' },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Avatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center shrink-0">
      <span className="text-xs font-medium text-sky-600 dark:text-sky-400 select-none">M</span>
    </div>
  );
}

function TopBarShell({ left, center, right }) {
  return (
    <header className="h-12 shrink-0 flex items-center gap-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5">
      <div className="shrink-0">{left}</div>
      <div className="flex-1 flex justify-center min-w-0">{center}</div>
      <div className="shrink-0 flex items-center gap-3">{right}</div>
    </header>
  );
}

function Breadcrumb({ children }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <Link
        to="/"
        className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        StockView
      </Link>
      <span className="text-slate-300 dark:text-slate-700 select-none">›</span>
      {children}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Variante StockPage
// ---------------------------------------------------------------------------

function StockTopBar({ ticker }) {
  const { data: meta } = useQuery({
    queryKey: ['meta', ticker],
    queryFn: () => api.getStock(ticker),
    staleTime: 60_000,
  });

  return (
    <TopBarShell
      left={
        <Breadcrumb>
          <span className="text-slate-800 dark:text-slate-200 font-medium">{ticker}</span>
          {meta?.name && (
            <>
              <span className="text-slate-300 dark:text-slate-700 select-none">·</span>
              <span className="text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                {meta.name}
              </span>
            </>
          )}
        </Breadcrumb>
      }
      center={
        <div className="flex items-center gap-0.5">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className="px-3 py-1 rounded-full text-xs font-medium
                         text-slate-500 dark:text-slate-400
                         hover:bg-slate-100 dark:hover:bg-slate-800
                         hover:text-slate-900 dark:hover:text-slate-100
                         transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      }
      right={
        <>
          <ThemeToggle />
          <Avatar />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Export — si auto-configura in base alla route corrente
// ---------------------------------------------------------------------------

export default function NavBar() {
  const { ticker } = useParams();
  if (ticker) return <StockTopBar ticker={ticker} />;
  return null;
}
