# StockView

Webapp personale per analisi azionaria assistita da AI. Per ogni ticker mostra
una scheda con: sintesi attività, prospettive, grafico 3Y, SWOT e outlook di
mercato, costruita combinando dati di mercato pubblici con narrative generata
da Claude.

> ⚠️ Non è uno strumento di consulenza finanziaria. Vedere disclaimer in app.

## Documenti

- [`SPEC.md`](SPEC.md) — design completo del sistema
- [`CLAUDE.md`](CLAUDE.md) — istruzioni per Claude Code (lettura automatica)
- [`supabase/schema.sql`](supabase/schema.sql) — schema database

## Stack

- **Backend**: FastAPI + Python 3.11+
- **Frontend**: React 18 + Vite + Tailwind + Recharts
- **Database**: Supabase (Postgres managed)
- **Dati di mercato**: yfinance (primario), Finnhub (fallback)
- **AI**: Anthropic API (claude-sonnet-4-6)

## Quickstart

### Prerequisiti

- Python 3.11+
- Node 20+
- Account Supabase (free tier OK)
- API key Anthropic
- API key Finnhub free tier (https://finnhub.io)

### Setup

```bash
# 1. Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .

# 2. Frontend
cd ../frontend
npm install

# 3. Config
cp .env.example .env
# Compilare ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY, FINNHUB_API_KEY

# 4. Database
# Su Supabase dashboard → SQL editor → incolla contenuto di supabase/schema.sql

# 5. Run (in due terminali)
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

Backend su `http://localhost:8000`, frontend su `http://localhost:5173`.

## Avvio con Claude Code

```bash
cd stockview
claude
```

Claude Code legge automaticamente `CLAUDE.md` e propone il prossimo task del
piano. Lavorare un task alla volta, verificando l'output prima di passare al
successivo.

## Dietro proxy aziendale (INAIL)

Vedere sezione dedicata in `CLAUDE.md`.

## Struttura

```
stockview/
├── SPEC.md              # Design doc
├── CLAUDE.md            # Istruzioni Claude Code
├── README.md            # Questo file
├── backend/             # FastAPI app
│   ├── pyproject.toml
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── db.py
│       ├── api/         # Route handlers
│       ├── services/    # Logica business
│       ├── prompts/     # Template LLM
│       └── models.py    # Pydantic
├── frontend/            # React + Vite
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── components/
│       └── lib/
└── supabase/
    └── schema.sql
```

## Licenza

Uso personale. Niente licenza pubblica per ora.
