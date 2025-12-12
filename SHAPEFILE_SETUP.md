# 🌍 Earth Engine MCP Server with Shapefile Boundaries - Setup Guide

## ✅ What's Already Set Up

Your Earth Engine MCP server is configured with **automatic administrative boundary detection** using real shapefiles from official sources:

### 📍 Boundary Data Sources
- **FAO GAUL 2015**: Global administrative boundaries (countries, states, districts)
- **US Census TIGER**: Detailed US county boundaries
- **USDOS LSIB**: International country boundaries

### 🎯 Key Features
1. **Automatic Place Detection**: When you specify coordinates around San Francisco, New York, or Los Angeles, the system automatically detects the location and uses the exact county boundary
2. **Precise Boundaries**: Instead of rough polygons, exports and filters use exact administrative shapefiles (e.g., San Francisco County = exactly 122 km²)
3. **Natural Language Support**: Just say "San Francisco" and it finds the right boundary

## 🚀 Quick Start for Claude Desktop

### Step 1: Start the Server
```bash
cd C:\Users\Dhenenjay\earth-engine-mcp
npm run dev
```
The server will start on http://localhost:3000

### Step 2: Configure Claude Desktop
Add this to your Claude Desktop MCP settings:
```json
{
  "earth-engine": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-earth-engine"],
    "env": {
      "MCP_SERVER_URL": "http://localhost:3000/sse"
    }
  }
}
```

### Step 3: Test in Claude
Try these commands:
- "Show me Sentinel-2 images of San Francisco from last month"
- "Export a cloud-free composite of New York county"
- "Calculate NDVI for Los Angeles using exact county boundaries"

## 📊 Tools with Shapefile Support

All these tools automatically use administrative boundaries when you specify a place name:

| Tool | Description | Example |
|------|-------------|---------|
| `filter_collection_by_date_and_region` | Filter images by date and exact boundary | "Get Sentinel-2 for San Francisco, Jan 2024" |
| `smart_filter_collection` | Natural language filtering | "Cloud-free images of New York last week" |
| `export_image_to_cloud_storage` | Export with precise clipping | "Export Los Angeles county to GeoTIFF" |
| `clip_image_to_region` | Clip to exact boundaries | "Clip this image to San Francisco boundary" |
| `get_thumbnail` | Preview with boundaries | "Show thumbnail of Chicago" |
| `reduce_region_statistics` | Stats for exact regions | "Mean NDVI for San Francisco county" |
| `time_series_analysis` | Time series for boundaries | "NDVI trend for Manhattan 2023" |

## 🗺️ Supported Locations

### Pre-configured Cities (Instant)
- **San Francisco**: Exact county boundary (122 km²)
- **New York**: Manhattan/New York County
- **Los Angeles**: LA County boundary

### Global Coverage
- Any place in FAO GAUL dataset (countries, states, districts worldwide)
- Any US county via Census TIGER
- Custom shapefiles from Earth Engine assets

## 🔧 How It Works

1. **You say**: "Filter images for San Francisco"
2. **System detects**: Place name or coordinates → San Francisco
3. **Fetches boundary**: `FAO/GAUL/2015/level2` → San Francisco County
4. **Uses shapefile**: All operations use the exact 122 km² county boundary
5. **Result**: Precisely clipped/filtered data, not rough rectangles!

## 📝 Example Workflow

```javascript
// Instead of this (rough polygon):
{
  "aoi": {
    "type": "Polygon",
    "coordinates": [[[-122.5, 37.7], [-122.4, 37.7], ...]]
  }
}

// You can now use this:
{
  "aoi": {
    "placeName": "San Francisco"  // Automatically uses exact county boundary!
  }
}

// Or just natural language:
"Show me all Sentinel-2 images of San Francisco from 2024"
// → System automatically uses San Francisco County shapefile
```

## ⚡ Performance Notes

- Boundary lookup is nearly instant for pre-configured cities
- First-time lookups for new places may take 1-2 seconds
- Boundaries are cached after first use
- Export operations clip to exact boundaries (smaller file sizes!)

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is available: `netstat -an | findstr :3000`
- Kill existing Node processes: `Get-Process node | Stop-Process -Force`

### Boundaries not working
- Verify Earth Engine is initialized (check server logs)
- Ensure place name is spelled correctly
- Try one of the pre-configured cities first (San Francisco, New York, Los Angeles)

### Claude Desktop can't connect
- Ensure server is running: `npm run dev`
- Check http://localhost:3000/api/health returns 200
- Verify MCP configuration in Claude Desktop settings

## 🎉 Success Indicators

You'll know it's working when:
1. Filtering San Francisco gives you "Using exact administrative boundary (122 km²)" 
2. Exports are clipped to exact county/state shapes, not rectangles
3. Place names are auto-detected from coordinates
4. Natural language queries understand locations

## 📚 Additional Resources

- [FAO GAUL Dataset](https://developers.google.com/earth-engine/datasets/catalog/FAO_GAUL_2015_level2)
- [US Census TIGER](https://developers.google.com/earth-engine/datasets/catalog/TIGER_2016_Counties)
- [Earth Engine MCP Docs](https://github.com/your-repo/earth-engine-mcp)

---

**Ready to test?** Just ask Claude: "Show me the latest cloud-free image of San Francisco with exact county boundaries" 🚀
