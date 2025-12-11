#!/bin/bash

echo "=========================================="
echo "     Starting CSMS Docker Environment"
echo "=========================================="

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    echo "Press Enter to continue..."
    read
    exit 0
fi

echo "Stopping existing containers..."
docker compose down

echo "Cleaning up dangling images (volumes will be preserved)..."
docker image prune -f
echo "Dangling images cleaned."

echo "Building and starting containers with --no-cache..."
docker compose build --no-cache
docker compose up -d

if [ $? -ne 0 ]; then
    echo "Failed to start containers."
    echo "Press Enter to continue..."
    read
    exit 0
fi

echo ""
echo "=========================================="
echo "       Services are running!"
echo "=========================================="
echo "Web App:         http://localhost:3000"
echo "OCPP Server:     ws://localhost:8089"
echo ""
echo "Services:"
echo "- csms-web       (Next.js Application)"
echo "- csms-ocpp      (OCPP WebSocket Server)"
echo ""
echo "Showing logs... (Press Ctrl+C to exit logs, containers will keep running)"
echo ""

docker compose logs -f

echo ""
echo "Script completed. Press Enter to exit..."
read
