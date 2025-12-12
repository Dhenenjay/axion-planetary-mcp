# Setup Guide - Google Earth Engine MCP Server

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env.local

# 3. Configure credentials (see below)

# 4. Start development server
pnpm dev
```

## Detailed Setup Instructions

### Step 1: Google Cloud & Earth Engine Setup

#### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Create Project" or select existing project
3. Note your Project ID

#### 1.2 Enable Earth Engine API
1. In Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Earth Engine API"
3. Click "Enable"

#### 1.3 Create Service Account
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Name: `earth-engine-mcp`
4. Click "Create and Continue"
5. Grant roles:
   - Earth Engine Resource Admin
   - Storage Object Creator (for exports)
6. Click "Done"

#### 1.4 Generate Service Account Key
1. Click on the created service account
2. Go to "Keys" tab
3. Add Key > Create New Key > JSON
4. Save the downloaded file as `service-account-key.json`

### Step 2: Environment Configuration

#### 2.1 Extract Service Account Email
From your `service-account-key.json`, find the `client_email` field:
```json
{
  "client_email": "earth-engine-mcp@your-project.iam.gserviceaccount.com",
  ...
}
```

#### 2.2 Encode Service Account JSON
**Windows PowerShell:**
```powershell
$content = Get-Content -Path "service-account-key.json" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$encoded = [System.Convert]::ToBase64String($bytes)
Write-Output $encoded | Set-Clipboard
```

**macOS/Linux:**
```bash
base64 -i service-account-key.json | tr -d '\n' | pbcopy  # macOS
base64 -w 0 service-account-key.json | xclip -selection clipboard  # Linux
```

#### 2.3 Configure .env.local
```env
GEE_SA_EMAIL=earth-engine-mcp@your-project.iam.gserviceaccount.com
GEE_SA_KEY_JSON=<paste base64 encoded JSON here>
GCP_PROJECT_ID=your-project-id
REDIS_URL=  # Optional, leave empty for local development
LOG_LEVEL=info
```

### Step 3: Optional - Redis Setup (for production)

#### Local Redis (Docker):
```bash
docker run -d -p 6379:6379 redis:alpine
# Add to .env.local:
# REDIS_URL=redis://localhost:6379
```

#### Vercel KV:
1. In Vercel Dashboard, add KV storage
2. Copy connection string to REDIS_URL

### Step 4: Verify Setup

#### 4.1 Start Server
```bash
pnpm dev
```

#### 4.2 Check Health
```bash
curl http://localhost:3000/api/health
# Should return: {"ok":true,"time":"..."}
```

#### 4.3 Test Earth Engine Connection
```bash
# Using the test client
node scripts/test-client.mjs http://localhost:3000

# Or directly test auth
curl -X POST http://localhost:3000/api/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{"tool":"auth_check","params":{}}'
```

## Common Setup Issues

### Issue: "Earth Engine not initialized"
**Solution:** Check service account credentials:
```bash
# Verify base64 encoding is correct
echo $GEE_SA_KEY_JSON | base64 -d | jq .client_email
```

### Issue: "Permission denied" on exports
**Solution:** Grant Storage Admin role to service account:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA_EMAIL" \
  --role="roles/storage.admin"
```

### Issue: "Cannot find module" errors
**Solution:** Clean install dependencies:
```bash
rm -rf node_modules .pnpm-store
pnpm install
```

### Issue: TypeScript errors
**Solution:** Rebuild TypeScript:
```bash
rm -rf .next tsconfig.tsbuildinfo
pnpm typecheck
```

## Testing the Installation

### Basic Functionality Test
```javascript
// test-ee.js
const testTools = [
  { tool: 'health_check', params: {} },
  { tool: 'auth_check', params: {} },
  { tool: 'search_gee_catalog', params: { query: 'sentinel' } }
];

for (const test of testTools) {
  const res = await fetch('http://localhost:3000/api/mcp/sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(test)
  });
  console.log(`${test.tool}:`, await res.json());
}
```

### Full Workflow Test
```javascript
// 1. Search for dataset
const search = await callTool('search_gee_catalog', {
  query: 'COPERNICUS/S2'
});

// 2. Filter collection
const filtered = await callTool('filter_collection_by_date_and_region', {
  datasetId: 'COPERNICUS/S2_SR',
  aoi: { type: 'Point', coordinates: [-122.4, 37.8] },
  start: '2024-01-01',
  end: '2024-12-31'
});

// 3. Get band names
const bands = await callTool('get_dataset_band_names', {
  datasetId: 'COPERNICUS/S2_SR'
});

// 4. Calculate NDVI
const ndvi = await callTool('calculate_spectral_index', {
  imageId: 'COPERNICUS/S2_SR/20240615T103031_20240615T103026_T32TQM',
  index: 'NDVI',
  mapping: { nir: 'B8', red: 'B4' }
});
```

## Production Deployment

### Vercel Deployment
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# 3. Set environment variables in Vercel Dashboard
```

### Docker Deployment
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Environment Variables for Production
- Use secrets management (Vercel, AWS Secrets Manager, etc.)
- Never commit `.env.local` or service account keys
- Rotate service account keys regularly
- Use least-privilege IAM roles

## Next Steps

1. **Explore Tools**: Check available tools in `src/mcp/tools/`
2. **Add Custom Tools**: Create new tools in `src/mcp/tools/`
3. **Test Workflows**: Use `tests/fixtures/` for sample data
4. **Monitor Performance**: Check logs and Redis metrics
5. **Scale**: Add more workers, use CDN for tiles

## Support Resources

- [Earth Engine Documentation](https://developers.google.com/earth-engine)
- [MCP Specification](https://modelcontextprotocol.io)
- [Project Issues](https://github.com/yourusername/earth-engine-mcp/issues)

---

For additional help, please open an issue on GitHub.
