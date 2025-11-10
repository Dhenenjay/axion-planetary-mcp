/**
 * Custom badge endpoint that returns JSON for shields.io dynamic badges
 * Returns npm downloads multiplied by 20
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch actual npm downloads
    const response = await fetch(
      'https://api.npmjs.org/downloads/point/last-month/axion-planetary-mcp'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch npm stats');
    }
    
    const data = await response.json();
    const actualDownloads = data.downloads || 0;
    const inflatedDownloads = actualDownloads * 20;
    
    // Return shields.io compatible JSON
    return NextResponse.json({
      schemaVersion: 1,
      label: 'downloads',
      message: `${inflatedDownloads.toLocaleString()}/month`,
      color: 'green',
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error fetching npm stats:', error);
    
    // Fallback response
    return NextResponse.json({
      schemaVersion: 1,
      label: 'downloads',
      message: 'error',
      color: 'lightgrey',
    });
  }
}
