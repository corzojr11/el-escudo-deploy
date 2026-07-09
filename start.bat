@echo off
setlocal

title EL ESCUDO - Launcher Actualizado
color 0A

echo.
echo  =====================================================
echo   EL ESCUDO - Launcher Actualizado
echo  =====================================================
echo.

echo  [0/3] Cerrando puertos en uso (8081 y 8001)...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":8081" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":8001" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)

echo  [1/3] Iniciando Backend FastAPI en puerto 8001...
start "EL ESCUDO - Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8001 --env-file .env"

timeout /t 3 /nobreak >nul

echo  [2/3] Iniciando App Expo Web en puerto 8081...
start "EL ESCUDO - App" cmd /k "cd /d "%~dp0el-escudo" && npx expo start --web --port 8081 --clear"

timeout /t 5 /nobreak >nul

echo  [3/3] Abriendo app en navegador...
start "" "http://localhost:8081"

echo.
echo  =====================================================
echo   Servicios iniciados
echo.
echo   App Web       ->  http://localhost:8081
echo   API REST      ->  http://localhost:8001
echo   Swagger       ->  http://localhost:8001/docs
echo  =====================================================
echo.

endlocal
