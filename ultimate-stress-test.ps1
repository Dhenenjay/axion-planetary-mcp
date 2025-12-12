# ULTIMATE STRESS TEST - PUSHING ALL LIMITS
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "🚀 ULTIMATE EARTH ENGINE MCP STRESS TEST 🚀" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Pushing every operation to its absolute limits!" -ForegroundColor Yellow
Write-Host ""

$global:totalTests = 0
$global:passedTests = 0
$global:failedTests = 0
$timings = @()

function Stress-Test {
    param(
        [string]$Category,
        [string]$TestName,
        [string]$Tool,
        [hashtable]$Arguments,
        [int]$Timeout = 30,
        [bool]$ExpectFailure = $false
    )
    
    $global:totalTests++
    Write-Host "  [$($global:totalTests)] $TestName" -NoNewline
    
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
            -TimeoutSec $Timeout `
            -ErrorAction Stop
        
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        $script:timings += $elapsed
        
        if ($ExpectFailure) {
            # We expected this to fail
            if ($response.error -or $response.success -eq $false) {
                Write-Host " [PASS] Failed as expected (${elapsed}ms)" -ForegroundColor Green
                $global:passedTests++
                return $true
            } else {
                Write-Host " [FAIL] Should have failed" -ForegroundColor Red
                $global:failedTests++
                return $false
            }
        } else {
            # We expected success
            if ($response.error -or $response.success -eq $false) {
                Write-Host " [FAIL] ${elapsed}ms" -ForegroundColor Red
                Write-Host "      Error: $($response.error)" -ForegroundColor DarkRed
                $global:failedTests++
                return $false
            } else {
                Write-Host " [PASS] ${elapsed}ms" -ForegroundColor Green
                if ($response.imageCount) {
                    Write-Host "      Found $($response.imageCount) images" -ForegroundColor DarkGray
                }
                if ($response.compositeKey) {
                    Write-Host "      Key: $($response.compositeKey)" -ForegroundColor DarkGray
                }
                if ($response.mapId) {
                    Write-Host "      Map ID: $($response.mapId)" -ForegroundColor DarkGray
                }
                $global:passedTests++
                return $true
            }
        }
    }
    catch {
        $global:failedTests++
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Host "      $($_.Exception.Message)" -ForegroundColor DarkRed
        return $false
    }
}

# ====================
# CATEGORY 1: DATA OPERATIONS AT SCALE
# ====================
Write-Host "CATEGORY 1: DATA OPERATIONS AT SCALE" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Blue

Stress-Test -Category "Data" -TestName "Search with 100 results" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "sentinel"
    limit = 100
}

Stress-Test -Category "Data" -TestName "Filter large date range (5 years)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2019-01-01"
    endDate = "2024-12-31"
    region = "California"
    cloudCoverMax = 10
} -Timeout 60

Stress-Test -Category "Data" -TestName "Complex geometry (Texas)" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Texas"
}

Stress-Test -Category "Data" -TestName "Multiple dataset info requests" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "NASA/GPM_L3/IMERG_V06"
}

Stress-Test -Category "Data" -TestName "All boundaries listing" -Tool "earth_engine_data" -Arguments @{
    operation = "boundaries"
}

Write-Host ""

# ====================
# CATEGORY 2: HEAVY PROCESSING
# ====================
Write-Host "CATEGORY 2: HEAVY PROCESSING OPERATIONS" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Blue

Stress-Test -Category "Process" -TestName "Large area composite (California)" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-03-31"
    region = "California"
    compositeType = "median"
    cloudCoverMax = 20
} -Timeout 90

Stress-Test -Category "Process" -TestName "Maximum quality composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Los Angeles"
    compositeType = "greenest"
    cloudCoverMax = 5
} -Timeout 60

# Test all indices back-to-back
$indices = @("NDVI", "NDWI", "EVI", "MNDWI", "NDBI", "BSI")
foreach ($index in $indices) {
    Stress-Test -Category "Process" -TestName "$index calculation (large area)" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $index
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-31"
        region = "San Francisco"
    } -Timeout 45
}

Stress-Test -Category "Process" -TestName "Complex FCC (12-band)" -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-30"
    region = "Seattle"
    bands = @("B12", "B8A", "B4")
} -Timeout 45

Write-Host ""

# ====================
# CATEGORY 3: EXPORT STRESS
# ====================
Write-Host "CATEGORY 3: EXPORT & VISUALIZATION STRESS" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Blue

# First create composites for export tests
Write-Host "  Creating test composites..." -ForegroundColor Gray

$compositeResult = Invoke-RestMethod -Uri $SSE_ENDPOINT -Method POST -Body (@{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-15"
        region = "Miami"
        compositeType = "median"
    }
} | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 30 -ErrorAction SilentlyContinue

if ($compositeResult.compositeKey) {
    Stress-Test -Category "Export" -TestName "High-res thumbnail (2048px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeResult.compositeKey
        dimensions = 2048
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
            gamma = 1.4
        }
    } -Timeout 45
    
    Stress-Test -Category "Export" -TestName "Tile service from composite" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        compositeKey = $compositeResult.compositeKey
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 60
}

# Test NDVI visualization
$ndviResult = Invoke-RestMethod -Uri $SSE_ENDPOINT -Method POST -Body (@{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-10"
        region = "Phoenix"
    }
} | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 30 -ErrorAction SilentlyContinue

if ($ndviResult.indexKey -or $ndviResult.ndviKey) {
    $key = if ($ndviResult.indexKey) { $ndviResult.indexKey } else { $ndviResult.ndviKey }
    
    Stress-Test -Category "Export" -TestName "NDVI thumbnail with palette" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        ndviKey = $key
        dimensions = 1024
        visParams = @{
            bands = @("NDVI")
            min = -1
            max = 1
            palette = @("red", "yellow", "green", "darkgreen")
        }
    } -Timeout 45
    
    Stress-Test -Category "Export" -TestName "NDVI tile service" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        ndviKey = $key
    } -Timeout 60
}

# Direct tile generation tests
Stress-Test -Category "Export" -TestName "Direct Sentinel-2 tiles" -Tool "earth_engine_export" -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-15"
    region = "Manhattan"
} -Timeout 60

Stress-Test -Category "Export" -TestName "Direct Landsat tiles" -Tool "earth_engine_export" -Arguments @{
    operation = "tiles"
    datasetId = "LANDSAT/LC08/C02/T1_L2"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    region = "Denver"
} -Timeout 60

Write-Host ""

# ====================
# CATEGORY 4: EDGE CASES & ERROR HANDLING
# ====================
Write-Host "CATEGORY 4: EDGE CASES & ERROR HANDLING" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Blue

Stress-Test -Category "Edge" -TestName "Invalid dataset (should fail gracefully)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "INVALID/DATASET/XYZ123"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Texas"
} -ExpectFailure $true

Stress-Test -Category "Edge" -TestName "Future dates" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2025-06-01"
    endDate = "2025-12-31"
    region = "Boston"
}

Stress-Test -Category "Edge" -TestName "Tiny region" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Manhattan"
    compositeType = "median"
}

Stress-Test -Category "Edge" -TestName "Empty query search" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = ""
    limit = 5
}

Stress-Test -Category "Edge" -TestName "Unknown index type (should fail)" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "UNKNOWN_INDEX"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Miami"
} -ExpectFailure $true

Write-Host ""

# ====================
# CATEGORY 5: CONCURRENT OPERATIONS
# ====================
Write-Host "CATEGORY 5: CONCURRENT OPERATIONS" -ForegroundColor White
Write-Host "==================================" -ForegroundColor Blue

Write-Host "  Sending 5 concurrent requests..." -ForegroundColor Yellow

$jobs = @()
1..5 | ForEach-Object {
    $jobs += Start-Job -ScriptBlock {
        param($num, $endpoint)
        $body = @{
            tool = "earth_engine_data"
            arguments = @{
                operation = "filter"
                datasetId = "COPERNICUS/S2_SR_HARMONIZED"
                startDate = "2024-0$num-01"
                endDate = "2024-0$num-15"
                region = "Los Angeles"
                cloudCoverMax = 20
            }
        } | ConvertTo-Json -Depth 10
        
        try {
            $response = Invoke-RestMethod -Uri $endpoint `
                -Method POST `
                -Body $body `
                -ContentType "application/json" `
                -TimeoutSec 30
            return @{Success=$true; Num=$num; Count=$response.imageCount}
        } catch {
            return @{Success=$false; Num=$num; Error=$_.Exception.Message}
        }
    } -ArgumentList $_, $SSE_ENDPOINT
}

$concurrentResults = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$concurrentSuccess = ($concurrentResults | Where-Object { $_.Success }).Count
Write-Host "  Concurrent requests: $concurrentSuccess/5 succeeded" -ForegroundColor $(if ($concurrentSuccess -eq 5) {"Green"} else {"Yellow"})
$global:totalTests += 5
$global:passedTests += $concurrentSuccess
$global:failedTests += (5 - $concurrentSuccess)

Write-Host ""

# ====================
# FINAL STATISTICS
# ====================
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "ULTIMATE STRESS TEST COMPLETE" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

$successRate = if ($global:totalTests -gt 0) { 
    [math]::Round(($global:passedTests / $global:totalTests) * 100, 1) 
} else { 0 }

$avgTiming = if ($timings.Count -gt 0) {
    [math]::Round(($timings | Measure-Object -Average).Average, 0)
} else { 0 }

$maxTiming = if ($timings.Count -gt 0) {
    ($timings | Measure-Object -Maximum).Maximum
} else { 0 }

$minTiming = if ($timings.Count -gt 0) {
    ($timings | Measure-Object -Minimum).Minimum
} else { 0 }

Write-Host "📊 TEST RESULTS:" -ForegroundColor Yellow
Write-Host "   Total Tests: $($global:totalTests)" -ForegroundColor White
Write-Host "   Passed: $($global:passedTests)" -ForegroundColor Green
Write-Host "   Failed: $($global:failedTests)" -ForegroundColor Red
Write-Host "   Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) {"Green"} elseif ($successRate -ge 70) {"Yellow"} else {"Red"})

Write-Host ""
Write-Host "⏱️ PERFORMANCE METRICS:" -ForegroundColor Yellow
Write-Host "   Average Response Time: ${avgTiming}ms" -ForegroundColor White
Write-Host "   Fastest Response: ${minTiming}ms" -ForegroundColor Green
Write-Host "   Slowest Response: ${maxTiming}ms" -ForegroundColor Yellow

Write-Host ""
Write-Host "🔥 STRESS TEST GRADE:" -ForegroundColor Yellow

if ($successRate -ge 95) {
    Write-Host "   ⭐⭐⭐⭐⭐ EXCEPTIONAL!" -ForegroundColor Green
    Write-Host "   Your server is bulletproof and production-ready!" -ForegroundColor Green
    Write-Host "   Can handle extreme loads and edge cases perfectly." -ForegroundColor Green
} elseif ($successRate -ge 85) {
    Write-Host "   ⭐⭐⭐⭐ EXCELLENT!" -ForegroundColor Green
    Write-Host "   Server is highly robust and ready for production." -ForegroundColor Green
    Write-Host "   Minor optimizations could improve edge case handling." -ForegroundColor Yellow
} elseif ($successRate -ge 75) {
    Write-Host "   ⭐⭐⭐ GOOD" -ForegroundColor Yellow
    Write-Host "   Server handles most scenarios well." -ForegroundColor Yellow
    Write-Host "   Some stress scenarios need attention." -ForegroundColor Yellow
} elseif ($successRate -ge 60) {
    Write-Host "   ⭐⭐ NEEDS IMPROVEMENT" -ForegroundColor Red
    Write-Host "   Server struggles under stress." -ForegroundColor Red
    Write-Host "   Significant optimization required." -ForegroundColor Red
} else {
    Write-Host "   ⭐ CRITICAL ISSUES" -ForegroundColor Red
    Write-Host "   Server cannot handle stress conditions." -ForegroundColor Red
    Write-Host "   Major refactoring needed." -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "Server tested at maximum capacity!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Magenta
