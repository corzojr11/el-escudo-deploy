@echo off
setlocal
cd /d "%~dp0"

set "PORT=8081"
set "LOG_DIR=%~dp0logs"
set "LOG_FILE=%LOG_DIR%\iniciar-web.log"

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo Iniciando EL ESCUDO...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = %PORT%; " ^
  "$ready = $false; " ^
  "try { $r = Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:' + $port) -TimeoutSec 2; $ready = $true } catch {} " ^
  "if (-not $ready) { " ^
  "  Start-Process -WindowStyle Minimized -FilePath cmd.exe -ArgumentList '/c', 'npm run web ^> \"%LOG_FILE%\" 2^>^&1'; " ^
  "  for ($i = 0; $i -lt 60; $i++) { " ^
  "    Start-Sleep -Seconds 2; " ^
  "    try { Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:' + $port) -TimeoutSec 2 | Out-Null; $ready = $true; break } catch {} " ^
  "  } " ^
  "} " ^
  "if ($ready) { Start-Process ('http://localhost:' + $port) } else { Write-Host 'No se pudo abrir la app. Revisa el log en %LOG_FILE%'; exit 1 }"

if errorlevel 1 (
  echo No se pudo iniciar la app.
  echo Revisa el log en: %LOG_FILE%
  pause
  exit /b 1
)

endlocal
