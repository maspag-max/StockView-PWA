import { useQuery } from '@tanstack/react-query';
import { Card, Divider, Text } from '@tremor/react';
import { api } from '../lib/api';

function formatDate(isoString) {
  return new Date(isoString).toLocaleString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(text, max = 200) {
  if (!text) return null;
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…';
}

function NewsItem({ item, isLast }) {
  const summary = truncate(item.summary);
  return (
    <>
      <article className="py-3">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 font-medium text-sm hover:underline leading-snug block mb-1"
        >
          {item.headline}
        </a>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
          {item.source && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 mr-2">
              {item.source}
            </span>
          )}
          {formatDate(item.published_at)}
        </p>
        {summary && (
          <Text className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {summary}
          </Text>
        )}
      </article>
      {!isLast && <Divider className="my-0" />}
    </>
  );
}

export default function NewsFeed({ ticker }) {
  const { data: news, isLoading, isError } = useQuery({
    queryKey: ['news', ticker],
    queryFn: () => api.getNews(ticker, 10),
  });

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
        Notizie recenti
      </h2>

      {isLoading && (
        <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">
          Caricamento notizie…
        </p>
      )}
      {isError && (
        <p className="text-sm text-rose-500 dark:text-rose-400">
          Impossibile caricare le notizie.
        </p>
      )}
      {news && news.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Nessuna notizia recente.
        </p>
      )}
      {news && news.length > 0 && (
        <Card className="px-4 py-0">
          {news.map((item, i) => (
            <NewsItem
              key={item.finnhub_id}
              item={item}
              isLast={i === news.length - 1}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
