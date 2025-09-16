import ee from '@google/earthengine';

/**
 * Comprehensive global location search system
 * Supports any city, state, country, or county in the world
 */

export interface SearchResult {
  geometry: any;
  dataset: string;
  level: string;
  matchType: string;
  confidence: number;
}

/**
 * Main search function - tries multiple strategies to find any location
 */
export async function findGlobalLocation(placeName: string): Promise<any> {
  console.log(`🌍 Searching globally for: "${placeName}"`);
  
  // Normalize the input
  const normalized = placeName.toLowerCase().trim();
  const titleCase = toTitleCase(placeName);
  const upperCase = placeName.toUpperCase();
  
  // Parse location with context (e.g., "Paris, France" or "Austin, Texas")
  const { primary, context } = parseLocationWithContext(placeName);
  
  // Define all search strategies in priority order
  const strategies = [
    // 1. Try exact matches first
    () => searchExactMatch(placeName),
    () => searchExactMatch(titleCase),
    () => searchExactMatch(upperCase),
    
    // 2. Try with context if provided
    ...(context ? [() => searchWithContext(primary, context)] : []),
    
    // 3. Try US locations (TIGER dataset)
    () => searchUSLocation(placeName),
    
    // 4. Try global locations (FAO GAUL dataset)
    () => searchFAOGAUL(placeName),
    
    // 5. Try fuzzy matching
    () => searchFuzzy(placeName),
    
    // 6. Try removing common suffixes
    () => searchWithoutSuffixes(placeName),
    
    // 7. Try partial matching
    () => searchPartial(placeName)
  ];
  
  // Execute strategies in order until one succeeds
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result) {
        return result;
      }
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  // If nothing found, throw informative error
  throw new Error(`Could not find location: "${placeName}". Try adding more context (e.g., "Paris, France" or "Austin, Texas")`);
}

/**
 * Search for exact matches across all datasets
 */
async function searchExactMatch(searchTerm: string): Promise<any> {
  const datasets = [
    // US Counties
    {
      collection: 'TIGER/2016/Counties',
      fields: ['NAME', 'NAMELSAD'],
      level: 'County'
    },
    // US States
    {
      collection: 'TIGER/2016/States',
      fields: ['NAME', 'STUSPS'],
      level: 'State'
    },
    // Global Districts/Cities (Level 2)
    {
      collection: 'FAO/GAUL/2015/level2',
      fields: ['ADM2_NAME'],
      level: 'District/City'
    },
    // Global States/Provinces (Level 1)
    {
      collection: 'FAO/GAUL/2015/level1',
      fields: ['ADM1_NAME'],
      level: 'State/Province'
    },
    // Global Countries (Level 0)
    {
      collection: 'FAO/GAUL/2015/level0',
      fields: ['ADM0_NAME'],
      level: 'Country'
    },
    // International boundaries
    {
      collection: 'USDOS/LSIB_SIMPLE/2017',
      fields: ['country_na'],
      level: 'Country'
    }
  ];
  
  for (const dataset of datasets) {
    for (const field of dataset.fields) {
      try {
        const fc = (new ee.FeatureCollection(dataset.collection) as any);
        const filtered = fc.filter(ee.Filter.eq(field, searchTerm));
        
        // Check if there are any results first
        const size = filtered.size();
        const count = await size.getInfo();
        
        if (count > 0) {
          const first = filtered.first();
          const geometry = first.geometry();
          console.log(`✅ Found "${searchTerm}" in ${dataset.collection} (${field})`);
          return geometry;
        }
      } catch (e) {
        // Not found, continue
      }
    }
  }
  
  return null;
}

/**
 * Search with context (e.g., "Paris, France")
 */
async function searchWithContext(city: string, context: string): Promise<any> {
  // Try city in country
  try {
    const fc = (new ee.FeatureCollection('FAO/GAUL/2015/level2') as any);
    const filtered = fc.filter(
      ee.Filter.and(
        (ee.Filter as any).or(
          ee.Filter.eq('ADM2_NAME', city),
          ee.Filter.eq('ADM2_NAME', toTitleCase(city))
        ),
        (ee.Filter as any).or(
          ee.Filter.eq('ADM0_NAME', context),
          ee.Filter.eq('ADM0_NAME', toTitleCase(context))
        )
      )
    );
    
    const count = await filtered.size().getInfo();
    if (count > 0) {
      const first = filtered.first();
      const geometry = first.geometry();
      console.log(`✅ Found "${city}" in ${context}`);
      return geometry;
    }
  } catch (e) {
    // Try city in state/province
    try {
      const fc = (new ee.FeatureCollection('FAO/GAUL/2015/level2') as any);
      const filtered = fc.filter(
        ee.Filter.and(
          ee.Filter.eq('ADM2_NAME', city),
          ee.Filter.eq('ADM1_NAME', context)
        )
      );
      
      const count = await filtered.size().getInfo();
      if (count > 0) {
        const first = filtered.first();
        const geometry = first.geometry();
        console.log(`✅ Found "${city}" in state/province ${context}`);
        return geometry;
      }
    } catch (e2) {
      // Not found
    }
  }
  
  return null;
}

/**
 * Search US locations using TIGER dataset
 */
async function searchUSLocation(searchTerm: string): Promise<any> {
  const normalized = searchTerm.toLowerCase();
  const titleCase = toTitleCase(searchTerm);
  
  // Common US city to county mappings
  const cityToCounty: { [key: string]: { county: string, state: string } } = {
    'new york': { county: 'New York', state: '36' },
    'los angeles': { county: 'Los Angeles', state: '06' },
    'chicago': { county: 'Cook', state: '17' },
    'houston': { county: 'Harris', state: '48' },
    'phoenix': { county: 'Maricopa', state: '04' },
    'philadelphia': { county: 'Philadelphia', state: '42' },
    'san antonio': { county: 'Bexar', state: '48' },
    'san diego': { county: 'San Diego', state: '06' },
    'dallas': { county: 'Dallas', state: '48' },
    'san jose': { county: 'Santa Clara', state: '06' },
    'austin': { county: 'Travis', state: '48' },
    'jacksonville': { county: 'Duval', state: '12' },
    'san francisco': { county: 'San Francisco', state: '06' },
    'columbus': { county: 'Franklin', state: '39' },
    'fort worth': { county: 'Tarrant', state: '48' },
    'indianapolis': { county: 'Marion', state: '18' },
    'charlotte': { county: 'Mecklenburg', state: '37' },
    'seattle': { county: 'King', state: '53' },
    'denver': { county: 'Denver', state: '08' },
    'washington': { county: 'District of Columbia', state: '11' },
    'boston': { county: 'Suffolk', state: '25' },
    'nashville': { county: 'Davidson', state: '47' },
    'detroit': { county: 'Wayne', state: '26' },
    'portland': { county: 'Multnomah', state: '41' },
    'las vegas': { county: 'Clark', state: '32' },
    'miami': { county: 'Miami-Dade', state: '12' },
    'atlanta': { county: 'Fulton', state: '13' },
    'new orleans': { county: 'Orleans', state: '22' }
  };
  
  // Check if it's a known US city
  if (cityToCounty[normalized]) {
    const mapping = cityToCounty[normalized];
    try {
      const fc = (new ee.FeatureCollection('TIGER/2016/Counties') as any);
      const filtered = fc
        .filter(ee.Filter.eq('NAME', mapping.county))
        .filter(ee.Filter.eq('STATEFP', mapping.state));
      
      const count = await filtered.size().getInfo();
      if (count > 0) {
        const first = filtered.first();
        const geometry = first.geometry();
        console.log(`✅ Found US city "${searchTerm}" (${mapping.county} County)`);
        return geometry;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Try as US county
  try {
    const fc = (new ee.FeatureCollection('TIGER/2016/Counties') as any);
    const filtered = fc.filter(
      (ee.Filter as any).or(
        ee.Filter.eq('NAME', searchTerm),
        ee.Filter.eq('NAME', titleCase),
        ee.Filter.eq('NAMELSAD', searchTerm),
        ee.Filter.eq('NAMELSAD', titleCase),
        ee.Filter.eq('NAMELSAD', searchTerm + ' County'),
        ee.Filter.eq('NAMELSAD', titleCase + ' County')
      )
    );
    
    const count = await filtered.size().getInfo();
    if (count > 0) {
      const first = filtered.first();
      const geometry = first.geometry();
      console.log(`✅ Found US county "${searchTerm}"`);
      return geometry;
    }
  } catch (e) {
    // Not a US location
  }
  
  return null;
}

/**
 * Search FAO GAUL dataset for global locations
 */
async function searchFAOGAUL(searchTerm: string): Promise<any> {
  const variations = [
    searchTerm,
    toTitleCase(searchTerm),
    searchTerm.toUpperCase()
  ];
  
  // Special handling for major cities that might not be in FAO GAUL
  const majorCities: { [key: string]: { country: string, fallbackRegion?: string } } = {
    'sydney': { country: 'Australia', fallbackRegion: 'New South Wales' },
    'melbourne': { country: 'Australia', fallbackRegion: 'Victoria' },
    'brisbane': { country: 'Australia', fallbackRegion: 'Queensland' },
    'perth': { country: 'Australia', fallbackRegion: 'Western Australia' },
    'adelaide': { country: 'Australia', fallbackRegion: 'South Australia' },
    'auckland': { country: 'New Zealand', fallbackRegion: 'Auckland' },
    'wellington': { country: 'New Zealand', fallbackRegion: 'Wellington' },
    'vancouver': { country: 'Canada', fallbackRegion: 'British Columbia' },
    'toronto': { country: 'Canada', fallbackRegion: 'Ontario' },
    'montreal': { country: 'Canada', fallbackRegion: 'Quebec' }
  };
  
  const normalized = searchTerm.toLowerCase();
  if (majorCities[normalized]) {
    const cityInfo = majorCities[normalized];
    // Try to find the state/province for these cities
    if (cityInfo.fallbackRegion) {
      try {
        const fc = (new ee.FeatureCollection('FAO/GAUL/2015/level1') as any);
        const filtered = fc.filter(
          ee.Filter.and(
            ee.Filter.eq('ADM1_NAME', cityInfo.fallbackRegion),
            ee.Filter.eq('ADM0_NAME', cityInfo.country)
          )
        );
        
        const count = await filtered.size().getInfo();
        if (count > 0) {
          const first = filtered.first();
          const geometry = first.geometry();
          console.log(`✅ Found "${searchTerm}" via ${cityInfo.fallbackRegion}, ${cityInfo.country}`);
          return geometry;
        }
      } catch (e) {
        // Try country level
      }
    }
    
    // Fall back to country level
    try {
      const fc = (new ee.FeatureCollection('FAO/GAUL/2015/level0') as any);
      const filtered = fc.filter(ee.Filter.eq('ADM0_NAME', cityInfo.country));
      
      const count = await filtered.size().getInfo();
      if (count > 0) {
        const first = filtered.first();
        const geometry = first.geometry();
        console.log(`✅ Found "${searchTerm}" at country level: ${cityInfo.country}`);
        return geometry;
      }
    } catch (e) {
      // Continue with normal search
    }
  }
  
  const levels = [
    { collection: 'FAO/GAUL/2015/level2', field: 'ADM2_NAME', level: 'District' },
    { collection: 'FAO/GAUL/2015/level1', field: 'ADM1_NAME', level: 'State/Province' },
    { collection: 'FAO/GAUL/2015/level0', field: 'ADM0_NAME', level: 'Country' }
  ];
  
  for (const level of levels) {
    for (const variant of variations) {
      try {
        const fc = (new ee.FeatureCollection(level.collection) as any);
        const filtered = fc.filter(ee.Filter.eq(level.field, variant));
        
        const count = await filtered.size().getInfo();
        if (count > 0) {
          const first = filtered.first();
          const geometry = first.geometry();
          console.log(`✅ Found "${searchTerm}" in FAO GAUL ${level.level}`);
          return geometry;
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  return null;
}

/**
 * Fuzzy search with string contains
 * Note: Disabled because ee.Filter.stringContains doesn't exist
 */
async function searchFuzzy(searchTerm: string): Promise<any> {
  // Earth Engine doesn't support stringContains, so this is disabled
  return null;
  /*
  const datasets = [
    { collection: 'FAO/GAUL/2015/level2', field: 'ADM2_NAME' },
    { collection: 'FAO/GAUL/2015/level1', field: 'ADM1_NAME' },
    { collection: 'FAO/GAUL/2015/level0', field: 'ADM0_NAME' },
    { collection: 'TIGER/2016/Counties', field: 'NAME' },
    { collection: 'TIGER/2016/States', field: 'NAME' }
  ];
  
  for (const dataset of datasets) {
    try {
      const fc = (new ee.FeatureCollection(dataset.collection) as any);
      const filtered = fc.filter(
        ee.Filter.or(
          ee.Filter.stringContains(dataset.field, searchTerm),
          ee.Filter.stringContains(dataset.field, toTitleCase(searchTerm)),
          ee.Filter.stringStartsWith(dataset.field, searchTerm),
          ee.Filter.stringStartsWith(dataset.field, toTitleCase(searchTerm))
        )
      ).limit(1);
      
      const first = filtered.first();
      const geometry = first.geometry();
      
      console.log(`✅ Found "${searchTerm}" (fuzzy match) in ${dataset.collection}`);
      return geometry;
    } catch (e) {
      // Continue
    }
  }
  
  return null;
  */
}

/**
 * Search without common suffixes
 */
async function searchWithoutSuffixes(searchTerm: string): Promise<any> {
  const suffixes = [
    ' city', ' county', ' district', ' province', ' state',
    ' City', ' County', ' District', ' Province', ' State',
    ' CITY', ' COUNTY', ' DISTRICT', ' PROVINCE', ' STATE'
  ];
  
  for (const suffix of suffixes) {
    if (searchTerm.endsWith(suffix)) {
      const cleaned = searchTerm.substring(0, searchTerm.length - suffix.length);
      const result = await searchExactMatch(cleaned);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Partial matching for difficult cases
 */
async function searchPartial(searchTerm: string): Promise<any> {
  // Split compound names and try parts
  const parts = searchTerm.split(/[\s-]+/);
  
  if (parts.length > 1) {
    // Try each significant part
    for (const part of parts) {
      if (part.length > 3) { // Skip short words
        const result = await searchExactMatch(part) || await searchFuzzy(part);
        if (result) {
          console.log(`✅ Found "${searchTerm}" by partial match on "${part}"`);
          return result;
        }
      }
    }
  }
  
  return null;
}

/**
 * Helper functions
 */
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function parseLocationWithContext(placeName: string): { primary: string; context: string | null } {
  if (placeName.includes(',')) {
    const parts = placeName.split(',').map(p => p.trim());
    return {
      primary: parts[0],
      context: parts[1] || null
    };
  }
  return {
    primary: placeName,
    context: null
  };
}
