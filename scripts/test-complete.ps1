# Complete Test Suite for Earth Engine MCP
$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n===== COMPLETE MCP TEST SUITE =====" -ForegroundColor Magenta
Write-Host ""

$pass = 0
$fail = 0

function Test {
    param($Name, $Tool, $Params)
    
    Write-Host "$Name..." -NoNewline
    
    # Use the params directly
    $arguments = $Params
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $Tool
            arguments = $arguments
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $r = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -TimeoutSec 10 -ErrorAction Stop
        if ($r.result) {
            Write-Host " PASS" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

# DATA TOOL TESTS
Write-Host "earth_engine_data:" -ForegroundColor Cyan
Test "  Search Sentinel" "earth_engine_data" @{operation="search"; query="Sentinel"; maxResults=2}
Test "  Search Landsat" "earth_engine_data" @{operation="search"; query="Landsat"; maxResults=2}
Test "  Get dataset info" "earth_engine_data" @{operation="info"; assetId="COPERNICUS/S2_SR"}
Test "  Get SF geometry" "earth_engine_data" @{operation="geometry"; placeName="San Francisco"}
Test "  Get NY geometry" "earth_engine_data" @{operation="geometry"; placeName="New York"}
Test "  Coord geometry" "earth_engine_data" @{operation="geometry"; coordinates=@(-122.4, 37.7)}

# SYSTEM TOOL TESTS
Write-Host "`nearth_engine_system:" -ForegroundColor Cyan
Test "  Auth status" "earth_engine_system" @{operation="auth"; checkType="status"}
Test "  Permissions" "earth_engine_system" @{operation="auth"; checkType="permissions"}
Test "  System info" "earth_engine_system" @{operation="info"; infoType="system"}

# PROCESS TOOL TESTS
Write-Host "`nearth_engine_process:" -ForegroundColor Cyan
Test "  NDVI index" "earth_engine_process" @{
    operation="index"; indexType="NDVI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
}
Test "  NDWI index" "earth_engine_process" @{
    operation="index"; indexType="NDWI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
}
Test "  EVI index" "earth_engine_process" @{
    operation="index"; indexType="EVI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
}
Test "  Cloud mask" "earth_engine_process" @{
    operation="mask"; maskType="clouds"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
}
Test "  Median composite" "earth_engine_process" @{
    operation="composite"; compositeType="median"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
}
Test "  Elevation" "earth_engine_process" @{
    operation="terrain"; terrainType="elevation"
    region=@{type="Point"; coordinates=@(-119.4, 36.7)}
}
Test "  Slope" "earth_engine_process" @{
    operation="terrain"; terrainType="slope"
    region=@{type="Point"; coordinates=@(-119.4, 36.7)}
}
Test "  Time series" "earth_engine_process" @{
    operation="analyze"; analysisType="timeseries"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-06-30"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
    band="B8"; reducer="mean"
}

# EXPORT TOOL TESTS
Write-Host "`nearth_engine_export:" -ForegroundColor Cyan
Test "  Thumbnail" "earth_engine_export" @{
    operation="thumbnail"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
    dimensions=256
}
Test "  Map tiles" "earth_engine_export" @{
    operation="tiles"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4, 37.7)}
}
Test "  Export GCS" "earth_engine_export" @{
    operation="export"; exportType="toGCS"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    bucket="ee-exports"; filePrefix="test"
    region=@{type="Polygon"; coordinates=@(@(
        @(-122.5, 37.7), @(-122.4, 37.7), @(-122.4, 37.8), @(-122.5, 37.8), @(-122.5, 37.7)
    ))}
    scale=10; format="GeoTIFF"
}

# SUMMARY
Write-Host ""
Write-Host "====================================" -ForegroundColor Magenta
$total = $pass + $fail
$rate = if($total -gt 0) { [math]::Round(($pass/$total)*100, 1) } else { 0 }

Write-Host "Total: $total | Passed: $pass | Failed: $fail" -ForegroundColor White
Write-Host "Success Rate: $rate%" -ForegroundColor $(if($rate -eq 100){"Green"}elseif($rate -ge 80){"Yellow"}else{"Red"})

if ($rate -eq 100) {
    Write-Host "`nPERFECT! All tests passed!" -ForegroundColor Green
} elseif ($rate -ge 80) {
    Write-Host "`nGood, but some failures need fixing." -ForegroundColor Yellow  
} else {
    Write-Host "`nMany failures. Needs immediate attention!" -ForegroundColor Red
}
Write-Host "====================================" -ForegroundColor Magenta
