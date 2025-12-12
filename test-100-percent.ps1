# Test ALL operations - Must be 100% working

$baseUrl = "http://localhost:3000/stdio"
$passed = 0
$failed = 0
$results = @()

function Test-Op {
    param($tool, $arguments, $desc)
    
    Write-Host "`nTest: $desc" -NoNewline
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $tool
            arguments = $arguments
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $r = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 120
        
        if ($r.result -and (-not $r.result.error) -and ($r.result.success -ne $false)) {
            Write-Host " [PASS]" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            if ($r.result.error) {
                Write-Host "  Error: $($r.result.error)" -ForegroundColor Yellow
            }
            $script:failed++
            $script:results += @{Test=$desc; Error=$r.result.error}
            return $false
        }
    } catch {
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Host "  Exception: $_" -ForegroundColor Yellow
        $script:failed++
        $script:results += @{Test=$desc; Error=$_.ToString()}
        return $false
    }
}

Write-Host "`n=== TESTING ALL OPERATIONS FOR 100% SUCCESS ===" -ForegroundColor Cyan

# DATA TOOL
Write-Host "`n-- Data Tool Tests --" -ForegroundColor Yellow
Test-Op "earth_engine_data" @{operation="search"; query="sentinel"; limit=5} "Search Sentinel"
Test-Op "earth_engine_data" @{operation="search"; query="landsat"; limit=3} "Search Landsat"
Test-Op "earth_engine_data" @{operation="info"; datasetId="COPERNICUS/S2_SR_HARMONIZED"} "Info Sentinel-2"
Test-Op "earth_engine_data" @{operation="info"; datasetId="LANDSAT/LC08/C02/T1_L2"} "Info Landsat 8"
Test-Op "earth_engine_data" @{operation="info"; datasetId="USGS/SRTMGL1_003"} "Info SRTM"
Test-Op "earth_engine_data" @{operation="filter"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"; cloudCoverMax=20} "Filter with cloud"
Test-Op "earth_engine_data" @{operation="geometry"; placeName="San Francisco"} "Geometry SF"
Test-Op "earth_engine_data" @{operation="geometry"; placeName="Ludhiana"} "Geometry Ludhiana"
Test-Op "earth_engine_data" @{operation="geometry"; coordinates=@(-122.4194, 37.7749, 10000)} "Geometry coords"
Test-Op "earth_engine_data" @{operation="boundaries"} "List boundaries"

# PROCESS TOOL
Write-Host "`n-- Process Tool Tests --" -ForegroundColor Yellow
Test-Op "earth_engine_process" @{operation="index"; indexType="NDVI"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "Calculate NDVI"
Test-Op "earth_engine_process" @{operation="index"; indexType="NDWI"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "Calculate NDWI"
Test-Op "earth_engine_process" @{operation="index"; indexType="EVI"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "Calculate EVI"
Test-Op "earth_engine_process" @{operation="mask"; maskType="clouds"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "Cloud mask"
Test-Op "earth_engine_process" @{operation="composite"; compositeType="median"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "Median composite"
Test-Op "earth_engine_process" @{operation="composite"; compositeType="mean"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "Mean composite"
Test-Op "earth_engine_process" @{operation="analyze"; analysisType="statistics"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"; region=@{type="Point"; coordinates=@(-122.4194, 37.7749)}; reducer="mean"} "Statistics"
Test-Op "earth_engine_process" @{operation="analyze"; analysisType="timeseries"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-01-01"; endDate="2024-03-31"; geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}; reducer="mean"} "Time series"
Test-Op "earth_engine_process" @{operation="terrain"; terrainType="elevation"} "Elevation"
Test-Op "earth_engine_process" @{operation="terrain"; terrainType="slope"} "Slope"
Test-Op "earth_engine_process" @{operation="terrain"; terrainType="aspect"} "Aspect"
Test-Op "earth_engine_process" @{operation="clip"; input="COPERNICUS/S2_SR_HARMONIZED"; region=@{type="Point"; coordinates=@(-122.4194, 37.7749)}} "Clip image"

# EXPORT TOOL
Write-Host "`n-- Export Tool Tests --" -ForegroundColor Yellow
Test-Op "earth_engine_export" @{operation="thumbnail"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"; dimensions=512} "Thumbnail 512px"
Test-Op "earth_engine_export" @{operation="thumbnail"; datasetId="LANDSAT/LC08/C02/T1_L2"; startDate="2024-06-01"; endDate="2024-06-30"; dimensions=256} "Landsat thumb"
Test-Op "earth_engine_export" @{operation="tiles"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"; zoomLevel=10} "Map tiles"
Test-Op "earth_engine_export" @{operation="export"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-15"; destination="drive"; fileNamePrefix="test_drive"; scale=30; geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}} "Export Drive"
Test-Op "earth_engine_export" @{operation="export"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-15"; destination="gcs"; fileNamePrefix="test_gcs"; scale=30; geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}} "Export GCS"
Test-Op "earth_engine_export" @{operation="status"; taskId="dummy_task"} "Task status"

# SYSTEM TOOL
Write-Host "`n-- System Tool Tests --" -ForegroundColor Yellow
Test-Op "earth_engine_system" @{operation="auth"; checkType="status"} "Auth status"
Test-Op "earth_engine_system" @{operation="auth"; checkType="permissions"} "Permissions"
Test-Op "earth_engine_system" @{operation="info"; infoType="system"} "System info"
Test-Op "earth_engine_system" @{operation="info"; infoType="quotas"} "Quotas"
Test-Op "earth_engine_system" @{operation="info"; infoType="tasks"} "Tasks info"
Test-Op "earth_engine_system" @{operation="execute"; code="return ee.Number(42).multiply(2).getInfo();"; language="javascript"} "Execute code"
Test-Op "earth_engine_system" @{operation="execute"; code="var c = new ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED'); return c.size().getInfo();"; language="javascript"} "Execute query"
Test-Op "earth_engine_system" @{operation="setup"; setupType="auth"} "Setup auth"

# RESULTS
$total = $passed + $failed
$rate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "`n=== FINAL RESULTS ===" -ForegroundColor Cyan
Write-Host "Total: $total | Passed: $passed | Failed: $failed"
Write-Host "Success Rate: $rate%" -ForegroundColor $(if ($rate -eq 100) {"Green"} else {"Red"})

if ($failed -gt 0) {
    Write-Host "`nFAILED TESTS:" -ForegroundColor Red
    $results | ForEach-Object {
        Write-Host "- $($_.Test): $($_.Error)" -ForegroundColor Yellow
    }
    Write-Host "`nSTATUS: NOT READY - Fix all $failed errors!" -ForegroundColor Red
} else {
    Write-Host "`nSTATUS: PERFECT - 100% WORKING!" -ForegroundColor Green
}
