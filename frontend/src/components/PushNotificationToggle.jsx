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

function DebugBox({ isSupported, permission, isSubscribed }) {
  const hasWindow = typeof window !== 'undefined';
  const rows = [
    ['"Notification" in window', String(hasWindow && 'Notification' in window)],
    ['"serviceWorker" in navigator', String('serviceWorker' in navigator)],
    ['"PushManager" in window', String(hasWindow && 'PushManager' in window)],
    ['Notification.permission (raw)', hasWindow && 'Notification' in window ? Notification.permission : 'undefined'],
    ['isSupported (React)', String(isSupported)],
    ['permission (React)', String(permission)],
    ['isSubscribed (React)', String(isSubscribed)],
  ];
  return (
    <div className="mt-2 p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      {rows.map(([key, val]) => (
        <div key={key} className="font-mono text-[9px] leading-tight text-slate-500 dark:text-slate-400 flex gap-1">
          <span className="shrink-0">{key}:</span>
          <span className="text-amber-600 dark:text-amber-400 break-all">{val}</span>
        </div>
      ))}
    </div>
  );
}

export default function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div>
        <button
          disabled
          title="Notifiche push non supportate in questo browser"
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 cursor-not-allowed"
        >
          <BellIcon filled={false} />
          <span>Notifiche</span>
        </button>
        <DebugBox isSupported={isSupported} permission={permission} isSubscribed={isSubscribed} />
      </div>
    );
  }

  // User explicitly blocked notifications — browser won't show dialog again
  if (permission === 'denied') {
    return (
      <div className="flex flex-col gap-0.5">
        <button
          disabled
          title="Riattiva le notifiche dalle impostazioni del browser"
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          <BellIcon filled={false} />
          <span>Permesso negato</span>
        </button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
          Riattiva nelle impostazioni del browser
        </p>
        <DebugBox isSupported={isSupported} permission={permission} isSubscribed={isSubscribed} />
      </div>
    );
  }

  // Granted and subscribed
  if (permission === 'granted' && isSubscribed) {
    return (
      <div>
        <button
          onClick={unsubscribe}
          disabled={isLoading}
          title="Disattiva notifiche push"
          className="flex items-center gap-1.5 text-xs text-sky-500 dark:text-sky-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors disabled:opacity-70"
        >
          {isLoading ? <Spinner /> : <BellIcon filled={true} />}
          <span>Notifiche attive</span>
        </button>
        <DebugBox isSupported={isSupported} permission={permission} isSubscribed={isSubscribed} />
      </div>
    );
  }

  // Default (never asked) or granted but not yet subscribed — clicking triggers the browser dialog
  return (
    <div>
      <button
        onClick={subscribe}
        disabled={isLoading}
        title="Attiva notifiche push"
        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors disabled:opacity-70"
      >
        {isLoading ? <Spinner /> : <BellIcon filled={false} />}
        <span>Notifiche</span>
      </button>
      <DebugBox isSupported={isSupported} permission={permission} isSubscribed={isSubscribed} />
    </div>
  );
}
