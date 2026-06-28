"""
Prompt templates for stock narrative generation.

Single-shot prompt that produces a structured JSON containing all five
sections required by SPEC.md:

    1. business_summary    — what the company does
    2. growth_outlook      — development prospects
    3. strengths_weaknesses — internal SWOT (F+W) with brief O+T
    4. market_outlook      — analyst consensus + multiples interpretation
    5. confidence_overall  — meta-evaluation of input data quality

The output is parsed and validated with the Pydantic models in
`app.models.narrative`.
"""

from __future__ import annotations

import json
from textwrap import dedent
from typing import Any


# ---------------------------------------------------------------------------
# JSON schema returned by the model. Documented here for traceability;
# the same shape is enforced server-side by Pydantic on parsing.
# ---------------------------------------------------------------------------
NARRATIVE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "business_summary",
        "growth_outlook",
        "strengths",
        "weaknesses",
        "opportunities",
        "threats",
        "market_outlook",
        "confidence_overall",
        "data_caveats",
    ],
    "properties": {
        "business_summary": {
            "type": "object",
            "required": ["text", "confidence", "sources"],
            "properties": {
                "text": {"type": "string", "description": "120-200 parole, italiano, prosa neutra"},
                "confidence": {"enum": ["low", "medium", "high"]},
                "sources": {"type": "array", "items": {"type": "string"}},
            },
        },
        "growth_outlook": {
            "type": "object",
            "required": ["text", "drivers", "risks", "confidence"],
            "properties": {
                "text": {"type": "string", "description": "120-200 parole, hedging esplicito"},
                "drivers": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 6},
                "risks": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 6},
                "confidence": {"enum": ["low", "medium", "high"]},
            },
        },
        "strengths": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 6},
        "weaknesses": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 6},
        "opportunities": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 5},
        "threats": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 5},
        "market_outlook": {
            "type": "object",
            "required": ["text", "analyst_consensus_summary", "valuation_assessment", "confidence"],
            "properties": {
                "text": {"type": "string", "description": "100-180 parole. NESSUNA previsione numerica di prezzo non già presente nel consensus fornito."},
                "analyst_consensus_summary": {"type": "string"},
                "valuation_assessment": {"enum": ["sottovalutato", "fair_value", "sopravvalutato", "indeterminato"]},
                "confidence": {"enum": ["low", "medium", "high"]},
            },
        },
        "confidence_overall": {"enum": ["low", "medium", "high"]},
        "data_caveats": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Avvertenze su dati mancanti o di bassa qualità",
        },
    },
}


# ---------------------------------------------------------------------------
# System prompt: ruolo, vincoli, anti-pattern
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = dedent("""
    Sei un analista finanziario di supporto, non un consulente. Il tuo compito
    è produrre una scheda informativa neutra e tracciabile su una società
    quotata, a partire ESCLUSIVAMENTE dai dati che ti vengono forniti
    nell'input. Non inventare cifre, non citare news non presenti
    nell'input, non produrre previsioni di prezzo che non siano già nel
    consensus analisti fornito.

    Vincoli inderogabili:

    1. Lingua: italiano formale ma scorrevole. Niente anglicismi gratuiti
       (usa "utile per azione" non "EPS" se nel testo discorsivo; in tabelle
       e ratios usa pure le sigle standard).
    2. Hedging: usa formule come "secondo il consensus", "i dati indicano",
       "gli analisti stimano". MAI affermazioni dirette come "il titolo
       salirà" o "questa è un'occasione".
    3. Sourcing: ogni claim importante deve essere riconducibile a un
       elemento dell'input. Se un dato non c'è, dichiaralo in `data_caveats`
       e abbassa il `confidence`.
    4. Niente promozione: linguaggio piatto, senza superlativi. Evita
       "leader indiscusso", "rivoluzionario", "must-have".
    5. Output: SOLO JSON valido conforme allo schema indicato. Nessun
       testo prima o dopo. Nessun blocco markdown ```json.

    Anti-pattern da evitare:
    - Riempire `strengths`/`weaknesses` con generalità tipo
      "buona governance" o "esposizione al rischio macro" senza un
      aggancio specifico ai dati.
    - Dare `confidence: high` quando i dati input sono parziali.
    - Ripetere la stessa informazione in più sezioni.
""").strip()


# ---------------------------------------------------------------------------
# User prompt template — accetta un dict di contesto e restituisce la stringa
# ---------------------------------------------------------------------------
USER_PROMPT_TEMPLATE = dedent("""
    Genera la scheda informativa per il seguente titolo, restituendo SOLO
    un JSON valido conforme allo schema descritto in fondo.

    === ANAGRAFICA ===
    Ticker: {ticker}
    Nome: {name}
    Settore: {sector}
    Industria: {industry}
    Paese: {country}
    Valuta: {currency}
    Descrizione ufficiale: {business_description}

    === FONDAMENTALI CORRENTI ===
    {fundamentals_block}

    === ULTIMI 4 TRIMESTRI (revenue, EPS actual vs estimate) ===
    {earnings_block}

    === CONSENSUS ANALISTI ===
    {consensus_block}

    === MULTIPLI VS SETTORE ===
    {peer_multiples_block}

    === ULTIME NEWS RILEVANTI (max 5, ultimi 30 giorni) ===
    {news_block}

    === SCHEMA JSON DI OUTPUT (vincolante) ===
    {json_schema}

    Produci il JSON ora.
""").strip()


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
def build_messages(context: dict[str, Any]) -> list[dict[str, str]]:
    """
    Assemble the (system, user) message pair for the Anthropic Messages API.

    Args:
        context: dict with these keys
            ticker, name, sector, industry, country, currency,
            business_description, fundamentals_block, earnings_block,
            consensus_block, peer_multiples_block, news_block

        Each `*_block` is expected to be a human-readable string already
        formatted by the caller (the data layer). Pass "non disponibile"
        explicitly if a block is missing — do NOT pass empty strings, so
        the model knows the absence is real.

    Returns:
        list of message dicts ready to be sent to anthropic.messages.create
    """
    user = USER_PROMPT_TEMPLATE.format(
        json_schema=json.dumps(NARRATIVE_JSON_SCHEMA, ensure_ascii=False, indent=2),
        **context,
    )
    return [
        {"role": "user", "content": user},
    ]


# ---------------------------------------------------------------------------
# Helper: format input blocks consistently
# ---------------------------------------------------------------------------
def fmt_fundamentals(d: dict[str, Any] | None) -> str:
    if not d:
        return "non disponibile"
    keys = [
        ("market_cap", "Capitalizzazione"),
        ("pe_ratio", "P/E"),
        ("forward_pe", "P/E forward"),
        ("pb_ratio", "P/B"),
        ("ev_ebitda", "EV/EBITDA"),
        ("roe", "ROE"),
        ("debt_equity", "Debt/Equity"),
        ("dividend_yield", "Dividend yield"),
        ("payout_ratio", "Payout ratio"),
        ("profit_margin", "Margine netto"),
    ]
    lines = [f"- {label}: {d.get(k, 'n/d')}" for k, label in keys]
    return "\n".join(lines)


def fmt_earnings(rows: list[dict[str, Any]] | None) -> str:
    if not rows:
        return "non disponibile"
    out = []
    for r in rows:
        out.append(
            f"- {r.get('period', '?')}: "
            f"revenue {r.get('revenue_actual', 'n/d')} "
            f"(stimata {r.get('revenue_estimate', 'n/d')}), "
            f"EPS {r.get('eps_actual', 'n/d')} "
            f"(stimato {r.get('eps_estimate', 'n/d')})"
        )
    return "\n".join(out)


def fmt_consensus(d: dict[str, Any] | None) -> str:
    if not d:
        return "non disponibile"
    return dedent(f"""
        - Target price medio: {d.get('target_mean', 'n/d')}
        - Range target: {d.get('target_low', 'n/d')} – {d.get('target_high', 'n/d')}
        - Numero analisti: {d.get('n_analysts', 'n/d')}
        - Distribuzione rating: {d.get('rating_dist', 'n/d')}
        - Data aggiornamento: {d.get('updated_at', 'n/d')}
    """).strip()


def fmt_peer_multiples(rows: list[dict[str, Any]] | None) -> str:
    if not rows:
        return "non disponibile"
    out = ["Confronto P/E, P/B, ROE vs peer:"]
    for r in rows:
        out.append(
            f"- {r.get('symbol', '?')} ({r.get('name', '?')}): "
            f"P/E {r.get('pe', 'n/d')}, P/B {r.get('pb', 'n/d')}, "
            f"ROE {r.get('roe', 'n/d')}"
        )
    return "\n".join(out)


def fmt_news(items: list[dict[str, Any]] | None) -> str:
    if not items:
        return "non disponibile"
    out = []
    for n in items[:5]:
        sentiment = n.get("sentiment")
        sent_label = (
            "positivo" if sentiment and sentiment > 0.15
            else "negativo" if sentiment and sentiment < -0.15
            else "neutro"
        )
        out.append(
            f"- [{n.get('published_at', '?')}] {n.get('headline', '?')} "
            f"(sentiment: {sent_label})"
        )
    return "\n".join(out)
