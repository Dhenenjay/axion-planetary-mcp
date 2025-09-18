/**
 * Test Map Generation Page
 * Simple interface to test map generation
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function TestMapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('Los Angeles');

  const handleGenerateMap = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/map/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          region: region,
          datasetType: 'sentinel2',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Navigate to the map viewer
        router.push(data.mapUrl);
      } else {
        setError(data.error || 'Failed to generate map');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Test Map Generation</title>
      </Head>
      
      <div className="container">
        <h1>Test Map Generation</h1>
        
        <div className="form">
          <label>
            Select Region:
            <select 
              value={region} 
              onChange={(e) => setRegion(e.target.value)}
              disabled={loading}
            >
              <option value="Los Angeles">Los Angeles</option>
              <option value="San Francisco">San Francisco</option>
              <option value="New York">New York</option>
              <option value="Manhattan">Manhattan</option>
              <option value="Denver">Denver</option>
              <option value="Miami">Miami</option>
              <option value="Seattle">Seattle</option>
              <option value="Phoenix">Phoenix</option>
              <option value="Boston">Boston</option>
              <option value="Chicago">Chicago</option>
            </select>
          </label>

          <button 
            onClick={handleGenerateMap} 
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Map'}
          </button>

          {error && (
            <div className="error">
              Error: {error}
            </div>
          )}
        </div>

        <div className="info">
          <h3>Instructions:</h3>
          <ol>
            <li>Select a region from the dropdown</li>
            <li>Click "Generate Map"</li>
            <li>You'll be redirected to the interactive map viewer</li>
          </ol>
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        h1 {
          color: #333;
          margin-bottom: 2rem;
        }

        .form {
          background: #f5f5f5;
          padding: 2rem;
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        label {
          display: block;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        select {
          display: block;
          width: 100%;
          padding: 0.5rem;
          margin-top: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.3s;
        }

        button:hover:not(:disabled) {
          background: #45a049;
        }

        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .error {
          color: #f44336;
          background: #ffebee;
          padding: 1rem;
          border-radius: 4px;
          margin-top: 1rem;
        }

        .info {
          background: #e3f2fd;
          padding: 1.5rem;
          border-radius: 8px;
        }

        .info h3 {
          margin-top: 0;
          color: #1976d2;
        }

        .info ol {
          margin: 0;
          padding-left: 1.5rem;
        }

        .info li {
          margin: 0.5rem 0;
        }
      `}</style>
    </>
  );
}