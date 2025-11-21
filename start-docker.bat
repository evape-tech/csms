@echo off
echo ==========================================
echo      Starting CSMS Docker Environment
echo ==========================================

:: Check if docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo Building and starting containers...
docker-compose up -d --build

if %errorlevel% neq 0 (
    echo Failed to start containers.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo       Services are running!
echo ==========================================
echo Web App (via Caddy): http://localhost
echo Web App (direct):    http://localhost:3000 (internal only)
echo OCPP Server:         ws://localhost:8089
echo Caddy Admin API:     http://localhost:2019
echo Caddy Web UI:        http://localhost:8888
echo.
echo Services:
echo - csms-caddy     (Reverse Proxy)
echo - csms-caddy-ui  (Caddy Web UI)
echo - csms-web       (Next.js Application)
echo - csms-ocpp      (OCPP WebSocket Server)
echo.
echo Showing logs... (Press Ctrl+C to exit logs, containers will keep running)
echo.

docker-compose logs -f
