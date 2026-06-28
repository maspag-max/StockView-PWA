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
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check current subscription state on mount
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isSupported]);

  async function subscribe() {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      // Request notification permission if not yet granted
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permesso notifiche negato.');
      }

      // Fetch VAPID public key (no auth needed)
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
    if (!isSupported) return;
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

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
