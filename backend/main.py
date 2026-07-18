"""API REST de EL ESCUDO — Cloud OS personal.

Punto de entrada del backend. Expone endpoints para sincronización,
gestión de finanzas, peso, sueño, objetivos, turnos laborales,
notificaciones, integraciones externas y el asistente OMNI (Gemini).

Incluye un planificador (APScheduler) que ejecuta tareas periódicas
como el envío de notificaciones contextuales.
"""

import os
import asyncio
import socket
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from pydantic import BaseModel
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from auth import get_current_user
from database import supabase
from exceptions import ApiException
from services.observability import track_event

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S'
)
logger = logging.getLogger("escudo")

_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )
    logger.info("Sentry inicializado correctamente.")

from notifier import send_contextual_notifications
from services.reminders import analyze_user_patterns, schedule_reminders, send_due_reminders
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("VERCEL"):
        # Vercel functions are short-lived; scheduled jobs belong in a worker/cron service.
        yield
        return

    scheduler.add_job(send_contextual_notifications, "interval", minutes=5)
    scheduler.add_job(analyze_user_patterns, "cron", hour=3, minute=0)
    scheduler.add_job(schedule_reminders, "cron", hour=6, minute=0)
    scheduler.add_job(send_due_reminders, "interval", minutes=5)
    try:
        lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        lock_socket.bind(('127.0.0.1', 12345))
        scheduler.start()
        logger.info("Scheduler iniciado con éxito en el worker principal (puerto lock 12345 adquirido).")
    except OSError:
        logger.info("El scheduler ya está corriendo en otro worker (puerto lock 12345 ocupado). Evitando ejecución duplicada.")
    yield
    try:
        scheduler.shutdown()
        logger.info("Scheduler detenido.")
    except Exception:
        pass


limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(title="El Escudo API - Cloud OS", version="0.2.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_frontend_url = os.getenv("FRONTEND_URL")
_frontend_urls = os.getenv("FRONTEND_URLS")
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:8083",
    "http://localhost:19006",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:19006",
    "http://127.0.0.1:5173",
]
if _frontend_url:
    _cors_origins.append(_frontend_url)
if _frontend_urls:
    for origin in _frontend_urls.split(","):
        origin = origin.strip()
        if origin and origin not in _cors_origins:
            _cors_origins.append(origin)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inyecta cabeceras de seguridad HTTP estándar OWASP en todas las respuestas.

    Añade: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
    Referrer-Policy y Permissions-Policy para protección contra clickjacking,
    MIME-sniffing y XSS.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


# Orden de middlewares: SecurityHeaders (externo) → CORS (interno)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import habits, finances, schedule, goals, health, omni, missions, moods, leaderboard, challenges, clans, reminders, password_reset, bio as bio_router, observability, sync as sync_router, routines, profile, wellness, personal
app.include_router(habits.router)
app.include_router(finances.router)
app.include_router(schedule.router)
app.include_router(goals.router)
app.include_router(health.router)
app.include_router(omni.router)
app.include_router(missions.router)
app.include_router(routines.router)
app.include_router(moods.router)
app.include_router(leaderboard.router)
app.include_router(challenges.router)
app.include_router(clans.router)
app.include_router(reminders.router)
app.include_router(password_reset.router)
app.include_router(bio_router.router)
app.include_router(observability.router)
app.include_router(sync_router.router)
app.include_router(profile.router)
app.include_router(wellness.router)
app.include_router(personal.router)


@app.exception_handler(ApiException)
async def api_exception_handler(request: Request, exc: ApiException):
    """Captura excepciones ApiException y las serializa como JSON.

    Args:
        request: Request HTTP que causó la excepción.
        exc: Instancia de ApiException con status_code y detail.
    """
    await track_event(
        module="api",
        event="handled_exception",
        status="error",
        user_id=None,
        metadata={"path": request.url.path, "status_code": exc.status_code, "detail": str(exc.detail)[:120]},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Captura cualquier excepción no manejada y retorna 500 genérico.

    Args:
        request: Request HTTP que causó la excepción.
        exc: Excepción no capturada.
    """
    await track_event(
        module="api",
        event="unhandled_exception",
        status="critical",
        user_id=None,
        metadata={"path": request.url.path, "error": str(exc)[:120]},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor."},
    )

@limiter.exempt
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.now(timezone.utc).isoformat()}

class PushTokenPayload(BaseModel):
    token: str

@app.post("/api/v1/push-tokens")
async def register_push_token(payload: PushTokenPayload, user = Depends(get_current_user)):
    """Registra o actualiza un token de Expo Push para el usuario.

    Usa upsert con conflicto en 'token' para evitar duplicados.
    """
    try:
        await asyncio.to_thread(lambda: supabase.table("push_tokens").upsert(
            {"token": payload.token, "user_id": user.id},
            on_conflict="token"
        ).execute())
        return {"detail": "Token registrado exitosamente"}
    except Exception as exc:
        logger.exception("No se pudo registrar el push token")
        return JSONResponse(
            status_code=500,
            content={"detail": "No se pudo registrar el push token.", "error": str(exc)[:160]},
        )
