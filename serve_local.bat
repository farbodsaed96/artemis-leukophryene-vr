@echo off
cd /d "%~dp0"
echo Open http://localhost:8000 in the browser. Close this window to stop.
python -m http.server 8000 || py -m http.server 8000
pause
