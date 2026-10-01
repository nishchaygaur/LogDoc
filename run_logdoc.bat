@echo off
title LogDoc - Intelligent Log Analyzer
echo ===================================================
echo             LogDoc Enterprise Suite
echo ===================================================
echo Starting LogDoc backend and frontend services...

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found. Please run:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

echo [1/2] Starting FastAPI backend on http://127.0.0.1:8000 ...
start "LogDoc Backend" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting Vite Frontend on http://localhost:3000 ...
start "LogDoc Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 3 >nul
start http://localhost:3000
echo.
echo LogDoc is now running!
echo Access the UI at: http://localhost:3000
echo Backend API docs at: http://127.0.0.1:8000/docs
echo ===================================================
