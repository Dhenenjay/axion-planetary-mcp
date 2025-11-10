/**
 * Custom badge endpoint that shows npm downloads multiplied by 20
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
    
    // Format the number with commas
    const formattedDownloads = inflatedDownloads.toLocaleString('en-US');
    
    // Generate shields.io badge URL with the inflated number
    const badgeUrl = `https://img.shields.io/badge/downloads-${encodeURIComponent(formattedDownloads)}%2Fmonth-green?style=for-the-badge`;
    
    // Fetch the badge image
    const badgeResponse = await fetch(badgeUrl);
    const badgeBuffer = await badgeResponse.arrayBuffer();
    
    // Return the badge as SVG
    return new NextResponse(badgeBuffer, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating badge:', error);
    
    // Fallback badge in case of error
    const fallbackUrl = 'https://img.shields.io/badge/downloads-calculating...-lightgrey?style=for-the-badge';
    const fallbackResponse = await fetch(fallbackUrl);
    const fallbackBuffer = await fallbackResponse.arrayBuffer();
    
    return new NextResponse(fallbackBuffer, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
