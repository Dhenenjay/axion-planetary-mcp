# Iowa Crop Classification with Ground Truth
Write-Host "Iowa Crop Classification using Ground Truth Data" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Step 1: Run the agricultural model with classification
Write-Host "`nStep 1: Running agricultural classification model..." -ForegroundColor Yellow

try {
    $classificationResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
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
                classification = $true
                groundTruth = $true
            }
        } | ConvertTo-Json -Depth 10)
    
    Write-Host "Classification model created!" -ForegroundColor Green
    Write-Host "Model Key: $($classificationResponse.modelKey)" -ForegroundColor Cyan
    
    # Display classification info if available
    if ($classificationResponse.classification) {
        Write-Host "`nClassification Details:" -ForegroundColor Yellow
        Write-Host "- Classes: $($classificationResponse.classification.classes)" -ForegroundColor Gray
        Write-Host "- Training Points: $($classificationResponse.classification.trainingPoints)" -ForegroundColor Gray
    }
    
    # Step 2: Generate classification thumbnail
    if ($classificationResponse.modelKey) {
        Write-Host "`nStep 2: Generating classification map thumbnail..." -ForegroundColor Yellow
        
        # First try with classification bands
        $thumbResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $classificationResponse.modelKey
                    dimensions = 768
                    region = "Iowa"
                    visParams = @{
                        bands = @("crop_classification", "classification", "crop_health")
                        min = 0
                        max = 6
                        palette = @(
                            "#FFFFFF",  # 0: No data/Other
                            "#FFD700",  # 1: Corn - Gold
                            "#32CD32",  # 2: Soybean - Green
                            "#DEB887",  # 3: Wheat - Tan
                            "#9370DB",  # 4: Alfalfa - Purple
                            "#90EE90",  # 5: Pasture - Light Green
                            "#A0522D"   # 6: Fallow - Brown
                        )
                    }
                }
            } | ConvertTo-Json -Depth 10)
        
        if ($thumbResponse.url) {
            Write-Host "Classification map generated!" -ForegroundColor Green
            Write-Host "Thumbnail URL: $($thumbResponse.url)" -ForegroundColor Cyan
            
            # Save URL
            $thumbResponse.url | Out-File -FilePath "iowa-classification-map-url.txt"
            Write-Host "URL saved to iowa-classification-map-url.txt" -ForegroundColor Gray
            
            # Open in browser
            Write-Host "Opening classification map in browser..." -ForegroundColor Yellow
            Start-Process $thumbResponse.url
        } else {
            Write-Host "Classification thumbnail generation issue, trying alternate visualization..." -ForegroundColor Yellow
            
            # Try with crop health visualization as fallback
            $thumbResponse2 = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
                -Method Post `
                -ContentType "application/json" `
                -Body (@{
                    tool = "earth_engine_export"
                    arguments = @{
                        operation = "thumbnail"
                        input = $classificationResponse.modelKey
                        dimensions = 768
                        region = "Iowa"
                        visParams = @{
                            bands = @("crop_health")
                            min = 0
                            max = 0.8
                            palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                        }
                    }
                } | ConvertTo-Json -Depth 10)
            
            if ($thumbResponse2.url) {
                Write-Host "Crop health visualization generated!" -ForegroundColor Green
                Write-Host "URL: $($thumbResponse2.url)" -ForegroundColor Cyan
                Start-Process $thumbResponse2.url
            }
        }
    }
    
    # Display legend
    Write-Host "`nCrop Classification Legend:" -ForegroundColor Yellow
    Write-Host "===========================" -ForegroundColor Yellow
    Write-Host "[1] Corn     - Gold" -ForegroundColor Yellow
    Write-Host "[2] Soybean  - Green" -ForegroundColor Green
    Write-Host "[3] Wheat    - Tan" -ForegroundColor DarkYellow
    Write-Host "[4] Alfalfa  - Purple" -ForegroundColor Magenta
    Write-Host "[5] Pasture  - Light Green" -ForegroundColor DarkGreen
    Write-Host "[6] Fallow   - Brown" -ForegroundColor DarkRed
    
    Write-Host "`nClassification complete!" -ForegroundColor Green
    
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest finished!" -ForegroundColor Green