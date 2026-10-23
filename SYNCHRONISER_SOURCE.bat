@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
  py -3 sync_pokeemerald.py && py -3 pack_site.py
) else (
  python sync_pokeemerald.py && python pack_site.py
)
pause
