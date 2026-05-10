@echo off
cd /d "%~dp0.."
echo Starting AutaKimi Release CLI...
npm run build:desktop && cd apps/desktop && npm run release
pause
