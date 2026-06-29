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
    console.log('[subscribe] start — requestPermission is first call');
    try {
      // requestPermission MUST be the very first await — no setState or other
      // calls before it, or Chrome Android will silently drop it (transient
      // user activation expires before the call reaches the browser).
      const permResult = await Notification.requestPermission();
      const actualPerm = Notification.permission;
      console.log('[subscribe] requestPermission resolved', { permResult, actualPerm });

      setPermission(actualPerm);
      if (actualPerm !== 'granted') {
        console.log('[subscribe] permission not granted, stopping');
        return;
      }

      // Permission granted — now safe to show loading and continue
      setIsLoading(true);

      console.log('[subscribe] fetching VAPID public key...');
      const { publicKey } = await fetch('/api/push/vapid-public-key').then((r) => r.json());
      console.log('[subscribe] VAPID key received, waiting for SW ready...');

      const reg = await navigator.serviceWorker.ready;
      console.log('[subscribe] SW ready, calling pushManager.subscribe...');

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log('[subscribe] pushManager subscribed, sending to backend...');

      await api.subscribePush(sub.toJSON());
      console.log('[subscribe] backend confirmed — done');
      setIsSubscribed(true);
    } catch (err) {
      console.error('[subscribe] error', err);
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
