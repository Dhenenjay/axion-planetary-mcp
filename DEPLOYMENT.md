# Axion MCP Server - Deployment Guide

## Overview
This is the Axion MCP Server with SSE transport for remote access. It provides 7 powerful satellite imagery analysis tools:

- **axion_data** - Search and access satellite imagery (Sentinel-2, Landsat, etc.)
- **axion_system** - Server health and configuration
- **axion_process** - Compute spectral indices, composites, cloud masking
- **axion_export** - Download imagery, generate tiles
- **axion_map** - Interactive maps with TiTiler
- **axion_classification** - ML-based land cover classification
- **axion_sar2optical** - Generate optical imagery from SAR using AI (Vertex AI)

## Deployment to Render

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/axion-mcp-sse.git
git push -u origin main
```

### 2. Create Render Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` configuration

### 3. Configure Environment Variables
In the Render dashboard, set these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `AXION_API_KEY` | API key for authentication | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Base64-encoded GCP service account JSON | Yes (for SAR2Optical) |
| `AWS_ACCESS_KEY_ID` | AWS access key | Optional |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Optional |
| `AWS_REGION` | AWS region (default: us-east-1) | Optional |

### 4. Encode GCP Credentials
To encode your GCP service account JSON:
```bash
# On Linux/Mac
base64 -i your-service-account.json

# On Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("your-service-account.json"))
```

Copy the output and paste it as `GOOGLE_APPLICATION_CREDENTIALS_JSON` in Render.

## Connecting from Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "axion-mcp": {
      "url": "https://your-app.onrender.com/sse",
      "headers": {
        "x-api-key": "your-api-key-here"
      }
    }
  }
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info and available tools |
| `/health` | GET | Health check (no auth required) |
| `/sse` | GET | Establish SSE connection |
| `/messages?sessionId=<id>` | POST | Send MCP messages |

## Authentication

All endpoints except `/health` require authentication via:
- `x-api-key` header
- `Authorization: Bearer <key>` header
- `?api_key=<key>` query parameter

## Local Development

```bash
# Install dependencies
npm install

# Build SSE server
npm run build:sse

# Run locally (no auth)
REQUIRE_AUTH=false npm run start:sse

# Run with auth
AXION_API_KEY=your-key npm run start:sse
```

## Docker Build

```bash
# Build image
docker build -t axion-mcp-sse .

# Run container
docker run -p 3000:3000 \
  -e AXION_API_KEY=your-key \
  -e GOOGLE_APPLICATION_CREDENTIALS_JSON=$(base64 -i creds.json) \
  axion-mcp-sse
```

## Troubleshooting

### SAR2Optical not working
- Ensure `GOOGLE_APPLICATION_CREDENTIALS_JSON` is properly base64-encoded
- Check Vertex AI endpoint is accessible from Render's IP range
- Verify GCS bucket permissions

### Connection refused
- Check if the service is running: `curl https://your-app.onrender.com/health`
- Verify API key is correct
- Check Render logs for errors

## Support
For issues, please open a GitHub issue or contact the maintainers.
