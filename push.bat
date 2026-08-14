@echo off
cd /d "d:\nyghto nyra os"
echo Adding changes...
.\mingit\cmd\git.exe add .
echo Committing changes...
.\mingit\cmd\git.exe commit -m "Optimize for Netlify"
echo Pushing code to GitHub...
.\mingit\cmd\git.exe push -u origin main
echo.
echo ========================================================
echo Done! Please check the output above for any errors.
echo ========================================================
pause
