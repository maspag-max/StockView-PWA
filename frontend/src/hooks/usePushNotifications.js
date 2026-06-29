import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    const notifPerm = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : undefined;
    console.log('[PushNotifications] init', {
      'Notification in window': typeof window !== 'undefined' && 'Notification' in window,
      'serviceWorker in navigator': 'serviceWorker' in navigator,
      'PushManager in window': 'PushManager' in window,
      'Notification.permission (raw)': notifPerm,
      supported,
    });

    setIsSupported(supported);

    if (!supported) {
      setIsLoading(false);
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function subscribe() {
    setIsLoading(true);
    try {
      await Notification.requestPermission();
      // Read Notification.permission directly after the call — on some mobile browsers
      // (iOS Safari PWA, some Android WebViews) requestPermission() return value and
      // Notification.permission can diverge (e.g. returns 'denied' when browser still
      // shows 'default' because the user dismissed without choosing).
      const actualPerm = Notification.permission;
      setPermission(actualPerm);
      if (actualPerm !== 'granted') return;

      const { publicKey } = await fetch('/api/push/vapid-public-key').then((r) => r.json());
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await api.subscribePush(sub.toJSON());
      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
