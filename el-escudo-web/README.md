# ⛔ el-escudo-web — DEPRECADO / NO DESPLEGAR

Esta es una SPA Vite (React + TypeScript) **anterior** al frontend activo.

**No desplegar.** No recibe mantenimiento activo.

## Frontend activo

El frontend web actual del proyecto está en [`../escudo-web-v2/`](../escudo-web-v2/) (Next.js 16 + App Router + Tailwind CSS v4), desplegado en Vercel.

## ¿Por qué está deprecado?

- No tiene sistema de autenticación (no envía tokens al backend).
- La URL del backend está hardcodeada (`http://localhost:8000`).
- No usa variables de entorno (`VITE_*`).
- El frontend activo (`escudo-web-v2/`) implementa Server Actions, Supabase SSR y un patrón de módulos consistente.

---

*Este directorio se conserva como referencia histórica. No eliminar.*
