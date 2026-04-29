@echo off
title Ideaboard v3 - Full Feature Edition
color 0A
echo.
echo  ==========================================
echo    IDEABOARD v3 - Full Feature Edition
echo  ==========================================
echo.
set "BAT_DIR=%~dp0"
if exist "%BAT_DIR%ideaboard3\package.json" (set "APP_DIR=%BAT_DIR%ideaboard3" & goto :found)
if exist "%BAT_DIR%package.json" (set "APP_DIR=%BAT_DIR%" & goto :found)
echo  [ERROR] Cannot find ideaboard3 folder. Place this .bat next to the ideaboard3 folder.
pause & exit /b 1
:found
cd /d "%APP_DIR%"
echo  Project: %APP_DIR%
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (echo  [ERROR] Install Node.js from https://nodejs.org & pause & exit /b 1)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node.js: %NODE_VER%
if not exist "node_modules\" (
    echo. & echo  Installing packages (first run ~2 min)...
    call npm install
    if %errorlevel% neq 0 (echo  [ERROR] npm install failed. & pause & exit /b 1)
    echo  Done!
) else (echo  Packages ready.)
echo.
if not exist ".env.local" (
    if exist ".env.example" copy ".env.example" ".env.local" >nul
    echo  Add Supabase credentials to .env.local
    echo  (supabase.com - Settings - API)
    echo.
)
echo  Starting at http://localhost:5173
echo  Close this window to stop.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
call npm run dev
echo. & pause
