@echo off
setlocal EnableDelayedExpansion
title StockView - Setup

echo.
echo ============================================================
echo   StockView - Setup automatico
echo ============================================================
echo.
echo Questo script installa tutto il necessario per far girare
echo StockView sul tuo PC. Tempo richiesto: 5-10 minuti.
echo.
echo Prerequisiti (devono essere gia' installati):
echo   - Python 3.11+
echo   - Node.js 20+
echo   - Git
echo.
pause

REM ============================================================
REM Step 1: Verifica prerequisiti
REM ============================================================
echo.
echo [1/6] Verifica prerequisiti...
echo.

set MISSING=0

where python >nul 2>&1
if errorlevel 1 (
    echo   [X] Python NON trovato
    set MISSING=1
) else (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do (
        echo   [OK] Python %%v
    )
)

where node >nul 2>&1
if errorlevel 1 (
    echo   [X] Node.js NON trovato
    set MISSING=1
) else (
    for /f %%v in ('node --version 2^>^&1') do (
        echo   [OK] Node.js %%v
    )
)

where npm >nul 2>&1
if errorlevel 1 (
    echo   [X] npm NON trovato
    set MISSING=1
) else (
    for /f %%v in ('npm --version 2^>^&1') do (
        echo   [OK] npm %%v
    )
)

where git >nul 2>&1
if errorlevel 1 (
    echo   [X] Git NON trovato
    set MISSING=1
) else (
    for /f "tokens=3" %%v in ('git --version 2^>^&1') do (
        echo   [OK] Git %%v
    )
)

if !MISSING! equ 1 (
    echo.
    echo ============================================================
    echo   ERRORE: uno o piu' prerequisiti non sono installati.
    echo ============================================================
    echo.
    echo   Installa cio' che manca e rilancia setup.bat:
    echo     Python: https://www.python.org/downloads/
    echo             ^(IMPORTANTE: spunta "Add Python to PATH"^)
    echo     Node.js: https://nodejs.org/  ^(versione LTS^)
    echo     Git:     https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM Step 2: Verifica posizione
REM ============================================================
echo.
echo [2/6] Verifica struttura progetto...
echo.

if not exist "%~dp0backend\pyproject.toml" (
    echo   [X] Non trovo backend\pyproject.toml
    echo       Stai eseguendo setup.bat dalla cartella sbagliata.
    echo       Lancialo dalla cartella stockview che hai clonato.
    echo.
    pause
    exit /b 1
)
if not exist "%~dp0frontend\package.json" (
    echo   [X] Non trovo frontend\package.json
    echo       Stai eseguendo setup.bat dalla cartella sbagliata.
    echo.
    pause
    exit /b 1
)
echo   [OK] Struttura progetto corretta

REM ============================================================
REM Step 3: Setup backend (venv + dipendenze)
REM ============================================================
echo.
echo [3/6] Creazione ambiente virtuale Python...
echo       ^(puo' richiedere 30-60 secondi^)
echo.

cd /d "%~dp0backend"

if exist ".venv" (
    echo   [INFO] Ambiente virtuale gia' esistente, lo riuso
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo   [X] Errore nella creazione del venv
        echo       Verifica che Python sia installato correttamente.
        echo.
        pause
        exit /b 1
    )
    echo   [OK] Ambiente virtuale creato
)

echo.
echo [4/6] Installazione librerie Python backend...
echo       ^(puo' richiedere 2-5 minuti, dipende dalla connessione^)
echo.

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -e . --quiet
if errorlevel 1 (
    echo.
    echo   [X] Errore nell'installazione delle dipendenze Python
    echo       Verifica la connessione internet e riprova.
    echo       Se sei in azienda con proxy, configura prima:
    echo         set HTTP_PROXY=http://proxy.azienda.it:8080
    echo         set HTTPS_PROXY=http://proxy.azienda.it:8080
    echo.
    pause
    exit /b 1
)
echo   [OK] Backend installato

REM ============================================================
REM Step 4: Setup frontend (npm install)
REM ============================================================
echo.
echo [5/6] Installazione librerie Node.js frontend...
echo       ^(puo' richiedere 3-5 minuti, dipende dalla connessione^)
echo.

cd /d "%~dp0frontend"
call npm install --silent
if errorlevel 1 (
    echo.
    echo   [X] Errore nell'installazione delle dipendenze Node
    echo       Verifica la connessione internet e riprova.
    echo.
    pause
    exit /b 1
)
echo   [OK] Frontend installato

REM ============================================================
REM Step 5: Setup file .env
REM ============================================================
echo.
echo [6/6] Preparazione file di configurazione...
echo.

cd /d "%~dp0"

set ENV_CREATED=0

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo   [OK] Creato .env nella root
        set ENV_CREATED=1
    ) else (
        echo   [X] File .env.example non trovato
    )
) else (
    echo   [INFO] .env nella root gia' esistente, NON sovrascritto
)

if not exist "backend\.env" (
    if exist ".env" (
        copy ".env" "backend\.env" >nul
        echo   [OK] Creato backend\.env
    )
) else (
    echo   [INFO] backend\.env gia' esistente, NON sovrascritto
)

REM ============================================================
REM Finale
REM ============================================================
echo.
echo ============================================================
echo   SETUP TECNICO COMPLETATO!
echo ============================================================
echo.

if !ENV_CREATED! equ 1 (
    echo   ATTENZIONE: prima di poter usare StockView devi ancora:
    echo.
    echo   1. Registrarti gratis su Finnhub:
    echo      https://finnhub.io
    echo      ^(ottieni la API key dalla dashboard^)
    echo.
    echo   2. Registrarti gratis su Supabase:
    echo      https://supabase.com
    echo      - Crea un nuovo progetto chiamato "stockview"
    echo      - Esegui lo schema SQL: copia il contenuto di
    echo        supabase\schema.sql nell'SQL Editor di Supabase
    echo        e premi Run
    echo      - Prendi URL e service_role key da Project Settings
    echo.
    echo   3. Modifica il file .env con il Blocco Note:
    echo      Sostituisci i ... dopo:
    echo        FINNHUB_API_KEY=
    echo        SUPABASE_URL=
    echo        SUPABASE_KEY=
    echo      Con le tue chiavi reali.
    echo.
    echo   4. Copia la stessa configurazione anche in backend\.env
    echo      ^(o ricopia il .env aggiornato sopra il vecchio^)
    echo.
    echo   5. Solo a quel punto lancia start.bat per avviare l'app.
    echo.
    echo   Per i dettagli completi vedi:
    echo   StockView_Guida_Installazione.docx ^(Fasi 3-4^)
    echo.
) else (
    echo   File .env gia' configurato. Per avviare l'app:
    echo     - Doppio click su start.bat
    echo     - Apri il browser su http://localhost:5173
    echo.
)

pause
endlocal