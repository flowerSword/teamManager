@echo off
chcp 65001 >nul 2>&1
title Team Manager
cd /d "%~dp0"

echo.
echo  =============================================
echo   Team Manager  (offline, no pip needed)
echo  =============================================
echo.

:: ---- Find Python ----
set PYTHON=

py --version >nul 2>&1
if %errorlevel%==0 ( set PYTHON=py & goto :found )

python --version >nul 2>&1
if %errorlevel%==0 ( set PYTHON=python & goto :found )

python3 --version >nul 2>&1
if %errorlevel%==0 ( set PYTHON=python3 & goto :found )

for %%d in (
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
    "C:\Python310\python.exe"
    "C:\Python311\python.exe"
) do (
    if exist %%~d ( set PYTHON=%%~d & goto :found )
)

echo  [ERROR] Python not found!
echo  Please install Python 3.x from https://www.python.org/downloads/
echo  Check "Add Python to PATH" during install.
pause & exit /b 1

:found
for /f "tokens=2 delims= " %%v in ('%PYTHON% --version 2^>^&1') do set PYVER=%%v
echo  [OK] Python %PYVER%
echo  [OK] Using bundled libraries (no internet needed)
echo.
echo  =============================================
echo  Starting server at http://127.0.0.1:8080
echo  Close this window to stop.
echo  =============================================
echo.

ping -n 3 127.0.0.1 >nul
start "" "http://127.0.0.1:8080"

%PYTHON% app.py
pause
