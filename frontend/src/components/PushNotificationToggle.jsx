import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

function BellIcon({ filled = false, className = 'w-3.5 h-3.5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      {filled ? (
        <path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6v2.586l-.707.707A1 1 0 0 0 4 13h12a1 1 0 0 0 .707-1.707L16 10.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z" clipRule="evenodd" />
      ) : (
        <path d="M10 2a6 6 0 0 0-6 6v2.586l-.707.707A1 1 0 0 0 4 13h12a1 1 0 0 0 .707-1.707L16 10.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z" />
      )}
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const [error, setError] = useState('');

  async function handleToggle() {
    setError('');
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (err) {
      setError(err.message || 'Errore notifiche.');
    }
  }

  // Not supported: show disabled bell — always visible so the sidebar layout is stable
  if (!isSupported) {
    return (
      <button
        disabled
        title="Notifiche push non supportate in questo browser"
        className="flex items-center gap-1.5 text-xs text-slate-300 dark:text-slate-600 cursor-not-allowed"
      >
        <BellIcon filled={false} />
        <span>Notifiche</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleToggle}
        disabled={isLoading}
        title={isSubscribed ? 'Disattiva notifiche push' : 'Attiva notifiche push'}
        className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 ${
          isSubscribed
            ? 'text-sky-500 dark:text-sky-400 hover:text-rose-500 dark:hover:text-rose-400'
            : 'text-slate-400 dark:text-slate-500 hover:text-sky-500 dark:hover:text-sky-400'
        }`}
      >
        {isLoading ? <Spinner /> : <BellIcon filled={isSubscribed} />}
        <span>{isSubscribed ? 'Notifiche attive' : 'Notifiche'}</span>
      </button>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  );
}
