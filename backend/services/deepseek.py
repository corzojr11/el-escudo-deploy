"""Cliente mínimo para DeepSeek V4 usando su API compatible con OpenAI."""

import os
from typing import Any

import httpx


DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")


def is_configured() -> bool:
    return bool(os.getenv("DEEPSEEK_API_KEY"))


async def complete_chat(
    messages: list[dict[str, str]],
    *,
    json_output: bool = False,
    temperature: float | None = None,
    max_tokens: int = 800,
) -> dict[str, Any]:
    """Genera una respuesta corta sin habilitar el modo de razonamiento costoso."""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY no está configurada.")

    payload: dict[str, Any] = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": False,
        "thinking": {"type": "disabled"},
    }
    if json_output:
        payload["response_format"] = {"type": "json_object"}
    if temperature is not None:
        payload["temperature"] = temperature

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            DEEPSEEK_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    message = ((data.get("choices") or [{}])[0].get("message") or {})
    usage = data.get("usage") or {}
    return {
        "text": str(message.get("content") or "").strip(),
        "prompt_tokens": int(usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("completion_tokens") or 0),
    }
