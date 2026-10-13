@echo off
setlocal
title Ideaboard

cd /d "%~dp0"
if errorlevel 1 goto folder_failed

echo.
echo  =============================
echo    Ideaboard - Starting up...
echo  =============================
echo.

where node >nul 2>&1
if errorlevel 1 goto missing_node
node --version >nul 2>&1
if errorlevel 1 goto missing_node
where npm >nul 2>&1
if errorlevel 1 goto missing_npm
call npm --version >nul 2>&1
if errorlevel 1 goto missing_npm

if not exist "package.json" goto missing_project
if not exist "package-lock.json" goto missing_project
if exist "node_modules\" goto start_server

echo  First run - installing packages. An internet connection is required.
echo.
call npm ci
if errorlevel 1 goto installation_failed

:start_server
echo.
echo  The browser will open when Ideaboard is ready.
echo  Address: http://127.0.0.1:5174/ideaboard.html
echo  Keep this window open. Press Ctrl+C to stop Ideaboard.
echo.

rem A fixed host and port keep browser storage consistent between launches.
rem strictPort prevents Vite from silently opening a different board store.
call npm run dev -- --host 127.0.0.1 --port 5174 --strictPort --open /ideaboard.html
if errorlevel 1 goto server_failed
exit /b 0

:folder_failed
echo  ERROR: Cannot open the Ideaboard project folder.
goto failed

:missing_node
echo  ERROR: Install Node.js 24 LTS from https://nodejs.org, then reopen this launcher.
goto failed

:missing_npm
echo  ERROR: npm is unavailable. Reinstall Node.js 24 LTS from https://nodejs.org.
goto failed

:missing_project
echo  ERROR: Extract the entire Ideaboard download before opening this launcher.
goto failed

:installation_failed
echo  ERROR: Package installation failed.
echo  Check the message above and your internet connection, then try again.
goto failed

:server_failed
echo  ERROR: The server could not start.
echo  If port 5174 is in use, stop the other browser launcher and try again.
goto failed

:failed
echo.
if not defined CI pause
exit /b 1
