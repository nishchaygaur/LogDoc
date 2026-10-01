# LogDoc Launcher PowerShell Script
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "            LogDoc Enterprise Suite                " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Virtual environment not found. Please setup .venv first."
    exit 1
}

Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/k", ".venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

Write-Host "Starting Frontend on http://localhost:3000..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd frontend && npm run dev" -PassThru

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host "`nLogDoc is running!" -ForegroundColor Cyan
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor White
Write-Host "API Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
