# Simple SSE Endpoint Test
$baseUrl = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "EARTH ENGINE MCP SSE ENDPOINT TEST" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{
        Name = "Search datasets"
        Tool = "earth_engine_data"
        Args = @{
            operation = "search"
            query = "sentinel"
            limit = 3
        }
    },
    @{
        Name = "Get San Francisco geometry"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "San Francisco"
        }
    },
    @{
        Name = "Check authentication"
        Tool = "earth_engine_system"
        Args = @{
            operation = "auth"
        }
    },
    @{
        Name = "Calculate NDVI"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDVI"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-06-01"
            endDate = "2024-06-30"
            region = "San Francisco"
        }
    },
    @{
        Name = "Generate thumbnail"
        Tool = "earth_engine_export"
        Args = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2024-06-01"
            endDate = "2024-06-30"
            region = "San Francisco"
            dimensions = 256
            visParams = @{
                bands = @("B4", "B3", "B2")
                min = 0
                max = 3000
            }
        }
    },
    @{
        Name = "Find Sydney"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "Sydney"
        }
    },
    @{
        Name = "Find Tokyo"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "Tokyo"
        }
    },
    @{
        Name = "Find London"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "London"
        }
    }
)

$passed = 0
$failed = 0

foreach ($test in $tests) {
    Write-Host "Testing: $($test.Name)" -ForegroundColor Yellow
    
    try {
        $body = @{
            tool = $test.Tool
            arguments = $test.Args
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json"
        
        if ($response.error) {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            $failed++
        } else {
            Write-Host "  PASSED" -ForegroundColor Green
            $passed++
        }
    }
    catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "RESULTS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Total: $($tests.Count)"
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

$rate = [math]::Round(($passed / $tests.Count) * 100, 1)
Write-Host "Success Rate: $rate%"

if ($passed -eq $tests.Count) {
    Write-Host ""
    Write-Host "All tests passed! Server is fully operational!" -ForegroundColor Green
} elseif ($rate -ge 80) {
    Write-Host ""
    Write-Host "Server is operational with minor issues." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Server needs attention." -ForegroundColor Red
}
