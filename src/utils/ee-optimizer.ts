/**
 * Advanced Earth Engine Optimizer
 * Implements sophisticated techniques to prevent timeouts and optimize performance
 */

import ee from '@google/earthengine';
import crypto from 'crypto';

// Custom LRU Cache implementation
class SimpleCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 500, ttl: number = 1000 * 60 * 30) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Advanced caching system with TTL and size limits
const cache = new SimpleCache<string, any>(500, 1000 * 60 * 30);

// Request queue to prevent overloading
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private concurrency = 3; // Max concurrent requests
  private activeRequests = 0;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.activeRequests++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.concurrency) {
      const task = this.queue.shift();
      if (task) {
        task().catch(console.error);
      }
    }

    this.processing = false;
    
    // Continue processing if there are more items
    if (this.queue.length > 0) {
      setTimeout(() => this.process(), 100);
    }
  }
}

const requestQueue = new RequestQueue();

/**
 * Generate cache key from parameters
 */
function getCacheKey(operation: string, params: any): string {
  const hash = crypto.createHash('md5');
  hash.update(operation);
  hash.update(JSON.stringify(params));
  return hash.digest('hex');
}

/**
 * Optimized getInfo with chunking and caching
 */
export async function optimizedGetInfo(eeObject: any, options: any = {}): Promise<any> {
  const cacheKey = getCacheKey('getInfo', { obj: eeObject.serialize(), options });
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Use request queue to prevent overloading
  const result = await requestQueue.add(async () => {
    // Set a timeout promise (increased for tile operations)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), options.timeout || 45000)
    );

    // Execute the actual operation
    const operationPromise = eeObject.getInfo();

    try {
      const data = await Promise.race([operationPromise, timeoutPromise]);
      cache.set(cacheKey, data);
      return data;
    } catch (error: any) {
      // If timeout, return partial data
      if (error?.message === 'Operation timed out') {
        const partial = { 
          status: 'partial', 
          message: 'Data too large - returning summary',
          type: eeObject.name() || 'Unknown'
        };
        cache.set(cacheKey, partial);
        return partial;
      }
      throw error;
    }
  });

  return result;
}

/**
 * Stream large collections in chunks
 */
export async function* streamCollection(
  collection: any,
  chunkSize: number = 100
): AsyncGenerator<any[]> {
  const totalSize = await collection.size().getInfo();
  let offset = 0;

  while (offset < totalSize) {
    const chunk = await collection
      .limit(chunkSize, 'system:time_start')
      .skip(offset)
      .getInfo();
    
    yield chunk.features || [];
    offset += chunkSize;

    // Small delay to prevent overloading
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Optimized collection info with sampling
 */
export async function getCollectionInfoOptimized(datasetId: string): Promise<any> {
  const cacheKey = getCacheKey('collectionInfo', { datasetId });
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const collection = new ee.ImageCollection(datasetId);
    
    // Use sampling for large collections
    const size = await requestQueue.add(() => collection.size().getInfo()) as number;
    
    // Sample strategy based on collection size
    let sampleSize = 1;
    let sampling = 'first';
    
    if (size > 10000) {
      sampleSize = 5; // Very large: sample 5 images
      sampling = 'random';
    } else if (size > 1000) {
      sampleSize = 10; // Large: sample 10 images
      sampling = 'distributed';
    } else if (size > 100) {
      sampleSize = 20; // Medium: sample 20 images
      sampling = 'distributed';
    } else {
      sampleSize = Math.min(size, 50); // Small: up to 50 images
    }

    // Get sample for metadata
    let sample;
    if (sampling === 'random') {
      sample = (collection as any).randomColumn('random').sort('random').limit(sampleSize);
    } else if (sampling === 'distributed') {
      // Get evenly distributed samples
      const step = Math.floor(size / sampleSize);
      const indices = Array.from({ length: sampleSize }, (_, i) => i * step);
      sample = new ee.ImageCollection(
        indices.map(i => (collection as any).toList(1, i).get(0))
      );
    } else {
      sample = (collection as any).limit(sampleSize);
    }

    // Get metadata from sample
    const first = sample.first();
    const bandNames = await requestQueue.add(() => first.bandNames().getInfo());
    const projection = await requestQueue.add(() => first.projection().getInfo());

    // Get date range efficiently
    let dateRange = { start: null as string | null, end: null as string | null };
    
    if (size > 0) {
      // For very large collections, use metadata instead of computing
      if (size > 10000) {
        // Use a heuristic based on dataset ID
        if (datasetId.includes('COPERNICUS/S2')) {
          dateRange.start = '2015-06-23T00:00:00.000Z'; // Sentinel-2 launch
          dateRange.end = new Date().toISOString();
        } else if (datasetId.includes('LANDSAT')) {
          dateRange.start = '2013-04-11T00:00:00.000Z'; // Landsat 8 launch
          dateRange.end = new Date().toISOString();
        } else {
          // Generic range
          dateRange.start = '2000-01-01T00:00:00.000Z';
          dateRange.end = new Date().toISOString();
        }
      } else {
        // For smaller collections, compute actual range
        try {
          const dates = await requestQueue.add(() => 
            sample.aggregate_array('system:time_start').getInfo()
          );
          
          if (dates && (dates as any).length > 0) {
            const validDates = (dates as any[]).filter((d: any) => d != null);
            if (validDates.length > 0) {
              dateRange.start = new Date(Math.min(...validDates)).toISOString();
              dateRange.end = new Date(Math.max(...validDates)).toISOString();
            }
          }
        } catch (e) {
          // If date computation fails, use estimates
          const firstDate = await requestQueue.add(() => 
            first.get('system:time_start').getInfo()
          ).catch(() => null);
          
          if (firstDate) {
            dateRange.start = new Date(firstDate as any).toISOString();
            dateRange.end = new Date().toISOString();
          }
        }
      }
    }

    const result = {
      datasetId,
      type: 'ImageCollection',
      bandNames,
      projection: (projection as any).crs,
      imageCount: size,
      dateRange,
      sampleSize: sampleSize,
      samplingMethod: sampling,
      message: `Collection has ${(bandNames as any[]).length} bands and ${size} images (sampled ${sampleSize})`
    };

    cache.set(cacheKey, result);
    return result;

  } catch (error: any) {
    // Even if there's an error, return something useful
    const fallbackResult = {
      datasetId,
      type: 'ImageCollection',
      error: error.message,
      message: 'Could not fully load collection info - returning partial data',
      imageCount: 'Unknown',
      suggestion: 'Try with a more specific date range or region filter'
    };
    
    cache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }
}

/**
 * Lazy evaluation wrapper
 */
export class LazyEEObject {
  private eeObject: any;
  private evaluated: any = null;
  private evaluating: Promise<any> | null = null;

  constructor(eeObject: any) {
    this.eeObject = eeObject;
  }

  async evaluate(): Promise<any> {
    if (this.evaluated) {
      return this.evaluated;
    }

    if (this.evaluating) {
      return this.evaluating;
    }

    this.evaluating = optimizedGetInfo(this.eeObject);
    this.evaluated = await this.evaluating;
    this.evaluating = null;

    return this.evaluated;
  }

  getEEObject() {
    return this.eeObject;
  }
}

/**
 * Progressive loading for complex operations
 */
export async function progressiveLoad<T>(
  operation: () => Promise<T>,
  fallbacks: Array<() => Promise<T>>
): Promise<T> {
  try {
    // Try main operation with short timeout
    const result = await Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);
    return result;
  } catch (error) {
    // Try fallbacks
    for (const fallback of fallbacks) {
      try {
        const result = await Promise.race([
          fallback(),
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);
        return result;
      } catch (e) {
        continue;
      }
    }
    
    // If all fail, throw original error
    throw error;
  }
}

/**
 * Batch operations for efficiency
 */
export class BatchProcessor {
  private batch: Array<{ id: string; operation: () => Promise<any> }> = [];
  private results: Map<string, any> = new Map();
  private processing = false;

  add(id: string, operation: () => Promise<any>) {
    this.batch.push({ id, operation });
  }

  async process(): Promise<Map<string, any>> {
    if (this.processing) {
      throw new Error('Batch already processing');
    }

    this.processing = true;
    this.results.clear();

    // Process in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < this.batch.length; i += concurrency) {
      const chunk = this.batch.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(item => item.operation())
      );

      chunk.forEach((item, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          this.results.set(item.id, result.value);
        } else {
          this.results.set(item.id, { error: result.reason.message });
        }
      });
    }

    this.processing = false;
    this.batch = [];
    return this.results;
  }
}

// Export singleton instances
export const batchProcessor = new BatchProcessor();
export const optimizer = {
  cache,
  requestQueue,
  optimizedGetInfo,
  streamCollection,
  getCollectionInfoOptimized,
  LazyEEObject,
  progressiveLoad,
  batchProcessor
};
