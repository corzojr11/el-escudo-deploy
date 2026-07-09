import logging
import os

import jwt as pyjwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import supabase

logger = logging.getLogger("escudo")

security = HTTPBearer(auto_error=False)
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"


async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    token = credentials.credentials if credentials else None
    uid = None

    if token:
        if DEV_MODE:
            logger.debug("DEV_MODE activo: validación estricta por token.")
        try:
            user_res = supabase.auth.get_user(token)
            if user_res and user_res.user:
                uid = user_res.user.id
                logger.info(f"Acceso concedido (Supabase): {uid[:8]}...")
        except Exception as e:
            logger.warning(f"Supabase auth falló: {e}")

        if not uid and SUPABASE_JWT_SECRET:
            try:
                payload = pyjwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"verify_signature": True},
                )
                uid = payload.get("sub")
                if uid:
                    logger.info(f"Acceso concedido (JWT local): {uid[:8]}...")
            except Exception as jwt_err:
                logger.warning(f"JWT local falló: {jwt_err}")
        elif not uid:
            logger.warning("SUPABASE_JWT_SECRET no está configurado; se omite validación JWT local.")

        if uid:
            return type("User", (), {"id": uid, "aud": "authenticated"})()

    raise HTTPException(status_code=401, detail="No autorizado.")
