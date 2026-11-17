@echo off
setlocal
title Intelligent Engine Room - Stop
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-local.ps1" -Side ship
if errorlevel 1 (
    echo.
    echo Stop failed. Please keep this window and check the error above.
    pause
    exit /b 1
)
exit /b 0
