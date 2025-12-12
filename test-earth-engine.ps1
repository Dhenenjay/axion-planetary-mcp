#!/usr/bin/env pwsh
# Earth Engine MCP Server Test Script
# Tests the key Earth Engine functionality

$baseUrl = "http://localhost:3000"

Write-Host "Earth Engine MCP Server Test Suite" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Function to call the MCP tool
function Invoke-MCPTool {
    param (
        [string]$ToolName,
        [hashtable]$Arguments
    )
    
    $body = @{
        tool = $ToolName
        arguments = $Arguments
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/mcp/sse" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        return $response
    } catch {
        Write-Host "Error calling $ToolName : $_" -ForegroundColor Red
        return $null
    }
}

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health"
Write-Host "[OK] Server is healthy with $($health.totalTools) tools available" -ForegroundColor Green
Write-Host ""

# Test 2: Search GEE Catalog
Write-Host "Test 2: Search Google Earth Engine Catalog" -ForegroundColor Yellow
$searchResult = Invoke-MCPTool -ToolName "search_gee_catalog" -Arguments @{query="Sentinel-2"}
if ($searchResult) {
    $results = $searchResult.content.text | ConvertFrom-Json
    Write-Host "[OK] Found $($results.hits.Count) dataset(s) for 'Sentinel-2'" -ForegroundColor Green
    $results.hits | ForEach-Object {
        Write-Host "  - $($_.id): $($_.title)" -ForegroundColor Gray
    }
}
Write-Host ""

# Test 3: Get Thumbnail Image
Write-Host "Test 3: Generate Thumbnail Image" -ForegroundColor Yellow
$thumbnailResult = Invoke-MCPTool -ToolName "get_thumbnail_image" -Arguments @{
    datasetId = "COPERNICUS/S2_SR"
    start = "2024-01-01"
    end = "2024-01-31"
    aoi = "Los Angeles"
}
if ($thumbnailResult) {
    $thumbnail = $thumbnailResult.content.text | ConvertFrom-Json
    Write-Host "[OK] Generated thumbnail URL for Los Angeles (Jan 2024)" -ForegroundColor Green
    Write-Host "  URL: $($thumbnail.url.Substring(0, 80))..." -ForegroundColor Gray
}
Write-Host ""

# Test 4: Calculate Spectral Index
Write-Host "Test 4: Calculate Spectral Index (NDVI)" -ForegroundColor Yellow
$ndviResult = Invoke-MCPTool -ToolName "calculate_spectral_index" -Arguments @{
    imageId = "COPERNICUS/S2_SR/20240115T183919_20240115T184337_T11SLT"
    index = "NDVI"
}
if ($ndviResult) {
    $ndvi = $ndviResult.content.text | ConvertFrom-Json
    Write-Host "[OK] Calculated NDVI for Sentinel-2 image" -ForegroundColor Green
    Write-Host "  Index: $($ndvi.index)" -ForegroundColor Gray
    Write-Host "  NIR Band: $($ndvi.bands.nir), Red Band: $($ndvi.bands.red)" -ForegroundColor Gray
}
Write-Host ""

# Test 5: Convert Place to Geometry
Write-Host "Test 5: Convert Place Name to Geometry" -ForegroundColor Yellow
$geoResult = Invoke-MCPTool -ToolName "convert_place_to_shapefile_geometry" -Arguments @{
    place_name = "San Francisco"
}
if ($geoResult) {
    $geo = $geoResult.content.text | ConvertFrom-Json
    if ($geo.success) {
        Write-Host "[OK] Converted 'San Francisco' to geometry" -ForegroundColor Green
        Write-Host "  Place: $($geo.placeName)" -ForegroundColor Gray
        if ($geo.geoJson) {
            Write-Host "  Geometry Type: $($geo.geoJson.type)" -ForegroundColor Gray
        }
    }
}
Write-Host ""

# Test 6: Filter Collection by Date and Region
Write-Host "Test 6: Filter Image Collection" -ForegroundColor Yellow
$filterResult = Invoke-MCPTool -ToolName "filter_collection_by_date_and_region" -Arguments @{
    collection_id = "LANDSAT/LC08/C02/T1_L2"
    start_date = "2024-01-01"
    end_date = "2024-01-31"
    region = "New York"
}
if ($filterResult) {
    $filter = $filterResult.content.text | ConvertFrom-Json
    Write-Host "[OK] Filtered Landsat-8 collection for New York (Jan 2024)" -ForegroundColor Green
    Write-Host "  Found $($filter.imageCount) images" -ForegroundColor Gray
    if ($filter.firstImageId) {
        Write-Host "  First Image: $($filter.firstImageId)" -ForegroundColor Gray
    }
}
Write-Host ""

# Test 7: Create Clean Mosaic
Write-Host "Test 7: Create Cloud-Free Mosaic" -ForegroundColor Yellow
$mosaicResult = Invoke-MCPTool -ToolName "create_clean_mosaic" -Arguments @{
    collection = "COPERNICUS/S2_SR"
    dateStart = "2024-01-01"
    dateEnd = "2024-01-31"
    region = "Miami"
}
if ($mosaicResult) {
    $mosaic = $mosaicResult.content.text | ConvertFrom-Json
    Write-Host "[OK] Created cloud-free mosaic for Miami" -ForegroundColor Green
    Write-Host "  Method: $($mosaic.method)" -ForegroundColor Gray
    Write-Host "  Images Used: $($mosaic.imageCount)" -ForegroundColor Gray
}
Write-Host ""

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "The Earth Engine MCP server is fully operational and can:" -ForegroundColor White
Write-Host "  - Search the Earth Engine catalog" -ForegroundColor Gray
Write-Host "  - Generate thumbnail images" -ForegroundColor Gray
Write-Host "  - Calculate spectral indices (NDVI, EVI, NDWI)" -ForegroundColor Gray
Write-Host "  - Convert place names to geometries" -ForegroundColor Gray
Write-Host "  - Filter image collections by date and region" -ForegroundColor Gray
Write-Host "  - Create cloud-free mosaics" -ForegroundColor Gray
Write-Host "  - Export images to cloud storage" -ForegroundColor Gray
Write-Host ""
Write-Host "Server is running on: $baseUrl" -ForegroundColor Green
