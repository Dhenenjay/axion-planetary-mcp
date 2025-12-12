# Complete Diagnostic Test - Every Single Operation
$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n=========== COMPLETE DIAGNOSTIC TEST ===========" -ForegroundColor Magenta
Write-Host "Testing EVERY operation in ALL 4 tools" -ForegroundColor Yellow
Write-Host ""

$totalTests = 0
$passed = 0
$failed = 0
$failures = @()

function Test-Operation {
    param($Tool, $Op, $Args, $Desc)
    
    $script:totalTests++
    Write-Host "[$totalTests] $Desc" -NoNewline
    
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
            Write-Host " FAIL (no result)" -ForegroundColor Red
            $script:failed++
            $script:failures += "$Desc - No result returned"
            return $false
        }
    } catch {
        Write-Host " FAIL ($($_.Exception.Message.Substring(0, [Math]::Min(40, $_.Exception.Message.Length)))...)" -ForegroundColor Red
        $script:failed++
        $script:failures += "$Desc - $($_.Exception.Message)"
        return $false
    }
}

# ==== EARTH_ENGINE_DATA TOOL ====
Write-Host "TESTING: earth_engine_data" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Gray

$null = Test-Operation "earth_engine_data" "search" @{operation="search"; query="Sentinel-2"; maxResults=3} "Data: Search Sentinel-2"
Test-Operation "earth_engine_data" "search" @{operation="search"; query="Landsat"; maxResults=2} "Data: Search Landsat"
Test-Operation "earth_engine_data" "search" @{operation="search"; query="MODIS"; maxResults=2} "Data: Search MODIS"
Test-Operation "earth_engine_data" "search" @{operation="search"; query="water"; maxResults=2} "Data: Search water datasets"
Test-Operation "earth_engine_data" "search" @{operation="search"; query="cropland"; maxResults=2} "Data: Search cropland"

Test-Operation "earth_engine_data" "info" @{operation="info"; assetId="COPERNICUS/S2_SR"} "Data: Get S2_SR info"
Test-Operation "earth_engine_data" "info" @{operation="info"; assetId="LANDSAT/LC08/C02/T1_L2"} "Data: Get Landsat8 info"

Test-Operation "earth_engine_data" "geometry" @{operation="geometry"; placeName="San Francisco"} "Data: Geometry for San Francisco"
Test-Operation "earth_engine_data" "geometry" @{operation="geometry"; placeName="New York"} "Data: Geometry for New York"
Test-Operation "earth_engine_data" "geometry" @{operation="geometry"; placeName="London"} "Data: Geometry for London"
Test-Operation "earth_engine_data" "geometry" @{operation="geometry"; placeName="Tokyo"} "Data: Geometry for Tokyo"
Test-Operation "earth_engine_data" "geometry" @{operation="geometry"; placeName="Mumbai"} "Data: Geometry for Mumbai"
Test-Operation "earth_engine_data" "geometry" @{operation="geometry"; coordinates=@(-122.4194, 37.7749)} "Data: Geometry from coordinates"

Write-Host ""

# ==== EARTH_ENGINE_SYSTEM TOOL ====
Write-Host "TESTING: earth_engine_system" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Gray

Test-Operation "earth_engine_system" "auth" @{operation="auth"; checkType="status"} "System: Auth status"
Test-Operation "earth_engine_system" "auth" @{operation="auth"; checkType="permissions"} "System: Check permissions"
Test-Operation "earth_engine_system" "auth" @{operation="auth"; checkType="projects"} "System: List projects"

Test-Operation "earth_engine_system" "setup" @{operation="setup"; setupType="auth"} "System: Setup auth"
Test-Operation "earth_engine_system" "setup" @{operation="setup"; setupType="gcs"; bucket="test-bucket"} "System: Setup GCS"

Test-Operation "earth_engine_system" "info" @{operation="info"; infoType="system"} "System: System info"
Test-Operation "earth_engine_system" "info" @{operation="info"; infoType="quotas"} "System: Quota info"
Test-Operation "earth_engine_system" "info" @{operation="info"; infoType="assets"} "System: Assets info"
Test-Operation "earth_engine_system" "info" @{operation="info"; infoType="tasks"} "System: Tasks info"

Write-Host ""

# ==== EARTH_ENGINE_PROCESS TOOL ====
Write-Host "TESTING: earth_engine_process" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Gray

# Index operations - ALL types
$indices = @("NDVI", "NDWI", "NDBI", "EVI", "SAVI", "MNDWI", "BSI", "NDSI")
foreach ($idx in $indices) {
    Test-Operation "earth_engine_process" "index" @{
        operation="index"
        indexType=$idx
        datasetId="COPERNICUS/S2_SR"
        startDate="2024-01-01"
        endDate="2024-01-31"
        geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
    } "Process: Calculate $idx"
}

# Mask operations
Test-Operation "earth_engine_process" "mask" @{
    operation="mask"
    maskType="clouds"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
} "Process: Cloud mask"

Test-Operation "earth_engine_process" "mask" @{
    operation="mask"
    maskType="water"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
} "Process: Water mask"

# Composite operations
$composites = @("median", "mean", "max", "min", "mosaic")
foreach ($comp in $composites) {
    Test-Operation "earth_engine_process" "composite" @{
        operation="composite"
        compositeType=$comp
        datasetId="COPERNICUS/S2_SR"
        startDate="2024-01-01"
        endDate="2024-01-31"
        geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
    } "Process: $comp composite"
}

# Terrain operations
Test-Operation "earth_engine_process" "terrain" @{
    operation="terrain"
    terrainType="elevation"
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
} "Process: Elevation"

Test-Operation "earth_engine_process" "terrain" @{
    operation="terrain"
    terrainType="slope"
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
} "Process: Slope"

Test-Operation "earth_engine_process" "terrain" @{
    operation="terrain"
    terrainType="aspect"
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
} "Process: Aspect"

Test-Operation "earth_engine_process" "terrain" @{
    operation="terrain"
    terrainType="hillshade"
    azimuth=315
    elevation=45
    region=@{type="Point"; coordinates=@(-119.4179, 36.7783)}
} "Process: Hillshade"

# Analysis operations
Test-Operation "earth_engine_process" "analyze" @{
    operation="analyze"
    analysisType="statistics"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
    reducer="mean"
} "Process: Statistics analysis"

Test-Operation "earth_engine_process" "analyze" @{
    operation="analyze"
    analysisType="timeseries"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-06-30"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
    band="B8"
    reducer="mean"
} "Process: Time series"

Test-Operation "earth_engine_process" "analyze" @{
    operation="analyze"
    analysisType="change"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    startDate2="2024-06-01"
    endDate2="2024-06-30"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
} "Process: Change detection"

# Clip operation
Test-Operation "earth_engine_process" "clip" @{
    operation="clip"
    input="COPERNICUS/S2_SR"
    region=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
} "Process: Clip image"

# Resample operation
Test-Operation "earth_engine_process" "resample" @{
    operation="resample"
    input="COPERNICUS/S2_SR"
    targetScale=30
    resampleMethod="bilinear"
} "Process: Resample image"

Write-Host ""

# ==== EARTH_ENGINE_EXPORT TOOL ====
Write-Host "TESTING: earth_engine_export" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Gray

# Thumbnail generation
Test-Operation "earth_engine_export" "thumbnail" @{
    operation="thumbnail"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
    dimensions=256
} "Export: Generate thumbnail 256x256"

Test-Operation "earth_engine_export" "thumbnail" @{
    operation="thumbnail"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
    dimensions=512
} "Export: Generate thumbnail 512x512"

# Tiles generation
Test-Operation "earth_engine_export" "tiles" @{
    operation="tiles"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    geometry=@{type="Point"; coordinates=@(-122.4194, 37.7749)}
} "Export: Generate map tiles"

# Export operations
Test-Operation "earth_engine_export" "export" @{
    operation="export"
    exportType="toGCS"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    bucket="earth-engine-exports"
    filePrefix="test_export"
    region=@{
        type="Polygon"
        coordinates=@(@(
            @(-122.5, 37.7),
            @(-122.4, 37.7),
            @(-122.4, 37.8),
            @(-122.5, 37.8),
            @(-122.5, 37.7)
        ))
    }
    scale=10
    format="GeoTIFF"
} "Export: To Google Cloud Storage"

Test-Operation "earth_engine_export" "export" @{
    operation="export"
    exportType="toDrive"
    datasetId="COPERNICUS/S2_SR"
    startDate="2024-01-01"
    endDate="2024-01-31"
    folder="EarthEngineExports"
    filePrefix="test_export"
    region=@{
        type="Polygon"
        coordinates=@(@(
            @(-122.5, 37.7),
            @(-122.4, 37.7),
            @(-122.4, 37.8),
            @(-122.5, 37.8),
            @(-122.5, 37.7)
        ))
    }
    scale=10
    format="GeoTIFF"
} "Export: To Google Drive"

Test-Operation "earth_engine_export" "export" @{
    operation="export"
    exportType="toAsset"
    imageId="COPERNICUS/S2_SR/20240115T183919_20240115T184201_T10SEG"
    assetId="users/test/exported_image"
    region=@{
        type="Polygon"
        coordinates=@(@(
            @(-122.5, 37.7),
            @(-122.4, 37.7),
            @(-122.4, 37.8),
            @(-122.5, 37.8),
            @(-122.5, 37.7)
        ))
    }
    scale=10
} "Export: To Earth Engine Asset"

# Status check
Test-Operation "earth_engine_export" "status" @{
    operation="status"
    taskId="test-task-id"
} "Export: Check task status"

# Download operation
Test-Operation "earth_engine_export" "download" @{
    operation="download"
    url="https://earthengine.googleapis.com/test"
    format="GeoTIFF"
} "Export: Get download link"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "           DIAGNOSTIC SUMMARY" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed:      $passed" -ForegroundColor Green
Write-Host "Failed:      $failed" -ForegroundColor $(if($failed -gt 0){"Red"}else{"Green"})

$rate = if($totalTests -gt 0) { [math]::Round(($passed / $totalTests) * 100, 1) } else { 0 }
Write-Host "Success Rate: $rate%" -ForegroundColor $(if($rate -eq 100){"Green"}elseif($rate -ge 80){"Yellow"}else{"Red"})

if ($failed -gt 0) {
    Write-Host ""
    Write-Host "FAILED OPERATIONS:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "  - $failure" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Magenta
