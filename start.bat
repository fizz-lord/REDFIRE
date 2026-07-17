@echo off
cd /d "%~dp0"
title REDFIRE
echo Starting REDFIRE...

:: Start backend
echo [1/3] Starting backend (uvicorn) on port 8000...
start "REDFIRE Backend" /min cmd /c "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Wait for backend
timeout /t 4 /nobreak > nul

:: Start frontend
echo [2/3] Starting frontend (Vite) on port 5173...
start "REDFIRE Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

:: Wait for frontend
timeout /t 6 /nobreak > nul

:: Open browser
echo [3/3] Opening REDFIRE in your browser...
start "" "http://localhost:5173"

:: Auto-close
timeout /t 2 /nobreak > nul
exit
