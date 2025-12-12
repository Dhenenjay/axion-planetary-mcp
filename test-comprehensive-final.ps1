# Comprehensive Test Suite for Earth Engine MCP Server
# Tests all 4 consolidated tools with all operations

$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  COMPREHENSIVE MCP TEST SUITE" -ForegroundColor Magenta
Write-Host "  Testing ALL Operations (Fixed)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$testResults = @()
$passed = 0
$failed = 0
$total = 0

function Test-Operation {
    param(
        [string]$Tool,
        [string]$Operation,
        [hashtable]$Args,
        [string]$Description
    )
    
    $global:total++
    Write-Host "[$global:total] $Description" -NoNewline
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $Tool
            arguments = $Args
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30 -ErrorAction Stop
        
        if ($response.result -and (-not $response.result.error)) {
            Write-Host " ✓" -ForegroundColor Green
            $global:passed++
            return @{
                Success = $true
                Tool = $Tool
                Operation = $Operation
                Description = $Description
                Result = $response.result
            }
        } else {
            Write-Host " ✗" -ForegroundColor Red
            if ($response.result.error) {
                Write-Host "    Error: $($response.result.error)" -ForegroundColor Yellow
            }
            $global:failed++
            return @{
                Success = $false
                Tool = $Tool
                Operation = $Operation
                Description = $Description
                Error = $response.result.error
            }
        }
    } catch {
        Write-Host " ✗ ERROR" -ForegroundColor Red
        Write-Host "    Exception: $_" -ForegroundColor Yellow
        $global:failed++
        return @{
            Success = $false
            Tool = $Tool
            Operation = $Operation
            Description = $Description
            Error = $_.Exception.Message
        }
    }
}

Write-Host "`n==== EARTH ENGINE DATA TOOL ====" -ForegroundColor Cyan

# Test 1: Search datasets
$testResults += Test-Operation `
    -Tool "earth_engine_data" `
    -Operation "search" `
    -Args @{
        operation = "search"
        query = "Sentinel-2"
        limit = 5
    } `
    -Description "Search for Sentinel-2 datasets"

# Test 2: Get dataset info (Fixed)
$testResults += Test-Operation `
    -Tool "earth_engine_data" `
    -Operation "info" `
    -Args @{
        operation = "info"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    } `
    -Description "Get dataset info (optimized)"

# Test 3: Get geometry
$testResults += Test-Operation `
    -Tool "earth_engine_data" `
    -Operation "geometry" `
    -Args @{
        operation = "geometry"
        placeName = "San Francisco"
    } `
    -Description "Get geometry for San Francisco"

# Test 4: Get coordinate geometry
$testResults += Test-Operation `
    -Tool "earth_engine_data" `
    -Operation "geometry" `
    -Args @{
        operation = "geometry"
        coordinates = @(-122.4194, 37.7749, 10000)
    } `
    -Description "Get geometry from coordinates"

# Test 5: Filter collection
$testResults += Test-Operation `
    -Tool "earth_engine_data" `
    -Operation "filter" `
    -Args @{
        operation = "filter"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        cloudCoverMax = 20
    } `
    -Description "Filter Sentinel-2 collection"

# Test 6: List boundaries
$testResults += Test-Operation `
    -Tool "earth_engine_data" `
    -Operation "boundaries" `
    -Args @{
        operation = "boundaries"
    } `
    -Description "List available boundaries"

Write-Host "`n==== EARTH ENGINE PROCESS TOOL ====" -ForegroundColor Cyan

# Test 7: Calculate NDVI
$testResults += Test-Operation `
    -Tool "earth_engine_process" `
    -Operation "index" `
    -Args @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
    } `
    -Description "Calculate NDVI index"

# Test 8: Cloud masking (Fixed)
$testResults += Test-Operation `
    -Tool "earth_engine_process" `
    -Operation "mask" `
    -Args @{
        operation = "mask"
        maskType = "clouds"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
    } `
    -Description "Apply cloud masking"

# Test 9: Create composite
$testResults += Test-Operation `
    -Tool "earth_engine_process" `
    -Operation "composite" `
    -Args @{
        operation = "composite"
        compositeType = "median"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
    } `
    -Description "Create median composite"

# Test 10: Time series analysis (Fixed)
$testResults += Test-Operation `
    -Tool "earth_engine_process" `
    -Operation "analyze" `
    -Args @{
        operation = "analyze"
        analysisType = "timeseries"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-01-01"
        endDate = "2024-03-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
        reducer = "mean"
    } `
    -Description "Time series analysis (fixed)"

# Test 11: Statistical analysis
$testResults += Test-Operation `
    -Tool "earth_engine_process" `
    -Operation "analyze" `
    -Args @{
        operation = "analyze"
        analysisType = "statistics"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
        region = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
        reducer = "mean"
    } `
    -Description "Statistical analysis"

# Test 12: Terrain analysis
$testResults += Test-Operation `
    -Tool "earth_engine_process" `
    -Operation "terrain" `
    -Args @{
        operation = "terrain"
        terrainType = "slope"
    } `
    -Description "Generate slope from DEM"

Write-Host "`n==== EARTH ENGINE EXPORT TOOL ====" -ForegroundColor Cyan

# Test 13: Generate thumbnail (Fixed)
$testResults += Test-Operation `
    -Tool "earth_engine_export" `
    -Operation "thumbnail" `
    -Args @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
        dimensions = 256
    } `
    -Description "Generate thumbnail (fixed)"

# Test 14: Generate map tiles
$testResults += Test-Operation `
    -Tool "earth_engine_export" `
    -Operation "tiles" `
    -Args @{
        operation = "tiles"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
        zoomLevel = 10
    } `
    -Description "Generate map tiles"

# Test 15: Export to GCS (Fixed)
$testResults += Test-Operation `
    -Tool "earth_engine_export" `
    -Operation "export" `
    -Args @{
        operation = "export"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-06-01"
        endDate = "2024-06-15"
        destination = "gcs"
        fileNamePrefix = "test_export_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        scale = 30
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
    } `
    -Description "Export to Google Cloud Storage (fixed)"

# Test 16: Check export status
$testResults += Test-Operation `
    -Tool "earth_engine_export" `
    -Operation "status" `
    -Args @{
        operation = "status"
        taskId = "dummy_task_id"
    } `
    -Description "Check export task status"

Write-Host "`n==== EARTH ENGINE SYSTEM TOOL ====" -ForegroundColor Cyan

# Test 17: Check authentication
$testResults += Test-Operation `
    -Tool "earth_engine_system" `
    -Operation "auth" `
    -Args @{
        operation = "auth"
        checkType = "status"
    } `
    -Description "Check authentication status"

# Test 18: Get system info
$testResults += Test-Operation `
    -Tool "earth_engine_system" `
    -Operation "info" `
    -Args @{
        operation = "info"
        infoType = "system"
    } `
    -Description "Get system information"

# Test 19: Get quota info
$testResults += Test-Operation `
    -Tool "earth_engine_system" `
    -Operation "info" `
    -Args @{
        operation = "info"
        infoType = "quotas"
    } `
    -Description "Get Earth Engine quotas"

# Test 20: Execute custom code
$testResults += Test-Operation `
    -Tool "earth_engine_system" `
    -Operation "execute" `
    -Args @{
        operation = "execute"
        code = "return ee.Number(42).multiply(2).getInfo();"
        language = "javascript"
    } `
    -Description "Execute custom Earth Engine code"

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "         TEST RESULTS SUMMARY" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

Write-Host "`nTotal Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

$successRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }
Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 60) { "Yellow" } else { "Red" })

if ($failed -gt 0) {
    Write-Host "`nFailed Tests:" -ForegroundColor Red
    $testResults | Where-Object { -not $_.Success } | ForEach-Object {
        Write-Host "  - $($_.Description): $($_.Error)" -ForegroundColor Yellow
    }
}

Write-Host "`n========================================" -ForegroundColor Magenta
if ($successRate -eq 100) {
    Write-Host "  [OK] ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "  MCP Server is PRODUCTION READY!" -ForegroundColor Green
} elseif ($successRate -ge 80) {
    Write-Host ("  [OK] MOSTLY WORKING (" + $successRate + "%)" ) -ForegroundColor Green
    Write-Host "  Minor issues remaining" -ForegroundColor Yellow
} else {
    Write-Host ("  [!] NEEDS MORE WORK (" + $successRate + "%)" ) -ForegroundColor Yellow
    Write-Host "  Several operations still failing" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Magenta
