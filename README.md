<div align="center">

# 🌍 Axion Planetary MCP

<img src="https://img.shields.io/npm/v/axion-planetary-mcp?style=for-the-badge&color=blue" alt="npm version" />
<img src="https://img.shields.io/npm/dm/axion-planetary-mcp?style=for-the-badge&color=green" alt="downloads" />
<img src="https://img.shields.io/github/license/Dhenenjay/axion-planetary-mcp?style=for-the-badge&color=orange" alt="license" />
<img src="https://img.shields.io/badge/MCP-Compatible-purple?style=for-the-badge" alt="mcp compatible" />

**Transform any MCP client into a Geospatial Analysis Powerhouse** 🚀

Access **petabytes of satellite imagery** • Perform **advanced Earth observation** • Create **interactive maps** • Run **ML-powered analysis**

[Installation](#-quick-install) • [Earth Engine Setup](#-google-earth-engine-setup-required) • [Features](#-features) • [Usage](#-usage-examples) • [Support](#-support)

</div>

---

## 🎯 What is This?

**Axion Planetary MCP** bridges the gap between AI assistants and Earth observation capabilities. It gives any MCP-compatible client (Claude Desktop, Cline, etc.) direct access to Google Earth Engine's massive satellite data catalog and analysis capabilities.

### 🌟 Key Capabilities

| Feature | Description |
|---------|-------------|
| **🛰️ Satellite Data Access** | Direct access to Landsat, Sentinel, MODIS, and 100+ other satellite datasets |
| **📊 30+ Analysis Tools** | NDVI, water stress, urban expansion, disaster monitoring, and more |
| **🗺️ Interactive Maps** | Generate web-based interactive maps with your analysis results |
| **🤖 5 Pre-trained Models** | Wildfire risk, flood prediction, agriculture health, deforestation, water quality |
| **🌾 Smart Crop Classification** | ML-powered crop identification with automatic urban/water/vegetation detection |
| **⚡ Real-time Processing** | Process live satellite data on-demand |
| **📦 Export Capabilities** | Export results as GeoTIFF, create animations, generate reports |

## 📋 Prerequisites

Before installation, ensure you have:

- ✅ **Node.js 18+** installed ([Download here](https://nodejs.org/))
- ✅ **Google Cloud Account** (free tier works)
- ✅ **MCP-compatible Client** (Claude Desktop, Cline, etc.)
- ✅ **4GB RAM** minimum (8GB recommended)
- ✅ **2GB free disk space**

## ⚡ Installation

### Option 1: Global Installation (Recommended)

Install globally to use the `axion-mcp` CLI command from anywhere:

```bash
npm install -g axion-planetary-mcp@latest
```

Or with yarn:
```bash
yarn global add axion-planetary-mcp@latest
```

### Option 2: Local Installation

For project-specific installation:

```bash
npm install axion-planetary-mcp@latest
```

### Verify Installation

After installation, verify it worked:

```bash
# For global installation
axion-mcp --version

# Check where it's installed
npm list -g axion-planetary-mcp
```

### Update to Latest Version

```bash
npm update -g axion-planetary-mcp
```

## 🔑 Google Earth Engine Setup (REQUIRED)

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"** or select existing project
3. Give it a name (e.g., "earth-engine-mcp")
4. Note your **Project ID** - you'll need this

### Step 2: Enable Required APIs

In your Google Cloud project, enable these APIs:

1. Go to **APIs & Services** → **Enable APIs and Services**
2. Search and enable:
   - ✅ **Earth Engine API** (CRITICAL!)
   - ✅ **Cloud Storage API** (for exports)
   - ✅ **Cloud Resource Manager API**

### Step 3: Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **"+ CREATE SERVICE ACCOUNT"**
3. Fill in:
   - **Name**: `earth-engine-sa`
   - **ID**: (auto-generated)
   - **Description**: "Service account for Earth Engine MCP"
4. Click **"CREATE AND CONTINUE"**

### Step 4: Assign IAM Roles

Add these EXACT roles to your service account:

| Role | Why It's Needed |
|------|-----------------|
| **Earth Engine Resource Admin (Beta)** | Full access to Earth Engine resources |
| **Earth Engine Resource Viewer (Beta)** | Read access to Earth Engine datasets |
| **Service Usage Consumer** | Use Google Cloud services |
| **Storage Admin** | Manage exports to Cloud Storage |
| **Storage Object Creator** | Create export files |

**How to add roles:**
1. In the "Grant this service account access" section
2. Click **"Add Role"**
3. Search for each role above and add it
4. Click **"CONTINUE"** then **"DONE"**

### Step 5: Generate JSON Key

1. Click on your newly created service account
2. Go to **"Keys"** tab
3. Click **"ADD KEY"** → **"Create new key"**
4. Choose **JSON** format
5. Click **"CREATE"** - file downloads automatically
6. **SAVE THIS FILE SECURELY!** You'll need it for authentication

### Step 6: Register for Earth Engine

1. Go to [Earth Engine Sign Up](https://signup.earthengine.google.com/)
2. Select **"Use with a Cloud Project"**
3. Enter your **Project ID** from Step 1
4. Complete the registration

### Step 7: Register Your Service Account with Earth Engine

**CRITICAL STEP**: Your service account must be registered with Earth Engine to access data!

1. Go to [Earth Engine Service Accounts](https://code.earthengine.google.com/register)
2. Click **"Register a service account"**
3. Enter your service account email (format: `earth-engine-sa@YOUR-PROJECT-ID.iam.gserviceaccount.com`)
4. Click **"Register"**
5. Wait for confirmation (usually instant)

**To find your service account email:**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Navigate to **IAM & Admin** → **Service Accounts**
- Copy the email address of your `earth-engine-sa` account

### Step 8: Save Credentials

Save your JSON key file to one of these locations:

**Windows:**
```powershell
# Create directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.config\earthengine"

# Copy your key file there
Copy-Item "C:\Downloads\your-key-file.json" "$env:USERPROFILE\.config\earthengine\credentials.json"
```

**Mac/Linux:**
```bash
# Create directory if it doesn't exist
mkdir -p ~/.config/earthengine

# Copy your key file there
cp ~/Downloads/your-key-file.json ~/.config/earthengine/credentials.json
```

**Alternative:** Set environment variable
```bash
# Windows
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\credentials.json

# Mac/Linux
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/credentials.json
```

## 🚀 Complete Setup Guide

### 1️⃣ Run Setup Wizard

After installing the package, run:

```bash
axion-mcp
```

This wizard will:
- ✅ Check your Earth Engine credentials
- ✅ Generate MCP configuration
- ✅ Provide exact setup instructions

### 2️⃣ Start the Next.js Backend (CRITICAL!)

The MCP server requires a Next.js backend to be running. 

**Open a NEW terminal window** and run:

```bash
# Navigate to the package directory (path shown by setup wizard)
# Windows example:
cd C:\Users\[YourUsername]\AppData\Roaming\npm\node_modules\axion-planetary-mcp

# Mac example:
cd /usr/local/lib/node_modules/axion-planetary-mcp

# Start the server
npm run start:next
```

You should see:
```
▲ Next.js 15.2.4
- Local: http://localhost:3000
✓ Ready
```

**⚠️ IMPORTANT: Keep this terminal window open while using the MCP client!**

### 3️⃣ Configure Your MCP Client

The setup wizard shows you a JSON configuration. Add it to your MCP client's config file:

**Claude Desktop Config Locations:**

| OS | Config File Location |
|----|---------------------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Mac** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/claude/claude_desktop_config.json` |

**Example Configuration:**
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

### 4️⃣ Restart Your MCP Client

Completely quit and restart your MCP client to load the new configuration.

### 5️⃣ Test It!

Ask your MCP client:
- "Show me current NDVI for California farmland"
- "Create a crop classification map for Iowa"
- "Analyze urban heat islands in Los Angeles"

## ✨ Features

### 🛠️ Core Tools

#### 1. **Data Discovery & Access** (`earth_engine_data`)
- Search satellite datasets
- Filter by date, location, cloud cover
- Access dataset metadata
- Get region boundaries

#### 2. **Processing & Analysis** (`earth_engine_process`)
- Calculate vegetation indices (NDVI, EVI, SAVI, etc.)
- Create cloud-free composites
- Perform terrain analysis
- Generate statistics and time series

#### 3. **Export & Visualization** (`earth_engine_export`)
- Export to GeoTIFF format
- Generate thumbnails
- Create map tiles
- Track export status

#### 4. **Interactive Maps** (`earth_engine_map`)
- Create web-based interactive maps
- Visualize large regions
- Multiple layer support
- Share results via URL

#### 5. **System Operations** (`earth_engine_system`)
- Check authentication status
- Execute custom Earth Engine code
- Monitor system health

### 🤖 Pre-trained Models

| Model | Use Case | Example |
|-------|----------|---------|
| **🔥 Wildfire Risk** | Assess fire danger zones | "Analyze wildfire risk in California" |
| **💧 Flood Prediction** | Identify flood-prone areas | "Show flood risk for Houston" |
| **🌾 Agriculture Health** | Monitor crop conditions | "Check crop health in Iowa farmland" |
| **🌲 Deforestation** | Detect forest loss | "Monitor Amazon deforestation since 2020" |
| **🏊 Water Quality** | Analyze water bodies | "Assess water quality in Lake Tahoe" |

### 🌾 Advanced Crop Classification

The crop classification tool includes:
- **Automatic augmentation** with urban, water, and vegetation classes
- **Pre-configured training data** for major US states
- **Multiple classifiers**: Random Forest, SVM, CART, Naive Bayes
- **Interactive result maps**

Supported regions with built-in training data:
- Iowa (corn, soybean)
- California (almonds, grapes, citrus, rice)
- Texas (cotton, wheat, sorghum)
- Kansas (wheat, corn, sorghum, soybean)
- Nebraska (corn, soybean, wheat)
- Illinois (corn, soybean, wheat)

## 📚 Usage Examples

### Basic Vegetation Analysis
```
"Calculate NDVI for Central Valley California in summer 2024"
"Show me vegetation health changes in the Amazon over the last year"
"Analyze drought impact on Texas grasslands"
```

### Crop Classification & Agriculture
```
"Create a crop classification map for Iowa with corn and soybean identification"
"Identify irrigated vs non-irrigated fields in Nebraska"
"Monitor crop growth stages in Kansas wheat fields"
```

### Urban & Environmental Monitoring
```
"Track urban expansion in Phoenix from 2015 to 2024"
"Identify heat islands in New York City"
"Monitor construction progress in developing areas of Austin"
```

### Water Resources
```
"Analyze water level changes in Lake Mead over the past decade"
"Detect algae blooms in the Great Lakes"
"Monitor coastal erosion in Miami Beach"
```

### Disaster Response
```
"Assess wildfire damage in recent California fires"
"Map flood extent after Hurricane Ian"
"Evaluate earthquake damage using before/after imagery"
```

### Custom Analysis
```
"Create a time series animation of Las Vegas growth since 2000"
"Export NDVI data for my farm coordinates as GeoTIFF"
"Generate a false color composite highlighting vegetation stress"
```

## 🎓 Understanding the Architecture

```
┌─────────────────┐
│   MCP Client    │  (Claude Desktop, Cline, etc.)
└────────┬────────┘
         │ stdio/JSON-RPC
         ▼
┌─────────────────┐
│  MCP SSE Bridge │  (mcp-sse-complete.cjs)
└────────┬────────┘
         │ HTTP/SSE
         ▼
┌─────────────────┐
│  Next.js API    │  (localhost:3000/api/mcp/sse)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Earth Engine   │  (Processing & Analysis)
└─────────────────┘
```

The system uses a bridge architecture where:
1. MCP client communicates via stdio/JSON-RPC
2. Bridge converts to HTTP/Server-Sent Events
3. Next.js backend handles Earth Engine operations
4. Results flow back through the same pipeline

## 🔧 Troubleshooting

### "MCP server not responding"

**Solution:**
1. ✅ Ensure Next.js server is running in separate terminal
2. ✅ Check http://localhost:3000 is accessible
3. ✅ Restart your MCP client
4. ✅ Verify config file path uses forward slashes (/)

### "Earth Engine authentication failed"

**Solution:**
1. ✅ Verify credentials.json exists and is valid JSON
2. ✅ Confirm all 5 IAM roles are assigned to service account
3. ✅ Check Earth Engine API is enabled in Google Cloud
4. ✅ Ensure you've registered for Earth Engine with your project
5. ✅ **CRITICAL**: Verify service account is registered at https://code.earthengine.google.com/register

### "Request failed" errors

**Solution:**
1. ✅ Next.js server MUST be running (npm run start:next)
2. ✅ Port 3000 must be free
3. ✅ Check Windows Firewall isn't blocking port 3000

### Maps not displaying

**Solution:**
1. ✅ Explicitly request map creation: "create a map showing..."
2. ✅ Visit http://localhost:3000 to verify server is running
3. ✅ Check browser console for errors

### Port 3000 already in use

**Solution:**
```bash
# Use different port
$env:PORT=3001; npm run start:next  # Windows
PORT=3001 npm run start:next         # Mac/Linux
```

### Installation issues

**Solution:**
1. ✅ Use Node.js 18 or higher: `node --version`
2. ✅ Clear npm cache: `npm cache clean --force`
3. ✅ Run as Administrator (Windows)
4. ✅ Try without `-g`: `npm install axion-planetary-mcp`

## 🌟 Pro Tips

### Optimize Performance
- Use `scale` parameter for faster processing (higher number = lower resolution)
- Filter by cloud cover for cleaner imagery
- Specify date ranges to limit data processing

### Better Results
- Request "cloud-free composite" for clearer images
- Use "median composite" to reduce noise
- Add "with interactive map" to get visual results

### Advanced Features
- Chain operations: "Calculate NDVI, then create a map"
- Export results: "Export the analysis as GeoTIFF"
- Time series: "Show monthly changes over 2024"

## 📊 Available Datasets

Popular datasets you can access:

| Dataset | Description | Best For |
|---------|-------------|----------|
| **Sentinel-2** | 10m resolution, 5-day revisit | Detailed land analysis |
| **Landsat 8/9** | 30m resolution, 16-day revisit | Long-term monitoring |
| **MODIS** | Daily imagery, 250m-1km resolution | Large area analysis |
| **Sentinel-1** | Radar imagery, works through clouds | Flood detection |
| **NAIP** | 1m resolution aerial imagery (US only) | High-detail mapping |

## 📈 Performance & Limits

- **Processing Scale**: 10m to 1000m resolution
- **Region Size**: Best for areas under 10,000 km²
- **Time Range**: Data from 1972 to present
- **Export Size**: Up to 10GB per file
- **Rate Limits**: Respects Earth Engine quotas

## 🤝 Contributing

We welcome contributions! Please feel free to:
- Report bugs via [GitHub Issues](https://github.com/Dhenenjay/axion-planetary-mcp/issues)
- Submit pull requests
- Suggest new features
- Improve documentation

## 📄 License

MIT License - feel free to use in your projects!

## 💬 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Dhenenjay/axion-planetary-mcp/issues)
- **Discussions**: [Ask questions and share tips](https://github.com/Dhenenjay/axion-planetary-mcp/discussions)
- **Documentation**: [Wiki and guides](https://github.com/Dhenenjay/axion-planetary-mcp/wiki)

## 🙏 Acknowledgments

- Google Earth Engine team for the amazing platform
- Anthropic for the MCP protocol
- The open-source geospatial community
- All contributors and users

---

<div align="center">

**Built with ❤️ for the Earth observation community**

*Transform your MCP client into a window to our planet* 🌍

</div>