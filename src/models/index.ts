/**
 * Model Handlers Wrapper
 * Provides TypeScript interface for the geospatial models
 */

// Import the CommonJS models
const models = require('./calibrated-geospatial-models.cjs');

// Export individual model handlers
export async function handleWildfireRiskModel(args: any) {
  const handler = models.models.find((m: any) => m.name === 'wildfire_risk_assessment');
  if (!handler?.handler) {
    throw new Error('Wildfire risk model not found');
  }
  return await handler.handler(args);
}

export async function handleFloodRiskModel(args: any) {
  const handler = models.models.find((m: any) => m.name === 'flood_risk_assessment');
  if (!handler?.handler) {
    throw new Error('Flood risk model not found');
  }
  return await handler.handler(args);
}

export async function handleAgriculturalModel(args: any) {
  const handler = models.models.find((m: any) => m.name === 'agricultural_monitoring');
  if (!handler?.handler) {
    throw new Error('Agricultural monitoring model not found');
  }
  return await handler.handler(args);
}

export async function handleDeforestationModel(args: any) {
  const handler = models.models.find((m: any) => m.name === 'deforestation_detection');
  if (!handler?.handler) {
    throw new Error('Deforestation detection model not found');
  }
  return await handler.handler(args);
}

export async function handleWaterQualityModel(args: any) {
  const handler = models.models.find((m: any) => m.name === 'water_quality_analysis');
  if (!handler?.handler) {
    throw new Error('Water quality model not found');
  }
  return await handler.handler(args);
}

// Export all models for reference
export const allModels = models.models;