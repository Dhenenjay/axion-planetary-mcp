# Professional Geospatial Analyst Test Suite
# Testing real-world Earth observation workflows

$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  PROFESSIONAL GEOSPATIAL TEST SUITE" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$workflows = @()
$passed = 0
$failed = 0

function Test-Workflow {
    param($Name, $Steps)
    
    Write-Host "`n$Name" -ForegroundColor Cyan
    Write-Host "=" * $Name.Length -ForegroundColor Cyan
    
    $workflowPassed = $true
    $results = @()
    
    foreach ($step in $Steps) {
        Write-Host "  $($step.Name)..." -NoNewline
        
        $body = @{
            method = "tools/call"
            params = @{
                name = $step.Tool
                arguments = $step.Args
            }
        } | ConvertTo-Json -Depth 10
        
        try {
            $r = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30 -ErrorAction Stop
            if ($r.result) {
                Write-Host " ✓" -ForegroundColor Green
                $results += $r.result
            } else {
                Write-Host " ✗" -ForegroundColor Red
                $workflowPassed = $false
            }
        } catch {
            Write-Host " ✗ ERROR" -ForegroundColor Red
            $workflowPassed = $false
        }
    }
    
    if ($workflowPassed) {
        Write-Host "  Workflow: COMPLETE" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  Workflow: FAILED" -ForegroundColor Red
        $script:failed++
    }
    
    $script:workflows += @{
        Name = $Name
        Success = $workflowPassed
        Results = $results
    }
    
    return $workflowPassed
}

# ===========================
# 1. CROP HEALTH MONITORING
# ===========================
$cropWorkflow = @(
    @{
        Name = "1. Find agricultural area"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "Ludhiana"
        }
    },
    @{
        Name = "2. Search Sentinel-2 data"
        Tool = "earth_engine_data"
        Args = @{
            operation = "search"
            query = "Sentinel-2"
            maxResults = 3
        }
    },
    @{
        Name = "3. Calculate NDVI for crop health"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDVI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-06-01"
            endDate = "2024-06-30"
            geometry = @{
                type = "Point"
                coordinates = @(75.8573, 30.9010)
            }
        }
    },
    @{
        Name = "4. Create crop composite"
        Tool = "earth_engine_process"
        Args = @{
            operation = "composite"
            compositeType = "median"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-06-01"
            endDate = "2024-06-30"
            geometry = @{
                type = "Point"
                coordinates = @(75.8573, 30.9010)
            }
        }
    }
)

Test-Workflow "CROP HEALTH MONITORING (Punjab, India)" $cropWorkflow

# ===========================
# 2. FLOOD DETECTION
# ===========================
$floodWorkflow = @(
    @{
        Name = "1. Get flood-prone area"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "Mumbai"
        }
    },
    @{
        Name = "2. Calculate NDWI for water extent"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDWI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-07-01"
            endDate = "2024-07-31"
            geometry = @{
                type = "Point"
                coordinates = @(72.8777, 19.0760)
            }
        }
    },
    @{
        Name = "3. Calculate MNDWI for better water detection"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "MNDWI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-07-01"
            endDate = "2024-07-31"
            geometry = @{
                type = "Point"
                coordinates = @(72.8777, 19.0760)
            }
        }
    },
    @{
        Name = "4. Generate map tiles for visualization"
        Tool = "earth_engine_export"
        Args = @{
            operation = "tiles"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-07-01"
            endDate = "2024-07-31"
            geometry = @{
                type = "Point"
                coordinates = @(72.8777, 19.0760)
            }
        }
    }
)

Test-Workflow "FLOOD DETECTION (Mumbai Monsoon)" $floodWorkflow

# ===========================
# 3. URBAN HEAT ISLAND
# ===========================
$urbanWorkflow = @(
    @{
        Name = "1. Get urban boundary"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "New York"
        }
    },
    @{
        Name = "2. Calculate NDBI for built-up area"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDBI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-06-01"
            endDate = "2024-06-30"
            geometry = @{
                type = "Point"
                coordinates = @(-74.0060, 40.7128)
            }
        }
    },
    @{
        Name = "3. Get terrain elevation"
        Tool = "earth_engine_process"
        Args = @{
            operation = "terrain"
            terrainType = "elevation"
            region = @{
                type = "Point"
                coordinates = @(-74.0060, 40.7128)
            }
        }
    },
    @{
        Name = "4. Create urban composite"
        Tool = "earth_engine_process"
        Args = @{
            operation = "composite"
            compositeType = "median"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-06-01"
            endDate = "2024-06-30"
            geometry = @{
                type = "Point"
                coordinates = @(-74.0060, 40.7128)
            }
        }
    }
)

Test-Workflow "URBAN HEAT ISLAND ANALYSIS (New York)" $urbanWorkflow

# ===========================
# 4. DEFORESTATION MONITORING
# ===========================
$forestWorkflow = @(
    @{
        Name = "1. Search Landsat data"
        Tool = "earth_engine_data"
        Args = @{
            operation = "search"
            query = "Landsat"
            maxResults = 3
        }
    },
    @{
        Name = "2. Calculate NDVI for forest cover"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDVI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-60.0, -3.0)  # Amazon
            }
        }
    },
    @{
        Name = "3. Calculate EVI for vegetation dynamics"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "EVI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-60.0, -3.0)
            }
        }
    },
    @{
        Name = "4. Apply cloud mask"
        Tool = "earth_engine_process"
        Args = @{
            operation = "mask"
            maskType = "clouds"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-60.0, -3.0)
            }
        }
    }
)

Test-Workflow "DEFORESTATION MONITORING (Amazon)" $forestWorkflow

# ===========================
# 5. COASTAL EROSION
# ===========================
$coastalWorkflow = @(
    @{
        Name = "1. Get coastal area"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "San Francisco"
        }
    },
    @{
        Name = "2. Calculate NDWI for water-land boundary"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDWI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-122.5, 37.7)
            }
        }
    },
    @{
        Name = "3. Get terrain slope"
        Tool = "earth_engine_process"
        Args = @{
            operation = "terrain"
            terrainType = "slope"
            region = @{
                type = "Point"
                coordinates = @(-122.5, 37.7)
            }
        }
    },
    @{
        Name = "4. Create median composite"
        Tool = "earth_engine_process"
        Args = @{
            operation = "composite"
            compositeType = "median"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-122.5, 37.7)
            }
        }
    }
)

Test-Workflow "COASTAL EROSION MONITORING (California)" $coastalWorkflow

# ===========================
# 6. DROUGHT ASSESSMENT
# ===========================
$droughtWorkflow = @(
    @{
        Name = "1. Search MODIS data"
        Tool = "earth_engine_data"
        Args = @{
            operation = "search"
            query = "MODIS"
            maxResults = 3
        }
    },
    @{
        Name = "2. Calculate NDVI for vegetation stress"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDVI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-07-01"
            endDate = "2024-07-31"
            geometry = @{
                type = "Point"
                coordinates = @(-120.0, 38.0)  # Central California
            }
        }
    },
    @{
        Name = "3. Calculate SAVI for soil-adjusted vegetation"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "SAVI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-07-01"
            endDate = "2024-07-31"
            geometry = @{
                type = "Point"
                coordinates = @(-120.0, 38.0)
            }
        }
    },
    @{
        Name = "4. Generate visualization tiles"
        Tool = "earth_engine_export"
        Args = @{
            operation = "tiles"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-07-01"
            endDate = "2024-07-31"
            geometry = @{
                type = "Point"
                coordinates = @(-120.0, 38.0)
            }
        }
    }
)

Test-Workflow "DROUGHT ASSESSMENT (California)" $droughtWorkflow

# ===========================
# 7. WILDFIRE RISK
# ===========================
$fireWorkflow = @(
    @{
        Name = "1. Search fire-related datasets"
        Tool = "earth_engine_data"
        Args = @{
            operation = "search"
            query = "fire"
            maxResults = 2
        }
    },
    @{
        Name = "2. Calculate BSI for burn severity"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "BSI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-08-01"
            endDate = "2024-08-31"
            geometry = @{
                type = "Point"
                coordinates = @(-120.5, 39.0)  # Northern California
            }
        }
    },
    @{
        Name = "3. Get terrain aspect for fire spread"
        Tool = "earth_engine_process"
        Args = @{
            operation = "terrain"
            terrainType = "aspect"
            region = @{
                type = "Point"
                coordinates = @(-120.5, 39.0)
            }
        }
    },
    @{
        Name = "4. Create max composite for hot spots"
        Tool = "earth_engine_process"
        Args = @{
            operation = "composite"
            compositeType = "max"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-08-01"
            endDate = "2024-08-31"
            geometry = @{
                type = "Point"
                coordinates = @(-120.5, 39.0)
            }
        }
    }
)

Test-Workflow "WILDFIRE RISK ASSESSMENT (California)" $fireWorkflow

# ===========================
# 8. SNOW COVER MONITORING
# ===========================
$snowWorkflow = @(
    @{
        Name = "1. Get mountain area"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            coordinates = @(-106.4, 39.6, 20000)  # Colorado Rockies
        }
    },
    @{
        Name = "2. Calculate NDSI for snow detection"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDSI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-106.4, 39.6)
            }
        }
    },
    @{
        Name = "3. Get elevation data"
        Tool = "earth_engine_process"
        Args = @{
            operation = "terrain"
            terrainType = "elevation"
            region = @{
                type = "Point"
                coordinates = @(-106.4, 39.6)
            }
        }
    },
    @{
        Name = "4. Generate hillshade"
        Tool = "earth_engine_process"
        Args = @{
            operation = "terrain"
            terrainType = "hillshade"
            azimuth = 315
            elevation = 45
            region = @{
                type = "Point"
                coordinates = @(-106.4, 39.6)
            }
        }
    }
)

Test-Workflow "SNOW COVER MONITORING (Rocky Mountains)" $snowWorkflow

# ===========================
# SUMMARY REPORT
# ===========================
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "        GEOSPATIAL ANALYSIS SUMMARY" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$total = $passed + $failed
$rate = if($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "Workflows Tested: $total" -ForegroundColor White
Write-Host "Successful:       $passed" -ForegroundColor Green
Write-Host "Failed:           $failed" -ForegroundColor $(if($failed -gt 0){"Red"}else{"Green"})
Write-Host "Success Rate:     $rate%" -ForegroundColor $(if($rate -eq 100){"Green"}elseif($rate -ge 80){"Yellow"}else{"Red"})

Write-Host ""
Write-Host "Workflow Results:" -ForegroundColor Cyan
foreach ($w in $workflows) {
    $status = if($w.Success) { "✓" } else { "✗" }
    $color = if($w.Success) { "Green" } else { "Red" }
    Write-Host "  $status $($w.Name)" -ForegroundColor $color
}

Write-Host ""
if ($rate -eq 100) {
    Write-Host "EXCELLENT! All professional workflows passed." -ForegroundColor Green
    Write-Host "The system is ready for production geospatial analysis." -ForegroundColor Green
} elseif ($rate -ge 75) {
    Write-Host "GOOD! Most workflows are operational." -ForegroundColor Yellow
    Write-Host "Minor issues to address for full capability." -ForegroundColor Yellow
} else {
    Write-Host "NEEDS IMPROVEMENT. Critical workflows are failing." -ForegroundColor Red
    Write-Host "System requires fixes before professional use." -ForegroundColor Red
}

Write-Host ""
Write-Host "Tested at: $(Get-Date)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Magenta
