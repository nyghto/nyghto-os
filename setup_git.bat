@echo off
cd /d "d:\nyghto nyra os"
.\mingit\cmd\git.exe init
.\mingit\cmd\git.exe config --local user.name "Shahal"
.\mingit\cmd\git.exe config --local user.email "shahal@nyghto.com"
.\mingit\cmd\git.exe add .
.\mingit\cmd\git.exe commit -m "Update features and fix bugs"
.\mingit\cmd\git.exe branch -M main
.\mingit\cmd\git.exe remote remove origin
.\mingit\cmd\git.exe remote add origin "https://github.com/shahal/repo-name.git"
echo Commit successful.
