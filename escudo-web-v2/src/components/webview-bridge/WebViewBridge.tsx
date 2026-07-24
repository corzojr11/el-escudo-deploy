'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/auth/client';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

export function WebViewBridge() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const sendWebReady = useCallback(() => {
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'web-ready' }));
    }
  }, []);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        sendWebReady();
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        sendWebReady();
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, sendWebReady]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'expo-push-token' && message.token) {
          registerPushToken(message.token);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const registerPushToken = useCallback(async (token: string) => {
    try {
      await fetch('/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'android' }),
      });
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }, []);

  return null;
}
