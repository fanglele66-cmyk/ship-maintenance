@echo off
setlocal
title Intelligent Engine Room - Start
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" -Side ship -OpenBrowser
if errorlevel 1 (
    echo.
    echo Startup failed. Please keep this window and check the error above.
    pause
    exit /b 1
)
exit /b 0
