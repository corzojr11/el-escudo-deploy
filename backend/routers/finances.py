import asyncio
import logging
import os
import json
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from google import genai

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None  # type: ignore

from auth import get_current_user
from database import supabase
from exceptions import BadRequestException, NotFoundException
from services.observability import track_event

logger = logging.getLogger("escudo")
router = APIRouter()
_gemini_api_key = os.getenv("GEMINI_API_KEY")
_ai_client = genai.Client(api_key=_gemini_api_key) if _gemini_api_key else None


def _bogota_now() -> datetime:
    if ZoneInfo:
        try:
            return datetime.now(ZoneInfo("America/Bogota"))
        except Exception as exc:
            logger.warning(f"No se pudo usar zona America/Bogota: {exc}")
    return datetime.now()


def _date_range_from_query(range_value: str) -> tuple[Optional[str], Optional[str]]:
    """Devuelve (start_date, end_date) en formato YYYY-MM-DD para el rango pedido."""
    today = _bogota_now().date()
    if range_value == "today":
        return (today.isoformat(), today.isoformat())
    if range_value == "week":
        # Lunes a domingo de la semana actual (0=Lunes)
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return (start.isoformat(), end.isoformat())
    if range_value == "month":
        start = today.replace(day=1)
        # último día del mes
        if start.month == 12:
            next_month = start.replace(year=start.year + 1, month=1, day=1)
        else:
            next_month = start.replace(month=start.month + 1, day=1)
        end = next_month - timedelta(days=1)
        return (start.isoformat(), end.isoformat())
    return (None, None)


class FinanceCreatePayload(BaseModel):
    description: str = "Gasto"
    amount: float = Field(0, gt=0)
    category: str = "General"
    type: Optional[str] = "GASTO"
    date: Optional[str] = None
    idempotency_key: Optional[str] = None


class FinanceUpdatePayload(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None


class ReceiptParsePayload(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"


class FinanceQuickEntryPayload(BaseModel):
    text: str
    idempotency_key: Optional[str] = None


def _normalize_finance_type(raw_type: Optional[str]) -> str:
    tx_type = str(raw_type or "GASTO").upper()
    return tx_type if tx_type in ("GASTO", "INGRESO") else "GASTO"


def _today_str() -> str:
    return _bogota_now().date().isoformat()


def _parse_iso_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        d = date.fromisoformat(value)
        return d.isoformat()
    except Exception:
        return None


async def _find_by_idempotency(user_id: str, key: Optional[str]) -> Optional[dict]:
    if not key:
        return None
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("finances")
            .select("*")
            .eq("user_id", user_id)
            .eq("idempotency_key", key)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as exc:
        logger.warning(f"idempotency lookup error: {exc}")
        return None


async def _insert_finance_row(user_id: str, payload: dict) -> dict:
    tx_type = _normalize_finance_type(payload.get("type"))
    normalized_category = str(payload.get("category") or "General").strip() or "General"
    if normalized_category.startswith("INGRESO:"):
        normalized_category = normalized_category.replace("INGRESO:", "", 1).strip() or "General"
        tx_type = "INGRESO"

    tx_date = _parse_iso_date(payload.get("date")) or _today_str()
    idempotency_key = str(payload.get("idempotency_key") or "").strip() or None

    if idempotency_key:
        existing = await _find_by_idempotency(user_id, idempotency_key)
        if existing:
            if "type" not in existing:
                existing["type"] = tx_type
            return existing

    insert_data = {
        "user_id": user_id,
        "description": str(payload.get("description") or ("Ingreso" if tx_type == "INGRESO" else "Gasto")).strip(),
        "amount": float(payload.get("amount") or 0),
        "category": normalized_category,
        "type": tx_type,
        "date": tx_date,
    }
    if idempotency_key:
        insert_data["idempotency_key"] = idempotency_key

    res = await asyncio.to_thread(lambda: supabase.table("finances").insert(insert_data).execute())
    if not res.data:
        insert_compat = {k: v for k, v in insert_data.items() if k != "type" and k != "idempotency_key"}
        res = await asyncio.to_thread(lambda: supabase.table("finances").insert(insert_compat).execute())
    if res.data and "type" not in res.data[0]:
        res.data[0]["type"] = tx_type
    if res.data and "date" not in res.data[0]:
        res.data[0]["date"] = tx_date
    return res.data[0] if res.data else insert_data


@router.get("/api/v1/finances")
async def list_finances(
    range: str = Query("all", pattern="^(all|today|week|month)$"),
    user = Depends(get_current_user),
):
    """Lista movimientos financieros con filtro por rango de fecha."""
    start, end = _date_range_from_query(range)
    query = supabase.table("finances").select("*").eq("user_id", user.id)
    if start and end:
        query = query.gte("date", start).lte("date", end)
    query = query.order("date", desc=True).order("created_at", desc=True)
    res = await asyncio.to_thread(lambda: query.execute())
    return {"finances": res.data or []}


@router.get("/api/v1/finances/summary")
async def get_finances_summary(
    range: str = Query("all", pattern="^(all|today|week|month)$"),
    user = Depends(get_current_user),
):
    start, end = _date_range_from_query(range)
    query = supabase.table("finances").select("category, amount, type").eq("user_id", user.id)
    if start and end:
        query = query.gte("date", start).lte("date", end)

    try:
        res = await asyncio.to_thread(lambda: query.execute())
    except Exception:
        # Compat con esquemas antiguos sin columna `type`
        fallback_query = supabase.table("finances").select("category, amount").eq("user_id", user.id)
        if start and end:
            fallback_query = fallback_query.gte("date", start).lte("date", end)
        res = await asyncio.to_thread(lambda: fallback_query.execute())
    if getattr(res, "error", None):
        fallback_query = supabase.table("finances").select("category, amount").eq("user_id", user.id)
        if start and end:
            fallback_query = fallback_query.gte("date", start).lte("date", end)
        res = await asyncio.to_thread(lambda: fallback_query.execute())

    summary = {}
    total_income = 0.0
    total_expense = 0.0
    for item in (res.data or []):
        tx_type = (item.get("type") or "").upper()
        cat = item.get("category", "Otros") or "Otros"
        if not isinstance(cat, str):
            cat = str(cat)
        if tx_type == "INGRESO":
            cat = f"INGRESO:{cat}"
        elif tx_type != "INGRESO" and isinstance(cat, str) and cat.startswith("INGRESO:"):
            tx_type = "INGRESO"
        amount_raw = item.get("amount", 0)
        try:
            amount = float(amount_raw or 0)
        except Exception:
            amount = 0.0
        if tx_type == "INGRESO":
            total_income += amount
        else:
            total_expense += amount
        summary[cat] = float(summary.get(cat, 0)) + amount
    formatted_summary = [{"category": k, "total": v} for k, v in summary.items()]
    return {
        "summary": formatted_summary,
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense,
    }


@router.post("/api/v1/finances")
async def add_finance(payload: FinanceCreatePayload, user = Depends(get_current_user)):
    created = await _insert_finance_row(user.id, payload.model_dump(exclude_unset=True))
    await track_event(
        module="finances",
        event="create_transaction",
        status="ok",
        user_id=user.id,
        metadata={
            "type": _normalize_finance_type(payload.type),
            "amount": payload.amount,
            "category": payload.category,
        },
    )
    return created


@router.post("/api/v1/finances/quick-entry")
async def quick_entry(payload: FinanceQuickEntryPayload, user = Depends(get_current_user)):
    if not payload.text or not payload.text.strip():
        raise BadRequestException("El texto del movimiento es obligatorio.")

    prompt = (
        "Convierte el texto del usuario en un movimiento financiero. "
        "Devuelve SOLO JSON válido con estas llaves exactas: "
        "type (INGRESO o GASTO), amount (numero positivo), description (string corto), category (string). "
        "Si el texto habla de sueldo, pago recibido, abono, devolución o transferencia entrante, usa type='INGRESO'. "
        "Si no, usa type='GASTO'. "
        "No incluyas markdown ni texto adicional."
    )

    parsed = {}
    try:
        response = await _ai_client.aio.models.generate_content(
            model="models/gemini-2.5-flash-lite",
            contents=f"{prompt}\n\nTexto: {payload.text.strip()}",
        )
        raw = (response.text or "").strip()
        start = raw.find("{")
        end = raw.rfind("}")
        parsed = json.loads(raw[start:end + 1]) if start != -1 and end != -1 else {}
    except Exception as e:
        logger.warning(f"quick_entry AI error: {e}")
        await track_event("finances", "quick_entry", "ai_error", user.id, {"error": str(e)[:120]})
        lower_text = payload.text.lower()
        inferred_type = "INGRESO" if any(word in lower_text for word in ("sueldo", "ingreso", "abono", "pago recibido", "transferencia", "devolucion", "devolución")) else "GASTO"
        parsed = {
            "type": inferred_type,
            "amount": 0,
            "description": payload.text[:80],
            "category": "General",
        }

    tx_type = _normalize_finance_type(parsed.get("type"))
    try:
        amount = float(parsed.get("amount", 0) or 0)
    except Exception:
        amount = 0.0
    if amount < 0:
        amount = abs(amount)
    description = str(parsed.get("description") or payload.text[:80]).strip()[:80]
    category = str(parsed.get("category") or "General").strip()[:40] or "General"

    if amount <= 0:
        fallback = {
            "type": tx_type,
            "amount": 0,
            "description": description or "Revisar movimiento manualmente",
            "category": category,
            "fallback_mode": "manual_review_required",
        }
        await track_event(
            module="finances",
            event="quick_entry",
            status="low_quality",
            user_id=user.id,
            metadata={"type": tx_type, "category": category},
        )
        return fallback

    created = await _insert_finance_row(user.id, {
        "type": tx_type,
        "amount": amount,
        "description": description,
        "category": category,
        "idempotency_key": payload.idempotency_key,
    })
    await track_event(
        module="finances",
        event="quick_entry",
        status="ok",
        user_id=user.id,
        metadata={"type": tx_type, "amount": amount, "category": category},
    )
    return created


@router.delete("/api/v1/finances/{finance_id}")
async def delete_finance(finance_id: str, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("finances").delete().eq("id", finance_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Movimiento")
    return {"detail": "Movimiento eliminado exitosamente"}


@router.put("/api/v1/finances/{finance_id}")
async def update_finance(finance_id: str, payload: FinanceUpdatePayload, user = Depends(get_current_user)):
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise BadRequestException("No hay campos para actualizar.")
    if "type" in update_data:
        tx_type = str(update_data.get("type") or "GASTO").upper()
        update_data["type"] = tx_type if tx_type in ("GASTO", "INGRESO") else "GASTO"
    if "category" in update_data and isinstance(update_data["category"], str) and update_data["category"].startswith("INGRESO:"):
        update_data["category"] = update_data["category"].replace("INGRESO:", "", 1)
        update_data["type"] = "INGRESO"
    if "date" in update_data:
        parsed = _parse_iso_date(update_data["date"])
        if not parsed:
            raise BadRequestException("Fecha inválida (YYYY-MM-DD).")
        update_data["date"] = parsed
    res = await asyncio.to_thread(lambda: supabase.table("finances").update(update_data).eq("id", finance_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Movimiento")
    return {"finance": res.data[0]}


@router.post("/api/v1/finances/parse-receipt")
async def parse_receipt(payload: ReceiptParsePayload, user=Depends(get_current_user)):
    """Parsea un comprobante (imagen) y devuelve datos financieros sugeridos.

    Retorna:
      - type: INGRESO | GASTO
      - amount: float > 0
      - description: str
      - category: str
      - confidence: 0..1
    """
    if not payload.image_base64:
        await track_event("finances", "parse_receipt", "validation_error", user.id, {"reason": "missing_image"})
        raise BadRequestException("La imagen del comprobante es obligatoria.")
    if len(payload.image_base64) > 6_000_000:
        await track_event("finances", "parse_receipt", "validation_error", user.id, {"reason": "image_too_large"})
        raise BadRequestException("La imagen es demasiado grande. Usa una imagen menor a ~4MB.")
    allowed_mimes = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if (payload.mime_type or "image/jpeg").lower() not in allowed_mimes:
        await track_event("finances", "parse_receipt", "validation_error", user.id, {"reason": "invalid_mime", "mime": payload.mime_type})
        raise BadRequestException("Formato de imagen no soportado.")
    if _ai_client is None:
        await track_event("finances", "parse_receipt", "validation_error", user.id, {"reason": "missing_gemini_key"})
        raise BadRequestException("OCR no disponible por ahora. Completa el comprobante manualmente.")

    prompt = (
        "Extrae datos de un comprobante bancario (especialmente BBVA Colombia, QR, tarjeta, PSE, transferencia). "
        "Devuelve SOLO JSON válido con estas llaves exactas: "
        "type (INGRESO o GASTO), amount (numero positivo), description (string corto), "
        "category (string), confidence (0 a 1). "
        "Regla de monto: elige el monto FINAL de la transaccion (TOTAL/VALOR/MONTO). "
        "Ignora saldos, cuotas y numeros de referencia. "
        "Si no puedes leer, usa: type='GASTO', amount=0, description='Comprobante', category='General', confidence=0.2. "
        "No incluyas texto adicional."
    )

    try:
        response = await _ai_client.aio.models.generate_content(
            model="models/gemini-2.5-flash-lite",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": payload.mime_type or "image/jpeg",
                                "data": payload.image_base64,
                            }
                        },
                    ],
                }
            ],
        )
        raw = (response.text or "").strip()
        start = raw.find("{")
        end = raw.rfind("}")
        parsed = json.loads(raw[start:end + 1]) if start != -1 and end != -1 else {}
    except Exception as e:
        logger.warning(f"parse_receipt AI error: {e}")
        await track_event("finances", "parse_receipt", "ai_error", user.id, {"error": str(e)[:120]})
        parsed = {}

    tx_type = str(parsed.get("type", "GASTO")).upper()
    if tx_type not in ("INGRESO", "GASTO"):
        tx_type = "GASTO"
    amount = parsed.get("amount", 0)
    try:
        amount = float(amount)
    except Exception:
        amount = 0.0
    if amount < 0:
        amount = abs(amount)
    description = str(parsed.get("description") or "Comprobante").strip()[:80]
    category = str(parsed.get("category") or "General").strip()[:40]
    confidence = parsed.get("confidence", 0.4)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except Exception:
        confidence = 0.4

    # Reglas BBVA/latam para reforzar categoria cuando venga ambigua
    desc_lower = description.lower()
    if category.lower() in ("general", "otros", "otro", ""):
        if "qr" in desc_lower:
            category = "Transferencia"
        elif "pse" in desc_lower or "transfer" in desc_lower:
            category = "Transferencia"
        elif "tarjeta" in desc_lower or "pos" in desc_lower:
            category = "Compras"
        elif "abono" in desc_lower or "nomina" in desc_lower or "pago recibido" in desc_lower:
            category = "Sueldo" if tx_type == "INGRESO" else "General"

    result = {
        "type": tx_type,
        "amount": amount,
        "description": description or "Comprobante",
        "category": category or "General",
        "confidence": confidence,
    }
    if amount <= 0:
        # Fallback seguro: exige revisión manual en cliente si la IA no extrajo monto válido.
        result["description"] = "Revisar comprobante manualmente"
        result["confidence"] = min(confidence, 0.25)
        result["fallback_mode"] = "manual_review_required"
    await track_event(
        "finances",
        "parse_receipt",
        "ok" if amount > 0 else "low_quality",
        user.id,
        {"confidence": confidence, "type": tx_type, "category": category, "amount": amount},
    )
    return result
