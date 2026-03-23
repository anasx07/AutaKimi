@echo off
setlocal
echo 🚀 Starting Full Build for LManwa (With Installers)...

:: 1. Build Frontend (Vite + TSC)
echo 📦 Building Frontend...
call npm run build
if %errorlevel% neq 0 goto error

:: 2. Run Electron Builder (Packages Installers)
echo 🔨 Packaging Installers...
call npx electron-builder --win --config.npmRebuild=false
if %errorlevel% neq 0 goto error

echo.
echo ✅ Full Build Complete!
echo 📂 Installers are located in: %~dp0dist
echo.
pause
exit /b 0

:error
echo.
echo ❌ Build failed with error %errorlevel%
pause
exit /b %errorlevel%
