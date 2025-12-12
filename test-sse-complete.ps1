# Comprehensive Earth Engine SSE Endpoint Test
# This test covers EVERY operation to ensure 100% functionality

$baseUrl = "http://localhost:3000/api/mcp/sse"
$global:passCount = 0
$global:failCount = 0
$global:results = @()

function Test-Operation {
    param(
        [string]$Category,
        [string]$TestName,
        [string]$Tool,
        [hashtable]$Args
    )
    
    Write-Host "  Testing: $TestName" -ForegroundColor Yellow -NoNewline
    
    try {
        $body = @{
            tool = $Tool
            arguments = $Args
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
        
        if ($response.error) {
            Write-Host " [FAIL]" -ForegroundColor Red
            Write-Host "    Error: $($response.error)" -ForegroundColor Red
            $global:failCount++
            $global:results += @{
                Category = $Category
                Test = $TestName
                Status = "FAILED"
                Error = $response.error
            }
        } else {
            Write-Host " [PASS]" -ForegroundColor Green
            $global:passCount++
            $global:results += @{
                Category = $Category
                Test = $TestName
                Status = "PASSED"
            }
        }
    }
    catch {
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        $global:failCount++
        $global:results += @{
            Category = $Category
            Test = $TestName
            Status = "ERROR"
            Error = $_.ToString()
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " EARTH ENGINE SSE ENDPOINT COMPLETE TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. DATA OPERATIONS
Write-Host "1. DATA OPERATIONS" -ForegroundColor Magenta
Write-Host "==================" -ForegroundColor Magenta

Test-Operation -Category "Data" -TestName "Search Sentinel datasets" -Tool "earth_engine_data" -Args @{
    operation = "search"
    query = "sentinel"
    limit = 5
}

Test-Operation -Category "Data" -TestName "Search Landsat datasets" -Tool "earth_engine_data" -Args @{
    operation = "search"
    query = "landsat"
    limit = 3
}

Test-Operation -Category "Data" -TestName "Get dataset info (Sentinel-2)" -Tool "earth_engine_data" -Args @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
}

Test-Operation -Category "Data" -TestName "Filter collection by date" -Tool "earth_engine_data" -Args @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Test-Operation -Category "Data" -TestName "Filter collection with cloud cover" -Tool "earth_engine_data" -Args @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    cloudCoverMax = 20
}

Test-Operation -Category "Data" -TestName "Get geometry - San Francisco" -Tool "earth_engine_data" -Args @{
    operation = "geometry"
    placeName = "San Francisco"
}

Test-Operation -Category "Data" -TestName "Get geometry - coordinates" -Tool "earth_engine_data" -Args @{
    operation = "geometry"
    coordinates = @(-122.4194, 37.7749)
}

Write-Host ""

# 2. SYSTEM OPERATIONS
Write-Host "2. SYSTEM OPERATIONS" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

Test-Operation -Category "System" -TestName "Check authentication" -Tool "earth_engine_system" -Args @{
    operation = "auth"
}

Test-Operation -Category "System" -TestName "Get help" -Tool "earth_engine_system" -Args @{
    operation = "help"
}

Test-Operation -Category "System" -TestName "Execute simple EE code" -Tool "earth_engine_system" -Args @{
    operation = "execute"
    code = 'const point = ee.Geometry.Point([0, 0]); return point.buffer(1000).area();'
}

Test-Operation -Category "System" -TestName "Execute complex EE code" -Tool "earth_engine_system" -Args @{
    operation = "execute"
    code = 'const col = ee.ImageCollection("COPERNICUS/S2").limit(5); return col.size();'
}

Write-Host ""

# 3. PROCESSING OPERATIONS
Write-Host "3. PROCESSING OPERATIONS" -ForegroundColor Magenta
Write-Host "========================" -ForegroundColor Magenta

Test-Operation -Category "Process" -TestName "Calculate NDVI" -Tool "earth_engine_process" -Args @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
}

Test-Operation -Category "Process" -TestName "Calculate NDWI" -Tool "earth_engine_process" -Args @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Test-Operation -Category "Process" -TestName "Calculate EVI" -Tool "earth_engine_process" -Args @{
    operation = "index"
    indexType = "EVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Test-Operation -Category "Process" -TestName "Cloud masking" -Tool "earth_engine_process" -Args @{
    operation = "mask"
    maskType = "cloud"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Test-Operation -Category "Process" -TestName "Water masking" -Tool "earth_engine_process" -Args @{
    operation = "mask"
    maskType = "water"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Test-Operation -Category "Process" -TestName "Create median composite" -Tool "earth_engine_process" -Args @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    method = "median"
}

Test-Operation -Category "Process" -TestName "Create mean composite" -Tool "earth_engine_process" -Args @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    method = "mean"
}

Test-Operation -Category "Process" -TestName "Calculate statistics" -Tool "earth_engine_process" -Args @{
    operation = "analyze"
    analysisType = "statistics"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    reducer = "mean"
    region = "San Francisco"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Test-Operation -Category "Process" -TestName "Time series analysis" -Tool "earth_engine_process" -Args @{
    operation = "analyze"
    analysisType = "timeseries"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    band = "B4"
    reducer = "mean"
    region = "San Francisco"
    startDate = "2024-01-01"
    endDate = "2024-03-31"
}

Test-Operation -Category "Process" -TestName "Resample image" -Tool "earth_engine_process" -Args @{
    operation = "resample"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    scale = 30
    method = "bilinear"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

Write-Host ""

# 4. EXPORT OPERATIONS
Write-Host "4. EXPORT OPERATIONS" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

Test-Operation -Category "Export" -TestName "Generate thumbnail" -Tool "earth_engine_export" -Args @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
    dimensions = 512
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
}

Test-Operation -Category "Export" -TestName "Generate map tiles" -Tool "earth_engine_export" -Args @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
    zoomLevel = 12
}

Test-Operation -Category "Export" -TestName "Export to GCS" -Tool "earth_engine_export" -Args @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
    scale = 10
    destination = "gcs"
    fileNamePrefix = "test_export"
}

Test-Operation -Category "Export" -TestName "Check export status" -Tool "earth_engine_export" -Args @{
    operation = "status"
    taskId = "test_task_123"
}

Test-Operation -Category "Export" -TestName "Download exported file" -Tool "earth_engine_export" -Args @{
    operation = "download"
    fileName = "test_export.tif"
}

Write-Host ""

# 5. GLOBAL LOCATIONS TEST
Write-Host "5. GLOBAL LOCATIONS TEST" -ForegroundColor Magenta
Write-Host "========================" -ForegroundColor Magenta

$locations = @(
    "New York",
    "Los Angeles",
    "Chicago",
    "London",
    "Paris",
    "Tokyo",
    "Sydney",
    "Mumbai",
    "Beijing",
    "Cairo",
    "Rio de Janeiro",
    "Moscow",
    "Dubai",
    "Singapore",
    "Toronto",
    "Mexico City"
)

foreach ($location in $locations) {
    Test-Operation -Category "Locations" -TestName "Find $location" -Tool "earth_engine_data" -Args @{
        operation = "geometry"
        placeName = $location
    }
}

Write-Host ""

# 6. EDGE CASES AND ERROR HANDLING
Write-Host "6. EDGE CASES & ERROR HANDLING" -ForegroundColor Magenta
Write-Host "===============================" -ForegroundColor Magenta

Test-Operation -Category "EdgeCase" -TestName "Invalid dataset" -Tool "earth_engine_data" -Args @{
    operation = "filter"
    datasetId = "INVALID/DATASET/NAME"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
}

Test-Operation -Category "EdgeCase" -TestName "Invalid date range" -Tool "earth_engine_process" -Args @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-01-01"
    method = "median"
}

Test-Operation -Category "EdgeCase" -TestName "Unknown location" -Tool "earth_engine_data" -Args @{
    operation = "geometry"
    placeName = "Xyzabc123InvalidPlace"
}

Test-Operation -Category "EdgeCase" -TestName "Large area processing" -Tool "earth_engine_data" -Args @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2020-01-01"
    endDate = "2024-12-31"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         FINAL TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$total = $global:passCount + $global:failCount
$passRate = if ($total -gt 0) { [math]::Round(($global:passCount / $total) * 100, 2) } else { 0 }

Write-Host ""
Write-Host "Total Tests: $total"
Write-Host "Passed: $global:passCount" -ForegroundColor Green
Write-Host "Failed: $global:failCount" -ForegroundColor Red
Write-Host "Pass Rate: $passRate%"

# Show failed tests
if ($global:failCount -gt 0) {
    Write-Host ""
    Write-Host "FAILED TESTS:" -ForegroundColor Red
    $global:results | Where-Object { $_.Status -ne "PASSED" } | ForEach-Object {
        Write-Host "  [$($_.Category)] $($_.Test): $($_.Error)" -ForegroundColor Red
    }
}

# Final verdict
Write-Host ""
if ($passRate -eq 100) {
    Write-Host "PERFECT! All tests passed. SSE endpoint is 100% functional!" -ForegroundColor Green
    Write-Host "Ready for production use with high stakes!" -ForegroundColor Green
} elseif ($passRate -ge 95) {
    Write-Host "EXCELLENT! SSE endpoint is nearly perfect (Pass rate: $passRate%)" -ForegroundColor Green
    Write-Host "  Minor issues detected but core functionality is solid." -ForegroundColor Yellow
} elseif ($passRate -ge 80) {
    Write-Host "GOOD: SSE endpoint is functional (Pass rate: $passRate%)" -ForegroundColor Yellow
    Write-Host "  Some issues need attention before high-stakes use." -ForegroundColor Yellow
} else {
    Write-Host "CRITICAL: SSE endpoint has major issues (Pass rate: $passRate%)" -ForegroundColor Red
    Write-Host "  NOT ready for production use!" -ForegroundColor Red
}

# Export results to file
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportFile = "sse-test-report-$timestamp.txt"
$global:results | ConvertTo-Json -Depth 10 | Out-File $reportFile
Write-Host ""
Write-Host "Detailed report saved to: $reportFile" -ForegroundColor Cyan
