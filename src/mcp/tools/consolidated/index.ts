/**
 * Consolidated MCP Tools Index
 * Exports all tool handlers for the SSE API
 */

import { handler as handleDataTool } from './earth_engine_data';
import { handler as handleProcessTool } from './earth_engine_process';
import { handler as handleExportTool } from './earth_engine_export';
import { handler as handleSystemTool } from './earth_engine_system';
import { handler as handleMapTool } from './earth_engine_map';

// Import model handlers from models directory
import { 
  handleWildfireRiskModel,
  handleFloodRiskModel,
  handleAgriculturalModel,
  handleDeforestationModel,
  handleWaterQualityModel
} from '../../../models';

// Export all handlers
export {
  // Core tools
  handleDataTool,
  handleProcessTool,
  handleExportTool,
  handleSystemTool,
  handleMapTool,
  
  // Models
  handleWildfireRiskModel,
  handleFloodRiskModel,
  handleAgriculturalModel,
  handleDeforestationModel,
  handleWaterQualityModel
};