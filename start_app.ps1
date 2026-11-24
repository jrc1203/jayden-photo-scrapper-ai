#!/usr/bin/env pwsh
# Jayden Photo Scrapper AI - One-Click Launcher (PowerShell)
# Right-click this file and select "Run with PowerShell"

param()

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $AppDir

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  Jayden Photo Scrapper AI - One-Click Launcher" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green

# Check if frontend is built
if (-not (Test-Path "frontend\dist\index.html")) {
    Write-Host "[1/6] Building frontend (first time only)..." -ForegroundColor Yellow
    Set-Location "frontend"
    npm install
    npm run build
    Set-Location $AppDir
    Write-Host ""
}

# Check if backend venv exists
if (-not (Test-Path "backend\venv\Scripts\Activate.ps1")) {
    Write-Host "[2/6] Setting up Python virtual environment..." -ForegroundColor Yellow
    Set-Location "backend"
    python -m venv venv
    & "venv\Scripts\Activate.ps1"
    # dlib's bundled pybind11 uses pre-3.5 CMake policies; CMake 4 needs this compatibility floor.
    $env:CMAKE_POLICY_VERSION_MINIMUM = "3.5"
    pip install -r requirements.txt
    Set-Location $AppDir
    Write-Host ""
}

Write-Host "[3/6] Running backend security and API checks..." -ForegroundColor Yellow
Push-Location (Join-Path $AppDir "backend")
& ".\venv\Scripts\python.exe" -m pytest -q tests
$securityCheckResult = $LASTEXITCODE
Pop-Location
if ($securityCheckResult -ne 0) {
    Write-Host "The security checks failed. The backend was not started." -ForegroundColor Red
    exit 1
}

Write-Host "[4/6] Starting backend server..." -ForegroundColor Yellow

$portListener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portListener) {
    Write-Host "Port 8000 is already in use by process $($portListener.OwningProcess). Close that server window, then run this launcher again." -ForegroundColor Red
    exit 1
}

# Start backend in a new window
try {
    $backendCommand = "title Jayden Photo Scrapper AI - Backend && cd /d `"$AppDir\backend`" && call venv\Scripts\Activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers"
    $backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $backendCommand -PassThru -ErrorAction Stop
} catch {
    Write-Host "Could not start the backend: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait until the backend health endpoint responds
Write-Host "[5/6] Waiting for server to start..." -ForegroundColor Yellow
$backendReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
        if ($health.status -eq "healthy") {
            $backendReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $backendReady) {
    Write-Host "The backend did not become healthy. Check the Backend command window for its error." -ForegroundColor Red
    if ($backendProcess) { & taskkill.exe /PID $backendProcess.Id /T /F | Out-Null }
    exit 1
}

Write-Host "[6/6] Checking frontend and gallery API..." -ForegroundColor Yellow
& (Join-Path $AppDir "backend\venv\Scripts\python.exe") (Join-Path $AppDir "backend\scripts\startup_check.py") --base-url "http://127.0.0.1:8000"
if ($LASTEXITCODE -ne 0) {
    Write-Host "The startup check failed. Stopping the backend started by this launcher." -ForegroundColor Red
    if ($backendProcess) { & taskkill.exe /PID $backendProcess.Id /T /F | Out-Null }
    exit 1
}

# Open browser
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  Starting Jayden Photo Scrapper AI..." -ForegroundColor Green
Write-Host "  Opening http://localhost:8000 in your browser" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green

Start-Process "http://localhost:8000"

Write-Host "The application is now running!" -ForegroundColor Cyan
Write-Host ""
Write-Host "- Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "- API Docs:    http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host "- Frontend:    http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the 'Backend' command window to stop the server." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green

Read-Host "Press Enter to exit this launcher (backend will keep running)"
