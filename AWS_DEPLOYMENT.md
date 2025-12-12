# AWS EC2 Deployment Guide for Planetary MCP

## Prerequisites

1. AWS Account with EC2 access
2. Docker installed on EC2 instance
3. Google Earth Engine service account key JSON file
4. Security group with port 3000 open (or your preferred port)

## EC2 Instance Requirements

### Recommended Configuration:
- **Instance Type**: t3.medium or larger (2 vCPU, 4 GB RAM minimum)
- **OS**: Amazon Linux 2023 or Ubuntu 22.04 LTS
- **Storage**: 20 GB minimum (30 GB recommended)
- **Security Group**: 
  - Inbound: Port 3000 (HTTP) from your IP or 0.0.0.0/0
  - Inbound: Port 22 (SSH) from your IP
  - Outbound: All traffic

## Quick Start Deployment

### Step 1: Launch EC2 Instance

```bash
# Use AWS CLI or Console to launch an instance
# Example using AWS CLI:
aws ec2 run-instances \
  --image-id ami-xxxxxxxxx \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=planetary-mcp}]'
```

### Step 2: Connect to EC2 Instance

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### Step 3: Install Docker (Amazon Linux 2023)

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install docker -y

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes to take effect
exit
```

### Step 4: Install Docker (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes to take effect
exit
```

### Step 5: Deploy the Application

```bash
# Reconnect to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Clone or upload your repository
git clone https://github.com/Dhenenjay/Axion-MCP.git planetary-mcp
cd planetary-mcp

# Create credentials directory
mkdir -p credentials

# Upload your Earth Engine key (from local machine)
# scp -i your-key.pem /path/to/ee-key.json ec2-user@your-ec2-ip:~/planetary-mcp/credentials/

# Build and start the container
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

### Step 6: Verify Deployment

```bash
# Check container status
docker-compose ps

# Test health endpoint
curl http://localhost:3000/api/health

# Check from external
curl http://your-ec2-public-ip:3000/api/health
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Port configuration
PORT=3000

# Google Cloud Storage (optional)
GCS_BUCKET=earth-engine-exports

# Feature flags
DISABLE_THUMBNAILS=true

# Node environment
NODE_ENV=production
```

### Custom Port

To use a different port:

```bash
# Edit docker-compose.yml
# Change ports section:
ports:
  - "8080:3000"  # External:Internal

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

## Claude Desktop Configuration for Remote Server

Update your Claude Desktop config to point to the EC2 instance:

```json
{
  "mcpServers": {
    "planetary-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp-sse-remote.js"],
      "env": {
        "MCP_SERVER_URL": "http://your-ec2-public-ip:3000"
      }
    }
  }
}
```

## Monitoring and Maintenance

### View Logs
```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service logs
docker-compose logs -f planetary-mcp
```

### Restart Service
```bash
docker-compose restart
```

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Stop Service
```bash
docker-compose down
```

### Remove Everything
```bash
docker-compose down -v
```

## SSL/HTTPS Configuration (Recommended for Production)

### Option 1: Using Nginx Reverse Proxy

```bash
# Install Nginx
sudo yum install nginx -y  # Amazon Linux
# OR
sudo apt install nginx -y   # Ubuntu

# Configure Nginx
sudo nano /etc/nginx/conf.d/planetary-mcp.conf
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option 2: AWS Application Load Balancer

1. Create an Application Load Balancer
2. Configure target group pointing to EC2 instance port 3000
3. Add SSL certificate from ACM
4. Update security groups

## Backup and Recovery

### Backup Credentials
```bash
# Backup credentials to S3
aws s3 cp credentials/ee-key.json s3://your-backup-bucket/credentials/
```

### Automated Backups
Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * docker-compose -f /home/ec2-user/planetary-mcp/docker-compose.yml exec -T planetary-mcp tar czf - /app/data | aws s3 cp - s3://your-backup-bucket/backups/$(date +\%Y\%m\%d).tar.gz
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs

# Check container status
docker ps -a

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000
sudo netstat -tulpn | grep :3000

# Kill process or change port in docker-compose.yml
```

### Out of Memory
```bash
# Check system resources
free -h
df -h

# Increase EC2 instance size or add swap
sudo dd if=/dev/zero of=/swapfile bs=1G count=4
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Earth Engine Authentication Issues
```bash
# Verify credentials file is mounted
docker-compose exec planetary-mcp ls -la /app/credentials/

# Check environment variable
docker-compose exec planetary-mcp env | grep GOOGLE_APPLICATION_CREDENTIALS

# Test authentication
docker-compose exec planetary-mcp node -e "require('./src/gee/client').initEarthEngineWithSA().then(() => console.log('OK')).catch(console.error)"
```

## Cost Optimization

1. **Use Spot Instances**: Save up to 90% for non-critical workloads
2. **Schedule Stop/Start**: Use AWS Lambda to stop instance during off-hours
3. **Right-size Instance**: Monitor usage and downgrade if possible
4. **Use Reserved Instances**: 1-year commitment for 30-40% savings

## Security Best Practices

1. **Use IAM Roles**: Attach IAM role to EC2 instead of hardcoding AWS credentials
2. **Restrict Security Groups**: Only allow necessary IP addresses
3. **Enable CloudWatch Logs**: Monitor for suspicious activity
4. **Regular Updates**: Keep Docker and system packages updated
5. **Secrets Management**: Use AWS Secrets Manager for sensitive data
6. **Enable AWS GuardDuty**: Threat detection for EC2 instances

## Production Checklist

- [ ] EC2 instance launched with appropriate size
- [ ] Security groups configured correctly
- [ ] Docker and Docker Compose installed
- [ ] Application deployed and running
- [ ] Health check passing
- [ ] SSL/HTTPS configured
- [ ] Monitoring set up (CloudWatch)
- [ ] Backups configured
- [ ] Documentation updated with actual IPs/domains
- [ ] Load testing completed
- [ ] Disaster recovery plan documented

## Support

For issues or questions:
- GitHub Issues: https://github.com/Dhenenjay/Axion-MCP/issues
- Documentation: See MCP_TOOLS_DOCUMENTATION.md
