# El Escudo Web v2 — Handoff de MVP

## Cómo arrancar

```bash
cd escudo-web-v2
cp .env.example .env.local   # y completa las variables reales
npm install
npm run dev                   # http://localhost:3000
```

## Despliegue en producción

Ver `DEPLOY.md` para la guía completa de despliegue en Vercel + backend.

Resumen rápido:
1. Conectar repo a Vercel (root: `escudo-web-v2`)
2. Configurar 3 env vars en Vercel Dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`
3. Configurar Site URL en Supabase Auth con la URL de Vercel
4. Asegurar que el backend tenga `FRONTEND_URL` configurado con la URL de Vercel

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública de Supabase |
| `NEXT_PUBLIC_API_BASE_URL` | URL base del backend (default: `http://localhost:8000/api/v1`) |

## Backend requerido

El backend FastAPI debe estar corriendo en `http://localhost:8000`. Arranque:

```bash
cd backend
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Módulos funcionales (MVP completo)

| Módulo | Lectura | Escritura | Eliminación |
|---|---|---|---|
| **Dashboard** | Datos reales (sync) | N/A | N/A |
| **OMNI** | Historial + respuestas | Enviar comandos | N/A |
| **Finanzas** | Transacciones + resumen | Crear ingreso/gasto | No |
| **Metas** | Lista + progreso | Crear meta + métrica | No |
| **Salud** | Peso + enfoque | Registrar peso | No |
| **Hábitos** | Lista + rachas | Crear + toggle | No |
| **Turnos** | Estado actual + lista | Crear turno | Sí (con confirmación) |
| **Auth** | Login/logout | N/A | N/A |

## Arquitectura

```
src/
├── app/
│   ├── actions/          # Server actions (finances, goals, health, habits, turnos, omni, dashboard, auth)
│   ├── (dashboard)/      # Rutas protegidas (layout compartido con Sidebar + Topbar)
│   │   ├── page.tsx      # Dashboard principal (client component)
│   │   ├── finanzas/     # page.tsx (server) + finanzas-client.tsx
│   │   ├── metas/        # page.tsx (server) + metas-client.tsx
│   │   ├── salud/        # page.tsx (server) + salud-client.tsx
│   │   ├── habitos/      # page.tsx (server) + habitos-client.tsx
│   │   ├── turnos/       # page.tsx (server) + turnos-client.tsx
│   │   └── omni/         # page.tsx (client, sin separación)
│   └── login/            # Página de login
├── components/
│   ├── dashboard/        # Sidebar, Topbar, MobileNav, EmptyState, ErrorState, LoadingState, FormStatus, SubmitButton
│   └── ui/               # shadcn/ui (base-nova)
├── lib/
│   ├── api/              # types.ts, server.ts (fetch helpers), helpers.ts
│   ├── auth/             # client.ts, server.ts (Supabase SSR)
│   └── constants/        # navigation.ts
└── proxy.ts              # Protección de rutas (Next.js 16 proxy)
```

**Patrón de módulo**: `page.tsx` (server component) → fetches data → `*-client.tsx` (client component) recibe props.

**Excepción**: Dashboard y OMNI son client components directos (sin separación server/client).

**Auth flow**: Supabase Auth → cookies httpOnly → `proxy.ts` verifica sesión → Server actions leen token de cookies → `Authorization: Bearer` al backend.

## Stack técnico

- Next.js 16 (App Router, Turbopack)
- React 19 (useActionState, useTransition)
- Tailwind CSS v4 + shadcn/ui (base-nova)
- Supabase SSR para auth
- FastAPI backend externo

## Convenciones

- **Formularios**: usan `<form action={handler}>` con `useTransition` + `SubmitButton` + `FormStatus`
- **Excepción Turnos**: usa handler directo sin `useTransition` (el form action llama a la server action vía handler async)
- **Server actions**: patrón `(prevState, formData) => { success, error? }`
- **Revalidación**: cada acción llama `revalidatePath("/<modulo>")` + `revalidatePath("/")` para mantener dashboard fresco
- **Idioma**: UI en español, tipos en inglés

## Limitaciones conocidas (post-MVP)

1. **Sin editar/eliminar** en Finanzas, Metas, Salud, Hábitos. Solo Turnos soporta delete.
2. **OMNI sin streaming**: Respuestas completas, no token por token.
3. **OMNI sin memoria conversacional real**: Single-turn (backend no envía historial a Gemini).
4. **OMNI requiere confirmación parcial**: Advierte sobre multi-intent pero no implementa confirmación interactiva.
5. **Hábitos: race condition en toggle**: Envía array completo `completed_dates`. Dos pestañas simultáneas pueden perder datos.
6. **Dashboard client-rendered**: Único módulo que fetchea en cliente (`useEffect`). Los demás son server-rendered.
7. **Sin registro de usuarios**: Solo login. Cuentas deben crearse desde Supabase Dashboard.
8. **Sin skeleton loaders**: Solo spinners (`Loader2`).
9. **Sin tests de frontend**.
10. **Sin tests de frontend**.

## Qué debería hacerse después

### Corto plazo (siguiente iteración)
- Agregar delete/edit en Finanzas, Metas, Salud, Hábitos
- Agregar registro de usuarios
- Dashboard: migrar a server component (como los otros módulos)
- Página de perfil / ajustes

### Mediano plazo
- OMNI con memoria conversacional (requiere cambio en backend)
- OMNI con streaming de tokens
- Skeleton loaders en todos los módulos
- Notificaciones push web
- Exportación de datos (CSV)

### Largo plazo
- Tests E2E con Playwright
- PWA / instalable
- Modo offline con sincronización diferida
- Dashboard con gráficos interactivos (librería de charts)
