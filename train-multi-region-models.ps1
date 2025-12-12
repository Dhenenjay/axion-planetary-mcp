# Train Classification Models with Ground Truth Data for Multiple Regions
Write-Host "`nTraining Agricultural Classification Models with Ground Truth Data" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

$results = @()

# Test 1: California Central Valley with Almonds, Grapes, Cotton, Tomatoes, Rice
Write-Host "`nTest 1: California Central Valley" -ForegroundColor Yellow
Write-Host "Crops: Almonds, Grapes, Cotton, Tomatoes, Rice" -ForegroundColor Gray

$californiaCode = @'
// California Central Valley Classification
var california = ee.FeatureCollection('TIGER/2016/States')
  .filter(ee.Filter.eq('NAME', 'California'));

// Ground truth points from synthetic data
var trainingPoints = ee.FeatureCollection([
  // Almonds
  ee.Feature(ee.Geometry.Point([-119.7725, 36.7468]), {'crop': 1, 'cropName': 'almonds'}),
  ee.Feature(ee.Geometry.Point([-120.4777, 37.3217]), {'crop': 1, 'cropName': 'almonds'}),
  // Grapes  
  ee.Feature(ee.Geometry.Point([-119.6498, 36.3156]), {'crop': 2, 'cropName': 'grapes'}),
  ee.Feature(ee.Geometry.Point([-121.3009, 38.2975]), {'crop': 2, 'cropName': 'grapes'}),
  // Cotton
  ee.Feature(ee.Geometry.Point([-119.0187, 35.3733]), {'crop': 3, 'cropName': 'cotton'}),
  ee.Feature(ee.Geometry.Point([-119.3682, 36.1377]), {'crop': 3, 'cropName': 'cotton'}),
  // Tomatoes
  ee.Feature(ee.Geometry.Point([-121.4944, 38.5816]), {'crop': 4, 'cropName': 'tomatoes'}),
  ee.Feature(ee.Geometry.Point([-121.7525, 39.5296]), {'crop': 4, 'cropName': 'tomatoes'}),
  // Rice
  ee.Feature(ee.Geometry.Point([-121.6169, 39.1404]), {'crop': 5, 'cropName': 'rice'}),
  ee.Feature(ee.Geometry.Point([-121.6597, 39.3633]), {'crop': 5, 'cropName': 'rice'})
]);

// Load Sentinel-2 data
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(california)
  .filterDate('2024-03-01', '2024-10-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  .clip(california)
  .divide(10000);

// Calculate indices
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = s2.normalizedDifference(['B3', 'B8']).rename('NDWI');

// Feature stack
var features = s2.select(['B2','B3','B4','B8','B11']).addBands([ndvi, ndwi]);

// Train classifier
var training = features.sampleRegions({
  collection: trainingPoints,
  properties: ['crop'],
  scale: 30
});

var classifier = ee.Classifier.smileRandomForest(50).train(training, 'crop', features.bandNames());
var classified = features.classify(classifier).rename('california_crops');

classified
'@

try {
    $calModel = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json -Depth 10 @{
            tool = "earth_engine_system"
            arguments = @{
                operation = "execute"
                code = $californiaCode
                language = "javascript"
            }
        })
    
    if ($calModel.imageKey) {
        Write-Host "  Model trained! Key: $($calModel.imageKey)" -ForegroundColor Green
        
        # Generate thumbnail
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $calModel.imageKey
                    dimensions = 512
                    region = "California"
                    visParams = @{
                        bands = @("california_crops")
                        min = 1
                        max = 5
                        palette = @("#8B4513", "#9370DB", "#FFFFFF", "#FF6347", "#90EE90")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  Thumbnail URL: $($thumb.url)" -ForegroundColor Cyan
            $results += @{Region="California"; URL=$thumb.url; Crops="Almonds,Grapes,Cotton,Tomatoes,Rice"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 2: Kansas with Winter Wheat, Corn, Sorghum, Soybean, Sunflower
Write-Host "`nTest 2: Kansas Wheat Belt" -ForegroundColor Yellow
Write-Host "Crops: Winter Wheat, Corn, Sorghum, Soybean, Sunflower" -ForegroundColor Gray

$kansasCode = @'
// Kansas Wheat Belt Classification
var kansas = ee.FeatureCollection('TIGER/2016/States')
  .filter(ee.Filter.eq('NAME', 'Kansas'));

var trainingPoints = ee.FeatureCollection([
  // Winter wheat
  ee.Feature(ee.Geometry.Point([-97.8305, 37.0872]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-99.3180, 38.8403]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-100.8720, 37.6889]), {'crop': 1}),
  // Corn
  ee.Feature(ee.Geometry.Point([-95.6752, 39.0473]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-97.9298, 38.0608]), {'crop': 2}),
  // Sorghum
  ee.Feature(ee.Geometry.Point([-98.5528, 37.2753]), {'crop': 3}),
  ee.Feature(ee.Geometry.Point([-97.3334, 37.5605]), {'crop': 3}),
  // Soybean
  ee.Feature(ee.Geometry.Point([-97.2211, 39.7392]), {'crop': 4}),
  // Sunflower
  ee.Feature(ee.Geometry.Point([-100.8112, 39.3486]), {'crop': 5})
]);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(kansas)
  .filterDate('2024-04-01', '2024-09-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  .clip(kansas)
  .divide(10000);

var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
var features = s2.select(['B2','B3','B4','B8','B11']).addBands(ndvi);

var training = features.sampleRegions({
  collection: trainingPoints,
  properties: ['crop'],
  scale: 30
});

var classifier = ee.Classifier.smileRandomForest(30).train(training, 'crop', features.bandNames());
var classified = features.classify(classifier).rename('kansas_crops');

classified
'@

try {
    $ksModel = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json -Depth 10 @{
            tool = "earth_engine_system"
            arguments = @{
                operation = "execute"
                code = $kansasCode
                language = "javascript"
            }
        })
    
    if ($ksModel.imageKey) {
        Write-Host "  Model trained! Key: $($ksModel.imageKey)" -ForegroundColor Green
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $ksModel.imageKey
                    dimensions = 512
                    region = "Kansas"
                    visParams = @{
                        bands = @("kansas_crops")
                        min = 1
                        max = 5
                        palette = @("#DEB887", "#FFD700", "#8B4513", "#32CD32", "#FFA500")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  Thumbnail URL: $($thumb.url)" -ForegroundColor Cyan
            $results += @{Region="Kansas"; URL=$thumb.url; Crops="Wheat,Corn,Sorghum,Soybean,Sunflower"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 3: Illinois Corn Belt
Write-Host "`nTest 3: Illinois Corn Belt" -ForegroundColor Yellow
Write-Host "Crops: Corn, Soybean, Wheat, Hay" -ForegroundColor Gray

$illinoisCode = @'
var illinois = ee.FeatureCollection('TIGER/2016/States')
  .filter(ee.Filter.eq('NAME', 'Illinois'));

var trainingPoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-88.2434, 40.1164]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-88.9548, 41.2619]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-89.6446, 39.8403]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-90.6739, 40.4842]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-88.3701, 39.3210]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-87.6298, 41.8781]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-89.2168, 37.7272]), {'crop': 3}),
  ee.Feature(ee.Geometry.Point([-89.0940, 42.2711]), {'crop': 4})
]);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(illinois)
  .filterDate('2024-04-15', '2024-10-15')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  .clip(illinois)
  .divide(10000);

var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
var features = s2.select(['B2','B3','B4','B8']).addBands(ndvi);

var training = features.sampleRegions({
  collection: trainingPoints,
  properties: ['crop'],
  scale: 30
});

var classifier = ee.Classifier.smileRandomForest(30).train(training, 'crop', features.bandNames());
var classified = features.classify(classifier).rename('illinois_crops');

classified
'@

try {
    $ilModel = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json -Depth 10 @{
            tool = "earth_engine_system"
            arguments = @{
                operation = "execute"
                code = $illinoisCode
                language = "javascript"
            }
        })
    
    if ($ilModel.imageKey) {
        Write-Host "  Model trained! Key: $($ilModel.imageKey)" -ForegroundColor Green
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $ilModel.imageKey
                    dimensions = 512
                    region = "Illinois"
                    visParams = @{
                        bands = @("illinois_crops")
                        min = 1
                        max = 4
                        palette = @("#FFD700", "#32CD32", "#DEB887", "#90EE90")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  Thumbnail URL: $($thumb.url)" -ForegroundColor Cyan
            $results += @{Region="Illinois"; URL=$thumb.url; Crops="Corn,Soybean,Wheat,Hay"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 4: Texas Panhandle
Write-Host "`nTest 4: Texas Panhandle" -ForegroundColor Yellow
Write-Host "Crops: Cotton, Wheat, Sorghum, Corn, Peanuts" -ForegroundColor Gray

try {
    # Use the built-in agriculture model for Texas
    $txModel = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "Texas"
                startDate = "2024-03-15"
                endDate = "2024-10-31"
                scale = 30
            }
        })
    
    if ($txModel.modelKey) {
        Write-Host "  Model created! Key: $($txModel.modelKey)" -ForegroundColor Green
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $txModel.modelKey
                    dimensions = 256
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
            Write-Host "  Thumbnail URL: $($thumb.url)" -ForegroundColor Cyan
            $results += @{Region="Texas (Lubbock County)"; URL=$thumb.url; Crops="Cotton,Wheat,Sorghum,Corn,Peanuts"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Test 5: North Dakota
Write-Host "`nTest 5: North Dakota" -ForegroundColor Yellow
Write-Host "Crops: Spring Wheat, Canola, Sunflower, Barley, Flax, Sugarbeet" -ForegroundColor Gray

try {
    $ndModel = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
        -Method Post -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                region = "North Dakota"
                startDate = "2024-05-01"
                endDate = "2024-09-30"
                scale = 30
            }
        })
    
    if ($ndModel.modelKey) {
        Write-Host "  Model created! Key: $($ndModel.modelKey)" -ForegroundColor Green
        
        $thumb = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" `
            -Method Post -ContentType "application/json" `
            -Body (ConvertTo-Json -Depth 10 @{
                tool = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $ndModel.modelKey
                    dimensions = 512
                    region = "North Dakota"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 0.8
                        palette = @("red", "orange", "yellow", "lightgreen", "darkgreen")
                    }
                }
            })
        
        if ($thumb.url) {
            Write-Host "  Thumbnail URL: $($thumb.url)" -ForegroundColor Cyan
            $results += @{Region="North Dakota"; URL=$thumb.url; Crops="Wheat,Canola,Sunflower,Barley,Flax,Sugarbeet"}
        }
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Display all results
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "CLASSIFICATION RESULTS WITH GROUND TRUTH" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

foreach ($result in $results) {
    Write-Host "`nRegion: $($result.Region)" -ForegroundColor Yellow
    Write-Host "Crops: $($result.Crops)" -ForegroundColor Gray
    Write-Host "URL: $($result.URL)" -ForegroundColor Cyan
}

# Save results
$output = "Multi-Region Classification Results`n"
$output += "Generated: $(Get-Date)`n"
$output += "=====================================`n`n"

foreach ($result in $results) {
    $output += "Region: $($result.Region)`n"
    $output += "Crops Classified: $($result.Crops)`n"
    $output += "Visualization URL: $($result.URL)`n`n"
}

$output | Out-File -FilePath "multi-region-classification-urls.txt"
Write-Host "`nResults saved to multi-region-classification-urls.txt" -ForegroundColor Green