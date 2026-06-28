import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, List, ListItem, Text } from '@tremor/react';
import { api } from '../lib/api';

function RemoveButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 text-xs leading-none px-1 disabled:opacity-40 transition-colors"
      aria-label="Rimuovi"
    >
      ✕
    </button>
  );
}

function WatchlistItems({ items, onRemove, pendingSymbol }) {
  return (
    <List>
      {items.map((item) => (
        <ListItem key={item.symbol} className="py-1.5">
          <Link
            to={`/stock/${item.symbol}`}
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {item.symbol}
          </Link>
          <RemoveButton
            onClick={() => onRemove(item.symbol)}
            disabled={pendingSymbol === item.symbol}
          />
        </ListItem>
      ))}
    </List>
  );
}

export default function Watchlist({ inSidebar = false }) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
  });

  const removeMutation = useMutation({
    mutationFn: (symbol) => api.removeFromWatchlist(symbol),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  if (isLoading) return null;

  if (inSidebar) {
    return (
      <div className="w-full min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
          Watchlist
        </p>
        {items.length === 0 ? (
          <Text className="text-slate-400 dark:text-slate-500 text-xs">
            Nessun titolo aggiunto.
          </Text>
        ) : (
          <WatchlistItems
            items={items}
            onRemove={(s) => removeMutation.mutate(s)}
            pendingSymbol={removeMutation.isPending ? removeMutation.variables : null}
          />
        )}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
        Watchlist
      </p>
      {items.length === 0 ? (
        <Text className="text-slate-400 dark:text-slate-500">
          Nessun titolo in watchlist.
        </Text>
      ) : (
        <WatchlistItems
          items={items}
          onRemove={(s) => removeMutation.mutate(s)}
          pendingSymbol={removeMutation.isPending ? removeMutation.variables : null}
        />
      )}
    </Card>
  );
}
