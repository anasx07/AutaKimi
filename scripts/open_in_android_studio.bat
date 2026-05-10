@echo off
cd /d "%~dp0.."
set AS_PATH="C:\Program Files\Android\Android Studio\bin\studio64.exe"
start "" %AS_PATH% "apps\mobile\android"
