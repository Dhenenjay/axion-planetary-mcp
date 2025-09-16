/**
 * API endpoint to generate crop classification maps
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import ee from '@google/earthengine';
import { addMapSession } from '../../src/lib/global-store';
import { execute } from '../../src/mcp/tools/consolidated/crop_classification';
import { initEarthEngineWithSA } from '../../src/gee/client';

// Initialize Earth Engine once for the server
let eeInitialized = false;

async function ensureEEInitialized() {
  if (!eeInitialized) {
    await initEarthEngineWithSA();
    eeInitialized = true;
    console.log('Earth Engine initialized for API');
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize EE if needed
    await ensureEEInitialized();
    
    // Get parameters from request body
    const {
      region = 'Iowa',
      startDate = '2024-06-01',
      endDate = '2024-08-31',
      classifier = 'randomForest'
    } = req.body;
    
    console.log(`Generating map for ${region}...`);
    
    // Execute crop classification
    const result = await execute({
      operation: 'classify',
      region: region,
      startDate: startDate,
      endDate: endDate,
      classifier: classifier,
      createMap: true
    });
    
    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Classification failed'
      });
    }
    
    // The map session should already be stored by the execute function
    // Return the result with map URL
    return res.status(200).json({
      success: true,
      mapId: result.map?.url?.split('/').pop(),
      mapUrl: result.map?.url,
      region: result.region,
      classes: result.numberOfClasses,
      classDefinitions: result.classDefinitions,
      legend: result.map?.legend,
      message: `Map generated for ${region} with ${result.numberOfClasses} classes`
    });
    
  } catch (error: any) {
    console.error('Error generating map:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate map'
    });
  }
}