@echo off
start "StockView Backend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0backend'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload"
start "StockView Frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0frontend'; npm run dev"
