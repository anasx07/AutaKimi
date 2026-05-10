@echo off
setlocal
cd /d "%~dp0.."
echo 🚀 Starting Fast Build for AutaKimi (Unpacked)...

:: 1. Build Desktop
echo 📦 Building Desktop...
npm run build:desktop
if %errorlevel% neq 0 goto error

:: 3. Run Electron Builder (Unpacked Only - skips installer)
echo 🔨 Packaging Unpacked Executable...
cd apps/desktop
call npx electron-builder --win dir --config.npmRebuild=false
if %errorlevel% neq 0 goto error

echo.
echo ✅ Fast Build Complete!
echo 📂 Location: %~dp0..\apps\desktop\release\win-unpacked
echo.
pause
exit /b 0

:error
echo.
echo ❌ Build failed with error %errorlevel%
exit /b %errorlevel%
