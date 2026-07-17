@echo off
cd /d "%~dp0"
echo Starting REDFIRE...
echo.

:: Start backend
echo [1/2] Starting backend (uvicorn) on port 8000...
start "REDFIRE Backend" /min cmd /c "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Wait for backend to start
timeout /t 3 /nobreak > nul

:: Start frontend
echo [2/2] Starting frontend (Vite) on port 5173...
start "REDFIRE Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both services started:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo.
echo Close this window to leave both running, or press any key to close.
pause > nul
