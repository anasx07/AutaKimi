@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo AUTAKIMI - ANDROID BUILD SYSTEM
echo ======================================================
echo.

echo [1/5] Cleaning mobile build directory...
if exist "dist-mobile" rmdir /s /q "dist-mobile"

echo [2/5] Compiling React application for mobile...
call npm run build:mobile
if %ERRORLEVEL% neq 0 (
    echo [ERROR] React build failed.
    exit /b %ERRORLEVEL%
)

echo [3/5] Synchronizing Capacitor Android project...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Capacitor sync failed.
    exit /b %ERRORLEVEL%
)

echo [4/5] Generating Android APK (assembleDebug)...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Gradle build failed.
    cd ..
    exit /b %ERRORLEVEL%
)
cd ..

echo [5/5] Collecting APK...
if not exist "builds\android" mkdir "builds\android"
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "builds\android\AutaKimi-debug.apk" /y
    echo [SUCCESS] APK Collected: builds\android\AutaKimi-debug.apk
) else (
    echo [ERROR] Could not find generated APK. Please check the Android build logs.
)

echo.
echo ======================================================
echo [FINISH] Android build process completed.
echo ======================================================
pause
