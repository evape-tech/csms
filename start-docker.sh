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

echo ""
echo "Choose environment to start:"
echo "1. Production (web:3000, ocpp:8089)"
echo "2. Development (web:3001, ocpp:8088)"
echo "3. Exit"
echo ""
read -p "Enter your choice (1, 2, or 3): " choice

case $choice in
    1)
        cd docker && bash start.prod.sh
        ;;
    2)
        cd docker && bash start.dev.sh
        ;;
    3)
        echo ""
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Please try again."
        exec bash "$0"
        ;;
esac

echo ""
echo "Script completed. Press Enter to exit..."
read
read
