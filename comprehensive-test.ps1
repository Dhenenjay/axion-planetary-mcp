# Comprehensive Earth Engine MCP Server Test
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "EARTH ENGINE MCP SERVER - COMPREHENSIVE TEST" -ForegroundColor Magenta
$separator = "=" * 60
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

function Test-EarthEngine {
    param(
        [string]$Tool,
        [hashtable]$Arguments,
        [string]$TestName,
        [int]$Timeout = 30
    )
    
    Write-Host ""
    Write-Host "TEST: $TestName" -ForegroundColor Cyan
    Write-Host "  Tool: $Tool" -ForegroundColor Gray
    
    $body = @{
        tool = $Tool
        arguments = $Arguments
    } | ConvertTo-Json -Depth 10
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $response = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec $Timeout
        
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        
        if ($response.error -or $response.success -eq $false) {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            return $false
        }
        
        Write-Host "  SUCCESS in ${elapsed}ms" -ForegroundColor Green
        
        # Show key results
        if ($response.imageCount) {
            Write-Host "  Result: $($response.imageCount) images found" -ForegroundColor Cyan
        }
        if ($response.compositeKey) {
            Write-Host "  Composite Key: $($response.compositeKey)" -ForegroundColor Cyan
        }
        if ($response.ndviKey) {
            Write-Host "  NDVI Key: $($response.ndviKey)" -ForegroundColor Cyan
        }
        if ($response.url) {
            Write-Host "  Thumbnail: $($response.url)" -ForegroundColor Cyan
        }
        if ($response.geometry) {
            Write-Host "  Geometry found for location" -ForegroundColor Cyan
        }
        if ($response.datasets) {
            Write-Host "  Found $($response.datasets.Count) datasets" -ForegroundColor Cyan
        }
        if ($response.title) {
            Write-Host "  Dataset: $($response.title)" -ForegroundColor Cyan
        }
        
        return $true
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Host "  ERROR: $errorMsg" -ForegroundColor Red
        
        if ($errorMsg -like "*timeout*" -or $errorMsg -like "*timed out*") {
            Write-Host "  Consider increasing timeout for this operation" -ForegroundColor Yellow
        }
        
        return $false
    }
}

# Track results
$passCount = 0
$failCount = 0
$results = @()

Write-Host "STARTING COMPREHENSIVE TESTS..." -ForegroundColor White
Write-Host ""

# ====================
# CATEGORY 1: Basic Data Operations
# ====================
$category1 = "=" * 60
Write-Host $category1 -ForegroundColor Blue
Write-Host "CATEGORY 1: BASIC DATA OPERATIONS" -ForegroundColor White
Write-Host $category1 -ForegroundColor Blue

# Test 1: Search
$test = Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "sentinel"
    limit = 10
} -TestName "Search for Sentinel datasets" -Timeout 15

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Search datasets"; Result=$test}

Start-Sleep -Seconds 1

# Test 2: Filter with small region
$test = Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2025-01-01"
    endDate = "2025-01-10"
    region = "San Francisco"
    cloudCoverMax = 20
} -TestName "Filter Sentinel-2 for San Francisco (10 days)" -Timeout 30

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Filter imagery"; Result=$test}

Start-Sleep -Seconds 1

# Test 3: Geometry lookup
$test = Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Los Angeles"
} -TestName "Get geometry for Los Angeles" -Timeout 20

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Get geometry"; Result=$test}

Start-Sleep -Seconds 1

# Test 4: Dataset info
$test = Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
} -TestName "Get Sentinel-2 dataset info" -Timeout 15

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Dataset info"; Result=$test}

Start-Sleep -Seconds 1

# ====================
# CATEGORY 2: Processing Operations
# ====================
Write-Host ""
$category2 = "=" * 60
Write-Host $category2 -ForegroundColor Blue
Write-Host "CATEGORY 2: PROCESSING OPERATIONS" -ForegroundColor White
Write-Host $category2 -ForegroundColor Blue

# Test 5: Create median composite
$compositeResult = $null
$test = Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-15"
    region = "San Francisco"
    compositeType = "median"
    cloudCoverMax = 30
} -TestName "Create median composite (2 weeks, small area)" -Timeout 45

if ($test) { 
    $passCount++
    # Save composite for next test
    $compositeResult = Invoke-RestMethod -Uri $SSE_ENDPOINT -Method POST -Body (@{
        tool = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-10-01"
            endDate = "2024-10-15"
            region = "San Francisco"
            compositeType = "median"
            cloudCoverMax = 30
        }
    } | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 45 -ErrorAction SilentlyContinue
} else { 
    $failCount++ 
}
$results += @{Name="Create composite"; Result=$test}

Start-Sleep -Seconds 2

# Test 6: Generate thumbnail if composite exists
if ($compositeResult -and $compositeResult.compositeKey) {
    $test = Test-EarthEngine -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeResult.compositeKey
        region = "San Francisco"
        dimensions = 512
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
            gamma = 1.4
        }
    } -TestName "Generate thumbnail from composite" -Timeout 30
    
    if ($test) { $passCount++ } else { $failCount++ }
    $results += @{Name="Generate thumbnail"; Result=$test}
} else {
    Write-Host "  Skipping thumbnail test - no composite key available" -ForegroundColor Yellow
    $results += @{Name="Generate thumbnail"; Result=$false}
    $failCount++
}

Start-Sleep -Seconds 1

# Test 7: Calculate NDVI
$test = Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-15"
    region = "Los Angeles"
} -TestName "Calculate NDVI for Los Angeles" -Timeout 45

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Calculate NDVI"; Result=$test}

Start-Sleep -Seconds 1

# Test 8: Create FCC
$test = Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-15"
    region = "Miami"
    bands = @("B8", "B4", "B3")
} -TestName "Create False Color Composite" -Timeout 30

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Create FCC"; Result=$test}

Start-Sleep -Seconds 1

# ====================
# CATEGORY 3: Advanced Operations
# ====================
Write-Host ""
$category3 = "=" * 60
Write-Host $category3 -ForegroundColor Blue
Write-Host "CATEGORY 3: ADVANCED OPERATIONS" -ForegroundColor White
Write-Host $category3 -ForegroundColor Blue

# Test 9: Multiple indices
$indices = @("NDWI", "EVI")
foreach ($index in $indices) {
    $test = Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $index
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-07"
        region = "Miami"
    } -TestName "Calculate $index for Miami" -Timeout 30
    
    if ($test) { $passCount++ } else { $failCount++ }
    $results += @{Name="Calculate $index"; Result=$test}
    Start-Sleep -Seconds 1
}

# Test 10: Export with tile service
$test = Test-EarthEngine -Tool "earth_engine_export" -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-31"
    region = "San Francisco"
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 0.3
    }
} -TestName "Generate map tiles service" -Timeout 90

if ($test) { $passCount++ } else { $failCount++ }
$results += @{Name="Generate tiles"; Result=$test}

# ====================
# CATEGORY 4: Error Handling
# ====================
Write-Host ""
$category4 = "=" * 60
Write-Host $category4 -ForegroundColor Blue
Write-Host "CATEGORY 4: ERROR HANDLING" -ForegroundColor White
Write-Host $category4 -ForegroundColor Blue

# Test 11: Invalid dataset
$test = Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "INVALID/DATASET/XYZ"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Texas"
} -TestName "Invalid dataset (should fail gracefully)" -Timeout 10

# We expect this to fail gracefully
if (-not $test) { 
    Write-Host "  Good: Failed gracefully as expected" -ForegroundColor Green
    $passCount++ 
} else { 
    $failCount++ 
}
$results += @{Name="Error handling"; Result=(-not $test)}

# ====================
# FINAL REPORT
# ====================
Write-Host ""
Write-Host ""
$finalSeparator = "=" * 60
Write-Host $finalSeparator -ForegroundColor Magenta
Write-Host "COMPREHENSIVE TEST COMPLETE" -ForegroundColor White
Write-Host $finalSeparator -ForegroundColor Magenta

$totalTests = $passCount + $failCount
$successRate = if ($totalTests -gt 0) { [math]::Round(($passCount / $totalTests) * 100, 1) } else { 0 }

Write-Host ""
Write-Host "RESULTS SUMMARY:" -ForegroundColor Yellow
Write-Host "=================" -ForegroundColor Yellow
Write-Host ""

# Show detailed results
$results | ForEach-Object {
    $status = if ($_.Result) { "[PASS]" } else { "[FAIL]" }
    $color = if ($_.Result) { "Green" } else { "Red" }
    Write-Host "  $status $($_.Name)" -ForegroundColor $color
}

Write-Host ""
Write-Host "STATISTICS:" -ForegroundColor Yellow
Write-Host "  Total Tests: $totalTests" -ForegroundColor White
Write-Host "  Passed: $passCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host "  Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) {"Green"} else {"Red"})

Write-Host ""
if ($successRate -ge 90) {
    Write-Host "EXCELLENT! Your server is production-ready!" -ForegroundColor Green
    Write-Host "All critical operations are working correctly." -ForegroundColor Green
} elseif ($successRate -ge 70) {
    Write-Host "GOOD: Server is mostly functional." -ForegroundColor Yellow
    Write-Host "Some optimizations may be needed for production." -ForegroundColor Yellow
} else {
    Write-Host "NEEDS ATTENTION: Server has significant issues." -ForegroundColor Red
    Write-Host "Review failed tests and server logs for details." -ForegroundColor Red
}

Write-Host ""
Write-Host "TIP: Check your server console for detailed processing logs" -ForegroundColor Cyan
Write-Host $finalSeparator -ForegroundColor Cyan
