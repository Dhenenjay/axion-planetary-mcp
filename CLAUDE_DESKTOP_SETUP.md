
CLAUDE DESKTOP MCP INTEGRATION INSTRUCTIONS
============================================

1. CONFIGURATION FILE LOCATION:
   Copy the following configuration to your Claude Desktop config:
   
   Windows: %APPDATA%\Claude\claude_desktop_config.json
   Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
   Linux: ~/.config/Claude/claude_desktop_config.json

2. CONFIGURATION CONTENT:
   The configuration has been saved to: C:\Users\Dhenenjay\earth-engine-mcp\claude_desktop_config.json

3. ENVIRONMENT VARIABLES:
   Set these in your system environment:
   - EARTH_ENGINE_PRIVATE_KEY: Your Earth Engine service account private key path
   - EARTH_ENGINE_PROJECT_ID: Your Google Cloud project ID

4. START THE MCP SERVER:
   Run: npm start
   in the directory: C:\Users\Dhenenjay\earth-engine-mcp

5. RESTART CLAUDE DESKTOP:
   After configuration, restart Claude Desktop to load the MCP tools.

6. AVAILABLE TOOLS IN CLAUDE:
   - earth_engine_init: Initialize Earth Engine
   - earth_engine_process: Process geospatial data
   - wildfire_risk_assessment: Assess wildfire risk
   - flood_risk_assessment: Assess flood risk
   - agricultural_monitoring: Monitor crops
   - deforestation_detection: Detect forest loss
   - water_quality_monitoring: Check water quality

7. EXAMPLE USAGE IN CLAUDE:
   "Assess the wildfire risk in California for July 2023"
   "Monitor water quality in Lake Tahoe"
   "Detect deforestation in the Amazon region"
