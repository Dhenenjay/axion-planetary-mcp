/**
 * Simple Map Generation API
 * Creates interactive maps with Earth Engine tiles
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { addMapSession } from '../../../src/lib/global-store';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      region = 'Los Angeles',
      datasetType = 'sentinel2',
      startDate = '2024-01-01',
      endDate = '2024-01-31'
    } = req.body;

    // Generate unique map ID
    const mapId = uuidv4().substring(0, 8);
    
    // Create demo tile URL (using a public tile service for testing)
    // In production, this would use actual Earth Engine tiles
    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    
    // Default center coordinates for common regions
    const regionCenters: Record<string, [number, number]> = {
      'Los Angeles': [-118.2437, 34.0522],
      'San Francisco': [-122.4194, 37.7749],
      'New York': [-74.0060, 40.7128],
      'Manhattan': [-73.9712, 40.7831],
      'Denver': [-104.9903, 39.7392],
      'Miami': [-80.1918, 25.7617],
      'Seattle': [-122.3321, 47.6062],
      'Phoenix': [-112.0740, 33.4484],
      'Boston': [-71.0589, 42.3601],
      'Chicago': [-87.6298, 41.8781]
    };

    const center = regionCenters[region] || [-118.2437, 34.0522];
    
    // Create map session
    const session = {
      id: mapId,
      region: region,
      tileUrl: tileUrl,
      layers: [
        {
          name: 'Base Layer',
          tileUrl: tileUrl,
          visParams: {
            bands: ['B4', 'B3', 'B2'],
            min: 0,
            max: 0.3
          }
        }
      ],
      metadata: {
        center: center,
        zoom: 10,
        basemap: 'satellite'
      },
      created: new Date()
    };

    // Store session
    addMapSession(mapId, session);
    
    // Build map URL
    const mapUrl = `/map/${mapId}`;
    
    return res.status(200).json({
      success: true,
      mapId: mapId,
      mapUrl: mapUrl,
      region: region,
      message: `Map created for ${region}`,
      session: session
    });
    
  } catch (error: any) {
    console.error('Error generating map:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate map',
      details: error.stack
    });
  }
}