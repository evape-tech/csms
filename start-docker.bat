@echo off
echo ==========================================
echo      Starting CSMS Docker Environment
echo ==========================================

:: Check if docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop first.
    goto :end
)

echo.
echo Choose environment to start:
echo 1. Production (web:3000, ocpp:8089)
echo 2. Development (web:3001, ocpp:8088)
echo 3. Exit
echo.

set /p choice="Enter your choice (1, 2, or 3): "

if "%choice%"=="1" (
    cd docker && call start.prod.bat
) else if "%choice%"=="2" (
    cd docker && call start.dev.bat
) else if "%choice%"=="3" (
    goto :end
) else (
    echo Invalid choice. Please try again.
    goto :start
)

:end
echo.
echo Script completed. Press any key to exit...
pause >nul

