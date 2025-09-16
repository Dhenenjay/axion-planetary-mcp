/**
 * Geometry caching system for Earth Engine MCP Server
 * Caches shapefile geometries to avoid repeated API calls
 */

interface CacheEntry {
  geometry: any;
  geoJson: any;
  metadata: {
    area_km2: number;
    perimeter_km: number;
    bbox: {
      west: number;
      south: number;
      east: number;
      north: number;
    };
    centroid: {
      lon: number;
      lat: number;
    };
    dataset: string;
    level: string;
  };
  timestamp: number;
  hits: number;
}

class GeometryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize = 100; // Maximum cache entries
  private readonly ttl = 3600000; // 1 hour TTL

  /**
   * Get cached geometry
   */
  get(placeName: string): CacheEntry | null {
    const key = this.normalizeKey(placeName);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit count
    entry.hits++;
    
    console.log(`[GeometryCache] Hit for "${placeName}" (${entry.hits} hits)`);
    return entry;
  }
  
  /**
   * Set cached geometry
   */
  set(placeName: string, data: Omit<CacheEntry, 'timestamp' | 'hits'>): void {
    const key = this.normalizeKey(placeName);
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const leastUsed = this.findLeastUsed();
      if (leastUsed) {
        this.cache.delete(leastUsed);
        console.log(`[GeometryCache] Evicted "${leastUsed}" from cache`);
      }
    }
    
    this.cache.set(key, {
      ...data,
      timestamp: Date.now(),
      hits: 0
    });
    
    console.log(`[GeometryCache] Cached geometry for "${placeName}" (${this.cache.size}/${this.maxSize} entries)`);
  }
  
  /**
   * Clear all cached entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[GeometryCache] Cleared ${size} entries`);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp
    }));
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: entries.sort((a, b) => b.hits - a.hits)
    };
  }
  
  /**
   * Normalize place name for cache key
   */
  private normalizeKey(placeName: string): string {
    return placeName.toLowerCase().trim().replace(/\s+/g, '_');
  }
  
  /**
   * Find least recently used entry
   */
  private findLeastUsed(): string | null {
    let leastUsed: { key: string; hits: number } | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!leastUsed || entry.hits < leastUsed.hits) {
        leastUsed = { key, hits: entry.hits };
      }
    }
    
    return leastUsed?.key || null;
  }
}

// Export singleton instance
export const geometryCache = new GeometryCache();

// Export common place name mappings for quick reference
export const COMMON_PLACES = {
  // Major US Cities
  'los angeles': { aliases: ['la', 'los angeles county'], type: 'county' },
  'san francisco': { aliases: ['sf', 'san francisco county', 'frisco'], type: 'county' },
  'new york': { aliases: ['nyc', 'new york city', 'manhattan', 'big apple'], type: 'city' },
  'chicago': { aliases: ['chi-town', 'cook county', 'windy city'], type: 'county' },
  'miami': { aliases: ['miami-dade', 'dade county'], type: 'county' },
  'seattle': { aliases: ['king county', 'emerald city'], type: 'county' },
  'boston': { aliases: ['suffolk county', 'beantown'], type: 'county' },
  'dallas': { aliases: ['dallas county', 'big d'], type: 'county' },
  'houston': { aliases: ['harris county', 'h-town'], type: 'county' },
  'phoenix': { aliases: ['maricopa county'], type: 'county' },
  
  // European Cities
  'paris': { aliases: ['city of light', 'paris france'], type: 'city' },
  'london': { aliases: ['london uk', 'london england', 'greater london'], type: 'city' },
  'berlin': { aliases: ['berlin germany'], type: 'city' },
  'madrid': { aliases: ['madrid spain'], type: 'city' },
  'rome': { aliases: ['roma', 'rome italy', 'eternal city'], type: 'city' },
  'amsterdam': { aliases: ['amsterdam netherlands'], type: 'city' },
  'barcelona': { aliases: ['barcelona spain', 'barca'], type: 'city' },
  'munich': { aliases: ['münchen', 'muenchen', 'munich germany'], type: 'city' },
  'milan': { aliases: ['milano', 'milan italy'], type: 'city' },
  'vienna': { aliases: ['wien', 'vienna austria'], type: 'city' },
  
  // Asian Cities
  'tokyo': { aliases: ['tokyo japan', 'edo'], type: 'city' },
  'beijing': { aliases: ['peking', 'beijing china'], type: 'city' },
  'shanghai': { aliases: ['shanghai china'], type: 'city' },
  'mumbai': { aliases: ['bombay', 'mumbai india'], type: 'city' },
  'delhi': { aliases: ['new delhi', 'delhi india'], type: 'city' },
  'bangalore': { aliases: ['bengaluru', 'bangalore india'], type: 'city' },
  'seoul': { aliases: ['seoul korea', 'seoul south korea'], type: 'city' },
  'singapore': { aliases: ['singapore city', 'sg'], type: 'city' },
  'hong kong': { aliases: ['hk', 'hong kong sar', 'hong kong china'], type: 'city' },
  'bangkok': { aliases: ['bangkok thailand', 'krung thep'], type: 'city' },
  'jakarta': { aliases: ['jakarta indonesia'], type: 'city' },
  'dubai': { aliases: ['dubai uae'], type: 'city' },
  
  // South American Cities
  'sao paulo': { aliases: ['são paulo', 'sao paulo brazil', 'sampa'], type: 'city' },
  'rio de janeiro': { aliases: ['rio', 'rio brazil'], type: 'city' },
  'buenos aires': { aliases: ['buenos aires argentina', 'bsas'], type: 'city' },
  'lima': { aliases: ['lima peru'], type: 'city' },
  'bogota': { aliases: ['bogotá', 'bogota colombia'], type: 'city' },
  'santiago': { aliases: ['santiago chile', 'santiago de chile'], type: 'city' },
  
  // African Cities
  'cairo': { aliases: ['cairo egypt', 'al qahirah'], type: 'city' },
  'johannesburg': { aliases: ['joburg', 'jozi', 'johannesburg south africa'], type: 'city' },
  'cape town': { aliases: ['cape town south africa', 'mother city'], type: 'city' },
  'lagos': { aliases: ['lagos nigeria'], type: 'city' },
  'nairobi': { aliases: ['nairobi kenya'], type: 'city' },
  
  // Australian Cities
  'sydney': { aliases: ['sydney australia', 'harbour city'], type: 'city' },
  'melbourne': { aliases: ['melbourne australia', 'melb'], type: 'city' },
  'brisbane': { aliases: ['brisbane australia', 'brissy'], type: 'city' },
  
  // US States
  'california': { aliases: ['ca', 'cali', 'golden state'], type: 'state' },
  'texas': { aliases: ['tx', 'lone star state'], type: 'state' },
  'florida': { aliases: ['fl', 'sunshine state'], type: 'state' },
  'new york state': { aliases: ['ny', 'new york', 'empire state'], type: 'state' },
  'illinois': { aliases: ['il', 'prairie state'], type: 'state' },
  
  // Countries
  'united states': { aliases: ['usa', 'us', 'america', 'united states of america'], type: 'country' },
  'canada': { aliases: ['ca', 'can'], type: 'country' },
  'mexico': { aliases: ['mx', 'mex', 'méxico'], type: 'country' },
  'united kingdom': { aliases: ['uk', 'britain', 'great britain', 'gb'], type: 'country' },
  'france': { aliases: ['fr', 'french republic'], type: 'country' },
  'germany': { aliases: ['de', 'deutschland', 'federal republic of germany'], type: 'country' },
  'italy': { aliases: ['it', 'italia', 'italian republic'], type: 'country' },
  'spain': { aliases: ['es', 'españa', 'kingdom of spain'], type: 'country' },
  'netherlands': { aliases: ['nl', 'holland', 'the netherlands'], type: 'country' },
  'japan': { aliases: ['jp', 'nippon', 'nihon'], type: 'country' },
  'china': { aliases: ['cn', 'prc', 'people\'s republic of china'], type: 'country' },
  'india': { aliases: ['in', 'bharat', 'republic of india'], type: 'country' },
  'brazil': { aliases: ['br', 'brasil', 'federative republic of brazil'], type: 'country' },
  'australia': { aliases: ['au', 'aus', 'commonwealth of australia'], type: 'country' },
  'south korea': { aliases: ['kr', 'republic of korea', 'rok'], type: 'country' },
  'indonesia': { aliases: ['id', 'republic of indonesia'], type: 'country' },
  'thailand': { aliases: ['th', 'kingdom of thailand', 'siam'], type: 'country' },
  'argentina': { aliases: ['ar', 'argentine republic'], type: 'country' },
  'south africa': { aliases: ['za', 'rsa', 'republic of south africa'], type: 'country' },
  'egypt': { aliases: ['eg', 'arab republic of egypt'], type: 'country' },
  'kenya': { aliases: ['ke', 'republic of kenya'], type: 'country' },
  'nigeria': { aliases: ['ng', 'federal republic of nigeria'], type: 'country' },
  'new zealand': { aliases: ['nz', 'aotearoa'], type: 'country' }
};

/**
 * Resolve place name aliases
 */
export function resolvePlaceName(input: string): string {
  const normalized = input.toLowerCase().trim();
  
  // Check if it's a direct match
  if (COMMON_PLACES[normalized]) {
    return normalized;
  }
  
  // Check if it's an alias
  for (const [canonical, info] of Object.entries(COMMON_PLACES)) {
    if (info.aliases.includes(normalized)) {
      console.log(`[GeometryCache] Resolved "${input}" to "${canonical}"`);
      return canonical;
    }
  }
  
  // Return original if no alias found
  return input;
}
