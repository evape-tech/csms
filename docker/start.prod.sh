#!/bin/bash

echo "=========================================="
echo "   Starting CSMS Production Environment"
echo "=========================================="

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    echo "Press Enter to continue..."
    read
    exit 0
fi

echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

echo "Cleaning up dangling images..."
docker image prune -f
echo "Dangling images cleaned."

echo "Building and starting PRODUCTION containers..."
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    echo "Failed to start containers."
    echo "Press Enter to continue..."
    read
    exit 0
fi

echo ""
echo "=========================================="
echo "   PRODUCTION Services are running!"
echo "=========================================="
echo "Web App:         http://localhost:3000"
echo "OCPP Server:     ws://localhost:8089"
echo ""
echo "Services:"
echo "- csms-web-prod  (Next.js Application)"
echo "- csms-ocpp-prod (OCPP WebSocket Server)"
echo ""
echo "Showing logs... (Press Ctrl+C to exit logs, containers will keep running)"
echo ""

docker compose -f docker-compose.prod.yml logs -f

echo ""
echo "Script completed. Press Enter to exit..."
read
