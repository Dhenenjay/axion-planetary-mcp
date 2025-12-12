# Simple Iowa Crop Classification Test
# This script uses the built-in agricultural model which won't timeout

Write-Host "Iowa Crop Classification - Simple Test" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# Step 1: Use the agricultural model (it already has classification built-in)
Write-Host "`nStep 1: Running agricultural model for Iowa..." -ForegroundColor Yellow

try {
    $modelResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Iowa"
                startDate = "2024-04-01"
                endDate = "2024-10-31"
                cropType = "general"
                scale = 30
                analysisType = "classification"
            }
        } | ConvertTo-Json -Depth 10)
    
    Write-Host "Model created successfully!" -ForegroundColor Green
    Write-Host "Model Key: $($modelResponse.modelKey)" -ForegroundColor Cyan
    
    # Step 2: Generate thumbnail
    if ($modelResponse.modelKey) {
        Write-Host "`nStep 2: Generating thumbnail..." -ForegroundColor Yellow
        
        $thumbResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $modelResponse.modelKey
                    dimensions = 512
                    region = "Iowa"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            } | ConvertTo-Json -Depth 10)
        
        if ($thumbResponse.url) {
            Write-Host "Thumbnail URL: $($thumbResponse.url)" -ForegroundColor Green
            Start-Process $thumbResponse.url
            Write-Host "Opening in browser..." -ForegroundColor Cyan
        } else {
            Write-Host "Thumbnail generation failed" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`nTest complete!" -ForegroundColor Green