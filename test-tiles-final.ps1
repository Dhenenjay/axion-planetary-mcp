# Final Tile Service Test - Using Composite Keys
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "TILE SERVICE FINAL TEST" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host "Strategy: Create composites first, then generate tiles" -ForegroundColor Yellow
Write-Host ""

$results = @()

# Test 1: Create a composite, then generate tiles
Write-Host "[1/5] Creating Sentinel-2 composite..." -NoNewline

$compositeBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-15"
        region = "San Francisco"
        compositeType = "median"
        cloudCoverMax = 30
    }
} | ConvertTo-Json -Depth 10

try {
    $compositeResult = Invoke-RestMethod -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $compositeBody `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    if ($compositeResult.compositeKey) {
        Write-Host " [PASS]" -ForegroundColor Green
        Write-Host "  Composite Key: $($compositeResult.compositeKey)" -ForegroundColor DarkGray
        
        # Now generate tiles from this composite
        Write-Host "  Generating tiles from composite..." -NoNewline
        
        $tilesBody = @{
            tool = "earth_engine_export"
            arguments = @{
                operation = "tiles"
                compositeKey = $compositeResult.compositeKey
                visParams = @{
                    bands = @("B4", "B3", "B2")
                    min = 0
                    max = 0.3
                }
            }
        } | ConvertTo-Json -Depth 10
        
        $tilesResult = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $tilesBody `
            -ContentType "application/json" `
            -TimeoutSec 60
        
        if ($tilesResult.success -or $tilesResult.tileUrl) {
            Write-Host " [PASS]" -ForegroundColor Green
            if ($tilesResult.mapId) {
                Write-Host "  Map ID: $($tilesResult.mapId)" -ForegroundColor DarkGray
            }
            if ($tilesResult.tileUrl) {
                $shortUrl = $tilesResult.tileUrl.Substring(0, [Math]::Min(80, $tilesResult.tileUrl.Length))
                Write-Host "  Tile URL: $shortUrl..." -ForegroundColor DarkGray
            }
            $results += $true
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            Write-Host "  Error: $($tilesResult.error)" -ForegroundColor DarkRed
            $results += $false
        }
    } else {
        Write-Host " [FAIL]" -ForegroundColor Red
        Write-Host "  Could not create composite" -ForegroundColor DarkRed
        $results += $false
    }
} catch {
    Write-Host " [FAIL]" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    $results += $false
}

Start-Sleep -Seconds 1

# Test 2: Create NDVI, then generate tiles
Write-Host "[2/5] Creating NDVI index..." -NoNewline

$ndviBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-12-01"
        endDate = "2024-12-10"
        region = "Los Angeles"
    }
} | ConvertTo-Json -Depth 10

try {
    $ndviResult = Invoke-RestMethod -Uri $SSE_ENDPOINT `
        -Method POST `
        -Body $ndviBody `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    $ndviKey = if ($ndviResult.indexKey) { $ndviResult.indexKey } else { $ndviResult.ndviKey }
    
    if ($ndviKey) {
        Write-Host " [PASS]" -ForegroundColor Green
        Write-Host "  NDVI Key: $ndviKey" -ForegroundColor DarkGray
        
        # Generate tiles from NDVI
        Write-Host "  Generating NDVI tiles..." -NoNewline
        
        $ndviTilesBody = @{
            tool = "earth_engine_export"
            arguments = @{
                operation = "tiles"
                ndviKey = $ndviKey
                visParams = @{
                    bands = @("NDVI")
                    min = -1
                    max = 1
                    palette = @("blue", "white", "green")
                }
            }
        } | ConvertTo-Json -Depth 10
        
        $ndviTilesResult = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $ndviTilesBody `
            -ContentType "application/json" `
            -TimeoutSec 60
        
        if ($ndviTilesResult.success -or $ndviTilesResult.tileUrl) {
            Write-Host " [PASS]" -ForegroundColor Green
            $results += $true
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            $results += $false
        }
    } else {
        Write-Host " [FAIL]" -ForegroundColor Red
        $results += $false
    }
} catch {
    Write-Host " [FAIL]" -ForegroundColor Red
    $results += $false
}

Start-Sleep -Seconds 1

# Test 3-5: Direct tile generation with simple parameters
$directTests = @(
    @{
        Name = "Simple Sentinel-2 tiles"
        Dataset = "COPERNICUS/S2_SR_HARMONIZED"
        Region = "Miami"
        StartDate = "2024-01-01"
        EndDate = "2024-01-07"
    },
    @{
        Name = "Simple Landsat tiles"
        Dataset = "LANDSAT/LC08/C02/T1_L2"
        Region = "Denver"
        StartDate = "2024-06-01"
        EndDate = "2024-06-07"
    },
    @{
        Name = "MODIS tiles"
        Dataset = "MODIS/006/MOD13Q1"
        Region = "Texas"
        StartDate = "2024-01-01"
        EndDate = "2024-01-16"
    }
)

$testNum = 3
foreach ($test in $directTests) {
    Write-Host "[$testNum/5] $($test.Name)..." -NoNewline
    
    $body = @{
        tool = "earth_engine_export"
        arguments = @{
            operation = "tiles"
            datasetId = $test.Dataset
            region = $test.Region
            startDate = $test.StartDate
            endDate = $test.EndDate
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $result = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 45
        
        if ($result.success -eq $false -and $result.message -like "*taking longer*") {
            Write-Host " [TIMEOUT]" -ForegroundColor Yellow
            Write-Host "  Note: $($result.message)" -ForegroundColor DarkYellow
            $results += $false
        } elseif ($result.tileUrl -or $result.mapId) {
            Write-Host " [PASS]" -ForegroundColor Green
            $results += $true
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            $results += $false
        }
    } catch {
        Write-Host " [FAIL]" -ForegroundColor Red
        $results += $false
    }
    
    $testNum++
    Start-Sleep -Milliseconds 500
}

# Summary
Write-Host ""
Write-Host "=======================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor White
Write-Host "=======================" -ForegroundColor Cyan

$total = $results.Count
$passed = ($results | Where-Object { $_ -eq $true }).Count
$failed = ($results | Where-Object { $_ -eq $false }).Count
$successRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 60) {"Green"} else {"Red"})

Write-Host ""
if ($successRate -ge 80) {
    Write-Host "TILE SERVICE IS FUNCTIONAL!" -ForegroundColor Green
    Write-Host "Recommendation: Use composite/index keys for best results." -ForegroundColor Yellow
} elseif ($successRate -ge 60) {
    Write-Host "TILE SERVICE PARTIALLY WORKING" -ForegroundColor Yellow
    Write-Host "Some operations may timeout. Use composite approach for reliability." -ForegroundColor Yellow
} else {
    Write-Host "TILE SERVICE NEEDS OPTIMIZATION" -ForegroundColor Red
    Write-Host "Consider using thumbnails for static images instead." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "TIP: Tiles work best with pre-computed composites or indices." -ForegroundColor Cyan
Write-Host "     Create a composite first, then use its key for tiles." -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
