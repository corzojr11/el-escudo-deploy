# Autenticación — Implementada

## Estado actual

- Cliente de navegador en `client.ts` (createBrowserClient).
- Cliente de servidor en `server.ts` (createServerSupabaseClient).
- Proxy de protección de rutas en `src/proxy.ts`.
- Server Actions de login/logout en `src/app/actions/auth.ts`.
- Página de login funcional en `src/app/login/page.tsx`.
- Topbar con info de usuario y botón de logout.
- Variables de entorno configuradas en `.env.local` (no commiteado).

## Flujo de autenticación

1. **Login**: El formulario en `/login` envía credenciales via Server Action → Supabase Auth → redirect a `/`.
2. **Protección de rutas**: `proxy.ts` verifica la sesión en cada request. Sin sesión → redirect a `/login`. Con sesión en `/login` → redirect a `/`.
3. **Logout**: Botón en Topbar → Server Action `logout()` → Supabase signOut → redirect a `/login`.
4. **Sesión**: Gestionada por Supabase SSR con cookies httpOnly. El middleware refresca tokens automáticamente.

## Variables de entorno requeridas

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=
```
