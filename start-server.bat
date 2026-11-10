@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title CandleScope AI - Local Server

set "PORT=8080"
if not "%~1"=="" set "PORT=%~1"

echo.
echo  ============================================
echo   CandleScope AI - Local Server
echo  ============================================
echo.

rem ------------------------------------------------------------
rem 1) Node.js (utama) - memakai server.js tanpa npm install
rem ------------------------------------------------------------
set "NODE_EXE="
for %%N in (node.exe) do if not "%%~$PATH:N"=="" set "NODE_EXE=%%~$PATH:N"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if defined NODE_EXE if not exist "%~dp0server.js" set "NODE_EXE="

if defined NODE_EXE (
  echo  Menjalankan server dengan Node.js...
  echo.
  "%NODE_EXE%" "%~dp0server.js" %PORT%
  set "EXIT_CODE=%ERRORLEVEL%"
  if not "%EXIT_CODE%"=="0" (
    echo.
    echo  Server berhenti dengan kode error %EXIT_CODE%.
    pause
  )
  goto :end
)

rem ------------------------------------------------------------
rem 2) Python 3 (cadangan)
rem ------------------------------------------------------------
set "PYTHON_CMD="
py -3 --version >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
  python -c "import http.server" >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
  python3 -c "import http.server" >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python3"
)

if defined PYTHON_CMD (
  echo  Node.js tidak ditemukan. Menjalankan server dengan Python...
  echo.
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:%PORT%/'"
  %PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1
  set "EXIT_CODE=%ERRORLEVEL%"
  if not "%EXIT_CODE%"=="0" (
    echo.
    echo  Python gagal menjalankan server. Port %PORT% mungkin sedang dipakai.
    echo  Coba: start-server.bat 8081
    pause
  )
  goto :end
)

rem ------------------------------------------------------------
rem 3) Tanpa Node.js / Python - buka langsung index.html
rem ------------------------------------------------------------
echo  Node.js dan Python tidak ditemukan.
echo  Membuka index.html langsung di browser...
echo.
echo  Aplikasi tetap bisa dipakai tanpa server lokal.
echo.
start "" "%~dp0index.html"
pause

:end
endlocal
