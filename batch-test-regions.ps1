# Batch Agricultural Classification Tests
Write-Host "`nRunning Multiple Agricultural Classification Tests" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

$urls = @()
$testNum = 1

# Test regions - mix of states and counties for variety
$regions = @(
    "Nebraska",
    "Polk County, Iowa",
    "Story County, Iowa", 
    "Fresno County, California",
    "McLean County, Illinois",
    "Lancaster County, Nebraska",
    "Johnson County, Iowa",
    "Dane County, Wisconsin",
    "Champaign County, Illinois",
    "Jefferson County, Colorado"
)

foreach ($region in $regions) {
    Write-Host "`nTest $testNum`: $region" -ForegroundColor Yellow
    
    try {
        # Create model
        $modelResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{
                tool = "earth_engine_process"
                arguments = @{
                    operation = "model"
                    modelType = "agriculture"
                    region = $region
                    startDate = "2024-06-01"
                    endDate = "2024-09-30"
                    scale = 30
                }
            } | ConvertTo-Json)
        
        if ($modelResponse.modelKey) {
            Write-Host "  Model created: $($modelResponse.modelKey)" -ForegroundColor Gray
            
            # Generate thumbnail
            $thumbResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
                -Method Post `
                -ContentType "application/json" `
                -Body (@{
                    tool = "earth_engine_export"
                    arguments = @{
                        operation = "thumbnail"
                        input = $modelResponse.modelKey
                        dimensions = 512
                        region = $region
                        visParams = @{
                            bands = @("crop_health")
                            min = 0
                            max = 0.8
                            palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                        }
                    }
                } | ConvertTo-Json -Depth 10)
            
            if ($thumbResponse.url) {
                Write-Host "  ✓ Success!" -ForegroundColor Green
                Write-Host "  URL: $($thumbResponse.url)" -ForegroundColor Cyan
                
                $urls += @{
                    Test = $testNum
                    Region = $region
                    URL = $thumbResponse.url
                }
            } else {
                Write-Host "  ✗ Thumbnail failed" -ForegroundColor Red
            }
        } else {
            Write-Host "  ✗ Model failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ✗ Error: $_" -ForegroundColor Red
    }
    
    $testNum++
    
    # Stop at 10 tests
    if ($testNum -gt 10) { break }
}

# Display summary
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Successful: $($urls.Count) / $($testNum - 1)" -ForegroundColor Cyan

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "THUMBNAIL URLS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

foreach ($result in $urls) {
    Write-Host "`nTest $($result.Test): $($result.Region)" -ForegroundColor Yellow
    Write-Host $result.URL -ForegroundColor Gray
}

# Save to file
$output = "Agricultural Classification Thumbnail URLs`n"
$output += "Generated: $(Get-Date)`n"
$output += "==========================================`n`n"

foreach ($result in $urls) {
    $output += "Test $($result.Test): $($result.Region)`n"
    $output += "$($result.URL)`n`n"
}

$output | Out-File -FilePath "thumbnail-urls.txt"
Write-Host "`nURLs saved to thumbnail-urls.txt" -ForegroundColor Green