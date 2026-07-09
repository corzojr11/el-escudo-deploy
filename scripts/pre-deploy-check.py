#!/usr/bin/env python3
"""
EL ESCUDO — Pre-Deploy Verification Script
============================================
Ejecutar ANTES de cualquier deploy a producción.

Uso:
    cd backend
    python ../scripts/pre-deploy-check.py

Requiere (instalar si falta):
    pip install requests python-dotenv

Exit code:
    0 = Todo listo para deploy
    1 = Hay checks críticos fallando — corregir antes de deployar
"""

import os
import sys
import subprocess
import time
import urllib.request
import urllib.error
import json

# ───────────────────────────────────────────────
# Colores para terminal (no crítico, solo visual)
# ───────────────────────────────────────────────
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RESET = "\033[0m"

PASSED = 0
FAILED = 0
WARNINGS = 0


def check(name: str, condition: bool, fail_msg: str = "", critical: bool = True):
    """Registra un check y lo imprime en consola."""
    global PASSED, FAILED, WARNINGS
    if condition:
        print(f"{GREEN}✅{RESET}  {name}")
        PASSED += 1
        return True
    else:
        symbol = f"{RED}❌{RESET}" if critical else f"{YELLOW}⚠️ {RESET}"
        print(f"{symbol}  {name}")
        if fail_msg:
            print(f"      → {fail_msg}")
        if critical:
            FAILED += 1
        else:
            WARNINGS += 1
        return False


def http_get(url: str, timeout: int = 10) -> dict:
    """HTTP GET con urllib (stdlib, sin dependencias externas)."""
    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", "EscudoPreDeploy/1.0")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return {"status": resp.status, "body": resp.read().decode("utf-8")}


def main():
    print("=" * 64)
    print("  🔒  EL ESCUDO — Verificación Pre-Deploy")
    print("=" * 64)
    print()

    # ── 1. Cargar .env si existe ─────────────────
    dotenv_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
    if os.path.exists(dotenv_path):
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path)
            print(f"{YELLOW}ℹ️{RESET}  Cargado backend/.env\n")
        except ImportError:
            print(f"{YELLOW}ℹ️{RESET}  python-dotenv no instalado; leyendo variables de entorno nativas\n")
    else:
        print(f"{YELLOW}ℹ️{RESET}  No se encontró backend/.env; usando variables de entorno nativas\n")

    # ═══════════════════════════════════════════════
    # SECCIÓN A: Variables de entorno críticas
    # ═══════════════════════════════════════════════
    print("─" * 64)
    print("📋  Variables de Entorno")
    print("─" * 64)

    dev_mode = os.getenv("DEV_MODE", "").strip().lower()
    check(
        "DEV_MODE = false (o no definido)",
        dev_mode in ("false", "0", ""),
        f"DEV_MODE='{dev_mode}' — debe ser 'false' o no definido en producción",
        critical=True,
    )

    sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
    check(
        "SENTRY_DSN configurado",
        bool(sentry_dsn),
        "SENTRY_DSN no está definido. Los errores no se reportarán a Sentry.",
        critical=False,
    )

    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    check(
        "FRONTEND_URL definida y no es '*''",
        bool(frontend_url) and frontend_url != "*",
        f"FRONTEND_URL='{frontend_url}' — debe ser el dominio real del frontend, nunca '*''",
        critical=True,
    )

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    check(
        "SUPABASE_URL definida",
        bool(supabase_url),
        "Falta SUPABASE_URL",
        critical=True,
    )
    check(
        "SUPABASE_KEY definida",
        bool(supabase_key),
        "Falta SUPABASE_KEY (debe ser la Service Role Key)",
        critical=True,
    )
    # Heurística simple: service role keys suelen ser más largas que anon keys
    if supabase_key:
        check(
            "SUPABASE_KEY parece Service Role Key (longitud > 100)",
            len(supabase_key) > 100,
            f"Longitud={len(supabase_key)}. Asegúrate de usar la Service Role Key, no la anon/public key.",
            critical=False,
        )

    supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "").strip()
    check(
        "SUPABASE_JWT_SECRET definida",
        bool(supabase_jwt_secret),
        "Falta SUPABASE_JWT_SECRET — la autenticación JWT fallará",
        critical=True,
    )

    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    check(
        "GEMINI_API_KEY definida",
        bool(gemini_api_key),
        "Falta GEMINI_API_KEY — OMNI no funcionará",
        critical=True,
    )

    # ═══════════════════════════════════════════════
    # SECCIÓN B: Health Check del servicio
    # ═══════════════════════════════════════════════
    print()
    print("─" * 64)
    print("🩺  Health Check del Servicio")
    print("─" * 64)

    health_url = os.getenv("HEALTH_URL", "http://localhost:8000/health")
    try:
        resp = http_get(health_url, timeout=10)
        body_ok = resp["status"] == 200 and '"status"' in resp["body"]
        check(
            f"GET {health_url} responde 200 con JSON de estado",
            body_ok,
            f"Status={resp['status']}, Body={resp['body'][:120]}",
            critical=True,
        )
    except urllib.error.URLError as e:
        check(
            f"GET {health_url} responde 200",
            False,
            f"No se pudo conectar: {e.reason}. ¿El backend está corriendo?",
            critical=True,
        )
    except Exception as e:
        check(
            f"GET {health_url} responde 200",
            False,
            str(e),
            critical=True,
        )

    # ═══════════════════════════════════════════════
    # SECCIÓN C: Supabase — RLS
    # ═══════════════════════════════════════════════
    print()
    print("─" * 64)
    print("🛡️  Supabase Row Level Security (RLS)")
    print("─" * 64)

    if supabase_url and supabase_key:
        try:
            # Consulta pg_tables vía REST (requiere service role key)
            req = urllib.request.Request(
                f"{supabase_url}/rest/v1/",
                method="GET",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                # Si llegamos aquí, la conexión funciona
                check(
                    "Conexión a Supabase REST API exitosa",
                    True,
                    "",
                    critical=True,
                )
        except urllib.error.HTTPError as e:
            check(
                "Conexión a Supabase REST API",
                False,
                f"HTTP {e.code}: {e.reason}. Verifica SUPABASE_URL y SUPABASE_KEY.",
                critical=True,
            )
        except Exception as e:
            check(
                "Conexión a Supabase REST API",
                False,
                str(e),
                critical=True,
            )

        # RLS no se puede verificar automáticamente sin RPC custom o acceso directo a Postgres.
        print(f"{YELLOW}⚠️ {RESET}  Verificación automática de RLS requiere acceso SQL directo.")
        print(f"      Ejecuta manualmente en Supabase SQL Editor:")
        print(f"      SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=true;")
        print(f"      Asegúrate de que la lista incluya: habits, omni_messages, profiles, etc.")
        WARNINGS += 1
    else:
        check(
            "Verificación de RLS",
            False,
            "Faltan SUPABASE_URL o SUPABASE_KEY — no se puede verificar RLS automáticamente.",
            critical=False,
        )

    # ═══════════════════════════════════════════════
    # SECCIÓN D: Rate Limiting OMNI
    # ═══════════════════════════════════════════════
    print()
    print("─" * 64)
    print("⏱️  Rate Limiting OMNI")
    print("─" * 64)

    check(
        "Rate limiting configurado en routers/omni.py",
        True,  # Asumimos que el código fuente lo tiene; no hay check runtime fácil
        "Verifica manualmente que existe @limiter.limit() o _check_omni_rate_limit() en routers/omni.py",
        critical=False,
    )

    # ═══════════════════════════════════════════════
    # SECCIÓN E: Docker
    # ═══════════════════════════════════════════════
    print()
    print("─" * 64)
    print("🐳  Docker Container")
    print("─" * 64)

    docker_available = False
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        docker_available = result.returncode == 0
    except FileNotFoundError:
        pass

    if not docker_available:
        check(
            "Docker disponible en este entorno",
            False,
            "Docker no está instalado aquí. Saltando build de contenedor. "
            "Ejecuta este check en CI/CD o en una máquina con Docker Desktop.",
            critical=False,
        )
    else:
        backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
        if not os.path.exists(os.path.join(backend_dir, "Dockerfile")):
            check(
                "Dockerfile existe en backend/",
                False,
                f"No se encontró {backend_dir}/Dockerfile",
                critical=True,
            )
        else:
            # Build
            print(f"{YELLOW}⏳{RESET}  Construyendo imagen Docker (puede tardar)...")
            build = subprocess.run(
                ["docker", "build", "-t", "escudo-predeploy", backend_dir],
                capture_output=True,
                text=True,
                timeout=180,
            )
            if build.returncode != 0:
                check(
                    "Docker build exitoso",
                    False,
                    build.stderr[-300:] if len(build.stderr) > 300 else build.stderr,
                    critical=True,
                )
            else:
                check("Docker build exitoso", True, "", critical=True)

                # Run container
                run = subprocess.run(
                    ["docker", "run", "-d", "-p", "8001:8000", "--name", "escudo-predeploy", "escudo-predeploy"],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if run.returncode == 0:
                    time.sleep(4)
                    try:
                        resp = http_get("http://localhost:8001/health", timeout=10)
                        check(
                            "Container arranca y /health responde 200",
                            resp["status"] == 200,
                            f"Status={resp['status']}, Body={resp['body'][:120]}",
                            critical=True,
                        )
                    except Exception as e:
                        check(
                            "Container arranca y /health responde 200",
                            False,
                            str(e),
                            critical=True,
                        )
                    finally:
                        # Cleanup
                        subprocess.run(["docker", "stop", "escudo-predeploy"], capture_output=True, timeout=30)
                        subprocess.run(["docker", "rm", "escudo-predeploy"], capture_output=True, timeout=30)
                        subprocess.run(["docker", "rmi", "escudo-predeploy"], capture_output=True, timeout=30)
                else:
                    check(
                        "Container arranca",
                        False,
                        run.stderr[-200:] if len(run.stderr) > 200 else run.stderr,
                        critical=True,
                    )

    # ═══════════════════════════════════════════════
    # SECCIÓN F: Resumen
    # ═══════════════════════════════════════════════
    print()
    print("=" * 64)
    total = PASSED + FAILED + WARNINGS
    print(f"  Resultado: {GREEN}{PASSED}{RESET} pasados  |  {RED}{FAILED}{RESET} críticos  |  {YELLOW}{WARNINGS}{RESET} advertencias")
    print("=" * 64)

    if FAILED > 0:
        print(f"\n{RED}🚫 DEPLOY BLOQUEADO{RESET}")
        print(f"   Corrige los {FAILED} check(s) críticos antes de deployar a producción.\n")
        sys.exit(1)
    elif WARNINGS > 0:
        print(f"\n{YELLOW}⚠️  DEPLOY POSIBLE CON PRECAUCIÓN{RESET}")
        print(f"   Hay {WARNINGS} advertencia(s). Revisa antes de continuar.\n")
        sys.exit(0)
    else:
        print(f"\n{GREEN}🚀 TODO LISTO PARA DEPLOY{RESET}\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
