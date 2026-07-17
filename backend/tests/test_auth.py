import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

import jwt as pyjwt
import pytest
from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

load_dotenv()

import auth


def _mock_request(host="127.0.0.1", body_bytes=b""):
    request = MagicMock()
    request.client = MagicMock()
    request.client.host = host
    request.body = AsyncMock(return_value=body_bytes)
    return request


class TestAuth:
    def test_valid_jwt_allows_access(self, monkeypatch):
        monkeypatch.setattr(auth, "DEV_MODE", False)
        monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", "test-secret-key-for-testing-123")

        mock_supabase = MagicMock()
        mock_supabase.auth.get_user.side_effect = Exception("supabase auth fail")
        monkeypatch.setattr(auth, "supabase", mock_supabase)

        user_id = "11111111-1111-1111-1111-111111111111"
        token = pyjwt.encode(
            {"sub": user_id, "aud": "authenticated", "exp": time.time() + 3600},
            auth.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        request = _mock_request()

        user = asyncio.run(auth.get_current_user(request, creds))
        assert user.id == user_id
        assert user.aud == "authenticated"

    def test_invalid_or_expired_jwt_blocks_with_401(self, monkeypatch):
        monkeypatch.setattr(auth, "DEV_MODE", False)
        monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", "test-secret-key-for-testing-123")

        mock_supabase = MagicMock()
        mock_supabase.auth.get_user.side_effect = Exception("supabase auth fail")
        monkeypatch.setattr(auth, "supabase", mock_supabase)

        request = _mock_request()

        creds_bad = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not_a_valid_token")
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(auth.get_current_user(request, creds_bad))
        assert exc_info.value.status_code == 401

        wrong_token = pyjwt.encode(
            {"sub": "user-123", "aud": "authenticated", "exp": time.time() + 3600},
            "wrong_secret",
            algorithm="HS256",
        )
        creds_wrong = HTTPAuthorizationCredentials(scheme="Bearer", credentials=wrong_token)
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(auth.get_current_user(request, creds_wrong))
        assert exc_info.value.status_code == 401

        expired_token = pyjwt.encode(
            {"sub": "user-123", "aud": "authenticated", "exp": time.time() - 10},
            auth.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )
        creds_expired = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(auth.get_current_user(request, creds_expired))
        assert exc_info.value.status_code == 401

    def test_jwt_local_validation_is_pinned_to_hs256(self, monkeypatch):
        monkeypatch.setattr(auth, "DEV_MODE", False)
        monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", "test-secret-key-for-testing-123")

        mock_supabase = MagicMock()
        mock_supabase.auth.get_user.side_effect = Exception("supabase auth fail")
        monkeypatch.setattr(auth, "supabase", mock_supabase)

        decode_mock = MagicMock(return_value={"sub": "user-123"})
        monkeypatch.setattr(auth.pyjwt, "decode", decode_mock)

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
        request = _mock_request()

        user = asyncio.run(auth.get_current_user(request, creds))

        assert user.id == "user-123"
        assert decode_mock.call_args.kwargs["algorithms"] == ["HS256"]

    def test_dev_mode_does_not_bypass_without_token(self, monkeypatch):
        monkeypatch.setattr(auth, "DEV_MODE", True)
        mock_supabase = MagicMock()
        monkeypatch.setattr(auth, "supabase", mock_supabase)

        request = _mock_request(host="127.0.0.1")

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(auth.get_current_user(request, None))
        assert exc_info.value.status_code == 401
