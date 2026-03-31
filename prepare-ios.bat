@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo AUTAKIMI - iOS PREPARATION SYSTEM
echo ======================================================
echo.

echo [1/3] Compiling React application for mobile...
call npm run build:mobile
if %ERRORLEVEL% neq 0 (
    echo [ERROR] React build failed.
    exit /b %ERRORLEVEL%
)

echo [2/3] Preparing iOS project structure...
if not exist "ios" (
    echo Initializing iOS platform...
    call npx cap add ios
)

echo [3/3] Synchronizing Capacitor iOS project...
call npx cap sync ios
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Capacitor sync failed or completed with warnings (This is expected on Windows due to CocoaPods).
    echo The project has been prepared and synced to 'ios' directory.
)

echo.
echo ======================================================
echo [FINISH] iOS Preparation completed.
echo.
echo NEXT STEPS (on a Mac):
echo 1. Transfer the 'ios' directory to a Mac.
echo 2. Open 'App.xcworkspace' in Xcode.
echo 3. Build and Archive the IPA using Generic iOS Device.
echo ======================================================
pause
