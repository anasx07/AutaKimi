@echo off
cd /d "%~dp0.."
npm run build:mobile -w apps/mobile && cd apps/mobile && npx cap sync android && npx cap run android
