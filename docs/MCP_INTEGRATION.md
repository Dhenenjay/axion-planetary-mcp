# Axion MCP Server Integration

## Foundation Model vs. Product Delivery

**Understanding the distinction is critical:**

### 🧠 Axion Foundation Model
The neural network brain. Trained on massive datasets, achieves 86.66% mIoU accuracy, beats all existing architectures. This is our research contribution.

### 🔧 AWS Raw Inference
Direct model access for researchers and developers who want to explore the neural network. You get raw predictions, nothing more. Test the model, run experiments, see outputs.

### 🚀 MCP Server (Complete Platform)
**This is where the magic happens.** The MCP server provides the full end-to-end platform:
- SAR data acquisition and preprocessing
- Model inference with our exclusive Axion model
- Multi-modal output processing
- Analysis and insights generation
- AI agent natural language interface
- Production deployment tools

## Flow Diagram

```
┌─────────────────────┐
│   SAR Radar Data    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│   Axion Foundation Model        │
│   (TerraMind Encoder + DARN)    │
└──────────┬──────────────────────┘
           │
           ├──────────────────────┐
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────┐
│  AWS RAW         │   │  MCP SERVER          │
│  INFERENCE       │   │  (Full Platform)     │
├──────────────────┤   ├──────────────────────┤
│ Neural Network   │   │ Complete Solution    │
│ Output           │   │                      │
│ • Raw predictions│   │ • Data processing    │
│ • No pipeline    │   │ • Model inference    │
│ • Research only  │   │ • Analysis tools     │
└──────────────────┘   │ • AI agent interface │
                       │ • Production ready   │
                       └──────────────────────┘
```

## Exclusive MCP Features

The following features are **ONLY** available through the hosted MCP server:

### 1. Automated Data Acquisition
```typescript
// MCP handles data fetching automatically
const result = await axion.analyze({
  location: [37.7749, -122.4194],
  timeRange: '2025-01-01/2025-01-31'
});
// SAR data, DEM, coordinates all handled for you
```

### 2. Multi-Modal Processing Pipeline
```typescript
// Get all modalities processed and analyzed
const processed = await axion.processOutputs({
  rgb: true,
  vegetation: true,
  landCover: true,
  elevation: true
});
```

### 3. Natural Language Interface
```typescript
// AI agents can query in natural language
const insights = await axion.query(
  "Show me crop health changes in California's Central Valley over the past month"
);
```

### 4. Real-Time Analysis
```typescript
// Automated change detection and alerts
await axion.monitor({
  region: californiaFarms,
  alerts: ['vegetation_stress', 'flood_risk'],
  frequency: 'daily'
});
```

### 5. Production Deployment
- Scalable infrastructure
- API rate limiting
- Authentication and access control
- Data caching and optimization
- Monitoring and logging

## Why Use MCP vs. Raw Inference?

| Feature | AWS Raw Inference | MCP Server |
|---------|------------------|------------|
| Model Access | ✅ Direct | ✅ Optimized |
| Data Processing | ❌ Manual | ✅ Automated |
| Multi-Modal Output | ❌ Raw only | ✅ Processed |
| AI Agent Integration | ❌ No | ✅ Native |
| Analysis Tools | ❌ None | ✅ Complete |
| Production Ready | ❌ No | ✅ Yes |
| Natural Language | ❌ No | ✅ Yes |
| Real-Time Monitoring | ❌ No | ✅ Yes |

## Getting Started with MCP

### Installation
```bash
npm install @axion-orbital/mcp-server
```

### Configuration
```typescript
import { AxionMCP } from '@axion-orbital/mcp-server';

const axion = new AxionMCP({
  endpoint: 'https://mcp.axionorbital.space',
  // No API key required - open source!
});
```

### Basic Usage
```typescript
// Analyze a specific location
const analysis = await axion.analyzeSAR({
  coordinates: {
    lat: 37.7749,
    lon: -122.4194
  },
  date: '2025-01-15',
  modalities: ['rgb', 'ndvi', 'lulc']
});

console.log(analysis.rgb); // Optical-quality image
console.log(analysis.ndvi); // Vegetation index
console.log(analysis.lulc); // Land cover classification
```

### AI Agent Integration
```typescript
// Works with Claude, ChatGPT, or any MCP-compatible system
import { MCPClient } from '@modelcontextprotocol/sdk';

const client = new MCPClient();
await client.connect('axion-orbital-mcp');

// Now your AI agent can access Axion's capabilities
const response = await client.query(
  "Analyze agricultural changes in Iowa from January to March 2025"
);
```

## Architecture

### MCP Server Components

1. **Data Ingestion Layer**
   - Sentinel-1 SAR data acquisition
   - DEM and coordinate processing
   - Metadata extraction

2. **Axion Model Inference**
   - Exclusive access to full Axion foundation model
   - Optimized batch processing
   - GPU acceleration

3. **Post-Processing Pipeline**
   - Multi-modal output generation
   - Image enhancement
   - Statistical analysis

4. **API Layer**
   - REST and WebSocket endpoints
   - Model Context Protocol (MCP) interface
   - Natural language query processing

5. **Analysis Engine**
   - Change detection algorithms
   - Anomaly identification
   - Trend analysis

## Performance

- **Latency:** ~2-5s for complete analysis (vs. ~10-15s for raw inference + manual processing)
- **Throughput:** 1000+ requests/minute
- **Availability:** 99.9% uptime SLA
- **Coverage:** Global SAR data access

## Pricing

The MCP server is **open-source** with no API keys required for basic usage. Enterprise features available for production deployments.

## Support

- **Documentation:** https://docs.axionorbital.space
- **GitHub:** https://github.com/axion-orbital/mcp-server
- **Discord:** https://discord.gg/axion-orbital

---

**Remember:** While raw inference is available for research, the MCP server provides the complete, production-ready platform with exclusive features for real-world applications.
