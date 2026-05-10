@echo off
cd /d "%~dp0.."
npm run build:mobile && npx cap sync android
