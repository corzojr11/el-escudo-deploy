# El Escudo — Web App v2

Nueva base del frontend web de **El Escudo**, construida con Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (base-nova) y Supabase Auth.

## Estado: MVP funcional

Todos los módulos V1 están conectados al backend real con lectura y, donde aplica, escritura:

- **Dashboard**: KPIs en tiempo real (nivel, XP, racha, balance, peso, metas, gastos).
- **OMNI**: Chat funcional con el asistente NAVIR. Envía comandos, muestra respuestas, intentos, XP y costo.
- **Finanzas**: Registrar ingresos/gastos, ver resumen por categoría y movimientos recientes.
- **Metas**: Crear metas, registrar progreso con métricas y visualizar estado.
- **Salud**: Registrar peso, ver tendencia, historial, racha de enfoque.
- **Hábitos**: Crear hábitos, marcar/desmarcar completado, ver rachas y calendario semanal.
- **Turnos**: Estado actual (en turno / libre / próximo), crear y eliminar turnos.

## Scripts

```bash
npm run dev      # Desarrollo en http://localhost:3000
npm run build    # Build de producción
npm run lint     # ESLint
```

## Variables de entorno

Copiar `.env.example` a `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=        # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Anon key pública de Supabase
NEXT_PUBLIC_API_BASE_URL=        # Backend (default: http://localhost:8000/api/v1)
```

## Estructura

```
src/
├── app/
│   ├── actions/          # Server actions por módulo
│   ├── (dashboard)/      # Rutas protegidas (sidebar + topbar)
│   │   ├── finanzas/     # page.tsx + finanzas-client.tsx
│   │   ├── metas/        # page.tsx + metas-client.tsx
│   │   ├── salud/        # page.tsx + salud-client.tsx
│   │   ├── habitos/      # page.tsx + habitos-client.tsx
│   │   ├── turnos/       # page.tsx + turnos-client.tsx
│   │   └── omni/         # page.tsx (client component)
│   └── login/            # Login con Supabase Auth
├── components/
│   ├── dashboard/        # Shared: EmptyState, ErrorState, LoadingState, FormStatus, SubmitButton, Sidebar, Topbar
│   └── ui/               # shadcn/ui
├── lib/
│   ├── api/              # types.ts, server.ts, helpers.ts
│   ├── auth/             # Supabase SSR client/server
│   └── constants/        # navigation.ts
└── proxy.ts              # Route protection (auth guard)
```

Para documentación completa de handoff, ver `AGENTS.md`.
