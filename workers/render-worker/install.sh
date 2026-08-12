#!/bin/bash
set -e

echo "--- Flux Post Render Worker Installer ---"

# 1. Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Unsupported OS"
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo "Warning: This script is tested on Ubuntu/Debian. Continuing anyway..."
fi

# 2. Install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 3. Enable Docker on boot
sudo systemctl enable docker
sudo systemctl start docker

# 4. Prepare .env
if [ ! -f .env ]; then
    echo "!!! .env file not found !!!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit the .env file with your Supabase credentials before starting."
    echo "Command: nano .env"
    exit 1
fi

# 5. Build Container
echo "Building Render Worker image..."
sudo docker-compose build

echo "Installation complete."
echo "Next steps:"
echo "1. Verify .env is correct"
echo "2. Run ./start.sh to launch the worker"
