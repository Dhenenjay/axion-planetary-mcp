#!/usr/bin/env pwsh

Write-Host "`n🔧 Testing Fixed Composite Store" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create a composite
Write-Host "Step 1: Creating composite..." -ForegroundColor Yellow

$compositeData = @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2025-01-01"
    endDate = "2025-01-31"
    region = "Los Angeles"
    compositeType = "median"
} | ConvertTo-Json -Depth 3

$compositeResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" `
    -Method POST `
    -ContentType "application/json" `
    -Body @"
{
    "tool": "earth_engine_process",
    "arguments": $compositeData
}
"@ -ErrorAction Stop

$compositeResult = $compositeResponse.Content | ConvertFrom-Json

if ($compositeResult.success) {
    Write-Host "✅ Composite created: $($compositeResult.compositeKey)" -ForegroundColor Green
    $key = $compositeResult.compositeKey
    
    # Step 2: Generate thumbnail
    Write-Host ""
    Write-Host "Step 2: Generating thumbnail..." -ForegroundColor Yellow
    
    $thumbnailData = @{
        operation = "thumbnail"
        input = $key
        dimensions = 512
        visParams = @{
            bands = @("B4", "B3", "B2")
            min = 0
            max = 0.3
            gamma = 1.4
        }
    } | ConvertTo-Json -Depth 3
    
    $thumbnailResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" `
        -Method POST `
        -ContentType "application/json" `
        -Body @"
{
    "tool": "earth_engine_export",
    "arguments": $thumbnailData
}
"@ -ErrorAction Stop
    
    $thumbnailResult = $thumbnailResponse.Content | ConvertFrom-Json
    
    if ($thumbnailResult.success) {
        Write-Host "✅ Thumbnail generated!" -ForegroundColor Green
        Write-Host "   URL: $($thumbnailResult.url)" -ForegroundColor Cyan
        
        # Step 3: Create interactive map
        Write-Host ""
        Write-Host "Step 3: Creating interactive map..." -ForegroundColor Yellow
        
        $mapData = @{
            operation = "create"
            input = $key
            region = "Los Angeles"
            zoom = 10
            basemap = "satellite"
        } | ConvertTo-Json -Depth 3
        
        $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" `
            -Method POST `
            -ContentType "application/json" `
            -Body @"
{
    "tool": "earth_engine_map",
    "arguments": $mapData
}
"@ -ErrorAction Stop
        
        $mapResult = $mapResponse.Content | ConvertFrom-Json
        
        if ($mapResult.success) {
            Write-Host "✅ Interactive map created!" -ForegroundColor Green
            Write-Host "   Map URL: $($mapResult.url)" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "📊 Test Results:" -ForegroundColor Green
            Write-Host "   ✓ Composite persistence: WORKING" -ForegroundColor Green
            Write-Host "   ✓ Thumbnail generation: WORKING" -ForegroundColor Green
            Write-Host "   ✓ Interactive map: WORKING" -ForegroundColor Green
        } else {
            Write-Host "❌ Map creation failed: $($mapResult.error)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Thumbnail failed: $($thumbnailResult.error)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Composite creation failed: $($compositeResult.error)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Yellow