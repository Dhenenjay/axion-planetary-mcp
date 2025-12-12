# 🌍 Planetary MCP - User Setup Guide

## Quick Setup (2 minutes!)

### Step 1: Copy this to your Claude Desktop config

Open: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "planetary": {
      "command": "npx",
      "args": [
        "-y",
        "planetary-mcp@latest"
      ],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\path\\to\\your\\ee-service-account.json"
      }
    }
  }
}
```

### Step 2: Replace the path
Change `C:\\path\\to\\your\\ee-service-account.json` to your actual Earth Engine service account JSON file path.

### Step 3: Restart Claude Desktop
Close and reopen Claude Desktop.

## That's it! 🎉

You now have access to:
- 🔍 **earth_engine_data** - Search and filter satellite imagery
- ⚙️ **earth_engine_process** - Process and analyze data
- 📤 **earth_engine_export** - Export and visualize results
- 🗺️ **earth_engine_map** - Create interactive maps
- 🌾 **crop_classification** - ML-based land cover classification
- 🔧 **earth_engine_system** - System operations

## Example Usage in Claude

Just ask Claude:
- "Search for Sentinel-2 imagery over California"
- "Calculate NDVI for Iowa in July 2024"
- "Classify crops in Texas with a map"
- "Create a median composite for Nebraska"

## Troubleshooting

If you see connection errors:
1. Make sure your service account JSON file path is correct
2. Ensure your service account has Earth Engine API enabled
3. Check that the file path uses double backslashes (`\\`) on Windows

## Support

- Issues: https://github.com/Dhenenjay/earth-engine-mcp/issues
- Documentation: See MCP_TOOLS_DOCUMENTATION.md

---

**Server Status**: Hosted globally on Vercel's edge network
**No installation required** - npx handles everything automatically!