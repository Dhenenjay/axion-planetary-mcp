/**
 * Map Server Module
 * 
 * Provides a local web server for interactive map viewing with tile support.
 * Similar to GEE's map viewer - returns a clickable URL.
 */

import http from 'http';
import { URL } from 'url';

// Global store for map sessions
const mapSessions = new Map<string, MapSession>();

// Server instance
let server: http.Server | null = null;
let serverPort = 8765;

export interface MapLayer {
  name: string;
  type: 'image' | 'tiles';
  imageUrl?: string;
  tileUrl?: string;
  bounds?: [[number, number], [number, number]];
  opacity?: number;
  visible?: boolean;
  clipGeometry?: GeoJSON.Geometry; // Geometry to clip tiles to
}

export interface MapSession {
  id: string;
  title: string;
  created: string;
  config: {
    center: [number, number];
    zoom: number;
    basemap: string;
    layers: MapLayer[];
    bounds?: [[number, number], [number, number]];
    searchBbox?: { west: number; south: number; east: number; north: number };
    clipGeometry?: GeoJSON.Geometry; // Global clipping geometry for the map
    placeName?: string; // Display name for the place boundary
    drawBoundary?: boolean; // draw boundary outline
    maskOutside?: boolean; // darken outside of the boundary
  };
}

// HTML template for the map viewer with clipped tile layer support
const MAP_VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
    <title>{{title}}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        .info-panel {
            position: absolute;
            top: 10px;
            right: 60px;
            z-index: 1000;
            background: rgba(255,255,255,0.95);
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.25);
            font-size: 13px;
            max-width: 280px;
            min-width: 200px;
        }
        .info-panel h3 { 
            margin: 0 0 12px 0; 
            font-size: 15px; 
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
        }
        .place-badge {
            background: #e3f2fd;
            color: #1565c0;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-bottom: 10px;
            display: inline-block;
        }
        .layers-section { margin-bottom: 10px; }
        .layers-section h4 {
            margin: 0 0 8px 0;
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        .layer-item {
            display: flex;
            align-items: center;
            padding: 6px 8px;
            margin: 4px 0;
            background: #f5f5f5;
            border-radius: 4px;
            cursor: pointer;
        }
        .layer-item:hover { background: #e8e8e8; }
        .layer-item input { margin-right: 8px; }
        .layer-item label { cursor: pointer; flex: 1; }
        .zoom-info {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #eee;
            color: #888;
            font-size: 11px;
        }
        .no-layers {
            color: #999;
            font-style: italic;
            padding: 8px;
        }
        .leaflet-top.leaflet-right { top: 120px; }
    </style>
</head>
<body>
    <div id="map"></div>
    <div class="info-panel">
        <h3>{{title}}</h3>
        <div id="place-info"></div>
        <div class="layers-section">
            <h4>Data Layers</h4>
            <div id="data-layers"></div>
        </div>
        <div class="zoom-info">
            Zoom: <span id="zoom-level"></span> | 
            <span id="layer-count"></span> layer(s)
        </div>
    </div>
    <script>
        const config = {{config_json}};
        console.log('Map config:', config);
        
        const map = L.map('map').setView([config.center[1], config.center[0]], config.zoom);
        
        // Base layers
        const baseLayers = {
            'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri'
            }),
            'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }),
            'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap'
            }),
            'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© CartoDB'
            })
        };
        
        const defaultBasemap = config.basemap || 'Satellite';
        baseLayers[defaultBasemap].addTo(map);
        
        // Show place name badge if available
        if (config.placeName) {
            document.getElementById('place-info').innerHTML = 
                '<div class="place-badge">📍 ' + config.placeName + '</div>';
        }
        
        /**
         * ClippedTileLayer - A custom Leaflet TileLayer that clips tiles to a GeoJSON geometry
         * This ensures satellite imagery is only displayed within the place boundary
         * Uses canvas clipping with destination-in composite operation
         */
        L.TileLayer.Clipped = L.TileLayer.extend({
            options: {
                clipGeometry: null,
                crossOrigin: 'anonymous'
            },
            
            initialize: function(url, options) {
                L.TileLayer.prototype.initialize.call(this, url, options);
                this._clipGeometry = options.clipGeometry;
                this._clippingEnabled = true;
                console.log('[ClippedTileLayer] Initialized with geometry:', !!this._clipGeometry);
            },
            
            createTile: function(coords, done) {
                const self = this;
                const tileSize = this.getTileSize();
                const canvas = document.createElement('canvas');
                canvas.width = tileSize.x;
                canvas.height = tileSize.y;
                canvas.className = 'leaflet-tile';
                const ctx = canvas.getContext('2d');
                
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = function() {
                    try {
                        // Draw the tile image first
                        ctx.drawImage(img, 0, 0, tileSize.x, tileSize.y);

                        // If we have a clip geometry, mask everything outside it
                        if (self._clipGeometry && self._clippingEnabled) {
                            ctx.save();
                            ctx.globalCompositeOperation = 'destination-in';
                            ctx.beginPath();

                            // Project geo coordinates to tile pixel coordinates
                            const project = function(lng, lat) {
                                const p = self._map.project([lat, lng], coords.z);
                                return {
                                    x: p.x - coords.x * tileSize.x,
                                    y: p.y - coords.y * tileSize.y
                                };
                            };

                            // Draw a single ring (exterior or hole)
                            const drawRing = function(ring) {
                                if (!ring || ring.length === 0) return;
                                const start = project(ring[0][0], ring[0][1]);
                                ctx.moveTo(start.x, start.y);
                                for (let i = 1; i < ring.length; i++) {
                                    const pt = project(ring[i][0], ring[i][1]);
                                    ctx.lineTo(pt.x, pt.y);
                                }
                                ctx.closePath();
                            };

                            const geom = self._clipGeometry;
                            if (geom.type === 'Polygon') {
                                // Polygon: first ring is exterior, rest are holes
                                geom.coordinates.forEach(drawRing);
                            } else if (geom.type === 'MultiPolygon') {
                                // MultiPolygon: array of polygons, each with exterior + holes
                                geom.coordinates.forEach(function(poly) {
                                    poly.forEach(drawRing);
                                });
                            }

                            // Fill using even-odd rule to properly handle holes
                            try {
                                ctx.fill('evenodd');
                            } catch (fillErr) {
                                ctx.fill();
                            }
                            ctx.restore();
                        }
                    } catch (clipErr) {
                        console.warn('[ClippedTileLayer] Clipping error:', clipErr);
                        // If clipping fails (e.g., CORS), try to draw the tile unclipped
                        try {
                            ctx.clearRect(0, 0, tileSize.x, tileSize.y);
                            ctx.drawImage(img, 0, 0, tileSize.x, tileSize.y);
                        } catch (e) { /* ignore */ }
                    }
                    done(null, canvas);
                };
                
                img.onerror = function(e) {
                    console.warn('[ClippedTileLayer] Tile load error for', coords, e);
                    done(null, canvas);
                };
                
                img.src = this.getTileUrl(coords);
                return canvas;
            },
            
            setClipGeometry: function(geometry) {
                this._clipGeometry = geometry;
                this.redraw();
            },
            
            enableClipping: function(enable) {
                this._clippingEnabled = enable;
                this.redraw();
            }
        });
        
        L.tileLayer.clipped = function(url, options) {
            return new L.TileLayer.Clipped(url, options);
        };
        
        // Add data layers
        const overlayLayers = {};
        const layersDiv = document.getElementById('data-layers');
        let layerCount = 0;
        
        // Get clip geometry from config
        const clipGeometry = config.clipGeometry || null;
        
        if (config.layers && config.layers.length > 0) {
            config.layers.forEach((layer, index) => {
                console.log('Adding layer:', layer.name, layer.type, 'clip:', !!clipGeometry);
                
                let leafletLayer = null;
                
                if (layer.type === 'image' && layer.imageUrl) {
                    console.log('Image overlay bounds:', layer.bounds);
                    leafletLayer = L.imageOverlay(layer.imageUrl, layer.bounds, {
                        opacity: layer.opacity !== undefined ? layer.opacity : 1.0
                    });
                } else if (layer.type === 'tiles' && layer.tileUrl) {
                    console.log('Tile URL:', layer.tileUrl, 'clipGeometry:', !!clipGeometry);
                    // Use ClippedTileLayer if we have a clip geometry, otherwise standard tile layer
                    if (clipGeometry && (clipGeometry.type === 'Polygon' || clipGeometry.type === 'MultiPolygon')) {
                        console.log('Using ClippedTileLayer for boundary clipping');
                        leafletLayer = L.tileLayer.clipped(layer.tileUrl, {
                            opacity: layer.opacity !== undefined ? layer.opacity : 1.0,
                            attribution: layer.attribution || '',
                            clipGeometry: clipGeometry
                        });
                    } else {
                        leafletLayer = L.tileLayer(layer.tileUrl, {
                            opacity: layer.opacity !== undefined ? layer.opacity : 1.0,
                            attribution: layer.attribution || ''
                        });
                    }
                }
                
                if (leafletLayer) {
                    leafletLayer.addTo(map);
                    overlayLayers[layer.name] = leafletLayer;
                    layerCount++;
                    
                    const item = document.createElement('div');
                    item.className = 'layer-item';
                    item.innerHTML = \`
                        <input type="checkbox" id="layer-\${index}" checked 
                               onchange="toggleLayer('\${layer.name}', this.checked)">
                        <label for="layer-\${index}">\${layer.name}</label>
                    \`;
                    layersDiv.appendChild(item);
                }
            });
        }
        
        if (layerCount === 0) {
            layersDiv.innerHTML = '<div class="no-layers">No data layers added yet</div>';
        }
        
        document.getElementById('layer-count').textContent = layerCount;
        L.control.layers(baseLayers, {}, { position: 'topright', collapsed: true }).addTo(map);
        
        window.toggleLayer = function(name, visible) {
            const layer = overlayLayers[name];
            if (layer) {
                if (visible) map.addLayer(layer);
                else map.removeLayer(layer);
            }
        };
        
        function updateZoom() {
            document.getElementById('zoom-level').textContent = map.getZoom().toFixed(0);
        }
        map.on('zoomend', updateZoom);
        updateZoom();
        
        if (config.bounds && config.bounds.length === 2) {
            try {
                console.log('Fitting to bounds:', config.bounds);
                map.fitBounds(config.bounds, { padding: [20, 20], maxZoom: 14 });
            } catch(e) {
                console.log('Could not fit bounds:', e);
            }
        }
        
        // Draw boundary and optional outside mask
        if (clipGeometry && (clipGeometry.type === 'Polygon' || clipGeometry.type === 'MultiPolygon')) {
            try {
                if (config.drawBoundary !== false) {
                    const boundaryLayer = L.geoJSON(clipGeometry, {
                        style: {
                            color: '#2196F3',
                            weight: 2,
                            opacity: 0.9,
                            fillColor: '#2196F3',
                            fillOpacity: 0.05,
                            dashArray: null
                        },
                        interactive: false
                    });
                    boundaryLayer.addTo(map);
                    map.fitBounds(boundaryLayer.getBounds(), { padding: [30, 30], maxZoom: 13 });
                }
                
                if (config.maskOutside) {
                    const outer = [[-89.9,-179.9],[-89.9,179.9],[89.9,179.9],[89.9,-179.9]];
                    const rings = [];
                    rings.push(outer);
                    if (clipGeometry.type === 'Polygon') {
                        rings.push(clipGeometry.coordinates[0].map(c => [c[1], c[0]]));
                    } else {
                        clipGeometry.coordinates.forEach(poly => {
                            rings.push(poly[0].map(c => [c[1], c[0]]));
                        });
                    }
                    const maskPane = 'mask-pane-global';
                    if (!map.getPane(maskPane)) map.createPane(maskPane);
                    map.getPane(maskPane).style.zIndex = 640;
                    const mask = L.polygon(rings, {
                        stroke: false,
                        fillColor: '#000',
                        fillOpacity: 0.35,
                        pane: maskPane,
                        interactive: false
                    });
                    mask.addTo(map);
                }
            } catch(e) {
                console.log('Could not draw clip geometry/mask:', e);
            }
        }
    </script>
</body>
</html>`;

/**
 * Start the map server
 */
export function startServer(port: number = 8765): string {
  if (server !== null) {
    return `http://localhost:${serverPort}`;
  }
  
  serverPort = port;
  
  // Try ports until one works
  const tryPort = (p: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const testServer = http.createServer();
      testServer.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(tryPort(p + 1));
        } else {
          reject(err);
        }
      });
      testServer.once('listening', () => {
        testServer.close(() => resolve(p));
      });
      testServer.listen(p, 'localhost');
    });
  };
  
  // Create the server
  server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${serverPort}`);
    const path = url.pathname;
    
    // Root - list maps
    if (path === '/' || path === '') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      let html = '<html><head><title>Axion Maps</title></head><body>';
      html += '<h1>Axion Map Server</h1>';
      html += '<h2>Active Maps:</h2><ul>';
      
      for (const [mapId, session] of mapSessions) {
        html += `<li><a href="/map/${mapId}">${session.title || mapId}</a></li>`;
      }
      
      if (mapSessions.size === 0) {
        html += '<li>No active maps</li>';
      }
      
      html += '</ul></body></html>';
      res.end(html);
      return;
    }
    
    // Map viewer
    if (path.startsWith('/map/')) {
      const mapId = path.slice(5);
      const session = mapSessions.get(mapId);
      
      if (session) {
        const configJson = JSON.stringify(session.config);
        const html = MAP_VIEWER_HTML
          .replace(/{{title}}/g, session.title || 'Axion Map')
          .replace('{{config_json}}', configJson);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Map not found</h1></body></html>');
      }
      return;
    }
    
    // API endpoint for session data
    if (path.startsWith('/api/session/')) {
      const mapId = path.slice(13);
      const session = mapSessions.get(mapId);
      
      res.writeHead(session ? 200 : 404, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(session || { error: 'not found' }));
      return;
    }
    
    // Tile proxy endpoint - proxies external tiles to add CORS headers
    if (path.startsWith('/proxy/tile')) {
      const tileUrl = url.searchParams.get('url');
      if (!tileUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing url parameter');
        return;
      }
      
      // Fetch and proxy the tile
      const https = require('https');
      const http = require('http');
      const proxyUrl = new URL(tileUrl);
      const protocol = proxyUrl.protocol === 'https:' ? https : http;
      
      const proxyReq = protocol.get(tileUrl, (proxyRes: any) => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Cache-Control': 'public, max-age=86400'
        });
        proxyRes.pipe(res);
      });
      
      proxyReq.on('error', (err: any) => {
        console.error('[MapServer] Tile proxy error:', err.message);
        res.writeHead(500);
        res.end('Proxy error');
      });
      
      proxyReq.setTimeout(30000, () => {
        proxyReq.destroy();
        res.writeHead(504);
        res.end('Timeout');
      });
      
      return;
    }
    
    // 404
    res.writeHead(404);
    res.end();
  });
  
  server.listen(serverPort, 'localhost', () => {
    console.error(`[MapServer] Started at http://localhost:${serverPort}`);
  });
  
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      serverPort++;
      server?.close();
      server = null;
      startServer(serverPort);
    }
  });
  
  return `http://localhost:${serverPort}`;
}

/**
 * Stop the map server
 */
export function stopServer(): void {
  if (server) {
    server.close();
    server = null;
    console.error('[MapServer] Stopped');
  }
}

/**
 * Create a new map session
 */
export function createMapSession(options: {
  title?: string;
  center?: [number, number];
  zoom?: number;
  basemap?: string;
}): { mapId: string; url: string; title: string } {
  // Ensure server is running
  const baseUrl = startServer();
  
  const mapId = `map_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const title = options.title || `Axion Map - ${new Date().toISOString().split('T')[0]}`;
  
  const session: MapSession = {
    id: mapId,
    title,
    created: new Date().toISOString(),
    config: {
      center: options.center || [-118.25, 34.05], // Default: Los Angeles
      zoom: options.zoom || 10,
      basemap: options.basemap || 'Satellite',
      layers: []
    }
  };
  
  mapSessions.set(mapId, session);
  
  const url = `${baseUrl}/map/${mapId}`;
  console.error(`[MapServer] Created session: ${mapId} -> ${url}`);
  
  return { mapId, url, title };
}

/**
 * Add a layer to an existing map session
 */
export function addLayerToSession(
  mapId: string,
  layer: {
    name: string;
    type: 'image' | 'tiles';
    imageUrl?: string;
    tileUrl?: string;
    bounds?: [[number, number], [number, number]];
    opacity?: number;
  }
): boolean {
  const session = mapSessions.get(mapId);
  if (!session) return false;
  
  session.config.layers.push({
    name: layer.name,
    type: layer.type,
    imageUrl: layer.imageUrl,
    tileUrl: layer.tileUrl,
    bounds: layer.bounds,
    opacity: layer.opacity ?? 1.0,
    visible: true
  });
  
  console.error(`[MapServer] Added layer "${layer.name}" to ${mapId}`);
  return true;
}

/**
 * Update map bounds
 */
export function setMapBounds(
  mapId: string,
  bounds: [[number, number], [number, number]],
  center?: [number, number]
): boolean {
  const session = mapSessions.get(mapId);
  if (!session) return false;
  
  session.config.bounds = bounds;
  if (center) session.config.center = center;
  
  return true;
}

/**
 * Set search bbox for display
 */
export function setSearchBbox(
  mapId: string,
  bbox: { west: number; south: number; east: number; north: number }
): boolean {
  const session = mapSessions.get(mapId);
  if (!session) return false;
  
  session.config.searchBbox = bbox;
  return true;
}

/**
 * Set boundary geometry and display options
 */
export function setClipGeometry(
  mapId: string,
  geometry: GeoJSON.Geometry,
  placeName?: string,
  options?: { drawBoundary?: boolean; maskOutside?: boolean }
): boolean {
  const session = mapSessions.get(mapId);
  if (!session) return false;
  
  session.config.clipGeometry = geometry;
  if (placeName) session.config.placeName = placeName;
  if (options && typeof options.drawBoundary === 'boolean') session.config.drawBoundary = options.drawBoundary;
  if (options && typeof options.maskOutside === 'boolean') session.config.maskOutside = options.maskOutside;
  
  console.error(`[MapServer] Set clip geometry for ${mapId}${placeName ? ` (${placeName})` : ''}`);
  return true;
}

/**
 * Get a map session
 */
export function getSession(mapId: string): MapSession | undefined {
  return mapSessions.get(mapId);
}

/**
 * List all sessions
 */
export function listSessions(): Array<{ mapId: string; title: string; url: string; layerCount: number }> {
  return Array.from(mapSessions.entries()).map(([mapId, session]) => ({
    mapId,
    title: session.title,
    url: `http://localhost:${serverPort}/map/${mapId}`,
    layerCount: session.config.layers.length
  }));
}

/**
 * Delete a session
 */
export function deleteSession(mapId: string): boolean {
  return mapSessions.delete(mapId);
}

export { serverPort };
