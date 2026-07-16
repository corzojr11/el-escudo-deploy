"""Password reset router — deprecated.

El flujo de recuperación de contraseña ahora pasa exclusivamente por Supabase Auth:
- Next.js: forgot-password → Supabase envía email mágico → auth/callback → reset-password.
- Expo: supabase.auth.resetPasswordForEmail(email, { redirectTo: ... }).

Este módulo solo expone un endpoint informativo que responde 410 Gone
para cualquier cliente legacy que intente usar el antiguo flujo inseguro.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

logger = logging.getLogger("escudo")
router = APIRouter(tags=["auth"])


class _LegacyPasswordResetRequest(BaseModel):
    email: EmailStr


class _LegacyPasswordResetResponse(BaseModel):
    message: str
    migration: str


@router.post(
    "/api/v1/auth/forgot-password",
    response_model=_LegacyPasswordResetResponse,
    status_code=410,
)
async def forgot_password(_: _LegacyPasswordResetRequest):
    logger.warning("Intento de uso de /forgot-password legacy")
    raise HTTPException(
        status_code=410,
        detail="El flujo de recuperación inseguro fue desactivado. Usa Supabase Auth.",
    )


@router.post(
    "/api/v1/auth/reset-password",
    response_model=_LegacyPasswordResetResponse,
    status_code=410,
)
async def reset_password(_: _LegacyPasswordResetRequest):
    logger.warning("Intento de uso de /reset-password legacy")
    raise HTTPException(
        status_code=410,
        detail="El flujo de recuperación inseguro fue desactivado. Usa Supabase Auth.",
    )
