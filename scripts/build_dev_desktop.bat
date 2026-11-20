@echo off
setlocal
cd /d "%~dp0.."
echo 🚀 Starting Fast Build for AutaKimi (Unpacked)...

:: 1. Build Desktop
echo 📦 Building Desktop...
call npm run build:desktop
if %errorlevel% neq 0 goto error

echo.
echo ✅ Build Complete!
echo.
pause
exit /b 0

:error
echo.
echo ❌ Build failed with error %errorlevel%
exit /b %errorlevel%
