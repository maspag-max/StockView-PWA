// Wrapper around fetch for the StockView backend.
// In dev, Vite proxies /api → http://localhost:8000

import supabase from './supabase';

const BASE = '/api';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path, opts = {}) {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status} on ${path}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  getStock: (ticker) => request(`/stocks/${ticker}`),
  getPrices: (ticker, range = '3y') => request(`/stocks/${ticker}/prices?range=${range}`),
  getFundamentals: (ticker) => request(`/stocks/${ticker}/fundamentals`),
  getNews: (ticker, limit = 10) => request(`/stocks/${ticker}/news?limit=${limit}`),
  getConsensus: (ticker) => request(`/stocks/${ticker}/consensus`),
  getNarrative: (ticker) => request(`/stocks/${ticker}/narrative`),
  refreshNarrative: (ticker) =>
    request(`/stocks/${ticker}/narrative/refresh`, { method: 'POST' }),
  getWatchlist: () => request('/watchlist'),
  addToWatchlist: (ticker) =>
    request('/watchlist', { method: 'POST', body: JSON.stringify({ symbol: ticker }) }),
  removeFromWatchlist: (ticker) =>
    request(`/watchlist/${ticker}`, { method: 'DELETE' }),
  getThesis: (ticker) => request(`/thesis/${ticker}`),
  saveThesis: (ticker, body) =>
    request(`/thesis/${ticker}`, { method: 'PUT', body: JSON.stringify(body) }),
  getExchangeRate: () => request('/exchange-rate'),
  getAlerts: () => request('/alerts'),
  createAlert: (data) => request('/alerts', { method: 'POST', body: JSON.stringify(data) }),
  updateAlert: (id, data) =>
    request(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAlert: (id) => request(`/alerts/${id}`, { method: 'DELETE' }),
};
