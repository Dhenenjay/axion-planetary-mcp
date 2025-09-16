<div align="center">
  
# 🌍 Axion Planetary MCP

### Transform Claude Desktop into a Geospatial Analysis Powerhouse

[![npm version](https://img.shields.io/npm/v/axion-planetary-mcp)](https://www.npmjs.com/package/axion-planetary-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Earth Engine](https://img.shields.io/badge/Google-Earth%20Engine-4285F4)](https://earthengine.google.com/)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-6366F1)](https://claude.ai/download)

**Access Google Earth Engine's massive satellite data catalog through natural conversation in Claude Desktop**

[Quick Start](#-quick-start) • [Features](#-features) • [Setup Guide](#-setup-guide) • [Examples](#-examples) • [Support](#-support)

</div>

---

## 🎯 What is Axion Planetary MCP?

Axion Planetary MCP bridges **Google Earth Engine** with **Claude Desktop**, enabling you to analyze satellite imagery, monitor environmental changes, and perform complex geospatial analysis using simple natural language commands.

### 🚀 Transform Complex Code Into Simple Conversations

**Before:** Write complex JavaScript/Python code
```javascript
// Traditional Earth Engine approach
var collection = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(ee.Geometry.Point([-122.4, 37.8]))
  .filterDate('2024-01-01', '2024-01-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));
var ndvi = collection.median().normalizedDifference(['B8', 'B4']);
// ... more complex code ...
```

**After:** Just ask Claude naturally
> "Calculate NDVI for San Francisco in January 2024 using Sentinel-2 imagery"

---

## ⚡ Quick Start

### Option 1: NPM Installation (Recommended - 3 minutes)

```bash
# Install globally
npm install -g axion-planetary-mcp

# Run interactive setup wizard
axion-mcp init

# That's it! Restart Claude Desktop and start using
```

### Option 2: Custom Setup (For developers)

Clone and configure manually - see [Custom Setup Guide](#custom-setup-guide)

---

## 🌟 Features

### 🛰️ **Satellite Data Access**
- **Landsat** - 50+ years of Earth observation
- **Sentinel** - High-resolution European satellites  
- **MODIS** - Daily global coverage
- **100+ more datasets** - Climate, weather, terrain, and more

### 🔬 **Analysis Capabilities**
- **Vegetation Indices** - NDVI, EVI, SAVI, and more
- **Change Detection** - Monitor deforestation, urbanization
- **Climate Analysis** - Temperature, precipitation trends
- **Water Monitoring** - Quality, extent, and changes
- **Agricultural Assessment** - Crop health and classification

### 🗺️ **Advanced Models**
- 🔥 **Wildfire Risk Assessment** - Predict fire danger zones
- 🌊 **Flood Risk Analysis** - Evaluate flood potential
- 🌾 **Agricultural Monitoring** - Track crop health
- 🌲 **Deforestation Detection** - Monitor forest loss
- 💧 **Water Quality Assessment** - Analyze water bodies

### 🎨 **Visualization**
- Interactive web maps
- Time-lapse animations
- Custom band combinations
- Export to various formats

---

## 📋 Setup Guide

### Prerequisites

1. **Claude Desktop** - [Download here](https://claude.ai/download)
2. **Node.js 18+** - [Download here](https://nodejs.org/)
3. **Google Cloud Account** - [Free tier available](https://cloud.google.com/free)

### 🔑 Step 1: Get Google Earth Engine Access

<details>
<summary><b>📖 Detailed GCP Service Account Setup (Click to expand)</b></summary>

#### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., "earth-engine-mcp")
4. Note your Project ID

#### 2. Enable Earth Engine API
1. In your project, go to "APIs & Services" → "Library"
2. Search for "Earth Engine API"
3. Click on it and press "Enable"

#### 3. Create Service Account
1. Go to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Name: `earth-engine-service`
4. Description: "Service account for Axion Planetary MCP"
5. Click "Create and Continue"

#### 4. Add Required Roles
Add these roles to your service account:
- **Earth Engine Resource Admin** (Beta)
- **Earth Engine Resource Viewer** (Beta)
- **Service Usage Consumer**
- **Storage Admin**
- **Storage Object Creator**

<img src="https://user-images.githubusercontent.com/placeholder/gcp-roles.png" alt="GCP Roles" width="400"/>

#### 5. Create and Download Key
1. Click on your service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON" format
5. Download and save securely (e.g., `C:\Users\YourName\ee-key.json`)

#### 6. Register with Earth Engine
1. Visit [Earth Engine registration](https://signup.earthengine.google.com/#!/service_accounts)
2. Enter your service account email: `earth-engine-service@YOUR-PROJECT-ID.iam.gserviceaccount.com`
3. Submit and wait for approval (usually instant)

</details>

### 🚀 Step 2: Install Axion Planetary MCP

```bash
npm install -g axion-planetary-mcp
```

### 🎯 Step 3: Run Setup Wizard

```bash
axion-mcp init
```

The wizard will:
- ✅ Guide you through credential setup
- ✅ Configure Claude Desktop automatically
- ✅ Test Earth Engine connection
- ✅ Provide usage examples

### ✨ Step 4: Start Using!

1. **Restart Claude Desktop**
2. You'll see the MCP indicator in Claude
3. Start with a simple query:
   > "Use Earth Engine to show me current vegetation health in California"

---

## 💡 Examples

### Basic Analysis
```
"Calculate NDVI for the Amazon rainforest in December 2023"
"Show me urban growth in Dubai from 2010 to 2024"
"Find all Landsat images of Tokyo with less than 10% cloud cover"
```

### Advanced Analysis
```
"Analyze deforestation patterns in the Amazon over the last 5 years"
"Create a flood risk map for Bangladesh using recent rainfall data"
"Monitor crop health in Iowa's corn fields this growing season"
"Assess wildfire risk in California for the next fire season"
```

### Environmental Monitoring
```
"Track water level changes in Lake Mead over the past decade"
"Analyze air quality trends in Beijing using MODIS data"
"Monitor glacier retreat in the Himalayas"
"Detect illegal mining activities in protected forests"
```

---

## 🛠️ Commands Reference

| Command | Description |
|---------|-------------|
| `axion-mcp init` | Run interactive setup wizard |
| `axion-mcp start` | Start the Next.js visualization server |
| `axion-mcp status` | Check configuration and server status |
| `axion-mcp test` | Test Earth Engine connection |
| `axion-mcp update` | Update to latest version |
| `axion-mcp help` | Show all available commands |

---

## 🎓 Custom Setup Guide

<details>
<summary><b>For developers who want manual control</b></summary>

### 1. Clone the repository
```bash
git clone https://github.com/Dhenenjay/axion-planetary-mcp.git
cd axion-planetary-mcp
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Create `.env.local`:
```env
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/ee-key.json
GCS_BUCKET=your-bucket-name (optional)
PORT=3000
```

### 4. Build the project
```bash
npm run build
npm run build:next
```

### 5. Configure Claude Desktop
Edit `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "axion-planetary": {
      "command": "node",
      "args": ["path/to/axion-planetary-mcp/dist/index.mjs"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "path/to/ee-key.json"
      }
    }
  }
}
```

### 6. Start servers
```bash
# Terminal 1: Next.js server
npm run start:next

# Terminal 2: Test the setup
npm run test
```

</details>

---

## 📚 Available Tools

### Core Tools
- **earth_engine_data** - Search and access satellite datasets
- **earth_engine_process** - Process imagery (indices, composites, analysis)
- **earth_engine_export** - Export data and create visualizations
- **earth_engine_system** - System operations and health checks

### Specialized Tools
- **earth_engine_map** - Create interactive web maps
- **crop_classification** - Advanced crop type classification

---

## 🔧 Troubleshooting

<details>
<summary><b>Common Issues and Solutions</b></summary>

### Claude doesn't see the MCP
1. Ensure Claude Desktop is completely closed
2. Run `axion-mcp status` to check configuration
3. Restart Claude Desktop
4. Check logs in `%APPDATA%\Claude\logs\`

### Earth Engine authentication fails
1. Verify service account has Earth Engine access
2. Check if Earth Engine API is enabled in GCP
3. Ensure service account has required roles
4. Run `axion-mcp test` to diagnose

### Server won't start
1. Check if port 3000 is available
2. Verify Node.js version is 18+
3. Run `npm install` to ensure dependencies
4. Check firewall settings

### "Module not found" errors
```bash
npm install -g axion-planetary-mcp --force
```

</details>

---

## 🌍 Use Cases

### 🔬 **Research & Academia**
- Climate change impact assessment
- Biodiversity monitoring
- Urban planning studies
- Archaeological site detection

### 🌾 **Agriculture**
- Crop yield prediction
- Irrigation optimization
- Pest and disease monitoring
- Precision farming

### 🏛️ **Government & NGOs**
- Disaster response planning
- Environmental compliance
- Natural resource management
- Policy impact assessment

### 🏢 **Commercial**
- Site selection analysis
- Supply chain monitoring
- Insurance risk assessment
- Real estate development

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
git clone https://github.com/Dhenenjay/axion-planetary-mcp.git
cd axion-planetary-mcp
npm install
npm run dev
```

---

## 📊 Performance

- **Response Time**: < 2 seconds for most queries
- **Data Processing**: Handles gigapixel imagery
- **Coverage**: Global, with historical data back to 1972
- **Resolution**: From 10m (Sentinel) to 30m (Landsat)

---

## 🔐 Security & Privacy

- **Local Processing**: Your credentials stay on your machine
- **Secure Communication**: All Earth Engine API calls are encrypted
- **No Data Collection**: We don't collect or store your queries
- **Open Source**: Fully auditable codebase

---

## 📄 License

MIT © [Dhenenjay](https://github.com/Dhenenjay)

---

## 🆘 Support

- 📖 [Documentation](https://github.com/Dhenenjay/axion-planetary-mcp/wiki)
- 💬 [Discussions](https://github.com/Dhenenjay/axion-planetary-mcp/discussions)
- 🐛 [Issue Tracker](https://github.com/Dhenenjay/axion-planetary-mcp/issues)
- 📧 Email: support@axionplanetary.dev

---

## 🙏 Acknowledgments

- Google Earth Engine team for the incredible platform
- Anthropic for Claude and the MCP protocol
- The open-source community for invaluable contributions

---

<div align="center">
  
**Built with ❤️ for the Earth observation community**

[⬆ Back to top](#-axion-planetary-mcp)

</div>