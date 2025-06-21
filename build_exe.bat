@echo off
title Xyether Video Downloader .EXE Builder

echo ==========================================================
echo  Building the final .exe file...
echo  This will create a 'dist' folder with your application.
echo  This process can take several minutes.
echo ==========================================================
echo.

npm run package

echo.
echo ==========================================================
echo  Build finished!
echo.
echo  Check the 'dist' folder for your installer file.
echo ==========================================================
pause