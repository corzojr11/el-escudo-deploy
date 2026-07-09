import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getApiBaseUrl } from '../config/api';
import { supabase } from '../utils/supabase';

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
  timeoutMs?: number;
}

type PendingRequest = {
  id: string;
  url: string;
  method: string;
  body?: string | null;
  skipAuth: boolean;
  queuedAt: number;
};

const PENDING_REQUESTS_KEY = '@elescudo.pendingRequests';

const isMutatingMethod = (method: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
const genId = () => Math.random().toString(36).substring(2, 10);

const readPendingRequests = async (): Promise<PendingRequest[]> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePendingRequests = async (items: PendingRequest[]) => {
  try {
    await AsyncStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors; offline queue is best effort.
  }
};

const queuePendingRequest = async (entry: Omit<PendingRequest, 'id' | 'queuedAt'>) => {
  const current = await readPendingRequests();
  const next = [...current, { ...entry, id: genId(), queuedAt: Date.now() }];
  await writePendingRequests(next);
  return next[next.length - 1];
};

export const flushPendingRequests = async (): Promise<number> => {
  const networkState = await NetInfo.fetch();
  if (networkState.isConnected === false) {
    return 0;
  }

  const pending = await readPendingRequests();
  if (pending.length === 0) return 0;

  const remaining: PendingRequest[] = [];
  let flushed = 0;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || null;

  for (const request of pending) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (!request.skipAuth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(request.url, {
        method: request.method,
        headers,
        body: request.body ?? undefined,
      });

      if (response.ok) {
        flushed += 1;
      } else {
        remaining.push(request);
      }
    } catch {
      remaining.push(request);
    }
  }

  await writePendingRequests(remaining);
  return flushed;
};

export async function apiFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const { skipAuth, headers, timeoutMs = 30000, ...restOptions } = options;
  const method = String(restOptions.method || 'GET').toUpperCase();

  const baseUrl = getApiBaseUrl().trim().replace(/\/+$/, '');
  if (!path.startsWith('http') && !baseUrl) {
    return new Response(JSON.stringify({
      error: 'BACKEND_NOT_CONFIGURED',
      detail: 'Configura la URL del backend movil en Perfil antes de usar la app.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const networkState = await NetInfo.fetch();
  if (networkState.isConnected === false) {
    if (isMutatingMethod(method)) {
      const queued = await queuePendingRequest({
        url: path.startsWith('http') ? path : `${baseUrl}${path}`,
        method,
        body: typeof restOptions.body === 'string' ? restOptions.body : null,
        skipAuth: !!skipAuth,
      });

      let queuedPayload: Record<string, unknown> = { queued: true, queued_request: true, id: queued.id };
      if (typeof restOptions.body === 'string') {
        try {
          const parsedBody = JSON.parse(restOptions.body);
          if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
            queuedPayload = {
              ...parsedBody,
              ...queuedPayload,
              timestamp: new Date(queued.queuedAt).toISOString(),
            };
            if (method === 'POST' && !('id' in queuedPayload)) {
              queuedPayload.id = queued.id;
            }
          }
        } catch {
          // Keep generic queued payload.
        }
      }

      return new Response(JSON.stringify(queuedPayload), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'NETWORK_OFFLINE',
      detail: 'No hay conexion activa. Se conservara lo local hasta reconectar.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const requestHeaders: Record<string, string> = {
    ...((headers as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', detail: 'No hay sesion activa' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  if (!requestHeaders['Content-Type'] && !(options.body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
      signal: controller.signal,
    });
  } catch {
    if (isMutatingMethod(method)) {
      const queued = await queuePendingRequest({
        url,
        method,
        body: typeof restOptions.body === 'string' ? restOptions.body : null,
        skipAuth: !!skipAuth,
      });

      let queuedPayload: Record<string, unknown> = { queued: true, queued_request: true, id: queued.id };
      if (typeof restOptions.body === 'string') {
        try {
          const parsedBody = JSON.parse(restOptions.body);
          if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
            queuedPayload = {
              ...parsedBody,
              ...queuedPayload,
              timestamp: new Date(queued.queuedAt).toISOString(),
            };
            if (method === 'POST' && !('id' in queuedPayload)) {
              queuedPayload.id = queued.id;
            }
          }
        } catch {
          // Keep generic queued payload.
        }
      }

      return new Response(JSON.stringify(queuedPayload), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'NETWORK_ERROR',
      detail: 'No se pudo completar la solicitud. Intenta nuevamente.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiGet(path: string, options?: ApiOptions) {
  return apiFetch(path, { method: 'GET', ...options });
}

export async function apiPost(path: string, body: unknown, options?: ApiOptions) {
  return apiFetch(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
    ...options,
  });
}

export async function apiDelete(path: string, options?: ApiOptions) {
  return apiFetch(path, { method: 'DELETE', ...options });
}

export async function apiPut(path: string, body: unknown, options?: ApiOptions) {
  return apiFetch(path, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
    ...options,
  });
}
