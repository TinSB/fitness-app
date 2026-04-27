@echo off
setlocal
chcp 65001 >nul
title IronPath Launcher

cd /d "%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  echo [Error] Windows PowerShell was not found.
  echo Please run Start-IronPath.ps1 manually from this folder.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-IronPath.ps1"
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo [Error] IronPath launcher failed. Exit code: %EXITCODE%
  pause
  exit /b %EXITCODE%
)

echo.
echo IronPath launcher has stopped.
pause
exit /b 0
