@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Synchronisation des sources pokeemerald (sans ROM) ===
where py >nul 2>&1
if not errorlevel 1 (
    py -3 sync_pokeemerald.py
    if errorlevel 1 goto :syncfailed
    py -3 pack_site.py
) else (
    python sync_pokeemerald.py
    if errorlevel 1 goto :syncfailed
    python pack_site.py
)
echo.
echo Copiez BattleTower_S22_SansInstallation.html sur votre Galaxy S22.
echo Ou publiez le dossier site/ sur un hebergement HTTPS pour une PWA.
pause
exit /b 0
:syncfailed
echo La synchronisation a echoue : la version existante reste disponible.
pause
exit /b 1
