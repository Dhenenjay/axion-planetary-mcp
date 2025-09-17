# PowerShell script to deploy to Render with GEE credentials

$RENDER_API_KEY = "rnd_HrUPmuClpea4qQYltm9hs8YfWEgw"
$GEE_CREDENTIALS = Get-Content "C:\Users\Dhenenjay\Downloads\axion-orbital-46448075249c.json" -Raw

# Create the service on Render
Write-Host "Creating Render service..." -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Content-Type" = "application/json"
}

# First check if service already exists
$services = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Headers $headers -Method Get

$existingService = $services | Where-Object { $_.service.name -eq "axion-planetary-mcp" }

if ($existingService) {
    Write-Host "Service already exists. Updating environment variables..." -ForegroundColor Yellow
    $serviceId = $existingService.service.id
    
    # Update environment variables
    $envVars = @(
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
        },
        @{
            key = "PORT"
            value = "10000"
        }
    )
    
    foreach ($envVar in $envVars) {
        $body = @{
            key = $envVar.key
            value = $envVar.value
        } | ConvertTo-Json
        
        try {
            Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/env-vars" `
                -Headers $headers `
                -Method Put `
                -Body $body
            Write-Host "Set $($envVar.key)" -ForegroundColor Green
        } catch {
            Write-Host "Error setting $($envVar.key): $_" -ForegroundColor Red
        }
    }
    
    # Trigger a manual deploy
    Write-Host "Triggering deployment..." -ForegroundColor Green
    $deployBody = @{
        clearCache = "clear"
    } | ConvertTo-Json
    
    try {
        $deploy = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys" `
            -Headers $headers `
            -Method Post `
            -Body $deployBody
        Write-Host "Deployment triggered! ID: $($deploy.id)" -ForegroundColor Green
    } catch {
        Write-Host "Error triggering deployment: $_" -ForegroundColor Red
    }
    
} else {
    Write-Host "Creating new service..." -ForegroundColor Green
    
    # Create service from blueprint
    $body = @{
        type = "web"
        name = "axion-planetary-mcp"
        repo = "https://github.com/Dhenenjay/axion-planetary-mcp"
        branch = "master"
        region = "oregon"
        plan = "free"
        buildCommand = "npm install && npm run build:next && npm run build"
        startCommand = "npm run start:prod"
        healthCheckPath = "/api/health"
        envVars = @(
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
            },
            @{
                key = "PORT"
                value = "10000"
            }
        )
        autoDeploy = $true
    } | ConvertTo-Json -Depth 10
    
    try {
        $service = Invoke-RestMethod -Uri "https://api.render.com/v1/services" `
            -Headers $headers `
            -Method Post `
            -Body $body
        Write-Host "Service created! ID: $($service.service.id)" -ForegroundColor Green
        Write-Host "URL: https://$($service.service.name).onrender.com" -ForegroundColor Cyan
    } catch {
        Write-Host "Error creating service: $_" -ForegroundColor Red
        Write-Host "You may need to use the Render dashboard to create the service manually." -ForegroundColor Yellow
    }
}

Write-Host "`nDeployment initiated! Monitor progress at: https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "Service will be available at: https://axion-planetary-mcp.onrender.com" -ForegroundColor Green