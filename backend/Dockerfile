FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Crear usuario y grupo de sistema no-root
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY . .

# Asignar la propiedad al usuario no-root
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Healthcheck nativo sin curl/wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
