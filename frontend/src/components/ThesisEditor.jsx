import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Textarea, Select, SelectItem, Text } from '@tremor/react';
import { api } from '../lib/api';

const HORIZONS = [
  { value: 'short', label: 'Breve termine (< 1 anno)' },
  { value: 'mid',   label: 'Medio termine (1–3 anni)' },
  { value: 'long',  label: 'Lungo termine (> 3 anni)' },
];

function SaveStatus({ status }) {
  if (status === 'saving') {
    return <Text className="text-slate-400 dark:text-slate-500 text-xs">Salvataggio…</Text>;
  }
  if (status === 'saved') {
    return <Text className="text-emerald-600 dark:text-emerald-400 text-xs">Salvato ✓</Text>;
  }
  return null;
}

export default function ThesisEditor({ ticker }) {
  const [thesis,       setThesis]       = useState('');
  const [horizon,      setHorizon]      = useState('');
  const [invalidation, setInvalidation] = useState('');
  const [saveStatus,   setSaveStatus]   = useState(null);

  const timerRef  = useRef(null);
  const latestRef = useRef({ thesis, horizon, invalidation });
  const seededRef = useRef(false);

  const thesisQ = useQuery({
    queryKey: ['thesis', ticker],
    queryFn: () => api.getThesis(ticker),
    retry: false,
  });

  useEffect(() => {
    if (thesisQ.data && !seededRef.current) {
      seededRef.current = true;
      setThesis(thesisQ.data.thesis ?? '');
      setHorizon(thesisQ.data.target_horizon ?? '');
      setInvalidation(thesisQ.data.invalidation ?? '');
    }
  }, [thesisQ.data]);

  useEffect(() => {
    latestRef.current = { thesis, horizon, invalidation };
  }, [thesis, horizon, invalidation]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.saveThesis(ticker, payload),
    onSuccess: () => setSaveStatus('saved'),
  });

  function doSave(vals) {
    if (!vals.thesis || vals.thesis.length < 10) { setSaveStatus(null); return; }
    saveMutation.mutate({
      symbol: ticker,
      thesis: vals.thesis,
      target_horizon: vals.horizon || null,
      invalidation: vals.invalidation || null,
    });
  }

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveStatus('saving');
    timerRef.current = setTimeout(() => doSave(latestRef.current), 1500);
  }

  function handleBlur() {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(latestRef.current);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const is404 = thesisQ.error?.message?.includes('API 404');
  if (thesisQ.isLoading) return null;
  if (thesisQ.error && !is404) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Tesi di investimento
        </p>
        <SaveStatus status={saveStatus} />
      </div>

      <div className="flex flex-col gap-4">
        <Textarea
          value={thesis}
          onChange={(e) => { setThesis(e.target.value); scheduleSave(); }}
          onBlur={handleBlur}
          placeholder="Perché vuoi/hai questo titolo? (min. 10 caratteri)"
          maxLength={2000}
          rows={4}
          className="resize-y text-sm"
        />

        <Select
          value={horizon || undefined}
          onValueChange={(v) => { setHorizon(v ?? ''); scheduleSave(); }}
          placeholder="Orizzonte temporale"
          enableClear
          className="w-64"
        >
          {HORIZONS.map((h) => (
            <SelectItem key={h.value} value={h.value}>
              {h.label}
            </SelectItem>
          ))}
        </Select>

        <Textarea
          value={invalidation}
          onChange={(e) => { setInvalidation(e.target.value); scheduleSave(); }}
          onBlur={handleBlur}
          placeholder="Cosa ti farebbe cambiare idea? (stop loss tesi)"
          rows={2}
          className="resize-y text-sm"
        />
      </div>
    </Card>
  );
}
