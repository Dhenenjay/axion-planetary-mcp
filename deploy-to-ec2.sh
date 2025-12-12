#!/bin/bash

# Planetary MCP - Quick EC2 Deployment Script
# Usage: ./deploy-to-ec2.sh <ec2-ip> <path-to-pem-key> <path-to-ee-key.json>

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Planetary MCP - EC2 Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check arguments
if [ $# -lt 3 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <ec2-ip> <path-to-pem-key> <path-to-ee-key.json>"
    echo "Example: $0 54.123.45.67 ~/my-key.pem ~/ee-key.json"
    exit 1
fi

EC2_IP=$1
PEM_KEY=$2
EE_KEY=$3
EC2_USER="ec2-user"  # Change to 'ubuntu' if using Ubuntu

echo -e "${YELLOW}Target EC2: ${EC2_IP}${NC}"
echo -e "${YELLOW}PEM Key: ${PEM_KEY}${NC}"
echo -e "${YELLOW}EE Key: ${EE_KEY}${NC}"

# Test SSH connection
echo -e "\n${GREEN}[1/7] Testing SSH connection...${NC}"
ssh -i "$PEM_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$EC2_USER@$EC2_IP" "echo 'Connection successful'" || {
    echo -e "${RED}Failed to connect to EC2 instance${NC}"
    exit 1
}

# Install Docker if needed
echo -e "\n${GREEN}[2/7] Installing Docker (if not present)...${NC}"
ssh -i "$PEM_KEY" "$EC2_USER@$EC2_IP" << 'ENDSSH'
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo yum update -y
    sudo yum install docker -y
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "Docker installed successfully"
else
    echo "Docker already installed"
fi
ENDSSH

# Create application directory
echo -e "\n${GREEN}[3/7] Creating application directory...${NC}"
ssh -i "$PEM_KEY" "$EC2_USER@$EC2_IP" "mkdir -p ~/planetary-mcp/credentials"

# Upload application files
echo -e "\n${GREEN}[4/7] Uploading application files...${NC}"
rsync -avz -e "ssh -i $PEM_KEY" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'test-*' \
    --exclude '*.log' \
    --exclude 'credentials' \
    ./ "$EC2_USER@$EC2_IP:~/planetary-mcp/"

# Upload Earth Engine credentials
echo -e "\n${GREEN}[5/7] Uploading Earth Engine credentials...${NC}"
scp -i "$PEM_KEY" "$EE_KEY" "$EC2_USER@$EC2_IP:~/planetary-mcp/credentials/ee-key.json"

# Build and start containers
echo -e "\n${GREEN}[6/7] Building and starting Docker containers...${NC}"
ssh -i "$PEM_KEY" "$EC2_USER@$EC2_IP" << 'ENDSSH'
cd ~/planetary-mcp

# Build and start
docker-compose down || true
docker-compose up -d --build

# Wait for health check
echo "Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "Server is ready!"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done
ENDSSH

# Verify deployment
echo -e "\n${GREEN}[7/7] Verifying deployment...${NC}"
sleep 2
HEALTH_CHECK=$(curl -s http://$EC2_IP:3000/api/health || echo "failed")

if [[ $HEALTH_CHECK == *"ok"* ]]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Server URL: ${GREEN}http://$EC2_IP:3000${NC}"
    echo -e "Health Check: ${GREEN}http://$EC2_IP:3000/api/health${NC}"
    echo -e "\nClaude Desktop Config:"
    echo -e "${YELLOW}{"
    echo -e '  "mcpServers": {'
    echo -e '    "planetary-mcp": {'
    echo -e '      "command": "node",'
    echo -e "      \"args\": [\"$(pwd)/mcp-sse-remote.js\"],"
    echo -e '      "env": {'
    echo -e "        \"MCP_SERVER_URL\": \"http://$EC2_IP:3000\""
    echo -e '      }'
    echo -e '    }'
    echo -e '  }'
    echo -e "}${NC}"
    echo -e "\nTo view logs: ${YELLOW}ssh -i $PEM_KEY $EC2_USER@$EC2_IP 'cd planetary-mcp && docker-compose logs -f'${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ Deployment may have issues${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "Check logs with: ${YELLOW}ssh -i $PEM_KEY $EC2_USER@$EC2_IP 'cd planetary-mcp && docker-compose logs'${NC}"
fi
