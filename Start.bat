@echo off
REM One-click launcher: starts the SQL Injection lab web server and opens the browser
title SQL Injection Lab - http://localhost:3002
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found. Install from https://nodejs.org and retry.
    pause
    exit /b 1
)

REM Open browser after a short delay so the server is listening first
start "" cmd /c "timeout /t 1 >nul & start http://localhost:3002"

node server.js
pause
