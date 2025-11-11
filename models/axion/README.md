# Axion Foundation Model

**World's First Petabyte-Scale Satellite MCP**  
**86.66% mIoU Accuracy | 10K+ Downloads**

## Overview

Axion is a breakthrough SAR-to-Optical foundation model that transforms radar imagery into crystal-clear optical views—seeing through clouds, storms, and darkness. Built on TerraMind's powerful encoder with our novel adaptive decoder architecture (DARN), Axion achieves state-of-the-art performance on GeoBench benchmarks.

## The Problem

**70% of Earth observation time is lost to cloud cover.** Critical decisions in disaster response, agriculture, and climate monitoring can't wait for clear skies.

## The Solution

Axion leverages Synthetic Aperture Radar (SAR) data to provide 24/7 all-weather monitoring. Our foundation model:
- Processes SAR imagery through clouds, rain, and darkness
- Generates multiple modalities simultaneously (RGB, DEM, LULC, NDVI)
- Achieves 86.66% mIoU accuracy (+5.56 points above state-of-the-art)
- Delivers real-time actionable intelligence

## Architecture

```
Input: SAR Radar Data (Sentinel-1, DEM, coordinates)
       ↓
[TerraMind Encoder]
  - Multi-modal tokenization
  - Pixel-level and token-level input
  - Spatial correlation learning
       ↓
[DARN Adaptive Decoder] ← Our Novel Contribution
  - Cross Entropy Loss optimization
  - Mask token prediction
  - Multi-modal output generation
       ↓
Output: Optical-quality imagery + multi-modal data
```

## Performance

### GeoBench Benchmark Results
- **mIoU Accuracy:** 86.66%
- **Improvement:** +5.56 percentage points over baseline UPerNet
- **Beats:** U-Net and all its derivatives
- **Validated:** ESA-endorsed benchmark for geospatial AI

### Key Metrics
- **Downloads:** 10,000+
- **Active Researchers:** 3,000+
- **Coverage:** 70% of previously invisible Earth

## Model Access

### ⚠️ IMPORTANT: MCP Server Exclusive Features

The Axion foundation model is available through two deployment options:

#### 1. AWS Raw Inference (Limited)
- **Access:** Direct neural network testing
- **Use Case:** Research, experimentation, model exploration
- **Features:** Raw model predictions only
- **Limitations:** No data processing pipeline, no analysis tools

#### 2. MCP Server (Full Platform) ⭐
- **Access:** Complete end-to-end platform
- **Use Case:** Production deployment, AI agent integration
- **Exclusive Features:**
  - Automated SAR data acquisition and preprocessing
  - Multi-modal output processing
  - Real-time analysis and insights generation
  - AI agent natural language interface
  - Complete satellite intelligence platform
  - Production-ready deployment

**The full Axion foundation model experience with data processing, analysis, and deployment tools is ONLY available through our hosted MCP server.**

## Output Modalities

Axion generates all of these simultaneously from a single SAR input:

1. **RGB Optical Imagery** - Crystal-clear visual representation
2. **Sentinel-2 L2A Bands** - Multi-spectral analysis
3. **Sentinel-1 RTC** - Processed radar data
4. **Digital Elevation Model (DEM)** - Terrain elevation mapping
5. **LULC (Land Use/Land Cover)** - Classification maps
6. **NDVI (Vegetation Index)** - Agricultural monitoring

## Applications

### 🚨 Disaster Response
Monitor floods, fires, and hurricanes in real-time through any weather condition.

### 🌾 Precision Agriculture
Track crop health, soil moisture, and field conditions continuously without waiting for clear skies.

### 🌍 Climate Intelligence
Uninterrupted monitoring of deforestation, ice dynamics, and environmental changes.

### 🏙️ Urban Planning
Analyze infrastructure development and urban sprawl with consistent coverage.

### 🛡️ Defense & Security
Maintain persistent situational awareness through all weather conditions.

### 🌊 Maritime Monitoring
Track vessel movements and coastal changes across any maritime environment.

## Research

**Paper Status:** Under review at CVPR 2026  
**Title:** "DARN: Dynamic Adaptive Residual Network for SAR-to-Optical Translation"  
**Innovation:** Novel adaptive decoder architecture that outperforms U-Net baselines

## Integration

### For Researchers (AWS)
```bash
# Test raw model inference
# Limited to neural network outputs only
aws sagemaker invoke-endpoint --endpoint-name axion-foundation-model ...
```

### For Production (MCP Server)
```typescript
// Full platform access with AI agent integration
import { AxionMCP } from '@axion-orbital/mcp-server';

const axion = new AxionMCP();
const result = await axion.analyze({
  location: [lat, lon],
  modalities: ['rgb', 'ndvi', 'lulc'],
  timeRange: '2025-01-01/2025-01-31'
});
```

**Note:** The MCP server provides the complete solution with data processing, model inference, and analysis tools—everything you need for satellite intelligence in one package.

## Why This Matters

- **70%** of Earth is invisible to optical satellites due to cloud cover
- **24/7** all-weather monitoring is now possible
- **Real-time** critical decisions can't wait for clear skies
- **86.66%** accuracy surpasses all existing architectures

## License

Research Model: Open for academic use  
MCP Server: Production deployment requires licensing

## Citation

```bibtex
@inproceedings{axion2026,
  title={DARN: Dynamic Adaptive Residual Network for SAR-to-Optical Translation},
  author={Axion Orbital Team},
  booktitle={CVPR},
  year={2026}
}
```

---

**Ready to see through clouds?**

🔬 [Run Raw Inference on AWS](#)  
🚀 [Access Full MCP Server](https://axionorbital.space)
