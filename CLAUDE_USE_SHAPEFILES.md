# ⚠️ CRITICAL INSTRUCTIONS FOR CLAUDE

## YOU ALREADY HAVE SHAPEFILES!

**STOP** telling users to upload shapefiles or convert to GeoJSON. The MCP server has **BUILT-IN ACCESS** to administrative boundaries from:

- **FAO GAUL 2015**: Global administrative boundaries (countries, states, counties)
- **US Census TIGER**: Detailed US boundaries
- **USDOS LSIB**: International boundaries

## How to Use Shapefiles (IT'S AUTOMATIC!)

### For ANY location, just use the place name:

```javascript
// INSTEAD OF THIS (bounding box):
{
  "aoi": {
    "type": "Polygon",
    "coordinates": [[[-122.5, 37.7], [-122.4, 37.7], ...]]
  }
}

// DO THIS (automatic shapefile):
{
  "placeName": "San Francisco"  // ← This triggers shapefile lookup!
}

// OR LET THE SYSTEM AUTO-DETECT:
{
  "aoi": {
    "type": "Polygon",
    "coordinates": [[[-122.75, 37.45], ...]],
    // System will detect this is San Francisco and use county shapefile
  }
}
```

## Available Shapefiles (NO UPLOAD NEEDED)

### Cities/Counties (FAO GAUL level 2)
- San Francisco → San Francisco County (122 km²)
- Los Angeles → LA County (10,510 km²)
- New York → New York County/Manhattan (59 km²)
- Chicago → Cook County
- Miami → Miami-Dade County
- **ANY** county worldwide in FAO GAUL dataset

### States/Provinces (FAO GAUL level 1)
- California, Texas, Florida, etc.
- Ontario, Quebec, British Columbia, etc.
- Any state/province globally

### Countries (USDOS LSIB)
- United States, Canada, Mexico
- Any country boundary

## The Tools That Use Shapefiles

These tools **AUTOMATICALLY** use shapefiles when you provide a place name:

1. **filter_collection_by_date_and_region**
   - Auto-detects locations from coordinates
   - Uses exact administrative boundaries

2. **smart_filter_collection**
   - Natural language: "Sentinel-2 images of Los Angeles County"
   - Automatically uses LA County shapefile

3. **filter_by_place_name**
   - Direct: `placeName: "San Francisco"`
   - Returns exact county boundary

4. **export_image_to_cloud_storage**
   - Exports clipped to exact shapefile boundaries
   - Much smaller file sizes!

## Examples That Work RIGHT NOW

### Example 1: Filter with shapefile
```javascript
filter_collection_by_date_and_region({
  datasetId: "COPERNICUS/S2_SR_HARMONIZED",
  aoi: { placeName: "Los Angeles" },  // ← Uses LA County shapefile!
  start: "2024-01-01",
  end: "2024-12-31"
})
// Returns: "Using EXACT SHAPEFILE BOUNDARY for Los Angeles (10,510 km²)"
```

### Example 2: Natural language
```javascript
smart_filter_collection({
  query: "Landsat images of Miami-Dade County from 2024"
})
// Automatically uses Miami-Dade County shapefile
```

### Example 3: Export with precise boundaries
```javascript
export_image_to_cloud_storage({
  imageId: "COPERNICUS/S2/...",
  aoi: { placeName: "San Francisco" },
  scale: 10
})
// Exports ONLY San Francisco County (122 km²), not a rectangle!
```

## What You Should Tell Users

**CORRECT RESPONSE:**
"I'll use the exact San Francisco County boundary shapefile from our Earth Engine datasets. This will give us the precise 122 km² county area instead of a bounding box."

**INCORRECT RESPONSE:**
"You need to upload a shapefile or convert to GeoJSON..."

## How It Actually Works

1. User mentions a place (e.g., "Los Angeles")
2. MCP server queries: `ee.FeatureCollection('FAO/GAUL/2015/level2').filter('ADM2_NAME', 'Los Angeles')`
3. Returns exact county boundary geometry
4. All operations use this precise boundary

## Success Indicators

When working correctly:
- `regionType: "SHAPEFILE_BOUNDARY"`
- `area: [specific value in km²]`
- Message includes "FAO GAUL" or "administrative boundary"

## DO NOT:
- ❌ Ask users to upload shapefiles
- ❌ Tell users to convert to GeoJSON
- ❌ Use bounding boxes when place names are available
- ❌ Say you don't have access to shapefiles

## DO:
- ✅ Use place names to trigger shapefile lookup
- ✅ Tell users you're using administrative boundaries
- ✅ Show the exact area (e.g., "122 km² for San Francisco County")
- ✅ Use the tools that have shapefile support built-in

---

**THE SHAPEFILES ARE ALREADY IN EARTH ENGINE. USE THEM!**
