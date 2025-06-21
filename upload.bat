@echo off
:: This script automates uploading your project files to GitHub.

:: --- Configuration ---
:: Set your main branch name here.
:: Your local Git branch might be named "master" (older) or "main" (newer).
:: The error log you provided shows your branch is "master", so we've set it here.
:: If you create a new repository in the future, you may need to change this to "main".
set BRANCH_NAME=master

:: ---------------------

echo ===============================================
echo  Xyether YouTube Downloader - GitHub Uploader
echo ===============================================
echo.

:: Check if this is a Git repository.
if not exist ".git" (
    echo This folder is not a Git repository.
    echo Please run the initial setup commands first.
    pause
    exit /b
)

:: Ask the user for a description of their changes (commit message).
set /p commit_message="Enter a short description of your changes: "

:: If the user didn't enter a message, use a default one.
if "%commit_message%"=="" (
    set commit_message="Update project files"
)

echo.
echo Preparing to upload changes...

:: --- The Git Commands ---
:: 1. Add all changed files to the staging area.
echo [Step 1/3] Adding all files...
git add .

:: 2. Commit the changes with the user's message.
echo [Step 2/3] Committing changes with message: "%commit_message%"
git commit -m "%commit_message%"

:: 3. Push the committed changes to GitHub.
echo [Step 3/3] Pushing to GitHub on branch: %BRANCH_NAME%...
git push origin %BRANCH_NAME%

echo.
echo ===============================================
echo  Upload Complete!
echo ===============================================
echo.
pause
