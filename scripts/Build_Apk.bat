@echo off
title AutaKimi - Build Android APK
echo ====================================================
echo        AutaKimi Android APK Build Pipeline
echo ====================================================
echo.

cd /d "%~dp0.."

echo [1/3] Building AutaKimi Extensions and SDK...
cd autakimi-extensions
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Extensions build failed!
    pause
    exit /b %errorlevel%
)

cd /d "%~dp0..\apps\mobile\android"

echo [2/3] Cleaning Android build cache...
call gradlew.bat clean

echo [3/3] Assembling Release APK with Keiyoushi Native Module...
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo [ERROR] Android APK assembly failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ====================================================
echo   SUCCESS! APK Generated at:
echo   apps\mobile\android\app\build\outputs\apk\release\
echo ====================================================
echo.

pause
