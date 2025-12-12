# EXPERT GEOSPATIAL ANALYST TEST SUITE
# =====================================
# Complete end-to-end testing of Earth Engine MCP Server
# Testing as a professional geospatial analyst would

$global:TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Details = @()
}

function Test-Tool {
    param(
        [string]$TestName,
        [string]$ToolName,
        [hashtable]$Arguments,
        [scriptblock]$Validation = $null
    )
    
    $global:TestResults.Total++
    Write-Host "`n📊 Testing: $TestName" -ForegroundColor Cyan
    Write-Host "   Tool: $ToolName" -ForegroundColor Gray
    
    $body = @{
        method = 'tools/call'
        params = @{
            name = $ToolName
            arguments = $Arguments
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $result = Invoke-RestMethod -Uri 'http://localhost:3000/transport' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 60
        
        if ($result.error) {
            Write-Host "   ❌ FAILED: $($result.error.message)" -ForegroundColor Red
            $global:TestResults.Failed++
            $global:TestResults.Details += @{
                Test = $TestName
                Status = 'Failed'
                Error = $result.error.message
            }
            return $null
        }
        
        # Check for success flag
        if ($result.result.success -eq $false -and $result.result.error) {
            Write-Host "   ❌ FAILED: $($result.result.error)" -ForegroundColor Red
            $global:TestResults.Failed++
            $global:TestResults.Details += @{
                Test = $TestName
                Status = 'Failed'
                Error = $result.result.error
            }
            return $null
        }
        
        # Custom validation if provided
        if ($Validation) {
            $isValid = & $Validation $result.result
            if (-not $isValid) {
                Write-Host "   ❌ VALIDATION FAILED" -ForegroundColor Red
                $global:TestResults.Failed++
                $global:TestResults.Details += @{
                    Test = $TestName
                    Status = 'ValidationFailed'
                }
                return $null
            }
        }
        
        Write-Host "   ✅ PASSED" -ForegroundColor Green
        $global:TestResults.Passed++
        $global:TestResults.Details += @{
            Test = $TestName
            Status = 'Passed'
            Result = $result.result
        }
        
        # Show key results
        if ($result.result.url) {
            Write-Host "   📍 URL: $($result.result.url)" -ForegroundColor Yellow
        }
        if ($result.result.mapId) {
            Write-Host "   🗺️ Map ID: $($result.result.mapId)" -ForegroundColor Yellow
        }
        if ($result.result.compositeKey) {
            Write-Host "   🔑 Key: $($result.result.compositeKey)" -ForegroundColor Yellow
        }
        if ($result.result.taskId) {
            Write-Host "   📋 Task: $($result.result.taskId)" -ForegroundColor Yellow
        }
        
        return $result.result
        
    } catch {
        Write-Host "   ❌ ERROR: $_" -ForegroundColor Red
        $global:TestResults.Failed++
        $global:TestResults.Details += @{
            Test = $TestName
            Status = 'Error'
            Error = $_.ToString()
        }
        return $null
    }
}

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "EXPERT GEOSPATIAL ANALYST TEST SUITE" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# =====================================
# PHASE 1: DATA DISCOVERY & ACCESS
# =====================================
Write-Host "`n🔍 PHASE 1: DATA DISCOVERY & ACCESS" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow

# Test 1.1: Search for climate datasets
Test-Tool -TestName "Search Climate Datasets" -ToolName "earth_engine_data" -Arguments @{
    operation = 'search'
    query = 'climate'
    limit = 5
} -Validation {
    param($result)
    $result.success -and $result.datasets -and $result.datasets.Count -gt 0
}

# Test 1.2: Search for Sentinel-2 imagery
Test-Tool -TestName "Search Sentinel-2 Datasets" -ToolName "earth_engine_data" -Arguments @{
    operation = 'search'
    query = 'sentinel'
    limit = 3
}

# Test 1.3: Get dataset information
Test-Tool -TestName "Get Landsat 8 Dataset Info" -ToolName "earth_engine_data" -Arguments @{
    operation = 'info'
    datasetId = 'LANDSAT/LC08/C02/T1_L2'
}

# Test 1.4: Get geometry for different regions
$regions = @('California', 'Texas', 'Iowa', 'Colorado', 'Florida')
foreach ($region in $regions) {
    Test-Tool -TestName "Get Geometry for $region" -ToolName "earth_engine_data" -Arguments @{
        operation = 'geometry'
        placeName = $region
    }
}

# Test 1.5: Filter collections with different parameters
Test-Tool -TestName "Filter Sentinel-2 Summer 2024 California" -ToolName "earth_engine_data" -Arguments @{
    operation = 'filter'
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
    startDate = '2024-06-01'
    endDate = '2024-08-31'
    region = 'California'
    cloudCoverMax = 20
}

# =====================================
# PHASE 2: IMAGE PROCESSING & ANALYSIS
# =====================================
Write-Host "`n⚙️ PHASE 2: IMAGE PROCESSING & ANALYSIS" -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Yellow

# Test 2.1: Calculate various vegetation indices
$indices = @('NDVI', 'NDWI', 'EVI', 'SAVI', 'NBR', 'NDBI')
foreach ($index in $indices) {
    Test-Tool -TestName "Calculate $index for Iowa Croplands" -ToolName "earth_engine_process" -Arguments @{
        operation = 'index'
        indexType = $index
        datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
        startDate = '2024-07-01'
        endDate = '2024-07-31'
        region = 'Iowa'
        scale = 30
    }
}

# Test 2.2: Cloud masking
Test-Tool -TestName "Cloud Masking for Texas" -ToolName "earth_engine_process" -Arguments @{
    operation = 'mask'
    maskType = 'clouds'
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
    startDate = '2024-01-01'
    endDate = '2024-01-31'
    region = 'Texas'
}

# Test 2.3: Create composites
$compositeTypes = @('median', 'mean', 'max', 'min', 'mosaic')
foreach ($type in $compositeTypes) {
    $result = Test-Tool -TestName "Create $type Composite for California" -ToolName "earth_engine_process" -Arguments @{
        operation = 'composite'
        compositeType = $type
        datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
        startDate = '2024-06-01'
        endDate = '2024-06-30'
        region = 'California'
    }
    
    # Store composite key for later use
    if ($result -and $result.compositeKey) {
        $global:LastCompositeKey = $result.compositeKey
    }
}

# Test 2.4: Terrain analysis
$terrainTypes = @('elevation', 'slope', 'aspect', 'hillshade')
foreach ($terrain in $terrainTypes) {
    Test-Tool -TestName "Calculate $terrain for Colorado" -ToolName "earth_engine_process" -Arguments @{
        operation = 'terrain'
        terrainType = $terrain
        region = 'Colorado'
    }
}

# Test 2.5: Time series analysis
Test-Tool -TestName "NDVI Time Series for Kansas Wheat" -ToolName "earth_engine_process" -Arguments @{
    operation = 'analyze'
    analysisType = 'timeseries'
    datasetId = 'MODIS/006/MOD13Q1'
    band = 'NDVI'
    startDate = '2024-01-01'
    endDate = '2024-06-30'
    region = 'Kansas'
    scale = 250
}

# Test 2.6: Statistical analysis
$reducers = @('mean', 'median', 'max', 'min', 'stdDev')
foreach ($reducer in $reducers) {
    Test-Tool -TestName "Calculate $reducer Statistics for Nebraska" -ToolName "earth_engine_process" -Arguments @{
        operation = 'analyze'
        analysisType = 'statistics'
        datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
        region = 'Nebraska'
        startDate = '2024-06-01'
        endDate = '2024-06-30'
        reducer = $reducer
        scale = 100
    }
}

# =====================================
# PHASE 3: EXPORT & VISUALIZATION
# =====================================
Write-Host "`n📤 PHASE 3: EXPORT & VISUALIZATION" -ForegroundColor Yellow
Write-Host "===================================" -ForegroundColor Yellow

# Test 3.1: Generate thumbnails with different visualizations
Test-Tool -TestName "RGB Thumbnail for California" -ToolName "earth_engine_export" -Arguments @{
    operation = 'thumbnail'
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
    startDate = '2024-06-01'
    endDate = '2024-06-30'
    region = 'California'
    dimensions = 800
    visParams = @{
        bands = @('B4', 'B3', 'B2')
        min = 0
        max = 3000
        gamma = 1.4
    }
}

Test-Tool -TestName "False Color Thumbnail for Agricultural Areas" -ToolName "earth_engine_export" -Arguments @{
    operation = 'thumbnail'
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
    startDate = '2024-07-01'
    endDate = '2024-07-31'
    region = 'Iowa'
    dimensions = 800
    visParams = @{
        bands = @('B8', 'B4', 'B3')
        min = 0
        max = 3000
        gamma = 1.2
    }
}

# Test 3.2: Export to cloud storage with different scales
$scales = @(10, 30, 100)
foreach ($scale in $scales) {
    Test-Tool -TestName "Export at ${scale}m Resolution" -ToolName "earth_engine_export" -Arguments @{
        operation = 'export'
        destination = 'auto'
        datasetId = 'LANDSAT/LC08/C02/T1_L2'
        startDate = '2024-01-01'
        endDate = '2024-01-31'
        region = 'Wyoming'
        scale = $scale
        format = 'GeoTIFF'
    }
}

# =====================================
# PHASE 4: INTERACTIVE MAPPING
# =====================================
Write-Host "`n🗺️ PHASE 4: INTERACTIVE MAPPING" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# Test 4.1: Create map from composite
if ($global:LastCompositeKey) {
    $mapResult = Test-Tool -TestName "Create Interactive Map from Composite" -ToolName "earth_engine_map" -Arguments @{
        operation = 'create'
        input = $global:LastCompositeKey
        region = 'California'
        visParams = @{
            bands = @('B4', 'B3', 'B2')
            min = 0
            max = 3000
            gamma = 1.4
        }
        basemap = 'satellite'
        zoom = 8
    }
}

# Test 4.2: List active maps
Test-Tool -TestName "List Active Maps" -ToolName "earth_engine_map" -Arguments @{
    operation = 'list'
}

# =====================================
# PHASE 5: CROP CLASSIFICATION
# =====================================
Write-Host "`n🌾 PHASE 5: CROP CLASSIFICATION" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# Test 5.1: Load ground truth data
$iowaGroundTruth = Get-Content "C:\Users\Dhenenjay\Downloads\iowa-ground-truth.json" | ConvertFrom-Json
$californiaGroundTruth = Get-Content "C:\Users\Dhenenjay\Downloads\california-ground-truth.json" | ConvertFrom-Json

# Test 5.2: Iowa crop classification with ground truth
$iowaTrainingPoints = $iowaGroundTruth.training_points | Select-Object -First 30 | ForEach-Object {
    @{
        lat = $_.location.lat
        lon = $_.location.lon
        label = $_.label
        class_name = $_.crop_type
    }
}

Test-Tool -TestName "Iowa Crop Classification with Ground Truth" -ToolName "crop_classification" -Arguments @{
    operation = 'classify'
    region = 'Iowa'
    startDate = '2024-05-01'
    endDate = '2024-09-30'
    classifier = 'randomForest'
    numberOfTrees = 100
    includeIndices = $true
    createMap = $true
    trainingData = $iowaTrainingPoints
    scale = 30
    spatialFiltering = $true
    kernelSize = 3
}

# Test 5.3: California land cover classification
$calTrainingPoints = $californiaGroundTruth.training_points | Select-Object -First 30 | ForEach-Object {
    @{
        lat = $_.location.lat
        lon = $_.location.lon
        label = $_.label
        class_name = $_.land_cover
    }
}

Test-Tool -TestName "California Land Cover Classification" -ToolName "crop_classification" -Arguments @{
    operation = 'classify'
    region = 'California'
    startDate = '2024-01-01'
    endDate = '2024-12-31'
    classifier = 'svm'
    includeIndices = $true
    createMap = $true
    trainingData = $calTrainingPoints
}

# Test 5.4: Test different classifiers
$classifiers = @('randomForest', 'svm', 'cart', 'naiveBayes')
foreach ($classifier in $classifiers) {
    Test-Tool -TestName "Train $classifier Classifier for Kansas" -ToolName "crop_classification" -Arguments @{
        operation = 'train'
        region = 'Kansas'
        startDate = '2024-05-01'
        endDate = '2024-09-30'
        classifier = $classifier
        includeIndices = $true
        numberOfTrees = $(if ($classifier -eq 'randomForest') { 50 } else { $null })
    }
}

# =====================================
# PHASE 6: SYSTEM & ADVANCED
# =====================================
Write-Host "`n🔧 PHASE 6: SYSTEM & ADVANCED" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow

# Test 6.1: Authentication status
Test-Tool -TestName "Check Authentication Status" -ToolName "earth_engine_system" -Arguments @{
    operation = 'auth'
    checkType = 'status'
}

# Test 6.2: System health
Test-Tool -TestName "System Health Check" -ToolName "earth_engine_system" -Arguments @{
    operation = 'health'
}

# Test 6.3: System information
Test-Tool -TestName "Get System Information" -ToolName "earth_engine_system" -Arguments @{
    operation = 'info'
    infoType = 'system'
}

# Test 6.4: Execute custom Earth Engine code
$eeCode = @"
var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate('2024-06-01', '2024-06-30')
    .filterBounds(ee.Geometry.Point([-122.4194, 37.7749]));
var count = dataset.size();
print('Image count:', count);
"@

Test-Tool -TestName "Execute Custom EE JavaScript" -ToolName "earth_engine_system" -Arguments @{
    operation = 'execute'
    code = $eeCode
    language = 'javascript'
}

# =====================================
# PHASE 7: STRESS TESTING
# =====================================
Write-Host "`n💪 PHASE 7: STRESS TESTING" -ForegroundColor Yellow
Write-Host "==========================" -ForegroundColor Yellow

# Test 7.1: Large region processing
Test-Tool -TestName "Process Continental United States" -ToolName "earth_engine_process" -Arguments @{
    operation = 'analyze'
    analysisType = 'statistics'
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
    region = 'United States'
    startDate = '2024-01-01'
    endDate = '2024-01-31'
    scale = 5000
    reducer = 'mean'
}

# Test 7.2: Long time series
Test-Tool -TestName "5-Year Time Series Analysis" -ToolName "earth_engine_process" -Arguments @{
    operation = 'analyze'
    analysisType = 'timeseries'
    datasetId = 'MODIS/006/MOD13Q1'
    band = 'NDVI'
    startDate = '2019-01-01'
    endDate = '2024-01-01'
    region = 'Nebraska'
    scale = 500
}

# Test 7.3: Multiple concurrent operations
Write-Host "`n🔄 Testing Concurrent Operations..." -ForegroundColor Cyan
$jobs = @()
$jobs += Start-Job -ScriptBlock {
    param($body)
    Invoke-RestMethod -Uri 'http://localhost:3000/transport' -Method POST -Body $body -ContentType 'application/json'
} -ArgumentList (@{
    method = 'tools/call'
    params = @{
        name = 'earth_engine_data'
        arguments = @{
            operation = 'search'
            query = 'precipitation'
            limit = 10
        }
    }
} | ConvertTo-Json -Depth 10)

$jobs += Start-Job -ScriptBlock {
    param($body)
    Invoke-RestMethod -Uri 'http://localhost:3000/transport' -Method POST -Body $body -ContentType 'application/json'
} -ArgumentList (@{
    method = 'tools/call'
    params = @{
        name = 'earth_engine_process'
        arguments = @{
            operation = 'index'
            indexType = 'NDVI'
            datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
            startDate = '2024-06-01'
            endDate = '2024-06-30'
            region = 'Texas'
        }
    }
} | ConvertTo-Json -Depth 10)

$jobs | Wait-Job | Out-Null
$concurrentResults = $jobs | Receive-Job
$jobs | Remove-Job

if ($concurrentResults.Count -eq 2) {
    Write-Host "   ✅ Concurrent operations completed successfully" -ForegroundColor Green
    $global:TestResults.Passed++
    $global:TestResults.Total++
} else {
    Write-Host "   ❌ Concurrent operations failed" -ForegroundColor Red
    $global:TestResults.Failed++
    $global:TestResults.Total++
}

# =====================================
# PHASE 8: ERROR HANDLING & RECOVERY
# =====================================
Write-Host "`n⚠️ PHASE 8: ERROR HANDLING & RECOVERY" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow

# Test 8.1: Invalid dataset
Test-Tool -TestName "Handle Invalid Dataset" -ToolName "earth_engine_data" -Arguments @{
    operation = 'filter'
    datasetId = 'INVALID/DATASET/NAME'
    startDate = '2024-01-01'
    endDate = '2024-01-31'
}

# Test 8.2: Invalid date range
Test-Tool -TestName "Handle Invalid Date Range" -ToolName "earth_engine_data" -Arguments @{
    operation = 'filter'
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED'
    startDate = '2025-01-01'
    endDate = '2024-01-01'
}

# Test 8.3: Missing required parameters
Test-Tool -TestName "Handle Missing Parameters" -ToolName "earth_engine_process" -Arguments @{
    operation = 'index'
    # Missing indexType and other required params
}

# Test 8.4: Invalid region
Test-Tool -TestName "Handle Invalid Region" -ToolName "earth_engine_data" -Arguments @{
    operation = 'geometry'
    placeName = 'Atlantis'
}

# =====================================
# FINAL SUMMARY
# =====================================
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "TEST SUITE SUMMARY" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Total Tests: $($global:TestResults.Total)" -ForegroundColor White
Write-Host "✅ Passed: $($global:TestResults.Passed)" -ForegroundColor Green
Write-Host "❌ Failed: $($global:TestResults.Failed)" -ForegroundColor Red
$successRate = [math]::Round(($global:TestResults.Passed / $global:TestResults.Total) * 100, 1)
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { 'Green' } elseif ($successRate -ge 70) { 'Yellow' } else { 'Red' })
Write-Host "Completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Show failed tests
if ($global:TestResults.Failed -gt 0) {
    Write-Host "`n❌ Failed Tests:" -ForegroundColor Red
    $global:TestResults.Details | Where-Object { $_.Status -in @('Failed', 'Error', 'ValidationFailed') } | ForEach-Object {
        Write-Host "  - $($_.Test): $($_.Error)" -ForegroundColor Red
    }
}

# Production readiness assessment
Write-Host "`n🎯 PRODUCTION READINESS ASSESSMENT" -ForegroundColor Cyan
if ($successRate -ge 95) {
    Write-Host "✅ PRODUCTION READY - All critical systems operational" -ForegroundColor Green
} elseif ($successRate -ge 85) {
    Write-Host "⚠️ MOSTLY READY - Minor issues need attention" -ForegroundColor Yellow
} else {
    Write-Host "❌ NOT READY - Significant issues require fixing" -ForegroundColor Red
}

# Export detailed results
$resultsFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$global:TestResults | ConvertTo-Json -Depth 10 | Out-File $resultsFile
Write-Host "`n📁 Detailed results saved to: $resultsFile" -ForegroundColor Gray