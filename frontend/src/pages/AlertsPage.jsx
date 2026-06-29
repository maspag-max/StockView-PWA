import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import TickerAutocomplete from '../components/TickerAutocomplete';
import { api } from '../lib/api';

const MAX_ALERTS = 100;

const KIND_META = {
  consecutive_down_days: {
    label: '↓ Calo',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  },
  consecutive_up_days: {
    label: '↑ Rialzo',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  price_change_pct: {
    label: '% Var.',
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  },
};

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function ActiveBadge({ active }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
        active
          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
      }`}
    >
      {active ? 'Attivo' : 'Inattivo'}
    </span>
  );
}

function KindBadge({ kind }) {
  const meta = KIND_META[kind] ?? KIND_META.consecutive_down_days;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Alert card
// ---------------------------------------------------------------------------

function AlertCard({ alert, onToggle, onDelete, isPending }) {
  let description;
  if (alert.kind === 'price_change_pct') {
    const dirWord = alert.direction === 'up' ? 'rialzo' : 'calo';
    const sign = alert.direction === 'up' ? '+' : '-';
    description = `${sign}${alert.threshold_pct?.toFixed(0)}% di ${dirWord} rispetto al prezzo di riferimento (ref. ${alert.ref_price?.toFixed(2) ?? '—'})`;
  } else {
    const dirWord = alert.kind === 'consecutive_up_days' ? 'in rialzo' : 'in calo';
    description = `${alert.days} chiusure consecutive ${dirWord}`;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {alert.symbol}
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{alert.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <KindBadge kind={alert.kind} />
          <ActiveBadge active={alert.active} />
        </div>
      </div>

      {alert.last_triggered && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Ultimo invio: {new Date(alert.last_triggered).toLocaleDateString('it-IT')}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onToggle(alert)}
          disabled={isPending}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700
                     text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800
                     disabled:opacity-40 transition-colors"
        >
          {alert.active ? 'Disattiva' : 'Attiva'}
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Eliminare l'alert su ${alert.symbol}?`)) onDelete(alert.id);
          }}
          disabled={isPending}
          className="text-sm px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900
                     text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950
                     disabled:opacity-40 transition-colors"
        >
          Elimina
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form primitives
// ---------------------------------------------------------------------------

function TickerField({ symbol, selectedName, onChange, onSelect }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 dark:text-slate-400">Ticker</label>
      <TickerAutocomplete
        value={symbol}
        onChange={(val) => { onChange(val); }}
        onSelect={(sym, name) => onSelect(sym, name)}
        placeholder="es. AAPL"
      />
      {selectedName && (
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{selectedName}</p>
      )}
    </div>
  );
}

function EmailField({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 dark:text-slate-400">Email destinatario</label>
      <input
        required
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="tu@esempio.com"
        className="px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200
                   dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return <p className="text-sm text-rose-500 dark:text-rose-400">{message}</p>;
}

function extractErrorDetail(err) {
  const msg = err?.message || '';
  const match = msg.match(/"detail":"([^"]+)"/);
  return match ? match[1] : msg || "Errore durante la creazione dell'alert.";
}

// ---------------------------------------------------------------------------
// Consecutive alert form
// ---------------------------------------------------------------------------

function ConsecutiveAlertForm({ defaultEmail, onSubmit, isPending, onClose }) {
  const [symbol, setSymbol] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [kind, setKind] = useState('consecutive_down_days');
  const [days, setDays] = useState(3);
  const [email, setEmail] = useState(defaultEmail || '');
  const [error, setError] = useState('');

  const kindOptions = [
    { value: 'consecutive_down_days', label: '📉 In calo' },
    { value: 'consecutive_up_days',   label: '📈 In rialzo' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({ symbol: symbol.toUpperCase(), kind, days: Number(days), email });
      setSymbol('');
      setSelectedName('');
      setKind('consecutive_down_days');
      setDays(3);
      setError('');
      onClose();
    } catch (err) {
      setError(extractErrorDetail(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TickerField
          symbol={symbol}
          selectedName={selectedName}
          onChange={(val) => { setSymbol(val); setSelectedName(''); }}
          onSelect={(sym, name) => { setSymbol(sym); setSelectedName(name); }}
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Direzione</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {kindOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  kind === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Giorni consecutivi: <strong>{days}</strong>
          </label>
          <input
            type="range" min={2} max={10} value={days}
            onChange={(e) => setDays(e.target.value)}
            className="mt-2 accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>2</span><span>10</span>
          </div>
        </div>

        <EmailField value={email} onChange={setEmail} />
      </div>

      <FormError message={error} />

      <button
        type="submit"
        disabled={isPending || !symbol.trim()}
        className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white
                   hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? 'Aggiunta...' : 'Aggiungi alert'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Pct alert form
// ---------------------------------------------------------------------------

function PctAlertForm({ defaultEmail, onSubmit, isPending, onClose }) {
  const [symbol, setSymbol] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [direction, setDirection] = useState('down');
  const [thresholdPct, setThresholdPct] = useState(5);
  const [email, setEmail] = useState(defaultEmail || '');
  const [error, setError] = useState('');

  const directionOptions = [
    { value: 'down', label: '📉 Calo %' },
    { value: 'up',   label: '📈 Rialzo %' },
  ];

  const dirNote = direction === 'up'
    ? `Alert se il titolo sale di +${thresholdPct}% rispetto al prezzo di oggi.`
    : `Alert se il titolo scende di -${thresholdPct}% rispetto al prezzo di oggi.`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({
        symbol: symbol.toUpperCase(),
        kind: 'price_change_pct',
        threshold_pct: Number(thresholdPct),
        direction,
        email,
      });
      setSymbol('');
      setSelectedName('');
      setDirection('down');
      setThresholdPct(5);
      setError('');
      onClose();
    } catch (err) {
      setError(extractErrorDetail(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TickerField
          symbol={symbol}
          selectedName={selectedName}
          onChange={(val) => { setSymbol(val); setSelectedName(''); }}
          onSelect={(sym, name) => { setSymbol(sym); setSelectedName(name); }}
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Direzione</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {directionOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  direction === value
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Soglia: <strong>{direction === 'up' ? '+' : '-'}{thresholdPct}%</strong>
          </label>
          <input
            type="range" min={1} max={50} step={1} value={thresholdPct}
            onChange={(e) => setThresholdPct(e.target.value)}
            className="mt-2 accent-violet-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>1%</span><span>50%</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{dirNote}</p>
        </div>

        <EmailField value={email} onChange={setEmail} />
      </div>

      <FormError message={error} />

      <button
        type="submit"
        disabled={isPending || !symbol.trim()}
        className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white
                   hover:bg-violet-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? 'Aggiunta...' : 'Aggiungi alert'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bulk alert form
// ---------------------------------------------------------------------------

const BULK_ALERT_DEFS = [
  { key: 'down_days', label: 'Cali consecutivi',  paramLabel: 'giorni',   min: 2, max: 10 },
  { key: 'up_days',   label: 'Rialzi consecutivi', paramLabel: 'giorni',   min: 2, max: 10 },
  { key: 'down_pct',  label: 'Calo %',             paramLabel: 'soglia %', min: 1, max: 50 },
  { key: 'up_pct',    label: 'Rialzo %',            paramLabel: 'soglia %', min: 1, max: 50 },
];

function BulkAlertForm({ onSubmit, isPending, currentCount }) {
  const [symbol, setSymbol] = useState('');
  const [email, setEmail]   = useState('');
  const [checks, setChecks] = useState({ down_days: false, up_days: false, down_pct: false, up_pct: false });
  const [params, setParams] = useState({ down_days: 3, up_days: 3, down_pct: 5, up_pct: 5 });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const selectedCount = Object.values(checks).filter(Boolean).length;
  const canSubmit = selectedCount > 0 && symbol.trim() && email.trim() && !isPending;

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    const toCreate = BULK_ALERT_DEFS.filter((a) => checks[a.key]);
    if (currentCount + toCreate.length > MAX_ALERTS) {
      setError(
        `Limite di ${MAX_ALERTS} alert raggiunto. Hai ${currentCount} alert e stai aggiungendone ${toCreate.length}.`
      );
      return;
    }

    try {
      for (const def of toCreate) {
        const sym = symbol.trim().toUpperCase();
        if (def.key === 'down_days') {
          await onSubmit({ symbol: sym, kind: 'consecutive_down_days', days: Number(params[def.key]), email });
        } else if (def.key === 'up_days') {
          await onSubmit({ symbol: sym, kind: 'consecutive_up_days',   days: Number(params[def.key]), email });
        } else if (def.key === 'down_pct') {
          await onSubmit({ symbol: sym, kind: 'price_change_pct', threshold_pct: Number(params[def.key]), direction: 'down', email });
        } else {
          await onSubmit({ symbol: sym, kind: 'price_change_pct', threshold_pct: Number(params[def.key]), direction: 'up',   email });
        }
      }
      setSuccess(`${toCreate.length} alert creati per ${symbol.trim().toUpperCase()}.`);
      setSymbol('');
      setEmail('');
      setChecks({ down_days: false, up_days: false, down_pct: false, up_pct: false });
      setParams({ down_days: 3, up_days: 3, down_pct: 5, up_pct: 5 });
    } catch (err) {
      setError(extractErrorDetail(err));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Configura tutti gli alert in una volta
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Imposta uno o più alert per lo stesso titolo in un click
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Ticker</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="es. AAPL"
            className="px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200
                       dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Email destinatario</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@esempio.com"
            className="px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200
                       dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {BULK_ALERT_DEFS.map(({ key, label, paramLabel, min, max }) => (
          <div key={key} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`bulk-${key}`}
              checked={checks[key]}
              onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
              className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
            />
            <label
              htmlFor={`bulk-${key}`}
              className="text-sm text-slate-700 dark:text-slate-300 w-40 cursor-pointer select-none"
            >
              {label}
            </label>
            <span className="text-xs text-slate-400 dark:text-slate-500 w-14">{paramLabel}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={params[key]}
              disabled={!checks[key]}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  [key]: Math.min(max, Math.max(min, Number(e.target.value))),
                }))
              }
              className="w-16 px-2 py-1 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200
                         dark:border-slate-700 text-slate-900 dark:text-slate-100
                         disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {error   && <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={!canSubmit}
        className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white
                   hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? 'Creazione…' : 'Crea alert selezionati'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [activeForm, setActiveForm] = useState(null); // 'consecutive' | 'pct' | null

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => api.updateAlert(id, { active: !active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.createAlert(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const atLimit = alerts.length >= MAX_ALERTS;
  const defaultEmail = alerts.length > 0 ? alerts[alerts.length - 1].email : '';

  function toggleForm(form) {
    setActiveForm((prev) => (prev === form ? null : form));
  }

  return (
    <Layout>
      <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Alert email</h1>
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {alerts.length}/{MAX_ALERTS}
          </span>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-3">
          Ricevi una email quando un titolo sale/scende per N giorni consecutivi,
          oppure quando varia di una certa percentuale rispetto al prezzo di riferimento.
          Il controllo avviene ogni sera alle 18:30 (ora italiana).
        </p>

        {/* Bulk creation */}
        <BulkAlertForm
          onSubmit={createMutation.mutateAsync}
          isPending={createMutation.isPending}
          currentCount={alerts.length}
        />

        {/* Alert list */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && alerts.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
            Nessun alert configurato.
          </p>
        )}

        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onToggle={(a) => toggleMutation.mutate({ id: a.id, active: a.active })}
            onDelete={(id) => deleteMutation.mutate(id)}
            isPending={toggleMutation.isPending || deleteMutation.isPending}
          />
        ))}

        {/* Form section */}
        {atLimit ? (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900
                          rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
            Hai raggiunto il limite di {MAX_ALERTS} alert. Elimina un alert esistente per aggiungerne uno nuovo.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Toggle buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleForm('consecutive')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                            border transition-colors ${
                  activeForm === 'consecutive'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>📉📈</span>
                <span>Alert Consecutivo</span>
              </button>

              <button
                type="button"
                onClick={() => toggleForm('pct')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                            border transition-colors ${
                  activeForm === 'pct'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>📊</span>
                <span>Alert %</span>
              </button>
            </div>

            {/* Active form — key forces full remount on each open */}
            {activeForm === 'consecutive' && (
              <ConsecutiveAlertForm
                key="consecutive-form"
                defaultEmail={defaultEmail}
                onSubmit={createMutation.mutateAsync}
                isPending={createMutation.isPending}
                onClose={() => setActiveForm(null)}
              />
            )}
            {activeForm === 'pct' && (
              <PctAlertForm
                key="pct-form"
                defaultEmail={defaultEmail}
                onSubmit={createMutation.mutateAsync}
                isPending={createMutation.isPending}
                onClose={() => setActiveForm(null)}
              />
            )}
          </div>
        )}
      </main>
    </Layout>
  );
}
