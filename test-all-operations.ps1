# Comprehensive test for EVERY operation in Earth Engine MCP Server
# No fallbacks - everything must work 100%

$baseUrl = "http://localhost:3000/stdio"
$passed = 0
$failed = 0
$testResults = @()

function Test-Operation {
    param($tool, $args, $description)
    
    Write-Host "`nTesting: $description" -NoNewline
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $tool
            arguments = $args
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
        
        if ($response.result -and (-not $response.result.error) -and (-not $response.result.success -eq $false)) {
            Write-Host " ✓ PASS" -ForegroundColor Green
            $script:passed++
            return @{Success=$true; Test=$description; Result=$response.result}
        } else {
            Write-Host " ✗ FAIL" -ForegroundColor Red
            if ($response.result.error) {
                Write-Host "  Error: $($response.result.error)" -ForegroundColor Yellow
            }
            $script:failed++
            return @{Success=$false; Test=$description; Error=$response.result.error}
        }
    } catch {
        Write-Host " ✗ ERROR" -ForegroundColor Red
        Write-Host "  Exception: $_" -ForegroundColor Yellow
        $script:failed++
        return @{Success=$false; Test=$description; Error=$_.ToString()}
    }
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host " TESTING ALL EARTH ENGINE MCP OPERATIONS" -ForegroundColor Cyan
Write-Host " Requirement: 100% Success Rate" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# EARTH ENGINE DATA TOOL - ALL OPERATIONS
Write-Host "`n=== EARTH ENGINE DATA TOOL ===" -ForegroundColor Yellow

$testResults += Test-Operation "earth_engine_data" @{
    operation = "search"
    query = "sentinel"
    limit = 5
} "Data.1: Search for Sentinel datasets"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "search"
    query = "landsat"
    limit = 3
} "Data.2: Search for Landsat datasets"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
} "Data.3: Get Sentinel-2 dataset info"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "info"
    datasetId = "LANDSAT/LC08/C02/T1_L2"
} "Data.4: Get Landsat 8 dataset info"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "info"
    datasetId = "USGS/SRTMGL1_003"
} "Data.5: Get SRTM elevation info"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    cloudCoverMax = 20
} "Data.6: Filter collection with cloud cover"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "geometry"
    placeName = "San Francisco"
} "Data.7: Get geometry for San Francisco"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "geometry"
    placeName = "Ludhiana"
} "Data.8: Get geometry for Ludhiana"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "geometry"
    coordinates = @(-122.4194, 37.7749, 10000)
} "Data.9: Get geometry from coordinates"

$testResults += Test-Operation "earth_engine_data" @{
    operation = "boundaries"
} "Data.10: List available boundaries"

# EARTH ENGINE PROCESS TOOL - ALL OPERATIONS
Write-Host "`n=== EARTH ENGINE PROCESS TOOL ===" -ForegroundColor Yellow

$testResults += Test-Operation "earth_engine_process" @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
} "Process.1: Calculate NDVI"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
} "Process.2: Calculate NDWI"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "index"
    indexType = "EVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
} "Process.3: Calculate EVI"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "mask"
    maskType = "clouds"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
} "Process.4: Apply cloud masking"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "composite"
    compositeType = "median"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
} "Process.5: Create median composite"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "composite"
    compositeType = "mean"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
} "Process.6: Create mean composite"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "analyze"
    analysisType = "statistics"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = @{type = "Point"; coordinates = @(-122.4194, 37.7749)}
    reducer = "mean"
} "Process.7: Statistical analysis"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "analyze"
    analysisType = "timeseries"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-03-31"
    geometry = @{type = "Point"; coordinates = @(-122.4194, 37.7749)}
    reducer = "mean"
} "Process.8: Time series analysis"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "terrain"
    terrainType = "elevation"
} "Process.9: Get elevation"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "terrain"
    terrainType = "slope"
} "Process.10: Calculate slope"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "terrain"
    terrainType = "aspect"
} "Process.11: Calculate aspect"

$testResults += Test-Operation "earth_engine_process" @{
    operation = "clip"
    input = "COPERNICUS/S2_SR_HARMONIZED"
    region = @{type = "Point"; coordinates = @(-122.4194, 37.7749)}
} "Process.12: Clip image to region"

# EARTH ENGINE EXPORT TOOL - ALL OPERATIONS
Write-Host "`n=== EARTH ENGINE EXPORT TOOL ===" -ForegroundColor Yellow

$testResults += Test-Operation "earth_engine_export" @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    dimensions = 512
} "Export.1: Generate thumbnail (512px)"

$testResults += Test-Operation "earth_engine_export" @{
    operation = "thumbnail"
    datasetId = "LANDSAT/LC08/C02/T1_L2"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    dimensions = 256
} "Export.2: Generate Landsat thumbnail"

$testResults += Test-Operation "earth_engine_export" @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    zoomLevel = 10
} "Export.3: Generate map tiles"

$testResults += Test-Operation "earth_engine_export" @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    destination = "drive"
    fileNamePrefix = "test_export_drive"
    scale = 30
    geometry = @{type = "Point"; coordinates = @(-122.4194, 37.7749)}
} "Export.4: Export to Google Drive"

$testResults += Test-Operation "earth_engine_export" @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    destination = "gcs"
    fileNamePrefix = "test_export_gcs"
    scale = 30
    geometry = @{type = "Point"; coordinates = @(-122.4194, 37.7749)}
} "Export.5: Export to GCS"

$testResults += Test-Operation "earth_engine_export" @{
    operation = "status"
    taskId = "test_task_id"
} "Export.6: Check task status"

# EARTH ENGINE SYSTEM TOOL - ALL OPERATIONS
Write-Host "`n=== EARTH ENGINE SYSTEM TOOL ===" -ForegroundColor Yellow

$testResults += Test-Operation "earth_engine_system" @{
    operation = "auth"
    checkType = "status"
} "System.1: Check authentication status"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "auth"
    checkType = "permissions"
} "System.2: Check permissions"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "info"
    infoType = "system"
} "System.3: Get system info"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "info"
    infoType = "quotas"
} "System.4: Get quotas"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "info"
    infoType = "tasks"
} "System.5: Get tasks info"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "execute"
    code = "return ee.Number(42).multiply(2).getInfo();"
    language = "javascript"
} "System.6: Execute custom code"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "execute"
    code = "const col = new ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED'); return col.size().getInfo();"
    language = "javascript"
} "System.7: Execute collection query"

$testResults += Test-Operation "earth_engine_system" @{
    operation = "setup"
    setupType = "auth"
} "System.8: Setup authentication"

# SUMMARY
Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host " TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

$total = $passed + $failed
$rate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "`nTotal Tests: $total"
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "`nSuccess Rate: $rate%" -ForegroundColor $(if ($rate -eq 100) { "Green" } elseif ($rate -ge 90) { "Yellow" } else { "Red" })

if ($failed -gt 0) {
    Write-Host "`n❌ FAILED TESTS:" -ForegroundColor Red
    $testResults | Where-Object { -not $_.Success } | ForEach-Object {
        Write-Host "  - $($_.Test)" -ForegroundColor Red
        if ($_.Error) {
            Write-Host "    Error: $($_.Error)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n===============================================" -ForegroundColor Cyan
if ($rate -eq 100) {
    Write-Host " ✅ PERFECT! ALL TESTS PASSED (100%)" -ForegroundColor Green
    Write-Host " Server is PRODUCTION READY!" -ForegroundColor Green
} else {
    Write-Host " ❌ NOT READY - $failed TESTS FAILED" -ForegroundColor Red
    Write-Host " Fix all errors for 100% success rate" -ForegroundColor Yellow
}
Write-Host "===============================================" -ForegroundColor Cyan
