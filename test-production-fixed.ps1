# Earth Engine MCP Server Production Test - FIXED VERSION
# Tests all tools end-to-end with the correct SSE endpoint

param(
    [string]$ServiceAccountPath = "C:\Users\Dhenenjay\Downloads\ee-key.json",
    [string]$ServerPort = "3000",
    [int]$TestTimeout = 30
)

# Enhanced error handling and output formatting
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Test results tracking
$TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Errors = @()
    Details = @()
}

function Write-TestResult {
    param([string]$Test, [bool]$Success, [string]$Message, [string]$Details = "")
    
    $TestResults.Total++
    $status = if ($Success) { "PASS"; $TestResults.Passed++ } else { "FAIL"; $TestResults.Failed++; $TestResults.Errors += "$Test`: $Message" }
    $color = if ($Success) { "Green" } else { "Red" }
    
    Write-Host "[$status] $Test" -ForegroundColor $color
    if ($Message) { Write-Host "      $Message" -ForegroundColor Gray }
    if ($Details -and !$Success) { Write-Host "      $Details" -ForegroundColor DarkRed }
    
    $TestResults.Details += [PSCustomObject]@{
        Test = $Test
        Status = $status
        Message = $Message
        Details = $Details
    }
}

function Test-SSEEndpoint {
    param([string]$Endpoint, [hashtable]$Body, [string]$TestName)
    
    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Uri "http://localhost:$ServerPort$Endpoint" -Method POST -Body $jsonBody -ContentType "application/json" -TimeoutSec $TestTimeout
        
        if ($response -and $response.success) {
            Write-TestResult $TestName $true "Success: $($response.message)"
            return $response
        } elseif ($response) {
            Write-TestResult $TestName $false "Operation returned: $($response.message)" $($response | ConvertTo-Json -Depth 3)
            return $response
        } else {
            Write-TestResult $TestName $false "No response received"
            return $null
        }
    }
    catch {
        Write-TestResult $TestName $false "Request failed: $($_.Exception.Message)" $_.Exception.ToString()
        return $null
    }
}

Write-Host "`n=== EARTH ENGINE MCP SERVER PRODUCTION TEST - FIXED ===" -ForegroundColor Cyan
Write-Host "Testing comprehensive functionality with proper SSE endpoint" -ForegroundColor Yellow

# [1] Environment Validation
Write-Host "`n[1/8] Environment Validation" -ForegroundColor Yellow

# Check service account
if (Test-Path $ServiceAccountPath) {
    Write-TestResult "Service Account File" $true "Found at $ServiceAccountPath"
} else {
    Write-TestResult "Service Account File" $false "Not found at $ServiceAccountPath"
    exit 1
}

# Set environment variable
$env:GOOGLE_APPLICATION_CREDENTIALS = $ServiceAccountPath
Write-TestResult "Environment Variable" $true "GOOGLE_APPLICATION_CREDENTIALS set"

# Check Node.js
try {
    $nodeVersion = & "C:\Program Files\nodejs\node.exe" --version
    Write-TestResult "Node.js Version" $true "Version: $nodeVersion"
} catch {
    Write-TestResult "Node.js" $false "Node.js not found or not working"
    exit 1
}

# [2] Server Startup
Write-Host "`n[2/8] Server Management" -ForegroundColor Yellow

# Kill existing processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-TestResult "Process Cleanup" $true "Killed existing Node.js processes"

# Start server
Write-Host "  • Starting Next.js server..." -ForegroundColor Gray
$serverProcess = Start-Process "C:\Program Files\nodejs\node.exe" -ArgumentList @(
    "C:\Users\Dhenenjay\AppData\Roaming\npm\node_modules\npm\bin\npx-cli.js",
    "next", "dev", "--port", $ServerPort
) -WorkingDirectory $PWD -PassThru

Write-Host "  • Server PID: $($serverProcess.Id)" -ForegroundColor Gray
Write-Host "  • Waiting for startup (30s)..." -ForegroundColor Gray

# Wait for server with progress
for ($i = 1; $i -le 30; $i++) {
    Write-Progress -Activity "Starting Next.js server" -Status "$i/30 seconds" -PercentComplete (($i/30)*100)
    Start-Sleep -Seconds 1
}
Write-Progress -Activity "Starting Next.js server" -Completed

# [3] Server Connectivity
Write-Host "`n[3/8] Server Connectivity" -ForegroundColor Yellow

$serverRunning = $false
$maxRetries = 5

for ($retry = 1; $retry -le $maxRetries; $retry++) {
    try {
        Write-Host "  • Connection test $retry/$maxRetries..." -ForegroundColor Gray
        # Test the correct SSE endpoint
        $response = Invoke-WebRequest -Uri "http://localhost:$ServerPort/api/mcp/sse" -Method GET -TimeoutSec 10 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 405) {
            $serverRunning = $true
            Write-TestResult "Server Connection" $true "Server responding on port $ServerPort (Status: $($response.StatusCode))"
            break
        }
    }
    catch {
        if ($retry -eq $maxRetries) {
            Write-TestResult "Server Connection" $false "Failed after $maxRetries attempts: $($_.Exception.Message)"
            exit 1
        }
        Start-Sleep -Seconds 3
    }
}

# [4] Authentication Test
Write-Host "`n[4/8] Authentication & Basic Operations" -ForegroundColor Yellow

# Test dataset search
$searchResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_data"
    arguments = @{
        operation = "search"
        query = "Sentinel-2"
    }
} "Dataset Search"

# Test geometry resolution
$geometryResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_data"
    arguments = @{
        operation = "geometry"
        placeName = "Los Angeles"
    }
} "Geometry Resolution"

# [5] Data Operations
Write-Host "`n[5/8] Data Operations" -ForegroundColor Yellow

# Test data filtering
$filterResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_data"
    arguments = @{
        operation = "filter"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        limit = 10
    }
} "Data Filtering"

# Test composite creation
$compositeResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        compositeType = "median"
        scale = 30
    }
} "Composite Creation"

# [6] Processing Operations
Write-Host "`n[6/8] Processing Operations" -ForegroundColor Yellow

# Test NDVI calculation
$ndviResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        indexType = "NDVI"
        scale = 30
    }
} "NDVI Calculation"

# Test NDWI calculation
$ndwiResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        indexType = "NDWI"
        scale = 30
    }
} "NDWI Calculation"

# [7] Export Operations - Fixed Implementation
Write-Host "`n[7/8] Export Operations (Fixed)" -ForegroundColor Yellow

# Test thumbnail generation from dataset (direct)
$thumbnailResult1 = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        dimensions = 512
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 3000
            gamma = 1.4
        }
    }
} "Thumbnail Generation (Direct Dataset)"

# Test thumbnail with false color composite
$thumbnailResult2 = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        dimensions = 512
        visParams = @{
            bands = @("B8", "B4", "B3")
            min = 0
            max = 4000
            gamma = 1.2
        }
    }
} "Thumbnail Generation (False Color)"

# Test thumbnail with SWIR composite
$thumbnailResult3 = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        dimensions = 512
        visParams = @{
            bands = @("B12", "B8", "B4")
            min = 0
            max = 3500
            gamma = 1.3
        }
    }
} "Thumbnail Generation (SWIR)"

# [8] System Analysis
Write-Host "`n[8/8] System Analysis" -ForegroundColor Yellow

# Test system information
$systemResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_system"
    arguments = @{
        operation = "info"
    }
} "System Information"

# Test dataset info
$datasetInfoResult = Test-SSEEndpoint "/api/mcp/sse" @{
    tool = "earth_engine_system"
    arguments = @{
        operation = "dataset_info"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    }
} "Dataset Information"

# [9] Final Results
Write-Host "`n=== TEST RESULTS SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total Tests: $($TestResults.Total)" -ForegroundColor White
Write-Host "Passed: $($TestResults.Passed)" -ForegroundColor Green
Write-Host "Failed: $($TestResults.Failed)" -ForegroundColor Red

if ($TestResults.Failed -gt 0) {
    Write-Host "`nFAILED TESTS:" -ForegroundColor Red
    foreach ($error in $TestResults.Errors) {
        Write-Host "  • $error" -ForegroundColor DarkRed
    }
}

$successRate = [math]::Round(($TestResults.Passed / $TestResults.Total) * 100, 1)
Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } else { "Red" })

# Cleanup
Write-Host "`n[CLEANUP] Stopping test server..." -ForegroundColor Gray
$serverProcess | Stop-Process -Force -ErrorAction SilentlyContinue

if ($TestResults.Failed -eq 0) {
    Write-Host "`n✅ ALL TESTS PASSED - SERVER IS READY FOR PRODUCTION!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Some tests failed - review errors above" -ForegroundColor Red
    exit 1
}
