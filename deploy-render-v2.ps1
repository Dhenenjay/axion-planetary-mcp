# PowerShell script to deploy to Render with GEE credentials - Version 2 with timeouts

$ErrorActionPreference = "Stop"

$RENDER_API_KEY = "rnd_HrUPmuClpea4qQYltm9hs8YfWEgw"
$GEE_CREDENTIALS_PATH = "C:\Users\Dhenenjay\Downloads\axion-orbital-46448075249c.json"

# Read GEE credentials
if (Test-Path $GEE_CREDENTIALS_PATH) {
    $GEE_CREDENTIALS = Get-Content $GEE_CREDENTIALS_PATH -Raw
    Write-Host "✓ Loaded GEE credentials" -ForegroundColor Green
} else {
    Write-Host "✗ GEE credentials file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Deploying to Render..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# Function to make API calls with timeout
function Invoke-RenderAPI {
    param(
        [string]$Uri,
        [string]$Method = "Get",
        [object]$Body = $null,
        [int]$TimeoutSec = 10
    )
    
    try {
        $params = @{
            Uri = $Uri
            Headers = $headers
            Method = $Method
            TimeoutSec = $TimeoutSec
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        return Invoke-RestMethod @params
    } catch {
        Write-Host "API Error: $_" -ForegroundColor Red
        return $null
    }
}

Write-Host "Checking for existing service..." -ForegroundColor Yellow

# Check if service exists (with timeout)
$services = Invoke-RenderAPI -Uri "https://api.render.com/v1/services" -TimeoutSec 15

if ($services) {
    $existingService = $services | Where-Object { $_.service.name -eq "axion-planetary-mcp" }
    
    if ($existingService) {
        Write-Host "✓ Found existing service: $($existingService.service.id)" -ForegroundColor Green
        $serviceId = $existingService.service.id
        
        # Update environment variables
        Write-Host "Updating environment variables..." -ForegroundColor Yellow
        
        $envVarPayload = @(
            @{
                key = "GOOGLE_APPLICATION_CREDENTIALS_JSON"
                value = $GEE_CREDENTIALS
            },
            @{
                key = "NODE_ENV"
                value = "production"
            },
            @{
                key = "ANALYTICS_ENABLED"  
                value = "true"
            },
            @{
                key = "CORS_ORIGIN"
                value = "*"
            }
        )
        
        $envUpdateBody = @{ envVars = $envVarPayload }
        
        $result = Invoke-RenderAPI `
            -Uri "https://api.render.com/v1/services/$serviceId/env-vars" `
            -Method "Put" `
            -Body $envUpdateBody `
            -TimeoutSec 20
            
        if ($result) {
            Write-Host "✓ Environment variables updated" -ForegroundColor Green
        }
        
        # Trigger deployment
        Write-Host "Triggering new deployment..." -ForegroundColor Yellow
        $deployResult = Invoke-RenderAPI `
            -Uri "https://api.render.com/v1/services/$serviceId/deploys" `
            -Method "Post" `
            -Body @{ clearCache = "clear" } `
            -TimeoutSec 10
            
        if ($deployResult) {
            Write-Host "✓ Deployment triggered successfully!" -ForegroundColor Green
            Write-Host "Deploy ID: $($deployResult.id)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "Service not found. Please create it manually via Render Dashboard." -ForegroundColor Yellow
        Write-Host "1. Go to: https://dashboard.render.com/create/web" -ForegroundColor White
        Write-Host "2. Connect GitHub repo: Dhenenjay/axion-planetary-mcp" -ForegroundColor White
        Write-Host "3. Use these settings:" -ForegroundColor White
        Write-Host "   - Build Command: npm install && npm run build:next" -ForegroundColor Gray
        Write-Host "   - Start Command: npm run start:prod" -ForegroundColor Gray
    }
}
else {
    Write-Host "Could not connect to Render API. Check your API key." -ForegroundColor Red
}

Write-Host "`n📍 Service URL: https://axion-planetary-mcp.onrender.com" -ForegroundColor Green
Write-Host "📊 Dashboard: https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "`n✅ Deployment script completed!" -ForegroundColor Green