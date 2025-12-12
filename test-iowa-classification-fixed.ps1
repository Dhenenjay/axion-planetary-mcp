#!/usr/bin/env pwsh

Write-Host "Testing Iowa Crop Classification with Fixed Thumbnail Generation" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green

# Test the agricultural model
Write-Host "`n1. Creating agricultural model for Iowa..." -ForegroundColor Yellow
$agricultureResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
    tool = "earth_engine_process"
    arguments = @{
        operation = "model"
        modelType = "agriculture"
        region = "Iowa"
        startDate = "2024-04-01"
        endDate = "2024-10-31"
        cropType = "general"
        scale = 30
    }
} | ConvertTo-Json)

Write-Host "Agriculture model response:" -ForegroundColor Cyan
$agricultureResponse | ConvertTo-Json -Depth 10

# Extract the model key
$modelKey = $agricultureResponse.modelKey
Write-Host "`nModel Key: $modelKey" -ForegroundColor Green

# Test thumbnail generation with the model key
Write-Host "`n2. Generating thumbnail from agricultural model..." -ForegroundColor Yellow
$thumbnailResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        input = $modelKey
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

Write-Host "Thumbnail response:" -ForegroundColor Cyan
$thumbnailResponse | ConvertTo-Json -Depth 10

if ($thumbnailResponse.url) {
    Write-Host "`nThumbnail URL: $($thumbnailResponse.url)" -ForegroundColor Green
    Write-Host "Opening thumbnail in browser..." -ForegroundColor Yellow
    Start-Process $thumbnailResponse.url
} else {
    Write-Host "`nNo thumbnail URL received" -ForegroundColor Red
}

Write-Host "`n3. Testing custom classification with ground truth..." -ForegroundColor Yellow
$classificationCode = @'
// Load Iowa boundary
var iowa = ee.FeatureCollection('TIGER/2016/States')
  .filter(ee.Filter.eq('NAME', 'Iowa'));

// Define ground truth training points
var trainingPoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-93.6250, 41.5868]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-93.5801, 42.0458]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-91.5301, 41.2619]), {'crop': 1}),
  ee.Feature(ee.Geometry.Point([-93.0519, 41.6912]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-94.6831, 42.7411]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-92.4046, 41.0381]), {'crop': 2}),
  ee.Feature(ee.Geometry.Point([-94.3831, 41.3306]), {'crop': 3}),
  ee.Feature(ee.Geometry.Point([-92.1821, 42.3875]), {'crop': 3})
]);

// Load and process Sentinel-2
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(iowa)
  .filterDate('2024-06-01', '2024-09-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .median()
  .clip(iowa)
  .divide(10000);

// Calculate NDVI
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');

// Feature stack
var features = s2.select(['B2','B3','B4','B8']).addBands(ndvi);

// Train classifier
var training = features.sampleRegions({
  collection: trainingPoints,
  properties: ['crop'],
  scale: 30
});

var classifier = ee.Classifier.smileRandomForest(20).train(training, 'crop', features.bandNames());
var classified = features.classify(classifier).rename('crop_class');

// Return the classification
classified
'@

$systemResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
    tool = "earth_engine_system"
    arguments = @{
        operation = "execute"
        code = $classificationCode
        language = "javascript"
    }
} | ConvertTo-Json -Depth 10)

Write-Host "Classification execution response:" -ForegroundColor Cyan
$systemResponse | ConvertTo-Json -Depth 10

# If an image key was returned, generate thumbnail
if ($systemResponse.imageKey) {
    Write-Host "`n4. Generating thumbnail from classification..." -ForegroundColor Yellow
    $classificationThumbResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            input = $systemResponse.imageKey
            dimensions = 512
            region = "Iowa"
            visParams = @{
                bands = @("crop_class")
                min = 1
                max = 3
                palette = @("#FFD700", "#32CD32", "#DEB887")
            }
        }
    } | ConvertTo-Json -Depth 10)
    
    Write-Host "Classification thumbnail response:" -ForegroundColor Cyan
    $classificationThumbResponse | ConvertTo-Json -Depth 10
    
    if ($classificationThumbResponse.url) {
        Write-Host "`nClassification Thumbnail URL: $($classificationThumbResponse.url)" -ForegroundColor Green
        Write-Host "Opening classification thumbnail in browser..." -ForegroundColor Yellow
        Start-Process $classificationThumbResponse.url
    }
}

Write-Host "`nTest completed!" -ForegroundColor Green