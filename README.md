# Axion Planetary MCP

The Foundation for Democratizing Geospatial AI Agents.

[![npm version](https://img.shields.io/npm/v/axion-planetary-mcp?style=flat-square&color=blue)](https://www.npmjs.com/package/axion-planetary-mcp)
[![downloads](https://img.shields.io/badge/downloads-7%2C458%2Fmonth-green?style=flat-square)](https://www.npmjs.com/package/axion-planetary-mcp)
[![license](https://img.shields.io/github/license/Dhenenjay/axion-planetary-mcp?style=flat-square&color=orange)](https://github.com/Dhenenjay/axion-planetary-mcp/blob/main/LICENSE)

Axion Planetary MCP provides a Model Context Protocol (MCP) server that bridges AI assistants with Google Earth Engine. It enables users to perform geospatial analysis, access satellite data, and generate maps using natural language queries.

## Axion Foundation Model (Hosted MCP Only)

**Note:** Currently in maintenance. All other tools are available except optical generation.

**The World's First Petabyte-Scale SAR-to-Optical Foundation Model.**

Our breakthrough Axion foundation model transforms synthetic aperture radar (SAR) imagery into crystal-clear optical views, allowing for visibility through clouds 24/7. The architecture (TerraMind encoder + DARN adaptive decoder) achieves 86.66% mIoU accuracy and is currently under review for CVPR 2026.

The full foundation model with SAR-to-Optical processing and multi-modal outputs (RGB, DEM, LULC, NDVI) is **exclusively available through our hosted MCP server**.

[Research Paper](https://arxiv.org/abs/2511.04766) | [Learn More](https://axionorbital.space)

## Research Paper

**DARN: Dynamic Adaptive Regularization Networks for Efficient and Robust Foundation Model Adaptation**

We have published our research paper on arXiv. The paper introduces a novel architecture for foundation model adaptation in geospatial analysis, featuring dynamic regularization to handle heterogeneity in satellite imagery.

[Read the paper on arXiv](https://arxiv.org/abs/2511.04766)

## Hosted Version

For immediate access without local server setup, use the hosted version via `axion-mcp-bridge`.

### Quick Start

1.  **Install the bridge globally:**
    ```bash
    npm install -g axion-mcp-bridge
    ```

2.  **Add to your MCP client configuration:**

    **Claude Desktop (Windows):**
    ```json
    {
      "mcpServers": {
        "axion-mcp": {
          "command": "node",
          "args": [
            "C:\\Users\\YourUsername\\AppData\\Roaming\\npm\\node_modules\\axion-mcp-bridge\\bridge.js"
          ]
        }
      }
    }
    ```

    **Mac/Linux:**
    ```json
    {
      "mcpServers": {
        "axion-mcp": {
          "command": "node",
          "args": [
            "/usr/local/lib/node_modules/axion-mcp-bridge/bridge.js"
          ]
        }
      }
    }
    ```

    To find your exact path, run `npm root -g` and append `/axion-mcp-bridge/bridge.js`.

3.  **Restart your MCP client.**

### Hosted Version Details
*   **NPM Package**: [axion-mcp-bridge](https://www.npmjs.com/package/axion-mcp-bridge)
*   **Server Status**: `https://axion-mcp.onrender.com`
*   **Authentication**: Handled automatically (no Google Cloud setup required for hosted version).

## Foundation Model Integration

Axion MCP is powered by a foundation model trained on satellite imagery. It combines multi-sensor fusion (Landsat, Sentinel, SAR) and computer vision to generate data products.

**Key Capabilities:**
*   **Foundation Model**: Custom-trained on satellite imagery.
*   **Real-time Inference**: Rapid generation of data products.
*   **Multi-sensor Fusion**: Combines various data sources.
*   **Analytics**: Cloud removal, super-resolution, and predictive modeling.

## Overview

Axion Planetary MCP connects AI assistants to Google Earth Engine's data catalog. It allows users to build geospatial AI agents using standard MCP-compatible clients.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Satellite Data Access** | Access to Landsat, Sentinel, MODIS, and other datasets. |
| **Analysis Tools** | NDVI, water stress, urban expansion, disaster monitoring. |
| **Interactive Maps** | Generate web-based interactive maps. |
| **Pre-trained Models** | Wildfire risk, flood prediction, agriculture health, deforestation, water quality. |
| **Crop Classification** | ML-powered crop identification. |
| **Export** | Export results as GeoTIFF, animations, or reports. |

## Prerequisites

*   Node.js 18+ ([Download](https://nodejs.org/))
*   Google Cloud Account (free tier is sufficient)
*   MCP-compatible Client (e.g., Claude Desktop, Cline)
*   4GB RAM minimum (8GB recommended)
*   2GB free disk space

## Local Installation

To run the server locally:

### Option 1: Global Installation (Recommended)

```bash
npm install -g axion-planetary-mcp@latest
```

### Option 2: Local Installation

```bash
npm install axion-planetary-mcp@latest
```

### Verify Installation

```bash
axion-mcp --version
```

## Google Earth Engine Setup

Required for local installation.

### Step 1: Create Google Cloud Project
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project and note the **Project ID**.

### Step 2: Enable APIs
Enable the following APIs in your project:
*   Earth Engine API
*   Cloud Storage API
*   Cloud Resource Manager API

### Step 3: Create Service Account
1.  Go to **IAM & Admin** > **Service Accounts**.
2.  Create a service account (e.g., `earth-engine-sa`).

### Step 4: Assign IAM Roles
Assign these roles to the service account:
*   Earth Engine Resource Admin (Beta)
*   Earth Engine Resource Viewer (Beta)
*   Service Usage Consumer
*   Storage Admin
*   Storage Object Creator

### Step 5: Generate JSON Key
1.  Create a JSON key for the service account.
2.  Save the file securely.

### Step 6: Register for Earth Engine
1.  Go to [Earth Engine Sign Up](https://signup.earthengine.google.com/).
2.  Register using your Project ID.

### Step 7: Register Service Account
1.  Go to [Earth Engine Service Accounts](https://code.earthengine.google.com/register).
2.  Register your service account email (`earth-engine-sa@YOUR-PROJECT-ID.iam.gserviceaccount.com`).

### Step 8: Save Credentials
Save the JSON key file:

**Windows:**
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.config\earthengine"
Copy-Item "C:\Downloads\your-key-file.json" "$env:USERPROFILE\.config\earthengine\credentials.json"
```

**Mac/Linux:**
```bash
mkdir -p ~/.config/earthengine
cp ~/Downloads/your-key-file.json ~/.config/earthengine/credentials.json
```

Alternatively, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

## Setup Guide

### 1. Run Setup Wizard
```bash
axion-mcp
```

### 2. Start the Next.js Backend
The MCP server requires a local Next.js backend. Open a new terminal:

```bash
# Navigate to package directory
cd /path/to/axion-planetary-mcp

# Start server
npm run start:next
```

Keep this terminal open.

### 3. Configure MCP Client
Add the configuration to your MCP client settings (e.g., `claude_desktop_config.json`).

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

### 4. Restart MCP Client
Restart your client to load the new configuration.

## Features

### Core Tools
*   **Data Discovery (`earth_engine_data`)**: Search datasets, filter by date/location/cloud cover.
*   **Processing (`earth_engine_process`)**: Calculate indices (NDVI, EVI), create composites, terrain analysis.
*   **Export (`earth_engine_export`)**: Export to GeoTIFF, generate thumbnails.
*   **Maps (`earth_engine_map`)**: Create interactive maps.
*   **System (`earth_engine_system`)**: Check status and execute custom code.

### Pre-trained Models
*   Wildfire Risk
*   Flood Prediction
*   Agriculture Health
*   Deforestation Detection
*   Water Quality Analysis

### Crop Classification
Includes automatic augmentation and pre-configured training data for major US states (IA, CA, TX, KS, NE, IL).

## Usage Examples

You can interact with the MCP server using natural language queries:

*   "Show me vegetation health in California."
*   "Create a water map of the Nile River."
*   "Analyze urban growth in Tokyo."
*   "Monitor deforestation in the Amazon."
*   "Calculate NDVI and create a map."

## Technical Architecture

```
[MCP Client] <-> [MCP SSE Bridge] <-> [Next.js API] <-> [Earth Engine]
```

1.  **MCP Client**: Communicates via stdio/JSON-RPC.
2.  **Bridge**: Converts to HTTP/Server-Sent Events.
3.  **Next.js API**: Handles Earth Engine operations.
4.  **Earth Engine**: Performs processing and analysis.

## Troubleshooting

### MCP server not responding
*   Ensure Next.js server is running (`npm run start:next`).
*   Check if `http://localhost:3000` is accessible.
*   Verify config file paths.

### Earth Engine authentication failed
*   Verify `credentials.json` is valid.
*   Confirm all IAM roles are assigned.
*   Ensure Earth Engine API is enabled.
*   Verify service account registration at `code.earthengine.google.com/register`.

### Port 3000 already in use
Run on a different port:
```bash
PORT=3001 npm run start:next
```

## Contributing

Contributions are welcome. Please report bugs via GitHub Issues or submit pull requests.

## License

MIT License.

## Support

*   [GitHub Issues](https://github.com/Dhenenjay/axion-planetary-mcp/issues)
*   [Discussions](https://github.com/Dhenenjay/axion-planetary-mcp/discussions)
*   [Wiki](https://github.com/Dhenenjay/axion-planetary-mcp/wiki)
