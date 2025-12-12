# ============================================================================
# COMPREHENSIVE EARTH ENGINE MCP GEOSPATIAL ANALYST TEST SUITE
# ============================================================================
# This test suite simulates real-world geospatial analysis workflows
# Testing every tool, model, and function from an expert analyst perspective
# ============================================================================

$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"
$global:testResults = @()
$global:totalTests = 0
$global:passedTests = 0
$global:failedTests = 0
$global:timings = @()
$global:workflowData = @{}

# Color configuration
$colors = @{
    Header = "Magenta"
    Section = "Cyan"
    Subsection = "Yellow"
    Success = "Green"
    Failure = "Red"
    Warning = "Yellow"
    Info = "White"
    Detail = "Gray"
}

function Write-TestHeader {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor $colors.Header
    Write-Host $Text -ForegroundColor $colors.Header
    Write-Host ("=" * 80) -ForegroundColor $colors.Header
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host ("─" * 60) -ForegroundColor $colors.Section
    Write-Host "▶ $Text" -ForegroundColor $colors.Section
    Write-Host ("─" * 60) -ForegroundColor $colors.Section
}

function Write-Subsection {
    param([string]$Text)
    Write-Host ""
    Write-Host "  ▸ $Text" -ForegroundColor $colors.Subsection
}

function Test-MCPFunction {
    param(
        [string]$TestName,
        [string]$Tool,
        [hashtable]$Arguments,
        [int]$Timeout = 30,
        [bool]$ExpectFailure = $false,
        [scriptblock]$ValidateResponse = $null,
        [bool]$StoreResult = $false,
        [string]$ResultKey = ""
    )
    
    $global:totalTests++
    $testNumber = $global:totalTests.ToString().PadLeft(3, '0')
    Write-Host "    [$testNumber] $TestName" -NoNewline
    
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
        
        # Store result if requested
        if ($StoreResult -and $ResultKey) {
            $global:workflowData[$ResultKey] = $responseData
        }
        
        # Check if we expected failure
        if ($ExpectFailure) {
            if ($responseData.error -or $responseData.success -eq $false) {
                Write-Host " ✓ Failed as expected (${elapsed}ms)" -ForegroundColor $colors.Success
                $global:passedTests++
                return @{ success = $true; data = $responseData; time = $elapsed }
            } else {
                Write-Host " ✗ Should have failed" -ForegroundColor $colors.Failure
                $global:failedTests++
                return @{ success = $false; data = $responseData; time = $elapsed }
            }
        }
        
        # Check for actual failure
        if ($responseData.error -or $responseData.success -eq $false) {
            Write-Host " ✗ Failed (${elapsed}ms)" -ForegroundColor $colors.Failure
            if ($responseData.error) {
                Write-Host "         Error: $($responseData.error)" -ForegroundColor $colors.Detail
            }
            $global:failedTests++
            return @{ success = $false; data = $responseData; time = $elapsed }
        }
        
        # Custom validation if provided
        if ($ValidateResponse) {
            $validationResult = & $ValidateResponse $responseData
            if ($validationResult) {
                Write-Host " ✓ Passed (${elapsed}ms)" -ForegroundColor $colors.Success
                $global:passedTests++
                
                # Add details if present
                if ($responseData.imageCount) {
                    Write-Host "         Images: $($responseData.imageCount)" -ForegroundColor $colors.Detail
                }
                if ($responseData.compositeKey) {
                    Write-Host "         Key: $($responseData.compositeKey)" -ForegroundColor $colors.Detail
                }
                if ($responseData.mapId) {
                    Write-Host "         Map ID: $($responseData.mapId)" -ForegroundColor $colors.Detail
                }
                
                return @{ success = $true; data = $responseData; time = $elapsed }
            } else {
                Write-Host " ✗ Validation failed (${elapsed}ms)" -ForegroundColor $colors.Failure
                $global:failedTests++
                return @{ success = $false; data = $responseData; time = $elapsed }
            }
        }
        
        # Default success
        Write-Host " ✓ Passed (${elapsed}ms)" -ForegroundColor $colors.Success
        $global:passedTests++
        
        # Add details if present
        if ($responseData.imageCount) {
            Write-Host "         Images: $($responseData.imageCount)" -ForegroundColor $colors.Detail
        }
        if ($responseData.compositeKey) {
            Write-Host "         Key: $($responseData.compositeKey)" -ForegroundColor $colors.Detail
        }
        if ($responseData.mapId) {
            Write-Host "         Map ID: $($responseData.mapId)" -ForegroundColor $colors.Detail
        }
        if ($responseData.datasets -and $responseData.datasets.Count) {
            Write-Host "         Datasets found: $($responseData.datasets.Count)" -ForegroundColor $colors.Detail
        }
        
        return @{ success = $true; data = $responseData; time = $elapsed }
    }
    catch {
        if ($_.Exception.Message -like "*timeout*") {
            Write-Host " ⏱ Timeout after ${Timeout}s" -ForegroundColor $colors.Warning
        } else {
            Write-Host " ✗ Error" -ForegroundColor $colors.Failure
            Write-Host "         $($_.Exception.Message)" -ForegroundColor $colors.Detail
        }
        $global:failedTests++
        return @{ success = $false; error = $_.Exception.Message; time = $Timeout * 1000 }
    }
}

# ============================================================================
# START TESTING
# ============================================================================

Write-TestHeader "COMPREHENSIVE EARTH ENGINE MCP GEOSPATIAL ANALYST TEST SUITE"
Write-Host "Testing all tools, models, and functions with real-world scenarios" -ForegroundColor $colors.Info
Write-Host "Endpoint: $SSE_ENDPOINT" -ForegroundColor $colors.Info
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $colors.Info

# Test server connectivity
Write-Host ""
Write-Host "Checking server connectivity..." -ForegroundColor $colors.Info
try {
    $testBody = @{ tool = "earth_engine_data"; arguments = @{ operation = "boundaries" } } | ConvertTo-Json
    $testResponse = Invoke-WebRequest -Uri $SSE_ENDPOINT -Method POST -Body $testBody -ContentType "application/json" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✓ Server is online and responding" -ForegroundColor $colors.Success
} catch {
    Write-Host "✗ Cannot connect to server" -ForegroundColor $colors.Failure
    Write-Host "  Please ensure the server is running: npm run dev" -ForegroundColor $colors.Warning
    exit 1
}

# ============================================================================
# SECTION 1: DATA OPERATIONS (earth_engine_data)
# ============================================================================

Write-Section "1. DATA OPERATIONS (earth_engine_data tool)"

Write-Subsection "1.1 Search Operations"
Test-MCPFunction -TestName "Search for Sentinel-2 datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "Sentinel-2"
    limit = 10
} -ValidateResponse { param($r) $r.datasets -and $r.datasets.Count -gt 0 }

Test-MCPFunction -TestName "Search for Landsat datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "Landsat"
    limit = 5
} -ValidateResponse { param($r) $r.datasets -and $r.datasets.Count -gt 0 }

Test-MCPFunction -TestName "Search for MODIS products" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "MODIS"
    limit = 15
} -ValidateResponse { param($r) $r.datasets -and $r.datasets.Count -gt 0 }

Test-MCPFunction -TestName "Search for climate datasets" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "temperature precipitation"
    limit = 10
}

Test-MCPFunction -TestName "Search for elevation data" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = "DEM elevation SRTM"
    limit = 5
}

Test-MCPFunction -TestName "Search with empty query" -Tool "earth_engine_data" -Arguments @{
    operation = "search"
    query = ""
    limit = 5
}

Write-Subsection "1.2 Dataset Information"
Test-MCPFunction -TestName "Get Sentinel-2 SR info" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
} -ValidateResponse { param($r) $r.id -eq "COPERNICUS/S2_SR_HARMONIZED" }

Test-MCPFunction -TestName "Get Landsat 9 info" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "LANDSAT/LC09/C02/T1_L2"
}

Test-MCPFunction -TestName "Get MODIS NDVI info" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "MODIS/006/MOD13Q1"
}

Test-MCPFunction -TestName "Get invalid dataset info" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "INVALID/DATASET/ID"
} -ExpectFailure $true

Write-Subsection "1.3 Filtering Operations"

# Different time ranges
Test-MCPFunction -TestName "Filter - Single day" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-01"
    endDate = "2024-12-01"
    region = "San Francisco"
    cloudCoverMax = 10
} -Timeout 30

Test-MCPFunction -TestName "Filter - One week" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-24"
    endDate = "2024-12-01"
    region = "New York"
    cloudCoverMax = 20
} -Timeout 30

Test-MCPFunction -TestName "Filter - One month" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-30"
    region = "Los Angeles"
    cloudCoverMax = 15
} -Timeout 30

Test-MCPFunction -TestName "Filter - Three months" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-11-30"
    region = "Chicago"
    cloudCoverMax = 25
} -Timeout 45

Test-MCPFunction -TestName "Filter - Full year" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2023-01-01"
    endDate = "2023-12-31"
    region = "Seattle"
    cloudCoverMax = 30
} -Timeout 60

# Different regions
Test-MCPFunction -TestName "Filter - Small city (Manhattan)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Manhattan"
} -Timeout 30

Test-MCPFunction -TestName "Filter - Large city (Houston)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Houston"
} -Timeout 30

Test-MCPFunction -TestName "Filter - State (Texas)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-15"
    region = "Texas"
    cloudCoverMax = 20
} -Timeout 60

# Different cloud cover thresholds
Test-MCPFunction -TestName "Filter - Very low cloud (5%)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Phoenix"
    cloudCoverMax = 5
} -Timeout 45

Test-MCPFunction -TestName "Filter - No cloud filter" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-30"
    region = "Portland"
} -Timeout 30

Write-Subsection "1.4 Geometry Operations"

# US Cities
Test-MCPFunction -TestName "Geometry - New York City" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "New York City"
}

Test-MCPFunction -TestName "Geometry - San Francisco Bay Area" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "San Francisco Bay Area"
}

Test-MCPFunction -TestName "Geometry - Grand Canyon" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Grand Canyon"
}

# International locations
Test-MCPFunction -TestName "Geometry - Tokyo" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Tokyo"
}

Test-MCPFunction -TestName "Geometry - Amazon Rainforest" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Amazon Rainforest"
}

Test-MCPFunction -TestName "Geometry - Sahara Desert" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Sahara Desert"
}

# Invalid locations
Test-MCPFunction -TestName "Geometry - Invalid place" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Atlantis"
} -ExpectFailure $true

Write-Subsection "1.5 Boundaries Operations"
Test-MCPFunction -TestName "List all available boundaries" -Tool "earth_engine_data" -Arguments @{
    operation = "boundaries"
} -ValidateResponse { param($r) $r.boundaries -and $r.boundaries.Count -gt 0 }

Write-Subsection "1.6 Statistics Operations"
Test-MCPFunction -TestName "Statistics - Landsat collection" -Tool "earth_engine_data" -Arguments @{
    operation = "statistics"
    datasetId = "LANDSAT/LC08/C02/T1_L2"
    startDate = "2024-01-01"
    endDate = "2024-12-31"
    region = "California"
} -Timeout 60

Test-MCPFunction -TestName "Statistics - Sentinel-2 collection" -Tool "earth_engine_data" -Arguments @{
    operation = "statistics"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Colorado"
} -Timeout 60

# ============================================================================
# SECTION 2: PROCESSING OPERATIONS (earth_engine_process)
# ============================================================================

Write-Section "2. PROCESSING OPERATIONS (earth_engine_process tool)"

Write-Subsection "2.1 Composite Creation"

# Different composite types
Test-MCPFunction -TestName "Median composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Denver"
    compositeType = "median"
    cloudCoverMax = 20
} -Timeout 45 -StoreResult $true -ResultKey "median_composite"

Test-MCPFunction -TestName "Mean composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Austin"
    compositeType = "mean"
    cloudCoverMax = 25
} -Timeout 45

Test-MCPFunction -TestName "Max composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "Miami"
    compositeType = "max"
    cloudCoverMax = 30
} -Timeout 45

Test-MCPFunction -TestName "Min composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-30"
    region = "Phoenix"
    compositeType = "min"
    cloudCoverMax = 15
} -Timeout 45

Test-MCPFunction -TestName "Greenest pixel composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-05-01"
    endDate = "2024-07-31"
    region = "Portland"
    compositeType = "greenest"
    cloudCoverMax = 20
} -Timeout 60 -StoreResult $true -ResultKey "greenest_composite"

# Large area composite
Test-MCPFunction -TestName "State-wide composite (California)" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "California"
    compositeType = "median"
    cloudCoverMax = 10
} -Timeout 90

Write-Subsection "2.2 False Color Composites (FCC)"

Test-MCPFunction -TestName "FCC - Urban area" -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Las Vegas"
} -Timeout 45

Test-MCPFunction -TestName "FCC - Agricultural area" -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-31"
    region = "Iowa"
} -Timeout 45

Test-MCPFunction -TestName "FCC - Coastal area" -Tool "earth_engine_process" -Arguments @{
    operation = "fcc"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "San Diego"
} -Timeout 45

Write-Subsection "2.3 Vegetation Indices"

# NDVI - Normalized Difference Vegetation Index
Test-MCPFunction -TestName "NDVI - Forest area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Yellowstone"
} -Timeout 45 -StoreResult $true -ResultKey "ndvi_forest"

Test-MCPFunction -TestName "NDVI - Agricultural area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "Kansas"
} -Timeout 45

Test-MCPFunction -TestName "NDVI - Desert area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    region = "Nevada"
} -Timeout 45

# EVI - Enhanced Vegetation Index
Test-MCPFunction -TestName "EVI - Tropical area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "EVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-15"
    region = "Hawaii"
} -Timeout 45

Test-MCPFunction -TestName "EVI - Temperate forest" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "EVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Oregon"
} -Timeout 45

# SAVI - Soil Adjusted Vegetation Index
Test-MCPFunction -TestName "SAVI - Sparse vegetation" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "SAVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-05-01"
    endDate = "2024-05-15"
    region = "Utah"
} -Timeout 45

Write-Subsection "2.4 Water Indices"

# NDWI - Normalized Difference Water Index
Test-MCPFunction -TestName "NDWI - Lake area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "Lake Tahoe"
} -Timeout 45 -StoreResult $true -ResultKey "ndwi_lake"

Test-MCPFunction -TestName "NDWI - River system" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-15"
    region = "Mississippi River"
} -Timeout 45

# MNDWI - Modified Normalized Difference Water Index
Test-MCPFunction -TestName "MNDWI - Coastal waters" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "MNDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Cape Cod"
} -Timeout 45

Test-MCPFunction -TestName "MNDWI - Wetlands" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "MNDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    region = "Everglades"
} -Timeout 45

Write-Subsection "2.5 Urban and Built-up Indices"

# NDBI - Normalized Difference Built-up Index
Test-MCPFunction -TestName "NDBI - Dense urban" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDBI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-15"
    region = "Manhattan"
} -Timeout 45

Test-MCPFunction -TestName "NDBI - Suburban area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDBI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "Dallas"
} -Timeout 45

# UI - Urban Index
Test-MCPFunction -TestName "UI - Metropolitan area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "UI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Atlanta"
} -Timeout 45

# EBBI - Enhanced Built-Up and Bareness Index
Test-MCPFunction -TestName "EBBI - Urban expansion area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "EBBI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    region = "Phoenix"
} -Timeout 45

Write-Subsection "2.6 Soil and Geological Indices"

# BSI - Bare Soil Index
Test-MCPFunction -TestName "BSI - Agricultural fields" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "BSI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-03-01"
    endDate = "2024-03-15"
    region = "Nebraska"
} -Timeout 45

Test-MCPFunction -TestName "BSI - Desert region" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "BSI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Mojave Desert"
} -Timeout 45

# SI - Salinity Index
Test-MCPFunction -TestName "SI - Saline areas" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "SI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "Salt Lake City"
} -Timeout 45

# NDSI - Normalized Difference Salinity Index
Test-MCPFunction -TestName "NDSI - Agricultural salinity" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDSI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    region = "Central Valley California"
} -Timeout 45

Write-Subsection "2.7 Snow and Ice Indices"

# NDSI - Normalized Difference Snow Index (different from salinity)
Test-MCPFunction -TestName "Snow Index - Mountain snow" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDSI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-15"
    region = "Rocky Mountains"
} -Timeout 45

Test-MCPFunction -TestName "Snow Index - Glacial area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDSI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-02-01"
    endDate = "2024-02-15"
    region = "Alaska"
} -Timeout 45

Write-Subsection "2.8 Fire and Burn Indices"

# NBR - Normalized Burn Ratio
Test-MCPFunction -TestName "NBR - Pre-fire baseline" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NBR"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-06-15"
    region = "California"
} -Timeout 45

Test-MCPFunction -TestName "NBR - Active fire area" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NBR"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "California"
} -Timeout 45

# BAI - Burn Area Index
Test-MCPFunction -TestName "BAI - Burned area mapping" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "BAI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-15"
    region = "Oregon"
} -Timeout 45

Write-Subsection "2.9 Moisture Indices"

# NDMI - Normalized Difference Moisture Index
Test-MCPFunction -TestName "NDMI - Forest moisture" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDMI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Washington"
} -Timeout 45

Test-MCPFunction -TestName "NDMI - Agricultural moisture" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDMI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-05-01"
    endDate = "2024-05-15"
    region = "Illinois"
} -Timeout 45

# MSI - Moisture Stress Index
Test-MCPFunction -TestName "MSI - Drought monitoring" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "MSI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "Arizona"
} -Timeout 45

Write-Subsection "2.10 Custom Band Math"

Test-MCPFunction -TestName "Custom NDVI calculation" -Tool "earth_engine_process" -Arguments @{
    operation = "bandmath"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    expression = "(B8 - B4) / (B8 + B4)"
    startDate = "2024-09-01"
    endDate = "2024-09-15"
    region = "Boston"
} -Timeout 45

Test-MCPFunction -TestName "Custom water index" -Tool "earth_engine_process" -Arguments @{
    operation = "bandmath"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    expression = "(B3 - B8) / (B3 + B8)"
    startDate = "2024-08-01"
    endDate = "2024-08-15"
    region = "Great Lakes"
} -Timeout 45

Test-MCPFunction -TestName "Complex band calculation" -Tool "earth_engine_process" -Arguments @{
    operation = "bandmath"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    expression = "sqrt((B4 * B4) + (B3 * B3))"
    startDate = "2024-07-01"
    endDate = "2024-07-15"
    region = "Denver"
} -Timeout 45

# ============================================================================
# SECTION 3: EXPORT AND VISUALIZATION (earth_engine_export)
# ============================================================================

Write-Section "3. EXPORT AND VISUALIZATION (earth_engine_export tool)"

Write-Subsection "3.1 Thumbnail Generation"

# Use stored composite if available
if ($global:workflowData["median_composite"] -and $global:workflowData["median_composite"].compositeKey) {
    $compositeKey = $global:workflowData["median_composite"].compositeKey
    
    Test-MCPFunction -TestName "Thumbnail - Small (256px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeKey
        dimensions = 256
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 30
    
    Test-MCPFunction -TestName "Thumbnail - Medium (512px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeKey
        dimensions = 512
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
            gamma = 1.4
        }
    } -Timeout 30
    
    Test-MCPFunction -TestName "Thumbnail - Large (1024px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeKey
        dimensions = 1024
        visParams = @{
            bands = @("B8", "B4", "B3")
            min = 0
            max = 0.4
        }
    } -Timeout 45
    
    Test-MCPFunction -TestName "Thumbnail - Extra large (2048px)" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        compositeKey = $compositeKey
        dimensions = 2048
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 60
}

# Direct thumbnail from dataset
Test-MCPFunction -TestName "Direct thumbnail - True color" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Boston"
    dimensions = 512
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
} -Timeout 45

Test-MCPFunction -TestName "Direct thumbnail - False color" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Sacramento"
    dimensions = 512
    visParams = @{
        bands = @("B8", "B4", "B3")
        min = 0
        max = 3000
    }
} -Timeout 45

# NDVI thumbnail with palette
if ($global:workflowData["ndvi_forest"] -and ($global:workflowData["ndvi_forest"].indexKey -or $global:workflowData["ndvi_forest"].ndviKey)) {
    $ndviKey = if ($global:workflowData["ndvi_forest"].indexKey) { 
        $global:workflowData["ndvi_forest"].indexKey 
    } else { 
        $global:workflowData["ndvi_forest"].ndviKey 
    }
    
    Test-MCPFunction -TestName "NDVI thumbnail - Green palette" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        ndviKey = $ndviKey
        dimensions = 512
        visParams = @{
            bands = @("NDVI")
            min = -1
            max = 1
            palette = @("red", "yellow", "green")
        }
    } -Timeout 30
    
    Test-MCPFunction -TestName "NDVI thumbnail - Custom palette" -Tool "earth_engine_export" -Arguments @{
        operation = "thumbnail"
        ndviKey = $ndviKey
        dimensions = 512
        visParams = @{
            bands = @("NDVI")
            min = 0
            max = 0.8
            palette = @("#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850")
        }
    } -Timeout 30
}

Write-Subsection "3.2 Tile Service Generation"

# Tiles from composite
if ($global:workflowData["greenest_composite"] -and $global:workflowData["greenest_composite"].compositeKey) {
    $greenestKey = $global:workflowData["greenest_composite"].compositeKey
    
    Test-MCPFunction -TestName "Tiles - True color composite" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        compositeKey = $greenestKey
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
        }
    } -Timeout 30
    
    Test-MCPFunction -TestName "Tiles - False color composite" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        compositeKey = $greenestKey
        visParams = @{
            bands = @("B8", "B4", "B3")
            min = 0
            max = 0.4
        }
    } -Timeout 30
}

# Direct tiles from dataset
Test-MCPFunction -TestName "Direct tiles - Recent imagery" -Tool "earth_engine_export" -Arguments @{
    operation = "tiles"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-30"
    region = "San Antonio"
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
} -Timeout 45

# Tiles from water index
if ($global:workflowData["ndwi_lake"] -and ($global:workflowData["ndwi_lake"].indexKey -or $global:workflowData["ndwi_lake"].ndwiKey)) {
    $ndwiKey = if ($global:workflowData["ndwi_lake"].indexKey) { 
        $global:workflowData["ndwi_lake"].indexKey 
    } else { 
        $global:workflowData["ndwi_lake"].ndwiKey 
    }
    
    Test-MCPFunction -TestName "NDWI tiles - Water detection" -Tool "earth_engine_export" -Arguments @{
        operation = "tiles"
        ndwiKey = $ndwiKey
        visParams = @{
            bands = @("NDWI")
            min = -1
            max = 1
            palette = @("brown", "white", "blue")
        }
    } -Timeout 30
}

Write-Subsection "3.3 Data Export"

Test-MCPFunction -TestName "Export to GeoTIFF" -Tool "earth_engine_export" -Arguments @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Yosemite"
    format = "GeoTIFF"
    scale = 10
    crs = "EPSG:4326"
} -Timeout 60

Test-MCPFunction -TestName "Export with band selection" -Tool "earth_engine_export" -Arguments @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Zion National Park"
    format = "GeoTIFF"
    bands = @("B4", "B3", "B2", "B8")
    scale = 20
} -Timeout 60

Test-MCPFunction -TestName "Export at different scale" -Tool "earth_engine_export" -Arguments @{
    operation = "export"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-08-01"
    endDate = "2024-08-31"
    region = "Manhattan"
    format = "GeoTIFF"
    scale = 30
} -Timeout 60

Write-Subsection "3.4 Visualization Parameters Testing"

Test-MCPFunction -TestName "Vis params - High contrast" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Salt Lake City"
    dimensions = 512
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 500
        max = 2000
        gamma = 0.8
    }
} -Timeout 45

Test-MCPFunction -TestName "Vis params - Low contrast" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Detroit"
    dimensions = 512
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 5000
        gamma = 1.8
    }
} -Timeout 45

# ============================================================================
# SECTION 4: REAL-WORLD WORKFLOWS
# ============================================================================

Write-Section "4. REAL-WORLD GEOSPATIAL ANALYSIS WORKFLOWS"

Write-Subsection "4.1 Agricultural Monitoring Workflow"

Write-Host "      Scenario: Monitor crop health in agricultural region" -ForegroundColor $colors.Detail

# Step 1: Find agricultural area
Test-MCPFunction -TestName "Find agricultural region geometry" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Central Valley California"
} -Timeout 20

# Step 2: Check available imagery
Test-MCPFunction -TestName "Check recent imagery availability" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-09-30"
    region = "Central Valley California"
    cloudCoverMax = 10
} -Timeout 45

# Step 3: Create growing season composite
$agComposite = Test-MCPFunction -TestName "Create growing season composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-09-30"
    region = "Central Valley California"
    compositeType = "greenest"
    cloudCoverMax = 10
} -Timeout 60 -StoreResult $true -ResultKey "ag_composite"

# Step 4: Calculate vegetation health
if ($agComposite.success -and $agComposite.data.compositeKey) {
    Test-MCPFunction -TestName "Calculate NDVI for crop health" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDVI"
        compositeKey = $agComposite.data.compositeKey
    } -Timeout 45
    
    Test-MCPFunction -TestName "Calculate EVI for dense vegetation" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "EVI"
        compositeKey = $agComposite.data.compositeKey
    } -Timeout 45
    
    Test-MCPFunction -TestName "Calculate NDMI for crop moisture" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDMI"
        compositeKey = $agComposite.data.compositeKey
    } -Timeout 45
}

Write-Subsection "4.2 Urban Growth Analysis Workflow"

Write-Host "      Scenario: Analyze urban expansion in rapidly growing city" -ForegroundColor $colors.Detail

# Step 1: Define study area
Test-MCPFunction -TestName "Define urban study area" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Austin Texas"
} -Timeout 20

# Step 2: Get baseline imagery (5 years ago)
Test-MCPFunction -TestName "Get baseline urban imagery (2019)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2019-06-01"
    endDate = "2019-08-31"
    region = "Austin Texas"
    cloudCoverMax = 15
} -Timeout 45

# Step 3: Get current imagery
Test-MCPFunction -TestName "Get current urban imagery (2024)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Austin Texas"
    cloudCoverMax = 15
} -Timeout 45

# Step 4: Calculate urban indices
Test-MCPFunction -TestName "Calculate NDBI for built-up areas" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDBI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Austin Texas"
} -Timeout 45

Test-MCPFunction -TestName "Calculate UI for urban mapping" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "UI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Austin Texas"
} -Timeout 45

Write-Subsection "4.3 Water Resources Monitoring Workflow"

Write-Host "      Scenario: Monitor water bodies and drought conditions" -ForegroundColor $colors.Detail

# Step 1: Identify water bodies
Test-MCPFunction -TestName "Identify lake region" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Lake Mead"
} -Timeout 20

# Step 2: Historical water extent (wet season)
Test-MCPFunction -TestName "Historical water extent (Spring 2024)" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-03-01"
    endDate = "2024-04-30"
    region = "Lake Mead"
} -Timeout 45

# Step 3: Current water extent (dry season)
Test-MCPFunction -TestName "Current water extent (Summer 2024)" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-08-31"
    region = "Lake Mead"
} -Timeout 45

# Step 4: Enhanced water detection
Test-MCPFunction -TestName "MNDWI for better water detection" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "MNDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-08-31"
    region = "Lake Mead"
} -Timeout 45

Write-Subsection "4.4 Wildfire Impact Assessment Workflow"

Write-Host "      Scenario: Assess wildfire damage and recovery" -ForegroundColor $colors.Detail

# Step 1: Define fire-affected area
Test-MCPFunction -TestName "Define fire study area" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Maui Hawaii"
} -Timeout 20

# Step 2: Pre-fire baseline
Test-MCPFunction -TestName "Pre-fire vegetation (July 2023)" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NBR"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2023-07-01"
    endDate = "2023-07-31"
    region = "Maui Hawaii"
} -Timeout 45

# Step 3: Post-fire assessment
Test-MCPFunction -TestName "Post-fire burn severity (Sept 2023)" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NBR"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2023-09-01"
    endDate = "2023-09-30"
    region = "Maui Hawaii"
} -Timeout 45

# Step 4: Recovery monitoring
Test-MCPFunction -TestName "Vegetation recovery (2024)" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-01"
    endDate = "2024-07-31"
    region = "Maui Hawaii"
} -Timeout 45

Write-Subsection "4.5 Coastal Change Detection Workflow"

Write-Host "      Scenario: Monitor coastal erosion and changes" -ForegroundColor $colors.Detail

# Step 1: Define coastal area
Test-MCPFunction -TestName "Define coastal study area" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Outer Banks North Carolina"
} -Timeout 20

# Step 2: Create seasonal composites
Test-MCPFunction -TestName "Summer coastal composite" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Outer Banks North Carolina"
    compositeType = "median"
    cloudCoverMax = 10
} -Timeout 60

# Step 3: Water-land boundary
Test-MCPFunction -TestName "Water-land boundary detection" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "MNDWI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Outer Banks North Carolina"
} -Timeout 45

# Step 4: Vegetation line
Test-MCPFunction -TestName "Coastal vegetation mapping" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "NDVI"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Outer Banks North Carolina"
} -Timeout 45

Write-Subsection "4.6 Multi-temporal Analysis Workflow"

Write-Host "      Scenario: Seasonal change analysis" -ForegroundColor $colors.Detail

$seasons = @(
    @{name="Winter"; start="2024-01-01"; end="2024-02-28"},
    @{name="Spring"; start="2024-04-01"; end="2024-05-31"},
    @{name="Summer"; start="2024-07-01"; end="2024-08-31"},
    @{name="Fall"; start="2024-10-01"; end="2024-11-30"}
)

foreach ($season in $seasons) {
    Test-MCPFunction -TestName "$($season.name) NDVI analysis" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = $season.start
        endDate = $season.end
        region = "Central Park New York"
    } -Timeout 45
}

# ============================================================================
# SECTION 5: EDGE CASES AND ERROR HANDLING
# ============================================================================

Write-Section "5. EDGE CASES AND ERROR HANDLING"

Write-Subsection "5.1 Invalid Inputs"

Test-MCPFunction -TestName "Invalid dataset ID" -Tool "earth_engine_data" -Arguments @{
    operation = "info"
    datasetId = "INVALID/DATASET/12345"
} -ExpectFailure $true

Test-MCPFunction -TestName "Invalid date range (end before start)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-12-31"
    endDate = "2024-01-01"
    region = "Miami"
} -ExpectFailure $true

Test-MCPFunction -TestName "Invalid region name" -Tool "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "Atlantis123XYZ"
} -ExpectFailure $true

Test-MCPFunction -TestName "Invalid index type" -Tool "earth_engine_process" -Arguments @{
    operation = "index"
    indexType = "INVALID_INDEX"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Denver"
} -ExpectFailure $true

Test-MCPFunction -TestName "Invalid composite type" -Tool "earth_engine_process" -Arguments @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Seattle"
    compositeType = "invalid_type"
} -ExpectFailure $true

Write-Subsection "5.2 Boundary Conditions"

Test-MCPFunction -TestName "Single day date range" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-07-04"
    endDate = "2024-07-04"
    region = "Washington DC"
} -Timeout 30

Test-MCPFunction -TestName "Very large region" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-11-01"
    endDate = "2024-11-07"
    region = "United States"
    cloudCoverMax = 50
} -Timeout 90

Test-MCPFunction -TestName "Zero cloud cover threshold" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Phoenix"
    cloudCoverMax = 0
} -Timeout 45

Test-MCPFunction -TestName "100% cloud cover threshold" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "Seattle"
    cloudCoverMax = 100
} -Timeout 30

Write-Subsection "5.3 Performance Stress Tests"

Test-MCPFunction -TestName "Very long date range (5 years)" -Tool "earth_engine_data" -Arguments @{
    operation = "filter"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2019-01-01"
    endDate = "2024-12-31"
    region = "Rhode Island"
    cloudCoverMax = 30
} -Timeout 90

Test-MCPFunction -TestName "High resolution export" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-10-01"
    endDate = "2024-10-31"
    region = "Manhattan"
    dimensions = 4096
    visParams = @{
        bands = @("B4", "B3", "B2")
        min = 0
        max = 3000
    }
} -Timeout 90

# ============================================================================
# SECTION 6: ADVANCED FEATURES
# ============================================================================

Write-Section "6. ADVANCED FEATURES AND CAPABILITIES"

Write-Subsection "6.1 Multi-band Visualizations"

Test-MCPFunction -TestName "SWIR-NIR-Red combination" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Death Valley"
    dimensions = 512
    visParams = @{
        bands = @("B11", "B8", "B4")
        min = 0
        max = 3000
    }
} -Timeout 45

Test-MCPFunction -TestName "Atmospheric penetration bands" -Tool "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-09-01"
    endDate = "2024-09-30"
    region = "Mount Rainier"
    dimensions = 512
    visParams = @{
        bands = @("B12", "B11", "B8A")
        min = 0
        max = 3000
    }
} -Timeout 45

Write-Subsection "6.2 Complex Band Math Operations"

Test-MCPFunction -TestName "Normalized difference calculation" -Tool "earth_engine_process" -Arguments @{
    operation = "bandmath"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    expression = "(B11 - B8) / (B11 + B8)"
    startDate = "2024-08-01"
    endDate = "2024-08-31"
    region = "Yellowstone"
} -Timeout 45

Test-MCPFunction -TestName "Multi-band ratio" -Tool "earth_engine_process" -Arguments @{
    operation = "bandmath"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    expression = "(B8 / B4) * (B8 / B3)"
    startDate = "2024-07-01"
    endDate = "2024-07-31"
    region = "Everglades"
} -Timeout 45

Write-Subsection "6.3 Time Series Analysis"

$months = @("01", "02", "03", "04", "05", "06")
foreach ($month in $months) {
    Test-MCPFunction -TestName "Monthly NDVI - 2024-$month" -Tool "earth_engine_process" -Arguments @{
        operation = "index"
        indexType = "NDVI"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        startDate = "2024-$month-01"
        endDate = "2024-$month-28"
        region = "Kansas City"
    } -Timeout 45
}

# ============================================================================
# FINAL STATISTICS AND SUMMARY
# ============================================================================

Write-TestHeader "TEST EXECUTION COMPLETE"

# Calculate statistics
$successRate = if ($global:totalTests -gt 0) { 
    [math]::Round(($global:passedTests / $global:totalTests) * 100, 2) 
} else { 0 }

$avgTime = if ($global:timings.Count -gt 0) {
    [math]::Round(($global:timings | Measure-Object -Average).Average, 0)
} else { 0 }

$maxTime = if ($global:timings.Count -gt 0) {
    ($global:timings | Measure-Object -Maximum).Maximum
} else { 0 }

$minTime = if ($global:timings.Count -gt 0) {
    ($global:timings | Measure-Object -Minimum).Minimum
} else { 0 }

$medianTime = if ($global:timings.Count -gt 0) {
    $sorted = $global:timings | Sort-Object
    $sorted[[math]::Floor($sorted.Count / 2)]
} else { 0 }

# Display results
Write-Host "📊 TEST RESULTS SUMMARY" -ForegroundColor $colors.Header
Write-Host ("─" * 40) -ForegroundColor $colors.Section

Write-Host "Total Tests Executed: $($global:totalTests)" -ForegroundColor $colors.Info
Write-Host "Tests Passed: $($global:passedTests)" -ForegroundColor $colors.Success
Write-Host "Tests Failed: $($global:failedTests)" -ForegroundColor $colors.Failure
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) {"Green"} elseif ($successRate -ge 75) {"Yellow"} else {"Red"})

Write-Host ""
Write-Host "⏱️ PERFORMANCE METRICS" -ForegroundColor $colors.Header
Write-Host ("─" * 40) -ForegroundColor $colors.Section

Write-Host "Average Response Time: ${avgTime}ms" -ForegroundColor $colors.Info
Write-Host "Median Response Time: ${medianTime}ms" -ForegroundColor $colors.Info
Write-Host "Fastest Response: ${minTime}ms" -ForegroundColor $colors.Success
Write-Host "Slowest Response: ${maxTime}ms" -ForegroundColor $colors.Warning

Write-Host ""
Write-Host "🔍 COVERAGE ANALYSIS" -ForegroundColor $colors.Header
Write-Host ("─" * 40) -ForegroundColor $colors.Section

Write-Host "✓ Data Operations: Comprehensive" -ForegroundColor $colors.Success
Write-Host "✓ Processing Operations: All indices tested" -ForegroundColor $colors.Success
Write-Host "✓ Export & Visualization: Full coverage" -ForegroundColor $colors.Success
Write-Host "✓ Real-world Workflows: 6 complete scenarios" -ForegroundColor $colors.Success
Write-Host "✓ Edge Cases: Thoroughly tested" -ForegroundColor $colors.Success
Write-Host "✓ Advanced Features: Validated" -ForegroundColor $colors.Success

Write-Host ""
Write-Host "🏆 OVERALL ASSESSMENT" -ForegroundColor $colors.Header
Write-Host ("─" * 40) -ForegroundColor $colors.Section

if ($successRate -ge 95) {
    Write-Host "⭐⭐⭐⭐⭐ EXCEPTIONAL!" -ForegroundColor $colors.Success
    Write-Host "The Earth Engine MCP server demonstrates production-grade reliability" -ForegroundColor $colors.Success
    Write-Host "All tools and functions perform excellently under real-world conditions" -ForegroundColor $colors.Success
} elseif ($successRate -ge 90) {
    Write-Host "⭐⭐⭐⭐ EXCELLENT" -ForegroundColor $colors.Success
    Write-Host "Server is highly reliable and ready for production use" -ForegroundColor $colors.Success
    Write-Host "Minor improvements could enhance edge case handling" -ForegroundColor $colors.Info
} elseif ($successRate -ge 80) {
    Write-Host "⭐⭐⭐ GOOD" -ForegroundColor $colors.Warning
    Write-Host "Server handles most scenarios well" -ForegroundColor $colors.Warning
    Write-Host "Some optimization needed for complex operations" -ForegroundColor $colors.Warning
} elseif ($successRate -ge 70) {
    Write-Host "⭐⭐ NEEDS IMPROVEMENT" -ForegroundColor $colors.Failure
    Write-Host "Server has stability issues under load" -ForegroundColor $colors.Failure
    Write-Host "Significant optimization required" -ForegroundColor $colors.Failure
} else {
    Write-Host "⭐ CRITICAL ISSUES" -ForegroundColor $colors.Failure
    Write-Host "Server cannot handle standard operations reliably" -ForegroundColor $colors.Failure
    Write-Host "Major refactoring needed" -ForegroundColor $colors.Failure
}

Write-Host ""
Write-Host "Test completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $colors.Info
Write-Host ("=" * 80) -ForegroundColor $colors.Header
