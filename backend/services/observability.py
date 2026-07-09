import asyncio
import logging
from typing import Optional, Dict, Any

from database import supabase

logger = logging.getLogger("escudo")


async def track_event(
    module: str,
    event: str,
    status: str = "ok",
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Registra eventos operativos para observabilidad minima.

    Nunca rompe el flujo principal si falla la escritura.
    """
    payload = {
        "module": module,
        "event": event,
        "status": status,
        "user_id": user_id,
        "metadata": metadata or {},
    }
    try:
        await asyncio.to_thread(lambda: supabase.table("observability_events").insert(payload).execute())
    except Exception as e:
        logger.debug(f"observability track_event failed: {e}")
