@echo off
title Ideaboard
color 0A

cd /d "%~dp0"
set SCRIPT_PATH=%~dp0launch-ideaboard.bat
set SHORTCUT_DESKTOP=%USERPROFILE%\Desktop\Ideaboard.lnk
set SHORTCUT_START=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ideaboard.lnk

echo.
echo  =============================
echo    Ideaboard - Starting up...
echo  =============================
echo.

:: ── Offer to create shortcuts on first run ───────────────────────────────────
if not exist "%SHORTCUT_DESKTOP%" (
    echo  Tip: Add Ideaboard as a shortcut for easy access.
    set /p CREATE_SHORTCUT= Create Desktop ^& Start Menu shortcut now? [y/N]:
    if /i "%CREATE_SHORTCUT%"=="y" (
        call :create_shortcuts
    )
    echo.
)

:: ── Check Node.js ─────────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo  Download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Install packages on first run ─────────────────────────────────────────────
if not exist "node_modules\" (
    echo  First run - installing packages, please wait...
    echo.
    call npm install
    echo.
)

echo  Starting server... browser will open in a few seconds.
echo  Keep this window open while using Ideaboard.
echo  Close this window to stop the app.
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5180"
call npm run dev

pause
exit /b 0

:: ── Subroutine: create shortcuts via PowerShell ───────────────────────────────
:create_shortcuts
echo.
echo  Creating shortcuts...

:: Desktop shortcut
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$s = $ws.CreateShortcut('%SHORTCUT_DESKTOP%');" ^
  "$s.TargetPath = '%SCRIPT_PATH%';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.Description = 'Launch Ideaboard';" ^
  "$s.Save()"

:: Start Menu shortcut
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$s = $ws.CreateShortcut('%SHORTCUT_START%');" ^
  "$s.TargetPath = '%SCRIPT_PATH%';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.Description = 'Launch Ideaboard';" ^
  "$s.Save()"

if exist "%SHORTCUT_DESKTOP%" (
    echo  [OK] Desktop shortcut created
) else (
    echo  [!] Desktop shortcut failed
)
if exist "%SHORTCUT_START%" (
    echo  [OK] Start Menu shortcut created
) else (
    echo  [!] Start Menu shortcut failed
)

echo.
echo  You can now pin Ideaboard to your Taskbar:
echo    1. Open the Start Menu and search for Ideaboard
echo    2. Right-click it and choose "Pin to taskbar"
echo.
goto :eof
