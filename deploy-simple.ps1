# Simple Render deployment script
Write-Host "Render Deployment Setup" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

Write-Host "`nSince automated deployment requires complex API setup, please follow these steps:" -ForegroundColor Yellow

Write-Host "`n1. Go to Render Dashboard:" -ForegroundColor Green
Write-Host "   https://dashboard.render.com/create/web?repo=https://github.com/Dhenenjay/axion-planetary-mcp" -ForegroundColor White

Write-Host "`n2. Configure your service:" -ForegroundColor Green
Write-Host "   Name: axion-planetary-mcp" -ForegroundColor White
Write-Host "   Branch: master" -ForegroundColor White
Write-Host "   Region: Oregon (US West)" -ForegroundColor White
Write-Host "   Build Command: npm install && npm run build:next" -ForegroundColor White
Write-Host "   Start Command: npm run start:prod" -ForegroundColor White

Write-Host "`n3. Add Environment Variables:" -ForegroundColor Green
Write-Host "   Click 'Advanced' and add these environment variables:" -ForegroundColor Yellow

# Read and display the GEE credentials
$GEE_PATH = "C:\Users\Dhenenjay\Downloads\axion-orbital-46448075249c.json"
if (Test-Path $GEE_PATH) {
    $GEE_CONTENT = Get-Content $GEE_PATH -Raw
    Write-Host "`n   GOOGLE_APPLICATION_CREDENTIALS_JSON = (copy the JSON below)" -ForegroundColor White
    Write-Host "   ---START COPY---" -ForegroundColor Cyan
    Write-Host $GEE_CONTENT -ForegroundColor Gray
    Write-Host "   ---END COPY---" -ForegroundColor Cyan
} else {
    Write-Host "   WARNING: GEE credentials file not found at $GEE_PATH" -ForegroundColor Red
}

Write-Host "`n   NODE_ENV = production" -ForegroundColor White
Write-Host "   ANALYTICS_ENABLED = true" -ForegroundColor White
Write-Host "   CORS_ORIGIN = *" -ForegroundColor White

Write-Host "`n4. Click 'Create Web Service'" -ForegroundColor Green

Write-Host "`n5. Wait for deployment (usually 10-15 minutes for first deployment)" -ForegroundColor Yellow

Write-Host "`n📍 Your service will be available at:" -ForegroundColor Green
Write-Host "   https://axion-planetary-mcp.onrender.com" -ForegroundColor Cyan

Write-Host "`n✅ Once deployed, users can use this config:" -ForegroundColor Green
$config = @'
{
  "mcpServers": {
    "axion-planetary": {
      "command": "npx",
      "args": ["axion-planetary-mcp"],
      "env": {
        "AXION_API_URL": "https://axion-planetary-mcp.onrender.com"
      }
    }
  }
}
'@
Write-Host $config -ForegroundColor Yellow

Write-Host "`nPress Enter to open Render Dashboard..." -ForegroundColor Cyan
Read-Host
$url = 'https://dashboard.render.com/create/web?repo=https://github.com/Dhenenjay/axion-planetary-mcp'
Start-Process $url
