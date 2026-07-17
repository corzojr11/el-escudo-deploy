import { createServerSupabaseClient } from "@/lib/auth/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

function getApiUrl(path: string) {
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return baseUrl.endsWith("/api/v1") && normalizedPath.startsWith("/api/v1/")
    ? `${baseUrl}${normalizedPath.slice("/api/v1".length)}`
    : `${baseUrl}${normalizedPath}`;
}

export async function fetchFromBackend<T>(path: string): Promise<T> {
  return apiRequest<T>("GET", path);
}

export async function postToBackend<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>("POST", path, body);
}

export async function putToBackend<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>("PUT", path, body);
}

export async function deleteFromBackend<T>(path: string): Promise<T> {
  return apiRequest<T>("DELETE", path);
}

export async function patchToBackend<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>("PATCH", path, body);
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();

  if (!data.session?.access_token) {
    throw new Error("No hay sesión activa.");
  }

  const url = getApiUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      // Render Free puede tardar cerca de un minuto al reactivar el backend dormido.
      signal: AbortSignal.timeout(70_000),
    });
  } catch (fetchErr) {
    const isTimeout =
      fetchErr instanceof Error &&
      (fetchErr.name === "AbortError" || fetchErr.name === "TimeoutError");
    if (isTimeout) {
      throw new Error(
        "El backend está despertando (cold start) o la conexión fue muy lenta. " +
          "Para lecturas, espera un momento y reintenta. " +
          "Para escrituras, verifica el resultado antes de reenviar para evitar duplicados."
      );
    }
    throw new Error("No se pudo conectar con el backend. Revisa tu conexión e intenta de nuevo.");
  }

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      bodyText = "";
    }
    const raw = bodyText.slice(0, 200).trim();
    let detail = response.statusText;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.detail) detail = String(parsed.detail);
      else if (parsed?.error) detail = String(parsed.error);
    } catch {
      // raw no es JSON; usar texto crudo solo si parece seguro
      if (raw && !raw.toLowerCase().startsWith("<!doctype") && !raw.toLowerCase().startsWith("<html")) {
        detail = raw.slice(0, 120);
      }
    }

    const isMutation = method !== "GET";
    const userMessage = isMutation
      ? `No se pudo guardar el cambio (${response.status}). ${detail}`
      : `No se pudo cargar la información (${response.status}). ${detail}`;
    throw new Error(userMessage);
  }

  // Algunos endpoints devuelven 200/204 sin cuerpo.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
