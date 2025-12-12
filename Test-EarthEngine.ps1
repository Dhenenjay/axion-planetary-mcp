# Earth Engine MCP Server Test Suite
Write-Host "`n🚀 Earth Engine MCP Server Test Suite" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Testing endpoint: http://localhost:3000/api/mcp/sse"
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"
$testResults = @()

function Call-SSE {
    param(
        [string]$Tool,
        [hashtable]$Arguments
    )
    
    Write-Host "`n📤 Calling $Tool" -ForegroundColor Yellow
    Write-Host "Arguments:" -ForegroundColor Gray
    $Arguments | ConvertTo-Json -Depth 10 | Write-Host
    
    try {
        $body = @{
            tool = $Tool
            arguments = $Arguments
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri $SSE_ENDPOINT -Method POST -Body $body -ContentType "application/json"
        
        Write-Host "✅ Response received" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 10 | Write-Host
        return $response
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        throw
    }
}

# Test 1: Filter Sentinel-2 imagery for Los Angeles
Write-Host "`n============================================================" -ForegroundColor Blue
Write-Host "TEST 1: Filter Sentinel-2 imagery for Los Angeles in January 2025" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Blue

try {
    $test1Result = Call-SSE -Tool "earth_engine_data" -Arguments @{
        operation = "filter"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2025-01-01"
        endDate = "2025-01-31"
        region = "Los Angeles"
        cloudCoverMax = 20
    }
    
    $testResults += @{
        Test = "Filter Sentinel-2"
        Status = if ($test1Result.success -ne $false) { "PASSED" } else { "FAILED" }
        Result = $test1Result
    }
    
    Write-Host "`n✅ Test 1 completed" -ForegroundColor Green
}
catch {
    $testResults += @{
        Test = "Filter Sentinel-2"
        Status = "FAILED"
        Error = $_.ToString()
    }
    Write-Host "❌ Test 1 failed" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 2: Create composite and thumbnail
Write-Host "`n============================================================" -ForegroundColor Blue
Write-Host "TEST 2: Create a composite and show as thumbnail" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Blue

try {
    # Create composite
    $compositeResult = Call-SSE -Tool "earth_engine_process" -Arguments @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2025-01-01"
        endDate = "2025-01-31"
        region = "Los Angeles"
        compositeType = "median"
        cloudCoverMax = 20
    }
    
    if ($compositeResult.compositeKey) {
        # Generate thumbnail
        $thumbnailResult = Call-SSE -Tool "earth_engine_export" -Arguments @{
            operation = "thumbnail"
            compositeKey = $compositeResult.compositeKey
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            dimensions = 512
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 0.3
                gamma = 1.4
            }
        }
        
        $testResults += @{
            Test = "Create Composite and Thumbnail"
            Status = if ($thumbnailResult.url) { "PASSED" } else { "FAILED" }
            CompositeKey = $compositeResult.compositeKey
            ThumbnailUrl = $thumbnailResult.url
        }
        
        if ($thumbnailResult.url) {
            Write-Host "`n🖼️ Thumbnail URL: $($thumbnailResult.url)" -ForegroundColor Cyan
        }
    }
    else {
        throw "No compositeKey returned"
    }
    
    Write-Host "`n✅ Test 2 completed" -ForegroundColor Green
}
catch {
    $testResults += @{
        Test = "Create Composite and Thumbnail"
        Status = "FAILED"
        Error = $_.ToString()
    }
    Write-Host "❌ Test 2 failed: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 3: Create FCC and thumbnail
Write-Host "`n============================================================" -ForegroundColor Blue
Write-Host "TEST 3: Create FCC and show as thumbnail" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Blue

try {
    # Create FCC
    $fccResult = Call-SSE -Tool "earth_engine_process" -Arguments @{
        operation = "fcc"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2025-01-01"
        endDate = "2025-01-31"
        region = "Los Angeles"
    }
    
    if ($fccResult.compositeKey) {
        # Generate thumbnail with FCC visualization
        $thumbnailResult = Call-SSE -Tool "earth_engine_export" -Arguments @{
            operation = "thumbnail"
            compositeKey = $fccResult.compositeKey
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            dimensions = 512
            visParams = if ($fccResult.visualization) { $fccResult.visualization } else { @{
                bands = @("B8", "B4", "B3")
                min = 0
                max = 0.3
                gamma = 1.4
            }}
        }
        
        $testResults += @{
            Test = "Create FCC and Thumbnail"
            Status = if ($thumbnailResult.url) { "PASSED" } else { "FAILED" }
            FCCBands = $fccResult.fccBands
            ThumbnailUrl = $thumbnailResult.url
        }
        
        if ($thumbnailResult.url) {
            Write-Host "`n🖼️ FCC Thumbnail URL: $($thumbnailResult.url)" -ForegroundColor Cyan
        }
    }
    else {
        throw "No compositeKey returned from FCC"
    }
    
    Write-Host "`n✅ Test 3 completed" -ForegroundColor Green
}
catch {
    $testResults += @{
        Test = "Create FCC and Thumbnail"
        Status = "FAILED"
        Error = $_.ToString()
    }
    Write-Host "❌ Test 3 failed: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 4: Calculate NDVI and visualize
Write-Host "`n============================================================" -ForegroundColor Blue
Write-Host "TEST 4: Calculate NDVI and show as colored map" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Blue

try {
    # Calculate NDVI
    $ndviResult = Call-SSE -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2025-01-01"
        endDate = "2025-01-31"
        region = "Los Angeles"
    }
    
    if ($ndviResult.ndviKey) {
        # Generate NDVI visualization
        $thumbnailResult = Call-SSE -Tool "earth_engine_export" -Arguments @{
            operation = "thumbnail"
            ndviKey = $ndviResult.ndviKey
            region = "Los Angeles"
            dimensions = 512
            visParams = if ($ndviResult.visualization) { $ndviResult.visualization } else { @{
                bands = @("NDVI")
                min = -1
                max = 1
                palette = @("blue", "white", "green")
            }}
        }
        
        # Get tile service
        $tilesResult = Call-SSE -Tool "earth_engine_export" -Arguments @{
            operation = "tiles"
            ndviKey = $ndviResult.ndviKey
            region = "Los Angeles"
            visParams = @{
                bands = @("NDVI")
                min = -1
                max = 1
                palette = @("#0000FF", "#8B4513", "#FFFF00", "#90EE90", "#006400")
            }
        }
        
        $testResults += @{
            Test = "Calculate NDVI and Visualize"
            Status = if ($thumbnailResult.url) { "PASSED" } else { "FAILED" }
            NDVIKey = $ndviResult.ndviKey
            ThumbnailUrl = $thumbnailResult.url
            TileUrl = $tilesResult.tileUrl
            Interpretation = $ndviResult.interpretation
        }
        
        if ($thumbnailResult.url) {
            Write-Host "`n🖼️ NDVI Thumbnail URL: $($thumbnailResult.url)" -ForegroundColor Cyan
        }
        if ($tilesResult.tileUrl) {
            Write-Host "🗺️ NDVI Tile Service: $($tilesResult.tileUrl)" -ForegroundColor Cyan
        }
        if ($ndviResult.interpretation) {
            Write-Host "`n📊 NDVI Interpretation:" -ForegroundColor Yellow
            $ndviResult.interpretation | ConvertTo-Json -Depth 10 | Write-Host
        }
    }
    else {
        throw "No ndviKey returned from NDVI calculation"
    }
    
    Write-Host "`n✅ Test 4 completed" -ForegroundColor Green
}
catch {
    $testResults += @{
        Test = "Calculate NDVI and Visualize"
        Status = "FAILED"
        Error = $_.ToString()
    }
    Write-Host "❌ Test 4 failed: $_" -ForegroundColor Red
}

# Print summary
Write-Host "`n============================================================" -ForegroundColor Magenta
Write-Host "TEST SUMMARY" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Magenta

$passedCount = 0
$failedCount = 0

foreach ($result in $testResults) {
    $status = if ($result.Status -eq "PASSED") { "✅" } else { "❌" }
    Write-Host "$status $($result.Test): $($result.Status)" -ForegroundColor $(if ($result.Status -eq "PASSED") { "Green" } else { "Red" })
    
    if ($result.Status -eq "PASSED") {
        $passedCount++
        if ($result.ThumbnailUrl) {
            Write-Host "   🖼️ Thumbnail: $($result.ThumbnailUrl)" -ForegroundColor Gray
        }
        if ($result.TileUrl) {
            Write-Host "   🗺️ Tiles: $($result.TileUrl)" -ForegroundColor Gray
        }
    }
    else {
        $failedCount++
        if ($result.Error) {
            Write-Host "   Error: $($result.Error)" -ForegroundColor Gray
        }
    }
}

Write-Host "`n------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Total: $($testResults.Count) tests" -ForegroundColor White
Write-Host "Passed: $passedCount ✅" -ForegroundColor Green
Write-Host "Failed: $failedCount ❌" -ForegroundColor Red
$successRate = if ($testResults.Count -gt 0) { [math]::Round(($passedCount / $testResults.Count) * 100, 1) } else { 0 }
Write-Host "Success Rate: $successRate%" -ForegroundColor Yellow

if ($failedCount -eq 0) {
    Write-Host "`n🎉 All tests passed! The server is working perfectly." -ForegroundColor Green
}
else {
    Write-Host "`n⚠️ Some tests failed. Please check the errors above." -ForegroundColor Yellow
}
