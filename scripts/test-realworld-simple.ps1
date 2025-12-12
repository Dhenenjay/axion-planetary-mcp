# Simplified Real-World Test Suite for Earth Engine MCP
$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host ""
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host " REAL WORLD EARTH ENGINE TEST SUITE" -ForegroundColor Magenta
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host ""

$passed = 0
$failed = 0

function Test-Scenario {
    param($Name, $Tool, $Args)
    
    Write-Host "$Name" -ForegroundColor Cyan -NoNewline
    
    $body = @{
        method = "tools/call"
        params = @{
            name = $Tool
            arguments = $Args
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30 -ErrorAction Stop
        if ($response.result) {
            Write-Host " PASS" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        Write-Host " ERROR: $($_.Exception.Message.Substring(0, [Math]::Min(50, $_.Exception.Message.Length)))" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

# AGRICULTURE TESTS
Write-Host "AGRICULTURE MONITORING" -ForegroundColor Yellow
Test-Scenario "1. Search crop datasets" "earth_engine_data" @{operation="search"; query="cropland"; maxResults=3}
Test-Scenario "2. Get Punjab geometry" "earth_engine_data" @{operation="geometry"; placeName="Punjab, India"}
Test-Scenario "3. Calculate crop NDVI" "earth_engine_process" @{
    operation="index"; indexType="NDVI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-06-01"; endDate="2024-06-30"
    geometry=@{type="Point"; coordinates=@(75.8573, 30.9010)}
}
Test-Scenario "4. Crop health thumbnail" "earth_engine_export" @{
    operation="thumbnail"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-06-01"; endDate="2024-06-30"
    geometry=@{type="Point"; coordinates=@(75.8573, 30.9010)}
    dimensions="256x256"
}

Write-Host ""
Write-Host "URBAN PLANNING" -ForegroundColor Yellow
Test-Scenario "5. Get city boundary" "earth_engine_data" @{operation="geometry"; placeName="San Francisco"}
Test-Scenario "6. Urban density NDBI" "earth_engine_process" @{
    operation="index"; indexType="NDBI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
}
Test-Scenario "7. Urban composite" "earth_engine_process" @{
    operation="composite"; compositeType="median"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-03-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
}

Write-Host ""
Write-Host "WATER RESOURCES" -ForegroundColor Yellow
Test-Scenario "8. Search water data" "earth_engine_data" @{operation="search"; query="water"; maxResults=3}
Test-Scenario "9. Water index NDWI" "earth_engine_process" @{
    operation="index"; indexType="NDWI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-121.8863, 37.3382)}
}
Test-Scenario "10. Enhanced water MNDWI" "earth_engine_process" @{
    operation="index"; indexType="MNDWI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-121.8863, 37.3382)}
}

Write-Host ""
Write-Host "CLIMATE MONITORING" -ForegroundColor Yellow
Test-Scenario "11. Search Landsat" "earth_engine_data" @{operation="search"; query="Landsat"; maxResults=3}
Test-Scenario "12. Vegetation EVI" "earth_engine_process" @{
    operation="index"; indexType="EVI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.0322, 37.3230)}
}
Test-Scenario "13. Time series analysis" "earth_engine_process" @{
    operation="analyze"; analysisType="timeseries"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-06-30"
    geometry=@{type="Point"; coordinates=@(-122.0322, 37.3230)}
    band="B8"; reducer="mean"
}

Write-Host ""
Write-Host "DISASTER RESPONSE" -ForegroundColor Yellow
Test-Scenario "14. Fire datasets" "earth_engine_data" @{operation="search"; query="MODIS fire"; maxResults=2}
Test-Scenario "15. Burn severity BSI" "earth_engine_process" @{
    operation="index"; indexType="BSI"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-120.0885, 38.8375)}
}
Test-Scenario "16. Cloud masking" "earth_engine_process" @{
    operation="mask"; maskType="clouds"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-120.0885, 38.8375)}
}

Write-Host ""
Write-Host "TERRAIN ANALYSIS" -ForegroundColor Yellow
Test-Scenario "17. Elevation map" "earth_engine_process" @{
    operation="terrain"; terrainType="elevation"
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
}
Test-Scenario "18. Slope calculation" "earth_engine_process" @{
    operation="terrain"; terrainType="slope"
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
}
Test-Scenario "19. Hillshade" "earth_engine_process" @{
    operation="terrain"; terrainType="hillshade"; azimuth=315; elevation=35
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
}

Write-Host ""
Write-Host "EXPORT WORKFLOWS" -ForegroundColor Yellow
Test-Scenario "20. Generate tiles" "earth_engine_export" @{
    operation="tiles"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
}
Test-Scenario "21. Export to GCS" "earth_engine_export" @{
    operation="export"; exportType="toGCS"; datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"; endDate="2024-01-31"
    bucket="earth-engine-exports"; filePrefix="test_export"
    region=@{type="Polygon"; coordinates=@(@(
        @(-122.5, 37.7), @(-122.4, 37.7), @(-122.4, 37.8), @(-122.5, 37.8), @(-122.5, 37.7)
    ))}
    scale=10; format="GeoTIFF"
}

Write-Host ""
Write-Host "SYSTEM CHECKS" -ForegroundColor Yellow
Test-Scenario "22. Auth status" "earth_engine_system" @{operation="auth"; checkType="status"}
Test-Scenario "23. Permissions" "earth_engine_system" @{operation="auth"; checkType="permissions"}
Test-Scenario "24. System info" "earth_engine_system" @{operation="info"; infoType="system"}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host "         TEST RESULTS SUMMARY" -ForegroundColor Magenta
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host ""

$total = $passed + $failed
$rate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "Passed:      $passed" -ForegroundColor Green
Write-Host "Failed:      $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Success Rate: $rate%" -ForegroundColor $(if ($rate -ge 90) { "Green" } elseif ($rate -ge 70) { "Yellow" } else { "Red" })

Write-Host ""
if ($rate -eq 100) {
    Write-Host "PERFECT! All tests passed!" -ForegroundColor Green
    Write-Host "The MCP server is production ready." -ForegroundColor Green
} elseif ($rate -ge 90) {
    Write-Host "EXCELLENT! Nearly all tests passed." -ForegroundColor Green
} elseif ($rate -ge 70) {
    Write-Host "GOOD! Most tests passed." -ForegroundColor Yellow
} else {
    Write-Host "NEEDS IMPROVEMENT. Review failed tests." -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Magenta
