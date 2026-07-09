"""Tests unitarios para el módulo de notificaciones (notifier.py)."""

from datetime import datetime
from unittest.mock import patch, MagicMock
import pytest


def test_is_anchor_imminent_devuelve_true_dentro_ventana():
    """Verifica que un anclaje a +5 min de la hora actual es inminente."""
    with patch("notifier.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 0, 0)

        from notifier import _is_anchor_imminent

        assert _is_anchor_imminent("10:05") is True


def test_is_anchor_imminent_devuelve_false_fuera_ventana():
    """Verifica que un anclaje a +30 min NO es inminente."""
    with patch("notifier.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 0, 0)

        from notifier import _is_anchor_imminent

        assert _is_anchor_imminent("10:30") is False


def test_is_anchor_imminent_devuelve_false_pasado():
    """Verifica que un anclaje en el pasado NO es inminente."""
    with patch("notifier.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 30, 0)

        from notifier import _is_anchor_imminent

        assert _is_anchor_imminent("10:00") is False


def test_is_anchor_imminent_ventana_personalizada():
    """Verifica que la ventana se puede modificar via parámetro."""
    with patch("notifier.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 0, 0)

        from notifier import _is_anchor_imminent

        assert _is_anchor_imminent("10:20", window_minutes=20) is True
        assert _is_anchor_imminent("10:21", window_minutes=20) is False


def test_send_contextual_notifications_consulta_profiles():
    """Verifica que sin usuarios no se envía nada."""
    with patch("notifier.datetime") as mock_dt, \
         patch("notifier.supabase") as mock_supa, \
         patch("notifier.PushClient") as mock_push, \
         patch("bio.datetime") as mock_bio_dt:

        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 0, 0)
        mock_bio_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)
        mock_supa.table.return_value.select.return_value.execute.return_value.data = []

        from notifier import send_contextual_notifications

        send_contextual_notifications()

        mock_supa.table.assert_any_call("profiles")
        mock_push.assert_not_called()


def test_send_contextual_notifications_sin_anclaje_inminente():
    """Con wake=06:00 a las 10:00, ningún anclaje cae en ventana de 15 min."""
    with patch("notifier.datetime") as mock_dt, \
         patch("notifier.supabase") as mock_supa, \
         patch("notifier.PushClient") as mock_push, \
         patch("bio.datetime") as mock_bio_dt:

        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 0, 0)
        mock_bio_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)

        table_data = {
            "profiles": [{"user_id": "u1"}],
            "user_bio_settings": [],
            "push_tokens": [],
        }

        def table_side(name):
            m = MagicMock()
            m.select.return_value.execute.return_value.data = table_data.get(name, [])
            if name == "user_bio_settings":
                m.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
            return m
        mock_supa.table.side_effect = table_side

        from notifier import send_contextual_notifications

        send_contextual_notifications()

        mock_push.assert_not_called()


def test_send_contextual_notifications_con_anclaje_inminente():
    """A las 10:25 con wake=06:00, el anclaje de almuerzo (10:30) es inminente."""
    with patch("notifier.datetime") as mock_dt, \
         patch("notifier.supabase") as mock_supa, \
         patch("notifier.PushClient") as mock_push, \
         patch("bio.datetime") as mock_bio_dt:

        mock_dt.now.return_value = datetime(2025, 6, 1, 10, 25, 0)
        mock_bio_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)

        table_data = {
            "profiles": [{"user_id": "u1"}],
            "user_bio_settings": [],
            "push_tokens": [{"token": "ExpoToken1"}],
        }

        def table_side(name):
            m = MagicMock()
            m.select.return_value.execute.return_value.data = table_data.get(name, [])
            if name == "user_bio_settings":
                m.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
            if name == "push_tokens":
                m.select.return_value.eq.return_value.execute.return_value.data = table_data.get(name, [])
            return m
        mock_supa.table.side_effect = table_side

        from notifier import send_contextual_notifications

        send_contextual_notifications()

        # Almuerzo (10:30) está a 5 min — PushClient debería haberse llamado
        mock_push.assert_called()
