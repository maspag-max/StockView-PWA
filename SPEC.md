# StockView — Design Document

**Versione:** 0.1 (scaffold iniziale)
**Autore:** Massimo Spagnuolo
**Data:** 2026-06-23
**Status:** Bozza approvata per implementazione

---

## 1. Obiettivo

Costruire una webapp personale che, dato un ticker azionario o ISIN ETF, restituisca
in un'unica scheda:

1. Sintesi delle attività della società.
2. Prospettive di sviluppo del business.
3. Grafico dell'andamento delle quotazioni (default 3 anni, configurabile).
4. Punti di forza e debolezza (SWOT compresso F/W con cenno a O/T).
5. Outlook di borsa basato su consensus analisti + multipli + earnings recenti.

Più una serie di moduli accessori (fondamentali, peer comparison, news, watchlist,
tesi personale di investimento).

L'app è strettamente personale, single-user, locale. Non è un servizio rivolto a
terzi e non eroga consulenza finanziaria. Ogni output narrativo è preceduto da
disclaimer esplicito.

## 2. Architettura

```
┌──────────────┐      ┌───────────────────┐      ┌─────────────────┐
│   Frontend   │ ───► │   Backend FastAPI │ ───► │ Provider esterni│
│ React + Vite │      │   (Python 3.11+)  │      │ yfinance, FH,   │
│   Recharts   │ ◄─── │                   │ ◄─── │ NewsAPI, Anthrop│
└──────────────┘      └─────────┬─────────┘      └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Supabase      │
                       │  (Postgres +    │
                       │   cache layer)  │
                       └─────────────────┘
```

Due processi separati in dev (`uvicorn` su :8000, `vite` su :5173). Niente
monorepo tool: due `package.json`/`pyproject.toml` separati, comunicazione via
REST JSON.

## 3. Stack

| Layer        | Scelta                              | Motivazione                                   |
|--------------|-------------------------------------|------------------------------------------------|
| Backend      | FastAPI + Pydantic v2               | Tipizzazione forte, OpenAPI gratis, async     |
| Market data  | yfinance (primario) + Finnhub (fb)  | yfinance gratis, Finnhub per news + consensus |
| News         | Finnhub free tier                   | 60 req/min sufficienti per uso personale      |
| LLM          | Anthropic API (claude-sonnet-4-6)   | JSON mode, output strutturato                 |
| DB / Cache   | Supabase (Postgres + REST)          | Già usato in VerbaleVP162                     |
| Frontend     | React 18 + Vite                     | Velocità HMR, build snello                    |
| Charting     | Recharts                            | API React-native, leggero                     |
| Styling      | Tailwind CSS                        | Niente CSS custom da gestire                  |
| HTTP client  | TanStack Query (frontend)           | Cache, retry, stale-while-revalidate          |

## 4. Modello dati (Supabase)

Schema completo in `supabase/schema.sql`. Tabelle:

- `tickers` — anagrafica ticker normalizzati (symbol, exchange, name, sector, industry, country, isin)
- `narrative_cache` — JSON delle sezioni narrative (TTL 24h, key = ticker+section+lang)
- `price_history_cache` — OHLCV giornaliero (TTL 1h durante mercato aperto, 24h chiuso)
- `fundamentals_cache` — multipli e ratios (TTL 24h)
- `news_cache` — news con sentiment (TTL 6h)
- `watchlist` — elenco ticker seguiti con timestamp aggiunta
- `investment_thesis` — tesi personale scritta dall'utente per ticker (no TTL, persistente)
- `alerts` — soglie prezzo, earnings imminenti, news rilevanti

Tutte le tabelle cache hanno colonna `expires_at` e indice su `(key, expires_at)`.

## 5. Sezioni narrative — modello LLM

Una singola chiamata `generate_full_analysis(ticker, context)` produce un JSON
con tutte e cinque le sezioni. Il prompt riceve in input:

- Profilo società (settore, descrizione business da yfinance.info)
- Ultimi 4 trimestri di revenue/EPS (actual vs estimate)
- Guidance management (se disponibile dalle ultime news)
- Consensus analisti corrente (target medio, range, n. analisti, rating distribution)
- Multipli vs media settore
- Top 5 news ultime 30 giorni

Output JSON schema in `backend/app/prompts/templates.py`. Ogni sezione include
campo `sources` con riferimenti ai dati usati, per tracciabilità.

Il prompt esplicita che:

- Non deve generare previsioni numeriche specifiche di prezzo non basate su consensus
- Deve distinguere tra fatti documentati e opinioni di mercato
- Deve usare hedging linguistico appropriato ("gli analisti stimano", non "il titolo salirà")
- Restituisce `confidence_level` (low/medium/high) per ogni sezione in base alla qualità dei dati input

## 6. API endpoints (backend)

```
GET  /api/stocks/{ticker}                    → metadati base
GET  /api/stocks/{ticker}/prices?range=3y    → OHLCV
GET  /api/stocks/{ticker}/fundamentals       → multipli e ratios
GET  /api/stocks/{ticker}/news?limit=10      → news feed
GET  /api/stocks/{ticker}/consensus          → analyst consensus
GET  /api/stocks/{ticker}/peers?n=5          → competitor stessa industry
GET  /api/stocks/{ticker}/narrative          → 5 sezioni AI (cache 24h)
POST /api/stocks/{ticker}/narrative/refresh  → forza regenerazione

GET  /api/watchlist                          → lista watchlist
POST /api/watchlist                          → aggiungi ticker
DEL  /api/watchlist/{ticker}                 → rimuovi

GET  /api/thesis/{ticker}                    → tesi personale
PUT  /api/thesis/{ticker}                    → salva/aggiorna

GET  /api/alerts                             → alert attivi
POST /api/alerts                             → crea alert
```

## 7. Frontend — layout pagina ticker

```
┌─────────────────────────────────────────────────────┐
│ [Logo] [SearchBar..............] [Watchlist] [⚙]    │
├─────────────────────────────────────────────────────┤
│ AAPL · Apple Inc. · NASDAQ · Technology             │
│ $234.50  +1.2%  ·  MCap $3.5T  ·  P/E 32.1          │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌─────────────────────┐ │
│ │  Grafico 3Y             │ │  Tesi personale     │ │
│ │  [1M 3M 6M 1Y 3Y 5Y MAX]│ │  (editabile)        │ │
│ └─────────────────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Attività     │ │ Prospettive  │ │ Outlook      │ │
│ │ (AI)         │ │ (AI)         │ │ (AI + cons.) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐  │
│ │ Forza / Debolezza    │ │ Fondamentali + Peers │  │
│ │ (AI)                 │ │ Tabella comparativa  │  │
│ └──────────────────────┘ └──────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ News feed (Finnhub) — ultime 10 con sentiment       │
├─────────────────────────────────────────────────────┤
│ Disclaimer: contenuto generato da AI, non consulen. │
└─────────────────────────────────────────────────────┘
```

## 8. Funzionalità aggiuntive (post-MVP)

In ordine di priorità per il caso d'uso personale:

1. **Tesi di investimento persistente** — campo libero per ticker, riproposto a ogni apertura
2. **Calendario earnings + storico beat/miss**
3. **Peer comparison side-by-side** su multipli
4. **Indicatori tecnici opzionali** (RSI, MACD, MA50/200) per timing PAC
5. **Modalità ETF** (top holdings, breakdown geo/settore, TER, tracking diff)
6. **Alert prezzo e earnings** con notifica via email (Resend / Mailgun)
7. **Export PDF della scheda** per archivio decisioni
8. **Storico delle proprie viste** (audit trail delle revisioni di tesi)

## 9. Vincoli operativi

- **Postazione corporate INAIL**: NTLM proxy. Variabili `HTTP_PROXY` e
  `HTTPS_PROXY` settate in `.env.local`. yfinance fallisce dietro proxy in
  alcuni casi; fallback automatico a Finnhub per dati prezzo.
- **PC personale**: nessun proxy, default OK.
- **Chiavi API**: tutte in `.env` (mai committate). Schema in `.env.example`.
- **Costi**: Anthropic API cap mensile soft a $20/mese (alert via dashboard).
  Cache aggressiva su narrative (24h) per contenerli.

## 10. Disclaimer e responsabilità

Ogni pagina ticker mostra in footer:

> I contenuti di questa applicazione sono generati automaticamente a partire
> da fonti pubbliche e da modelli linguistici. Non costituiscono consulenza
> finanziaria, raccomandazione di investimento o sollecitazione all'acquisto
> o alla vendita di strumenti finanziari. L'utente è l'unico responsabile
> delle proprie decisioni di investimento.

Disclaimer ripetuto anche nei tooltip delle sezioni AI-generated.

## 11. Out of scope (per ora)

- Multi-utente / auth
- Trading reale / connessione broker
- Portfolio tracker (lo fa già Trade Republic, niente duplicazioni)
- Backtesting di strategie
- Dati real-time tick-by-tick (gli intraday giornalieri bastano)
- Mobile app nativa (responsive web è sufficiente)
