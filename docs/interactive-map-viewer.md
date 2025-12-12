# Earth Engine Interactive Map Viewer

## Overview

The Interactive Map Viewer is a new tool that solves the problem of visualizing large-scale Earth Engine data that would normally timeout when generating static thumbnails. Instead of creating a single image, it generates map tiles that can be loaded dynamically as you pan and zoom.

## Key Features

- **No Size Limits**: View entire states, countries, or even global data
- **Dynamic Loading**: Tiles load on-demand as you navigate
- **Multiple Basemaps**: Switch between satellite, terrain, streets, and dark themes
- **Layer Control**: Toggle between multiple data layers
- **Interactive Controls**: Zoom, pan, fullscreen, and reset view
- **Persistent Sessions**: Maps remain available until explicitly deleted

## How It Works

1. **Data Processing**: The tool takes an Earth Engine image (from composite, model, or NDVI operations)
2. **Tile Generation**: Creates a tile service URL using Earth Engine's getMap API
3. **Web Interface**: Serves an interactive Leaflet map at `http://localhost:3000/map/[id]`
4. **Dynamic Loading**: Browser requests only visible tiles as you navigate

## Usage

### Creating a Map

```powershell
# First, create or process some data
$composite = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR"
        startDate = "2024-06-01"
        endDate = "2024-08-31"
        region = "California"
        compositeType = "median"
    }
}

# Then create an interactive map
$map = @{
    tool = "earth_engine_map"
    arguments = @{
        operation = "create"
        input = $compositeResult.compositeKey
        region = "California"
        zoom = 6
        basemap = "satellite"
    }
}
```

### Map Operations

- **Create**: Generate a new interactive map
- **List**: Show all active map sessions
- **Delete**: Remove a map session

### Visualization Parameters

```javascript
visParams = {
    bands: ["B4", "B3", "B2"],  // RGB bands
    min: 0,                      // Minimum value
    max: 0.3,                    // Maximum value
    gamma: 1.4,                  // Gamma correction
    palette: ["blue", "green"]   // Color palette (for single bands)
}
```

## Supported Data Sources

1. **Composites**: From `earth_engine_process` tool
2. **Model Outputs**: Agricultural, wildfire, flood models
3. **NDVI/Indices**: Vegetation and other spectral indices
4. **Direct Datasets**: Any Earth Engine ImageCollection or Image

## Map Controls

### Keyboard Shortcuts
- `+` / `-`: Zoom in/out
- Arrow keys: Pan the map
- `F`: Toggle fullscreen

### Mouse Controls
- Scroll wheel: Zoom
- Click and drag: Pan
- Double-click: Zoom in

### UI Controls
- **Layer Switcher**: Change basemap and toggle data layers
- **Zoom Controls**: Zoom in/out buttons
- **Scale Bar**: Shows current map scale
- **Fullscreen**: Expand to full screen
- **Reset View**: Return to initial position
- **Info**: Display current bounds and zoom level

## Architecture

```
┌─────────────────┐
│  MCP Tool       │
│  (Map Creator)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Map Session    │
│  (In Memory)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Next.js API    │
│  /api/map/[id]  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  React Page     │
│  /map/[id]      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Leaflet Map    │
│  (Browser)      │
└─────────────────┘
```

## Examples

### View Large Agricultural Region

```powershell
# Process entire Midwest
$map = @{
    tool = "earth_engine_map"
    arguments = @{
        operation = "create"
        input = "agriculture_model_midwest_2024"
        region = "Illinois, Iowa, Indiana, Ohio"
        layers = @(
            @{
                name = "Crop Health"
                bands = @("crop_health")
                visParams = @{
                    min = 0
                    max = 1
                    palette = @("red", "yellow", "green")
                }
            }
        )
    }
}
```

### Multi-Temporal Analysis

```powershell
# Create maps for different time periods
$periods = @("2024-Q1", "2024-Q2", "2024-Q3")

foreach ($period in $periods) {
    $map = @{
        tool = "earth_engine_map"
        arguments = @{
            operation = "create"
            input = "composite_$period"
            region = "Texas"
            zoom = 6
        }
    }
    # Each creates a separate map URL
}
```

## Performance Tips

1. **Initial Zoom**: Start with appropriate zoom level for your region
2. **Tile Caching**: Browser caches tiles automatically
3. **Multiple Layers**: Add all layers at once to avoid recreating maps
4. **Region Bounds**: Specify region to optimize initial view

## Troubleshooting

### Map Won't Load
- Check if Next.js server is running on port 3000
- Verify the map ID is valid
- Check browser console for errors

### Tiles Load Slowly
- Large regions take time for initial processing
- Check your internet connection
- Earth Engine may be rate-limiting

### Missing Data
- Ensure composite/model was created successfully
- Check if data exists for the specified region
- Verify band names match the dataset

## API Reference

### Create Map

```typescript
{
    operation: "create",
    input: string,           // Composite/model key
    region?: string,         // Region name or coordinates
    layers?: [{
        name: string,
        bands: string[],
        visParams: object
    }],
    center?: [lon, lat],     // Map center
    zoom?: number,           // Initial zoom (1-20)
    basemap?: string         // satellite|terrain|roadmap|dark
}
```

### Response

```typescript
{
    success: true,
    mapId: string,
    url: string,             // Full URL to open
    tileUrl: string,         // Tile service URL
    region: string,
    center: [lon, lat],
    zoom: number,
    layers: [{
        name: string,
        tileUrl: string
    }]
}
```

## Integration with Other Tools

The map viewer integrates seamlessly with other Earth Engine MCP tools:

1. **Process Tool** → Creates composites → **Map Tool** displays them
2. **Model Tools** → Generate classifications → **Map Tool** visualizes results
3. **Export Tool** → Can export visible map areas

## Future Enhancements

- [ ] Drawing tools for region selection
- [ ] Measurement tools (distance, area)
- [ ] Time slider for temporal data
- [ ] Split-screen comparison
- [ ] Export current view as image
- [ ] Share maps with persistent URLs
- [ ] Annotation and markup tools
- [ ] 3D terrain visualization
- [ ] Heatmap overlays
- [ ] Vector data support

## Conclusion

The Interactive Map Viewer solves the critical limitation of static thumbnails for large-scale Earth Engine visualizations. It provides a professional, responsive interface for exploring satellite data at any scale, from local farms to entire continents.