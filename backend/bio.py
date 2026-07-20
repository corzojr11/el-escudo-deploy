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


def check_shift_conflicts(shifts: list[dict], new_shift: dict | None = None) -> list[dict]:
    """Comprueba traslapes o periodos de descanso < 8 horas entre turnos.
    
    Cada turno debe tener:
      - 'day' (str, ej. 'Lunes') o 'day_index' (int, 0..6)
      - 'start' (str, HH:MM)
      - 'end' (str, HH:MM)
      - 'id' (opcional, para omitir al editar)
    """
    # Combinar turnos existentes y el nuevo/modificado
    all_shifts = []
    
    # Si new_shift es una actualización, reemplazamos el existente con el mismo id
    replaced_id = new_shift.get("id") if new_shift else None
    
    for s in shifts:
        if replaced_id and s.get("id") == replaced_id:
            continue
        all_shifts.append(s)
        
    if new_shift:
        all_shifts.append(new_shift)
        
    def get_shift_type(s: dict) -> str:
        t = s.get("type")
        if t and t != "work":
            return t
        if s.get("start") == "00:00" and s.get("end") == "00:01":
            ikey = str(s.get("idempotency_key") or "").lower()
            if "travel" in ikey:
                return "travel"
            return "rest"
        return t or "work"

    all_shifts = [s for s in all_shifts if s.get("is_active", True) is not False and get_shift_type(s) == "work"]
    
    # Mapeo de días de la semana
    dias_es = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    
    def get_day_idx(val) -> int:
        if isinstance(val, int):
            return val
        s_val = str(val or "").lower().strip()
        # Limpiar acentos
        s_val = s_val.replace("é", "e").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u")
        try:
            return dias_es.index(s_val)
        except ValueError:
            return 0

    # Convertir cada turno a minutos semanales
    intervals = []
    for idx, s in enumerate(all_shifts):
        day_idx = get_day_idx(s.get("day_index") if s.get("day_index") is not None else s.get("day"))
        start_str = s.get("start") or "00:00"
        end_str = s.get("end") or "00:00"
        
        try:
            sh, sm = map(int, start_str.split(":"))
            eh, em = map(int, end_str.split(":"))
        except Exception:
            continue
            
        start_min = day_idx * 1440 + sh * 60 + sm
        end_min = day_idx * 1440 + eh * 60 + em
        
        if end_min < start_min: # Cruza de día
            end_min += 1440
            
        # Almacenar datos para identificar
        intervals.append({
            "orig_index": idx,
            "shift_data": s,
            "start": start_min,
            "end": end_min,
            "day": s.get("day"),
            "start_str": start_str,
            "end_str": end_str
        })
        
    # Replicar en 3 semanas para resolver condiciones de borde cíclicas
    replicated = []
    for item in intervals:
        for week_offset in [-1, 0, 1]:
            offset_min = week_offset * 10080
            replicated.append({
                "orig_index": item["orig_index"],
                "shift_data": item["shift_data"],
                "start": item["start"] + offset_min,
                "end": item["end"] + offset_min,
                "week_offset": week_offset,
                "day": item["day"],
                "start_str": item["start_str"],
                "end_str": item["end_str"]
            })
            
    # Ordenar por tiempo de inicio
    replicated.sort(key=lambda x: x["start"])
    
    conflicts = []
    # Comparar pares consecutivos
    for i in range(len(replicated) - 1):
        a = replicated[i]
        b = replicated[i+1]
        
        # Evitar comparar un turno consigo mismo en semanas distintas
        if a["orig_index"] == b["orig_index"]:
            continue
            
        # Solo reportar conflicto si al menos uno de los dos turnos está en la semana 0
        # para evitar duplicidad de conflictos en semana -1 o semana 1
        if a["week_offset"] != 0 and b["week_offset"] != 0:
            continue
            
        # 1. Traslape
        if b["start"] < a["end"]:
            conflicts.append({
                "type": "TRASLAPE",
                "message": f"Traslape: El turno del {a['day']} ({a['start_str']}-{a['end_str']}) se cruza con el del {b['day']} ({b['start_str']}-{b['end_str']}).",
                "shifts": [a["shift_data"], b["shift_data"]]
            })
        # 2. Descanso insuficiente (< 8 horas = 480 minutos)
        elif (b["start"] - a["end"]) < 480:
            rest_hours = round((b["start"] - a["end"]) / 60, 1)
            conflicts.append({
                "type": "RIESGO_BIOLOGICO",
                "message": f"Fatiga extrema: Solo hay {rest_hours}h de descanso entre el turno del {a['day']} ({a['start_str']}-{a['end_str']}) y el del {b['day']} ({b['start_str']}-{b['end_str']}). Mínimo recomendado: 8h.",
                "shifts": [a["shift_data"], b["shift_data"]]
            })
            
    return conflicts

