@echo off
setlocal
echo ========================================
echo LManwa Release Builder (Windows)
echo ========================================



echo.
echo [1/3] Cleaning previous builds...
if exist dist rd /s /q dist
if exist dist-electron rd /s /q dist-electron
if exist release rd /s /q release

echo.
echo [2/3] Building and Packaging Application...
set NODE_OPTIONS=--max-old-space-size=8192
call npm run build
call npm run electron:build-main
npx electron-builder --win nsis msi --config.npmRebuild=false

echo.
echo ========================================
echo Build Process Finished!
echo ========================================
pause
