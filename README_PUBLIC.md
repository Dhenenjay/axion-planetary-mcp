# Earth Engine MCP Server for Claude Desktop

Access Google Earth Engine's powerful satellite imagery and geospatial analysis capabilities directly in Claude Desktop! This MCP (Model Context Protocol) server provides 4 consolidated super tools that give Claude access to Earth Engine's vast collection of satellite data and processing capabilities.

## 🚀 Quick Start (5 minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or higher
- [Claude Desktop](https://claude.ai/download) 
- Google Earth Engine service account (free - see below)

### Step 1: Get Earth Engine Access
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Earth Engine API
4. Create a service account with Earth Engine permissions
5. Download the JSON key file

### Step 2: Install & Configure
```bash
# Clone the repository
git clone https://github.com/yourusername/earth-engine-mcp.git
cd earth-engine-mcp

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env.local

# Edit .env.local and set your service account key path:
# GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account-key.json
```

### Step 3: Verify Setup
```bash
npm run setup:check
```
This will verify your configuration is correct.

### Step 4: Start the Server
```bash
npm run dev
```

### Step 5: Configure Claude Desktop
Add to your Claude Desktop config (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "earth-engine": {
      "command": "node",
      "args": ["C:\\path\\to\\earth-engine-mcp\\mcp-consolidated.js"]
    }
  }
}
```

### Step 6: Restart Claude Desktop
Close and reopen Claude Desktop. You should now have access to Earth Engine tools!

## 🛠️ Available Tools

The server provides 4 consolidated super tools:

### 1. 📊 earth_engine_data
Search catalogs, filter collections, and work with geometries.

**Example:** "Use earth_engine_data to search for Sentinel-2 imagery"

### 2. 🔬 earth_engine_process  
Calculate indices (NDVI, EVI), create composites, analyze terrain.

**Example:** "Use earth_engine_process to calculate NDVI for California in January 2024"

### 3. 🖼️ earth_engine_export
Generate thumbnails, export to cloud storage, create map tiles.

**Example:** "Use earth_engine_export to create a thumbnail of Los Angeles"

### 4. ⚙️ earth_engine_system
Check authentication, run custom code, manage assets.

**Example:** "Use earth_engine_system to check if Earth Engine is authenticated"

## 💡 Example Prompts for Claude

```
"Search for Landsat imagery of New York from 2024"

"Calculate NDVI for agricultural areas in Iowa for summer 2024"

"Create a cloud-free composite of Paris using Sentinel-2 data"

"Export a GeoTIFF of deforestation in the Amazon"

"Generate a thumbnail showing urban growth in Dubai over the last 5 years"
```

## 🔧 Troubleshooting

### "Authentication failed"
- Make sure your service account key path is correct in `.env.local`
- Verify the service account has Earth Engine API access
- Run `npm run setup:check` to diagnose issues

### "Tools not showing in Claude"
- Restart Claude Desktop completely (check system tray)
- Verify the server is running (`npm run dev`)
- Check the path in Claude's config file is correct

### "Export failed"
- The default GCS bucket will be auto-created if you have permissions
- For large exports, increase the timeout in the tool parameters

## 📚 Resources

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Earth Engine Data Catalog](https://developers.google.com/earth-engine/datasets)
- [MCP Documentation](https://modelcontextprotocol.io/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT

## 🙏 Acknowledgments

Built with the Model Context Protocol by Anthropic and powered by Google Earth Engine.
