# Working Multi-Region Classification Tests
Write-Host "`nMulti-Region Agricultural Classification with Ground Truth" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

$results = @()

# Test 1: Small region in California (Fresno County)
Write-Host "`nTest 1: Fresno County, California" -ForegroundColor Yellow
Write-Host "Crops: Almonds, Grapes, Cotton" -ForegroundColor Gray

try {
    $ca = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Fresno County, California"
                startDate = "2024-03-01"
                endDate = "2024-10-31"
                scale = 30
            }
        })
    
    if ($ca.modelKey) {
        Write-Host "  Model: $($ca.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $ca.modelKey
                    dimensions = 512
                    region = "Fresno County, California"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("#8B4513", "#9370DB", "#FFFFFF", "#90EE90", "#FFD700")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=1; Region="Fresno County, CA"; URL=$thumb.url; Crops="Almonds,Grapes,Cotton"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 2: Small region in Kansas (Sedgwick County)
Write-Host "`nTest 2: Sedgwick County, Kansas" -ForegroundColor Yellow
Write-Host "Crops: Winter Wheat, Corn, Sorghum" -ForegroundColor Gray

try {
    $ks = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Sedgwick County, Kansas"
                startDate = "2024-04-01"
                endDate = "2024-09-30"
                scale = 30
            }
        })
    
    if ($ks.modelKey) {
        Write-Host "  Model: $($ks.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $ks.modelKey
                    dimensions = 512
                    region = "Sedgwick County, Kansas"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("#DEB887", "#FFD700", "#8B4513", "#32CD32", "#FFA500")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=2; Region="Sedgwick County, KS"; URL=$thumb.url; Crops="Wheat,Corn,Sorghum"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 3: Illinois (Champaign County)
Write-Host "`nTest 3: Champaign County, Illinois" -ForegroundColor Yellow
Write-Host "Crops: Corn, Soybean" -ForegroundColor Gray

try {
    $il = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Champaign County, Illinois"
                startDate = "2024-04-15"
                endDate = "2024-10-15"
                scale = 30
            }
        })
    
    if ($il.modelKey) {
        Write-Host "  Model: $($il.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $il.modelKey
                    dimensions = 512
                    region = "Champaign County, Illinois"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("#FFD700", "#32CD32", "#DEB887", "#90EE90", "#8B4513")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=3; Region="Champaign County, IL"; URL=$thumb.url; Crops="Corn,Soybean"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 4: Texas (Lubbock County) - smaller region
Write-Host "`nTest 4: Lubbock County, Texas" -ForegroundColor Yellow
Write-Host "Crops: Cotton, Wheat, Sorghum" -ForegroundColor Gray

try {
    $tx = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Lubbock County, Texas"
                startDate = "2024-03-15"
                endDate = "2024-10-31"
                scale = 30
            }
        })
    
    if ($tx.modelKey) {
        Write-Host "  Model: $($tx.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $tx.modelKey
                    dimensions = 512
                    region = "Lubbock County, Texas"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("brown", "tan", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=4; Region="Lubbock County, TX"; URL=$thumb.url; Crops="Cotton,Wheat,Sorghum"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 5: North Dakota (Cass County) - smaller region
Write-Host "`nTest 5: Cass County, North Dakota" -ForegroundColor Yellow
Write-Host "Crops: Spring Wheat, Canola, Sugarbeet" -ForegroundColor Gray

try {
    $nd = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Cass County, North Dakota"
                startDate = "2024-05-01"
                endDate = "2024-09-30"
                scale = 30
            }
        })
    
    if ($nd.modelKey) {
        Write-Host "  Model: $($nd.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $nd.modelKey
                    dimensions = 512
                    region = "Cass County, North Dakota"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=5; Region="Cass County, ND"; URL=$thumb.url; Crops="Wheat,Canola,Sugarbeet"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 6: Nebraska (Lancaster County)
Write-Host "`nTest 6: Lancaster County, Nebraska" -ForegroundColor Yellow
Write-Host "Crops: Corn, Soybean, Wheat" -ForegroundColor Gray

try {
    $ne = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Lancaster County, Nebraska"
                startDate = "2024-04-01"
                endDate = "2024-10-31"
                scale = 30
            }
        })
    
    if ($ne.modelKey) {
        Write-Host "  Model: $($ne.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $ne.modelKey
                    dimensions = 512
                    region = "Lancaster County, Nebraska"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=6; Region="Lancaster County, NE"; URL=$thumb.url; Crops="Corn,Soybean,Wheat"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 7: Wisconsin (Dane County)
Write-Host "`nTest 7: Dane County, Wisconsin" -ForegroundColor Yellow
Write-Host "Crops: Corn, Soybean, Alfalfa" -ForegroundColor Gray

try {
    $wi = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Dane County, Wisconsin"
                startDate = "2024-04-15"
                endDate = "2024-10-15"
                scale = 30
            }
        })
    
    if ($wi.modelKey) {
        Write-Host "  Model: $($wi.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $wi.modelKey
                    dimensions = 512
                    region = "Dane County, Wisconsin"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=7; Region="Dane County, WI"; URL=$thumb.url; Crops="Corn,Soybean,Alfalfa"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 8: Minnesota (Blue Earth County)
Write-Host "`nTest 8: Blue Earth County, Minnesota" -ForegroundColor Yellow
Write-Host "Crops: Corn, Soybean" -ForegroundColor Gray

try {
    $mn = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Blue Earth County, Minnesota"
                startDate = "2024-04-15"
                endDate = "2024-10-15"
                scale = 30
            }
        })
    
    if ($mn.modelKey) {
        Write-Host "  Model: $($mn.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $mn.modelKey
                    dimensions = 512
                    region = "Blue Earth County, Minnesota"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=8; Region="Blue Earth County, MN"; URL=$thumb.url; Crops="Corn,Soybean"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 9: Indiana (Tippecanoe County)
Write-Host "`nTest 9: Tippecanoe County, Indiana" -ForegroundColor Yellow
Write-Host "Crops: Corn, Soybean" -ForegroundColor Gray

try {
    $in = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Tippecanoe County, Indiana"
                startDate = "2024-04-01"
                endDate = "2024-10-31"
                scale = 30
            }
        })
    
    if ($in.modelKey) {
        Write-Host "  Model: $($in.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $in.modelKey
                    dimensions = 512
                    region = "Tippecanoe County, Indiana"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=9; Region="Tippecanoe County, IN"; URL=$thumb.url; Crops="Corn,Soybean"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 10: Colorado (Weld County)
Write-Host "`nTest 10: Weld County, Colorado" -ForegroundColor Yellow
Write-Host "Crops: Corn, Wheat, Sugar Beets" -ForegroundColor Gray

try {
    $co = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Weld County, Colorado"
                startDate = "2024-04-01"
                endDate = "2024-10-31"
                scale = 30
            }
        })
    
    if ($co.modelKey) {
        Write-Host "  Model: $($co.modelKey)" -ForegroundColor Gray
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $co.modelKey
                    dimensions = 512
                    region = "Weld County, Colorado"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  SUCCESS! URL: $($thumb.url)" -ForegroundColor Green
            $results += @{Test=10; Region="Weld County, CO"; URL=$thumb.url; Crops="Corn,Wheat,Sugar Beets"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Display all results
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "MULTI-REGION CLASSIFICATION RESULTS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Successful: $($results.Count) / 10" -ForegroundColor Cyan

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "VISUALIZATION URLS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

foreach ($result in $results) {
    Write-Host "`nTest $($result.Test): $($result.Region)" -ForegroundColor Yellow
    Write-Host "Crops: $($result.Crops)" -ForegroundColor Gray
    Write-Host "URL: $($result.URL)" -ForegroundColor Cyan
}

# Save comprehensive report
$report = @"
Multi-Region Agricultural Classification Results
Generated: $(Get-Date)
==============================================

SUMMARY: $($results.Count) successful classifications out of 10 regions tested

DETAILED RESULTS:
"@

foreach ($result in $results) {
    $report += @"

Test $($result.Test): $($result.Region)
Crops Analyzed: $($result.Crops)
Visualization URL: $($result.URL)
"@
}

$report | Out-File -FilePath "multi-region-results-final.txt"
Write-Host "`nResults saved to multi-region-results-final.txt" -ForegroundColor Green