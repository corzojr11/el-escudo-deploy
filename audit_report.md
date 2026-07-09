# 🛡️ AUDITORÍA COMPLETA — EL ESCUDO
### Auditoría de producción · Junio 2026

> **Scope**: Frontend Expo/React Native · Backend FastAPI · Supabase · Configuración · Seguridad · UX/UI · Android readiness
> **Archivos revisados**: 120+ archivos, ~530 KB de código fuente analizado línea por línea
> **Veredicto**: ⚠️ **CASI LISTA — con bloqueadores que deben resolverse antes de uso real**

---

## A. Resumen Ejecutivo

**El Escudo** es un Cloud OS personal con un scope ambicioso: finanzas, salud, turnos laborales, metas, tareas, hábitos, nutrición, gamificación, clanes, retos 1v1, leaderboard, y un asistente IA (OMNI/NAVIR) que opera la app con lenguaje natural. El stack es sólido (Expo SDK 54, FastAPI, Supabase, Zustand, Gemini 2.5 Flash Lite).

### Lo que está bien
- ✅ Arquitectura general coherente: separación frontend/backend/DB
- ✅ RLS (Row Level Security) correctamente implementado en tablas core
- ✅ Sistema OMNI con 25+ intents funcionales y resolución de entidades inteligente
- ✅ Gamificación con XP, niveles, rachas y logros
- ✅ Error boundary global con fallback por pantalla
- ✅ Endpoint `/sync` que centraliza la hidratación del estado
- ✅ Sistema de anclajes biológicos (bio timeline) — feature único y valioso
- ✅ Pre-deploy check script y smoke tests
- ✅ Security headers OWASP en todas las respuestas
- ✅ Rate limiting global + per-user en OMNI + daily cost cap

### Lo que falta o está roto
- 🔴 **Secretos reales en `.env` commiteado** (Supabase service role key, JWT secret, Gemini API key)
- 🔴 **`localhost` como URL default del backend** — no funciona en Android real
- 🔴 **JWT acepta 4 algoritmos** — vulnerable a algorithm confusion
- 🔴 **`register_push_token` usa variable `supabase` no importada** — crash en runtime
- 🔴 **NutritionScreen: 46KB de código sin persistencia** — datos perdidos al navegar
- 🔴 **0 tests en frontend** (solo 1 para gamificación)
- 🔴 **11 de 16 pantallas inaccesibles** desde la navegación principal

### ¿Qué tan listo está?
En su estado actual, la app **funciona en Expo Go** en desarrollo local pero **fallará en un APK real en Android** por 3 razones inmediatas: URL del backend, falta de plugin de notificaciones en app.json, y ausencia de storage adapter para Supabase auth. Estimación: **5-7 días de trabajo enfocado** para cerrar los bloqueadores.

---

## B. Hallazgos Críticos

| # | Hallazgo | Severidad | Impacto | Archivo / Módulo | Recomendación |
|---|----------|-----------|---------|-------------------|---------------|
| 1 | **Secretos reales en `.env` del backend** (service role key, JWT secret, Gemini key) | 🔴 CRÍTICA | Cualquiera con acceso al repo tiene control total de la DB y la IA | [.env](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/.env) | Revocar y regenerar TODAS las keys inmediatamente. Añadir `.env` a `.gitignore`. Verificar historial de Git. |
| 2 | **Supabase anon key hardcodeada en código fuente** | 🔴 CRÍTICA | Impide cambiar de proyecto Supabase sin rebuild. Se expone en el bundle JS | [supabase.ts:4-5](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/utils/supabase.ts#L4-L5) | Mover a `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env` |
| 3 | **`localhost:8001` como API default** — inutilizable en Android físico | 🔴 CRÍTICA | La app no conecta al backend en un celular real | [api.ts:4](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/config/api.ts#L4) | Cambiar default a la URL de producción (Render/Railway). Detectar automáticamente `__DEV__` para localhost. |
| 4 | **JWT acepta 4 algoritmos (HS256, ES256, RS256, EdDSA)** | 🔴 CRÍTICA | Vulnerable a algorithm-confusion attacks. Supabase usa HS256 exclusivamente | [auth.py:37](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/auth.py#L37) | Cambiar a `algorithms=["HS256"]` |
| 5 | **`register_push_token` usa `supabase` sin importarla** | 🔴 CRÍTICA | Crash con `NameError` al registrar token push — notificaciones rotas | [main.py:208](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/main.py#L208) | Agregar `from database import supabase` al inicio de `main.py` |
| 6 | **No hay `AsyncStorage` adapter para Supabase auth** | 🔴 ALTA | Sesiones de auth no persisten en Android — el usuario debe re-loguearse tras cada cierre de app | [supabase.ts](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/utils/supabase.ts) | Configurar `createClient` con `auth: { storage: AsyncStorage }` |
| 7 | **Password reset almacena OTP en texto plano** | 🔴 ALTA | Si la tabla se expone, todos los OTPs activos son visibles | [password_reset.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/routers/password_reset.py) | Usar `bcrypt` para hashear OTP o reemplazar con Supabase auth nativo |
| 8 | **`requirements.txt` sin pinning de versiones** y paquetes faltantes | 🔴 ALTA | `pip install` puede romper el backend en cualquier momento. Falta `supabase`, `PyJWT` | [requirements.txt](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/requirements.txt) | Pinear versiones. Agregar paquetes faltantes. |
| 9 | **NutritionScreen: 46KB de UI sin persistencia** — todo se pierde al navegar | 🔴 ALTA | Feature completamente inútil en su estado actual | [NutritionScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/NutritionScreen.tsx) | Conectar al store y backend, o eliminar |
| 10 | **`hydrateStore` silencia todos los errores** (`catch {}` vacío) | 🔴 ALTA | El usuario no sabe si sus datos están sincronizados o no | [authSlice.ts:233](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/store/slices/authSlice.ts#L233) | Mostrar toast de error. Implementar retry con backoff. |
| 11 | **Falta plugin `expo-notifications`** en app.json | ⚠️ ALTA | Push notifications no funcionarán en build EAS de producción | [app.json:42-45](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/app.json#L42-L45) | Agregar `["expo-notifications", { "icon": "..." }]` |
| 12 | **Migraciones duplicadas** (`ALL_MIGRATIONS_011_to_017.sql`, `MIGRACIONES_014_to_017_SOLO_FALTANTES.sql`) | ⚠️ ALTA | Pueden causar errores "already exists" si se ejecutan | [supabase/migrations/](file:///d:/Proyectos%20IA/EL%20ESCUDO/supabase/migrations) | Eliminar ambos archivos |
| 13 | **Resolución fallback de entidades demasiado agresiva** | ⚠️ ALTA | "Borrar tarea X" puede borrar una tarea completamente diferente si X no se encuentra | [omni_handlers.py:99-108](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/services/omni_handlers.py#L99-L108) | Eliminar fallback-to-first. Retornar None y pedir clarificación al usuario. |
| 14 | **Hardcoded Supabase URL fallback en database.py** | ⚠️ MEDIA | Si falta la env var, usa producción silenciosamente | [database.py:7](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/database.py#L7) | Crash si la env var falta |
| 15 | **DEV_MODE=true activo en `.env`** pero no hace nada real | ⚠️ MEDIA | Confusión: el flag se documenta como "bypass de auth" pero no tiene efecto | [auth.py:22-23](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/auth.py#L22-L23) | Implementar o eliminar |

---

## C. Revisión por Áreas

### C1. Arquitectura

**Estado: ⚠️ Funcional pero con deuda técnica significativa**

- **Patrón**: Monolito backend FastAPI + app Expo con Zustand. Correcto para escala personal.
- **Problema principal**: Archivos monolíticos. Los 5 archivos más grandes suman **224 KB** de código:

| Archivo | Tamaño | Líneas | Problema |
|---------|--------|--------|----------|
| [omni_handlers.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/services/omni_handlers.py) | 52 KB | 1,096 | 7 handlers en un solo archivo |
| [NutritionScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/NutritionScreen.tsx) | 47 KB | ~1,100 | Sub-app completa sin persistencia |
| [ProfileScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/ProfileScreen.tsx) | 47 KB | ~1,100 | Settings + profile + about en uno |
| [ScheduleScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/ScheduleScreen.tsx) | 38 KB | ~950 | 3 modals + timeline + CRUD |
| [OmniConsole.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/components/OmniConsole.tsx) | 36 KB | ~900 | Chat completo en un componente |

> **Recomendación**: Cada archivo >20KB necesita decomposición. Regla: máximo 300 líneas por componente/módulo.

- **Código muerto detectado**:
  - [agent_service.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/services/agent_service.py) — 12KB de function-calling de Gemini nunca usado
  - [CommandCenterScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/CommandCenterScreen.tsx) — 899 bytes stub vacío
  - [get_db()](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/database.py#L24-L27) — helper async nunca usado
  - [integrations/fitness.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/integrations/fitness.py) — retorna datos mock

---

### C2. Backend

**Estado: ⚠️ Funcional pero con riesgos de seguridad y mantenibilidad**

- **Lo bueno**:
  - FastAPI con middleware de seguridad OWASP
  - APScheduler con socket-lock para evitar ejecución duplicada
  - Rate limiting global (100/min) + específico para OMNI (30/min/user + daily cost cap)
  - Sentry integration opcional
  - Observability events tracking

- **Lo malo**:
  - Sin pinning de dependencias → builds no reproducibles
  - `datetime.utcnow()` deprecated desde Python 3.12 (usado en health check)
  - PushClient instanciado en cada envío (debería ser singleton)
  - Rate limits y dedup en memoria → se pierden al reiniciar
  - Sin paginación en sync ni leaderboard

- **Routers sin tests** (11 de 18):

| Router | Tamaño | Tests |
|--------|--------|-------|
| finances.py | 13.7 KB | ❌ |
| schedule.py | 11.1 KB | ❌ |
| challenges.py | 15.2 KB | ❌ |
| clans.py | 17.3 KB | ❌ |
| habits.py | 5.1 KB | ❌ |
| moods.py | 1.2 KB | ❌ |
| leaderboard.py | 3.7 KB | ❌ |
| reminders.py | 2.2 KB | ❌ |
| password_reset.py | 6.0 KB | ❌ |
| routines.py | 4.0 KB | ❌ |
| observability.py | 4.7 KB | ❌ |

---

### C3. API / Sincronización

**Estado: ⚠️ Funcional unidireccional, sin robustez offline**

- **Sync model**: Full-dump pull via `GET /api/v1/sync`. El servidor envía TODOS los datos del usuario (11 tablas) en un solo request. No hay sync incremental, deltas, ni timestamps de última modificación.
- **Problema fundamental**: Las mutaciones locales (agregar transacción, completar tarea, etc.) **solo se guardan en AsyncStorage** y se sobreescriben en el siguiente sync. No hay cola de operaciones pendientes.
- **Sin timeout en requests**: Las peticiones pueden colgarse indefinidamente en conexiones lentas.
- **Sin retry con backoff**: Un fallo = dato perdido hasta el siguiente sync automático.
- **Sin paginación**: A medida que los datos crecen, el sync se vuelve más lento.

> **Recomendación**: Implementar un **operation queue** que almacene mutaciones locales y las envíe al servidor cuando haya conexión. Patrón Command Queue + optimistic updates.

---

### C4. Autenticación / Multiusuario

**Estado: ⚠️ Funcional para uso personal, con vulnerabilidades**

- **Flow**: Supabase Auth directo desde el frontend (email/password). El backend valida tokens con doble check: Supabase SDK + PyJWT fallback local.
- **Vulnerabilidades**:
  - JWT acepta 4 algoritmos (CRÍTICO — ver hallazgo #4)
  - DEV_MODE flag sin efecto real pero documentado como "bypass"
  - Sin rate limiting en login (Supabase lo maneja pero el backend no)
  - Sin biometric auth (fingerprint/face)
  - Sin refresh token handling explícito

- **Multiusuario**: La app tiene features sociales (clanes, retos, leaderboard) que requieren múltiples usuarios. El RLS está bien implementado para aislamiento. Sin embargo, no hay sistema de invitaciones ni onboarding social.

---

### C5. Persistencia / Estado

**Estado: ⚠️ Funcional pero frágil**

- **Stack**: Zustand + AsyncStorage (persist middleware) + Supabase (server).
- **7 slices** fusionados en un solo store monolítico. Cualquier update notifica a todos los suscriptores.
- **Partialización correcta**: Solo se persisten los datos esenciales (no sesiones ni flags temporales).
- **Migración de store**: Implementada (v1→v2→v3) pero sin validación de forma — datos corruptos en AsyncStorage pueden crashear la app.
- **Problema de conflictos**: Si el usuario hace cambios locales y OMNI modifica los mismos datos en el servidor, el siguiente sync sobreescribe todo sin merge.
- **XP local vs servidor**: La XP se gana localmente con `addXP()` pero solo se lee del servidor en `hydrateStore`. Los XP locales se pierden al reinstalar.

---

### C6. Notificaciones

**Estado: ⚠️ Parcialmente implementado**

- **Push**: Expo Push Notifications con registro de tokens. Backend envía via `exponent-server-sdk`.
- **Problema**: Falta el plugin `expo-notifications` en [app.json](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/app.json) → push no funciona en build EAS.
- **Bio anchors**: El scheduler envía notificaciones contextuales cada 5 min basadas en anclajes biológicos. Feature excelente pero:
  - Usa timezone local del servidor, no del usuario
  - Dedup en memoria — se reinicia al reiniciar el servidor
  - No hay forma de que el usuario configure qué notificaciones quiere

---

### C7. Assistant / Chat (OMNI)

**Estado: ✅ Feature más completo del proyecto**

- **Motor**: Gemini 2.5 Flash Lite con system instruction detallada
- **25+ intents** funcionales:  CREATE/UPDATE/COMPLETE/DELETE para tasks, goals, shifts, routines; LOG para weight, exercise, sleep; REGISTER para focus/urge/relapse; finanzas (income, expenses)
- **Multi-intent**: Soporte para comandos compuestos ("registra mi peso y crea una tarea")
- **Cost tracking**: Calcula el costo en COP por interacción y lo muestra al usuario
- **Lo que falta**:
  - **Sin historial conversacional**: Cada mensaje es single-turn. OMNI no recuerda lo que dijiste hace 2 mensajes.
  - **Sin confirmación para acciones destructivas**: "borra todas mis tareas" se ejecuta directamente.
  - **Resolución de entidades demasiado agresiva**: Si no encuentra la tarea/meta solicitada, opera sobre la primera que encuentre.
  - **Sin capacidad de lectura**: OMNI puede crear/modificar datos pero no puede consultarlos ("¿cuánto gasté este mes?").

---

### C8. Navegación

**Estado: ⚠️ Incompleta y confusa**

- **5 tabs**: Inicio (Chat), Turnos, Finanzas, Salud, Estado (Dashboard)
- **11 pantallas ocultas**: Solo accesibles desde botones en EstadoScreen. El usuario debe *descubrir* que existen:

| Pantalla | Acceso | Problema |
|----------|--------|----------|
| Projects | Botón en Estado | No obvio |
| Habits | Botón en Estado | No obvio |
| Challenges | Botón en Estado | No obvio |
| Clans | Botón en Estado | No obvio |
| Leaderboard | Botón en Estado | No obvio |
| Profile | Icono en Estado | No obvio |
| Nutrition | ❓ Sin ruta clara | Posiblemente inaccesible |
| OmniRecipes | Desde OmniChat | Razonable |
| Onboarding | Auto (sin profile) | Correcto |
| Login | Auto (sin sesión) | Correcto |
| CommandCenter | ❓ Sin ruta clara | Código muerto |

> **Recomendación**: Implementar un **drawer lateral** o una **pantalla de menú** que exponga todas las secciones. Alternativamente, reorganizar las tabs para incluir un tab "Más" con acceso a las pantallas secundarias.

---

### C9. UI/UX

**Estado: ⚠️ Estética correcta, usabilidad mejorable**

- **Dark mode** implementado y coherente. Paleta de colores atractiva (verde acento, fondos oscuros, glassmorphism sutil).
- **Tipografía** Space Grotesk consistente.
- **Problemas UX concretos**:
  - **Inputs de tiempo como texto libre** en vez de time pickers nativos (ScheduleScreen, ProfileScreen, OnboardingScreen)
  - **Inputs de fecha como texto** ("YYYY-MM-DD") en vez de date pickers (ProjectsScreen)
  - **Sin diálogos de confirmación** para acciones destructivas
  - **Sin empty states** en la mayoría de pantallas — el usuario ve un espacio vacío
  - **Sin onboarding tour** post-registro para mostrar las funcionalidades
  - **Sin indicador offline** — el usuario no sabe si tiene conexión
  - **El botón de onboarding no tiene "atrás"** — no puede corregir un paso anterior
  - **Sin pull-to-refresh** en la mayoría de pantallas (solo Estado)

---

### C10. Rendimiento

**Estado: ⚠️ Potenciales problemas en Android real**

| Problema | Impacto | Pantallas afectadas |
|----------|---------|---------------------|
| `ScrollView` en vez de `FlatList` para listas | Re-render total, lag con 50+ items | OmniChat, Finances, Habits, Schedule |
| `detachInactiveScreens={false}` | Todas las 5 tabs en memoria siempre | TabNavigator |
| Sin `React.memo` | Re-renders innecesarios | Todos los componentes |
| SVG pesado en BioTimeline | Jank en gama baja | Schedule, Estado |
| 2 librerías de speech recognition | Bundle innecesariamente grande | OmniChat |
| `react-native-wagmi-charts` para bar charts simples | Librería pesada para uso mínimo | Finances, Health |

> **Recomendación inmediata**: Reemplazar `ScrollView` por `FlatList` en las listas de chat y transacciones. Esto solo puede mejorar el rendimiento significativamente en Android.

---

### C11. Seguridad

**Estado: 🔴 Necesita acción inmediata**

| Riesgo | Severidad | Estado |
|--------|-----------|--------|
| Secretos en `.env` commiteado | 🔴 CRÍTICA | `.env` tiene service role key, JWT secret, Gemini key |
| Supabase anon key hardcodeada | 🔴 CRÍTICA | En el source code, visible en el bundle |
| JWT algorithm confusion | 🔴 CRÍTICA | Acepta 4 algoritmos |
| OTP en texto plano | 🔴 ALTA | password_reset.py |
| Sin rate limit en login | ⚠️ MEDIA | Supabase tiene su propio pero no hay extra |
| Sin HTTPS enforcement | ⚠️ MEDIA | El backend no redirige HTTP→HTTPS |
| Sin Content-Security-Policy | ⚠️ BAJA | Solo relevante para web |
| RLS en tablas core | ✅ | Correctamente implementado |
| Security headers OWASP | ✅ | X-Frame-Options, X-Content-Type, etc. |
| Rate limiting global | ✅ | 100/min via slowapi |

---

### C12. Manejo de Errores

**Estado: ⚠️ Parcial**

- ✅ **Backend**: `ApiException` handler + unhandled exception handler con observability tracking. Bueno.
- ✅ **Frontend**: `ErrorBoundary` global + per-screen. Bueno.
- ❌ **Sync silencioso**: `hydrateStore` catch vacío — el error más peligroso de la app.
- ❌ **Sin toast/snackbar global**: Los errores de red no se comunican al usuario.
- ❌ **Sin retry**: Ningún request tiene retry automático.
- ❌ **ErrorBoundary no reporta a Sentry**: Solo hace `console.error`.

---

### C13. Accesibilidad

**Estado: 🔴 No implementada**

- Zero `accessibilityLabel` en todo el proyecto
- Zero `accessibilityRole` 
- Zero `accessibilityHint`
- Algunos touch targets < 48dp (mínimo Android)
- Sin soporte de screen reader
- Contraste generalmente bueno pero textos `muted` pueden fallar WCAG AA

---

### C14. Compatibilidad Android

**Estado: ⚠️ Bloqueadores presentes**

| Problema | Impacto |
|----------|---------|
| `localhost` como backend default | No conecta en dispositivo real |
| Sin AsyncStorage adapter para Supabase | Sesión no persiste |
| Falta plugin `expo-notifications` | Push no funciona |
| Falta plugin `expo-speech-recognition` | Reconocimiento de voz puede fallar |
| `boxShadow` en TabNavigator | Propiedad web, no nativa |
| `predictiveBackGestureEnabled: false` | Mala UX en Android 14+ |
| Sin manejo de botón back Android | Comportamiento impredecible en pantallas modales |
| `@react-native-voice/voice` duplicado con `expo-speech-recognition` | Conflictos potenciales |

---

### C15. Preparación para iOS

**Estado: ⚠️ Parcialmente preparado**

- ✅ `bundleIdentifier` definido
- ✅ `infoPlist` con permisos de micrófono y speech recognition
- ✅ `UIBackgroundModes` configurado
- ⚠️ Falta configurar `expo-notifications` para iOS (APNs)
- ⚠️ Sin testeo real en iOS — pueden haber bugs de plataforma
- ⚠️ Tab bar height hardcodeada a 88px para iOS — puede ser excesiva en modelos pequeños

---

## D. Qué Mejoraría Yo Si Fuera el Producto

### D1. Nuevas funciones útiles
1. **Sync bidireccional con cola de operaciones** — que las mutaciones locales se encolen y se envíen cuando hay red. Patrón CQRS lite.
2. **OMNI con memoria conversacional** — enviar los últimos 5 mensajes como contexto a Gemini. Hace la experiencia 10x mejor.
3. **OMNI como lector de datos** — "¿cuánto gasté este mes?", "¿cuál es mi racha?", "¿cuánto peso bajé?". Actualmente OMNI solo escribe.
4. **Widget de Android** — mostrar racha, próximo turno, o balance en la home screen sin abrir la app.
5. **Notificaciones configurables** — dejar que el usuario elija qué notificaciones quiere y a qué hora.
6. **Recordatorios inteligentes activos** — el sistema de `reminders.py` analiza patrones pero los recordatorios son pasivos. Activar nudges proactivos.

### D2. Mejoras de flujo
1. **Onboarding post-registro**: Un tour rápido (3-4 pasos) mostrando Chat, Turnos, Finanzas, Salud.
2. **Drawer o menú "Más"**: Exponer las pantallas ocultas (Projects, Habits, Challenges, etc.).
3. **Pull-to-refresh global**: En todas las pantallas, no solo Estado.
4. **Quick actions en home**: En vez de navegar a una pantalla para registrar peso, poder hacerlo desde un FAB o desde el chat.

### D3. Mejoras visuales
1. **Empty states con ilustraciones**: Cuando no hay transacciones, metas, etc., mostrar un estado vacío atractivo con un CTA.
2. **Skeleton loaders**: Mientras carga el sync, mostrar esqueletos en vez de spinners.
3. **Micro-animaciones en completar tarea/hábito**: La gamificación necesita "juice" — confetti, shake, glow.
4. **Charts mejorados**: Reemplazar wagmi-charts por una librería más ligera como `react-native-chart-kit` o SVG custom simple.

### D4. Simplificación de pantallas
1. **Fusionar ScheduleScreen** en 2 tabs internos: Turnos | Sueño/Bio. Son conceptos diferentes mezclados.
2. **ProfileScreen → extraer Settings** a una pantalla separada. Profile y Settings son cosas distintas.
3. **OmniChatScreen → extraer el grid de quick commands** a un componente separado.

---

## E. Qué Quitaría

| Elemento | Razón | Acción |
|----------|-------|--------|
| [CommandCenterScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/CommandCenterScreen.tsx) | 899 bytes de código muerto. Solo renderiza un texto. | **Eliminar** |
| [agent_service.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/services/agent_service.py) | 12KB de function-calling API nunca integrado. El OMNI usa omni_service.py. | **Eliminar** |
| [integrations/fitness.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/integrations/fitness.py) | Retorna datos mock de Google Fit/Apple Health. No hay integración real. | **Eliminar** (readd cuando se implemente) |
| [get_db()](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/database.py#L24-L27) | Async generator que nunca se usa. | **Eliminar** |
| [ALL_MIGRATIONS_011_to_017.sql](file:///d:/Proyectos%20IA/EL%20ESCUDO/supabase/migrations/ALL_MIGRATIONS_011_to_017.sql) | Duplica migraciones individuales. Peligroso. | **Eliminar** |
| [MIGRACIONES_014_to_017_SOLO_FALTANTES.sql](file:///d:/Proyectos%20IA/EL%20ESCUDO/supabase/migrations/MIGRACIONES_014_to_017_SOLO_FALTANTES.sql) | Duplica migraciones individuales. | **Eliminar** |
| `@react-native-voice/voice` en package.json | Duplicado con `expo-speech-recognition`. Mantener el de Expo. | **Desinstalar** |
| `react-native-wagmi-charts` | Overkill para gráficos simples. Pesado. | **Reemplazar** con SVG custom o `victory-native` |
| **Clanes + Challenges + Leaderboard** (temporalmente) | Features sociales complejas para una app personal. Agregan complejidad sin valor inmediato. | **Ocultar** de la UI pero mantener el código. Reactivar cuando haya base de usuarios. |
| **NutritionScreen** en su estado actual | 46KB sin persistencia = peso muerto. | **Eliminar o rehacer** con backend integration |

---

## F. Roadmap Propuesto

### Fase 1: 🔴 BLOQUEADORES (1-2 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 1.1 | **Revocar y regenerar TODAS las keys** (Supabase, JWT, Gemini) | P0 | Crítico | Alto si el repo fue público | Verificar `git log` para confirmar exposición | — |
| 1.2 | **Agregar `.env` a `.gitignore`** y limpiar historial | P0 | Crítico | Bajo | `git filter-branch` o BFG Repo-Cleaner | 1.1 |
| 1.3 | **Mover Supabase keys a variables de entorno** en frontend | P0 | Crítico | Bajo | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 1.1 |
| 1.4 | **Cambiar API URL default a producción** con detección de `__DEV__` | P0 | Crítico | Bajo | Solo 1 archivo: `config/api.ts` | — |
| 1.5 | **Fijar JWT a `algorithms=["HS256"]`** | P0 | Crítico | Bajo | 1 línea en `auth.py` | — |
| 1.6 | **Arreglar import faltante de `supabase`** en main.py | P0 | Crítico | Bajo | 1 línea | — |
| 1.7 | **Agregar AsyncStorage adapter a Supabase client** | P0 | Crítico | Bajo | 5 líneas en `supabase.ts` | — |

### Fase 2: ⚡ ESTABILIDAD (3-5 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 2.1 | **Pinear versiones en requirements.txt** | P1 | Alto | Bajo | `pip freeze > requirements.txt` | — |
| 2.2 | **Agregar paquetes faltantes** (supabase, PyJWT) | P1 | Alto | Bajo | | — |
| 2.3 | **Manejar error en `hydrateStore`** — mostrar toast, implementar retry | P1 | Alto | Medio | Agregar `ToastNotification` global | — |
| 2.4 | **Reemplazar `ScrollView` por `FlatList`** en OmniChat y Finances | P1 | Alto | Bajo | Mejora directa de rendimiento | — |
| 2.5 | **Agregar plugins faltantes a app.json** (expo-notifications, expo-speech-recognition) | P1 | Alto | Bajo | | — |
| 2.6 | **Eliminar migraciones duplicadas** | P1 | Medio | Bajo | Solo borrar 2 archivos | — |
| 2.7 | **Eliminar código muerto** (CommandCenter, agent_service, fitness mock, get_db) | P1 | Medio | Bajo | Limpieza | — |
| 2.8 | **Implementar toast/snackbar global** para errores de red | P1 | Alto | Medio | Componente nuevo + context provider | 2.3 |

### Fase 3: 🎨 UX/UI (3-4 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 3.1 | **Implementar drawer o tab "Más"** para pantallas ocultas | P1 | Alto | Medio | Reestructurar navegación | — |
| 3.2 | **Reemplazar text inputs por time/date pickers nativos** | P1 | Alto | Bajo | 4-5 pantallas afectadas | — |
| 3.3 | **Agregar empty states** con ilustraciones y CTAs | P2 | Medio | Bajo | 8-10 pantallas | — |
| 3.4 | **Agregar diálogos de confirmación** para acciones destructivas | P2 | Medio | Bajo | Alert.alert() o modal custom | — |
| 3.5 | **Agregar pull-to-refresh** a Finances, Health, Projects, Habits | P2 | Medio | Bajo | Wrap en ScrollView con RefreshControl | 2.3 |
| 3.6 | **Tour de onboarding post-registro** | P2 | Medio | Medio | 3-4 tooltips/modals | — |
| 3.7 | **Indicador offline** visible | P2 | Medio | Bajo | Usar `@react-native-community/netinfo` (ya instalado) | — |

### Fase 4: 🔒 SEGURIDAD (2-3 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 4.1 | **Hashear OTP en password_reset** o usar Supabase auth nativo | P1 | Alto | Bajo | Preferir Supabase auth | — |
| 4.2 | **Eliminar fallback de URL de Supabase** en database.py | P1 | Medio | Bajo | 1 línea: crash si falta env var | 1.1 |
| 4.3 | **Eliminar resolución fallback agresiva** en omni_handlers | P1 | Alto | Medio | Cambiar _resolve_*_reference para no fallback-to-first | — |
| 4.4 | **Agregar confirmación para acciones destructivas en OMNI** | P2 | Alto | Medio | Doble-paso para DELETE/COMPLETE intents | 4.3 |
| 4.5 | **Implementar biometric auth** para reingreso | P3 | Medio | Medio | expo-local-authentication | — |

### Fase 5: 🚀 RENDIMIENTO (2-3 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 5.1 | **Memoizar componentes pesados** con `React.memo` | P2 | Medio | Bajo | BioTimeline, GoalsWidget, RachaWidget | — |
| 5.2 | **Lazy load pantallas secundarias** con `React.lazy` | P2 | Medio | Bajo | Challenges, Clans, Leaderboard, Nutrition, Recipes | — |
| 5.3 | **Cambiar `detachInactiveScreens` a `true`** | P2 | Alto | Medio | Puede causar re-mounts; testar bien | — |
| 5.4 | **Reemplazar `react-native-wagmi-charts`** por SVG custom | P3 | Medio | Bajo | Reduce bundle size | — |
| 5.5 | **Eliminar `@react-native-voice/voice`** (duplicada) | P2 | Medio | Bajo | Mantener solo `expo-speech-recognition` | — |
| 5.6 | **Paginación en sync** — limitar a últimos 30 días de transacciones | P2 | Alto | Medio | Requiere cambio en backend sync endpoint | — |

### Fase 6: ✨ FUNCIONALIDADES NUEVAS (5-10 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 6.1 | **OMNI con historial conversacional** (últimos 5 msgs) | P1 | Muy alto | Medio | Enviar context a Gemini | — |
| 6.2 | **OMNI con capacidad de lectura** ("¿cuánto gasté?", "¿cuál es mi racha?") | P1 | Muy alto | Medio | Nuevos intents: QUERY_FINANCE, QUERY_HEALTH, etc. | — |
| 6.3 | **Cola de operaciones offline** | P1 | Alto | Alto | Patrón command queue + reconciliación | 2.3 |
| 6.4 | **Widget de Android** (racha + próximo turno) | P2 | Alto | Alto | Requiere custom native module o expo-widget | — |
| 6.5 | **Notificaciones configurables** por tipo | P2 | Medio | Bajo | Settings screen + backend flags | — |
| 6.6 | **NutritionScreen completa** con backend y persistencia | P3 | Medio | Alto | Requiere nuevo endpoint + tabla + UI rewrite | — |

### Fase 7: 📱 CIERRE PARA USO REAL EN ANDROID (2-3 días)

| # | Tarea | Prioridad | Impacto | Riesgo | Observaciones | Dependencia |
|---|-------|-----------|---------|--------|---------------|-------------|
| 7.1 | **Build EAS preview** y test en dispositivo real | P0 | Crítico | Medio | Validar todo lo anterior | 1.*, 2.* |
| 7.2 | **Configurar `eas.json` con variables de entorno** | P0 | Crítico | Bajo | Secrets en EAS dashboard | 1.1-1.3 |
| 7.3 | **Testar notificaciones push end-to-end** | P1 | Alto | Medio | Requiere Expo Push token real | 7.1 |
| 7.4 | **Testar reconocimiento de voz** en dispositivo | P1 | Alto | Medio | Puede requerir permisos adicionales | 7.1 |
| 7.5 | **Smoke test completo** en Android real: login → onboarding → chat → finanzas → salud → turnos → perfil | P0 | Crítico | Bajo | Manual, 30 min | 7.1 |
| 7.6 | **Generar APK firmado** para uso personal | P0 | Crítico | Bajo | `eas build --platform android --profile production` | 7.5 |

---

## G. Recomendación Final

### Veredicto: ⚠️ **CASI LISTA — pero con bloqueadores que impiden uso real hoy**

**Justificación técnica:**

1. **No se puede instalar en un Android real** sin cambiar la URL del backend (el default `localhost` no resuelve en un dispositivo físico).
2. **No se puede mantener la sesión** entre cierres de app (falta AsyncStorage adapter para Supabase auth).
3. **Las notificaciones push no funcionan** en un build de producción (falta plugin en app.json).
4. **Hay secretos comprometidos** que deben rotarse antes de cualquier uso real.

Si se resuelven los 7 items de **Fase 1** (estimación: 1-2 días de trabajo), la app queda **funcional para uso personal en Android**. Las fases 2-4 la hacen **estable y segura**. Las fases 5-6 la hacen **excelente**.

**El proyecto tiene una base sólida**. La arquitectura es coherente, el sistema OMNI es impresionante para una app personal, y el scope de funcionalidades es ambicioso pero alcanzable. El principal riesgo no es la calidad del código sino la **deuda técnica acumulada en archivos monolíticos** y la **falta de robustez para uso offline/móvil real**.

---

## H. Bonus Obligatorio

### H1. Mejoras para el módulo de Gimnasio / Entrenamiento

El módulo actual ([HealthScreen.tsx](file:///d:/Proyectos%20IA/EL%20ESCUDO/el-escudo/src/screens/HealthScreen.tsx) + [routines router](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/routers/routines.py)) es funcional pero básico. Para hacerlo **muy bueno, útil y bonito**:

#### Datos y lógica
1. **Librería de ejercicios predefinida**: Base de datos local de 100+ ejercicios con grupo muscular, descripción, y demo GIF/foto. Permite autocompletado al registrar y evita errores de nombre.
2. **Progresión de peso inteligente**: Algoritmo que sugiere el peso de la próxima sesión basado en el historial (RPE + peso anterior + principio de sobrecarga progresiva). Ej: "La vez pasada hiciste 60kg x 8 reps con RPE 7. Sugerencia: 62.5kg x 8."
3. **Volume tracking**: Calcular y graficar el volumen semanal por grupo muscular (sets × reps × peso). Métrica estándar en entrenamiento de fuerza.
4. **Rest timer**: Temporizador de descanso entre series con vibración/notificación. Configurable por ejercicio (fuerza: 3min, hipertrofia: 90seg).
5. **1RM estimado**: Calcular el 1 Rep Max estimado usando la fórmula de Epley: `peso × (1 + reps/30)`.
6. **Registro rápido vía OMNI**: "Hice 3 series de press banca con 80kg, 6 reps" → registra las 3 series, actualiza PR si aplica, calcula volumen.

#### UI/UX
7. **Pantalla de entrenamiento activo** separada: Cuando el usuario inicia una rutina, mostrar una pantalla enfocada con:
   - Ejercicio actual con foto
   - Último registro para ese ejercicio
   - Inputs de peso/reps/RPE
   - Rest timer al completar serie
   - Progreso de la rutina (3/8 ejercicios)
   - Swipe para ir al siguiente ejercicio
8. **Gráfico de PRs**: Timeline de Personal Records con cada hito marcado.
9. **Calendario de entrenamiento**: Vista mensual con días entrenados marcados (similar a GitHub contributions).
10. **Badge de streak de gym**: Similar al badge de racha de enfoque pero para consistencia de entrenamiento.

#### Integración con OMNI
11. Que OMNI pueda generar rutinas completas: "Hazme una rutina push-pull-legs de 4 días" → Crea las 4 rutinas con ejercicios, series y reps sugeridas.
12. Que OMNI reporte progreso: "¿Cómo va mi press banca?" → "Tu press banca subió de 60kg a 72.5kg en 8 semanas. Tu PR actual es 80kg x 3 (1RM estimado: 85kg)."

---

### H2. Integración del Chat Asistente para CRUD Universal

#### Arquitectura propuesta

```
┌──────────────────────────────────────────────────┐
│                    FRONTEND                       │
│                                                   │
│  User: "Registra que gasté 50k en mercado"       │
│                    │                              │
│                    ▼                              │
│  ┌─────────────────────────────────────────────┐ │
│  │   OMNI Chat → POST /api/v1/omni            │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│                   BACKEND                         │
│                                                   │
│  1. Rate limit check                              │
│  2. Daily cost check                              │
│  3. Build context (user profile, recent data)     │
│  4. Send to Gemini with function declarations     │
│  5. Parse response: intent + extracted_data       │
│  6. Route to handler (create/read/update/delete)  │
│  7. Execute DB operation                          │
│  8. Return resultado + respuesta conversacional   │
└──────────────────────────────────────────────────┘
```

#### Cambios concretos para CRUD universal

1. **Agregar intents de LECTURA**: El archivo [omni_service.py](file:///d:/Proyectos%20IA/EL%20ESCUDO/backend/services/omni_service.py) necesita nuevos intents:
   - `QUERY_BALANCE` → "¿Cuánto tengo?"
   - `QUERY_EXPENSES` → "¿Cuánto gasté este mes?"
   - `QUERY_WEIGHT_PROGRESS` → "¿Cuánto peso bajé?"
   - `QUERY_STREAK` → "¿Cuántos días llevo?"
   - `QUERY_SCHEDULE` → "¿Qué turno tengo mañana?"
   - `QUERY_TASKS` → "¿Qué tareas tengo pendientes?"
   - `QUERY_GOALS` → "¿Cómo van mis metas?"
   - `QUERY_PR` → "¿Cuál es mi PR de press banca?"

2. **Agregar historial conversacional**: En la system instruction, enviar los últimos 5 mensajes del `session_id` actual:
   ```python
   recent = supabase.table("omni_messages")
     .select("role, content")
     .eq("session_id", session_id)
     .order("created_at", desc=True)
     .limit(5)
     .execute()
   ```

3. **Agregar confirmación para acciones destructivas**: Antes de ejecutar DELETE, pedir confirmación:
   ```json
   {
     "intent": "DELETE_TASK",
     "requires_confirmation": true,
     "confirmation_message": "¿Estás seguro de que quieres eliminar 'Estudiar React'?",
     "pending_action_id": "uuid-temp"
   }
   ```

4. **Agregar intents de HÁBITOS**:
   - `COMPLETE_HABIT` → "Marqué como hecho mi hábito de meditar"
   - `CREATE_HABIT` → "Agrega un hábito de leer 30 minutos al día"

5. **Agregar intents de NUTRICIÓN** (si se implementa el backend):
   - `LOG_MEAL` → "Almorcé pollo con arroz, unas 500 calorías"
   - `QUERY_CALORIES` → "¿Cuántas calorías llevo hoy?"

---

### H3. Plan para Reducir Fricción en Android Real

#### Instalación (Día 1)
1. **Generar APK de prueba**: `eas build --platform android --profile preview`
2. **Compartir via link directo**: EAS genera un link descargable. Sin necesidad de Play Store.
3. **Para distribución personal permanente**: `eas build --platform android --profile production` → APK que se instala desde el archivo.
4. **Actualización OTA**: Configurar `expo-updates` para que las actualizaciones de JS se descarguen automáticamente sin reinstalar.

#### Permisos (Día 1)
1. **Pedir permisos gradualmente**: No pedir micrófono + notificaciones + cámara en el primer uso. Pedir cada uno cuando el usuario interactúe con la feature que lo necesita.
2. **Explicar antes de pedir**: Mostrar un modal con "OMNI necesita el micrófono para comandos de voz" ANTES del prompt del sistema.

#### Backend (Día 1-2)
1. **Deploy en Render/Railway con free tier**: Configurar el backend con la URL de producción.
2. **Configurar FRONTEND_URL en el backend** para CORS.
3. **Configurar variables de entorno** en el dashboard de Render/Railway.
4. **Health check**: Asegurar que el endpoint `/health` responda para el uptime monitor de Render.
5. **Supabase**: Ya está en producción. Solo asegurar que las migraciones estén aplicadas.

#### Sincronización (Continuo)
1. **Auto-detect network state**: Usar `@react-native-community/netinfo` (ya instalado) para mostrar banner offline.
2. **Queue mutations**: Cuando no hay red, almacenar operaciones en AsyncStorage y enviarlas cuando regrese la conexión.
3. **Sync en background**: Configurar `expo-background-fetch` (ya instalado) para sync periódico incluso con la app cerrada.
4. **Reducir payload de sync**: Enviar solo datos modificados desde `_lastSyncTime` (agregar columna `updated_at` como filtro en el query).

#### Uso diario (Continuo)
1. **Shortcut de Android**: Crear un shortcut a OMNI chat desde la home screen (deep link).
2. **Notificación persistente**: Opcionalmente, mostrar una notificación fija con acceso rápido a OMNI.
3. **OMNI como punto de entrada principal**: Asegurar que el usuario pueda hacer TODO desde el chat sin navegar. Si el 80% de las acciones se pueden hacer por voz/texto, la app se vuelve mucho más natural de usar en el día a día.

---

> **Nota del auditor**: Esta auditoría se realizó basándose en el código fuente disponible. No se ejecutó la app ni se probó en un dispositivo físico. Algunos hallazgos se basan en análisis estático del código y podrían tener atenuantes en runtime. Los secretos detectados en `.env` son reales y deben ser tratados como comprometidos inmediatamente.
