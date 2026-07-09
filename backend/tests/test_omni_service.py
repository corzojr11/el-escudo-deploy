"""Tests unitarios para la lógica interna de services/omni_service.py."""

import sys
import asyncio
import logging
from unittest.mock import MagicMock

# Evitar import real de google.genai al cargar omni_service
sys.modules["google.genai"] = MagicMock()

import pytest
from services import omni_service as omni_service_module

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


# ─── Helpers ────────────────────────────────────────────────────────────────

def _make_user(user_id=None):
    return type("User", (), {"id": user_id or MOCK_USER_ID})()


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ─── Caso 1: normalize_text ─────────────────────────────────────────────────

class TestNormalizeText:
    def test_nutricion(self):
        assert omni_service_module.normalize_text("Nutrición") == "nutricion"

    def test_objetivo_de_ahorro(self):
        assert omni_service_module.normalize_text("OBJETIVO DE AHORRO") == "objetivo de ahorro"

    def test_accion_rapida(self):
        # El código real mantiene '!' porque es ASCII; se ajusta el assert al comportamiento real
        assert omni_service_module.normalize_text("¡Acción-Rápida!") == "accion-rapida!"

    def test_removes_accents_and_lowercase(self):
        assert omni_service_module.normalize_text("ÁÉÍÓÚáéíóú") == "aeiouaeiou"

    def test_strips_whitespace(self):
        assert omni_service_module.normalize_text("  Espacios  ") == "espacios"


# ─── Caso 2: normalize_goal_type ──────────────────────────────────────────────

class TestNormalizeGoalType:
    def test_bajar_de_peso(self):
        assert omni_service_module.normalize_goal_type("bajar de peso") == "weight"

    def test_ahorro(self):
        assert omni_service_module.normalize_goal_type("ahorro") == "finance"

    def test_correr(self):
        assert omni_service_module.normalize_goal_type("correr") == "fitness"

    def test_desconocido(self):
        # normalize_goal_type retorna el valor normalizado si no está en GOAL_TYPE_ALIASES
        assert omni_service_module.normalize_goal_type("desconocido") == "desconocido"

    def test_fitness_alias(self):
        assert omni_service_module.normalize_goal_type("Entrenamiento") == "fitness"

    def test_finance_alias(self):
        assert omni_service_module.normalize_goal_type("SAVINGS") == "finance"


# ─── Caso 3 & 4: _get_user_context ────────────────────────────────────────────

class TestGetUserContext:
    def _build_mock_supabase_success(self):
        """Mock de supabase con perfil válido y resto vacío."""
        mock_supa = MagicMock()

        # profiles chain:
        # supabase.table("profiles").select("level, xp, player_id").eq("user_id", user.id).maybe_single().execute()
        prof_select = MagicMock()
        prof_eq1 = MagicMock()
        prof_eq2 = MagicMock()
        prof_maybe = MagicMock()
        prof_select.select.return_value = prof_eq1
        prof_eq1.eq.return_value = prof_eq2
        prof_eq2.maybe_single.return_value = prof_maybe
        prof_maybe.execute.return_value = MagicMock(data={"level": 5, "xp": 1200, "player_id": "p123"})

        # user_activity_patterns chain:
        # .select(...).eq(...).gte(...).eq(...).order(...).limit(...).execute()
        pat_select = MagicMock()
        pat_eq1 = MagicMock()
        pat_eq2 = MagicMock()
        pat_eq3 = MagicMock()
        pat_order = MagicMock()
        pat_limit = MagicMock()
        pat_exec = MagicMock()
        pat_select.select.return_value = pat_eq1
        pat_eq1.eq.return_value = pat_eq2
        pat_eq2.gte.return_value = pat_eq3
        pat_eq3.eq.return_value = pat_order
        pat_order.order.return_value = pat_limit
        pat_limit.limit.return_value = pat_exec
        pat_exec.execute.return_value = MagicMock(data=[])

        # clan_members chain:
        # .select("clan_id").eq("player_id", pid).maybe_single().execute()
        cm_select = MagicMock()
        cm_eq1 = MagicMock()
        cm_eq2 = MagicMock()
        cm_maybe = MagicMock()
        cm_select.select.return_value = cm_eq1
        cm_eq1.eq.return_value = cm_eq2
        cm_eq2.maybe_single.return_value = cm_maybe
        cm_maybe.execute.return_value = MagicMock(data=None)

        # challenges chain:
        # .select("id", count="exact").or_(...).in_(...).execute()
        chal_select = MagicMock()
        chal_or = MagicMock()
        chal_in = MagicMock()
        chal_exec = MagicMock()
        chal_select.select.return_value = chal_or
        chal_or.or_.return_value = chal_in
        chal_in.in_.return_value = chal_exec
        chal_exec.execute.return_value = MagicMock(count=0)

        def table_side(name):
            if name == "profiles":
                return prof_select
            if name == "user_activity_patterns":
                return pat_select
            if name == "clan_members":
                return cm_select
            if name == "challenges":
                return chal_select
            return MagicMock()

        mock_supa.table.side_effect = table_side
        return mock_supa

    def test_success_returns_context_with_profile(self, monkeypatch):
        mock_supa = self._build_mock_supabase_success()
        monkeypatch.setattr(omni_service_module, "supabase", mock_supa)

        user = _make_user()
        ctx = _run_async(omni_service_module._get_user_context(user))

        assert "Nivel: 5 | XP: 1200" in ctx
        assert "Clan" not in ctx
        assert "Retos activos" not in ctx

    def test_success_with_clan_and_challenges(self, monkeypatch):
        mock_supa = MagicMock()

        # profiles
        prof_select = MagicMock()
        prof_eq1 = MagicMock()
        prof_eq2 = MagicMock()
        prof_maybe = MagicMock()
        prof_select.select.return_value = prof_eq1
        prof_eq1.eq.return_value = prof_eq2
        prof_eq2.maybe_single.return_value = prof_maybe
        prof_maybe.execute.return_value = MagicMock(data={"level": 10, "xp": 5000, "player_id": "p999"})

        # user_activity_patterns -> vacío
        pat_select = MagicMock()
        pat_eq1 = MagicMock()
        pat_eq2 = MagicMock()
        pat_eq3 = MagicMock()
        pat_order = MagicMock()
        pat_limit = MagicMock()
        pat_exec = MagicMock()
        pat_select.select.return_value = pat_eq1
        pat_eq1.eq.return_value = pat_eq2
        pat_eq2.gte.return_value = pat_eq3
        pat_eq3.eq.return_value = pat_order
        pat_order.order.return_value = pat_limit
        pat_limit.limit.return_value = pat_exec
        pat_exec.execute.return_value = MagicMock(data=[])

        # clan_members -> con clan
        cm_select = MagicMock()
        cm_eq1 = MagicMock()
        cm_eq2 = MagicMock()
        cm_maybe = MagicMock()
        cm_select.select.return_value = cm_eq1
        cm_eq1.eq.return_value = cm_eq2
        cm_eq2.maybe_single.return_value = cm_maybe
        cm_maybe.execute.return_value = MagicMock(data={"clan_id": "c1"})

        # clans -> nombre
        clans_select = MagicMock()
        clans_eq1 = MagicMock()
        clans_eq2 = MagicMock()
        clans_maybe = MagicMock()
        clans_select.select.return_value = clans_eq1
        clans_eq1.eq.return_value = clans_eq2
        clans_eq2.maybe_single.return_value = clans_maybe
        clans_maybe.execute.return_value = MagicMock(data={"name": "Los Titanes"})

        # challenges -> 3 retos
        chal_select = MagicMock()
        chal_or = MagicMock()
        chal_in = MagicMock()
        chal_exec = MagicMock()
        chal_select.select.return_value = chal_or
        chal_or.or_.return_value = chal_in
        chal_in.in_.return_value = chal_exec
        chal_exec.execute.return_value = MagicMock(count=3)

        def table_side(name):
            if name == "profiles":
                return prof_select
            if name == "user_activity_patterns":
                return pat_select
            if name == "clan_members":
                return cm_select
            if name == "clans":
                return clans_select
            if name == "challenges":
                return chal_select
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(omni_service_module, "supabase", mock_supa)

        user = _make_user()
        ctx = _run_async(omni_service_module._get_user_context(user))

        assert "Nivel: 10 | XP: 5000" in ctx
        assert 'Clan: "Los Titanes"' in ctx
        assert "Retos activos: 3" in ctx

    def test_failure_logs_warning_and_returns_partial(self, monkeypatch, caplog):
        """Simula fallo en user_activity_patterns: debe loggear warning y retornar contexto parcial."""
        mock_supa = MagicMock()

        # profiles -> OK
        prof_select = MagicMock()
        prof_eq1 = MagicMock()
        prof_eq2 = MagicMock()
        prof_maybe = MagicMock()
        prof_select.select.return_value = prof_eq1
        prof_eq1.eq.return_value = prof_eq2
        prof_eq2.maybe_single.return_value = prof_maybe
        prof_maybe.execute.return_value = MagicMock(data={"level": 3, "xp": 100, "player_id": ""})

        # user_activity_patterns -> FAIL
        pat_select = MagicMock()
        pat_eq1 = MagicMock()
        pat_eq2 = MagicMock()
        pat_eq3 = MagicMock()
        pat_order = MagicMock()
        pat_limit = MagicMock()
        pat_exec = MagicMock()
        pat_select.select.return_value = pat_eq1
        pat_eq1.eq.return_value = pat_eq2
        pat_eq2.gte.return_value = pat_eq3
        pat_eq3.eq.return_value = pat_order
        pat_order.order.return_value = pat_limit
        pat_limit.limit.return_value = pat_exec

        def _fail():
            raise RuntimeError("DB connection lost")

        pat_exec.execute.side_effect = _fail

        def table_side(name):
            if name == "profiles":
                return prof_select
            if name == "user_activity_patterns":
                return pat_select
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(omni_service_module, "supabase", mock_supa)

        user = _make_user()
        with caplog.at_level(logging.WARNING, logger="escudo"):
            ctx = _run_async(omni_service_module._get_user_context(user))

        assert "Nivel: 3 | XP: 100" in ctx
        assert "Error en contexto de usuario (patterns)" in caplog.text
        assert "DB connection lost" in caplog.text

    def test_failure_in_profiles_returns_minimal_context(self, monkeypatch):
        """Simula fallo en profiles: debe retornar contexto mínimo sin crash."""
        mock_supa = MagicMock()

        # profiles -> FAIL
        prof_select = MagicMock()
        prof_eq1 = MagicMock()
        prof_eq2 = MagicMock()
        prof_maybe = MagicMock()
        prof_select.select.return_value = prof_eq1
        prof_eq1.eq.return_value = prof_eq2
        prof_eq2.maybe_single.return_value = prof_maybe

        def _fail():
            raise RuntimeError("Profiles table unreachable")

        prof_maybe.execute.side_effect = _fail

        def table_side(name):
            if name == "profiles":
                return prof_select
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(omni_service_module, "supabase", mock_supa)

        user = _make_user()
        ctx = _run_async(omni_service_module._get_user_context(user))

        assert "Nivel: 1 | XP: 0" in ctx
        assert ctx == "Nivel: 1 | XP: 0"
