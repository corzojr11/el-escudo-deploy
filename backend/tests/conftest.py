"""Configuración global de pytest — mocks de dependencias externas."""

import sys
import importlib.metadata as importlib_metadata
from unittest.mock import MagicMock

# Mock del módulo database antes de cualquier import de los módulos bajo test
mock_db = MagicMock()
mock_db.supabase.table.return_value.select.return_value.execute.return_value.data = []
sys.modules["database"] = mock_db

# Mock ligero de dependencias opcionales que no siempre están instaladas en el entorno local.
slowapi_module = MagicMock()
slowapi_module.Limiter = MagicMock()
slowapi_module._rate_limit_exceeded_handler = MagicMock()
sys.modules["slowapi"] = slowapi_module

slowapi_util_module = MagicMock()
slowapi_util_module.get_remote_address = MagicMock(return_value="127.0.0.1")
sys.modules["slowapi.util"] = slowapi_util_module

slowapi_errors_module = MagicMock()
slowapi_errors_module.RateLimitExceeded = Exception
sys.modules["slowapi.errors"] = slowapi_errors_module

sentry_module = MagicMock()
sentry_module.init = MagicMock()
sys.modules["sentry_sdk"] = sentry_module

sentry_fastapi_module = MagicMock()
sentry_fastapi_module.FastApiIntegration = MagicMock()
sys.modules["sentry_sdk.integrations.fastapi"] = sentry_fastapi_module

expo_push_module = MagicMock()
expo_push_module.DeviceNotRegisteredError = Exception
expo_push_module.PushClient = MagicMock()
expo_push_module.PushMessage = MagicMock()
expo_push_module.PushServerError = Exception
expo_push_module.PushTicketError = Exception
sys.modules["exponent_server_sdk"] = expo_push_module

apscheduler_bg_module = MagicMock()
apscheduler_bg_module.BackgroundScheduler = MagicMock()
sys.modules["apscheduler.schedulers.background"] = apscheduler_bg_module

postgrest_exceptions_module = MagicMock()
postgrest_exceptions_module.APIError = Exception
sys.modules["postgrest.exceptions"] = postgrest_exceptions_module

email_validator_module = MagicMock()
email_validator_module.validate_email = MagicMock()
email_validator_module.EmailNotValidError = Exception
sys.modules["email_validator"] = email_validator_module

_orig_version = importlib_metadata.version


def _mock_version(name):
    if name == "email-validator":
        return "2.0.0"
    return _orig_version(name)


importlib_metadata.version = _mock_version


import pytest
