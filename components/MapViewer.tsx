/**
 * MapViewer Component
 * Renders an interactive Leaflet map with Earth Engine tiles
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issues - only run in browser
if (typeof window !== 'undefined' && L.Icon && L.Icon.Default) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface MapViewerProps {
  mapData: {
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
  };
}

const MapViewer: React.FC<MapViewerProps> = ({ mapData }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [showLayerControl, setShowLayerControl] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Initialize map
    const map = L.map(mapContainer.current, {
      center: [mapData.metadata.center[1], mapData.metadata.center[0]], // Leaflet uses [lat, lng]
      zoom: mapData.metadata.zoom,
      zoomControl: true,
      attributionControl: true
    });

    mapInstance.current = map;

    // Add base layers
    const baseLayers: { [key: string]: L.TileLayer } = {
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      }),
      'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors',
        maxZoom: 17
      }),
      'Streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }),
      'Dark': L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; Stadia Maps',
        maxZoom: 20
      })
    };

    // Add default base layer
    const defaultBasemap = mapData.metadata.basemap === 'dark' ? 'Dark' :
                          mapData.metadata.basemap === 'terrain' ? 'Terrain' :
                          mapData.metadata.basemap === 'roadmap' ? 'Streets' : 'Satellite';
    baseLayers[defaultBasemap].addTo(map);

    // Add Earth Engine layers
    const eeLayers: { [key: string]: L.TileLayer } = {};
    
    mapData.layers.forEach((layer, index) => {
      const eeLayer = L.tileLayer(layer.tileUrl, {
        attribution: 'Google Earth Engine',
        maxZoom: 20,
        opacity: 1
      });
      
      eeLayers[`EE: ${layer.name}`] = eeLayer;
      eeLayer.addTo(map);
    });
    
    // Add layer control
    const layerControl = L.control.layers(baseLayers, eeLayers, {
      position: 'topright',
      collapsed: false
    });
    layerControl.addTo(map);

    // Add scale control
    L.control.scale({
      position: 'bottomright',
      metric: true,
      imperial: true
    }).addTo(map);

    // Add custom controls
    const customControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-controls');
        
        // Fullscreen button
        const fullscreenBtn = L.DomUtil.create('a', 'control-button', container);
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Fullscreen';
        fullscreenBtn.href = '#';
        fullscreenBtn.onclick = (e) => {
          e.preventDefault();
          if (!document.fullscreenElement) {
            mapContainer.current?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        };

        // Reset view button
        const resetBtn = L.DomUtil.create('a', 'control-button', container);
        resetBtn.innerHTML = '🏠';
        resetBtn.title = 'Reset View';
        resetBtn.href = '#';
        resetBtn.onclick = (e) => {
          e.preventDefault();
          map.setView(
            [mapData.metadata.center[1], mapData.metadata.center[0]],
            mapData.metadata.zoom
          );
        };

        // Info button
        const infoBtn = L.DomUtil.create('a', 'control-button', container);
        infoBtn.innerHTML = 'ℹ️';
        infoBtn.title = 'Map Info';
        infoBtn.href = '#';
        infoBtn.onclick = (e) => {
          e.preventDefault();
          const bounds = map.getBounds();
          const zoom = map.getZoom();
          alert(`Region: ${mapData.region}\nZoom: ${zoom}\nBounds:\n  North: ${bounds.getNorth().toFixed(4)}\n  South: ${bounds.getSouth().toFixed(4)}\n  East: ${bounds.getEast().toFixed(4)}\n  West: ${bounds.getWest().toFixed(4)}`);
        };

        return container;
      }
    });

    new customControl().addTo(map);

    // Handle window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstance.current = null;
    };
  }, [mapData]);

  return (
    <>
      <div ref={mapContainer} className="map-container" />
      
      {mapData.layers.length > 1 && showLayerControl && (
        <div className="layer-switcher">
          <h4>Layers</h4>
          {mapData.layers.map((layer, index) => (
            <label key={index}>
              <input
                type="radio"
                name="layer"
                checked={currentLayer === index}
                onChange={() => {
                  setCurrentLayer(index);
                  // Update layer opacity
                  if (mapInstance.current) {
                    mapInstance.current.eachLayer((l: any) => {
                      if (l.options && l.options.attribution === 'Google Earth Engine') {
                        l.setOpacity(0);
                      }
                    });
                    // Show selected layer
                    // Note: This is simplified, actual implementation would track layer references
                  }
                }}
              />
              {layer.name}
            </label>
          ))}
        </div>
      )}

      <style jsx>{`
        .map-container {
          flex: 1;
          width: 100%;
          height: calc(100vh - 80px);
          position: relative;
        }

        /* Animations */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .layer-switcher {
          position: absolute;
          top: 80px;
          right: 20px;
          background: rgba(42, 42, 42, 0.95);
          padding: 1rem;
          border-radius: 8px;
          backdrop-filter: blur(10px);
          z-index: 1001;
          min-width: 150px;
        }

        .layer-switcher h4 {
          margin: 0 0 0.5rem 0;
          color: #4CAF50;
          font-size: 1rem;
        }

        .layer-switcher label {
          display: block;
          padding: 0.25rem 0;
          color: #ccc;
          cursor: pointer;
        }

        .layer-switcher input {
          margin-right: 0.5rem;
        }

        :global(.leaflet-control-layers) {
          background: rgba(42, 42, 42, 0.95) !important;
          backdrop-filter: blur(10px);
          border: 1px solid #444;
          border-radius: 8px;
          color: #ccc;
        }

        :global(.leaflet-control-layers-base label),
        :global(.leaflet-control-layers-overlays label) {
          color: #ccc !important;
        }

        :global(.custom-controls) {
          background: rgba(42, 42, 42, 0.95) !important;
          backdrop-filter: blur(10px);
          border: 1px solid #444;
          border-radius: 8px;
        }

        :global(.control-button) {
          display: block !important;
          width: 30px !important;
          height: 30px !important;
          line-height: 30px !important;
          text-align: center !important;
          text-decoration: none !important;
          color: white !important;
          font-size: 18px !important;
          background: transparent !important;
          border-bottom: 1px solid #444 !important;
        }

        :global(.control-button:last-child) {
          border-bottom: none !important;
        }

        :global(.control-button:hover) {
          background: rgba(76, 175, 80, 0.3) !important;
        }

        :global(.leaflet-control-scale) {
          background: rgba(42, 42, 42, 0.95) !important;
          backdrop-filter: blur(10px);
          border: 1px solid #444 !important;
          border-radius: 4px;
          color: #ccc !important;
        }

        :global(.leaflet-control-scale-line) {
          background: transparent !important;
          color: #ccc !important;
          border-color: #666 !important;
        }
      `}</style>
    </>
  );
};

export default MapViewer;