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

echo Stopping existing containers...
docker-compose down

echo Cleaning up dangling images (volumes will be preserved)...
for /f "tokens=*" %%i in ('docker images -f "dangling=true" -q 2^>nul') do (
    docker rmi %%i 2>nul
)
echo Dangling images cleaned.

echo Building and starting containers with --no-cache...
docker-compose build --no-cache
docker-compose up -d

if %errorlevel% neq 0 (
    echo Failed to start containers.
    goto :end
)

echo.
echo ==========================================
echo       Services are running!
echo ==========================================
echo Web App:         http://localhost:7500
echo OCPP Server:     ws://localhost:9000
echo.
echo Services:
echo - csms-web       (Next.js Application)
echo - csms-ocpp      (OCPP WebSocket Server)
echo.
echo "Showing logs... (Press Ctrl+C to exit logs, containers will keep running)"
echo.

docker-compose logs -f

:end
echo.
echo Script completed. Press any key to exit...
pause >nul
