# Istruzioni per Claude Code — StockView

Questo file viene letto automaticamente da Claude Code all'avvio. Contiene le
convenzioni del progetto e il piano di implementazione incrementale.

## Lingua

- **Codice, commenti, identificatori**: inglese
- **Commit message**: inglese (Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`)
- **Comunicazione con l'utente**: italiano
- **Documentazione (SPEC, README, ADR)**: italiano

## Approccio operativo

Massimo lavora **one-step-at-a-time**. Non implementare più di un task per
turno senza aver mostrato il risultato e atteso conferma. Per ogni task:

1. Mostra cosa stai per fare e perché
2. Implementa il minimo necessario per quel task
3. Verifica (test, run, curl) che funzioni
4. Riassumi cosa è cambiato e quale è il prossimo task naturale

## Piano di implementazione (ordine consigliato)

### Fase 0 — Setup ambiente
- [ ] `cd backend && python -m venv .venv && source .venv/bin/activate`
- [ ] `pip install -e .` (legge `pyproject.toml`)
- [ ] `cd ../frontend && npm install`
- [ ] Copia `.env.example` in `.env` e compila le chiavi
- [ ] Crea progetto Supabase, esegui `supabase/schema.sql`

### Fase 1 — Backend bare bones
- [ ] `app/main.py` con FastAPI + endpoint `/health`
- [ ] `app/config.py` con `Settings` Pydantic da env
- [ ] `app/db.py` con client Supabase
- [ ] Verificare: `uvicorn app.main:app --reload` parte e `/health` risponde

### Fase 2 — Market data
- [ ] `services/market_data.py` con wrapper `get_prices(ticker, range)` su yfinance
- [ ] Fallback Finnhub se yfinance fallisce (utile dietro proxy INAIL)
- [ ] Cache in `price_history_cache`
- [ ] Endpoint `/api/stocks/{ticker}/prices`
- [ ] Test con `curl localhost:8000/api/stocks/AAPL/prices?range=3y`

### Fase 3 — Fondamentali + consensus
- [ ] `services/fundamentals.py` (P/E, P/B, ROE, ecc da yfinance.info)
- [ ] Endpoint `/api/stocks/{ticker}/fundamentals`
- [ ] `services/consensus.py` via Finnhub `/stock/recommendation` e `/stock/price-target`
- [ ] Endpoint `/api/stocks/{ticker}/consensus`

### Fase 4 — News
- [ ] `services/news.py` via Finnhub `/company-news`
- [ ] Sentiment già fornito da Finnhub, no analisi custom necessaria
- [ ] Endpoint `/api/stocks/{ticker}/news`

### Fase 5 — Narrative AI
- [ ] `prompts/templates.py` con prompt + JSON schema (vedere file esistente)
- [ ] `services/narrative.py` con chiamata Anthropic + parsing JSON + cache
- [ ] Endpoint `/api/stocks/{ticker}/narrative`
- [ ] **Critico**: validare JSON output con Pydantic prima di restituire

### Fase 6 — Frontend scheletro
- [ ] `App.jsx` con routing minimal (`/` e `/stock/:ticker`)
- [ ] `SearchBar.jsx` con autocomplete ticker (chiamata a `/api/search`)
- [ ] `StockHeader.jsx` con metadati base
- [ ] `PriceChart.jsx` con Recharts area chart

### Fase 7 — Frontend sezioni AI
- [ ] `BusinessSummary.jsx`, `Outlook.jsx`, `SwotCard.jsx` che consumano `/narrative`
- [ ] Stato loading con skeleton, errore con retry
- [ ] Pulsante "Rigenera analisi" che chiama `POST /narrative/refresh`

### Fase 8 — Watchlist + tesi
- [ ] CRUD watchlist (4 endpoint + componente)
- [ ] Editor tesi (textarea con autosave debounced)

### Fase 9 — Hardening
- [ ] Rate limit Anthropic (cap mensile)
- [ ] Logging strutturato
- [ ] Test e2e su un ticker noto (AAPL)
- [ ] README con istruzioni deploy

## Convenzioni codice

### Python

- Python 3.11+, type hints ovunque
- Pydantic v2 per modelli; nessun dict non tipizzato in firma pubblica
- `ruff` per linting, `black` per format (config in `pyproject.toml`)
- Async tutto ciò che fa I/O di rete; `httpx.AsyncClient` non `requests`
- Niente classi quando una funzione basta
- File max ~300 righe; oltre si spezza per dominio

### React

- Functional components + hooks
- TanStack Query per ogni fetch (niente `useEffect + fetch` a mano)
- File `.jsx` (non TS per ora, semplicità)
- Tailwind classes, niente CSS custom se non strettamente necessario
- Componenti max ~150 righe

### Git

- Branch `main` protetto, feature branch per ogni task non triviale
- Commit atomici, un cambiamento logico per commit
- Mai committare `.env` o chiavi API

## Vincoli ambiente

### PC personale (`maspa`)
Niente proxy. Stack funziona nativo.

### Workstation INAIL (`xf49862`)
NTLM proxy. Configurazione:

```bash
export HTTP_PROXY="http://proxy.inail.it:8080"
export HTTPS_PROXY="http://proxy.inail.it:8080"
export NO_PROXY="localhost,127.0.0.1"
```

Per `pip`: usa `--proxy $HTTP_PROXY` o configura `pip.conf`.
Per `npm`: `npm config set proxy $HTTP_PROXY && npm config set https-proxy $HTTPS_PROXY`.
Per Anthropic SDK: rispetta `HTTPS_PROXY` automaticamente via `httpx`.
yfinance dietro proxy NTLM può fallire silenziosamente — sempre testare e
attivare fallback Finnhub.

## Cosa NON fare

- Non implementare auth, multi-utente, o feature out-of-scope dello SPEC senza
  proposta esplicita e approvazione
- Non aggiungere dipendenze pesanti (pandas-ta, scikit-learn, ecc) senza valutarle
- Non scrivere previsioni numeriche di prezzo direttamente nel prompt LLM
- Non rimuovere il disclaimer dal frontend
- Non cachare dati prezzo per più di 1h durante orari di mercato
