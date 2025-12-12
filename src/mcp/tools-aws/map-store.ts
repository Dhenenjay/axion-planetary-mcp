/**
 * Centralized Map Store
 * Stores maps in memory and serves them through the main SSE server.
 * This allows maps to work in Docker, Render, or any environment.
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// In-memory map storage (for small maps) + disk storage for larger ones
const mapStore = new Map<string, { content: string; contentType: string; createdAt: number }>();
const MAP_DIR = path.join(os.tmpdir(), 'axion-maps');

// Ensure map directory exists
if (!fs.existsSync(MAP_DIR)) {
  fs.mkdirSync(MAP_DIR, { recursive: true });
}

// Auto-cleanup old maps (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  // Clean memory store
  for (const [id, data] of mapStore.entries()) {
    if (now - data.createdAt > ONE_HOUR) {
      mapStore.delete(id);
    }
  }
  
  // Clean disk store
  try {
    const files = fs.readdirSync(MAP_DIR);
    for (const file of files) {
      const filePath = path.join(MAP_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}, 10 * 60 * 1000); // Every 10 minutes

/**
 * Get the base URL for maps
 * Uses environment variable or defaults based on context
 */
export function getMapBaseUrl(): string {
  // Allow explicit override via env var
  if (process.env.MAP_BASE_URL) {
    return process.env.MAP_BASE_URL;
  }
  
  // Use the main server port
  const port = process.env.PORT || '3000';
  
  // In production (Render, etc.), use relative paths
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  // Local development
  return `http://localhost:${port}`;
}

/**
 * Store a map and return its URL
 */
export function storeMap(
  id: string, 
  content: string, 
  contentType: string = 'text/html'
): string {
  // Store in memory for fast access
  mapStore.set(id, {
    content,
    contentType,
    createdAt: Date.now(),
  });
  
  // Also store on disk as backup
  const filePath = path.join(MAP_DIR, `${id}.html`);
  fs.writeFileSync(filePath, content);
  
  const baseUrl = getMapBaseUrl();
  return `${baseUrl}/map/${id}`;
}

/**
 * Store a binary file (image, etc.)
 */
export function storeFile(
  id: string,
  content: Buffer,
  contentType: string = 'application/octet-stream'
): string {
  const filePath = path.join(MAP_DIR, id);
  fs.writeFileSync(filePath, content);
  
  const baseUrl = getMapBaseUrl();
  return `${baseUrl}/map/${id}`;
}

/**
 * Get a stored map by ID
 */
export function getMap(id: string): { content: string | Buffer; contentType: string } | null {
  // First check memory store
  const memData = mapStore.get(id);
  if (memData) {
    return { content: memData.content, contentType: memData.contentType };
  }
  
  // Fall back to disk
  const htmlPath = path.join(MAP_DIR, `${id}.html`);
  if (fs.existsSync(htmlPath)) {
    return { content: fs.readFileSync(htmlPath, 'utf-8'), contentType: 'text/html' };
  }
  
  // Check for file without .html extension
  const filePath = path.join(MAP_DIR, id);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(id).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.html') contentType = 'text/html';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.tif' || ext === '.tiff') contentType = 'image/tiff';
    
    return { content: fs.readFileSync(filePath), contentType };
  }
  
  return null;
}

/**
 * List all stored maps
 */
export function listMaps(): string[] {
  const ids = new Set<string>();
  
  // From memory
  for (const id of mapStore.keys()) {
    ids.add(id);
  }
  
  // From disk
  try {
    const files = fs.readdirSync(MAP_DIR);
    for (const file of files) {
      ids.add(file.replace('.html', ''));
    }
  } catch (e) {
    // Ignore
  }
  
  return Array.from(ids);
}

/**
 * Delete a map
 */
export function deleteMap(id: string): void {
  mapStore.delete(id);
  
  try {
    const htmlPath = path.join(MAP_DIR, `${id}.html`);
    if (fs.existsSync(htmlPath)) {
      fs.unlinkSync(htmlPath);
    }
    const filePath = path.join(MAP_DIR, id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Get the map directory path (for tools that need direct file access)
 */
export function getMapDir(): string {
  return MAP_DIR;
}
