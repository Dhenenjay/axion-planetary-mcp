/**
 * Axion Foundation Model Client
 * 
 * NOTE: This client provides LIMITED access to raw model inference.
 * For full platform features including data processing, analysis, and
 * AI agent integration, use the MCP server: @axion-orbital/mcp-server
 */

export interface AxionModelConfig {
  modelVersion: string;
  endpoint?: string;
  region?: string;
}

export interface SARInput {
  sentinel1_rtc: number[][];
  dem: number[][];
  coordinates: {
    lat: number;
    lon: number;
  };
  caption?: string;
}

export interface AxionRawOutput {
  // Raw model predictions (unprocessed)
  sentinel2_l2a: number[][][];
  sentinel1_rtc: number[][];
  rgb: number[][][];
  dem: number[][];
  lulc: number[][];
  ndvi: number[][];
  confidence: number;
  metadata: {
    model_version: string;
    inference_time_ms: number;
    timestamp: string;
  };
}

export class AxionModelClient {
  private config: AxionModelConfig;
  private endpoint: string;

  constructor(config: AxionModelConfig = { modelVersion: '1.0.0' }) {
    this.config = config;
    this.endpoint = config.endpoint || 'https://api.axionorbital.space/v1/inference';
    
    console.warn(`
      ⚠️  WARNING: You are using raw model inference.
      
      This provides ONLY raw neural network outputs without:
      - Data preprocessing pipelines
      - Multi-modal analysis tools
      - AI agent integration
      - Real-time monitoring
      - Production deployment features
      
      For the complete platform, use the MCP server:
      npm install @axion-orbital/mcp-server
      
      See: https://docs.axionorbital.space/mcp-vs-raw
    `);
  }

  /**
   * Run raw inference on SAR input data
   * 
   * @param input - SAR radar data with DEM and coordinates
   * @returns Raw model predictions (unprocessed)
   */
  async predict(input: SARInput): Promise<AxionRawOutput> {
    const startTime = Date.now();

    // Validate input
    this.validateInput(input);

    // Call inference endpoint
    const response = await fetch(`${this.endpoint}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Model-Version': this.config.modelVersion
      },
      body: JSON.stringify({
        input_data: input,
        return_all_modalities: true
      })
    });

    if (!response.ok) {
      throw new Error(`Axion inference failed: ${response.statusText}`);
    }

    const result = await response.json();
    const inferenceTime = Date.now() - startTime;

    return {
      ...result,
      metadata: {
        model_version: this.config.modelVersion,
        inference_time_ms: inferenceTime,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Batch prediction for multiple inputs
   * Note: For production batch processing, use MCP server
   */
  async batchPredict(inputs: SARInput[]): Promise<AxionRawOutput[]> {
    console.warn('Batch prediction is limited in raw inference. Use MCP server for optimized batch processing.');
    
    return Promise.all(inputs.map(input => this.predict(input)));
  }

  private validateInput(input: SARInput): void {
    if (!input.sentinel1_rtc || !input.dem || !input.coordinates) {
      throw new Error('Invalid input: missing required fields (sentinel1_rtc, dem, coordinates)');
    }

    if (!input.coordinates.lat || !input.coordinates.lon) {
      throw new Error('Invalid coordinates');
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<{
    name: string;
    version: string;
    architecture: string;
    performance: { miou: number };
  }> {
    return {
      name: 'Axion',
      version: this.config.modelVersion,
      architecture: 'TerraMind Encoder + DARN Adaptive Decoder',
      performance: { miou: 86.66 }
    };
  }
}

/**
 * Helper function to convert raw outputs to viewable format
 * Note: MCP server provides advanced visualization tools
 */
export function rawOutputToImage(output: AxionRawOutput, modality: 'rgb' | 'ndvi' | 'lulc' | 'dem'): ImageData {
  console.warn('Basic image conversion only. MCP server provides advanced visualization.');
  
  const data = output[modality];
  // Basic conversion (simplified)
  // In production, use MCP server's visualization pipeline
  
  throw new Error('Image conversion requires additional processing. Use MCP server for full visualization support.');
}
