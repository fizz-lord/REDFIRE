@echo off
title REDFIRE - Shutdown
cd /d "%~dp0"

echo.
echo   // REDFIRE \\  Shutting down...
echo.

REM Kill uvicorn backend processes
echo   [*] Stopping backend...
taskkill /f /im python.exe /fi "WINDOWTITLE eq uvicorn*" 2>nul
taskkill /f /im pythonw.exe /fi "WINDOWTITLE eq uvicorn*" 2>nul

REM Kill node/vite frontend processes
echo   [*] Stopping frontend...
taskkill /f /im node.exe /fi "WINDOWTITLE eq vite*" 2>nul

REM Also kill by port
echo   [*] Releasing ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    taskkill /f /pid %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /f /pid %%a 2>nul
)

del launch_status.txt 2>nul

echo.
echo   [v] REDFIRE stopped. You can close this window.
echo.
timeout /t 3 /nobreak >nul
