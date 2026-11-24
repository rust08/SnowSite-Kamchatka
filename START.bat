@echo off
cd /d "%~dp0"
title SnowSite
set SNOW_OPEN=1
echo SnowSite starts here. Keep this window open while you use the site. Close it to stop.
node src/server.mjs
echo.
echo The server stopped. If you see an error above, send a screenshot of this window.
pause
