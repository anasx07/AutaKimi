@echo off
cd /d "%~dp0.."
echo Starting AutaKimi Release CLI...
npm run release
pause
