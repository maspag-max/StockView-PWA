/**
 * Layout + Sidebar co-locate nello stesso file.
 *
 * Usato da AlertsPage (e pagine future). Home e StockPage
 * usano la propria struttura inline in App.jsx con AppSidebar.
 *
 * Layout:
 *   flex h-screen overflow-hidden
 *   └─ Sidebar (240px fissi)
 *   └─ colonna destra
 *        ├─ NavBar (topbar h-12, si auto-configura in base alla route)
 *        └─ area contenuto (flex-1, overflow-y-auto)
 *
 * Sidebar accetta `ticker` opzionale per evidenziare il titolo attivo
 * nella watchlist (placeholder per futura integrazione nel componente Watchlist).
 */
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBar from './NavBar';
import ThemeToggle from './ThemeToggle';
import Watchlist from '../Watchlist';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6v2.586l-.707.707A1 1 0 0 0 4 13h12a1 1 0 0 0 .707-1.707L16 10.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z" clipRule="evenodd" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ ticker = null }) {
  const location = useLocation();

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
    staleTime: 60_000,
  });
  const activeAlertCount = alerts.filter((a) => a.active).length;

  const navItems = [
    { to: '/',       icon: <HomeIcon />, label: 'Home' },
    { to: '/alerts', icon: <BellIcon />, label: 'Alert', badge: activeAlertCount },
  ];

  return (
    <aside className="w-60 shrink-0 h-screen flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center h-12 px-5 border-b border-slate-200 dark:border-slate-800 shrink-0"
      >
        <span className="text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
          StockView
        </span>
      </Link>

      {/* Nav */}
      <nav className="px-3 pt-3 pb-2 space-y-0.5 shrink-0">
        {navItems.map(({ to, icon, label, badge }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {icon}
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto text-[10px] font-medium bg-rose-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Watchlist */}
      <div className="flex-1 overflow-y-auto px-3 py-3 border-t border-slate-200 dark:border-slate-800 min-h-0">
        <Watchlist inSidebar />
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-600">v2.1</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function Layout({ children, ticker = null }) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar ticker={ticker} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <NavBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
