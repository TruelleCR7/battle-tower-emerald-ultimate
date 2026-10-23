@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Ouverture de Battle Tower sur le reseau local...
where py >nul 2>&1
if not errorlevel 1 (
    py -3 server.py --lan
) else (
    python server.py --lan
)
pause
