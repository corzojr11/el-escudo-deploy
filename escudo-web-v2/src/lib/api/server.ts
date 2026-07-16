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
  const response = await fetch(url, {
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

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `Error del backend (${response.status}): ${bodyText.slice(0, 120) || response.statusText}`
    );
  }

  // Algunos endpoints devuelven 200/204 sin cuerpo.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
