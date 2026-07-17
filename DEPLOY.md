# EL ESCUDO — Guía de Deploy a Producción

**Versión:** 2.0
**Fecha:** 2026-07-17

---

## Tabla de Contenidos

1. [Arquitectura](#1-arquitectura)
2. [Requisitos Previos](#2-requisitos-previos)
3. [Variables de Entorno](#3-variables-de-entorno)
4. [Migraciones de Base de Datos](#4-migraciones-de-base-de-datos)
5. [Deploy del Backend (Render)](#5-deploy-del-backend-render)
6. [Deploy del Frontend (Vercel)](#6-deploy-del-frontend-vercel)
7. [Verificación Pre-Deploy](#7-verificación-pre-deploy)
8. [Checklist Final](#8-checklist-final)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Arquitectura

```
Navegador (usuario)
       │
       ▼
escudo-web-v2/          ← Frontend activo (Next.js 16)
  ─► Despliegue: Vercel
  ─► Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
                NEXT_PUBLIC_API_BASE_URL
       │
       ▼
backend/                ← API REST (FastAPI + uvicorn)
  ─► Despliegue: Render (Docker) o servidor propio
  ─► Variables: SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET,
                GEMINI_API_KEY, FRONTEND_URL, DEV_MODE=false
       │
       ▼
Supabase                ← Base de datos PostgreSQL + Auth
  ─► Migraciones: 001 a 032 en orden secuencial
  ─► RLS activo en todas las tablas públicas
```

**Componentes del repositorio:**

| Directorio | Rol | Estado |
|---|---|---|
| `escudo-web-v2/` | Frontend web (Next.js 16, App Router) | **Activo — MVP** |
| `backend/` | API REST FastAPI | **Activo** |
| `supabase/migrations/` | Migraciones SQL (001–032) | **Activo** |
| `el-escudo/` | App móvil React Native / Expo | Activo |
| `el-escudo-web/` | SPA Vite anterior (React + TypeScript) | **Deprecado — no desplegar** |

---

## 2. Requisitos Previos

- **Cuenta en Supabase** con un proyecto creado.
- **Cuenta en Render** (o servidor propio con Docker).
- **Cuenta en Vercel** (para el frontend web).
- **Google Gemini API Key** (para OMNI).
- **Cuenta en Sentry** (opcional, para monitoreo de errores).

---

## 3. Variables de Entorno

### 3.1 Backend (`backend/.env`)

Copia desde `backend/.env.example` y completa **sin valores de ejemplo**:

| Variable | Requerida | Descripción |
|---|---|---|
| `DEV_MODE` | ✅ | `false` en producción |
| `SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `SUPABASE_KEY` | ✅ | **Service Role Key** (secreta, no la anon key) |
| `SUPABASE_JWT_SECRET` | ✅ | JWT Secret desde Supabase Dashboard > Settings > API |
| `GEMINI_API_KEY` | ✅ | API Key de Google Gemini |
| `FRONTEND_URL` | ✅ | URL del frontend deployado en Vercel |
| `SENTRY_DSN` | ⚪ | DSN de Sentry (opcional) |
| `OMNI_DAILY_COST_LIMIT_COP` | ⚪ | Límite diario OMNI por usuario (default 5000) |

> ⚠️ **Seguridad crítica:**
> - Nunca commitees `.env` real. Está en `.gitignore`.
> - Usa la **Service Role Key** de Supabase, no la anon/public key.
> - `FRONTEND_URL` es obligatoria en producción. Sin ella, CORS bloqueará las requests del frontend.
> - `DEV_MODE=false` siempre en producción.

### 3.2 Frontend (`escudo-web-v2/.env.local`)

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key pública (NO la service role key) |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | URL del backend, ej: `https://tu-backend.onrender.com/api/v1` |

El frontend obtiene el token de sesión desde las cookies httpOnly de Supabase Auth y lo envía al backend como `Authorization: Bearer <token>`.

---

## 4. Migraciones de Base de Datos

Las migraciones están en `supabase/migrations/` numeradas de `001` a `032`.

### 4.1 Proyecto existente

El proyecto Supabase actual ya tiene el esquema base. Para aplicar migraciones nuevas:

1. Abre el **SQL Editor** de Supabase.
2. Ejecuta el contenido del archivo de migración correspondiente.
3. Si el archivo usa `IF NOT EXISTS` / `DROP IF EXISTS` (lo hacen), es seguro re-ejecutarlo.

### 4.2 Proyecto nuevo (base de datos limpia)

Ejecuta los archivos en orden estrictamente secuencial:

```
001_core_schema.sql
002_bio_settings.sql
003_add_day_to_shifts.sql
004_add_columns_to_missions.sql
005_add_push_tokens_table.sql
006_add_achievements_table.sql
007_add_fitness_logs_table.sql
008_add_omni_recipes_table.sql
009_add_update_policies.sql
010_add_omni_messages.sql
011_add_habits_table.sql
012_add_xp_level_to_profiles.sql
013_add_moods_table.sql
014_leaderboard.sql
015_challenges.sql
016_clans.sql
017_reminder_patterns.sql
018_password_reset.sql
019_add_performance_indexes.sql
020_focus_status.sql
021_observability_events.sql
022_missions_task_fields.sql
023_add_routines_table.sql
024_password_reset_deprecation.sql
025_profiles_bootstrap.sql
026_goals_current_value.sql
027_routines_columns.sql
028_bio_settings_fix.sql
029_omni_proposals.sql
030_omni_idempotency.sql
031_fase2_daily_tools.sql
032_fase3_progress_health.sql
```

> ⚠️ **Nota:** Las migraciones `031` y `032` asumen que las tablas `finances`, `shifts` y `weight_logs` ya existen (se crearon fuera del sistema de migraciones). Si alguna falla en una base limpia, verifica que esas tablas existen antes de ejecutarlas.

### 4.3 Verificar RLS

Todas las tablas públicas deben tener Row Level Security activo:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Si alguna tabla tiene `rowsecurity = false`, actívala:

```sql
ALTER TABLE public.<nombre_tabla> ENABLE ROW LEVEL SECURITY;
```

---

## 5. Deploy del Backend (Render)

### 5.1 Preparar imagen Docker

```bash
cd backend
docker build -t el-escudo-backend .
```

### 5.2 Probar localmente

```bash
docker run -d -p 8000:8000 --env-file .env --name escudo-backend el-escudo-backend
curl http://localhost:8000/health
# Respuesta esperada: {"status": "ok", "version": "1.0.0", "timestamp": "..."}
```

### 5.3 Subir a Render

1. Crea un nuevo **Web Service** en Render.
2. Conecta el repositorio, selecciona `backend/` como root.
3. Tipo: **Docker**.
4. Configura las variables de entorno en el Dashboard de Render (nunca en el código).
5. Render ejecutará el `Dockerfile` automáticamente.

### 5.4 Detener / Reiniciar

```bash
docker logs -f escudo-backend
docker stop escudo-backend
docker rm escudo-backend
```

---

## 6. Deploy del Frontend (Vercel)

### 6.1 Conectar repositorio

1. Crea un nuevo proyecto en Vercel.
2. Conecta el repositorio.
3. **Root directory:** `escudo-web-v2`
4. **Framework:** Next.js (se detecta automáticamente).
5. **Build command:** `npm run build` (default).
6. **Output directory:** `.next` (default).

### 6.2 Variables de entorno en Vercel

Configura en el Dashboard de Vercel (Project > Settings > Environment Variables):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública |
| `NEXT_PUBLIC_API_BASE_URL` | URL del backend en Render, ej: `https://tu-backend.onrender.com/api/v1` |

### 6.3 Configurar Supabase Auth

1. Supabase Dashboard > Authentication > Settings.
2. **Site URL:** Pega la URL de Vercel (ej: `https://el-escudo.vercel.app`).
3. Agrega `https://el-escudo.vercel.app/auth/callback` en **Redirect URLs**.

### 6.4 Actualizar `FRONTEND_URL` en el backend

En el `.env` del backend (Render Dashboard), actualiza:

```
FRONTEND_URL=https://el-escudo.vercel.app
```

---

## 7. Verificación Pre-Deploy

Ejecuta **antes** de exponer el servicio públicamente:

```bash
python scripts/pre-deploy-check.py
```

El script verifica:

- ✅ `DEV_MODE=false`
- ✅ `SENTRY_DSN` configurado (advertencia si falta)
- ✅ `FRONTEND_URL` definida y no es `*`
- ✅ `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET` presentes
- ✅ `GEMINI_API_KEY` presente
- ✅ Endpoint `/health` responde 200
- ✅ Conexión a Supabase REST API exitosa
- ⚠️ RLS activo en tablas (requiere verificación manual)
- ⚠️ Rate limiting OMNI (verificación manual del código)
- ✅ Docker build y container arrancan sin errores (si Docker está disponible)

**Si el script retorna exit code 1, corrige los errores antes de deployar.**

---

## 8. Checklist Final

Antes de declarar el deploy exitoso:

- [ ] `backend/.env` configurado con valores reales (no commiteado)
- [ ] `DEV_MODE=false`
- [ ] `SENTRY_DSN` configurado (si usas Sentry)
- [ ] `FRONTEND_URL` apunta al dominio real del frontend
- [ ] `SUPABASE_KEY` es la **Service Role Key** (no la anon key)
- [ ] Migraciones `001` a `032` aplicadas en orden
- [ ] RLS activo en **todas** las tablas públicas
- [ ] `/health` responde 200 con JSON válido
- [ ] Rate limiting activo en OMNI (`services/omni_service.py`)
- [ ] Docker container arranca sin errores
- [ ] Frontend puede hacer login y sync sin errores de CORS
- [ ] `escudo-web-v2` compila sin errores (`npm run build`)
- [ ] Push notifications funcionan (si `exponent_server_sdk` está configurado)

---

## 9. Troubleshooting

### Docker build falla

```bash
cat backend/requirements.txt
docker build --no-cache -t el-escudo-backend backend/
```

### CORS errors desde el frontend

1. Verifica que `FRONTEND_URL` en el backend coincide exactamente con el dominio del frontend (incluyendo `https://`).
2. No uses `*` en `allow_origins` en producción.
3. Reinicia el contenedor después de cambiar variables de entorno.

### Supabase "JWT signature verification failed"

1. Verifica que `SUPABASE_JWT_SECRET` coincide con el secret del proyecto Supabase (Settings > API > JWT Settings).
2. Asegúrate de no estar usando la anon key como JWT secret.

### OMNI no responde o responde con error 500

1. Verifica que `GEMINI_API_KEY` es válida y tiene crédito disponible.
2. Revisa logs del backend.
3. Verifica que las migraciones `010`, `029`, `030` (OMNI) están aplicadas.

### Errores de migración en Supabase SQL Editor

1. Si el error dice `relation already exists`: la tabla ya existe, puedes ignorarlo si la migración es idempotente.
2. Si el error dice `relation "xxx" does not exist`: la migración anterior no se ejecutó. Detente, ejecuta las migraciones faltantes en orden.
3. Si el error dice `permission denied`: verifica que usas una cuenta con permisos de administración en Supabase.
4. Ante cualquier error que no entiendas, **detente y revisa** antes de continuar.

---

## Apéndice: Estructura de Archivos Relevante

```
EL ESCUDO/
├── escudo-web-v2/                 # Frontend web activo (Next.js 16)
│   ├── .env.example
│   ├── package.json
│   ├── vercel.json
│   ├── next.config.ts
│   └── src/
│       ├── app/actions/           # Server Actions
│       ├── lib/api/               # API client (server.ts, types.ts)
│       └── lib/auth/              # Supabase SSR (server.ts, client.ts)
├── backend/                       # API REST (FastAPI)
│   ├── main.py                    # Entrypoint
│   ├── auth.py                    # JWT validation
│   ├── database.py                # Supabase client
│   ├── trm.py                     # Exchange rate cache
│   ├── Dockerfile
│   ├── .env.example
│   └── routers/                   # Endpoints por módulo
├── supabase/
│   └── migrations/                # 001 a 032
├── el-escudo/                     # App móvil (React Native / Expo)
├── scripts/
│   └── pre-deploy-check.py
└── DEPLOY.md                      # Este archivo
```

---

*Documento actualizado el 2026-07-17. Mantener sincronizado con la arquitectura real del proyecto.*
