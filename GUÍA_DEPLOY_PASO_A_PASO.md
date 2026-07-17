# 🚀 GUÍA DE DEPLOY PASO A PASO — EL ESCUDO

**Para:** Personas sin experiencia técnica profunda  
**Tiempo estimado:** 45-60 minutos  
**Fecha:** 2026-05-27

---

## 📋 ANTES DE EMPEZAR — ¿Qué necesitas tener?

1. **Tu proyecto en Supabase** (ya deberías tenerlo, es donde se guardan los datos)
2. **Tu backend corriendo** (la carpeta `backend/` de tu computadora)
3. **La app en tu celular** (con Expo Go instalado) — o el **frontend web** en `escudo-web-v2/` (con `npm run dev`)
4. **Un navegador web** (Chrome, Safari, etc.)

---

## ✅ PASO 1: Ejecutar Migraciones en Supabase (15 min)

### ¿Qué es esto?
Las migraciones son "instrucciones" que le dicen a la base de datos (Supabase) qué tablas nuevas necesita crear para que la app funcione. Es como construir nuevas habitaciones en una casa.

### Instrucciones:

**1.1** Abre tu navegador y ve a [https://supabase.com](https://supabase.com)

**1.2** Inicia sesión con tu cuenta y entra a tu proyecto.

**1.3** En el menú lateral izquierdo, busca y haz clic en **"SQL Editor"**.

**1.4** Haz clic en el botón **"New query"** (o "Nueva consulta").

**1.5** Ve a la carpeta `supabase/migrations/` de tu proyecto en tu computadora. Ahí hay archivos numerados del `001` al `032`. Cada archivo contiene las instrucciones SQL para una parte de la base de datos. Se ejecutan en orden, de `001` a `032`.

**1.6** Abre cada archivo en orden (empezando por `001_core_schema.sql`):
- Selecciona TODO el contenido (Ctrl+A, luego Ctrl+C)
- Pégalo en el SQL Editor de Supabase (Ctrl+V)
- Haz clic en el botón verde **"Run"** (o "Ejecutar")
- Si ves un mensaje verde tipo **"Success"**, continúa con el siguiente archivo

**1.7** **IMPORTANTE — Si ves un error rojo:**

Detente y revisa el mensaje antes de continuar. No todos los errores son inofensivos:

- **`relation already exists`**: La tabla ya existe. Puedes continuar si el resto del archivo se ejecutó bien.
- **`relation "xxx" does not exist`**: Falta una migración anterior. Vuelve atrás y ejecuta las que faltan en orden.
- **`permission denied`**: Tu usuario de Supabase no tiene permisos. Usa una cuenta con rol de administrador.
- **Cualquier otro error**: No sigas. Copia el mensaje exacto y revísalo antes de continuar.

**1.8** Verificación rápida (opcional pero recomendada):

Copia y pega esto en una NUEVA query del SQL Editor y ejecútalo:

```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('habits','moods','challenge_templates','challenges','clans','clan_members','user_activity_patterns');
```

Debe aparecerte una lista con **7 tablas**. Si ves 7 filas, ¡todo está perfecto! 🎉

---

## ✅ PASO 2: Configurar Variables de Entorno (.env) (20 min)

### ¿Qué es esto?
El archivo `.env` es como una "tarjeta de identificación" que le dice a tu backend dónde está la base de datos, qué claves usar, y a qué frontend debe permitir acceso. Es información secreta que NUNCA debes compartir.

### Instrucciones:

**2.1** Ve a la carpeta `backend/` de tu proyecto en tu computadora.

**2.2** Busca el archivo llamado `.env.example`. Haz una copia de ese archivo en la MISMA carpeta y renómbralo a `.env` (sin la palabra "example").

> 💡 **En Windows:** Click derecho → Copiar → Click derecho → Pegar → Renombrar a `.env`

**2.3** Abre el archivo `.env` con el Bloc de notas (Notepad).

**2.4** Rellena cada valor siguiendo esta guía:

---

### 🔑 `SUPABASE_URL`

**¿Dónde conseguirlo?**
1. Ve a tu proyecto en Supabase
2. En el menú lateral, haz clic en **"Project Settings"** (icono de engranaje ⚙️)
3. Ve a la pestaña **"API"**
4. Copia la URL que dice **"Project URL"** (se ve algo como `https://abcdefgh12345678.supabase.co`)
5. Pégala en el archivo `.env`

**Ejemplo:**
```
SUPABASE_URL=https://tu-proyecto.supabase.co
```

---

### 🔑 `SUPABASE_KEY`

**¿Dónde conseguirlo?**
1. En la MISMA página de **"Project Settings" → "API"**
2. Busca la sección que dice **"service_role secret"**
3. Haz clic en **"Reveal"** (mostrar)
4. Copia esa clave larga (empieza con `eyJ...`)
5. Pégala en el archivo `.env`

> ⚠️ **MUY IMPORTANTE:** Esta es la `service_role key`, NO la `anon key`. La service_role key es secreta y permite que el backend haga todo. Nunca la compartas.

**Ejemplo:**
```
SUPABASE_KEY=pega_tu_service_role_key_aqui
```

---

### 🔑 `SUPABASE_JWT_SECRET`

**¿Dónde conseguirlo?**
1. En la MISMA página de **"Project Settings" → "API"**
2. Baja un poco hasta **"JWT Settings"**
3. Copia el valor de **"JWT Secret"**
4. Pégalo en el archivo `.env`

**Ejemplo:**
```
SUPABASE_JWT_SECRET=pega_tu_jwt_secret_aqui
```

---

### 🔑 `GEMINI_API_KEY`

**¿Dónde conseguirlo?**
1. Ve a [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Create API Key"**
4. Selecciona un proyecto (o crea uno nuevo)
5. Copia la clave que te dan (empieza con `AIza...`)
6. Pégala en el archivo `.env`

**Ejemplo:**
```
GEMINI_API_KEY=pega_tu_gemini_api_key_aqui
```

---

### 🔑 `FRONTEND_URL` (OBLIGATORIA en producción)

**¿Qué es?** Es la dirección web donde estará tu app. El backend la usa para permitir que el frontend web haga peticiones (CORS). Si no está definida, el frontend web recibirá errores de conexión.

**¿Dónde conseguirla?** Es la URL que te da Vercel cuando despliegas el frontend (algo como `https://el-escudo.vercel.app`). Si también tienes un dominio propio, usa ese.

**Ejemplo:**
```
FRONTEND_URL=https://el-escudo.vercel.app
```

> ⚠️ **OBLIGATORIA para el frontend web.** Sin este valor, el backend bloqueará las peticiones del frontend web por seguridad. No la dejes comentada.

---

### 🔑 `SENTRY_DSN` (Opcional pero recomendado)

**¿Qué es?** Sentry es como un "doctor" para tu app. Si algo se rompe, te avisa por email.

**¿Dónde conseguirlo?**
1. Ve a [https://sentry.io](https://sentry.io) y crea una cuenta gratuita
2. Crea un nuevo proyecto (elige "Python" o "FastAPI" para el backend)
3. Te darán un DSN que se ve así: `https://12345@sentry.io/67890`
4. Pégalo en el archivo `.env`

**Si no quieres usarlo aún:**
```
# SENTRY_DSN=
```

---

### 🔑 `DEV_MODE`

**Esto DEBE estar así para producción:**
```
DEV_MODE=false
```

> ⚠️ Nunca pongas `true` en producción, porque desactiva la seguridad.

---

### 🔑 `OMNI_DAILY_COST_LIMIT_COP`

Esto limita cuánto dinero (en pesos colombianos) puede gastar OMNI en Gemini por día por usuario. Lo puedes dejar así:
```
OMNI_DAILY_COST_LIMIT_COP=5000
```

---

**2.5** Guarda el archivo `.env` (Ctrl+S) y ciérralo.

> ✅ **Tu archivo .env debería verse más o menos así:**
> ```
> DEV_MODE=false
> SUPABASE_URL=https://tu-proyecto.supabase.co
> SUPABASE_KEY=eyJ...
> SUPABASE_JWT_SECRET=tu-secreto...
> GEMINI_API_KEY=AIzaSyC...
> FRONTEND_URL=https://tu-app.vercel.app
> # SENTRY_DSN=
> OMNI_DAILY_COST_LIMIT_COP=5000
> ```

---

## ✅ PASO 3: Probar la App en tu Celular (10 min)

### ¿Qué probar?
Queremos asegurarnos de que TODO lo nuevo funciona correctamente.

### Instrucciones:

**3.1** Asegúrate de que tu backend esté corriendo:
- Abre la terminal (símbolo del sistema / PowerShell)
- Navega a la carpeta `backend/`
- Ejecuta: `python main.py` o `uvicorn main:app --reload`
- Debería decir algo como `Uvicorn running on http://0.0.0.0:8000`

**3.2** Abre la app en tu celular con **Expo Go**.

**3.3** Prueba este flujo completo:

| # | Qué probar | Cómo | ¿Qué debería pasar? |
|---|-----------|------|---------------------|
| 1 | **Login** | Entra con tu usuario | Debes entrar sin errores |
| 2 | **Registrar peso** | Ve a "Salud" → añade tu peso | Se guarda y aparece en el gráfico |
| 3 | **Usar OMNI** | Ve a "Inicio" → escribe "hola" | OMNI responde con contexto personalizado |
| 4 | **Ver Leaderboard** | Perfil → "Ver Ranking Global" | Ves una lista de jugadores |
| 5 | **Crear un reto** | Leaderboard → "RETOS" → Explorar → elige uno → crea reto | Se crea sin error |
| 6 | **Ver Clanes** | Leaderboard → "CLANES" → Explorar | Ves lista de clanes o puedes crear uno |
| 7 | **Check de hábitos** | Tab "Hábitos" → marca uno | Se guarda la racha |

**3.4** Si algo falla:
- Anota en qué paso falló
- Anota el mensaje de error exacto
- Avísame y lo arreglamos juntos

---

## ✅ PASO 4: Decidir sobre Google Fit / Apple HealthKit (5 min)

### ¿Qué es?
Es la conexión automática con la app de Salud de tu celular (Google Fit en Android, Health en iPhone). Permitiría que EL ESCUDO leyera tus pasos, peso y ejercicio automáticamente sin que tú lo escribas.

### ¿Por qué está pendiente?
Porque es **MUY complejo** de implementar. Requiere:
- Módulos nativos (código específico de Android/iPhone)
- Permisos especiales de salud
- Probablemente dejar de usar Expo Go y usar un "build personalizado"
- Muchas horas de desarrollo

### Mi recomendación:

> 🟡 **DÉJALO PARA DESPUÉS (post-launch).**
>
> La app funciona perfectamente registrando datos manualmente o con OMNI por voz. La integración con salud nativa es un "lujo", no una necesidad.
>
> **Cuándo hacerlo:** Cuando ya tengas usuarios reales usando la app y quieras darles una experiencia premium.

### Si decides NO hacerlo ahora (recomendado):

Dime: *"Déjalo para después"* y yo marco ese ítem como "post-launch" en el roadmap. No pasa nada. ✅

---

## 📦 CHECKLIST FINAL

Antes de considerar que todo está listo, revisa:

- [ ] Migraciones 001 a 032 ejecutadas en orden en Supabase (PASO 1)
- [ ] Archivo `.env` creado en `backend/` con valores reales (PASO 2)
- [ ] `DEV_MODE=false` en `.env`
- [ ] `FRONTEND_URL` configurada con la URL del frontend web
- [ ] Frontend web (`escudo-web-v2/`) funciona en http://localhost:3000
- [ ] Backend corre sin errores
- [ ] App en celular: login funciona
- [ ] App en celular: registrar peso funciona
- [ ] App en celular: OMNI responde
- [ ] App en celular: Leaderboard carga
- [ ] App en celular: Retos y Clanes se ven
- [ ] Decisión tomada sobre Google Fit/HealthKit (PASO 4)

---

## 🆘 ¿Y SI ALGO SALE MAL?

No te preocupes. Avísame exactamente:
1. **En qué paso te quedaste**
2. **Qué mensaje de error ves** (copia y pega el texto)
3. **Qué intentaste hacer**

Con esa información puedo guiarte a solucionarlo paso a paso.

---

## 🎉 ¿QUÉ SIGUE DESPUÉS?

Una vez que completes estos 4 pasos, tu app estará 100% funcional para usarla tú mismo y con amigos. Los siguientes pasos serían "de lujo":

1. **Publicar en Play Store / App Store** (necesita cuenta de desarrollador, $25 Google / $100 Apple)
2. **Conectar dominio propio** (ej: `www.elescuto.app`)
3. **Google Fit / Apple Health** (como decidiste en el Paso 4)
4. **Widgets en la pantalla de inicio**

Pero todo eso es para el futuro. Por ahora, ¡con completar estos 4 pasos es suficiente! 🚀
