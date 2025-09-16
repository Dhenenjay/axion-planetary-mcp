# 🌍 Axion Planetary MCP

Transform any **MCP client** into a **Geospatial Analysis Powerhouse** with Google Earth Engine integration!

## ✨ What This Does

This package gives MCP clients access to:
- 🛰️ **Google Earth Engine** - Petabytes of satellite imagery and geospatial datasets
- 🗺️ **Interactive Maps** - Visualize results directly in Claude's responses  
- 🌾 **Crop Classification** - ML-powered agricultural analysis with automatic augmentation
- 📊 **30+ Analysis Tools** - NDVI, water stress, urban expansion, disaster monitoring
- 🤖 **5 Geospatial Models** - Pre-trained models for wildfire, flood, agriculture, deforestation, water quality

## 🏗️ Architecture

```
MCP Client ←→ stdio ←→ mcp-sse-complete.cjs ←→ SSE/HTTP ←→ Next.js API (port 3000)
                                                                   ↓
                                                         Earth Engine Backend
```

**Important**: The MCP server (`mcp-sse-complete.cjs`) acts as a bridge between the MCP client's stdio interface and the Next.js backend API. The Next.js server MUST be running for the MCP server to work!

## 🚀 Quick Setup (5 Minutes)

### Prerequisites

- **Node.js 18+** installed
- **Google Cloud Account** with Earth Engine API enabled
- **MCP-compatible client** (Claude Desktop, Cline, etc.)

### Step 1: Install Package

```bash
npm install -g axion-planetary-mcp
```

### Step 2: Set Up Earth Engine Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project and enable **Earth Engine API**
3. Create a service account and download the JSON key
4. Save to: `~/.config/earthengine/credentials.json`

Or set environment variable:
```bash
# Windows
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\YourName\.config\earthengine\credentials.json

# Mac/Linux
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/earthengine/credentials.json
```

### Step 3: Run Setup Wizard

```bash
axion-mcp
```

This will:
- Check Earth Engine credentials
- Generate MCP configuration for your MCP client
- Show Next.js server startup instructions

### Step 4: Start the Next.js Backend (CRITICAL!)

**⚠️ IMPORTANT: Open a NEW terminal and keep it running!**

```bash
# Navigate to package directory (path shown by setup wizard)
# Example paths:
# Windows: C:\Users\YourName\AppData\Roaming\npm\node_modules\axion-planetary-mcp
# Mac: /usr/local/lib/node_modules/axion-planetary-mcp
# Linux: ~/.npm-global/lib/node_modules/axion-planetary-mcp

cd [package-directory-from-wizard]

# Build and start Next.js server
npm run build:next
npm run start:next
```

You should see:
```
▲ Next.js 15.2.4
- Local: http://localhost:3000
✓ Ready
```

**Keep this terminal open while using your MCP client!**

### Step 5: Configure Your MCP Client

Add the configuration from the wizard to your MCP client config file:

**Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Claude Desktop (Mac)**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Claude Desktop (Linux)**: `~/.config/claude/claude_desktop_config.json`  
**Other MCP Clients**: Check your client's documentation for config location

Example configuration:
```json
{
  "mcpServers": {
    "axion-planetary": {
      "command": "node",
      "args": ["C:/Users/YourName/.../axion-planetary-mcp/mcp-sse-complete.cjs"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:/Users/YourName/.config/earthengine/credentials.json"
      }
    }
  }
}
```

### Step 6: Restart Your MCP Client

Completely quit and restart your MCP client to load the new configuration.

### Step 7: Test Connection

Ask your MCP client:
- "Show me NDVI for California farmland"
- "Create a crop classification for Iowa with map visualization"
- "Analyze urban heat islands in Phoenix"

## 📚 Available Tools

### Consolidated Super Tools

1. **earth_engine_data** - Data discovery and access
   - Search datasets
   - Filter by date/region
   - Get geometry info
   - Access boundaries

2. **earth_engine_process** - Processing and analysis
   - Calculate indices (NDVI, EVI, SAVI, etc.)
   - Create composites
   - Terrain analysis
   - Statistical analysis

3. **earth_engine_export** - Export and visualization
   - Export to GeoTIFF
   - Generate thumbnails
   - Create map tiles
   - Download results

4. **earth_engine_system** - System operations
   - Check authentication
   - Execute custom code
   - System health status

5. **earth_engine_map** - Interactive maps
   - Create web maps
   - Visualize large regions
   - Share results

### Specialized Tools

- **crop_classification** - Advanced ML crop classification with automatic urban/water/vegetation augmentation
- **water_stress_analysis** - Agricultural water stress monitoring
- **land_cover_classification** - Custom land cover mapping
- **change_detection** - Monitor environmental changes
- **fire_detection** - Wildfire monitoring and analysis

### Geospatial Models

- **wildfire_risk** - Predict wildfire risk areas
- **flood_prediction** - Flood susceptibility mapping  
- **agriculture_health** - Crop health assessment
- **deforestation_detection** - Forest loss monitoring
- **water_quality** - Water body quality analysis

## 🎯 Usage Examples

### Vegetation Analysis
```
"Calculate NDVI for Iowa farmland in summer 2024"
"Show me vegetation stress in California during the drought"
"Analyze forest health in the Pacific Northwest"
```

### Crop Classification
```
"Create a crop classification model for Nebraska"
"Identify corn vs soybean fields in Illinois"
"Map agricultural land use changes in Texas over 5 years"
```

### Water Resources
```
"Monitor Lake Mead water levels over the past decade"
"Analyze coastal erosion in Miami Beach"
"Detect irrigation patterns in Central Valley"
```

### Urban Analysis
```
"Track urban sprawl in Phoenix from 2015 to 2024"
"Identify heat islands in Los Angeles"
"Monitor construction progress in Austin"
```

### Disaster Response
```
"Assess wildfire damage in Maui"
"Monitor flooding after Hurricane Ian"
"Evaluate drought impact on Midwest agriculture"
```

## 🔧 Troubleshooting

### "MCP server not responding" in MCP client

1. **Check Next.js server is running**
   - Open http://localhost:3000 in browser
   - Should see the application interface
   - If not, restart with `npm run start:next`

2. **Verify configuration path**
   - Ensure the path in claude_desktop_config.json points to mcp-sse-complete.cjs
   - Use forward slashes (/) even on Windows

3. **Restart MCP client**
   - Completely quit (not just close)
   - Reopen after config changes

### Earth Engine Authentication Errors

1. **Check credentials file**
   ```bash
   # Verify file exists and is valid JSON
   cat ~/.config/earthengine/credentials.json
   ```

2. **Verify API is enabled**
   - Go to Google Cloud Console
   - Check Earth Engine API is enabled
   - Ensure service account has permissions

### Maps Not Displaying

1. **Confirm Next.js is running**
   - Check http://localhost:3000
   - Look for console errors

2. **Request visualization explicitly**
   - Say "create a map" or "show visualization"
   - Maps are generated on request for performance

### Port 3000 Already in Use

```bash
# Use a different port
PORT=3001 npm run start:next
```

Note: Currently the SSE endpoint is hardcoded to port 3000. If you need a different port, you'll need to modify the SSE_ENDPOINT in mcp-sse-complete.cjs.

## 🏆 Advanced Features

### Crop Classification with Auto-Augmentation

The crop classification tool automatically adds common sense classes (urban, water, natural vegetation) to training data if missing. This ensures more accurate classifications by distinguishing crops from:
- Urban/built-up areas
- Water bodies (lakes, rivers)
- Natural vegetation (forests, grasslands)

### Custom Training Data

You can provide custom training points:
```javascript
{
  "trainingData": [
    {"lat": 41.5868, "lon": -93.6250, "label": 1, "class_name": "corn"},
    {"lat": 41.6912, "lon": -93.0519, "label": 2, "class_name": "soybean"}
  ]
}
```

### Time Series Analysis

Request temporal analysis:
```
"Show me NDVI changes for this region over the growing season"
"Create a time series animation of urban growth"
```

## 📦 Package Contents

```
axion-planetary-mcp/
├── mcp-sse-complete.cjs    # Main MCP-SSE bridge server
├── cli.js                   # Setup wizard
├── src/                     # Source code
│   ├── mcp/                # MCP server implementation
│   │   └── tools/          # Earth Engine tools
│   └── lib/                # Shared libraries
├── app/                     # Next.js app
│   └── api/                # API routes
│       └── mcp/            # MCP endpoints
│           └── sse/        # SSE endpoint
├── models/                  # Geospatial models
└── public/                  # Static assets
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Google Earth Engine team for the amazing platform
- Anthropic for Claude and the MCP protocol
- The geospatial community for continued support

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Dhenenjay/axion-planetary-mcp/issues)
- **Documentation**: [Wiki](https://github.com/Dhenenjay/axion-planetary-mcp/wiki)

---

**Made with ❤️ for the geospatial community**

*Transform Claude into your personal Earth observation assistant!*