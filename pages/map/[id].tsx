/**
 * Interactive Map Viewer Page
 * Uses Leaflet for map rendering with Earth Engine tiles
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamically import Leaflet to avoid SSR issues
const MapComponent = dynamic(() => import('../../components/MapViewer'), {
  ssr: false,
  loading: () => <div className="loading">Loading map...</div>
});

interface MapSession {
  id: string;
  region: string;
  tileUrl: string;
  layers: Array<{
    name: string;
    tileUrl: string;
    visParams: any;
  }>;
  metadata: {
    center: [number, number];
    zoom: number;
    basemap: string;
  };
  created: string;
}

export default function MapViewerPage() {
  const router = useRouter();
  const { id } = router.query;
  const [mapData, setMapData] = useState<MapSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    // Fetch map session data
    fetch(`/api/map/${id}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Map not found: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Map data from API:', data);
        setMapData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>Loading Map...</title>
        </Head>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading map session...</p>
        </div>
      </div>
    );
  }

  if (error || !mapData) {
    return (
      <div className="container">
        <Head>
          <title>Map Error</title>
        </Head>
        <div className="error-container">
          <h1>Map Not Found</h1>
          <p>{error || 'Unable to load map session'}</p>
          <button onClick={() => router.push('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Planetary Engine - {mapData.region}</title>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </Head>
      
      <div className="map-page">
        <div className="map-header">
          <h1>Planetary Engine Map Viewer</h1>
          <div className="map-info">
            <span className="region">📍 {mapData.region}</span>
            <span className="layers">🗺️ {mapData.layers.length} layer(s)</span>
            <span className="created">🕐 {new Date(mapData.created).toLocaleString()}</span>
          </div>
        </div>
        
        <MapComponent mapData={mapData} />
        
        <div className="map-controls">
          <div className="instructions">
            <h3>Controls:</h3>
            <ul>
              <li>🖱️ Drag to pan</li>
              <li>⚫ Scroll to zoom</li>
              <li>⬜ Click layers button to switch layers</li>
              <li>📱 Touch gestures supported</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .map-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #1a1a1a;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .map-header {
          background: #2a2a2a;
          padding: 1rem 2rem;
          border-bottom: 1px solid #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .map-header h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #4CAF50;
        }

        .map-info {
          display: flex;
          gap: 1.5rem;
          font-size: 0.9rem;
          color: #aaa;
        }

        .map-info span {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .map-controls {
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: rgba(42, 42, 42, 0.95);
          padding: 1rem;
          border-radius: 8px;
          backdrop-filter: blur(10px);
          z-index: 1000;
        }

        .instructions h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: #4CAF50;
        }

        .instructions ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .instructions li {
          padding: 0.25rem 0;
          font-size: 0.85rem;
          color: #ccc;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #1a1a1a;
          color: white;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 3px solid #444;
          border-top-color: #4CAF50;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container h1 {
          color: #f44336;
        }

        .error-container button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }

        .error-container button:hover {
          background: #45a049;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #1a1a1a;
          color: white;
          font-size: 1.2rem;
        }
      `}</style>
    </>
  );
}