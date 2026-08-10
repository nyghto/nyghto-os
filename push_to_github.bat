@echo off
echo Pushing code to GitHub...
git init
git add .
git commit -m "Update UI features and fixes"
git branch -M main
git remote add origin https://github.com/shahal/repo-name.git
git push -u origin main
echo.
echo ========================================================
echo Done! Please check the output above for any errors.
echo You might be asked to log in to GitHub in a browser window.
echo ========================================================
pause
