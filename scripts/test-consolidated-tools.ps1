# MCP-compatible test script for consolidated Earth Engine tools
# Tests all 4 consolidated tools with proper MCP protocol

$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "=== Earth Engine MCP Consolidated Tools Test Suite ===" -ForegroundColor Green
Write-Host "Testing server at: $baseUrl" -ForegroundColor Yellow
Write-Host "Protocol: MCP (Model Context Protocol)" -ForegroundColor Cyan
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-MCPTool {
    param(
        [string]$ToolName,
        [hashtable]$Arguments,
        [string]$Description
    )
    
    $script:totalTests++
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $ToolName
            arguments = $Arguments
        }
    } | ConvertTo-Json -Depth 10
    
    Write-Host "[$totalTests] Testing: $Description" -ForegroundColor Cyan
    Write-Host "  Tool: $ToolName" -ForegroundColor Gray
    Write-Host "  Args: $($Arguments | ConvertTo-Json -Compress)" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        if ($response.result) {
            Write-Host "  ✓ PASSED" -ForegroundColor Green
            
            # Show key results based on operation
            if ($response.result.success -ne $null) {
                Write-Host "    Success: $($response.result.success)" -ForegroundColor DarkGreen
            }
            if ($response.result.message) {
                Write-Host "    Message: $($response.result.message)" -ForegroundColor DarkGreen
            }
            if ($response.result.data) {
                $dataCount = if ($response.result.data -is [array]) { $response.result.data.Count } else { 1 }
                Write-Host "    Data items: $dataCount" -ForegroundColor DarkGreen
            }
            
            $script:passedTests++
        }
        elseif ($response.error) {
            Write-Host "  ✗ FAILED: $($response.error.message)" -ForegroundColor Red
            $script:failedTests++
        }
        else {
            Write-Host "  ✗ FAILED: Unexpected response format" -ForegroundColor Red
            $script:failedTests++
        }
    }
    catch {
        Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            try {
                $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
                if ($errorDetail.error.message) {
                    Write-Host "    Error: $($errorDetail.error.message)" -ForegroundColor DarkRed
                }
            }
            catch {
                Write-Host "    Details: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
            }
        }
        $script:failedTests++
    }
    
    Write-Host "" # Empty line for readability
}

# Test 1-4: earth_engine_data tool operations
Write-Host "=== Testing earth_engine_data Tool ===" -ForegroundColor Yellow

Test-MCPTool -ToolName "earth_engine_data" `
    -Arguments @{ operation = "search"; query = "Sentinel-2"; maxResults = 3 } `
    -Description "Search for Sentinel-2 datasets"

Test-MCPTool -ToolName "earth_engine_data" `
    -Arguments @{ operation = "info"; assetId = "COPERNICUS/S2_SR" } `
    -Description "Get info about Sentinel-2 SR dataset"

Test-MCPTool -ToolName "earth_engine_data" `
    -Arguments @{ operation = "geometry"; placeName = "San Francisco" } `
    -Description "Get geometry for San Francisco"

Test-MCPTool -ToolName "earth_engine_data" `
    -Arguments @{ operation = "geometry"; placeName = "Ludhiana" } `
    -Description "Get geometry for Ludhiana (fallback coordinates)"

# Test 5-7: earth_engine_system tool operations
Write-Host "=== Testing earth_engine_system Tool ===" -ForegroundColor Yellow

Test-MCPTool -ToolName "earth_engine_system" `
    -Arguments @{ operation = "auth"; checkType = "status" } `
    -Description "Check authentication status"

Test-MCPTool -ToolName "earth_engine_system" `
    -Arguments @{ operation = "setup"; setupType = "gcs"; bucket = "test-ee-bucket" } `
    -Description "Setup GCS bucket configuration"

Test-MCPTool -ToolName "earth_engine_system" `
    -Arguments @{ operation = "info"; infoType = "system" } `
    -Description "Get system information"

# Test 8-11: earth_engine_process tool operations
Write-Host "=== Testing earth_engine_process Tool ===" -ForegroundColor Yellow

Test-MCPTool -ToolName "earth_engine_process" `
    -Arguments @{
        operation = "index"
        indexType = "ndvi"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
    } `
    -Description "Calculate NDVI for San Francisco"

Test-MCPTool -ToolName "earth_engine_process" `
    -Arguments @{
        operation = "index"
        indexType = "ndwi"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
    } `
    -Description "Calculate NDWI for San Francisco"

Test-MCPTool -ToolName "earth_engine_process" `
    -Arguments @{
        operation = "analyze"
        analysisType = "timeseries"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
        band = "B4"
        reducer = "mean"
    } `
    -Description "Time series analysis for B4 band"

Test-MCPTool -ToolName "earth_engine_process" `
    -Arguments @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
        reducer = "median"
    } `
    -Description "Create median composite"

# Test 12-15: earth_engine_export tool operations
Write-Host "=== Testing earth_engine_export Tool ===" -ForegroundColor Yellow

Test-MCPTool -ToolName "earth_engine_export" `
    -Arguments @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
        dimensions = "256x256"
        format = "png"
    } `
    -Description "Generate thumbnail image"

Test-MCPTool -ToolName "earth_engine_export" `
    -Arguments @{
        operation = "tiles"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
    } `
    -Description "Get map tiles URL"

Test-MCPTool -ToolName "earth_engine_export" `
    -Arguments @{
        operation = "export"
        exportType = "toGCS"
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
    } `
    -Description "Export image to Google Cloud Storage"

Test-MCPTool -ToolName "earth_engine_export" `
    -Arguments @{
        operation = "status"
        taskId = "test-task-id"
    } `
    -Description "Check export task status"

# Test edge cases
Write-Host "=== Testing Edge Cases ===" -ForegroundColor Yellow

Test-MCPTool -ToolName "earth_engine_data" `
    -Arguments @{ operation = "search"; query = "Landsat-8"; maxResults = 2 } `
    -Description "Search with hyphenated query (Landsat-8)"

Test-MCPTool -ToolName "earth_engine_data" `
    -Arguments @{ 
        operation = "geometry"
        coordinates = @(-122.4194, 37.7749) 
    } `
    -Description "Get geometry from coordinates directly"

# Summary
Write-Host "=== TEST SUMMARY ===" -ForegroundColor Magenta
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red

$successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 }
Write-Host "Success Rate: $successRate%" -ForegroundColor Cyan

if ($failedTests -eq 0) {
    Write-Host ""
    Write-Host "✓ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "The Earth Engine MCP server with consolidated tools is production ready." -ForegroundColor Green
}
elseif ($passedTests -gt 0) {
    Write-Host ""
    Write-Host "⚠ PARTIAL SUCCESS" -ForegroundColor Yellow
    Write-Host "Some tests passed but others failed. Review the errors above." -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "✗ ALL TESTS FAILED" -ForegroundColor Red
    Write-Host "Critical issues detected. Please review the server configuration." -ForegroundColor Red
}

Write-Host ""
Write-Host "Test run completed at: $(Get-Date)" -ForegroundColor Gray
Write-Host "Server: $baseUrl" -ForegroundColor Gray
Write-Host "Consolidated tools count: 4" -ForegroundColor Gray
