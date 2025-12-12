<div align="center">

# 🌍 Axion Planetary MCP
## *The Foundation for Democratizing Geospatial AI Agents*

---

## 🚀 **V2.0 - Now Powered by AWS**

> **Major Update:** Axion Planetary MCP has been completely rebuilt on AWS infrastructure for better performance, reliability, and global accessibility. No more Google Cloud setup required!

---

[![Watch the demo](https://img.youtube.com/vi/cd8twnn6en8/maxresdefault.jpg)](https://www.youtube.com/watch?v=cd8twnn6en8)

*Click the image above to watch the demo video*

<img src="https://img.shields.io/npm/v/axion-mcp?style=for-the-badge&color=blue" alt="npm version" />
<img src="https://img.shields.io/badge/downloads-7%2C458%2Fmonth-green?style=for-the-badge" alt="downloads" />
<img src="https://img.shields.io/github/license/Dhenenjay/axion-planetary-mcp?style=for-the-badge&color=orange" alt="license" />
<img src="https://img.shields.io/badge/AWS-Powered-orange?style=for-the-badge" alt="aws powered" />
<img src="https://img.shields.io/badge/MCP-Compatible-purple?style=for-the-badge" alt="mcp compatible" />

### 🚀 **Making Earth Observation as Easy as Having a Conversation**

**From PhD-level complexity to natural language queries in one install**

*"Show me crop health in Iowa"* • *"Analyze vegetation in California"* • *"Track water levels in Lake Tahoe"*

[🎯 The Revolution](#-the-geospatial-ai-revolution) • [⚡ Quick Start](#-hosted-version-2-minute-setup) • [🌟 What's Possible](#-what-becomes-possible) • [🛠️ Self-Host](#-self-hosting)

</div>

---

## ⚡ Hosted Version (2-Minute Setup!)

**Start using satellite imagery analysis immediately without any server setup!**

### 🚀 Quick Start

#### Step 1: Get Your API Key

[**Request an API key here →**](https://github.com/Dhenenjay/Axion-MCP-SSE/issues/new?title=API%20Key%20Request&body=Please%20provide%20me%20an%20API%20key%20for%20Axion%20MCP)

#### Step 2: Configure Claude Desktop

Open your Claude Desktop config file:

| OS | Config File Path |
|----|------------------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

Add the following (replace `YOUR_API_KEY`):

```json
{
  "mcpServers": {
    "axion": {
      "command": "npx",
      "args": ["-y", "axion-mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

#### Step 3: Restart Claude Desktop

Done! Ask Claude:
> *"Show me the NDVI vegetation map of Central Park, New York"*

---

### 💻 Alternative Installation Methods

#### Using Environment Variables

```json
{
  "mcpServers": {
    "axion": {
      "command": "npx",
      "args": ["-y", "axion-mcp"],
      "env": {
        "AXION_API_KEY": "your_key_here"
      }
    }
  }
}
```

#### Global Install (if npx doesn't work)

```bash
npm install -g axion-mcp
```

```json
{
  "mcpServers": {
    "axion": {
      "command": "axion-mcp",
      "args": ["--api-key", "YOUR_API_KEY"]
    }
  }
}
```

#### Using sse-bridge.mjs Directly

```json
{
  "mcpServers": {
    "axion": {
      "command": "node",
      "args": ["C:/path/to/sse-bridge.mjs", "https://axion-mcp-sse.onrender.com/sse", "YOUR_API_KEY"]
    }
  }
}
```

---

### ✨ Why Use the Hosted Version?

- **🚀 2-minute setup** - Just add config and restart
- **☁️ No server management** - Everything runs in the cloud
- **🔒 Simple API key auth** - Secure and easy
- **⚡ Always up-to-date** - Latest features automatically
- **🌍 Free satellite data** - Access Sentinel-2, Landsat, NAIP
- **💻 Zero maintenance** - No processes to manage
- **🌐 Works anywhere** - No firewall issues, no ports to open

### 📦 Hosted Server Details

- **NPM Package**: [axion-mcp](https://www.npmjs.com/package/axion-mcp)
- **Server URL**: `https://axion-mcp-sse.onrender.com`
- **Health Check**: [https://axion-mcp-sse.onrender.com/health](https://axion-mcp-sse.onrender.com/health)
- **7 powerful tools** for satellite imagery analysis

> 🌟 **Hosted Version Exclusive:** The hosted version includes **axion_sar2optical** - our proprietary **Axion Foundation Model** that converts SAR radar imagery to optical-like images, enabling cloud-free, day/night Earth observation. This AI-powered tool is only available through the hosted server.

> **Note:** The hosted server runs on Render's free tier and may take 30 seconds to wake up if idle. For always-on access, consider [self-hosting](#-self-hosting).

---

## 🎯 The Geospatial AI Revolution

**We are witnessing the "iPhone moment" for Earth observation.** Just like the iPhone made computing accessible to everyone, Axion Planetary MCP makes petabytes of satellite data accessible through simple conversation.

### 🔥 The Paradigm Shift

**Before:** Building geospatial AI required PhD expertise, months of setup, complex APIs, and massive infrastructure.

**Now:** Anyone can build sophisticated Earth observation AI agents with natural language and one command: `npm install`

```
Traditional Path: 1 Expert → 1 Year → 1 Specialized Tool
Our Path:        1 Person → 2 Minutes → Unlimited Possibilities
```

## 🌟 What Becomes Possible

### 👥 **Who Can Now Build Geospatial AI Agents:**

| **Before Axion** ❌ | **After Axion** ✅ |
|--------------------|-----------------|
| PhD researchers with GIS expertise | **Farmers**: "Monitor my fields for crop health" |
| Large corporations with dedicated teams | **City Planners**: "Track urban expansion patterns" |
| Government agencies with massive budgets | **NGOs**: "Monitor deforestation in real-time" |
| Tech giants with infrastructure | **Students**: "Study climate change impacts" |
| | **Small Businesses**: "Analyze supply chain risks" |
| | **Anyone**: Who can install npm and talk to AI |

### 🚀 **Real-World Transformations**

#### **Precision Agriculture Revolution** 🌾
```
Farmer: "Create an AI agent that monitors my 500-acre farm"
Result: Daily crop health reports, irrigation optimization, 
        vegetation stress detection, yield predictions
```

#### **Environmental Monitoring** 🌊
```
Researcher: "Track water quality in Lake Tahoe"
Result: Water index analysis, temporal changes,
        algae bloom detection, quality reports
```

#### **Urban Planning** 🏙️
```
Planner: "Analyze urban heat islands in Phoenix"
Result: Surface temperature maps, vegetation coverage,
        heat mitigation recommendations
```

---

## 🛠️ Available Tools (6)

### axion_data
Search satellite imagery from multiple collections:
- **Sentinel-2** (10m resolution, 5-day revisit)
- **Landsat 8/9** (30m resolution, 16-day revisit)
- **NAIP** (1m aerial imagery, US only)

### axion_map
Create interactive maps with:
- Vegetation indices (NDVI, EVI, SAVI)
- Water indices (NDWI, MNDWI)
- Built-up index (NDBI)
- True/false color composites
- Custom band expressions

### axion_process
Process imagery:
- Cloud-free composites
- Temporal mosaics
- 9+ spectral indices
- Band math expressions

### axion_classification
ML land cover classification:
- Random Forest classifier
- Custom training points
- Multi-class output
- Accuracy metrics

### axion_export
Export options:
- GeoTIFF downloads
- PNG thumbnails
- Map tiles (XYZ)
- Cloud storage (S3)

### axion_system
System utilities:
- Health check
- Configuration info
- Available collections

---

## 📚 Example Queries

**Just talk to Claude like you would a geospatial expert:**

### 🌾 **Agriculture & Food Security**
> *"Show me NDVI vegetation health for Iowa farmland"*
> 
> *"Create a crop classification map for California's Central Valley"*
> 
> *"Which areas show vegetation stress this month?"*

### 🌊 **Water Resources**
> *"Calculate water index for Lake Mead"*
> 
> *"Show me water bodies in the Nevada desert"*
> 
> *"Track reservoir levels over time"*

### 🏢 **Urban Planning**
> *"Map urban expansion in Austin, Texas"*
> 
> *"Show built-up areas vs green spaces in Seattle"*
> 
> *"Analyze land use changes in Denver"*

### 🌲 **Environmental Monitoring**
> *"Monitor forest health in Yellowstone"*
> 
> *"Create a false color composite of the Amazon"*
> 
> *"Show vegetation changes between 2020 and 2024"*

---

## 🐳 Self-Hosting

Want to run your own Axion MCP server? **No cloud credentials required** for basic functionality!

### Prerequisites

- **Docker** (recommended) OR **Node.js 18+**
- That's it! Satellite data comes from free public APIs.

### Option 1: Docker (Recommended)

```bash
# Clone this repository
git clone https://github.com/Dhenenjay/Axion-Planetary-MCP
cd Axion-Planetary-MCP

# Build the Docker image
docker build -t axion-mcp .

# Run without authentication (for local/personal use)
docker run -p 3000:3000 -e REQUIRE_AUTH=false axion-mcp

# OR run with authentication (for production/shared use)
docker run -p 3000:3000 \
  -e REQUIRE_AUTH=true \
  -e AXION_API_KEY=your-secret-key-here \
  axion-mcp

# Test it's working
curl http://localhost:3000/health
# Should return: {"status":"healthy","tools":6}
```

### Option 2: Run from Source

```bash
# Clone and install
git clone https://github.com/Dhenenjay/Axion-Planetary-MCP
cd Axion-Planetary-MCP
npm install

# Build the SSE server
npm run build:sse

# Run (no auth)
REQUIRE_AUTH=false npm run start:sse

# OR with auth
REQUIRE_AUTH=true AXION_API_KEY=your-key npm run start:sse
```

### Connect Claude Desktop to Your Server

**Without authentication:**
```json
{
  "mcpServers": {
    "axion-local": {
      "command": "node",
      "args": ["C:/path/to/Axion-Planetary-MCP/sse-bridge.mjs", "http://localhost:3000/sse"]
    }
  }
}
```

**With authentication:**
```json
{
  "mcpServers": {
    "axion-local": {
      "command": "node",
      "args": ["C:/path/to/Axion-Planetary-MCP/sse-bridge.mjs", "http://localhost:3000/sse", "your-secret-key-here"]
    }
  }
}
```

### Cloud Deployment

The included `Dockerfile` works with any container platform:

| Platform | How to Deploy |
|----------|---------------|
| **Render** | Fork repo → New Web Service → Connect GitHub → Deploy |
| **Railway** | `railway init` → `railway up` |
| **Fly.io** | `flyctl launch` → `flyctl deploy` |
| **AWS ECS** | Push to ECR → Create task definition → Run service |
| **Google Cloud Run** | `gcloud run deploy` |

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `REQUIRE_AUTH` | No | Enable API key auth (default: true) |
| `AXION_API_KEY` | If auth enabled | Your API key for authentication |
| `AWS_ACCESS_KEY_ID` | No | For S3 exports only |
| `AWS_SECRET_ACCESS_KEY` | No | For S3 exports only |
| `AWS_REGION` | No | AWS region (default: us-east-1) |
| `AXION_S3_EXPORTS_BUCKET` | No | S3 bucket for GeoTIFF exports |

### What You Get Without Any Credentials

✅ **Full satellite data search** (Sentinel-2, Landsat, NAIP)  
✅ **Interactive map generation** (NDVI, NDWI, false color, etc.)  
✅ **Image processing** (composites, indices, band math)  
✅ **ML classification** (Random Forest land cover)  
✅ **System health & info**  

### What Requires AWS Credentials (Optional)

⚠️ **GeoTIFF exports to S3** - requires AWS credentials and S3 bucket  
⚠️ **Large file downloads** - exports over 10MB need S3

### Docker Compose Example

```yaml
version: '3.8'
services:
  axion:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REQUIRE_AUTH=true
      - AXION_API_KEY=${AXION_API_KEY}  # Set in .env file
      # Optional AWS for exports:
      # - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      # - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    restart: unless-stopped
```

---

## 📡 Data Sources

| Collection | Resolution | Coverage | Revisit |
|------------|-----------|----------|---------|
| Sentinel-2 L2A | 10-60m | Global | 5 days |
| Landsat C2 L2 | 30m | Global | 16 days |
| NAIP | 0.6-1m | USA | 2-3 years |

All data accessed via [AWS Earth Search STAC API](https://earth-search.aws.element84.com/v1) (free, no auth required).

---

## 🔧 Troubleshooting

### "Command not found: npx"
Install Node.js 18+ from [nodejs.org](https://nodejs.org)

### "Unauthorized - Invalid API key"
1. Verify your API key is correct
2. Make sure there are no extra spaces
3. Try with environment variable: `"env": { "AXION_API_KEY": "your_key" }`

### "Connection refused"
The hosted server may be sleeping (free tier). Wait 30 seconds and try again, or self-host.

### Claude doesn't show Axion tools
1. Completely quit Claude Desktop
2. Check config JSON syntax at [jsonlint.com](https://jsonlint.com)
3. Restart Claude Desktop
4. Look for "axion" in Claude's tool list

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Claude AI     │  (Your AI Assistant)
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────┐
│  axion-mcp      │  (NPM Bridge Package)
└────────┬────────┘
         │ SSE/HTTP
         ▼
┌─────────────────┐
│  Axion Server   │  (Cloud or Self-hosted)
└────────┬────────┘
         │ STAC API
         ▼
┌─────────────────┐
│  AWS Earth      │  (Free Satellite Data)
│  Search         │  Sentinel-2, Landsat, NAIP
└─────────────────┘
```

---

## 🤝 Contributing

Contributions welcome! Please feel free to:
- Report bugs via [GitHub Issues](https://github.com/Dhenenjay/Axion-Planetary-MCP/issues)
- Submit pull requests
- Suggest new features
- Improve documentation

---

## 📄 License

MIT License - feel free to use in your projects!

---

## 💬 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Dhenenjay/Axion-Planetary-MCP/issues)
- **Hosted Server**: [axion-mcp-sse.onrender.com](https://axion-mcp-sse.onrender.com)
- **NPM Package**: [axion-mcp](https://www.npmjs.com/package/axion-mcp)

---

<div align="center">

## 🎆 **The Future is Now**

**This isn't just a tool—it's the foundation of a revolution.**

We're democratizing Earth observation, making geospatial intelligence as accessible as sending a text message.

### 🌍 What Will You Build?

🌾 **Agricultural AI that monitors crops?** • 🌊 **Water analysis that tracks resources?** • 🌳 **Forest monitoring that fights climate change?**

---

**The Earth is waiting. The tools are ready. The only question is: what will you discover?**

*From PhD-level complexity to conversational simplicity in one command* ✨

**Built with ❤️ to accelerate humanity's response to our biggest challenges**

</div>
