from supabase import create_client, Client
import os
import asyncio
import logging
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_KEY en el entorno del backend.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

logger = logging.getLogger("escudo")

def init_db():
    try:
        supabase.from_("profiles").select("*").limit(1).execute()
        print("✅ Conexion con Supabase establecida.")
    except Exception as e:
        print(f"⚠️ Aviso: No se pudo validar la tabla 'profiles'. Error: {e}")


async def award_xp(user_id: str, xp: int) -> dict:
    """Awards XP to user with scaling level-up formula: level * 1000 XP per level.
    Returns dict with xp, level, xp_to_next_level, xp_gained, leveled_up."""
    try:
        prof = await asyncio.to_thread(
            lambda: supabase.table("profiles")
            .select("xp, level")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        current_xp = (prof.data or {}).get("xp", 0) or 0
        current_level = (prof.data or {}).get("level", 1) or 1

        new_xp = current_xp + xp
        new_level = current_level

        while new_xp >= new_level * 1000:
            new_xp -= new_level * 1000
            new_level += 1

        xp_to_next = new_level * 1000

        await asyncio.to_thread(
            lambda: supabase.table("profiles")
            .update({"xp": new_xp, "level": new_level, "xp_to_next_level": xp_to_next})
            .eq("user_id", user_id)
            .execute()
        )

        return {
            "xp": new_xp,
            "level": new_level,
            "xp_to_next_level": xp_to_next,
            "xp_gained": xp,
            "leveled_up": new_level > current_level,
        }
    except Exception as e:
        logger.warning(f"Error awarding XP to user {user_id}: {e}")
        return {"xp": 0, "level": 1, "xp_to_next_level": 100, "xp_gained": 0, "leveled_up": False}
