import time

import httpx

_trm_cache = {"value": 4000.0, "updated_at": None}
_TRM_CACHE_TTL_SECONDS = 3600  # 1 hora


async def get_trm():
    now = time.time()
    if _trm_cache["updated_at"] and (now - _trm_cache["updated_at"] < _TRM_CACHE_TTL_SECONDS):
        return _trm_cache["value"]

    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            r = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            data = r.json()
            trm = data["rates"].get("COP", 4000.0)
            _trm_cache["value"] = trm
            _trm_cache["updated_at"] = now
            return trm
    except Exception:
        return _trm_cache["value"]
