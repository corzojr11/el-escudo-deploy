# ╔══════════════════════════════════════════════════════════════╗
# ║         EL ESCUDO — Cloud OS — Developer Makefile            ║
# ╚══════════════════════════════════════════════════════════════╝

.PHONY: help install test test-cov lint build-web dev-backend dev-web clean

PYTHON  = backend/venv/Scripts/python.exe
PIP     = backend/venv/Scripts/pip.exe
PYTEST  = $(PYTHON) -m pytest

## ── Ayuda ────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  EL ESCUDO — Comandos disponibles:"
	@echo ""
	@echo "  make install        Instala dependencias backend y frontend"
	@echo "  make test           Corre todos los tests del backend (46 tests)"
	@echo "  make test-cov       Tests con reporte de cobertura HTML"
	@echo "  make lint           Verifica sintaxis Python de archivos clave"
	@echo "  make build-web      Build de producción del frontend Vite"
	@echo "  make dev-backend    Inicia el servidor FastAPI en modo desarrollo"
	@echo "  make dev-web        Inicia el servidor Vite en modo desarrollo"
	@echo "  make clean          Elimina artefactos de build y cache"
	@echo ""

## ── Instalación ──────────────────────────────────────────────────
install:
	@echo "[backend] Instalando dependencias Python..."
	cd backend && $(PIP) install -r requirements.txt
	@echo "[frontend] Instalando dependencias Node..."
	cd el-escudo-web && npm install
	@echo "✅ Instalación completa."

## ── Tests ────────────────────────────────────────────────────────
test:
	@echo "[backend] Corriendo suite de 46 tests..."
	cd backend && $(PYTEST) tests/ -v --tb=short

test-cov:
	@echo "[backend] Tests con reporte de cobertura..."
	cd backend && $(PYTEST) tests/ --cov=. --cov-report=term-missing --cov-report=html:htmlcov -q
	@echo "✅ Reporte HTML en backend/htmlcov/index.html"

## ── Lint ─────────────────────────────────────────────────────────
lint:
	@echo "[backend] Verificando sintaxis Python..."
	$(PYTHON) -m py_compile backend/main.py backend/auth.py backend/database.py
	@echo "✅ Sintaxis OK"

## ── Build ────────────────────────────────────────────────────────
build-web:
	@echo "[frontend] Build de producción Vite..."
	cd el-escudo-web && npm run build
	@echo "✅ Build en el-escudo-web/dist/"

## ── Desarrollo ───────────────────────────────────────────────────
dev-backend:
	@echo "[backend] Iniciando FastAPI en http://localhost:8000 ..."
	cd backend && $(PYTHON) -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	@echo "[frontend] Iniciando Vite en http://localhost:5173 ..."
	cd el-escudo-web && npm run dev

## ── Limpieza ─────────────────────────────────────────────────────
clean:
	@echo "Limpiando artefactos..."
	rd /s /q el-escudo-web\dist 2>nul || true
	rd /s /q backend\htmlcov 2>nul || true
	rd /s /q backend\.pytest_cache 2>nul || true
	del /q backend\.coverage 2>nul || true
	@echo "✅ Limpieza completa."
