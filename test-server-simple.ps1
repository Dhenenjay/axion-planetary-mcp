# Simple Earth Engine MCP Server Test
# Quick tests to verify server functionality

$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "EARTH ENGINE MCP SERVER - QUICK TEST" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

function Send-Request {
    param(
        [string]$Tool,
        [hashtable]$Arguments,
        [string]$TestName
    )
    
    Write-Host "TEST: $TestName" -ForegroundColor Yellow
    Write-Host "  Tool: $Tool" -ForegroundColor Gray
    
    $body = @{
        tool = $Tool
        arguments = $Arguments
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 30
        
        if ($response.error) {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            return $false
        }
        
        Write-Host "  SUCCESS" -ForegroundColor Green
        
        # Show results
        if ($response.imageCount) {
            Write-Host "  Found $($response.imageCount) images" -ForegroundColor Cyan
        }
        if ($response.compositeKey) {
            Write-Host "  Composite Key: $($response.compositeKey)" -ForegroundColor Cyan
        }
        if ($response.url) {
            Write-Host "  Thumbnail URL: $($response.url)" -ForegroundColor Cyan
        }
        if ($response.tileUrl) {
            Write-Host "  Tile URL: $($response.tileUrl)" -ForegroundColor Cyan
        }
        
        return $true
    }
    catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test 1: Search for datasets
Write-Host ""
Write-Host "=== TEST 1: Search Datasets ===" -ForegroundColor White
$test1 = Send-Request -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "sentinel"
    limit = 5
} -TestName "Search for Sentinel datasets"

Start-Sleep -Seconds 1

# Test 2: Filter Sentinel-2 imagery
Write-Host ""
Write-Host "=== TEST 2: Filter Imagery ===" -ForegroundColor White
$test2 = Send-Request -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2025-01-01"
    endDate = "2025-01-10"
    region = "Los Angeles"
    cloudCoverMax = 20
} -TestName "Filter Sentinel-2 for LA (Jan 2025)"

Start-Sleep -Seconds 1

# Test 3: Create composite
Write-Host ""
Write-Host "=== TEST 3: Create Composite ===" -ForegroundColor White
$test3 = Send-Request -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-31"
    region = "San Francisco"
    compositeType = "median"
    cloudCoverMax = 30
} -TestName "Create median composite for SF"

Start-Sleep -Seconds 1

# Test 4: Calculate NDVI
Write-Host ""
Write-Host "=== TEST 4: Calculate NDVI ===" -ForegroundColor White
$test4 = Send-Request -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-15"
    region = "Los Angeles"
} -TestName "Calculate NDVI for Los Angeles"

# Summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan

$tests = @($test1, $test2, $test3, $test4)
$passed = ($tests | Where-Object { $_ -eq $true }).Count
$failed = ($tests | Where-Object { $_ -eq $false }).Count

Write-Host "Total Tests: $($tests.Count)" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($passed -eq $tests.Count) {
    Write-Host ""
    Write-Host "ALL TESTS PASSED! Server is working correctly." -ForegroundColor Green
} elseif ($passed -gt 0) {
    Write-Host ""
    Write-Host "PARTIAL SUCCESS: Some operations are working." -ForegroundColor Yellow
    Write-Host "Check server logs for error details." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "ALL TESTS FAILED! Check if server is running." -ForegroundColor Red
    Write-Host "Server should be at: http://localhost:3000" -ForegroundColor Red
}

Write-Host ""
Write-Host "TIP: Watch your server console for detailed logs" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
