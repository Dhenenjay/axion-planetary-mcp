# Comprehensive SSE Endpoint Test for Earth Engine MCP Server
$baseUrl = "http://localhost:3000/api/mcp/sse"

Write-Host "`n🌍 EARTH ENGINE MCP SSE ENDPOINT TEST" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Cyan

$results = @{
    total = 0
    passed = 0
    failed = 0
    errors = @()
}

function Test-SSEEndpoint {
    param(
        [string]$TestName,
        [string]$Tool,
        [hashtable]$Params
    )
    
    $results.total++
    Write-Host "`n[$($results.total)] Testing: $TestName" -ForegroundColor Yellow
    
    try {
        $body = @{
            tool = $Tool
            arguments = $Params
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json"
        
        if ($response) {
            if ($response.error) {
                Write-Host "  ❌ FAILED: $($response.error)" -ForegroundColor Red
                $results.failed++
                $results.errors += @{ test = $TestName; error = $response.error }
            } else {
                Write-Host "  ✅ PASSED" -ForegroundColor Green
                $results.passed++
            }
        } else {
            Write-Host "  ✅ PASSED" -ForegroundColor Green
            $results.passed++
        }
    }
    catch {
        Write-Host "  ❌ ERROR: $_" -ForegroundColor Red
        $results.failed++
        $results.errors += @{ test = $TestName; error = $_.ToString() }
    }
}

# Test Data Operations
Write-Host "`n" ("=" * 50) -ForegroundColor Magenta
Write-Host "📊 DATA OPERATIONS" -ForegroundColor Magenta
Write-Host ("=" * 50) -ForegroundColor Magenta

Test-SSEEndpoint -TestName "Search datasets" -Tool "earth_engine_data" -Params @{
    operation = "search"
    query = "sentinel"
    limit = 3
}

Test-SSEEndpoint -TestName "Get geometry for San Francisco" -Tool "earth_engine_data" -Params @{
    operation = "geometry"
    placeName = "San Francisco"
}

Test-SSEEndpoint -TestName "Filter collection" -Tool "earth_engine_data" -Params @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    cloudCoverMax = 20
}

Test-SSEEndpoint -TestName "Get dataset info" -Tool "earth_engine_data" -Params @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
}

# Test System Operations
Write-Host "`n" ("=" * 50) -ForegroundColor Magenta
Write-Host "⚙️ SYSTEM OPERATIONS" -ForegroundColor Magenta
Write-Host ("=" * 50) -ForegroundColor Magenta

Test-SSEEndpoint -TestName "Check authentication" -Tool "earth_engine_system" -Params @{
    operation = "auth"
}

Test-SSEEndpoint -TestName "Get help" -Tool "earth_engine_system" -Params @{
    operation = "help"
}

Test-SSEEndpoint -TestName "Execute EE code" -Tool "earth_engine_system" -Params @{
    operation = "execute"
    code = 'const point = ee.Geometry.Point([0, 0]); return point.buffer(1000).area();'
}

# Test Processing Operations
Write-Host "`n" ("=" * 50) -ForegroundColor Magenta
Write-Host "🔧 PROCESSING OPERATIONS" -ForegroundColor Magenta
Write-Host ("=" * 50) -ForegroundColor Magenta

Test-SSEEndpoint -TestName "Calculate NDVI" -Tool "earth_engine_process" -Params @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
}

Test-SSEEndpoint -TestName "Create composite" -Tool "earth_engine_process" -Params @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    method = "median"
}

Test-SSEEndpoint -TestName "Cloud masking" -Tool "earth_engine_process" -Params @{
    operation = "mask"
    maskType = "cloud"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
}

# Test Export Operations
Write-Host "`n" ("=" * 50) -ForegroundColor Magenta
Write-Host "📤 EXPORT OPERATIONS" -ForegroundColor Magenta
Write-Host ("=" * 50) -ForegroundColor Magenta

Test-SSEEndpoint -TestName "Generate thumbnail" -Tool "earth_engine_export" -Params @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
    dimensions = 256
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
}

Test-SSEEndpoint -TestName "Generate map tiles" -Tool "earth_engine_export" -Params @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "San Francisco"
    zoomLevel = 10
}

# Test Global Locations
Write-Host "`n" ("=" * 50) -ForegroundColor Magenta
Write-Host "🌍 GLOBAL LOCATIONS" -ForegroundColor Magenta
Write-Host ("=" * 50) -ForegroundColor Magenta

$locations = @("Tokyo", "London", "Sydney", "Mumbai", "Cairo", "New York", "Paris")
foreach ($location in $locations) {
    Test-SSEEndpoint -TestName "Find $location" -Tool "earth_engine_data" -Params @{
        operation = "geometry"
        placeName = $location
    }
}

# Print Summary
Write-Host "`n" ("=" * 50) -ForegroundColor Cyan
Write-Host "📊 TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Cyan

$successRate = [math]::Round(($results.passed / $results.total) * 100, 1)
Write-Host "Total Tests: $($results.total)"
Write-Host "✅ Passed: $($results.passed)" -ForegroundColor Green
Write-Host "❌ Failed: $($results.failed)" -ForegroundColor Red
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } else { "Yellow" })

if ($results.errors.Count -gt 0) {
    Write-Host "`n⚠️ Failed Tests:" -ForegroundColor Yellow
    foreach ($err in $results.errors) {
        Write-Host "  • $($err.test): $($err.error)"
    }
}

if ($results.passed -eq $results.total) {
    Write-Host "`n🎉 All tests passed! Earth Engine MCP server is fully operational!" -ForegroundColor Green
    exit 0
} elseif ($successRate -ge 80) {
    Write-Host "`n✅ Server is operational with minor issues." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "`n❌ Server has significant issues that need fixing." -ForegroundColor Red
    exit 1
}
