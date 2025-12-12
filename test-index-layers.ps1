#!/usr/bin/env pwsh

Write-Host "`n=== Testing Multi-Layer Index Map Fix ===" -ForegroundColor Cyan

# Test parameters
$testBody = @{
    tool = "earth_engine_map"
    arguments = @{
        operation = "create"
        region = "Los Angeles"
        center = @(-118.2437, 34.0522)
        zoom = 10
        basemap = "satellite"
        layers = @(
            @{
                name = "NDVI (Vegetation)"
                input = "ndvi_test_key_123"
                visParams = @{
                    min = -1
                    max = 1
                    palette = @("#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850")
                }
            },
            @{
                name = "NDWI (Water)"  
                input = "ndwi_test_key_456"
                visParams = @{
                    min = -1
                    max = 1
                    palette = @("#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30")
                }
            },
            @{
                name = "NDBI (Urban/Built-up)"
                input = "ndbi_test_key_789"
                visParams = @{
                    min = -1
                    max = 1
                    palette = @("#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fdbf6f", "#fd8d3c", "#e31a1c", "#800026")
                }
            }
        )
    }
}

Write-Host "Test configuration:" -ForegroundColor Yellow
Write-Host "  - 3 index layers (NDVI, NDWI, NDBI)"
Write-Host "  - Each with its own input key"
Write-Host "  - Bands should be auto-detected as ['NDVI'], ['NDWI'], ['NDBI']"
Write-Host ""

$jsonBody = $testBody | ConvertTo-Json -Depth 10 -Compress

Write-Host "Expected behavior:" -ForegroundColor Green
Write-Host "  1. System should detect index inputs from key names"
Write-Host "  2. Bands should be set to index names, not RGB bands"
Write-Host "  3. Visualization should use index parameters (-1 to 1 range)"
Write-Host ""

Write-Host "Sending test request..." -ForegroundColor Yellow

try {
    # Note: This will fail since the test keys don't exist, but we can check the logs
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" -Method Post -Body $jsonBody -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
    
    Write-Host "`nResponse received. Check server logs for:" -ForegroundColor Cyan
    Write-Host "  - '[Map] Auto-detected bands for layer' messages"
    Write-Host "  - Bands should show ['NDVI'], ['NDWI'], ['NDBI']"
    Write-Host "  - NOT ['B4', 'B3', 'B2']"
} catch {
    Write-Host "`nExpected failure (test keys don't exist)." -ForegroundColor Yellow
    Write-Host "Check server logs to verify band detection is working correctly." -ForegroundColor Cyan
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "If the fix is working, server logs should show:" -ForegroundColor Green
Write-Host "  [Map] Auto-detected bands for layer NDVI (Vegetation): NDVI"
Write-Host "  [Map] Auto-detected bands for layer NDWI (Water): NDWI"
Write-Host "  [Map] Auto-detected bands for layer NDBI (Urban/Built-up): NDBI"