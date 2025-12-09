#!/bin/bash

echo "=========================================="
echo "     Starting CSMS Docker Environment"
echo "=========================================="

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

echo "Stopping existing containers..."
docker compose down

echo "Cleaning up dangling images (volumes will be preserved)..."
docker image prune -f
echo "Dangling images cleaned."

echo "Building and starting containers..."
docker compose up -d --build

if [ $? -ne 0 ]; then
    echo "Failed to start containers."
    exit 1
fi

echo ""
echo "=========================================="
echo "       Services are running!"
echo "=========================================="
echo "Web App (via Caddy): http://localhost"
echo "Web App (direct):    http://localhost:3000 (internal only)"
echo "OCPP Server:         ws://localhost:8089"
echo "Caddy Admin API:     http://localhost:2019"
echo "Caddy Web UI:        http://localhost:8888"
echo ""
echo "Services:"
echo "- csms-caddy     (Reverse Proxy)"
echo "- csms-caddy-ui  (Caddy Web UI)"
echo "- csms-web       (Next.js Application)"
echo "- csms-ocpp      (OCPP WebSocket Server)"
echo ""
echo "Showing logs... (Press Ctrl+C to exit logs, containers will keep running)"
echo ""

docker compose logs -f
