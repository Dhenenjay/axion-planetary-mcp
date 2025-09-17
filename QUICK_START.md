# 🚀 Quick Start - Axion Planetary MCP

## For Users: Zero Setup Required!

You can start using Axion Planetary MCP in **less than 30 seconds**. No Google Cloud setup, no Earth Engine credentials, no local server needed!

### Step 1: Install the Package

```bash
npm install -g axion-planetary-mcp@latest
```

### Step 2: Add to Your MCP Client Config

#### For Claude Desktop

1. Open your Claude Desktop config file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`

2. Add this configuration:

```json
{
  "mcpServers": {
    "axion-planetary": {
      "command": "node",
      "args": ["C:\\Users\\[YOUR_USERNAME]\\AppData\\Roaming\\npm\\node_modules\\axion-planetary-mcp\\mcp-hosted.cjs"],
      "env": {
        "AXION_API_URL": "https://axion-planetary-mcp.onrender.com"
      }
    }
  }
}
```

**Note**: Replace `[YOUR_USERNAME]` with your actual Windows username, or adjust the path based on where npm installs global packages on your system.

#### For Cursor/Cline

Add the same configuration to your MCP config file (location varies by client).

### Step 3: Restart Your Client

Restart Claude Desktop or your MCP client to load the new configuration.

### Step 4: Start Using!

That's it! You can now use natural language to access Earth observation capabilities:

- "Show me vegetation health in California"
- "Analyze wildfire risk in Australia"  
- "Monitor deforestation in the Amazon"
- "Check crop health in Iowa farmlands"
- "Assess flood risk in coastal Bangladesh"

## 🌟 What You Can Do

### Available Tools

1. **earth_engine_data** - Search and access satellite data
2. **earth_engine_process** - Process and analyze imagery
3. **earth_engine_export** - Export results and create visualizations
4. **earth_engine_map** - Create interactive web maps
5. **earth_engine_system** - System operations and health checks

### Pre-trained Models

1. **wildfire_risk_assessment** - Assess wildfire risk for any region
2. **flood_risk_assessment** - Analyze flood risks
3. **agricultural_monitoring** - Monitor crop health
4. **deforestation_detection** - Detect forest changes
5. **water_quality_analysis** - Analyze water bodies

## 🔧 Troubleshooting

### Service Not Responding?

The hosted service runs on Render's free tier and may take 30-60 seconds to wake up if it's been idle. Just retry your request after a minute.

### Connection Issues?

Check if the service is running:
```bash
curl https://axion-planetary-mcp.onrender.com/api/health
```

Expected response: `{"status":"ok","message":"Earth Engine API is healthy"}`

### Need Local Setup?

If you prefer to run everything locally (requires Google Earth Engine credentials):

```json
{
  "mcpServers": {
    "axion-planetary": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp-sse-complete.cjs"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\path\\to\\your-gee-key.json"
      }
    }
  }
}
```

Then run the local Next.js server:
```bash
cd C:\path\to\axion-planetary-mcp
npm run start:next
```

## 📊 Service Status

- **Hosted Service**: https://axion-planetary-mcp.onrender.com
- **Status Page**: https://axion-planetary-mcp.onrender.com/api/health
- **Analytics**: https://axion-planetary-mcp.onrender.com/api/mcp/sse (GET request shows usage stats)

## 🆘 Support

- **Issues**: https://github.com/Dhenenjay/axion-planetary-mcp/issues
- **Documentation**: https://github.com/Dhenenjay/axion-planetary-mcp#readme

## 🎉 That's It!

You're now ready to use state-of-the-art Earth observation capabilities through simple conversation. No PhD required, no complex setup, just natural language and powerful results.

**Remember**: The first request might take 30-60 seconds as the service wakes up. After that, responses are typically under 5 seconds.

---

*Made with ❤️ for democratizing geospatial AI*