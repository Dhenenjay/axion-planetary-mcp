# MCP SERVER PRODUCTION DEPLOYMENT GUIDE
# ======================================

## CURRENT STATUS
- Service Account Key: CONFIGURED ✓
- Location: C:\Users\Dhenenjay\Downloads\ee-key.json
- Project Structure: COMPLETE ✓
- Dependencies: INSTALLED ✓

## SERVER ARCHITECTURE
### Core Tools (4)
1. earth_engine_data - Data operations (search, filter, geometry, info)
2. earth_engine_system - System operations (auth, execute, setup, load) 
3. earth_engine_process - Processing (clip, mask, index, analyze, composite)
4. earth_engine_export - Export operations (thumbnail, video, statistics)

### Modeling Tools (5)
1. wildfire_risk_assessment - Fire risk analysis
2. flood_risk_assessment - Flood risk analysis
3. agricultural_monitoring - Crop monitoring
4. deforestation_detection - Forest loss detection
5. water_quality_monitoring - Water quality assessment

## QUICK START
\\\powershell
# 1. Set environment variable
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\Dhenenjay\Downloads\ee-key.json"

# 2. Start Next.js server
cd C:\Users\Dhenenjay\earth-engine-mcp
npx next dev

# 3. Server will be available at:
http://localhost:3000/api/mcp/sse
\\\

## API ENDPOINTS
- SSE Endpoint: http://localhost:3000/api/mcp/sse
- Consolidated: http://localhost:3000/api/mcp/consolidated
- Health Check: http://localhost:3000/api/health

## TESTING
Use the provided test scripts:
- .\test-production.ps1 - Quick validation
- .\ultimate-mcp-server-test.ps1 - Full test suite

## PRODUCTION DEPLOYMENT

### Option 1: PM2 (Recommended)
\\\ash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
\\\

### Option 2: Windows Service
\\\powershell
# Use NSSM to create Windows service
nssm install "MCP-Server" "C:\Program Files\nodejs\node.exe"
nssm set "MCP-Server" AppDirectory "C:\Users\Dhenenjay\earth-engine-mcp"
nssm set "MCP-Server" AppParameters "node_modules\next\dist\bin\next start"
nssm set "MCP-Server" AppEnvironmentExtra "GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Dhenenjay\Downloads\ee-key.json"
\\\

### Option 3: Docker
\\\dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/ee-key.json
EXPOSE 3000
CMD ["npm", "start"]
\\\

## ENVIRONMENT VARIABLES
Required:
- GOOGLE_APPLICATION_CREDENTIALS: Path to service account key
- GCP_PROJECT_ID: Google Cloud project ID (auto-detected from key)

Optional:
- PORT: Server port (default: 3000)
- NODE_ENV: production/development
- GCS_BUCKET: Google Cloud Storage bucket for exports

## MONITORING
- Check server logs: pm2 logs
- Monitor performance: pm2 monit
- Health endpoint: GET /api/health

## TROUBLESHOOTING

### Server won't start
1. Check Node.js version: node --version (v18+ required)
2. Verify dependencies: npm install
3. Check port 3000 is free: netstat -an | findstr :3000

### Authentication fails
1. Verify service account key path
2. Check key has Earth Engine permissions
3. Ensure project has Earth Engine API enabled

### Timeout errors
1. Increase timeout in client requests
2. Use smaller regions/date ranges
3. Enable caching in production

## SECURITY
1. Never commit service account key to git
2. Use environment variables for sensitive data
3. Enable CORS for specific domains only
4. Use HTTPS in production
5. Implement rate limiting

## SUPPORT
For issues or questions:
1. Check the comprehensive test results
2. Review server logs
3. Verify Earth Engine quotas
4. Contact system administrator

---
Generated: 2025-09-10 03:32:33
Server Version: 0.1.0
