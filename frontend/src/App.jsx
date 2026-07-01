import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import { api } from './lib/api';
import SearchBar from './components/SearchBar';
import StockHeader from './components/StockHeader';
import PriceChart from './components/PriceChart';
import FundamentalsTable from './components/FundamentalsTable';
import NewsFeed from './components/NewsFeed';
import ThesisEditor from './components/ThesisEditor';
import NarrativeSection from './components/NarrativeSection';
import LoginPage from './pages/LoginPage';
import AlertsPage from './pages/AlertsPage';
import ComparePage from './pages/ComparePage';

// ---------------------------------------------------------------------------
// Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

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
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="text-center">
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">
            Cerca un titolo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Analisi personale di azioni ed ETF
          </p>
        </div>
        <SearchBar />
      </div>
      <Disclaimer />
    </Layout>
  );
}

function StockPage() {
  const { ticker } = useParams();
  const metaQ = useQuery({ queryKey: ['meta', ticker], queryFn: () => api.getStock(ticker) });
  const tickerNotFound = metaQ.error?.message?.includes('API 404');

  return (
    <Layout>
      {/* StockHeader sticky at top of scroll container */}
      <div id="section-overview" className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <StockHeader ticker={ticker} />
      </div>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
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
    </Layout>
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
              <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
