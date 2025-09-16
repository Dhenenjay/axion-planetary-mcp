/**
 * API endpoint for map session data
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getMapSession } from '../../../src/lib/global-store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid map ID' });
  }
  
  const session = getMapSession(id);
  
  if (!session) {
    return res.status(404).json({ error: 'Map session not found' });
  }
  
  // Return map configuration
  res.status(200).json({
    id: session.id,
    region: session.region,
    tileUrl: session.tileUrl,
    layers: session.layers,
    metadata: session.metadata,
    created: session.created.toISOString()
  });
}