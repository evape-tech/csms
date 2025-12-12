@echo off
echo ==========================================
echo    Starting CSMS Production Environment
echo ==========================================

:: Check if docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop first.
    goto :end
)

echo Stopping existing containers...
docker-compose -f docker-compose.prod.yml down

echo Cleaning up dangling images...
for /f "tokens=*" %%i in ('docker images -f "dangling=true" -q 2^>nul') do (
    docker rmi %%i 2>nul
)
echo Dangling images cleaned.

echo Building and starting PRODUCTION containers...
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

if %errorlevel% neq 0 (
    echo Failed to start containers.
    goto :end
)

echo.
echo ==========================================
echo    PRODUCTION Services are running!
echo ==========================================
echo Web App:         http://localhost:3000
echo OCPP Server:     ws://localhost:8089
echo.
echo Services:
echo - csms-web-prod  (Next.js Application)
echo - csms-ocpp-prod (OCPP WebSocket Server)
echo.
echo "Showing logs... (Press Ctrl+C to exit logs, containers will keep running)"
echo.

docker-compose -f docker-compose.prod.yml logs -f

:end
echo.
echo Script completed. Press any key to exit...
pause >nul
