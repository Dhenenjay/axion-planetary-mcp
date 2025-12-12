# Real-time Interactive Stress Test for Earth Engine MCP Server
# Shows live server communication and results

$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host "`n🚀 EARTH ENGINE MCP SERVER - REAL-TIME STRESS TEST" -ForegroundColor Magenta
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "Watch your server logs to see real-time processing!" -ForegroundColor Yellow
Write-Host ("=" * 60) -ForegroundColor Cyan

function Test-EarthEngine {
    param(
        [string]$Tool,
        [hashtable]$Arguments,
        [string]$TestName,
        [int]$Timeout = 30
    )
    
    Write-Host "`n🔄 TEST: $TestName" -ForegroundColor Cyan
    Write-Host "   Tool: $Tool" -ForegroundColor Gray
    Write-Host "   Sending request..." -ForegroundColor Yellow
    
    $body = @{
        tool = $Tool
        arguments = $Arguments
    } | ConvertTo-Json -Depth 10
    
    # Show what we're sending
    Write-Host "   Request Body:" -ForegroundColor DarkGray
    $body | Write-Host -ForegroundColor DarkGray
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        # Make the request with timeout
        $response = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec $Timeout
        
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        
        # Check for errors in response
        if ($response.error -or $response.success -eq $false) {
            Write-Host "   ❌ FAILED: $($response.error)" -ForegroundColor Red
            return $false
        }
        
        Write-Host "   ✅ SUCCESS in ${elapsed}ms" -ForegroundColor Green
        
        # Show key results
        if ($response.imageCount) {
            Write-Host "   📊 Result: $($response.imageCount) images found" -ForegroundColor Cyan
        }
        if ($response.compositeKey) {
            Write-Host "   🔑 Composite Key: $($response.compositeKey)" -ForegroundColor Cyan
        }
        if ($response.ndviKey) {
            Write-Host "   🔑 NDVI Key: $($response.ndviKey)" -ForegroundColor Cyan
        }
        if ($response.url) {
            Write-Host "   🖼️ Thumbnail: $($response.url)" -ForegroundColor Cyan
        }
        if ($response.geometry) {
            Write-Host "   📍 Geometry found for location" -ForegroundColor Cyan
        }
        if ($response.datasets) {
            Write-Host "   📚 Found $($response.datasets.Count) datasets" -ForegroundColor Cyan
        }
        
        return $true
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Host "   ❌ ERROR: $errorMsg" -ForegroundColor Red
        
        if ($errorMsg -like "*timeout*" -or $errorMsg -like "*timed out*") {
            Write-Host "   ⏱️ Consider increasing timeout for this operation" -ForegroundColor Yellow
        }
        
        return $false
    }
}

# Track results
$passCount = 0
$failCount = 0

Write-Host "`n📋 STARTING COMPREHENSIVE TESTS..." -ForegroundColor White
Write-Host "Monitor your server console for processing details" -ForegroundColor Gray

# ====================
# CATEGORY 1: Basic Data Operations
# ====================
Write-Host ("`n" + ("=" * 60)) -ForegroundColor Blue
Write-Host "CATEGORY 1: BASIC DATA OPERATIONS" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Blue

# Test 1: Search
if (Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "sentinel"
    limit = 10
} -TestName "Search for Sentinel datasets" -Timeout 15) {
    $passCount++
} else {
    $failCount++
}

Start-Sleep -Seconds 1

# Test 2: Filter with small region
if (Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2025-01-01"
    endDate = "2025-01-10"
    region = "San Francisco"
    cloudCoverMax = 20
} -TestName "Filter Sentinel-2 for San Francisco (10 days)" -Timeout 30) {
    $passCount++
} else {
    $failCount++
}

Start-Sleep -Seconds 1

# Test 3: Geometry lookup
if (Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Los Angeles"
} -TestName "Get geometry for Los Angeles" -Timeout 20) {
    $passCount++
} else {
    $failCount++
}

Start-Sleep -Seconds 1

# ====================
# CATEGORY 2: Processing Operations
# ====================
Write-Host ("`n" + ("=" * 60)) -ForegroundColor Blue
Write-Host "CATEGORY 2: PROCESSING OPERATIONS" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Blue

# Test 4: Create median composite
$compositeResult = $null
if (Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-15"  # Shorter period for faster processing
    region = "San Francisco"
    compositeType = "median"
    cloudCoverMax = 30
} -TestName "Create median composite (2 weeks, small area)" -Timeout 45) {
    $passCount++
    # Capture composite key for next test
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
    } | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 45
} else {
    $failCount++
}

Start-Sleep -Seconds 2

# Test 5: Generate thumbnail if composite exists
if ($compositeResult -and $compositeResult.compositeKey) {
    if (Test-EarthEngine -Tool "earth_engine_export" -Arguments @{
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
    } -TestName "Generate thumbnail from composite" -Timeout 30) {
        $passCount++
    } else {
        $failCount++
    }
} else {
    Write-Host "   ⚠️ Skipping thumbnail test - no composite key available" -ForegroundColor Yellow
}

Start-Sleep -Seconds 1

# Test 6: Calculate NDVI
if (Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-15"
    region = "Los Angeles"
} -TestName "Calculate NDVI for Los Angeles" -Timeout 45) {
    $passCount++
} else {
    $failCount++
}

Start-Sleep -Seconds 1

# ====================
# CATEGORY 3: Stress Tests
# ====================
Write-Host ("`n" + ("=" * 60)) -ForegroundColor Blue
Write-Host "CATEGORY 3: STRESS TESTS" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Blue

# Test 7: Large date range
if (Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "MODIS/006/MOD13Q1"
    startDate = "2024-01-01"
    endDate = "2024-12-31"
    region = "California"
} -TestName "Filter MODIS full year for California" -Timeout 60) {
    $passCount++
} else {
    $failCount++
}

Start-Sleep -Seconds 1

# Test 8: Multiple indices
$indices = @("NDVI", "NDWI", "EVI")
foreach ($index in $indices) {
    if (Test-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $index
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-07"  # Just one week
        region = "Miami"
    } -TestName "Calculate $index for Miami" -Timeout 30) {
        $passCount++
    } else {
        $failCount++
    }
    Start-Sleep -Seconds 1
}

# ====================
# CATEGORY 4: Error Handling
# ====================
Write-Host ("`n" + ("=" * 60)) -ForegroundColor Blue
Write-Host "CATEGORY 4: ERROR HANDLING" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Blue

# Test 9: Invalid dataset
if (Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "INVALID/DATASET/XYZ"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Texas"
} -TestName "Invalid dataset (should fail gracefully)" -Timeout 10) {
    $failCount++  # This should fail
} else {
    $passCount++  # We expect it to fail gracefully
}

Start-Sleep -Seconds 1

# Test 10: Invalid region
if (Test-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Atlantis12345"
} -TestName "Invalid place name (should fail gracefully)" -Timeout 10) {
    $failCount++  # This should fail
} else {
    $passCount++  # We expect it to fail gracefully
}

# ====================
# FINAL REPORT
# ====================
Write-Host ("`n" + ("=" * 60)) -ForegroundColor Magenta
Write-Host "STRESS TEST COMPLETE" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Magenta

$totalTests = $passCount + $failCount
$successRate = if ($totalTests -gt 0) { [math]::Round(($passCount / $totalTests) * 100, 1) } else { 0 }

Write-Host "`n📊 RESULTS:" -ForegroundColor Yellow
Write-Host "   Total Tests: $totalTests" -ForegroundColor White
Write-Host "   Passed: $passCount" -ForegroundColor Green
Write-Host "   Failed: $failCount" -ForegroundColor Red
Write-Host "   Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) {"Green"} else {"Red"})

if ($successRate -ge 90) {
    Write-Host "`n🎉 EXCELLENT! Your server is production-ready!" -ForegroundColor Green
    Write-Host "   All critical operations are working correctly." -ForegroundColor Green
} elseif ($successRate -ge 70) {
    Write-Host "`n⚠️ GOOD: Server is mostly functional." -ForegroundColor Yellow
    Write-Host "   Some optimizations may be needed for production." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ NEEDS ATTENTION: Server has significant issues." -ForegroundColor Red
    Write-Host "   Review failed tests and server logs for details." -ForegroundColor Red
}

Write-Host "`n💡 TIP: Check your server console for detailed processing logs" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
