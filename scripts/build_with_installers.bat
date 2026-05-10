@echo off
setlocal
cd /d "%~dp0.."
echo 🚀 Starting Full Build for AutaKimi (With Installers)...

:: 1. Build Desktop
echo 📦 Building Desktop...
npm run build:desktop
if %errorlevel% neq 0 goto error

:: 2. Run Electron Builder (Packages Installers)
echo 🔨 Packaging Installers...
cd apps/desktop
call npx electron-builder --win --config.npmRebuild=false
if %errorlevel% neq 0 goto error

echo.
echo ✅ Full Build Complete!
echo 📂 Installers are located in: %~dp0..\apps\desktop\dist
echo.
pause
exit /b 0

:error
echo.
echo ❌ Build failed with error %errorlevel%
pause
exit /b %errorlevel%
