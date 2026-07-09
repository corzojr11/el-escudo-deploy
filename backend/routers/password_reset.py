"""Password reset endpoints.

Flujo:
1. POST /forgot-password → genera código 6 dígitos, lo guarda en DB (15 min TTL).
   En desarrollo retorna el código en la respuesta para facilitar pruebas.
2. POST /reset-password → recibe email + code + new_password.
   Verifica código, llama a Supabase Auth Admin API para cambiar password,
   marca código como usado.
"""

import os
import random
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from database import supabase

logger = logging.getLogger("escudo")
router = APIRouter(tags=["auth"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # En desarrollo incluimos el código para facilitar testing
    dev_code: str | None = None


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)


class ResetPasswordResponse(BaseModel):
    message: str


def _generate_code() -> str:
    return str(random.randint(100000, 999999))


def _get_user_id_by_email(email: str) -> str | None:
    """Busca user_id en la tabla profiles por email."""
    try:
        res = supabase.table("profiles").select("user_id").eq("email", email).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]["user_id"]
    except Exception as e:
        logger.warning(f"Error buscando user_id por email: {e}")
    return None


def _update_password_via_admin(user_id: str, new_password: str) -> bool:
    """Usa la API Admin de Supabase para cambiar la contraseña sin sesión activa."""
    try:
        url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }
        payload = {"password": new_password}
        r = httpx.put(url, headers=headers, json=payload, timeout=15)
        if r.status_code in (200, 204):
            logger.info(f"Password actualizada para user {user_id}")
            return True
        else:
            logger.warning(f"Supabase admin update user falló: {r.status_code} {r.text}")
    except Exception as e:
        logger.error(f"Error actualizando password: {e}")
    return False


@router.post("/api/v1/auth/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.lower().strip()

    # Verificar que el email existe en profiles
    user_id = _get_user_id_by_email(email)
    if not user_id:
        # No revelar si el email existe o no (seguridad)
        return ForgotPasswordResponse(
            message="Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.",
            dev_code=None,
        )

    # Invalidar códigos anteriores del mismo email
    try:
        supabase.table("password_reset_codes").update({"used": True}).eq("email", email).execute()
    except Exception as e:
        logger.warning(f"Error invalidando códigos previos: {e}")

    code = _generate_code()
    expires_at = datetime.now(timezone.utc).replace(microsecond=0)

    try:
        supabase.table("password_reset_codes").insert({
            "email": email,
            "code": code,
            "expires_at": expires_at.isoformat(),
            "used": False,
        }).execute()
    except Exception as e:
        logger.error(f"Error guardando código de reset: {e}")
        raise HTTPException(status_code=500, detail="Error generando código de recuperación")

    # TODO: En producción, enviar email real aquí (SendGrid, AWS SES, etc.)
    logger.info(f"[DEV] Código de recuperación para {email}: {code}")

    return ForgotPasswordResponse(
        message="Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.",
        dev_code=code,  # Solo en desarrollo; en producción omitir o enviar por email
    )


@router.post("/api/v1/auth/reset-password", response_model=ResetPasswordResponse)
async def reset_password(req: ResetPasswordRequest):
    email = req.email.lower().strip()

    # Buscar código válido
    try:
        res = (
            supabase.table("password_reset_codes")
            .select("*")
            .eq("email", email)
            .eq("code", req.code)
            .eq("used", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error(f"Error consultando código: {e}")
        raise HTTPException(status_code=500, detail="Error interno")

    if not res.data or len(res.data) == 0:
        raise HTTPException(status_code=400, detail="Código inválido o expirado")

    row = res.data[0]
    expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)

    if now > expires_at:
        raise HTTPException(status_code=400, detail="Código expirado. Solicita uno nuevo.")

    # Obtener user_id
    user_id = _get_user_id_by_email(email)
    if not user_id:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")

    # Actualizar contraseña
    if not _update_password_via_admin(user_id, req.new_password):
        raise HTTPException(status_code=500, detail="Error actualizando contraseña")

    # Marcar código como usado
    try:
        supabase.table("password_reset_codes").update({"used": True}).eq("id", row["id"]).execute()
    except Exception as e:
        logger.warning(f"Error marcando código como usado: {e}")

    return ResetPasswordResponse(message="Contraseña actualizada correctamente. Ahora puedes iniciar sesión.")
