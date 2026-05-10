@echo off
setlocal
cd /d "%~dp0.."
echo ========================================
echo AutaKimi Release Builder (Windows)
echo ========================================

echo.
echo [1/3] Cleaning previous builds...
if exist apps\desktop\dist rd /s /q apps\desktop\dist
if exist apps\desktop\dist-electron rd /s /q apps\desktop\dist-electron
if exist apps\desktop\release rd /s /q apps\desktop\release

echo.
echo [2/3] Building and Packaging Application...
set NODE_OPTIONS=--max-old-space-size=8192
npm run build:desktop
cd apps/desktop
npx electron-builder --win nsis msi --config.npmRebuild=false

echo.
echo ========================================
echo Build Process Finished!
echo ========================================
pause
