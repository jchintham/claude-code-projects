@echo off
echo Starting Crave server...
start "" "C:\Program Files\nodejs\node.exe" "C:\Users\Jay Chintham\OneDrive\Documents\ClaudeCode\food-recommender\backend\server.js"
timeout /t 2 /nobreak >nul
echo Server running at http://localhost:3000
start http://localhost:3000
