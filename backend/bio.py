"""Motor de ritmos biológicos — anclajes circadianos y ventanas de sueño.

Provee las funciones de cálculo usadas tanto por la API REST como por el
planificador de notificaciones contextuales. Es un módulo puro (sin dependencia
directa de Supabase); la API y el planificador se encargan de obtener/almacenar
datos en Supabase y pasar los parámetros a estas funciones.
"""

from datetime import datetime, timedelta

CYCLE_MINUTES = 90


def calcular_ventanas_sueno(wake_hour: int, wake_minute: int):
    """Calcula las ventanas de sueño disponibles según la hora de despertar.

    Genera opciones de 4, 5 y 6 ciclos (aprox. 6h, 7.5h y 9h), restando
    15 min de latencia. Cada ventana incluye la hora de acostarse y la
    de despertar.

    Args:
        wake_hour: Hora objetivo de despertar (0-23).
        wake_minute: Minuto objetivo de despertar (0-59).

    Returns:
        list[dict]: Lista de ventanas, ordenadas de más a menos ciclos.
    """
    base = datetime.now().replace(hour=wake_hour, minute=wake_minute, second=0, microsecond=0)
    windows = []
    for c in [6, 5, 4]:
        sleep_duration = c * CYCLE_MINUTES
        sleep_time = base - timedelta(minutes=sleep_duration + 15)
        windows.append({
            "cycles": c,
            "hours": round(c * 1.5, 1),
            "sleep_time": sleep_time.strftime("%H:%M"),
            "wake_time": base.strftime("%H:%M"),
        })
    return windows


def calcular_anclajes_bio(wake_hour: int, wake_minute: int):
    """Calcula los tres anclajes biológicos del día (luz, comida, ducha).

    Los anclajes son hitos circadianos que el sistema usa para enviar
    recordatorios contextuales al usuario.

    Args:
        wake_hour: Hora de despertar ajustada (0-23).
        wake_minute: Minuto de despertar ajustado (0-59).

    Returns:
        list[dict]: Lista con los anclajes, cada uno con 'anchor',
            'title', 'description' y 'time'.
    """
    wake_base = datetime.now().replace(hour=wake_hour, minute=wake_minute, second=0, microsecond=0)
    return [
        {"anchor": "Luz Solar", "title": "Exposición a luz solar", "description": "Activa el eje circadiano y detiene la producción de melatonina.", "time": (wake_base + timedelta(minutes=30)).strftime("%H:%M"), "delta_minutes": 30},
        {"anchor": "Almuerzo", "title": "Ventana metabólica principal", "description": "Máxima eficiencia digestiva.", "time": (wake_base + timedelta(hours=4, minutes=30)).strftime("%H:%M"), "delta_hours": 4.5},
        {"anchor": "Ducha Térmica", "title": "Ducha de contraste térmico", "description": "Descenso de temperatura corporal induce melatonina.", "time": (wake_base + timedelta(hours=15, minutes=30)).strftime("%H:%M"), "delta_hours": 15.5},
    ]
