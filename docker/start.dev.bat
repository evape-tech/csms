@echo off
echo ==========================================
echo   Starting CSMS Development Environment
echo ==========================================

:: Check if docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop first.
    goto :end
)

echo Stopping existing containers...
docker-compose -f docker-compose.dev.yml down

echo Cleaning up dangling images...
for /f "tokens=*" %%i in ('docker images -f "dangling=true" -q 2^>nul') do (
    docker rmi %%i 2>nul
)
echo Dangling images cleaned.

echo Building and starting DEVELOPMENT containers...
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d

if %errorlevel% neq 0 (
    echo Failed to start containers.
    goto :end
)

echo.
echo ==========================================
echo   DEVELOPMENT Services are running!
echo ==========================================
echo Web App:         http://localhost:3001
echo OCPP Server:     ws://localhost:8088
echo.
echo Services:
echo - csms-dev       (Next.js + OCPP combined)
echo.
echo "Showing logs... (Press Ctrl+C to exit logs, containers will keep running)"
echo.

docker-compose -f docker-compose.dev.yml logs -f

:end
echo.
echo Script completed. Press any key to exit...
pause >nul
