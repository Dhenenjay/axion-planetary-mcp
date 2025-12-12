# Test Classification for Smaller Regions
Write-Host "`nTesting Agricultural Classification for Counties and Small Regions" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

$results = @()

# Test smaller, specific regions
$testRegions = @(
    @{Name="Polk County, Iowa"; Num=1},
    @{Name="Story County, Iowa"; Num=2},
    @{Name="Fresno County, California"; Num=3},
    @{Name="Champaign County, Illinois"; Num=4},
    @{Name="McLean County, Illinois"; Num=5},
    @{Name="Sedgwick County, Kansas"; Num=6},
    @{Name="Lubbock County, Texas"; Num=7},
    @{Name="Cass County, North Dakota"; Num=8},
    @{Name="Lancaster County, Nebraska"; Num=9},
    @{Name="Dane County, Wisconsin"; Num=10}
)

foreach ($region in $testRegions) {
    Write-Host "`nTest $($region.Num): $($region.Name)" -ForegroundColor Cyan
    
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
                    region = $region.Name
                    startDate = "2024-06-01"
                    endDate = "2024-09-30"
                    scale = 30
                }
            } | ConvertTo-Json)
        
        if ($modelResponse.modelKey) {
            Write-Host "  Model created: $($modelResponse.modelKey)" -ForegroundColor Gray
            
            # Generate thumbnail with smaller size for counties
            $thumbResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
                -Method Post `
                -ContentType "application/json" `
                -Body (@{
                    tool = "earth_engine_export"
                    arguments = @{
                        operation = "thumbnail"
                        input = $modelResponse.modelKey
                        dimensions = 256  # Smaller for counties
                        region = $region.Name
                        visParams = @{
                            bands = @("crop_health")
                            min = 0
                            max = 0.8
                            palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                        }
                    }
                } | ConvertTo-Json)
            
            if ($thumbResponse.url) {
                Write-Host "  SUCCESS! Thumbnail generated" -ForegroundColor Green
                Write-Host "  URL: $($thumbResponse.url)" -ForegroundColor Gray
                
                $results += @{
                    TestNum = $region.Num
                    Region = $region.Name
                    ModelKey = $modelResponse.modelKey
                    URL = $thumbResponse.url
                    Status = "Success"
                }
            } else {
                Write-Host "  Thumbnail generation failed" -ForegroundColor Red
                $results += @{
                    TestNum = $region.Num
                    Region = $region.Name
                    ModelKey = $modelResponse.modelKey
                    URL = "Failed"
                    Status = "Thumbnail Failed"
                }
            }
        } else {
            Write-Host "  Model creation failed" -ForegroundColor Red
            $results += @{
                TestNum = $region.Num
                Region = $region.Name
                ModelKey = "N/A"
                URL = "N/A"
                Status = "Model Failed"
            }
        }
    } catch {
        Write-Host "  Error: $_" -ForegroundColor Red
        $results += @{
            TestNum = $region.Num
            Region = $region.Name
            ModelKey = "N/A"
            URL = "N/A"
            Status = "Error"
        }
    }
}

# Display summary
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "TEST SUMMARY" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

$successCount = ($results | Where-Object { $_.Status -eq "Success" }).Count
Write-Host "`nSuccessful: $successCount / 10" -ForegroundColor Cyan

# Save results
$reportContent = "Agricultural Classification Test Results - Counties`n"
$reportContent += "Generated: $(Get-Date)`n"
$reportContent += "==========================================`n`n"

foreach ($result in $results) {
    if ($result.Status -eq "Success") {
        $reportContent += "Test $($result.TestNum): $($result.Region)`n"
        $reportContent += "Status: SUCCESS`n"
        $reportContent += "Model Key: $($result.ModelKey)`n"
        $reportContent += "Thumbnail URL: $($result.URL)`n`n"
    }
}

$reportContent | Out-File -FilePath "county-test-results.txt"

# Create HTML report
$htmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <title>County Agricultural Classification Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #2e7d32; }
        .container { max-width: 1200px; margin: 0 auto; }
        .test { margin: 15px 0; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test.success { border-left: 4px solid #4caf50; }
        .test.failed { border-left: 4px solid #f44336; }
        .test h3 { margin-top: 0; color: #1976d2; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.success { background: #4caf50; color: white; }
        .status.failed { background: #f44336; color: white; }
        a { color: #1976d2; }
        .thumbnail { max-width: 400px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
        .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <h1>County-Level Agricultural Classification Results</h1>
        <div class="summary">
            <h2>Summary</h2>
            <p><strong>Date:</strong> $(Get-Date)</p>
            <p><strong>Successful Tests:</strong> $successCount / 10</p>
        </div>
"@

foreach ($result in $results) {
    $statusClass = if ($result.Status -eq "Success") { "success" } else { "failed" }
    $htmlContent += @"
        <div class="test $statusClass">
            <h3>Test $($result.TestNum): $($result.Region)</h3>
            <p><span class="status $statusClass">$($result.Status)</span></p>
"@
    
    if ($result.Status -eq "Success") {
        $htmlContent += @"
            <p><strong>Model Key:</strong> <code>$($result.ModelKey)</code></p>
            <p><a href="$($result.URL)" target="_blank">View Full Size Thumbnail</a></p>
            <img class="thumbnail" src="$($result.URL)" alt="$($result.Region) crop health visualization">
"@
    }
    
    $htmlContent += @"
        </div>
"@
}

$htmlContent += @"
    </div>
</body>
</html>
"@

$htmlContent | Out-File -FilePath "county-results.html"

Write-Host "`nReports saved:" -ForegroundColor Green
Write-Host "  - county-test-results.txt" -ForegroundColor Gray
Write-Host "  - county-results.html" -ForegroundColor Gray

# Display successful URLs
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "SUCCESSFUL THUMBNAIL URLS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

$successfulTests = $results | Where-Object { $_.Status -eq "Success" }
foreach ($test in $successfulTests) {
    Write-Host "`nTest $($test.TestNum): $($test.Region)" -ForegroundColor Cyan
    Write-Host $test.URL -ForegroundColor Gray
}

Write-Host "`nTest complete!" -ForegroundColor Green