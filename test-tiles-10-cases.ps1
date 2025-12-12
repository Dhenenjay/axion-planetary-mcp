# Comprehensive Tile Service Test - 10 Test Cases
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "TILE SERVICE COMPREHENSIVE TEST - 10 CASES" -ForegroundColor Magenta
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

function Test-Tiles {
    param(
        [hashtable]$Arguments,
        [string]$TestName,
        [int]$TestNumber,
        [int]$Timeout = 60
    )
    
    Write-Host "[$TestNumber/10] $TestName" -NoNewline
    
    $body = @{
        tool = "earth_engine_export"
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
            Write-Host " [FAIL]" -ForegroundColor Red
            Write-Host "     Error: $($response.error)" -ForegroundColor DarkRed
            if ($response.troubleshooting) {
                Write-Host "     Tips: $($response.troubleshooting.tips[0])" -ForegroundColor Yellow
            }
            return $false
        }
        
        Write-Host " [PASS] ${elapsed}ms" -ForegroundColor Green
        if ($response.mapId) {
            Write-Host "     Map ID: $($response.mapId)" -ForegroundColor DarkGray
        }
        if ($response.tileUrl) {
            $shortUrl = $response.tileUrl.Substring(0, [Math]::Min(80, $response.tileUrl.Length))
            Write-Host "     Tile URL: $shortUrl..." -ForegroundColor DarkGray
        }
        return $true
    }
    catch {
        Write-Host " [FAIL]" -ForegroundColor Red
        Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor DarkRed
        return $false
    }
}

$results = @()
Write-Host "Starting tile service tests..." -ForegroundColor White
Write-Host ""

# Test 1: Simple mode with Sentinel-2
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "San Francisco"
    simpleMode = $true
    startDate = "2024-01-01"
    endDate = "2024-01-15"
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 0.3
    }
} -TestName "Sentinel-2 Simple Mode" -TestNumber 1

Start-Sleep -Milliseconds 500

# Test 2: Create composite first, then tiles
Write-Host "[2/10] Composite-based tiles" -NoNewline
$compositeBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-10"
        region = "Los Angeles"
        compositeType = "median"
    }
} | ConvertTo-Json -Depth 10

try {
    $compositeResponse = Invoke-RestMethod -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $compositeBody `
        -ContentType "application/json" `
        -TimeoutSec 30 -ErrorAction SilentlyContinue
    
    if ($compositeResponse.compositeKey) {
        $tilesResult = Test-Tiles -Arguments @{
            operation = "tiles"
            compositeKey = $compositeResponse.compositeKey
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 0.3
            }
        } -TestName "(using compositeKey)" -TestNumber 2
        $results += $tilesResult
    } else {
        Write-Host " [SKIP]" -ForegroundColor Yellow
        $results += $false
    }
} catch {
    Write-Host " [SKIP]" -ForegroundColor Yellow
    $results += $false
}

Start-Sleep -Milliseconds 500

# Test 3: NDVI tiles
Write-Host "[3/10] NDVI index tiles" -NoNewline
$ndviBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-10"
        region = "Miami"
    }
} | ConvertTo-Json -Depth 10

try {
    $ndviResponse = Invoke-RestMethod -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $ndviBody `
        -ContentType "application/json" `
        -TimeoutSec 30 -ErrorAction SilentlyContinue
    
    if ($ndviResponse.indexKey -or $ndviResponse.ndviKey) {
        $key = if ($ndviResponse.indexKey) { $ndviResponse.indexKey } else { $ndviResponse.ndviKey }
        $tilesResult = Test-Tiles -Arguments @{
            operation = "tiles"
            ndviKey = $key
            visParams = @{
                bands = @("NDVI")
                min = -1
                max = 1
                palette = @("blue", "white", "green")
            }
        } -TestName "(using NDVI key)" -TestNumber 3
        $results += $tilesResult
    } else {
        Write-Host " [SKIP]" -ForegroundColor Yellow
        $results += $false
    }
} catch {
    Write-Host " [SKIP]" -ForegroundColor Yellow
    $results += $false
}

Start-Sleep -Milliseconds 500

# Test 4: Landsat tiles
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "LANDSAT/LC08/C02/T1_L2"
    region = "Denver"
    simpleMode = $true
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    visParams = @{
        bands = @("SR_B4", "SR_B3", "SR_B2")
        min = 0
        max = 3000
    }
} -TestName "Landsat-8 RGB" -TestNumber 4 -Timeout 90

Start-Sleep -Milliseconds 500

# Test 5: Small region fast tiles
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "Manhattan"
    simpleMode = $true
    startDate = "2024-10-01"
    endDate = "2024-10-07"
} -TestName "Small region (Manhattan)" -TestNumber 5

Start-Sleep -Milliseconds 500

# Test 6: FCC tiles
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "Seattle"
    simpleMode = $true
    startDate = "2024-09-01"
    endDate = "2024-09-15"
    visParams = @{
        bands = @("B8", "B4", "B3")  # NIR-Red-Green FCC
        min = 0
        max = 0.3
    }
} -TestName "False Color Composite" -TestNumber 6

Start-Sleep -Milliseconds 500

# Test 7: MODIS tiles
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "MODIS/006/MOD13Q1"
    region = "Texas"
    simpleMode = $true
    startDate = "2024-01-01"
    endDate = "2024-01-31"
} -TestName "MODIS Vegetation" -TestNumber 7 -Timeout 90

Start-Sleep -Milliseconds 500

# Test 8: Custom visualization
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "Phoenix"
    simpleMode = $true
    startDate = "2024-11-01"
    endDate = "2024-11-15"
    visParams = @{
        bands = @("B11", "B8", "B2")  # SWIR-NIR-Blue
        min = 0
        max = 0.4
        gamma = 1.2
    }
} -TestName "Custom band combination" -TestNumber 8

Start-Sleep -Milliseconds 500

# Test 9: Recent data tiles
$endDate = (Get-Date).ToString("yyyy-MM-dd")
$startDate = (Get-Date).AddDays(-15).ToString("yyyy-MM-dd")

$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "Boston"
    simpleMode = $true
    startDate = $startDate
    endDate = $endDate
} -TestName "Recent imagery (last 15 days)" -TestNumber 9

Start-Sleep -Milliseconds 500

# Test 10: No region (global)
$results += Test-Tiles -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    simpleMode = $true
    startDate = "2024-01-01"
    endDate = "2024-01-07"
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 0.3
    }
} -TestName "Global view (no region)" -TestNumber 10 -Timeout 90

# Summary
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "TILE SERVICE TEST SUMMARY" -ForegroundColor White
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$total = $results.Count
$passed = ($results | Where-Object { $_ -eq $true }).Count
$failed = ($results | Where-Object { $_ -eq $false }).Count
$successRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

# Detailed results
Write-Host "Test Results:" -ForegroundColor Yellow
$testNames = @(
    "1. Sentinel-2 Simple Mode",
    "2. Composite-based tiles",
    "3. NDVI index tiles",
    "4. Landsat-8 RGB",
    "5. Small region (Manhattan)",
    "6. False Color Composite",
    "7. MODIS Vegetation",
    "8. Custom band combination",
    "9. Recent imagery",
    "10. Global view"
)

for ($i = 0; $i -lt $results.Count; $i++) {
    $status = if ($results[$i]) { "[PASS]" } else { "[FAIL]" }
    $color = if ($results[$i]) { "Green" } else { "Red" }
    Write-Host "  $status $($testNames[$i])" -ForegroundColor $color
}

Write-Host ""
Write-Host "Statistics:" -ForegroundColor Yellow
Write-Host "  Total Tests: $total" -ForegroundColor White
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor Red
Write-Host "  Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) {"Green"} elseif ($successRate -ge 60) {"Yellow"} else {"Red"})

Write-Host ""
if ($successRate -eq 100) {
    Write-Host "PERFECT! Tile service is fully functional!" -ForegroundColor Green
    Write-Host "All 10 test cases passed successfully." -ForegroundColor Green
} elseif ($successRate -ge 80) {
    Write-Host "EXCELLENT! Tile service is working well." -ForegroundColor Green
    Write-Host "Most test cases passed. Minor issues may exist." -ForegroundColor Yellow
} elseif ($successRate -ge 60) {
    Write-Host "GOOD: Tile service is mostly functional." -ForegroundColor Yellow
    Write-Host "Some optimizations needed for full reliability." -ForegroundColor Yellow
} else {
    Write-Host "NEEDS WORK: Tile service has issues." -ForegroundColor Red
    Write-Host "Check server logs for timeout or processing errors." -ForegroundColor Red
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Tile URLs can be used in web mapping apps:" -ForegroundColor Cyan
Write-Host "- Leaflet, Mapbox GL, OpenLayers, etc." -ForegroundColor DarkGray
Write-Host "===========================================" -ForegroundColor Cyan
