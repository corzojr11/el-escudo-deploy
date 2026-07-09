# EL ESCUDO — Guía de Deploy a Producción

**Versión:** 1.0  
**Fecha:** 2026-05-22  
**Estado:** Producción-ready (score 9.2/10)

---

## Tabla de Contenidos

1. [Requisitos Previos](#1-requisitos-previos)
2. [Variables de Entorno](#2-variables-de-entorno)
3. [Migraciones de Base de Datos](#3-migraciones-de-base-de-datos)
4. [Primer Deploy con Docker](#4-primer-deploy-con-docker)
5. [Verificación Pre-Deploy](#5-verificación-pre-deploy)
6. [Checklist Final](#6-checklist-final)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Requisitos Previos

Antes de comenzar, asegúrate de tener:

- **Docker** y Docker Compose instalados en la máquina de deploy
- **Cuenta en Supabase** con un proyecto creado y las tablas base migradas (auth, users, profiles, etc.)
- **Cuenta en Sentry** (opcional pero altamente recomendado para monitoreo de errores)
- **Dominio para el frontend** (ej: Vercel, Netlify, Cloudflare Pages)
- **Google Gemini API Key** (para OMNI)

---

## 2. Variables de Entorno

1. Copia el template:

```bash
cd backend
cp .env.example .env
```

2. Edita `.env` con los valores reales de producción:

| Variable | Requerida | Descripción | Ejemplo |
|----------|-----------|-------------|---------|
| `DEV_MODE` | ✅ | Siempre `false` en producción | `false` |
| `SUPABASE_URL` | ✅ | URL del proyecto Supabase | `https://abc123.supabase.co` |
| `SUPABASE_KEY` | ✅ | **Service Role Key** (secreta, nunca la anon key) | `pega_tu_service_role_key_aqui` |
| `SUPABASE_JWT_SECRET` | ✅ | Secret para verificar tokens JWT | `pega_tu_jwt_secret_aqui` |
| `GEMINI_API_KEY` | ✅ | API Key de Google Gemini | `pega_tu_gemini_api_key_aqui` |
| `SENTRY_DSN` | ⚪ | DSN de Sentry para reporte de errores | `https://...@sentry.io/...` |
| `FRONTEND_URL` | ✅ | Dominio real del frontend deployado | `https://el-escudo.vercel.app` |

> ⚠️ **Seguridad crítica:**
> - Nunca commitees `.env` real.
> - Usa la **Service Role Key** de Supabase, no la anon/public key.
> - Rotar `SUPABASE_JWT_SECRET` periódicamente.

---

## 3. Migraciones de Base de Datos

Las siguientes migraciones deben aplicarse **manualmente** en el SQL Editor de Supabase antes del primer deploy:

### 3.1 Migración 011 — Tabla de Hábitos

1. Abre el **SQL Editor** de tu proyecto Supabase.
2. Ejecuta el contenido de `supabase/migrations/011_add_habits_table.sql`.

```sql
-- Verificación rápida después de ejecutar:
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'habits';
-- Debe retornar 1 fila.
```

### 3.2 Migración 012 — XP y Nivel en Profiles

1. En el mismo SQL Editor, ejecuta `supabase/migrations/012_add_xp_level_to_profiles.sql`.

```sql
-- Verificación rápida:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('xp', 'level');
-- Debe retornar 2 filas.
```

### 3.3 Verificar RLS en Todas las Tablas

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'users', 'profiles', 'habits', 'finances', 'goals', 
    'health', 'omni_messages', 'projects', 'weight_history',
    'work_shifts', 'transactions', 'recipes', 'achievements',
    'push_tokens', 'fitness_logs'
  );
```

Todas las tablas deben tener `rowsecurity = true`. Si alguna no, ejecuta:

```sql
ALTER TABLE public.<nombre_tabla> ENABLE ROW LEVEL SECURITY;
```

---

## 4. Primer Deploy con Docker

### 4.1 Build de la Imagen

```bash
cd backend

# Verifica que .env tiene todos los valores reales
cat .env

# Construye la imagen
docker build -t el-escudo-backend .
```

### 4.2 Ejecución del Contenedor

```bash
# Ejecuta en puerto 8000
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  --name escudo-backend \
  el-escudo-backend
```

### 4.3 Verificación Inmediata

```bash
# Health check
curl http://localhost:8000/health

# Respuesta esperada:
# {"status": "ok", "version": "1.0.0", "timestamp": "2026-05-22T..."}
```

### 4.4 Detener / Reiniciar

```bash
# Ver logs
docker logs -f escudo-backend

# Detener
docker stop escudo-backend

# Eliminar
docker rm escudo-backend
```

---

## 5. Verificación Pre-Deploy

Ejecuta el script de verificación **antes** de exponer el servicio públicamente:

```bash
# Desde la raíz del proyecto
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
- ✅ Docker build y container arrancan sin erroros (si Docker está disponible)

**Si el script retorna exit code 1, corrige los errores antes de deployar.**

---

## 6. Checklist Final

Antes de declarar el deploy exitoso, confirma:

- [ ] `.env` configurado con valores reales (no commiteado)
- [ ] `DEV_MODE=false`
- [ ] `SENTRY_DSN` configurado (si usas Sentry)
- [ ] `FRONTEND_URL` apunta al dominio real del frontend
- [ ] `SUPABASE_KEY` es la **Service Role Key** (no la anon key)
- [ ] Migraciones 011 y 012 aplicadas en Supabase
- [ ] RLS activo en **todas** las tablas (verificar con query SQL)
- [ ] `/health` responde 200 con JSON válido
- [ ] Rate limiting activo en OMNI (`@limiter.limit()` en `routers/omni.py`)
- [ ] Docker container arranca sin errores
- [ ] Frontend puede hacer login y sync sin errores de CORS
- [ ] Push notifications funcionan (si `exponent_server_sdk` está configurado)

---

## 7. Troubleshooting

### Docker build falla

```bash
# Verificar que requirements.txt existe y no tiene dependencias rotas
cat backend/requirements.txt

# Rebuild sin cache
docker build --no-cache -t el-escudo-backend backend/
```

### CORS errors desde el frontend

1. Verifica que `FRONTEND_URL` en `.env` coincide exactamente con el dominio del frontend (incluyendo `https://`).
2. No uses `*` en `allow_origins` en producción.
3. Reinicia el contenedor después de cambiar `.env`.

### Supabase "JWT signature verification failed"

1. Verifica que `SUPABASE_JWT_SECRET` coincide con el secret de tu proyecto Supabase (Settings → API → JWT Settings).
2. Asegúrate de no estar usando la anon key como JWT secret.

### OMNI no responde o responde con error 500

1. Verifica que `GEMINI_API_KEY` es válida y tiene crédito disponible.
2. Revisa logs del backend: `docker logs escudo-backend | grep -i "omni\|gemini"`.
3. Verifica que las migraciones de `omni_messages` están aplicadas.

### Hábitos no persisten entre sesiones

1. Verifica que la migración 011 (`habits` table) está aplicada.
2. Revisa que RLS está activo en `habits` y que las policies permiten INSERT/UPDATE al usuario autenticado.

---

## Apéndice: Estructura de Archivos Relevante

```
EL ESCUDO/
├── backend/
│   ├── main.py              # Entrypoint FastAPI (config central)
│   ├── auth.py              # JWT validation
│   ├── trm.py               # TRM/Exchange rate cache
│   ├── Dockerfile           # Container image
│   ├── .env.example         # Template de variables
│   ├── requirements.txt     # Dependencias Python
│   └── routers/             # Routers modulares
│       ├── habits.py
│       ├── finances.py
│       ├── schedule.py
│       ├── goals.py
│       ├── health.py
│       ├── omni.py
│       ├── missions.py
│       └── bio.py
├── supabase/
│   └── migrations/
│       ├── 011_add_habits_table.sql
│       └── 012_add_xp_level_to_profiles.sql
├── scripts/
│   └── pre-deploy-check.py  # Verificación automática
└── el-escudo/               # Frontend React Native
```

---

*Documentación generada el 2026-05-22. Actualizar si cambia la arquitectura de deploy.*
