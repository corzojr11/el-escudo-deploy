import os
import logging
from google import genai

logger = logging.getLogger("escudo")

_api_key = os.getenv("GEMINI_API_KEY")
if not _api_key:
    logger.warning("GEMINI_API_KEY no está configurada en las variables de entorno.")
    ai_client = None
else:
    try:
        ai_client = genai.Client(api_key=_api_key)
        logger.info("Cliente de Gemini (google-genai) inicializado correctamente.")
    except Exception as e:
        logger.error(f"Error al inicializar el cliente de Gemini: {e}")
        ai_client = None

def get_gemini_client():
    return ai_client
