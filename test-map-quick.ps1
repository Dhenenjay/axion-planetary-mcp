#!/usr/bin/env pwsh

Write-Host "`n🗺️  Quick Map Test" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""

# Test with your existing composite
$compositeKey = "composite_1757676397291"

Write-Host "Testing with existing composite: $compositeKey" -ForegroundColor Yellow
Write-Host ""

$mapData = @{
    operation = "create"
    input = $compositeKey
    region = "Los Angeles"
    bands = @("B4", "B3", "B2")
    visParams = @{
        min = 0
        max = 0.3
        gamma = 1.4
    }
    zoom = 10
    basemap = "satellite"
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" `
        -Method POST `
        -ContentType "application/json" `
        -Body @"
{
    "tool": "earth_engine_map",
    "arguments": $mapData
}
"@ -ErrorAction Stop

    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✅ SUCCESS! Map created!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Map Details:" -ForegroundColor Cyan
        Write-Host "  Map ID: $($result.mapId)" -ForegroundColor White
        Write-Host "  URL: " -NoNewline -ForegroundColor White
        Write-Host "$($result.url)" -ForegroundColor Green
        Write-Host "  Region: $($result.region)" -ForegroundColor White
        Write-Host ""
        Write-Host "📌 Open this URL in your browser to view the interactive map:" -ForegroundColor Yellow
        Write-Host "   $($result.url)" -ForegroundColor Cyan
        Write-Host ""
        
        # Try to open in browser
        $openBrowser = Read-Host "Would you like to open the map in your browser? (y/n)"
        if ($openBrowser -eq 'y') {
            Start-Process $result.url
        }
    } else {
        Write-Host "❌ Failed to create map" -ForegroundColor Red
        Write-Host "Error: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Request failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure the Next.js server is running on port 3000" -ForegroundColor Yellow
}