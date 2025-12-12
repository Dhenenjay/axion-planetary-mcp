# Earth Engine MCP Server - Professional Stress Test Suite
# =========================================================
# Comprehensive testing of all tools pushed to their limits

$ErrorActionPreference = "Continue"
$Global:SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"
$Global:TestResults = @()
$Global:FailedTests = @()
$Global:SuccessCount = 0
$Global:FailCount = 0

# Color coding for output
function Write-TestHeader {
    param([string]$Text)
    Write-Host "`n$('='*80)" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor White
    Write-Host "$('='*80)" -ForegroundColor Cyan
}

function Write-TestSection {
    param([string]$Text)
    Write-Host "`n>>> $Text" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
    $Global:SuccessCount++
}

function Write-Failure {
    param([string]$Text, [string]$Error)
    Write-Host "❌ $Text" -ForegroundColor Red
    if ($Error) { Write-Host "   Error: $Error" -ForegroundColor Gray }
    $Global:FailCount++
    $Global:FailedTests += $Text
}

# Core API call function with error handling
function Call-EarthEngine {
    param(
        [string]$Tool,
        [hashtable]$Arguments,
        [string]$TestName
    )
    
    try {
        $body = @{
            tool = $Tool
            arguments = $Arguments
        } | ConvertTo-Json -Depth 10
        
        # Increase timeout for Earth Engine operations which can be slow
        $response = Invoke-RestMethod -Uri $Global:SSE_ENDPOINT -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120
        
        if ($response.error -or $response.success -eq $false) {
            Write-Failure "$TestName" $response.error
            return $null
        }
        
        Write-Success "$TestName"
        return $response
    }
    catch {
        Write-Failure "$TestName" $_.Exception.Message
        return $null
    }
}

# ============================================================
# STRESS TEST SUITE BEGINS
# ============================================================

Write-Host "`n🚀 EARTH ENGINE MCP SERVER - PROFESSIONAL STRESS TEST SUITE" -ForegroundColor Magenta
Write-Host "Testing Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Endpoint: $Global:SSE_ENDPOINT" -ForegroundColor Gray

# Check server health first
Write-TestSection "Checking server health..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    Write-Success "Server is healthy"
} catch {
    Write-Host "❌ Server is not running! Please start the server first." -ForegroundColor Red
    exit 1
}

# ============================================================
# TEST CATEGORY 1: DATA OPERATIONS
# ============================================================

Write-TestHeader "CATEGORY 1: DATA OPERATIONS - SEARCH, FILTER, GEOMETRY, INFO"

# Test 1.1: Search with various queries
Write-TestSection "Testing search operations with edge cases..."

$searchQueries = @(
    @{query = "sentinel"; expected = "Sentinel datasets"},
    @{query = "LANDSAT"; expected = "Landsat datasets"},
    @{query = "temperature"; expected = "Temperature datasets"},
    @{query = "precipitation"; expected = "Precipitation datasets"},
    @{query = "elevation"; expected = "DEM datasets"},
    @{query = "land cover"; expected = "Land cover datasets"},
    @{query = ""; expected = "Empty query"},
    @{query = "xyz123nonexistent"; expected = "Non-existent dataset"}
)

foreach ($sq in $searchQueries) {
    $result = Call-EarthEngine -Tool "earth_engine_data" -Arguments @{
        operation = "search"
        query = $sq.query
        limit = 50
    } -TestName "Search: $($sq.expected)"
}

# Test 1.2: Filter with extreme date ranges and regions
Write-TestSection "Testing filter operations with extreme parameters..."

$filterTests = @(
    @{
        name = "Large date range (1 year)"
        args = @{
            operation = "filter"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-01-01"
            endDate = "2024-12-31"
            region = "California"
            cloudCoverMax = 10
        }
    },
    @{
        name = "Very recent dates"
        args = @{
            operation = "filter"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2025-01-01"
            endDate = "2025-01-10"
            region = "New York"
            cloudCoverMax = 5
        }
    },
    @{
        name = "Multiple datasets - Landsat"
        args = @{
            operation = "filter"
            datasetId = "LANDSAT/LC09/C02/T1_L2"
            startDate = "2024-06-01"
            endDate = "2024-08-31"
            region = "Texas"
            cloudCoverMax = 15
        }
    },
    @{
        name = "MODIS daily products"
        args = @{
            operation = "filter"
            datasetId = "MODIS/006/MOD13Q1"
            startDate = "2024-01-01"
            endDate = "2024-03-31"
            region = "Amazon"
        }
    }
)

foreach ($test in $filterTests) {
    $result = Call-EarthEngine -Tool "earth_engine_data" -Arguments $test.args -TestName "Filter: $($test.name)"
}

# Test 1.3: Geometry operations with various place names
Write-TestSection "Testing geometry operations with global locations..."

$geometryTests = @(
    "Los Angeles", "San Francisco", "New York", "Chicago", "Houston",
    "London", "Paris", "Tokyo", "Mumbai", "Delhi", "Beijing",
    "São Paulo", "Cairo", "Moscow", "Sydney",
    "California", "Texas", "Florida", "Alaska",
    "United States", "India", "Brazil", "Australia"
)

foreach ($place in $geometryTests) {
    $result = Call-EarthEngine -Tool "earth_engine_data" -Arguments @{
        operation = "geometry"
        placeName = $place
    } -TestName "Geometry: $place"
}

# Test 1.4: Dataset info retrieval
Write-TestSection "Testing dataset info retrieval..."

$datasetIds = @(
    "COPERNICUS/S2_SR_HARMONIZED",
    "LANDSAT/LC09/C02/T1_L2",
    "MODIS/006/MOD13Q1",
    "NASA/GPM_L3/IMERG_V06",
    "NASA/SRTM_V3",
    "ESA/WorldCover/v200",
    "GOOGLE/DYNAMICWORLD/V1"
)

foreach ($dataset in $datasetIds) {
    $result = Call-EarthEngine -Tool "earth_engine_data" -Arguments @{
        operation = "info"
        datasetId = $dataset
    } -TestName "Info: $dataset"
}

# ============================================================
# TEST CATEGORY 2: PROCESSING OPERATIONS
# ============================================================

Write-TestHeader "CATEGORY 2: PROCESSING OPERATIONS - COMPOSITE, MASK, INDEX, ANALYZE"

# Test 2.1: Different composite types
Write-TestSection "Testing all composite types..."

$compositeTypes = @("median", "mean", "max", "min", "mosaic")
$Global:CompositeKeys = @{}

foreach ($compType in $compositeTypes) {
    $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-31"
        region = "San Francisco"
        compositeType = $compType
        cloudCoverMax = 20
    } -TestName "Composite: $compType"
    
    if ($result -and $result.compositeKey) {
        $Global:CompositeKeys[$compType] = $result.compositeKey
    }
}

# Test 2.2: Spectral indices calculation
Write-TestSection "Testing all spectral indices..."

$indices = @("NDVI", "NDWI", "NDBI", "EVI", "SAVI", "MNDWI", "NDSI", "NBR")
$Global:IndexKeys = @{}

foreach ($index in $indices) {
    $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = $index
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-31"
        region = "Los Angeles"
    } -TestName "Index: $index"
    
    if ($result -and $index -eq "NDVI" -and $result.ndviKey) {
        $Global:IndexKeys["NDVI"] = $result.ndviKey
    }
}

# Test 2.3: Mask operations
Write-TestSection "Testing mask operations..."

$maskTypes = @("clouds", "water", "quality", "shadow")

foreach ($mask in $maskTypes) {
    $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "mask"
        maskType = $mask
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-10-01"
        endDate = "2024-10-31"
        region = "Miami"
        threshold = 20
    } -TestName "Mask: $mask"
}

# Test 2.4: Statistical analysis
Write-TestSection "Testing statistical analysis operations..."

$analysisTypes = @("statistics", "timeseries", "change", "zonal")
$reducers = @("mean", "median", "max", "min", "stdDev", "sum", "count")

foreach ($analysis in $analysisTypes) {
    foreach ($reducer in $reducers[0..2]) { # Test first 3 reducers for each
        $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
            operation = "analyze"
            analysisType = $analysis
            reducer = $reducer
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-09-01"
            endDate = "2024-09-30"
            region = "Denver"
            scale = 30
        } -TestName "Analysis: $analysis with $reducer"
    }
}

# Test 2.5: Terrain analysis
Write-TestSection "Testing terrain operations..."

$terrainTypes = @("elevation", "slope", "aspect", "hillshade")

foreach ($terrain in $terrainTypes) {
    $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "terrain"
        terrainType = $terrain
        datasetId = "NASA/SRTM_V3"
        region = "Colorado"
        azimuth = 315
        elevation = 45
    } -TestName "Terrain: $terrain"
}

# ============================================================
# TEST CATEGORY 3: EXPORT AND VISUALIZATION
# ============================================================

Write-TestHeader "CATEGORY 3: EXPORT AND VISUALIZATION OPERATIONS"

# Test 3.1: Thumbnail generation with various parameters
Write-TestSection "Testing thumbnail generation with extreme parameters..."

$thumbnailTests = @(
    @{
        name = "High resolution (1024x1024)"
        args = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-10-01"
            endDate = "2024-10-31"
            region = "Los Angeles"
            dimensions = 1024
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0; max = 0.3; gamma = 1.4
            }
        }
    },
    @{
        name = "Small thumbnail (256x256)"
        args = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-10-01"
            endDate = "2024-10-31"
            region = "Miami"
            dimensions = 256
            visParams = @{
                bands = @("B8", "B4", "B3")
                min = 0; max = 0.4; gamma = 1.2
            }
        }
    },
    @{
        name = "NDVI visualization"
        args = @{
            operation = "thumbnail"
            ndviKey = $Global:IndexKeys["NDVI"]
            region = "Los Angeles"
            dimensions = 512
            visParams = @{
                bands = @("NDVI")
                min = -1; max = 1
                palette = @("#0000FF", "#FFFF00", "#00FF00")
            }
        }
    }
)

foreach ($test in $thumbnailTests) {
    if ($test.args.ndviKey -and -not $test.args.ndviKey) {
        Write-Failure "Thumbnail: $($test.name)" "No NDVI key available"
        continue
    }
    $result = Call-EarthEngine -Tool "earth_engine_export" -Arguments $test.args -TestName "Thumbnail: $($test.name)"
}

# Test 3.2: Tile service generation
Write-TestSection "Testing tile service generation..."

if ($Global:CompositeKeys["median"]) {
    $result = Call-EarthEngine -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        compositeKey = $Global:CompositeKeys["median"]
        region = "San Francisco"
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0; max = 0.3
        }
        zoomLevel = 12
    } -TestName "Tiles: Composite visualization"
}

# Test 3.3: Export operations
Write-TestSection "Testing export operations..."

$exportTests = @(
    @{
        name = "GeoTIFF export to GCS"
        args = @{
            operation = "export"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-10-01"
            endDate = "2024-10-31"
            region = "San Francisco"
            scale = 10
            destination = "gcs"
            format = "GeoTIFF"
            fileNamePrefix = "stress_test_export"
            maxPixels = 1e8
        }
    },
    @{
        name = "COG export"
        args = @{
            operation = "export"
            datasetId = "LANDSAT/LC09/C02/T1_L2"
            startDate = "2024-09-01"
            endDate = "2024-09-30"
            region = "Denver"
            scale = 30
            destination = "gcs"
            format = "COG"
            fileNamePrefix = "stress_test_cog"
        }
    }
)

foreach ($test in $exportTests) {
    $result = Call-EarthEngine -Tool "earth_engine_export" -Arguments $test.args -TestName "Export: $($test.name)"
}

# ============================================================
# TEST CATEGORY 4: SYSTEM OPERATIONS
# ============================================================

Write-TestHeader "CATEGORY 4: SYSTEM AND ADVANCED OPERATIONS"

# Test 4.1: System health and info
Write-TestSection "Testing system operations..."

$systemOps = @(
    @{
        name = "System health check"
        args = @{operation = "health"}
    },
    @{
        name = "System info"
        args = @{operation = "info"; infoType = "system"}
    },
    @{
        name = "Quotas check"
        args = @{operation = "info"; infoType = "quotas"}
    },
    @{
        name = "Tasks status"
        args = @{operation = "info"; infoType = "tasks"}
    }
)

foreach ($test in $systemOps) {
    $result = Call-EarthEngine -Tool "earth_engine_system" -Arguments $test.args -TestName "System: $($test.name)"
}

# ============================================================
# TEST CATEGORY 5: EDGE CASES AND ERROR HANDLING
# ============================================================

Write-TestHeader "CATEGORY 5: EDGE CASES AND ERROR HANDLING"

Write-TestSection "Testing error handling and edge cases..."

# Test 5.1: Invalid parameters
$errorTests = @(
    @{
        name = "Invalid date range"
        tool = "earth_engine_data"
        args = @{
            operation = "filter"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-12-31"
            endDate = "2024-01-01"  # End before start
            region = "California"
        }
    },
    @{
        name = "Non-existent dataset"
        tool = "earth_engine_data"
        args = @{
            operation = "filter"
            datasetId = "INVALID/DATASET/ID"
            startDate = "2024-01-01"
            endDate = "2024-12-31"
            region = "Texas"
        }
    },
    @{
        name = "Invalid region name"
        tool = "earth_engine_data"
        args = @{
            operation = "geometry"
            placeName = "Atlantis123456"
        }
    },
    @{
        name = "Invalid index type"
        tool = "earth_engine_process"
        args = @{
            operation = "index"
            indexType = "INVALID_INDEX"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            region = "Miami"
        }
    }
)

foreach ($test in $errorTests) {
    $result = Call-EarthEngine -Tool $test.tool -Arguments $test.args -TestName "Error handling: $($test.name)"
}

# ============================================================
# TEST CATEGORY 6: PERFORMANCE AND LOAD TESTING
# ============================================================

Write-TestHeader "CATEGORY 6: PERFORMANCE AND LOAD TESTING"

Write-TestSection "Testing concurrent operations..."

# Test 6.1: Rapid sequential calls
$startTime = Get-Date
for ($i = 1; $i -le 5; $i++) {
    $result = Call-EarthEngine -Tool "earth_engine_data" -Arguments @{
        operation = "search"
        query = "sentinel"
        limit = 10
    } -TestName "Rapid call $i/5"
}
$duration = (Get-Date) - $startTime
Write-Host "Sequential calls completed in: $($duration.TotalSeconds) seconds" -ForegroundColor Gray

# Test 6.2: Large area processing
Write-TestSection "Testing large area processing..."

$largeAreas = @(
    @{name = "Entire California"; region = "California"},
    @{name = "Entire Texas"; region = "Texas"},
    @{name = "Continental US"; region = "United States"}
)

foreach ($area in $largeAreas) {
    $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "composite"
        datasetId = "MODIS/006/MOD13Q1"
        startDate = "2024-01-01"
        endDate = "2024-01-31"
        region = $area.region
        compositeType = "median"
    } -TestName "Large area: $($area.name)"
}

# ============================================================
# TEST CATEGORY 7: COMPLEX WORKFLOWS
# ============================================================

Write-TestHeader "CATEGORY 7: COMPLEX MULTI-STEP WORKFLOWS"

Write-TestSection "Testing complete analysis workflows..."

# Workflow 1: Complete vegetation analysis
Write-Host "`nWorkflow 1: Complete vegetation analysis for agricultural monitoring" -ForegroundColor Cyan

# Step 1: Filter data
$step1 = Call-EarthEngine -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Iowa"
    cloudCoverMax = 10
} -TestName "Workflow 1 - Step 1: Filter agricultural data"

# Step 2: Create composite
$step2 = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Iowa"
    compositeType = "median"
    cloudCoverMax = 10
} -TestName "Workflow 1 - Step 2: Create composite"

if ($step2.compositeKey) {
    # Step 3: Calculate NDVI
    $step3 = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDVI"
        compositeKey = $step2.compositeKey
        region = "Iowa"
    } -TestName "Workflow 1 - Step 3: Calculate NDVI"
    
    if ($step3.ndviKey) {
        # Step 4: Generate visualization
        $step4 = Call-EarthEngine -Tool "earth_engine_export" -Arguments @{
            operation = "thumbnail"
            ndviKey = $step3.ndviKey
            region = "Iowa"
            dimensions = 512
            visParams = @{
                bands = @("NDVI")
                min = 0; max = 0.8
                palette = @("#FFFFE5", "#F7FCB9", "#D9F0A3", "#ADDD8E", "#78C679", "#41AB5D", "#238443", "#006837", "#004529")
            }
        } -TestName "Workflow 1 - Step 4: Generate NDVI map"
    }
}

# Workflow 2: Water quality monitoring
Write-Host "`nWorkflow 2: Water quality analysis" -ForegroundColor Cyan

$water1 = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Lake Tahoe"
} -TestName "Workflow 2 - Water index calculation"

$water2 = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
    operation = "analyze"
    analysisType = "statistics"
    reducer = "mean"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Lake Tahoe"
    scale = 30
} -TestName "Workflow 2 - Water statistics"

# ============================================================
# TEST CATEGORY 8: MULTI-TEMPORAL ANALYSIS
# ============================================================

Write-TestHeader "CATEGORY 8: MULTI-TEMPORAL AND CHANGE DETECTION"

Write-TestSection "Testing temporal analysis capabilities..."

# Test different time periods for change detection
$periods = @(
    @{name = "Winter"; start = "2024-01-01"; end = "2024-02-29"},
    @{name = "Spring"; start = "2024-03-01"; end = "2024-05-31"},
    @{name = "Summer"; start = "2024-06-01"; end = "2024-08-31"},
    @{name = "Fall"; start = "2024-09-01"; end = "2024-11-30"}
)

foreach ($period in $periods) {
    $result = Call-EarthEngine -Tool "earth_engine_process" -Arguments @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = $period.start
        endDate = $period.end
        region = "Yellowstone"
        compositeType = "median"
        cloudCoverMax = 20
    } -TestName "Seasonal composite: $($period.name)"
}

# ============================================================
# FINAL SUMMARY
# ============================================================

Write-Host "`n" -NoNewline
Write-Host "$('='*80)" -ForegroundColor Magenta
Write-Host "STRESS TEST COMPLETE - FINAL REPORT" -ForegroundColor White
Write-Host "$('='*80)" -ForegroundColor Magenta

Write-Host "`nTest Statistics:" -ForegroundColor Yellow
Write-Host "  Total Tests Run: $($Global:SuccessCount + $Global:FailCount)" -ForegroundColor White
Write-Host "  Successful: $Global:SuccessCount" -ForegroundColor Green
Write-Host "  Failed: $Global:FailCount" -ForegroundColor Red
$successRate = if (($Global:SuccessCount + $Global:FailCount) -gt 0) {
    [math]::Round(($Global:SuccessCount / ($Global:SuccessCount + $Global:FailCount)) * 100, 2)
} else { 0 }
Write-Host "  Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 95) {"Green"} elseif ($successRate -ge 80) {"Yellow"} else {"Red"})

if ($Global:FailedTests.Count -gt 0) {
    Write-Host "`nFailed Tests:" -ForegroundColor Red
    foreach ($failed in $Global:FailedTests) {
        Write-Host "  - $failed" -ForegroundColor Gray
    }
}

Write-Host "`nCategories Tested:" -ForegroundColor Yellow
Write-Host "  Check: Data Operations (Search, Filter, Geometry, Info)" -ForegroundColor Gray
Write-Host "  Check: Processing (Composite, Mask, Index, Analysis, Terrain)" -ForegroundColor Gray
Write-Host "  Check: Export and Visualization (Thumbnail, Tiles, Export)" -ForegroundColor Gray
Write-Host "  Check: System Operations (Health, Info, Status)" -ForegroundColor Gray
Write-Host "  Check: Error Handling and Edge Cases" -ForegroundColor Gray
Write-Host "  Check: Performance and Load Testing" -ForegroundColor Gray
Write-Host "  Check: Complex Workflows" -ForegroundColor Gray
Write-Host "  Check: Multi-temporal Analysis" -ForegroundColor Gray

if ($successRate -ge 95) {
    Write-Host "`n🎉 EXCELLENT! Server is production-ready with $successRate% success rate!" -ForegroundColor Green
    Write-Host "   Your MCP server is robust and ready for user deployment." -ForegroundColor Green
} elseif ($successRate -ge 80) {
    Write-Host "`n⚠️ GOOD: Server is mostly stable with $successRate% success rate." -ForegroundColor Yellow
    Write-Host "   Consider fixing the failed tests before production deployment." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ NEEDS IMPROVEMENT: Server has issues with $successRate% success rate." -ForegroundColor Red
    Write-Host "   Critical fixes needed before production deployment." -ForegroundColor Red
}

Write-Host "`n$('='*80)" -ForegroundColor Magenta
Write-Host "End of stress test report - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
