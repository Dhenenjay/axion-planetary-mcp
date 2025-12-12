# Comprehensive Real-World Test Suite for Earth Engine MCP
# Tests actual use cases: Agriculture, Urban Planning, Water Resources, Climate Monitoring

$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "============================================" -ForegroundColor Magenta
Write-Host " EARTH ENGINE MCP - REAL WORLD TEST SUITE " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0
$testResults = @()

function Invoke-MCPTool {
    param(
        [string]$Tool,
        [hashtable]$Args,
        [string]$TestName,
        [string]$Category
    )
    
    $script:totalTests++
    Write-Host "[$totalTests] $Category - $TestName" -ForegroundColor Cyan
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $Tool
            arguments = $Args
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30
        
        if ($response.result) {
            Write-Host "  ✓ PASSED" -ForegroundColor Green
            
            # Log key results
            if ($response.result.message) {
                Write-Host "    Result: $($response.result.message)" -ForegroundColor DarkGray
            }
            if ($response.result.url) {
                Write-Host "    URL: $($response.result.url.Substring(0, [Math]::Min(60, $response.result.url.Length)))..." -ForegroundColor DarkGray
            }
            if ($response.result.count) {
                Write-Host "    Count: $($response.result.count)" -ForegroundColor DarkGray
            }
            
            $script:passedTests++
            $script:testResults += @{
                Test = "$Category - $TestName"
                Status = "PASSED"
                Details = $response.result.message
            }
            return $response.result
        }
        else {
            Write-Host "  ✗ FAILED: No result returned" -ForegroundColor Red
            $script:failedTests++
            $script:testResults += @{
                Test = "$Category - $TestName"
                Status = "FAILED"
                Details = "No result returned"
            }
            return $null
        }
    }
    catch {
        Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        $script:testResults += @{
            Test = "$Category - $TestName"
            Status = "FAILED"
            Details = $_.Exception.Message
        }
        return $null
    }
    
    Write-Host ""
}

# ====================
# 1. AGRICULTURE USE CASES
# ====================
Write-Host "=== AGRICULTURE MONITORING ===" -ForegroundColor Yellow
Write-Host ""

# Test 1.1: Search for agricultural datasets
$agResult = Invoke-MCPTool -Tool "earth_engine_data" `
    -Args @{ 
        operation = "search"
        query = "cropland"
        maxResults = 5 
    } `
    -TestName "Search agricultural datasets" `
    -Category "AGRICULTURE"

# Test 1.2: Get farmland boundary for Punjab, India
$punjabGeom = Invoke-MCPTool -Tool "earth_engine_data" `
    -Args @{ 
        operation = "geometry"
        placeName = "Punjab, India"
    } `
    -TestName "Get Punjab farmland boundary" `
    -Category "AGRICULTURE"

# Test 1.3: Calculate NDVI for crop health monitoring
$ndviResult = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "index"
        indexType = "ndvi"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
        geometry = @{
            type = "Point"
            coordinates = @(75.8573, 30.9010)  # Ludhiana
        }
    } `
    -TestName "Calculate NDVI for crop health" `
    -Category "AGRICULTURE"

# Test 1.4: Generate crop health thumbnail
$cropThumb = Invoke-MCPTool -Tool "earth_engine_export" `
    -Args @{
        operation = "thumbnail"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-06-01"
        endDate = "2024-06-30"
        geometry = @{
            type = "Point"
            coordinates = @(75.8573, 30.9010)  # Ludhiana
        }
        dimensions = "512x512"
        format = "png"
    } `
    -TestName "Generate crop health visualization" `
    -Category "AGRICULTURE"

# ====================
# 2. URBAN PLANNING USE CASES
# ====================
Write-Host "=== URBAN PLANNING AND DEVELOPMENT ===" -ForegroundColor Yellow
Write-Host ""

# Test 2.1: Get urban area boundary
$sfGeom = Invoke-MCPTool -Tool "earth_engine_data" `
    -Args @{ 
        operation = "geometry"
        placeName = "San Francisco"
    } `
    -TestName "Get San Francisco boundary" `
    -Category "URBAN"

# Test 2.2: Calculate NDBI for urban density
$ndbiResult = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "index"
        indexType = "NDBI"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)  # San Francisco
        }
    } `
    -TestName "Calculate NDBI for urban density" `
    -Category "URBAN"

# Test 2.3: Create urban composite
$urbanComposite = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR"
        compositeType = "median"
        startDate = "2024-01-01"
        endDate = "2024-03-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
    } `
    -TestName "Create quarterly urban composite" `
    -Category "URBAN"

# ====================
# 3. WATER RESOURCES USE CASES
# ====================
Write-Host "=== WATER RESOURCES MANAGEMENT ===" -ForegroundColor Yellow
Write-Host ""

# Test 3.1: Search water datasets
$waterData = Invoke-MCPTool -Tool "earth_engine_data" `
    -Args @{ 
        operation = "search"
        query = "water"
        maxResults = 3
    } `
    -TestName "Search water resource datasets" `
    -Category "WATER"

# Test 3.2: Calculate NDWI for water bodies
$ndwiResult = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "index"
        indexType = "ndwi"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-121.8863, 37.3382)  # San Jose Reservoir area
        }
    } `
    -TestName "Calculate NDWI for water detection" `
    -Category "WATER"

# Test 3.3: Calculate MNDWI for enhanced water detection
$mndwiResult = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "index"
        indexType = "MNDWI"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-121.8863, 37.3382)
        }
    } `
    -TestName "Calculate MNDWI for water bodies" `
    -Category "WATER"

# ====================
# 4. CLIMATE MONITORING USE CASES
# ====================
Write-Host "=== CLIMATE AND ENVIRONMENTAL MONITORING ===" -ForegroundColor Yellow
Write-Host ""

# Test 4.1: Get Landsat climate data
$landsatSearch = Invoke-MCPTool -Tool "earth_engine_data" `
    -Args @{ 
        operation = "search"
        query = "Landsat"
        maxResults = 3
    } `
    -TestName "Search Landsat climate datasets" `
    -Category "CLIMATE"

# Test 4.2: Calculate EVI for vegetation dynamics
$eviResult = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "index"
        indexType = "EVI"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.0322, 37.3230)  # Cupertino
        }
    } `
    -TestName "Calculate EVI for vegetation" `
    -Category "CLIMATE"

# Test 4.3: Time series analysis for climate trends
$timeSeries = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "analyze"
        analysisType = "timeseries"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-06-30"
        geometry = @{
            type = "Point"
            coordinates = @(-122.0322, 37.3230)
        }
        band = "B8"  # NIR band
        reducer = "mean"
    } `
    -TestName "Time series analysis for vegetation" `
    -Category "CLIMATE"

# ====================
# 5. DISASTER MONITORING USE CASES
# ====================
Write-Host "=== DISASTER MONITORING AND RESPONSE ===" -ForegroundColor Yellow
Write-Host ""

# Test 5.1: Get MODIS fire data
$fireData = Invoke-MCPTool -Tool "earth_engine_data" `
    -Args @{ 
        operation = "search"
        query = "MODIS fire"
        maxResults = 2
    } `
    -TestName "Search fire detection datasets" `
    -Category "DISASTER"

# Test 5.2: Calculate burn severity index
$bsiResult = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "index"
        indexType = "BSI"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-120.0885, 38.8375)  # Northern California
        }
    } `
    -TestName "Calculate burn severity index" `
    -Category "DISASTER"

# Test 5.3: Cloud masking for clear imagery
$cloudMask = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "mask"
        maskType = "clouds"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-120.0885, 38.8375)
        }
    } `
    -TestName "Apply cloud mask for clear imagery" `
    -Category "DISASTER"

# ====================
# 6. TERRAIN ANALYSIS USE CASES
# ====================
Write-Host "=== TERRAIN AND TOPOGRAPHIC ANALYSIS ===" -ForegroundColor Yellow
Write-Host ""

# Test 6.1: Generate elevation map
$elevation = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "terrain"
        terrainType = "elevation"
        region = @{
            type = "Point"
            coordinates = @(-119.4179, 36.7783)  # Fresno area
        }
    } `
    -TestName "Generate elevation map" `
    -Category "TERRAIN"

# Test 6.2: Calculate slope
$slope = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "terrain"
        terrainType = "slope"
        region = @{
            type = "Point"
            coordinates = @(-119.4179, 36.7783)
        }
    } `
    -TestName "Calculate terrain slope" `
    -Category "TERRAIN"

# Test 6.3: Generate hillshade
$hillshade = Invoke-MCPTool -Tool "earth_engine_process" `
    -Args @{
        operation = "terrain"
        terrainType = "hillshade"
        azimuth = 315
        elevation = 35
        region = @{
            type = "Point"
            coordinates = @(-119.4179, 36.7783)
        }
    } `
    -TestName "Generate hillshade visualization" `
    -Category "TERRAIN"

# ====================
# 7. EXPORT & VISUALIZATION USE CASES
# ====================
Write-Host "=== EXPORT AND VISUALIZATION WORKFLOWS ===" -ForegroundColor Yellow
Write-Host ""

# Test 7.1: Generate map tiles for web visualization
$tiles = Invoke-MCPTool -Tool "earth_engine_export" `
    -Args @{
        operation = "tiles"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        geometry = @{
            type = "Point"
            coordinates = @(-122.4194, 37.7749)
        }
    } `
    -TestName "Generate web map tiles" `
    -Category "EXPORT"

# Test 7.2: Export to Google Cloud Storage
$gcsExport = Invoke-MCPTool -Tool "earth_engine_export" `
    -Args @{
        operation = "export"
        exportType = "toGCS"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        bucket = "earth-engine-exports"
        filePrefix = "test_export_realworld"
        region = @{
            type = "Polygon"
            coordinates = @(@(
                @(-122.5, 37.7),
                @(-122.4, 37.7),
                @(-122.4, 37.8),
                @(-122.5, 37.8),
                @(-122.5, 37.7)
            ))
        }
        scale = 10
        format = "GeoTIFF"
    } `
    -TestName "Export imagery to Cloud Storage" `
    -Category "EXPORT"

# Test 7.3: Check export status (if we have a task ID)
if ($gcsExport -and $gcsExport.taskId) {
    Start-Sleep -Seconds 2
    $exportStatus = Invoke-MCPTool -Tool "earth_engine_export" `
        -Args @{
            operation = "status"
            taskId = $gcsExport.taskId
        } `
        -TestName "Check export task status" `
        -Category "EXPORT"
}

# ====================
# 8. AUTHENTICATION & SYSTEM CHECKS
# ====================
Write-Host "=== SYSTEM AND AUTHENTICATION CHECKS ===" -ForegroundColor Yellow
Write-Host ""

# Test 8.1: Verify authentication
$authCheck = Invoke-MCPTool -Tool "earth_engine_system" `
    -Args @{
        operation = "auth"
        checkType = "status"
    } `
    -TestName "Verify Earth Engine authentication" `
    -Category "SYSTEM"

# Test 8.2: Check permissions
$permissions = Invoke-MCPTool -Tool "earth_engine_system" `
    -Args @{
        operation = "auth"
        checkType = "permissions"
    } `
    -TestName "Check API permissions" `
    -Category "SYSTEM"

# Test 8.3: Get system info
$sysInfo = Invoke-MCPTool -Tool "earth_engine_system" `
    -Args @{
        operation = "info"
        infoType = "system"
    } `
    -TestName "Get system information" `
    -Category "SYSTEM"

# ====================
# TEST SUMMARY
# ====================
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "          REAL WORLD TEST SUMMARY         " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# Calculate statistics
$successRate = if ($totalTests -gt 0) { 
    [math]::Round(($passedTests / $totalTests) * 100, 2) 
} else { 0 }

# Display summary
Write-Host "Total Tests:    $totalTests" -ForegroundColor White
Write-Host "Passed:         $passedTests" -ForegroundColor Green
Write-Host "Failed:         $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Green" })
Write-Host "Success Rate:   $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 60) { "Yellow" } else { "Red" })
Write-Host ""

# Category breakdown
$categories = $testResults | Group-Object { $_.Test.Split('-')[0].Trim() }
Write-Host "Results by Category:" -ForegroundColor Cyan
foreach ($cat in $categories) {
    $catPassed = ($cat.Group | Where-Object { $_.Status -eq "PASSED" }).Count
    $catTotal = $cat.Group.Count
    $catRate = [math]::Round(($catPassed / $catTotal) * 100, 0)
    $percentage = "$catRate%"
    Write-Host "  $($cat.Name): $catPassed/$catTotal ($percentage)" -ForegroundColor $(if ($catRate -eq 100) { "Green" } elseif ($catRate -ge 50) { "Yellow" } else { "Red" })
}

Write-Host ""

# Overall status
if ($successRate -eq 100) {
    Write-Host "✓ PERFECT SCORE!" -ForegroundColor Green
    Write-Host "All real-world scenarios passed successfully." -ForegroundColor Green
    Write-Host "The Earth Engine MCP server is PRODUCTION READY!" -ForegroundColor Green
}
elseif ($successRate -ge 90) {
    Write-Host "✓ EXCELLENT PERFORMANCE" -ForegroundColor Green
    Write-Host "Most real-world scenarios working perfectly." -ForegroundColor Green
    Write-Host "Minor issues to address for full production readiness." -ForegroundColor Yellow
}
elseif ($successRate -ge 70) {
    Write-Host "⚠ GOOD PROGRESS" -ForegroundColor Yellow
    Write-Host "Core functionality working, but several issues need attention." -ForegroundColor Yellow
}
else {
    Write-Host "✗ NEEDS WORK" -ForegroundColor Red
    Write-Host "Significant issues detected. Review failed tests above." -ForegroundColor Red
}

Write-Host ""
Write-Host "Test completed at: $(Get-Date)" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Magenta
