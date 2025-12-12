# Docker Container Management

## Quick Commands

### Start the Container
```bash
docker-compose up -d
```

### Stop the Container
```bash
docker-compose down
```

### Restart the Container
```bash
docker-compose restart
```

### View Logs
```bash
# Follow logs in real-time
docker-compose logs -f

# View last 50 lines
docker-compose logs --tail=50
```

### Check Status
```bash
docker-compose ps
```

### Rebuild and Restart
```bash
docker-compose up -d --build
```

### View Resource Usage
```bash
docker stats planetary-mcp
```

### Execute Commands Inside Container
```bash
docker exec -it planetary-mcp sh
```

### Remove Everything (including volumes)
```bash
docker-compose down -v
```

## Testing Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Earth Engine System
```powershell
$body = @{ tool = "earth_engine_system"; arguments = @{ operation = "health" } } | ConvertTo-Json
curl -Method POST -Uri "http://localhost:3000/api/mcp/sse" -ContentType "application/json" -Body $body
```

### Test Data Search
```powershell
$body = @{ tool = "earth_engine_data"; arguments = @{ operation = "search"; query = "sentinel"; limit = 5 } } | ConvertTo-Json
curl -Method POST -Uri "http://localhost:3000/api/mcp/sse" -ContentType "application/json" -Body $body
```

## Claude Desktop Config

The current config at `%APPDATA%\Claude\claude_desktop_config.json` works perfectly with the Docker container:

```json
{
  "mcpServers": {
    "planetary-mcp": {
      "command": "node",
      "args": ["D:\\earth-engine-mcp\\mcp-sse-complete.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\Users\\Dhenenjay\\Downloads\\ee-key.json"
      }
    }
  }
}
```

The bridge connects to `http://localhost:3000/api/mcp/sse` which is now served by Docker.

## Troubleshooting

### Container Won't Start
```bash
# Check logs for errors
docker-compose logs

# Rebuild from scratch
docker-compose down
docker-compose up -d --build
```

### Port 3000 Already in Use
```bash
# Find what's using the port
netstat -ano | findstr :3000

# Stop the process (replace PID)
Stop-Process -Id <PID> -Force
```

### Update Credentials
```bash
# Copy new credentials file
Copy-Item "path\to\new-ee-key.json" "D:\earth-engine-mcp\credentials\ee-key.json"

# Restart container
docker-compose restart
```

### Performance Issues
```bash
# Check resource usage
docker stats planetary-mcp

# Increase Docker Desktop resources in Settings > Resources
```

## Container Info

- **Name**: planetary-mcp
- **Port**: 3000
- **Network**: earth-engine-mcp_planetary-network
- **Credentials Mount**: ./credentials → /app/credentials
- **Health Check**: Every 30s
- **Restart Policy**: unless-stopped

## Production Notes

- Container automatically restarts on failure
- Health checks ensure service availability
- Credentials mounted as read-only
- All dependencies containerized
- No local Node.js needed
