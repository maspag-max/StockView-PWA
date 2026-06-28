import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Callout, Text, List, ListItem } from '@tremor/react';
import { api } from '../lib/api';

const COOLDOWN_SECS = 30;

const CONFIDENCE_COLOR = { low: 'rose', medium: 'amber', high: 'emerald' };

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
      {children}
    </p>
  );
}

function BulletList({ items }) {
  if (!items?.length) return null;
  return (
    <List>
      {items.map((item, i) => (
        <ListItem key={i}>
          <Text className="text-slate-700 dark:text-slate-300">{item}</Text>
        </ListItem>
      ))}
    </List>
  );
}

function TwoColumnSection({ leftLabel, leftItems, rightLabel, rightItems }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{leftLabel}</p>
        <BulletList items={leftItems} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{rightLabel}</p>
        <BulletList items={rightItems} />
      </div>
    </div>
  );
}

function RefreshButton({ onClick, isLoading }) {
  const [cooldown, setCooldown] = useState(0);

  function handleClick() {
    onClick();
    setCooldown(COOLDOWN_SECS);
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const disabled = isLoading || cooldown > 0;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={[
        'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
        disabled
          ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
      ].join(' ')}
    >
      {isLoading
        ? 'Generazione…'
        : cooldown > 0
        ? `Attendere (${cooldown}s)…`
        : 'Rigenera analisi'}
    </button>
  );
}

export default function NarrativeSection({ ticker }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['narrative', ticker],
    queryFn: () => api.getNarrative(ticker),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshNarrative(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['narrative', ticker] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          Analisi AI
        </h2>
        {!isLoading && !isError && (
          <RefreshButton
            onClick={() => refreshMutation.mutate()}
            isLoading={refreshMutation.isPending}
          />
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">
          Generazione analisi in corso… (20–40 sec)
        </p>
      )}

      {isError && (
        <Callout title="Errore analisi AI" color="rose">
          {error?.message ?? 'Impossibile caricare la narrativa.'}
        </Callout>
      )}

      {refreshMutation.isError && (
        <div className="mb-3">
          <Callout title="Rigenerazione fallita" color="rose">
            {refreshMutation.error?.message ?? 'Errore durante la rigenerazione.'}
          </Callout>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          {/* Sintesi attività */}
          <Card>
            <div className="flex items-start justify-between gap-3 mb-2">
              <SectionLabel>Sintesi attività</SectionLabel>
              {data.confidence_overall && (
                <Badge color={CONFIDENCE_COLOR[data.confidence_overall] ?? 'slate'}>
                  Confidenza {data.confidence_overall}
                </Badge>
              )}
            </div>
            <Text className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {data.business_summary?.text}
            </Text>
          </Card>

          {/* Prospettive di sviluppo */}
          <Card>
            <SectionLabel>Prospettive di sviluppo</SectionLabel>
            <Text className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              {data.growth_outlook?.text}
            </Text>
            <TwoColumnSection
              leftLabel="Driver di crescita"
              leftItems={data.growth_outlook?.drivers}
              rightLabel="Rischi"
              rightItems={data.growth_outlook?.risks}
            />
          </Card>

          {/* Punti di forza e debolezza */}
          <Card>
            <SectionLabel>Punti di forza e debolezza</SectionLabel>
            <TwoColumnSection
              leftLabel="Punti di forza"
              leftItems={data.strengths}
              rightLabel="Punti di debolezza"
              rightItems={data.weaknesses}
            />
          </Card>

          {/* Opportunità e minacce */}
          <Card>
            <SectionLabel>Opportunità e minacce</SectionLabel>
            <TwoColumnSection
              leftLabel="Opportunità"
              leftItems={data.opportunities}
              rightLabel="Minacce"
              rightItems={data.threats}
            />
          </Card>

          {/* Outlook di mercato */}
          <Card>
            <SectionLabel>Outlook di mercato</SectionLabel>
            <Text className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              {data.market_outlook?.text}
            </Text>
            {data.market_outlook?.valuation_assessment && (
              <div className="mt-2 p-3 rounded-md bg-slate-50 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Valutazione
                </p>
                <Text className="text-slate-700 dark:text-slate-300">
                  {data.market_outlook.valuation_assessment}
                </Text>
              </div>
            )}
          </Card>

          {/* Data caveats */}
          {data.data_caveats?.length > 0 && (
            <Callout title="Avvertenze sui dati" color="amber">
              <ul className="list-disc list-inside space-y-1">
                {data.data_caveats.map((c, i) => (
                  <li key={i} className="text-sm">{c}</li>
                ))}
              </ul>
            </Callout>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Analisi generata da Gemini AI a partire da dati pubblici. Non costituisce consulenza finanziaria.
          </p>
        </div>
      )}
    </div>
  );
}
