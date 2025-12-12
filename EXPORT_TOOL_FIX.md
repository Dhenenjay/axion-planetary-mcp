# Export Tool Fix - Handling Large Regions and Composites

## 🔧 The Problem
The original `export_image_to_cloud_storage` tool was failing with `ENAMETOOLONG` error when trying to export regions like Los Angeles because:
1. The complex polygon geometry (shapefile boundary) was too large to pass as a parameter
2. The tool required a specific image ID, not a composite from a collection
3. No support for creating cloud-free composites

## ✅ The Solution
Created new export tools that:
1. **Use bounds instead of full geometry** - Avoids the ENAMETOOLONG error
2. **Create composites from collections** - Generate cloud-free median composites
3. **Support both Drive and Cloud Storage** - Flexible export options

## 📦 New Export Tools

### 1. `export_composite_to_drive`
Exports a composite image to Google Drive as GeoTIFF.

**Features:**
- Creates cloud-free composite using median
- Handles large regions by using bounds
- Filters by cloud cover automatically
- Exports as Cloud-Optimized GeoTIFF

**Usage Example:**
```javascript
{
  "tool": "export_composite_to_drive",
  "arguments": {
    "collection": "COPERNICUS/S2_SR_HARMONIZED",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "region": "Los Angeles",  // Can use place names!
    "scale": 10,  // Resolution in meters
    "folder": "EarthEngine"  // Google Drive folder
  }
}
```

### 2. `export_composite_to_gcs`
Exports to Google Cloud Storage (better for very large regions).

**Usage Example:**
```javascript
{
  "tool": "export_composite_to_gcs",
  "arguments": {
    "collection": "COPERNICUS/S2_SR_HARMONIZED",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "region": "Los Angeles",
    "scale": 10,
    "bucket": "earth-engine-exports"
  }
}
```

## 🚀 How to Use

### In Claude Desktop:
1. **Close Claude Desktop completely**
2. **Restart Claude Desktop**
3. **Use the new export tool:**
   ```
   "Export a cloud-free Sentinel-2 composite of Los Angeles from January 2024 to my Google Drive"
   ```

### Direct API Call:
```powershell
$body = @{
    tool = "export_composite_to_drive"
    arguments = @{
        collection = "COPERNICUS/S2_SR_HARMONIZED"
        start_date = "2024-01-01"
        end_date = "2024-01-31"
        region = "Los Angeles"
        scale = 10
        folder = "EarthEngine"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method Post -Body $body -ContentType "application/json"
```

## 📝 Technical Details

### Key Changes:
1. **Geometry Handling:**
   ```javascript
   // Use bounds instead of full geometry for export
   const exportGeometry = geometry.bounds();
   ```

2. **Composite Creation:**
   ```javascript
   // Create cloud-free composite
   const composite = imageCollection
     .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloudCover))
     .median()
     .clip(geometry);
   ```

3. **Cloud-Optimized Output:**
   ```javascript
   formatOptions: {
     cloudOptimized: true
   }
   ```

## 📁 Files Modified
- `src/mcp/tools/export_composite.ts` - New export tool implementation
- `src/mcp/tools/index.ts` - Added import for new tool
- `mcp-essential.js` - Updated tool list and parameter mapping

## ⚠️ Important Notes
1. **Export Time:** Large regions may take 5-30 minutes to export
2. **Google Drive:** Files appear in the specified folder (default: "EarthEngine")
3. **File Format:** Exports as Cloud-Optimized GeoTIFF by default
4. **Resolution:** Default is 10m for Sentinel-2, 30m for Landsat

## 🎯 Result
You can now export high-resolution composites of any region (including Los Angeles) without encountering the ENAMETOOLONG error. The tool automatically:
- Finds the shapefile boundary for the place name
- Creates a cloud-free composite
- Exports to your chosen destination
- Handles large, complex geometries properly
