"""Notificaciones push vía Expo Push API y lógica contextual.

Gestiona el envío de notificaciones a los dispositivos de los usuarios,
incluyendo las notificaciones programadas por anclajes biológicos.
"""

from datetime import datetime, timedelta
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from requests.exceptions import ConnectionError, HTTPError
from database import supabase
from bio import calcular_anclajes_bio

_notified_today = set()


def _is_anchor_imminent(anchor_time_str: str, window_minutes: int = 15) -> bool:
    """Determina si un anclaje biológico ocurrirá dentro de la ventana dada.

    Compara la hora actual contra la hora del anclaje; si la diferencia
    en minutos está entre 0 y window_minutes, se considera inminente.

    Args:
        anchor_time_str: Hora del anclaje en formato 'HH:MM'.
        window_minutes: Ventana de tolerancia en minutos (default 15).

    Returns:
        True si el anclaje ocurre dentro de la ventana actual.
    """
    now = datetime.now()
    parts = anchor_time_str.split(":")
    anchor_minutes = int(parts[0]) * 60 + int(parts[1])
    now_minutes = now.hour * 60 + now.minute
    return 0 <= (anchor_minutes - now_minutes) <= window_minutes


def send_contextual_notifications():
    """Evalúa y envía notificaciones contextuales para todos los usuarios.

    Ejecutada por el scheduler cada 5 minutos. Para cada usuario:
    1. Obtiene su configuración bio (o defaults).
    2. Ajusta la hora de despertar según deuda de sueño.
    3. Calcula anclajes y envía push si alguno es inminente.
    4. Evita duplicados con _notified_today.

    Los tokens inválidos se limpian automáticamente.
    """
    now = datetime.now()
    today_key = now.strftime("%Y-%m-%d")
    global _notified_today
    _notified_today = {k for k in _notified_today if k.startswith(today_key)}

    try:
        profiles = supabase.table("profiles").select("user_id").execute()
        for p in (profiles.data or []):
            uid = p["user_id"]
            try:
                s = supabase.table("user_bio_settings").select("*").eq("user_id", uid).limit(1).execute()
                settings = s.data[0] if s.data else {"t_wake_target": "06:00", "sleep_debt_hours": 0}
                wake_h, wake_m = [int(x) for x in settings["t_wake_target"].split(":")[:2]]
                optimal = datetime.now().replace(hour=wake_h, minute=wake_m, second=0, microsecond=0)
                debt = float(settings.get("sleep_debt_hours", 0))
                if debt > 0:
                    optimal += timedelta(hours=min(debt, 2))
                anclajes = calcular_anclajes_bio(optimal.hour, optimal.minute)
                for a in anclajes:
                    notification_key = f"{today_key}:{uid}:{a['anchor']}"
                    if notification_key in _notified_today:
                        continue
                    if _is_anchor_imminent(a["time"]):
                        tokens = supabase.table("push_tokens").select("token").eq("user_id", uid).execute()
                        token_list = [row["token"] for row in (tokens.data or [])]
                        if token_list:
                            messages = [PushMessage(to=t, body=a["description"], title=a["title"]) for t in token_list]
                            response = PushClient().publish_multiple(messages)
                            for ticket in response:
                                try:
                                    ticket.validate_response()
                                except DeviceNotRegisteredError:
                                    supabase.table("push_tokens").delete().eq("token", ticket.to).execute()
                                except PushTicketError as exc:
                                    print(f"[NOTIFIER] Error en ticket: {exc}")
                            _notified_today.add(notification_key)
                            print(f"[NOTIFIER] '{a['title']}' enviado a {uid}")
            except Exception as e:
                print(f"[NOTIFIER] Error procesando usuario {uid}: {e}")
    except Exception as e:
        print(f"[NOTIFIER] Error en lote de notificaciones: {e}")

def send_push_message(token, message, extra=None):
    """Envía una notificación push a un dispositivo específico.

    Maneja errores de formato (PushServerError), conectividad
    (ConnectionError/HTTPError) y tokens no registrados
    (DeviceNotRegisteredError).

    Args:
        token: Token de Expo Push del dispositivo destino.
        message: Cuerpo del mensaje a mostrar.
        extra: Diccionario opcional de datos adicionales.

    Raises:
        PushServerError: Si hay error de validación con Expo.
        ConnectionError: Si falla la conexión con el servidor Expo.
        HTTPError: Si la respuesta HTTP es errónea.
    """
    try:
        response = PushClient().publish(
            PushMessage(to=token,
                        body=message,
                        data=extra))
    except PushServerError as exc:
        print(exc.errors)
        print(exc.response_data)
        raise
    except (ConnectionError, HTTPError) as exc:
        print("Connection or HTTP error:", exc)
        raise

    try:
        response.validate_response()
    except DeviceNotRegisteredError:
        print("DeviceNotRegisteredError")
    except PushTicketError as exc:
        print("PushTicketError:", exc)
