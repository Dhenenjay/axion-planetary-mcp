# Final Render Deployment Script
$ErrorActionPreference = "Stop"

Write-Host "Starting Render Deployment Process" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Configuration
$RENDER_API_KEY = "rnd_HrUPmuClpea4qQYltm9hs8YfWEgw"
$GEE_CREDS_PATH = "C:\Users\Dhenenjay\Downloads\axion-orbital-46448075249c.json"

# Read GEE credentials
Write-Host "`nReading GEE credentials..." -ForegroundColor Yellow
$GEE_JSON = Get-Content $GEE_CREDS_PATH -Raw
Write-Host "✓ GEE credentials loaded" -ForegroundColor Green

# Prepare the service creation payload
Write-Host "`nPreparing service configuration..." -ForegroundColor Yellow

$serviceConfig = @{
    type = "web"
    name = "axion-planetary-mcp"
    ownerId = "usr-cng1ahhpnu9d5vevqii0"
    repo = "https://github.com/Dhenenjay/axion-planetary-mcp"
    autoDeploy = "yes"
    branch = "master"
    buildCommand = "npm install && npm run build:next"
    startCommand = "npm run start:prod"
    healthCheckPath = "/api/health"
    region = "oregon"
    plan = "free"
    envVars = @(
        @{
            key = "GOOGLE_APPLICATION_CREDENTIALS_JSON"
            value = $GEE_JSON
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
        },
        @{
            key = "PORT"
            value = "10000"
        }
    )
} | ConvertTo-Json -Depth 5 -Compress

# Save to temp file for curl
$tempFile = "$env:TEMP\render-service.json"
Set-Content -Path $tempFile -Value $serviceConfig

Write-Host "✓ Configuration prepared" -ForegroundColor Green

# Check if service exists first
Write-Host "`nChecking for existing service..." -ForegroundColor Yellow

$checkResult = curl.exe -s -X GET `
    "https://api.render.com/v1/services?type=web&name=axion-planetary-mcp&limit=1" `
    -H "Authorization: Bearer $RENDER_API_KEY" `
    -H "Accept: application/json" 2>$null

if ($checkResult -match '"id":"srv-') {
    Write-Host "✓ Found existing service" -ForegroundColor Green
    
    # Extract service ID
    if ($checkResult -match '"id":"(srv-[^"]+)"') {
        $serviceId = $Matches[1]
        Write-Host "Service ID: $serviceId" -ForegroundColor Cyan
        
        # Update environment variables
        Write-Host "`nUpdating environment variables..." -ForegroundColor Yellow
        
        $envUpdate = @{
            envVars = @(
                @{
                    key = "GOOGLE_APPLICATION_CREDENTIALS_JSON"
                    value = $GEE_JSON
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
        } | ConvertTo-Json -Depth 3 -Compress
        
        $envTempFile = "$env:TEMP\render-env.json"
        Set-Content -Path $envTempFile -Value $envUpdate
        
        $updateResult = curl.exe -s -X PUT `
            "https://api.render.com/v1/services/$serviceId/env-vars" `
            -H "Authorization: Bearer $RENDER_API_KEY" `
            -H "Accept: application/json" `
            -H "Content-Type: application/json" `
            -d "@$envTempFile" 2>$null
            
        if ($updateResult -match "error") {
            Write-Host "Warning: Could not update env vars" -ForegroundColor Yellow
        } else {
            Write-Host "✓ Environment variables updated" -ForegroundColor Green
        }
        
        # Trigger new deployment
        Write-Host "`nTriggering deployment..." -ForegroundColor Yellow
        
        $deployResult = curl.exe -s -X POST `
            "https://api.render.com/v1/services/$serviceId/deploys" `
            -H "Authorization: Bearer $RENDER_API_KEY" `
            -H "Accept: application/json" `
            -H "Content-Type: application/json" `
            -d '{"clearCache":"clear"}' 2>$null
            
        if ($deployResult -match '"id":"dep-') {
            Write-Host "✓ Deployment triggered successfully!" -ForegroundColor Green
            if ($deployResult -match '"id":"(dep-[^"]+)"') {
                Write-Host "Deploy ID: $($Matches[1])" -ForegroundColor Cyan
            }
        } else {
            Write-Host "Warning: Could not trigger deployment" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Service not found. Creating new service..." -ForegroundColor Yellow
    
    # Create new service
    $createResult = curl.exe -s -X POST `
        "https://api.render.com/v1/services" `
        -H "Authorization: Bearer $RENDER_API_KEY" `
        -H "Accept: application/json" `
        -H "Content-Type: application/json" `
        -d "@$tempFile" 2>$null
    
    if ($createResult -match '"id":"srv-') {
        Write-Host "✓ Service created successfully!" -ForegroundColor Green
        if ($createResult -match '"id":"(srv-[^"]+)"') {
            Write-Host "Service ID: $($Matches[1])" -ForegroundColor Cyan
        }
    } else {
        Write-Host "Could not create service automatically." -ForegroundColor Red
        Write-Host "Error response: $createResult" -ForegroundColor Gray
        Write-Host "`nPlease create manually at:" -ForegroundColor Yellow
        Write-Host "https://dashboard.render.com/create/web" -ForegroundColor Cyan
    }
}

# Clean up temp files
Remove-Item $tempFile -ErrorAction SilentlyContinue
if (Test-Path $envTempFile) { Remove-Item $envTempFile -ErrorAction SilentlyContinue }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment Process Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n📍 Service URL: https://axion-planetary-mcp.onrender.com" -ForegroundColor Cyan
Write-Host "📊 Dashboard: https://dashboard.render.com/web/srv-services" -ForegroundColor Cyan
Write-Host "`nNote: First deployment takes 10-15 minutes" -ForegroundColor Yellow
Write-Host "Check deployment status in the Render dashboard" -ForegroundColor Yellow