#!/bin/bash
if [ ! -f .env ]; then
    echo "Error: .env file missing. Run ./install.sh first."
    exit 1
fi

echo "Starting Flux Post Render Worker..."
sudo docker-compose up -d
echo "Worker started in background."
