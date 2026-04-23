@echo off
echo Stopping Fork server...
taskkill /F /IM node.exe >nul 2>&1
echo Done.
