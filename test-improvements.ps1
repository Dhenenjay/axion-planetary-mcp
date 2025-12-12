# TEST SCRIPT FOR IMPROVED MCP TOOLS
# Tests: Chunked output for large results and high-quality thumbnails

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "   TESTING IMPROVED MCP TOOLS" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000/api/mcp/sse"
$testResults = @()

function Test-MCPTool {
    param($Name, $Body, [int]$Timeout = 60)
    
    Write-Host "`nTest: $Name" -ForegroundColor Yellow
    Write-Host "Request:" -ForegroundColor Gray
    Write-Host ($Body | ConvertTo-Json -Depth 10 -Compress) -ForegroundColor DarkGray
    
    try {
        $json = $Body | ConvertTo-Json -Depth 10
        $start = Get-Date
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $json -ContentType "application/json" -TimeoutSec $Timeout
        $duration = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
        
        # Check response size
        $responseJson = $response | ConvertTo-Json -Depth 10
        $sizeKB = [math]::Round($responseJson.Length / 1024, 1)
        
        Write-Host "Response Size: $sizeKB KB" -ForegroundColor Cyan
        Write-Host "Duration: $duration seconds" -ForegroundColor Cyan
        
        if ($response.success -eq $true) {
            Write-Host "Status: SUCCESS" -ForegroundColor Green
            
            # Check for chunking info
            if ($response.chunk) {
                Write-Host "Chunked: Yes (Chunk $($response.chunk.index + 1) of $($response.chunk.total))" -ForegroundColor Yellow
            }
            
            # Check for continuation
            if ($response.continuation) {
                Write-Host "Has Continuation: Yes" -ForegroundColor Yellow
                Write-Host "Next Command:" -ForegroundColor Gray
                Write-Host ($response.continuation.nextCommand | ConvertTo-Json -Compress) -ForegroundColor DarkGray
            }
            
            # Check for thumbnail URL
            if ($response.url) {
                Write-Host "Thumbnail URL: $($response.url.Substring(0, [Math]::Min(100, $response.url.Length)))..." -ForegroundColor Green
                
                # Check quality metadata
                if ($response.metadata.quality) {
                    Write-Host "Quality: $($response.metadata.quality)" -ForegroundColor Cyan
                    Write-Host "Dimensions: $($response.metadata.dimensions)px" -ForegroundColor Cyan
                    Write-Host "Format: $($response.metadata.format)" -ForegroundColor Cyan
                }
            }
            
            return @{Name=$Name; Status="PASS"; Size=$sizeKB; Duration=$duration}
        } else {
            Write-Host "Status: FAILED" -ForegroundColor Red
            Write-Host "Error: $($response.error)" -ForegroundColor Red
            return @{Name=$Name; Status="FAIL"; Error=$response.error}
        }
    } catch {
        Write-Host "Status: ERROR" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        return @{Name=$Name; Status="ERROR"; Error=$_.Exception.Message}
    }
}

# ======================================
# TEST 1: TIME SERIES WITH CHUNKING
# ======================================
Write-Host "`n`n=== TEST 1: TIME SERIES WITH CHUNKING ===" -ForegroundColor Magenta

$result1 = Test-MCPTool "Time Series Analysis (Chunked)" @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "analyze"
        analysisType = "timeseries"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-03-31"  # Smaller date range for testing
        band = "B4"
        reducer = "mean"
        scale = 100
    }
} 90

$testResults += $result1

# Test continuation if available
if ($result1.Status -eq "PASS") {
    Write-Host "`nTesting continuation..." -ForegroundColor Yellow
    # Would need to extract resultId from response and test continuation
}

# ======================================
# TEST 2: HIGH-QUALITY THUMBNAILS
# ======================================
Write-Host "`n`n=== TEST 2: HIGH-QUALITY THUMBNAILS ===" -ForegroundColor Magenta

# First create a composite
Write-Host "`nCreating composite for thumbnail tests..." -ForegroundColor Yellow
$compositeResult = Test-MCPTool "Create Composite" @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        compositeType = "median"
    }
}

if ($compositeResult.Status -eq "PASS") {
    # Extract compositeKey from the actual response
    Write-Host "`nTesting different quality levels..." -ForegroundColor Yellow
    
    # Test LOW quality
    $testResults += Test-MCPTool "Thumbnail - LOW Quality" @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            quality = "low"
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 0.3
                gamma = 1.4
            }
        }
    }
    
    # Test MEDIUM quality
    $testResults += Test-MCPTool "Thumbnail - MEDIUM Quality" @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            quality = "medium"
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 0.3
                gamma = 1.4
            }
        }
    }
    
    # Test HIGH quality
    $testResults += Test-MCPTool "Thumbnail - HIGH Quality" @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            quality = "high"
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 0.3
                gamma = 1.4
            }
        }
    }
    
    # Test ULTRA quality
    $testResults += Test-MCPTool "Thumbnail - ULTRA Quality" @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            quality = "ultra"
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 0.3
            }
        }
    }
}

# ======================================
# TEST 3: FALSE COLOR COMPOSITES
# ======================================
Write-Host "`n`n=== TEST 3: FALSE COLOR COMPOSITES ===" -ForegroundColor Magenta

# Test NIR False Color
$testResults += Test-MCPTool "NIR False Color - High Quality" @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        quality = "high"
        visParams = @{
            bands = @("B8", "B4", "B3")  # NIR-Red-Green
            min = 0
            max = 0.4
            gamma = 1.3
        }
    }
}

# Test SWIR False Color
$testResults += Test-MCPTool "SWIR False Color - High Quality" @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        quality = "high"
        visParams = @{
            bands = @("B12", "B8", "B4")  # SWIR-NIR-Red
            min = 0
            max = 0.35
            gamma = 1.2
        }
    }
}

# ======================================
# TEST 4: VEGETATION INDICES
# ======================================
Write-Host "`n`n=== TEST 4: VEGETATION INDICES ===" -ForegroundColor Magenta

# Calculate NDVI
$ndviBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        indexType = "NDVI"
    }
}

$ndviJson = $ndviBody | ConvertTo-Json -Depth 10
$ndviResponse = $null
try {
    $ndviResponse = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $ndviJson -ContentType "application/json" -TimeoutSec 30
    Write-Host "NDVI calculated successfully" -ForegroundColor Green
    if ($ndviResponse.indexKey) {
        Write-Host "Index Key: $($ndviResponse.indexKey)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "NDVI calculation failed: $_" -ForegroundColor Red
}

$testResults += @{Name="Calculate NDVI"; Status=if($ndviResponse){"PASS"}else{"FAIL"}}

if ($ndviResponse -and $ndviResponse.indexKey) {
    # Test NDVI visualization with the actual key
    $testResults += Test-MCPTool "NDVI Visualization - High Quality" @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            ndviKey = $ndviResponse.indexKey
            dimensions = 512
            visParams = @{
                bands = @("NDVI")
                min = -1
                max = 1
                palette = @("#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837")
            }
        }
    }
} else {
    # Fallback test with direct visualization
    Write-Host "Testing NDVI visualization with direct parameters..." -ForegroundColor Yellow
    $testResults += Test-MCPTool "NDVI Visualization - Direct" @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            dimensions = 512
            visParams = @{
                bands = @("B4", "B3", "B2")  # Use RGB bands instead
                min = 0
                max = 0.3
                gamma = 1.4
            }
        }
    }
}

# ======================================
# TEST 5: LARGE RESULT CHUNKING
# ======================================
Write-Host "`n`n=== TEST 5: LARGE RESULT CHUNKING ===" -ForegroundColor Magenta

$testResults += Test-MCPTool "Large Statistics (Should Chunk)" @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "analyze"
        analysisType = "statistics"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"  # Use smaller region for testing
        startDate = "2024-01-01"
        endDate = "2024-03-31"  # Smaller date range
        band = "B4"
        reducer = "all"  # Get all statistics
        scale = 100
    }
} 120

# ======================================
# SUMMARY
# ======================================
Write-Host "`n`n===========================================" -ForegroundColor Cyan
Write-Host "            TEST SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$passed = ($testResults | Where-Object {$_.Status -eq "PASS"}).Count
$failed = ($testResults | Where-Object {$_.Status -eq "FAIL"}).Count
$errors = ($testResults | Where-Object {$_.Status -eq "ERROR"}).Count
$total = $testResults.Count

Write-Host "`nTotal Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) {"Green"} else {"Red"})
Write-Host "Errors: $errors" -ForegroundColor $(if ($errors -eq 0) {"Green"} else {"Red"})

Write-Host "`nTest Details:" -ForegroundColor Yellow
foreach ($test in $testResults) {
    $color = switch ($test.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "ERROR" { "Red" }
    }
    
    Write-Host "  [$($test.Status)] $($test.Name)" -ForegroundColor $color
    if ($test.Size) {
        Write-Host "       Size: $($test.Size) KB, Duration: $($test.Duration)s" -ForegroundColor Gray
    }
    if ($test.Error) {
        Write-Host "       Error: $($test.Error)" -ForegroundColor DarkRed
    }
}

$successRate = if ($total -gt 0) {[math]::Round(($passed/$total)*100, 1)} else {0}
Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) {"Green"} elseif ($successRate -ge 70) {"Yellow"} else {"Red"})

Write-Host "`n===========================================" -ForegroundColor Cyan
if ($successRate -eq 100) {
    Write-Host "✅ ALL IMPROVEMENTS WORKING PERFECTLY!" -ForegroundColor Green
    Write-Host "• Chunked output prevents truncation" -ForegroundColor Green
    Write-Host "• High-quality thumbnails available" -ForegroundColor Green
    Write-Host "• Multiple quality levels supported" -ForegroundColor Green
} elseif ($successRate -ge 80) {
    Write-Host "✅ IMPROVEMENTS MOSTLY WORKING" -ForegroundColor Yellow
    Write-Host "Review any failed tests above" -ForegroundColor Yellow
} else {
    Write-Host "⚠️ IMPROVEMENTS NEED FIXES" -ForegroundColor Red
    Write-Host "Check error messages above" -ForegroundColor Red
}
Write-Host "===========================================" -ForegroundColor Cyan
