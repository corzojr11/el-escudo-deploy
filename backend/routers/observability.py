import asyncio
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from database import supabase

router = APIRouter()


@router.get('/api/v1/observability/summary')
async def get_observability_summary(
    user=Depends(get_current_user),
    days: int = Query(7, ge=1, le=30),
):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        res = await asyncio.to_thread(
            lambda: supabase
            .table('observability_events')
            .select('module,event,status,metadata,created_at')
            .eq('user_id', user.id)
            .gte('created_at', since)
            .execute()
        )
    except Exception:
        return {
            'range_days': days,
            'total_events': 0,
            'by_module': {},
            'by_status': {},
            'by_event': {},
            'scan_low_confidence': 0,
            'scan_failures': 0,
        }

    events = res.data or []
    by_module = Counter()
    by_status = Counter()
    by_event = Counter()

    low_confidence_scans = 0
    parse_failures = 0

    for e in events:
        by_module[e.get('module') or 'unknown'] += 1
        by_status[e.get('status') or 'unknown'] += 1
        key = f"{e.get('module')}.{e.get('event')}"
        by_event[key] += 1

        if e.get('module') == 'finances' and e.get('event') == 'parse_receipt':
            meta = e.get('metadata') or {}
            conf = meta.get('confidence')
            try:
                if conf is not None and float(conf) < 0.55:
                    low_confidence_scans += 1
            except Exception:
                pass
            if (e.get('status') or '').lower() != 'ok':
                parse_failures += 1

    return {
        'range_days': days,
        'total_events': len(events),
        'by_module': dict(by_module),
        'by_status': dict(by_status),
        'by_event': dict(by_event),
        'scan_low_confidence': low_confidence_scans,
        'scan_failures': parse_failures,
    }


@router.get('/api/v1/observability/alerts')
async def get_observability_alerts(
    user=Depends(get_current_user),
    hours: int = Query(24, ge=1, le=168),
):
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    try:
        res = await asyncio.to_thread(
            lambda: supabase
            .table('observability_events')
            .select('module,event,status,created_at')
            .eq('user_id', user.id)
            .gte('created_at', since)
            .execute()
        )
    except Exception:
        return {"range_hours": hours, "alerts": [], "has_critical": False}

    events = res.data or []
    alerts = []

    sync_total = 0
    sync_errors = 0
    receipt_total = 0
    receipt_ai_errors = 0
    receipt_low_quality = 0

    for e in events:
        module = e.get("module")
        event = e.get("event")
        status = (e.get("status") or "").lower()
        if module == "sync" and event == "hydrate":
            sync_total += 1
            if status == "error":
                sync_errors += 1
        if module == "finances" and event == "parse_receipt":
            receipt_total += 1
            if status == "ai_error":
                receipt_ai_errors += 1
            if status == "low_quality":
                receipt_low_quality += 1

    if sync_total >= 5 and (sync_errors / sync_total) >= 0.30:
        alerts.append({
            "level": "critical",
            "code": "SYNC_ERROR_RATE_HIGH",
            "message": f"Tasa de error en sync elevada ({sync_errors}/{sync_total}).",
        })
    if receipt_total >= 5 and (receipt_ai_errors / receipt_total) >= 0.25:
        alerts.append({
            "level": "warning",
            "code": "RECEIPT_AI_ERROR_RATE_HIGH",
            "message": f"Fallo frecuente en IA de comprobantes ({receipt_ai_errors}/{receipt_total}).",
        })
    if receipt_total >= 5 and (receipt_low_quality / receipt_total) >= 0.40:
        alerts.append({
            "level": "warning",
            "code": "RECEIPT_LOW_QUALITY_HIGH",
            "message": f"Muchos comprobantes requieren revisión manual ({receipt_low_quality}/{receipt_total}).",
        })

    has_critical = any(a["level"] == "critical" for a in alerts)
    return {
        "range_hours": hours,
        "alerts": alerts,
        "has_critical": has_critical,
        "stats": {
            "sync_total": sync_total,
            "sync_errors": sync_errors,
            "receipt_total": receipt_total,
            "receipt_ai_errors": receipt_ai_errors,
            "receipt_low_quality": receipt_low_quality,
        },
    }
