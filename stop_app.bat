@echo off
title Stopping Jayden Photo Scrapper AI
color 0C

echo.
echo ============================================================
echo   Stopping Jayden Photo Scrapper AI
echo ============================================================
echo.

REM Find and kill the uvicorn process on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
    echo Stopped backend server (PID: %%a)
)

REM Also kill any Python processes running uvicorn for this app
taskkill /F /FI "WINDOWTITLE eq Jayden Photo Scrapper AI - Backend*" >nul 2>&1

echo.
echo All servers stopped.
echo ============================================================
timeout /t 2 /nobreak >nul