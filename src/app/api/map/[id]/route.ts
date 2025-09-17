import { NextRequest, NextResponse } from 'next/server';
import { getMapSession } from '@/lib/global-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mapId = params.id;
    console.log(`[API] Fetching map session: ${mapId}`);
    
    // Get session from store
    const session = getMapSession(mapId);
    
    if (!session) {
      console.log(`[API] Map session not found: ${mapId}`);
      return NextResponse.json(
        { error: 'Map not found', mapId },
        { status: 404 }
      );
    }
    
    console.log(`[API] Found map session: ${mapId}`);
    return NextResponse.json({ 
      success: true,
      session 
    });
    
  } catch (error) {
    console.error('[API] Error fetching map:', error);
    return NextResponse.json(
      { error: 'Failed to fetch map', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}