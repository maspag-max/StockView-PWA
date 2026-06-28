import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ThemeToggle from './components/layout/ThemeToggle';
import ProtectedRoute from './components/ProtectedRoute';
import { api } from './lib/api';
import SearchBar from './components/SearchBar';
import Watchlist from './components/Watchlist';
import StockHeader from './components/StockHeader';
import PriceChart from './components/PriceChart';
import FundamentalsTable from './components/FundamentalsTable';
import NewsFeed from './components/NewsFeed';
import ThesisEditor from './components/ThesisEditor';
import NarrativeSection from './components/NarrativeSection';
import AlertsPage from './pages/AlertsPage';
import LoginPage from './pages/LoginPage';

// ---------------------------------------------------------------------------
// Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

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

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
    staleTime: 60_000,
  });
  const activeAlertCount = alerts.filter((a) => a.active).length;

  const navItems = [
    { to: '/', icon: <HomeIcon />, label: 'Home' },
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

      {/* User / logout */}
      <div className="shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 text-xs text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
            title="Esci"
          >
            Esci
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-600">v2.1</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Disclaimer
// ---------------------------------------------------------------------------

function Disclaimer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 text-xs text-slate-400 dark:text-slate-500 text-center">
      I contenuti di questa applicazione sono generati automaticamente a partire
      da fonti pubbliche e da modelli linguistici. Non costituiscono consulenza
      finanziaria, raccomandazione di investimento o sollecitazione all&apos;acquisto
      o alla vendita di strumenti finanziari. L&apos;utente è l&apos;unico responsabile
      delle proprie decisioni di investimento.
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function Home() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-8 px-6 py-12">
          <div className="text-center">
            <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">
              Cerca un titolo
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Analisi personale di azioni ed ETF
            </p>
          </div>
          <SearchBar />
        </main>
        <Disclaimer />
      </div>
    </div>
  );
}

function StockPage() {
  const { ticker } = useParams();
  const metaQ = useQuery({ queryKey: ['meta', ticker], queryFn: () => api.getStock(ticker) });
  const tickerNotFound = metaQ.error?.message?.includes('API 404');

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* KPI bar — redesignato in Step 5 */}
        <div id="section-overview">
          <StockHeader ticker={ticker} />
        </div>
        {/* Contenuto scorrevole */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
            {!tickerNotFound && <PriceChart ticker={ticker} />}
            {!tickerNotFound && (
              <div id="section-fundamentals">
                <FundamentalsTable ticker={ticker} />
              </div>
            )}
            {!tickerNotFound && <NewsFeed ticker={ticker} />}
            {!tickerNotFound && (
              <div id="section-thesis">
                <ThesisEditor ticker={ticker} />
              </div>
            )}
            {!tickerNotFound && (
              <div id="section-ai">
                <NarrativeSection ticker={ticker} />
              </div>
            )}
          </div>
          <Disclaimer />
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/stock/:ticker" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
