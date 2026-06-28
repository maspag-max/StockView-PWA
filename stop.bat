@echo off
echo Stopping StockView...

REM --- Backend (port 8000) ---
REM uvicorn --reload spawns: launcher -> reloader -> worker(port)
REM We walk 2 levels up from the port and kill the launcher tree.
for /f "tokens=5" %%W in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING" 2^>nul') do (
    for /f "tokens=2 delims==" %%R in ('wmic process where "ProcessId=%%W" get ParentProcessId /value 2^>nul ^| findstr "="') do (
        for /f "tokens=2 delims==" %%L in ('wmic process where "ProcessId=%%R" get ParentProcessId /value 2^>nul ^| findstr "="') do (
            echo Terminating backend tree (PID %%L)
            taskkill /f /t /pid %%L >nul 2>&1
        )
    )
)

REM --- Frontend (port 5173) ---
REM npm run dev spawns: npm(node) -> cmd -> vite(node,port)
REM Same: walk 2 levels up and kill the npm node tree.
for /f "tokens=5" %%W in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING" 2^>nul') do (
    for /f "tokens=2 delims==" %%R in ('wmic process where "ProcessId=%%W" get ParentProcessId /value 2^>nul ^| findstr "="') do (
        for /f "tokens=2 delims==" %%L in ('wmic process where "ProcessId=%%R" get ParentProcessId /value 2^>nul ^| findstr "="') do (
            echo Terminating frontend tree (PID %%L)
            taskkill /f /t /pid %%L >nul 2>&1
        )
    )
)

echo Done. Close the terminal windows manually.
pause
