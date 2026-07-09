"""Integración con APIs externas de fitness (Google Fit, Health Connect, etc.).

Provee la lógica de validación e inserción de datos de actividad física
provenientes de fuentes externas.
"""

from datetime import datetime
from database import supabase


FITNESS_FIELDS = {"steps", "calories_burned", "distance_km", "active_minutes"}


def sync_fitness_data(user_id: str, data: dict) -> dict:
    """Valida e inserta un registro de actividad física en fitness_logs.

    Args:
        user_id: UUID del usuario al que pertenecen los datos.
        data: Diccionario con al menos un campo de actividad ('steps',
            'calories_burned', 'distance_km', 'active_minutes') y
            opcionalmente 'date' (YYYY-MM-DD) y 'source'.

    Returns:
        dict: El registro insertado en fitness_logs.

    Raises:
        ValueError: Si no hay campos de actividad válidos.
    """
    provided = FITNESS_FIELDS & set(data.keys())
    if not provided:
        raise ValueError(
            "Debe proporcionar al menos un campo de actividad: "
            + ", ".join(sorted(FITNESS_FIELDS))
        )

    record = {
        "user_id": user_id,
        "source": data.get("source", "manual"),
        "date": data.get("date", datetime.now().strftime("%Y-%m-%d")),
    }
    for field in FITNESS_FIELDS:
        val = data.get(field)
        if val is not None:
            record[field] = round(float(val), 2)

    res = supabase.table("fitness_logs").insert(record).execute()
    if not res.data:
        raise RuntimeError("Error al insertar en fitness_logs.")
    return res.data[0]


def get_fitness_logs(user_id: str, limit: int = 30) -> list:
    """Obtiene los registros de actividad física más recientes del usuario.

    Args:
        user_id: UUID del usuario.
        limit: Número máximo de registros a retornar (default 30).

    Returns:
        list[dict]: Lista de registros ordenados por fecha descendente.
    """
    res = supabase.table("fitness_logs").select("*").eq("user_id", user_id).order("date", desc=True).limit(limit).execute()
    return res.data or []
