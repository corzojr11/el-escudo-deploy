# El Escudo Web v2 — Guía de despliegue

## Resumen

Esta guía cubre el despliegue completo del frontend Next.js 16 (`escudo-web-v2`) en Vercel, conectado al backend FastAPI y Supabase Auth.

---

## 1. Requisitos previos

- Cuenta en [Vercel](https://vercel.com) (free tier funciona)
- Cuenta en [Supabase](https://supabase.com) con proyecto creado
- Backend FastAPI desplegado y accesible (ver sección 5)
- DeepSeek API key (para OMNI y capturas de texto)
- Git instalado

---

## 2. Variables de entorno

### 2.1 Frontend (`escudo-web-v2`)

Estas variables deben configurarse en Vercel Dashboard > Settings > Environment Variables:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `https://atmxoxcdaeuptnjcqhfg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública de Supabase | `eyJhbGci...` (la que empieza con `eyJ...`, role `anon`) |
| `NEXT_PUBLIC_API_BASE_URL` | URL base del backend FastAPI | `https://el-escudo-api.onrender.com/api/v1` |

**IMPORTANTE**: Las variables `NEXT_PUBLIC_*` se inyectan en tiempo de build. Si las cambias, debes redeployar.

### 2.2 Backend

El backend necesita estas variables en su entorno de despliegue:

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_KEY` | Service role key de Supabase |
| `SUPABASE_JWT_SECRET` | JWT secret de Supabase |
| `DEEPSEEK_API_KEY` | API key de DeepSeek |
| `DEEPSEEK_MODEL` | Opcional. Por defecto: `deepseek-v4-flash` |
| `FRONTEND_URL` | URL del frontend desplegado (para CORS) |
| `FRONTEND_URLS` | URLs adicionales separadas por coma (Vercel previews) |

---

## 3. Pasos de despliegue

### 3.1 Preparar repositorio

```bash
cd "D:\Proyectos IA\EL ESCUDO"
git init  # si no existe
git add -A
git commit -m "MVP listo para despliegue"

# Crear repo en GitHub y conectar
git remote add origin https://github.com/TU_USUARIO/el-escudo.git
git push -u origin master
```

### 3.2 Conectar Vercel

1. Ve a [vercel.com](https://vercel.com) → Add New Project
2. Importa el repositorio de GitHub
3. Configura:
   - **Root Directory**: `escudo-web-v2`
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build` (auto-detectado)
   - **Output Directory**: `.next` (auto-detectado)

### 3.3 Configurar variables de entorno en Vercel

En Vercel Dashboard > Settings > Environment Variables, agrega las 3 variables de la sección 2.1.

Selecciona los entornos: Production, Preview, Development.

### 3.4 Desplegar

Vercel despliega automáticamente al hacer push a la rama principal. También puedes forzar un deploy desde el dashboard.

La URL será algo como: `https://el-escudo.vercel.app`

### 3.5 Configurar Supabase Auth

En Supabase Dashboard > Authentication > URL Configuration:

- **Site URL**: `https://el-escudo.vercel.app`
- **Redirect URLs**: `https://el-escudo.vercel.app/**`

Esto es necesario para que las cookies de sesión funcionen correctamente en el dominio de producción.

---

## 4. Verificación post-deploy

Una vez desplegado, verifica:

1. **Carga de la app**: Visita la URL de Vercel. Debe redirigir a `/login`.
2. **Login**: Ingresa con un usuario existente de Supabase Auth.
3. **Dashboard**: Tras login, debe cargar el dashboard con datos reales.
4. **Módulos**: Navega a Finanzas, Metas, Salud, Hábitos, Turnos. Deben mostrar datos.
5. **OMNI**: Envía un comando simple como "Hola". Debe responder.
6. **Logout**: El botón en la topbar debe cerrar sesión y redirigir a `/login`.

### Si algo falla:

| Problema | Causa probable | Solución |
|---|---|---|
| Redirige en bucle login ↔ dashboard | Site URL no configurado en Supabase | Configurar Site URL en Supabase Auth |
| Dashboard muestra error | `NEXT_PUBLIC_API_BASE_URL` incorrecta | Verificar URL del backend |
| OMNI no responde | Backend no accesible o DeepSeek API key no configurada | Verificar backend `/health` |
| Error 401 en módulos | Token de sesión no válido | Verificar `SUPABASE_JWT_SECRET` en backend |
| CORS error en consola | `FRONTEND_URL` no configurado en backend | Agregar URL de Vercel al backend |

---

## 5. Desplegar el backend

El backend FastAPI puede desplegarse en Render, Railway o Fly.io.

### Opción A: Render (recomendado, free tier)

1. Ve a [render.com](https://render.com) → New Web Service
2. Conecta el repositorio
3. Configura:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Agrega las variables de entorno de la sección 2.2
5. Anota la URL (ej: `https://el-escudo-api.onrender.com`)

### Opción B: Docker en cualquier VPS

```bash
cd backend
docker build -t el-escudo-backend .
docker run -d -p 8000:8000 --env-file .env el-escudo-backend
```

---

## 6. Configuración de CORS en el backend

El backend usa `FRONTEND_URL` y `FRONTEND_URLS` para permitir orígenes. Configura estas variables en el entorno del backend:

```bash
# Un solo frontend
FRONTEND_URL=https://el-escudo.vercel.app

# Múltiples frontends (producción + previews)
FRONTEND_URLS=https://el-escudo.vercel.app,https://el-escudo-*.vercel.app
```

El patrón `https://el-escudo-*.vercel.app` NO funciona como wildcard en el backend actual. La variable `FRONTEND_URLS` espera URLs exactas separadas por coma. Para Vercel preview deployments (que generan URLs únicas por rama), deberás agregar cada URL explícitamente o modificar el backend para soportar wildcards.

---

## 7. Desarrollo local

Para desarrollo local con el backend corriendo en `localhost:8000`:

```bash
cd escudo-web-v2
cp .env.example .env.local
# Edita .env.local con las credenciales reales
npm install
npm run dev    # http://localhost:3000
```

El CORS del backend ya permite todos los orígenes `localhost` y `127.0.0.1` en cualquier puerto.

---

## 8. Notas de producción

- **`.env.local`** NO se despliega. Las variables se configuran en Vercel Dashboard.
- **`vercel.json`** contiene la configuración de build para Vercel.
- La app usa Server Actions para todas las mutaciones (POST/PUT/DELETE al backend). Esto evita exponer el token de Supabase al cliente.
- Las cookies de sesión de Supabase son httpOnly y secure en producción.
- El proxy (`proxy.ts`) protege todas las rutas excepto `/login` y assets estáticos.
