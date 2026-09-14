@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, or use the Windows installer instead.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --ignore-scripts
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts/start.js
if errorlevel 1 pause
