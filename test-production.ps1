# MCP SERVER PRODUCTION TEST
# Simple, working version

param(
    [string]$KeyPath = "C:\Users\Dhenenjay\Downloads\ee-key.json"
)

Write-Host "`n=== MCP Server Production Test ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check environment
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow
$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath

if (Test-Path $KeyPath) {
    Write-Host "  ✓ Service account key found" -ForegroundColor Green
}
else {
    Write-Host "  ✗ Service account key not found" -ForegroundColor Red
    exit 1
}

# 2. Start server
Write-Host "[2/5] Starting server..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$server = Start-Process powershell -ArgumentList "-Command", "cd '$PWD'; `$env:GOOGLE_APPLICATION_CREDENTIALS='$KeyPath'; npx next dev" -WindowStyle Hidden -PassThru
Write-Host "  Server process started (PID: $($server.Id))" -ForegroundColor Gray
Write-Host "  Waiting 30 seconds for startup..." -ForegroundColor Gray
Start-Sleep -Seconds 30

# 3. Test server connection
Write-Host "[3/5] Testing server connection..." -ForegroundColor Yellow
$serverReady = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        $serverReady = $true
        Write-Host "  ✓ Server is responding" -ForegroundColor Green
    }
}
catch {
    Write-Host "  ✗ Server not responding" -ForegroundColor Red
}

if (-not $serverReady) {
    Write-Host "  Trying again..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" -Method GET -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-Host "  ✓ Server is now responding" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ✗ Server failed to start" -ForegroundColor Red
        Stop-Process -Id $server.Id -Force
        exit 1
    }
}

# 4. Test core functionality
Write-Host "[4/5] Testing core functionality..." -ForegroundColor Yellow

# Test authentication
Write-Host "  Testing authentication..." -ForegroundColor Gray
$authBody = @{
    tool = "earth_engine_system"
    arguments = @{
        operation = "auth"
        checkType = "status"
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $authBody -ContentType "application/json" -TimeoutSec 10
    if ($result.authenticated) {
        Write-Host "    ✓ Authenticated" -ForegroundColor Green
    }
    else {
        Write-Host "    ✗ Not authenticated" -ForegroundColor Red
    }
}
catch {
    Write-Host "    ✗ Auth test failed: $_" -ForegroundColor Red
}

# Test data search
Write-Host "  Testing data search..." -ForegroundColor Gray
$searchBody = @{
    tool = "earth_engine_data"
    arguments = @{
        operation = "search"
        query = "sentinel"
        limit = 3
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $searchBody -ContentType "application/json" -TimeoutSec 10
    if ($result.datasets) {
        Write-Host "    ✓ Found $($result.count) datasets" -ForegroundColor Green
    }
    else {
        Write-Host "    ✗ Search failed" -ForegroundColor Red
    }
}
catch {
    Write-Host "    ✗ Search test failed: $_" -ForegroundColor Red
}

# Test NDVI calculation
Write-Host "  Testing NDVI calculation..." -ForegroundColor Gray
$ndviBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2023-06-01"
        endDate = "2023-08-31"
        region = "San Francisco"
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $ndviBody -ContentType "application/json" -TimeoutSec 30
    if ($result.value -or $result.success) {
        Write-Host "    ✓ NDVI calculated" -ForegroundColor Green
    }
    else {
        Write-Host "    ✗ NDVI failed" -ForegroundColor Red
    }
}
catch {
    Write-Host "    ✗ NDVI test failed: $_" -ForegroundColor Red
}

# 5. Summary
Write-Host "[5/5] Summary" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== Production Readiness ===" -ForegroundColor Cyan

if ($serverReady) {
    Write-Host "✓ Server: RUNNING" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Run the full test suite: .\ultimate-mcp-server-test.ps1" -ForegroundColor Gray
    Write-Host "2. Check server logs for any warnings" -ForegroundColor Gray
    Write-Host "3. Configure production environment variables" -ForegroundColor Gray
    Write-Host "4. Set up process manager (PM2) for production" -ForegroundColor Gray
    Write-Host "5. Configure reverse proxy (nginx)" -ForegroundColor Gray
}
else {
    Write-Host "✗ Server: NOT READY" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before deployment" -ForegroundColor Red
}

# Cleanup
Write-Host ""
Write-Host "Stopping server..." -ForegroundColor Gray
Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green
