# COMPREHENSIVE EARTH ENGINE MCP TEST SUITE
# Tests EVERY tool, model, and function

$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"
$global:testResults = @()
$global:totalTests = 0
$global:passedTests = 0
$global:failedTests = 0
$global:timings = @()

# Color settings
$colors = @{
    Header = "Magenta"
    Section = "Cyan"
    Success = "Green"
    Failure = "Red"
    Warning = "Yellow"
    Info = "White"
}

function Write-TestHeader {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor $colors.Header
    Write-Host $Text -ForegroundColor $colors.Header
    Write-Host ("=" * 80) -ForegroundColor $colors.Header
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host ("-" * 60) -ForegroundColor $colors.Section
    Write-Host $Text -ForegroundColor $colors.Section
    Write-Host ("-" * 60) -ForegroundColor $colors.Section
}

function Test-EarthEngine {
    param(
        [string]$TestName,
        [string]$Tool,
        [hashtable]$Arguments,
        [int]$Timeout = 30
    )
    
    $global:totalTests++
    $testNum = $global:totalTests.ToString().PadLeft(3, '0')
    Write-Host "  [$testNum] $TestName" -NoNewline
    
    $body = @{
        tool = $Tool
        arguments = $Arguments
    } | ConvertTo-Json -Depth 10
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $response = Invoke-WebRequest -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec $Timeout `
            -UseBasicParsing
        
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        $global:timings += $elapsed
        
        $responseData = $response.Content | ConvertFrom-Json
        
        if ($responseData.error -or $responseData.success -eq $false) {
            Write-Host " FAIL (${elapsed}ms)" -ForegroundColor $colors.Failure
            if ($responseData.error) {
                Write-Host "       Error: $($responseData.error)" -ForegroundColor Gray
            }
            $global:failedTests++
            return $false
        } else {
            Write-Host " PASS (${elapsed}ms)" -ForegroundColor $colors.Success
            $global:passedTests++
            
            # Store result for later use
            $global:testResults += @{
                Test = $TestName
                Tool = $Tool
                Success = $true
                Time = $elapsed
                Data = $responseData
            }
            
            return $responseData
        }
    }
    catch {
        Write-Host " ERROR" -ForegroundColor $colors.Failure
        Write-Host "       $($_.Exception.Message)" -ForegroundColor Gray
        $global:failedTests++
        return $false
    }
}

Write-TestHeader "EARTH ENGINE MCP COMPREHENSIVE TEST SUITE"
Write-Host "Testing EVERY tool, model, and function" -ForegroundColor $colors.Info
Write-Host "Endpoint: $SSE_ENDPOINT" -ForegroundColor $colors.Info
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $colors.Info

# Test server connectivity
Write-Host ""
Write-Host "Testing server connectivity..." -ForegroundColor $colors.Info
try {
    $testBody = @{ tool = "earth_engine_data"; arguments = @{ operation = "boundaries" } } | ConvertTo-Json
    $testResponse = Invoke-WebRequest -Uri $SSE_ENDPOINT -Method POST -Body $testBody -ContentType "application/json" -TimeoutSec 5 -UseBasicParsing
    Write-Host "Server is online and responding" -ForegroundColor $colors.Success
} catch {
    Write-Host "Cannot connect to server!" -ForegroundColor $colors.Failure
    Write-Host "Please ensure server is running: npm run dev" -ForegroundColor $colors.Warning
    exit 1
}

# ===========================================================================
# SECTION 1: EARTH_ENGINE_DATA TOOL - ALL OPERATIONS
# ===========================================================================
Write-Section "1. EARTH_ENGINE_DATA TOOL - Complete Testing"

Write-Host ""
Write-Host "Testing SEARCH operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Search for Sentinel-2 datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "sentinel"
    limit = 5
}

Test-EarthEngine -TestName "Search for Landsat datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "landsat"
    limit = 5
}

Test-EarthEngine -TestName "Search for MODIS datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "modis"
    limit = 5
}

Test-EarthEngine -TestName "Search with empty query" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = ""
    limit = 3
}

Write-Host ""
Write-Host "Testing FILTER operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Filter Sentinel-2 - San Francisco" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "San Francisco"
    cloudCoverMax = 20
}

Test-EarthEngine -TestName "Filter Landsat - New York" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "LANDSAT/LC09/C02/T1_L2"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "New York"
}

Test-EarthEngine -TestName "Filter with no cloud filter" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-30"
    region = "Los Angeles"
}

Write-Host ""
Write-Host "Testing GEOMETRY operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Get geometry - San Francisco" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "San Francisco"
}

Test-EarthEngine -TestName "Get geometry - Tokyo" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Tokyo"
}

Test-EarthEngine -TestName "Get geometry - Amazon Rainforest" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Amazon Rainforest"
}

Write-Host ""
Write-Host "Testing INFO operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Get info - Sentinel-2" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
}

Test-EarthEngine -TestName "Get info - Landsat 9" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "LANDSAT/LC09/C02/T1_L2"
}

Write-Host ""
Write-Host "Testing BOUNDARIES operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "List available boundaries" -Tool "earth_engine_data" -Arguments @{
    operation = "boundaries"
}

# ===========================================================================
# SECTION 2: EARTH_ENGINE_PROCESS TOOL - ALL OPERATIONS
# ===========================================================================
Write-Section "2. EARTH_ENGINE_PROCESS TOOL - Complete Testing"

Write-Host ""
Write-Host "Testing COMPOSITE operation:" -ForegroundColor $colors.Info
$compositeResult = Test-EarthEngine -TestName "Create median composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Denver"
    compositeType = "median"
    cloudCoverMax = 20
} -Timeout 60

Test-EarthEngine -TestName "Create greenest pixel composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Seattle"
    compositeType = "greenest"
} -Timeout 60

Write-Host ""
Write-Host "Testing FCC operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Create False Color Composite" -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Miami"
} -Timeout 60

Write-Host ""
Write-Host "Testing INDEX operations (ALL SUPPORTED INDICES):" -ForegroundColor $colors.Info

# Test ALL supported indices
$indices = @("NDVI", "NDWI", "NDBI", "EVI", "SAVI", "MNDWI", "BSI", "NDSI", "NBR")
foreach ($indexType in $indices) {
    Test-EarthEngine -TestName "Calculate $indexType index" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $indexType
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-15"
        region = "Phoenix"
    } -Timeout 60
}

Write-Host ""
Write-Host "Testing other PROCESS operations:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Clip operation" -Tool "earth_engine_process" -Arguments @{
    operation = "clip"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "Manhattan"
} -Timeout 45

Test-EarthEngine -TestName "Mask operation" -Tool "earth_engine_process" -Arguments @{
    operation = "mask"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    maskType = "clouds"
} -Timeout 45

Test-EarthEngine -TestName "Analyze statistics" -Tool "earth_engine_process" -Arguments @{
    operation = "analyze"
    analysisType = "statistics"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    reducer = "mean"
    region = "Boston"
} -Timeout 45

Test-EarthEngine -TestName "Terrain analysis" -Tool "earth_engine_process" -Arguments @{
    operation = "terrain"
    terrainType = "slope"
    region = "Colorado"
} -Timeout 45

# ===========================================================================
# SECTION 3: EARTH_ENGINE_EXPORT TOOL - ALL OPERATIONS
# ===========================================================================
Write-Section "3. EARTH_ENGINE_EXPORT TOOL - Complete Testing"

Write-Host ""
Write-Host "Testing THUMBNAIL operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Generate thumbnail 512px" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "San Diego"
    dimensions = 512
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
} -Timeout 60

if ($compositeResult -and $compositeResult.compositeKey) {
    Test-EarthEngine -TestName "Thumbnail from composite" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeResult.compositeKey
        dimensions = 800
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 45
}

Write-Host ""
Write-Host "Testing TILES operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Generate map tiles" -Tool "earth_engine_export" -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Las Vegas"
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
} -Timeout 60

Write-Host ""
Write-Host "Testing EXPORT operation:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Export to GeoTIFF" -Tool "earth_engine_export" -Arguments @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Yosemite"
    format = "GeoTIFF"
    scale = 10
} -Timeout 60

# ===========================================================================
# SECTION 4: EARTH_ENGINE_SYSTEM TOOL - ALL OPERATIONS
# ===========================================================================
Write-Section "4. EARTH_ENGINE_SYSTEM TOOL - Complete Testing"

Test-EarthEngine -TestName "Check authentication" -Tool "earth_engine_system" -Arguments @{
    operation = "auth"
}

Test-EarthEngine -TestName "Get system info" -Tool "earth_engine_system" -Arguments @{
    operation = "info"
}

Test-EarthEngine -TestName "Check health" -Tool "earth_engine_system" -Arguments @{
    operation = "health"
}

# ===========================================================================
# SECTION 5: GEOSPATIAL MODELS - Testing Advanced Models
# ===========================================================================
Write-Section "5. GEOSPATIAL MODELS - Advanced Analysis"

Write-Host ""
Write-Host "Testing WILDFIRE RISK MODEL:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Wildfire risk assessment - California" -Tool "wildfire_risk_assessment" -Arguments @{
    region = "California"
    startDate = "2024-06-01"
    endDate = "2024-10-31"
    indices = @("NDVI", "NDWI", "NBR")
    includeTimeSeries = $true
} -Timeout 120

Write-Host ""
Write-Host "Testing FLOOD RISK MODEL:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Flood risk assessment - Houston" -Tool "flood_risk_analysis" -Arguments @{
    region = "Houston"
    startDate = "2024-01-01"
    endDate = "2024-06-30"
    floodType = "urban"
    analyzeWaterChange = $true
} -Timeout 120

Write-Host ""
Write-Host "Testing AGRICULTURAL MONITORING MODEL:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Agricultural monitoring - Iowa" -Tool "agriculture_monitoring" -Arguments @{
    region = "Iowa"
    cropType = "corn"
    startDate = "2024-04-01"
    endDate = "2024-09-30"
    indices = @("NDVI", "EVI", "SAVI", "NDWI")
} -Timeout 120

Write-Host ""
Write-Host "Testing DEFORESTATION TRACKING MODEL:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Deforestation tracking - Amazon" -Tool "deforestation_tracking" -Arguments @{
    region = "Amazon"
    baselineYear = 2023
    currentYear = 2024
    alertThreshold = 5
} -Timeout 120

Write-Host ""
Write-Host "Testing WATER QUALITY MODEL:" -ForegroundColor $colors.Info
Test-EarthEngine -TestName "Water quality assessment - Lake Tahoe" -Tool "water_quality_assessment" -Arguments @{
    waterBody = "Lake Tahoe"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    parameters = @("turbidity", "chlorophyll", "temperature")
} -Timeout 120

# ===========================================================================
# SECTION 6: EDGE CASES AND ERROR HANDLING
# ===========================================================================
Write-Section "6. EDGE CASES AND ERROR HANDLING"

Test-EarthEngine -TestName "Invalid operation" -Tool "earth_engine_data" -Arguments @{
    operation = "invalid_operation"
}

Test-EarthEngine -TestName "Missing required parameters" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    # Missing datasetId
}

Test-EarthEngine -TestName "Invalid dataset ID" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "INVALID/DATASET/XYZ123"
}

Test-EarthEngine -TestName "Invalid date range" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-31"
    endDate = "2024-01-01"
    region = "Miami"
}

Test-EarthEngine -TestName "Invalid index type" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "INVALID_INDEX"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    region = "Denver"
}

# ===========================================================================
# SECTION 7: PERFORMANCE AND STRESS TESTING
# ===========================================================================
Write-Section "7. PERFORMANCE AND STRESS TESTING"

Test-EarthEngine -TestName "Large area processing - California" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-12-31"
    region = "California"
    cloudCoverMax = 10
} -Timeout 90

Test-EarthEngine -TestName "Long time series - 5 years" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "LANDSAT/LC08/C02/T1_L2"
    startDate = "2019-01-01"
    endDate = "2024-12-31"
    region = "Texas"
} -Timeout 90

Test-EarthEngine -TestName "High resolution export" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Manhattan"
    dimensions = 2048
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
} -Timeout 90

# ===========================================================================
# SECTION 8: COMPLEX WORKFLOWS
# ===========================================================================
Write-Section "8. COMPLEX REAL-WORLD WORKFLOWS"

Write-Host ""
Write-Host "Workflow: Complete vegetation monitoring pipeline" -ForegroundColor $colors.Info

# Step 1: Get geometry
$geoResult = Test-EarthEngine -TestName "W1: Get study area" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Sacramento Valley"
}

# Step 2: Filter imagery
$filterResult = Test-EarthEngine -TestName "W1: Filter imagery" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-09-30"
    region = "Sacramento Valley"
    cloudCoverMax = 10
} -Timeout 60

# Step 3: Create composite
$compResult = Test-EarthEngine -TestName "W1: Create composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-09-30"
    region = "Sacramento Valley"
    compositeType = "greenest"
} -Timeout 60

# Step 4: Calculate NDVI
if ($compResult -and $compResult.compositeKey) {
    $ndviResult = Test-EarthEngine -TestName "W1: Calculate NDVI" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDVI"
        compositeKey = $compResult.compositeKey
    } -Timeout 45
    
    # Step 5: Generate visualization
    if ($ndviResult -and $ndviResult.indexKey) {
        Test-EarthEngine -TestName "W1: Generate NDVI map" -Tool "earth_engine_export" -Arguments @{
            operation = "thumbnail"
            ndviKey = $ndviResult.indexKey
            dimensions = 800
            visParams = @{
                bands = @("NDVI")
                min = -1
                max = 1
                palette = @("red", "yellow", "green")
            }
        } -Timeout 45
    }
}

# ===========================================================================
# FINAL STATISTICS
# ===========================================================================
Write-TestHeader "TEST EXECUTION COMPLETE"

$successRate = if ($global:totalTests -gt 0) { 
    [math]::Round(($global:passedTests / $global:totalTests) * 100, 2) 
} else { 0 }

$avgTime = if ($global:timings.Count -gt 0) {
    [math]::Round(($global:timings | Measure-Object -Average).Average, 0)
} else { 0 }

Write-Host ""
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor $colors.Header
Write-Host ("-" * 40) -ForegroundColor $colors.Section
Write-Host "Total Tests: $($global:totalTests)" -ForegroundColor $colors.Info
Write-Host "Passed: $($global:passedTests)" -ForegroundColor $colors.Success
Write-Host "Failed: $($global:failedTests)" -ForegroundColor $colors.Failure
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) {"Green"} elseif ($successRate -ge 70) {"Yellow"} else {"Red"})
Write-Host "Average Response Time: ${avgTime}ms" -ForegroundColor $colors.Info

Write-Host ""
Write-Host "COVERAGE SUMMARY" -ForegroundColor $colors.Header
Write-Host ("-" * 40) -ForegroundColor $colors.Section
Write-Host "Tools Tested: 4 consolidated + 5 models" -ForegroundColor $colors.Success
Write-Host "Operations Tested: 30+" -ForegroundColor $colors.Success
Write-Host "Indices Tested: 9 types" -ForegroundColor $colors.Success
Write-Host "Workflows Tested: Complete pipelines" -ForegroundColor $colors.Success

Write-Host ""
if ($successRate -ge 95) {
    Write-Host "GRADE: EXCEPTIONAL - Production Ready!" -ForegroundColor $colors.Success
} elseif ($successRate -ge 85) {
    Write-Host "GRADE: EXCELLENT - Minor issues only" -ForegroundColor $colors.Success
} elseif ($successRate -ge 75) {
    Write-Host "GRADE: GOOD - Some optimization needed" -ForegroundColor $colors.Warning
} else {
    Write-Host "GRADE: NEEDS WORK - Major issues found" -ForegroundColor $colors.Failure
}

Write-Host ""
Write-Host ("=" * 80) -ForegroundColor $colors.Header
Write-Host "Test completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $colors.Info
