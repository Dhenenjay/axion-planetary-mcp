# Test Tile Service Functionality
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "TESTING TILE SERVICE FUNCTIONALITY" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

function Test-TileService {
    param(
        [hashtable]$Arguments,
        [string]$TestName,
        [int]$Timeout = 60
    )
    
    Write-Host "TEST: $TestName" -ForegroundColor Yellow
    Write-Host "  Creating composite first..." -ForegroundColor Gray
    
    # First create a composite to use for tiles
    $compositeBody = @{
        tool = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = $Arguments.datasetId
            startDate = $Arguments.startDate
            endDate = $Arguments.endDate
            region = $Arguments.region
            compositeType = "median"
            cloudCoverMax = 30
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $compositeResponse = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $compositeBody `
            -ContentType "application/json" `
            -TimeoutSec 30
        
        if ($compositeResponse.error) {
            Write-Host "  Failed to create composite: $($compositeResponse.error)" -ForegroundColor Red
            return $false
        }
        
        Write-Host "  Composite created: $($compositeResponse.compositeKey)" -ForegroundColor Green
        
        # Now create tile service
        Write-Host "  Generating tile service..." -ForegroundColor Gray
        
        $tilesBody = @{
            tool = "earth_engine_export"
            arguments = @{
                operation = "tiles"
                compositeKey = $compositeResponse.compositeKey
                region = $Arguments.region
                visParams = $Arguments.visParams
            }
        } | ConvertTo-Json -Depth 10
        
        $tilesResponse = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $tilesBody `
            -ContentType "application/json" `
            -TimeoutSec $Timeout
        
        if ($tilesResponse.error) {
            Write-Host "  Failed to create tiles: $($tilesResponse.error)" -ForegroundColor Red
            return $false
        }
        
        Write-Host "  SUCCESS" -ForegroundColor Green
        if ($tilesResponse.tileUrl) {
            Write-Host "  Tile URL: $($tilesResponse.tileUrl)" -ForegroundColor Cyan
        }
        if ($tilesResponse.mapId) {
            Write-Host "  Map ID: $($tilesResponse.mapId)" -ForegroundColor Cyan
        }
        
        return $true
    }
    catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test 1: Sentinel-2 tiles
Write-Host ""
$test1 = Test-TileService -Arguments @{
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-15"
    region = "San Francisco"
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 0.3
        gamma = 1.4
    }
} -TestName "Sentinel-2 RGB Tile Service" -Timeout 60

Start-Sleep -Seconds 2

# Test 2: Direct tiles without composite (using dataset directly)
Write-Host ""
Write-Host "TEST: Direct tile generation from dataset" -ForegroundColor Yellow

$directBody = @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "tiles"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-15"
        region = "Los Angeles"
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $directBody `
        -ContentType "application/json" `
        -TimeoutSec 90
    
    if ($response.error) {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $test2 = $false
    } else {
        Write-Host "  SUCCESS" -ForegroundColor Green
        if ($response.tileUrl) {
            Write-Host "  Tile URL: $($response.tileUrl)" -ForegroundColor Cyan
        }
        $test2 = $true
    }
}
catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $test2 = $false
}

# Summary
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor White
Write-Host "===================================" -ForegroundColor Cyan

$tests = @($test1, $test2)
$passed = ($tests | Where-Object { $_ -eq $true }).Count
$failed = ($tests | Where-Object { $_ -eq $false }).Count

Write-Host "Total Tests: $($tests.Count)" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($passed -eq $tests.Count) {
    Write-Host ""
    Write-Host "TILE SERVICE IS FULLY FUNCTIONAL!" -ForegroundColor Green
    Write-Host "You can use the tile URLs in web mapping applications." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "TILE SERVICE HAS ISSUES" -ForegroundColor Red
    Write-Host "Check server logs for timeout or processing errors." -ForegroundColor Yellow
}
