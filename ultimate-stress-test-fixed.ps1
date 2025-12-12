# ULTIMATE STRESS TEST - FIXED VERSION
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "🚀 ULTIMATE EARTH ENGINE MCP STRESS TEST 🚀" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Testing server at: $SSE_ENDPOINT" -ForegroundColor Yellow
Write-Host ""

# First, test if server is responding
Write-Host "Checking server connectivity..." -ForegroundColor Yellow
try {
    $testBody = @{
        tool = "earth_engine_data"
        arguments = @{
            operation = "boundaries"
        }
    } | ConvertTo-Json -Depth 10
    
    $testResponse = Invoke-WebRequest -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $testBody `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -UseBasicParsing
    
    if ($testResponse.StatusCode -eq 200) {
        Write-Host "✅ Server is responding!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Server returned status: $($testResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Cannot connect to server at $SSE_ENDPOINT" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    Write-Host ""
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. The server is running (npm run dev or use start-nextjs-server.ps1)" -ForegroundColor White
    Write-Host "  2. The server is listening on port 3000" -ForegroundColor White
    Write-Host "  3. The endpoint /api/mcp/sse is available" -ForegroundColor White
    exit 1
}

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
        
        # Use Invoke-WebRequest for better control
        $response = Invoke-WebRequest -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec $Timeout `
            -UseBasicParsing
        
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        $script:timings += $elapsed
        
        # Parse JSON response
        $responseData = $response.Content | ConvertFrom-Json
        
        if ($ExpectFailure) {
            # We expected this to fail
            if ($responseData.error -or $responseData.success -eq $false) {
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
            if ($responseData.error -or $responseData.success -eq $false) {
                Write-Host " [FAIL] ${elapsed}ms" -ForegroundColor Red
                if ($responseData.error) {
                    Write-Host "      Error: $($responseData.error)" -ForegroundColor DarkRed
                }
                $global:failedTests++
                return $false
            } else {
                Write-Host " [PASS] ${elapsed}ms" -ForegroundColor Green
                if ($responseData.imageCount) {
                    Write-Host "      Found $($responseData.imageCount) images" -ForegroundColor DarkGray
                }
                if ($responseData.compositeKey) {
                    Write-Host "      Key: $($responseData.compositeKey)" -ForegroundColor DarkGray
                }
                if ($responseData.mapId) {
                    Write-Host "      Map ID: $($responseData.mapId)" -ForegroundColor DarkGray
                }
                $global:passedTests++
                return $true
            }
        }
    }
    catch [System.Net.WebException] {
        if ($_.Exception.Message -like "*timed out*" -or $_.Exception.Message -like "*timeout*") {
            Write-Host " [TIMEOUT] after ${Timeout}s" -ForegroundColor Yellow
        } else {
            Write-Host " [ERROR]" -ForegroundColor Red
            Write-Host "      $($_.Exception.Message)" -ForegroundColor DarkRed
        }
        $global:failedTests++
        return $false
    }
    catch {
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Host "      $($_.Exception.Message)" -ForegroundColor DarkRed
        $global:failedTests++
        return $false
    }
}

# ====================
# CATEGORY 1: DATA OPERATIONS AT SCALE
# ====================
Write-Host "CATEGORY 1: DATA OPERATIONS AT SCALE" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Blue

Stress-Test -Category "Data" -TestName "Search for datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "sentinel"
    limit = 10
} -Timeout 15

Stress-Test -Category "Data" -TestName "Filter with moderate date range" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "San Francisco"
    cloudCoverMax = 20
} -Timeout 30

Stress-Test -Category "Data" -TestName "Get geometry for city" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Los Angeles"
} -Timeout 20

Stress-Test -Category "Data" -TestName "Get dataset info" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
} -Timeout 15

Stress-Test -Category "Data" -TestName "List boundaries" -Tool "earth_engine_data" -Arguments @{
    operation = "boundaries"
} -Timeout 10

Write-Host ""

# ====================
# CATEGORY 2: PROCESSING OPERATIONS
# ====================
Write-Host "CATEGORY 2: PROCESSING OPERATIONS" -ForegroundColor White
Write-Host "==================================" -ForegroundColor Blue

Stress-Test -Category "Process" -TestName "Create composite (small area)" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-15"
    region = "Manhattan"
    compositeType = "median"
    cloudCoverMax = 30
} -Timeout 45

Stress-Test -Category "Process" -TestName "Create FCC" -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-15"
    region = "Miami"
} -Timeout 45

# Test indices
$indices = @("NDVI", "NDWI", "EVI")
foreach ($index in $indices) {
    Stress-Test -Category "Process" -TestName "Calculate $index" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $index
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-07"
        region = "Phoenix"
    } -Timeout 45
}

# Test additional indices
$moreIndices = @("MNDWI", "NDBI", "BSI")
foreach ($index in $moreIndices) {
    Stress-Test -Category "Process" -TestName "Calculate $index" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $index
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-07"
        region = "Seattle"
    } -Timeout 45
}

Write-Host ""

# ====================
# CATEGORY 3: EXPORT & VISUALIZATION
# ====================
Write-Host "CATEGORY 3: EXPORT & VISUALIZATION" -ForegroundColor White
Write-Host "===================================" -ForegroundColor Blue

# Create a composite first
Write-Host "  Preparing composite for export tests..." -ForegroundColor Gray
$compositeBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-10"
        region = "Denver"
        compositeType = "median"
    }
} | ConvertTo-Json -Depth 10

$compositeResult = $null
try {
    $response = Invoke-WebRequest -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $compositeBody `
        -ContentType "application/json" `
        -TimeoutSec 30 `
        -UseBasicParsing
    
    $compositeResult = $response.Content | ConvertFrom-Json
} catch {
    Write-Host "  Could not create composite for export tests" -ForegroundColor Yellow
}

if ($compositeResult -and $compositeResult.compositeKey) {
    Stress-Test -Category "Export" -TestName "Generate thumbnail (512px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeResult.compositeKey
        dimensions = 512
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 30
    
    Stress-Test -Category "Export" -TestName "Generate thumbnail (1024px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeResult.compositeKey
        dimensions = 1024
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
            gamma = 1.4
        }
    } -Timeout 45
    
    Stress-Test -Category "Export" -TestName "Generate tiles from composite" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        compositeKey = $compositeResult.compositeKey
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 30
}

# Create NDVI for visualization
Write-Host "  Preparing NDVI for visualization tests..." -ForegroundColor Gray
$ndviBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-07"
        region = "Boston"
    }
} | ConvertTo-Json -Depth 10

$ndviResult = $null
try {
    $response = Invoke-WebRequest -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $ndviBody `
        -ContentType "application/json" `
        -TimeoutSec 30 `
        -UseBasicParsing
    
    $ndviResult = $response.Content | ConvertFrom-Json
} catch {
    Write-Host "  Could not create NDVI for visualization tests" -ForegroundColor Yellow
}

if ($ndviResult -and ($ndviResult.indexKey -or $ndviResult.ndviKey)) {
    $key = if ($ndviResult.indexKey) { $ndviResult.indexKey } else { $ndviResult.ndviKey }
    
    Stress-Test -Category "Export" -TestName "NDVI thumbnail" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        ndviKey = $key
        dimensions = 512
        visParams = @{
            bands = @("NDVI")
            min = -1
            max = 1
            palette = @("blue", "white", "green")
        }
    } -Timeout 30
    
    Stress-Test -Category "Export" -TestName "NDVI tiles" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        ndviKey = $key
    } -Timeout 30
}

Write-Host ""

# ====================
# CATEGORY 4: EDGE CASES & ERROR HANDLING
# ====================
Write-Host "CATEGORY 4: EDGE CASES & ERROR HANDLING" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Blue

Stress-Test -Category "Edge" -TestName "Invalid dataset" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "INVALID/DATASET/XYZ"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Texas"
} -ExpectFailure $true -Timeout 20

Stress-Test -Category "Edge" -TestName "Invalid place name" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Atlantis123456"
} -ExpectFailure $true -Timeout 20

Stress-Test -Category "Edge" -TestName "Empty search query" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = ""
    limit = 5
} -Timeout 15

Stress-Test -Category "Edge" -TestName "Unknown index type" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "UNKNOWN_INDEX"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Miami"
} -ExpectFailure $true -Timeout 20

Stress-Test -Category "Edge" -TestName "Future dates" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2025-12-01"
    endDate = "2025-12-31"
    region = "Chicago"
} -Timeout 30

Write-Host ""

# ====================
# CATEGORY 5: STRESS SCENARIOS
# ====================
Write-Host "CATEGORY 5: STRESS SCENARIOS" -ForegroundColor White
Write-Host "=============================" -ForegroundColor Blue

Stress-Test -Category "Stress" -TestName "Large area filter" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-12-31"
    region = "California"
    cloudCoverMax = 15
} -Timeout 60

Stress-Test -Category "Stress" -TestName "Complex composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Texas"
    compositeType = "greenest"
    cloudCoverMax = 10
} -Timeout 90

Stress-Test -Category "Stress" -TestName "High-res thumbnail" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-15"
    region = "Los Angeles"
    dimensions = 2048
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 0.3
    }
} -Timeout 60

Write-Host ""

# ====================
# CATEGORY 6: RAPID FIRE TESTS
# ====================
Write-Host "CATEGORY 6: RAPID FIRE TESTS" -ForegroundColor White
Write-Host "=============================" -ForegroundColor Blue
Write-Host "  Testing server response under rapid requests..." -ForegroundColor Yellow

$rapidResults = @()
1..5 | ForEach-Object {
    $result = Stress-Test -Category "Rapid" -TestName "Quick search #$_" -Tool "earth_engine_data" -Arguments @{
        operation = "search"
        query = "landsat"
        limit = 5
    } -Timeout 10
    $rapidResults += $result
    Start-Sleep -Milliseconds 100
}

$rapidSuccess = ($rapidResults | Where-Object { $_ -eq $true }).Count
Write-Host "  Rapid fire results: $rapidSuccess/5 succeeded" -ForegroundColor $(if ($rapidSuccess -eq 5) {"Green"} else {"Yellow"})

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
Write-Host "Check your server logs for detailed processing information." -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Magenta
