from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_KEY en el entorno del backend.")

# Cliente global
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def init_db():
    """
    Inicialización de tablas en Supabase.
    """
    try:
        # Intento de lectura para validar la KEY y la URL
        supabase.from_("profiles").select("*").limit(1).execute()
        print("✅ Conexión con Supabase establecida.")
    except Exception as e:
        print(f"⚠️ Aviso: No se pudo validar la tabla 'profiles'. Error: {e}")
