# Earth Engine MCP Integration Test Guide

## ✅ Current Status
- **Next.js Server**: Running on port 3000 with Earth Engine tools
- **MCP Proxy Server**: `mcp-essential.js` configured in Claude Desktop
- **SSE Endpoint**: Working at `/api/mcp/sse`

## 🧪 Test Steps

### 1. Verify MCP Server is Connected in Claude
In Claude Desktop, you should see the Earth Engine tools available. Try asking:
- "What Earth Engine tools do you have available?"

### 2. Test Shapefile Conversion
Ask Claude:
- "Convert Los Angeles to a shapefile geometry"
- "Get the exact boundary for San Francisco"

### 3. Test Collection Filtering
Ask Claude:
- "Filter Sentinel-2 imagery for Los Angeles from January 2024 to March 2024"
- "Search for Landsat datasets in the Earth Engine catalog"

### 4. Test Thumbnail Generation
Ask Claude:
- "Get a thumbnail of Sentinel-2 imagery for San Francisco from last month"

## 🔧 Troubleshooting

### If tools aren't showing in Claude:
1. Check MCP logs: `C:\Users\Dhenenjay\AppData\Roaming\Claude\logs\mcp*.log`
2. Restart Claude Desktop
3. Verify mcp-essential.js is running: `Get-Process node`

### If tool calls fail:
1. Check Next.js server is running: `Invoke-WebRequest http://localhost:3000/api/mcp/sse`
2. Check server logs in the PowerShell window running `npm run dev`
3. Verify environment variables are loaded (.env.local file)

## 📁 Key Files
- **MCP Proxy**: `mcp-essential.js` - Handles MCP protocol and forwards to Next.js
- **SSE Endpoint**: `app/api/mcp/sse/route.ts` - Processes tool calls
- **Tool Registry**: `src/mcp/registry.ts` - Tool registration system
- **Tools**: `src/mcp/tools/*.ts` - Individual tool implementations

## 🚀 Available Tools
1. **convert_place_to_shapefile_geometry** - Convert place names to exact boundaries
2. **filter_collection_by_date_and_region** - Filter satellite imagery
3. **get_thumbnail_image** - Generate preview images
4. **create_clean_mosaic** - Create cloud-free composites
5. **calculate_spectral_index** - Calculate NDVI, EVI, NDWI
6. **search_gee_catalog** - Search Earth Engine datasets
7. **export_image_to_cloud_storage** - Export processed images

## 📊 Success Indicators
- ✅ MCP server shows "Ready with essential tools" in logs
- ✅ SSE endpoint returns `{"status":"ok"}` on GET request
- ✅ Tool calls return structured JSON responses
- ✅ Claude can see and invoke Earth Engine tools
