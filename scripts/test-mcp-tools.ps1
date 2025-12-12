# Comprehensive test script for Earth Engine MCP tools
# Tests all 4 consolidated tools and their operations

$baseUrl = "http://localhost:3000"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "=== Starting Earth Engine MCP Comprehensive Test Suite ===" -ForegroundColor Green
Write-Host "Testing server at: $baseUrl" -ForegroundColor Yellow
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-MCPOperation {
    param(
        [string]$ToolName,
        [string]$Operation,
        [hashtable]$Parameters
    )
    
    $script:totalTests++
    
    $body = @{
        tool = $ToolName
        operation = $Operation
        parameters = $Parameters
    } | ConvertTo-Json -Depth 10
    
    Write-Host "Testing: $ToolName - $Operation" -ForegroundColor Cyan
    Write-Host "Parameters: $($Parameters | ConvertTo-Json -Compress)" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/tool" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        if ($response.success) {
            Write-Host "PASSED" -ForegroundColor Green
            Write-Host "Response: $($response | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor DarkGray
            $script:passedTests++
        }
        else {
            Write-Host "FAILED: $($response.error)" -ForegroundColor Red
            $script:failedTests++
        }
    }
    catch {
        Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            try {
                $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
                Write-Host "Error Details: $($errorDetail | ConvertTo-Json -Compress)" -ForegroundColor DarkRed
            }
            catch {
                Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
            }
        }
        $script:failedTests++
    }
    
    Write-Host "" # Empty line for readability
}

# Test 1: earth_engine_data - search
Write-Host "=== Testing earth_engine_data Tool ===" -ForegroundColor Yellow
Test-MCPOperation -ToolName "earth_engine_data" -Operation "search" -Parameters @{
    query = "Sentinel-2"
    maxResults = 3
}

# Test 2: earth_engine_data - info
Test-MCPOperation -ToolName "earth_engine_data" -Operation "info" -Parameters @{
    assetId = "COPERNICUS/S2_SR"
}

# Test 3: earth_engine_data - geometry
Test-MCPOperation -ToolName "earth_engine_data" -Operation "geometry" -Parameters @{
    placeName = "San Francisco"
}

# Test 4: earth_engine_data - geometry with Ludhiana (fallback test)
Test-MCPOperation -ToolName "earth_engine_data" -Operation "geometry" -Parameters @{
    placeName = "Ludhiana"
}

# Test 5: earth_engine_system - auth
Write-Host "=== Testing earth_engine_system Tool ===" -ForegroundColor Yellow
Test-MCPOperation -ToolName "earth_engine_system" -Operation "auth" -Parameters @{}

# Test 6: earth_engine_system - setup
Test-MCPOperation -ToolName "earth_engine_system" -Operation "setup" -Parameters @{
    bucket = "test-ee-bucket"
    projectId = "test-project"
}

# Test 7: earth_engine_system - help
Test-MCPOperation -ToolName "earth_engine_system" -Operation "help" -Parameters @{}

# Test 8: earth_engine_process - ndvi
Write-Host "=== Testing earth_engine_process Tool ===" -ForegroundColor Yellow
Test-MCPOperation -ToolName "earth_engine_process" -Operation "ndvi" -Parameters @{
    datasetId = "COPERNICUS/S2_SR"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    geometry = @{
        type = "Point"
        coordinates = @(-122.4194, 37.7749)
    }
}

# Test 9: earth_engine_process - ndwi
Test-MCPOperation -ToolName "earth_engine_process" -Operation "ndwi" -Parameters @{
    datasetId = "COPERNICUS/S2_SR"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    geometry = @{
        type = "Point"
        coordinates = @(-122.4194, 37.7749)
    }
}

# Test 10: earth_engine_process - thumbnail
Test-MCPOperation -ToolName "earth_engine_process" -Operation "thumbnail" -Parameters @{
    datasetId = "COPERNICUS/S2_SR"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    geometry = @{
        type = "Point"
        coordinates = @(-122.4194, 37.7749)
    }
    dimensions = "256x256"
    format = "png"
}

# Test 11: earth_engine_process - timeseries
Test-MCPOperation -ToolName "earth_engine_process" -Operation "timeseries" -Parameters @{
    datasetId = "COPERNICUS/S2_SR"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    geometry = @{
        type = "Point"
        coordinates = @(-122.4194, 37.7749)
    }
    band = "B4"
    reducer = "mean"
}

# Test 12: earth_engine_export - toAsset
Write-Host "=== Testing earth_engine_export Tool ===" -ForegroundColor Yellow
Test-MCPOperation -ToolName "earth_engine_export" -Operation "toAsset" -Parameters @{
    imageId = "COPERNICUS/S2_SR/20240115T183919_20240115T184201_T10SEG"
    assetId = "users/test/exported_image"
    region = @{
        type = "Polygon"
        coordinates = @(@(
            @(-122.5, 37.7),
            @(-122.3, 37.7),
            @(-122.3, 37.8),
            @(-122.5, 37.8),
            @(-122.5, 37.7)
        ))
    }
    scale = 10
}

# Test 13: earth_engine_export - toDrive
Test-MCPOperation -ToolName "earth_engine_export" -Operation "toDrive" -Parameters @{
    imageId = "COPERNICUS/S2_SR/20240115T183919_20240115T184201_T10SEG"
    folder = "EarthEngineExports"
    filename = "test_export"
    region = @{
        type = "Polygon"
        coordinates = @(@(
            @(-122.5, 37.7),
            @(-122.3, 37.7),
            @(-122.3, 37.8),
            @(-122.5, 37.8),
            @(-122.5, 37.7)
        ))
    }
    scale = 10
    format = "GeoTIFF"
}

# Test 14: earth_engine_export - toGCS
Test-MCPOperation -ToolName "earth_engine_export" -Operation "toGCS" -Parameters @{
    imageId = "COPERNICUS/S2_SR/20240115T183919_20240115T184201_T10SEG"
    bucket = "test-ee-bucket"
    filePrefix = "test_export"
    region = @{
        type = "Polygon"
        coordinates = @(@(
            @(-122.5, 37.7),
            @(-122.3, 37.7),
            @(-122.3, 37.8),
            @(-122.5, 37.8),
            @(-122.5, 37.7)
        ))
    }
    scale = 10
    format = "GeoTIFF"
}

# Test 15: Edge case - search with special characters
Test-MCPOperation -ToolName "earth_engine_data" -Operation "search" -Parameters @{
    query = "Landsat-8"
    maxResults = 2
}

# Test 16: Edge case - geometry with coordinates
Test-MCPOperation -ToolName "earth_engine_data" -Operation "geometry" -Parameters @{
    coordinates = @(-122.4194, 37.7749)
}

# Summary
Write-Host ""
Write-Host "=== TEST SUMMARY ===" -ForegroundColor Magenta
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red

if ($failedTests -eq 0) {
    Write-Host ""
    Write-Host "ALL TESTS PASSED! The Earth Engine MCP server is production ready." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Some tests failed. Please review the errors above." -ForegroundColor Red
}

Write-Host ""
Write-Host "Test run completed at: $(Get-Date)" -ForegroundColor Gray
