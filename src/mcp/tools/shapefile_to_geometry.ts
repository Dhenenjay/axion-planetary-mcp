import ee from '@google/earthengine';
import { register, z } from '../registry';
import { geometryCache, resolvePlaceName } from '@/src/utils/geometry-cache';

/**
 * Convert place names to Earth Engine geometry using built-in shapefiles
 * This tool fetches administrative boundaries from Earth Engine's datasets
 * and returns them as immediately usable geometries
 */
register({
  name: 'convert_place_to_shapefile_geometry',
  description: 'Convert any place name (city, county, state, country) to exact shapefile geometry from Earth Engine datasets. Returns GeoJSON that can be used directly for filtering, clipping, and exporting.',
  input: z.object({
    placeName: z.string().describe('Name of place (e.g., "Los Angeles", "San Francisco County", "California", "United States")'),
    simplify: z.boolean().default(false).describe('Simplify geometry to reduce complexity'),
    maxError: z.number().default(100).describe('Maximum error in meters for simplification')
  }),
  output: z.object({
    success: z.boolean(),
    placeName: z.string(),
    geometry: z.any(),
    geoJson: z.any(),
    area_km2: z.number(),
    perimeter_km: z.number(),
    dataset: z.string(),
    level: z.string(),
    bbox: z.object({
      west: z.number(),
      south: z.number(),
      east: z.number(),
      north: z.number()
    }),
    centroid: z.object({
      lon: z.number(),
      lat: z.number()
    }),
    usage: z.string()
  }),
  handler: async ({ placeName, simplify = false, maxError = 100 }) => {
    // Resolve any aliases
    const resolvedName = resolvePlaceName(placeName);
    
    try {
      console.log(`Converting "${resolvedName}" to shapefile geometry...`);
      
      // Check cache first
      const cached = geometryCache.get(resolvedName);
      if (cached && !simplify) {
        console.log(`Using cached geometry for "${resolvedName}"`);
        return {
          success: true,
          placeName: resolvedName,
          geometry: cached.geometry,
          geoJson: cached.geoJson,
          area_km2: cached.metadata.area_km2,
          perimeter_km: cached.metadata.perimeter_km,
          dataset: cached.metadata.dataset,
          level: cached.metadata.level,
          bbox: cached.metadata.bbox,
          centroid: cached.metadata.centroid,
          usage: `Use the 'geoJson' field directly in any Earth Engine operation. Example: filter_collection_by_date_and_region({ aoi: <this geoJson>, ... })`
        };
      }
      
      // Define search strategies for different place types
      const searchStrategies = [
        // Global Cities/Districts - Check FAO GAUL Level 2 first for global support
        {
          name: 'Global Cities/Districts (FAO GAUL Level 2)',
          check: () => true,
          search: async () => {
            const districts = new ee.FeatureCollection('FAO/GAUL/2015/level2') as any;
            
            // Enhanced global city mappings
            const globalCityMap: { [key: string]: { name: string, country: string, alternateNames?: string[] } } = {
              // European Cities
              'paris': { name: 'Paris', country: 'France', alternateNames: ['Ville de Paris'] },
              'london': { name: 'City of London', country: 'United Kingdom', alternateNames: ['Greater London', 'London'] },
              'berlin': { name: 'Berlin', country: 'Germany' },
              'madrid': { name: 'Madrid', country: 'Spain' },
              'rome': { name: 'Roma', country: 'Italy', alternateNames: ['Rome', 'Comune di Roma'] },
              'amsterdam': { name: 'Amsterdam', country: 'Netherlands' },
              'barcelona': { name: 'Barcelona', country: 'Spain' },
              'munich': { name: 'München', country: 'Germany', alternateNames: ['Munich', 'Muenchen', 'Munchen'] },
              'milan': { name: 'Milano', country: 'Italy', alternateNames: ['Milan'] },
              'vienna': { name: 'Wien', country: 'Austria', alternateNames: ['Vienna'] },
              
              // Asian Cities - Note: Many Asian cities may be at different admin levels
              'tokyo': { name: 'Tokyo', country: 'Japan', alternateNames: ['Tokyo-to', 'Tōkyō-to', 'Tokyo Metropolis'] },
              'beijing': { name: 'Beijing', country: 'China', alternateNames: ['Peking', 'Beijing Shi'] },
              'shanghai': { name: 'Shanghai', country: 'China', alternateNames: ['Shanghai Shi'] },
              'mumbai': { name: 'Mumbai Suburban', country: 'India', alternateNames: ['Mumbai', 'Greater Mumbai', 'Bombay'] },
              'delhi': { name: 'Delhi', country: 'India', alternateNames: ['New Delhi', 'National Capital Territory of Delhi'] },
              'bangalore': { name: 'Bangalore Urban', country: 'India', alternateNames: ['Bengaluru', 'Bangalore'] },
              'seoul': { name: 'Seoul', country: 'Republic of Korea', alternateNames: ['Seoul-teukbyeolsi'] },
              'singapore': { name: 'Singapore', country: 'Singapore' },
              'hong kong': { name: 'Hong Kong', country: 'China', alternateNames: ['Hong Kong SAR', 'Xianggang'] },
              'bangkok': { name: 'Bangkok', country: 'Thailand', alternateNames: ['Krung Thep', 'Bangkok Metropolis'] },
              'jakarta': { name: 'Jakarta Raya', country: 'Indonesia', alternateNames: ['Jakarta', 'DKI Jakarta'] },
              'manila': { name: 'Manila', country: 'Philippines', alternateNames: ['City of Manila', 'Maynila'] },
              'dubai': { name: 'Dubai', country: 'United Arab Emirates', alternateNames: ['Dubayy'] },
              'istanbul': { name: 'Istanbul', country: 'Turkey', alternateNames: ['İstanbul'] },
              'tel aviv': { name: 'Tel Aviv', country: 'Israel', alternateNames: ['Tel Aviv-Yafo'] },
              
              // South American Cities
              'sao paulo': { name: 'Sao Paulo', country: 'Brazil', alternateNames: ['São Paulo', 'S??o Paulo'] },
              'são paulo': { name: 'Sao Paulo', country: 'Brazil', alternateNames: ['São Paulo'] },
              'rio de janeiro': { name: 'Rio de Janeiro', country: 'Brazil', alternateNames: ['Rio'] },
              'buenos aires': { name: 'Buenos Aires', country: 'Argentina', alternateNames: ['Capital Federal'] },
              'lima': { name: 'Lima', country: 'Peru', alternateNames: ['Lima Metropolitana'] },
              'bogota': { name: 'Bogota', country: 'Colombia', alternateNames: ['Bogotá', 'Santafe de Bogota'] },
              'bogotá': { name: 'Bogota', country: 'Colombia', alternateNames: ['Bogotá'] },
              'santiago': { name: 'Santiago', country: 'Chile', alternateNames: ['Santiago de Chile'] },
              'caracas': { name: 'Caracas', country: 'Venezuela', alternateNames: ['Distrito Capital'] },
              
              // North American Cities
              'mexico city': { name: 'Ciudad de México', country: 'Mexico', alternateNames: ['Mexico City', 'CDMX'] },
              'toronto': { name: 'Toronto', country: 'Canada' },
              'montreal': { name: 'Montreal', country: 'Canada', alternateNames: ['Montréal'] },
              'vancouver': { name: 'Vancouver', country: 'Canada' },
              
              // African Cities - Note: Cairo is a governorate (state level)
              'cairo': { name: 'Al Qahirah', country: 'Egypt', alternateNames: ['Cairo', 'Cairo Governorate'] },
              'johannesburg': { name: 'City of Johannesburg', country: 'South Africa', alternateNames: ['Johannesburg'] },
              'cape town': { name: 'City of Cape Town', country: 'South Africa', alternateNames: ['Cape Town'] },
              'lagos': { name: 'Lagos', country: 'Nigeria', alternateNames: ['Lagos State'] },
              'nairobi': { name: 'Nairobi', country: 'Kenya', alternateNames: ['Nairobi City'] },
              'casablanca': { name: 'Casablanca', country: 'Morocco', alternateNames: ['Dar el Beida'] },
              
              // Australian/Pacific Cities - Note: These might not be in FAO GAUL Level 2
              'sydney': { name: 'Sydney', country: 'Australia', alternateNames: ['City of Sydney', 'Greater Sydney'] },
              'melbourne': { name: 'Melbourne', country: 'Australia', alternateNames: ['City of Melbourne', 'Greater Melbourne'] },
              'brisbane': { name: 'Brisbane', country: 'Australia', alternateNames: ['City of Brisbane'] },
              'auckland': { name: 'Auckland', country: 'New Zealand', alternateNames: ['Auckland City'] },
              'wellington': { name: 'Wellington', country: 'New Zealand', alternateNames: ['Wellington City'] },
              
              // US Cities (keeping existing mappings)
              'los angeles': { name: 'Los Angeles', country: 'United States of America' },
              'san francisco': { name: 'San Francisco', country: 'United States of America' },
              'new york': { name: 'New York', country: 'United States of America' },
              'chicago': { name: 'Cook', country: 'United States of America' },
              'miami': { name: 'Miami-Dade', country: 'United States of America' },
              'seattle': { name: 'King', country: 'United States of America' },
              'boston': { name: 'Suffolk', country: 'United States of America' },
              'dallas': { name: 'Dallas', country: 'United States of America' },
              'houston': { name: 'Harris', country: 'United States of America' },
              'phoenix': { name: 'Maricopa', country: 'United States of America' }
            };
            
            const lowerPlace = resolvedName.toLowerCase();
            
            // Check if we have a mapping for this city
            if (globalCityMap[lowerPlace]) {
              const mapping = globalCityMap[lowerPlace];
              console.log(`Using mapping for ${resolvedName}: ${mapping.name} in ${mapping.country}`);
              
              // Try the main name first
              let filtered = districts
                .filter(ee.Filter.eq('ADM2_NAME', mapping.name))
                .filter(ee.Filter.eq('ADM0_NAME', mapping.country));
              
              let count = await filtered.size().getInfo();
              console.log(`Searching for ADM2_NAME='${mapping.name}' in ADM0_NAME='${mapping.country}': found ${count}`);
              
              // If not found and we have alternate names, try those
              if (count === 0 && mapping.alternateNames) {
                for (const altName of mapping.alternateNames) {
                  console.log(`Trying alternate name: ${altName}`);
                  filtered = districts
                    .filter(ee.Filter.eq('ADM2_NAME', altName))
                    .filter(ee.Filter.eq('ADM0_NAME', mapping.country));
                  
                  count = await filtered.size().getInfo();
                  if (count > 0) {
                    console.log(`Found with alternate name: ${altName}`);
                    break;
                  }
                }
              }
              
              // If still not found, try without country filter (some cities might be unique)
              if (count === 0) {
                console.log(`Trying without country filter...`);
                filtered = districts.filter(ee.Filter.eq('ADM2_NAME', mapping.name));
                count = await filtered.size().getInfo();
              }
              
              if (count > 0) {
                console.log(`Found ${resolvedName} in FAO GAUL Level 2`);
                return {
                  feature: filtered.first(),
                  dataset: 'FAO GAUL 2015',
                  level: 'City/District'
                };
              } else {
                console.log(`Could not find ${mapping.name} in FAO GAUL Level 2`);
                
                // Try Level 1 (state/province) as fallback for cities that are administrative regions
                console.log(`Trying FAO GAUL Level 1 for ${mapping.name}...`);
                const states = new ee.FeatureCollection('FAO/GAUL/2015/level1') as any;
                
                // Try main name
                let stateFiltered = states
                  .filter(ee.Filter.eq('ADM1_NAME', mapping.name))
                  .filter(ee.Filter.eq('ADM0_NAME', mapping.country));
                
                let stateCount = await stateFiltered.size().getInfo();
                
                // Try alternate names at Level 1
                if (stateCount === 0 && mapping.alternateNames) {
                  for (const altName of mapping.alternateNames) {
                    stateFiltered = states
                      .filter(ee.Filter.eq('ADM1_NAME', altName))
                      .filter(ee.Filter.eq('ADM0_NAME', mapping.country));
                    
                    stateCount = await stateFiltered.size().getInfo();
                    if (stateCount > 0) {
                      console.log(`Found at Level 1 with name: ${altName}`);
                      break;
                    }
                  }
                }
                
                // Try without country filter at Level 1
                if (stateCount === 0) {
                  stateFiltered = states.filter(ee.Filter.eq('ADM1_NAME', mapping.name));
                  stateCount = await stateFiltered.size().getInfo();
                }
                
                if (stateCount > 0) {
                  console.log(`Found ${resolvedName} in FAO GAUL Level 1 (State/Province)`);
                  return {
                    feature: stateFiltered.first(),
                    dataset: 'FAO GAUL 2015',
                    level: 'State/Province (City Region)'
                  };
                }
              }
            }
            
            // Try direct match with various case combinations
            const variations = [
              resolvedName,
              resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1).toLowerCase(),
              resolvedName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ')
            ];
            
            for (const variant of variations) {
              let matches = districts.filter(ee.Filter.eq('ADM2_NAME', variant));
              let count = await matches.size().getInfo();
              
              if (count > 0) {
                // If multiple matches, try to filter by context if provided
                if (count > 1 && resolvedName.includes(',')) {
                  const parts = resolvedName.split(',').map(p => p.trim());
                  if (parts.length > 1) {
                    const context = parts[1];
                    // Try to filter by country or state
                    matches = matches.filter(
                      ee.Filter.or(
                        ee.Filter.eq('ADM0_NAME', context),
                        ee.Filter.eq('ADM1_NAME', context)
                      )
                    );
                    count = await matches.size().getInfo();
                  }
                }
                
                if (count > 0) {
                  return {
                    feature: matches.first(),
                    dataset: 'FAO GAUL 2015',
                    level: 'District'
                  };
                }
              }
            }
            
            return null;
          }
        },
        
        // US Counties - for backward compatibility
        {
          name: 'US County (Census TIGER)',
          check: () => resolvedName.toLowerCase().includes('county') || 
                       resolvedName.toLowerCase().includes(', us') ||
                       resolvedName.toLowerCase().includes(', united states'),
          search: async () => {
            const counties = new ee.FeatureCollection('TIGER/2016/Counties') as any;
            
            // Try exact match first
            let matches = counties.filter(ee.Filter.eq('NAME', resolvedName.replace(' County', '')));
            let count = await matches.size().getInfo();
            
            if (count === 0) {
              // Try with "County" added
              matches = counties.filter(ee.Filter.eq('NAMELSAD', resolvedName + ' County'));
              count = await matches.size().getInfo();
            }
            
            if (count > 0) {
              return {
                feature: matches.first(),
                dataset: 'US Census TIGER 2016',
                level: 'County'
              };
            }
            return null;
          }
        },
        
        // US States
        {
          name: 'US States',
          check: () => ['california', 'texas', 'florida', 'new york', 'illinois'].some(s => 
                       resolvedName.toLowerCase().includes(s)),
          search: async () => {
            const states = new ee.FeatureCollection('TIGER/2016/States') as any;
            let matches = states.filter(ee.Filter.eq('NAME', resolvedName));
            const count = await matches.size().getInfo();
            
            if (count > 0) {
              return {
                feature: matches.first(),
                dataset: 'US Census TIGER 2016',
                level: 'State'
              };
            }
            return null;
          }
        },
        
        // FAO GAUL Level 1 - States/Provinces
        {
          name: 'Global States/Provinces (FAO GAUL Level 1)',
          check: () => true,
          search: async () => {
            const states = new ee.FeatureCollection('FAO/GAUL/2015/level1') as any;
            
            // Try various name formats
            const variations = [
              resolvedName,
              resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1).toLowerCase(),
              resolvedName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ')
            ];
            
            for (const variant of variations) {
              let matches = states.filter(ee.Filter.eq('ADM1_NAME', variant));
              const count = await matches.size().getInfo();
              
              if (count > 0) {
                console.log(`Found ${resolvedName} in FAO GAUL Level 1`);
                return {
                  feature: matches.first(),
                  dataset: 'FAO GAUL 2015',
                  level: 'State/Province'
                };
              }
            }
            
            // If it includes a country context (e.g., "California, USA")
            if (resolvedName.includes(',')) {
              const parts = resolvedName.split(',').map(p => p.trim());
              const stateName = parts[0];
              const countryContext = parts[1];
              
              let matches = states.filter(
                ee.Filter.and(
                  ee.Filter.eq('ADM1_NAME', stateName),
                  ee.Filter.eq('ADM0_NAME', countryContext)
                )
              );
              
              const count = await matches.size().getInfo();
              if (count > 0) {
                return {
                  feature: matches.first(),
                  dataset: 'FAO GAUL 2015',
                  level: 'State/Province'
                };
              }
            }
            
            return null;
          }
        },
        
        // Countries
        {
          name: 'Countries (FAO GAUL Level 0)',
          check: () => true,
          search: async () => {
            const countries = new ee.FeatureCollection('FAO/GAUL/2015/level0') as any;
            
            // Country name mappings and variations
            const countryMap: { [key: string]: string } = {
              'usa': 'United States of America',
              'us': 'United States of America',
              'united states': 'United States of America',
              'uk': 'United Kingdom',
              'britain': 'United Kingdom',
              'great britain': 'United Kingdom',
              'uae': 'United Arab Emirates',
              'south korea': 'Republic of Korea',
              'north korea': "Democratic People's Republic of Korea",
              'vietnam': 'Viet Nam',
              'czech republic': 'Czechia',
              'holland': 'Netherlands',
              'the netherlands': 'Netherlands'
            };
            
            // Check if we have a mapping
            const lowerName = resolvedName.toLowerCase();
            const mappedName = countryMap[lowerName] || resolvedName;
            
            // Try various name formats
            const variations = [
              mappedName,
              mappedName.charAt(0).toUpperCase() + mappedName.slice(1).toLowerCase(),
              mappedName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ')
            ];
            
            for (const variant of variations) {
              let matches = countries.filter(ee.Filter.eq('ADM0_NAME', variant));
              const count = await matches.size().getInfo();
              
              if (count > 0) {
                console.log(`Found country: ${resolvedName}`);
                return {
                  feature: matches.first(),
                  dataset: 'FAO GAUL 2015',
                  level: 'Country'
                };
              }
            }
            
            return null;
          }
        }
      ];
      
      // Search through strategies
      let result = null;
      for (const strategy of searchStrategies) {
        if (strategy.check()) {
          console.log(`Trying ${strategy.name}...`);
          result = await strategy.search();
          if (result) {
            console.log(`Found in ${strategy.name}`);
            break;
          }
        }
      }
      
      if (!result) {
        throw new Error(`No shapefile boundary found for "${resolvedName}". Try a more specific name or check spelling.`);
      }
      
      // Get the geometry
      let geometry = result.feature.geometry();
      
      // Simplify if requested
      if (simplify) {
        geometry = geometry.simplify(maxError);
        console.log(`Simplified geometry with max error of ${maxError}m`);
      }
      
      // Calculate metrics
      const area = await geometry.area().getInfo();
      const perimeter = await geometry.perimeter().getInfo();
      const bounds = await geometry.bounds().getInfo();
      const centroid = await geometry.centroid().getInfo();
      
      // Get the actual GeoJSON
      const geoJson = await geometry.getInfo();
      
      // Extract bbox coordinates
      const coords = bounds.coordinates[0];
      const bbox = {
        west: Math.min(coords[0][0], coords[1][0], coords[2][0], coords[3][0]),
        south: Math.min(coords[0][1], coords[1][1], coords[2][1], coords[3][1]),
        east: Math.max(coords[0][0], coords[1][0], coords[2][0], coords[3][0]),
        north: Math.max(coords[0][1], coords[1][1], coords[2][1], coords[3][1])
      };
      
      const centroidCoords = centroid.coordinates;
      
      // Cache the result if not simplified
      if (!simplify) {
        geometryCache.set(resolvedName, {
          geometry: geometry,
          geoJson: geoJson,
          metadata: {
            area_km2: Math.round(area / 1000000),
            perimeter_km: Math.round(perimeter / 1000),
            dataset: result.dataset,
            level: result.level,
            bbox: bbox,
            centroid: {
              lon: centroidCoords[0],
              lat: centroidCoords[1]
            }
          }
        });
      }
      
      return {
        success: true,
        placeName: resolvedName,
        geometry: geometry,
        geoJson: geoJson,
        area_km2: Math.round(area / 1000000),
        perimeter_km: Math.round(perimeter / 1000),
        dataset: result.dataset,
        level: result.level,
        bbox: bbox,
        centroid: {
          lon: centroidCoords[0],
          lat: centroidCoords[1]
        },
        usage: `Use the 'geoJson' field directly in any Earth Engine operation. Example: filter_collection_by_date_and_region({ aoi: <this geoJson>, ... })`
      };
      
    } catch (error) {
      console.error('Error converting place to shapefile:', error);
      throw new Error(`Failed to convert "${resolvedName}" to shapefile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * Import a custom shapefile as an Earth Engine asset
 * This handles user-provided shapefiles
 */
register({
  name: 'import_custom_shapefile',
  description: 'Import a custom shapefile (from file or GeoJSON) as an Earth Engine asset for use in operations',
  input: z.object({
    name: z.string().describe('Name for this shapefile asset'),
    geoJson: z.any().describe('GeoJSON object (FeatureCollection or Feature)'),
    properties: z.record(z.any()).optional().describe('Properties to attach to the geometry')
  }),
  output: z.object({
    success: z.boolean(),
    assetId: z.string(),
    geometry: z.any(),
    area_km2: z.number(),
    message: z.string()
  }),
  handler: async ({ name, geoJson, properties = {} }) => {
    try {
      // Create Earth Engine geometry from GeoJSON
      let eeGeometry;
      
      if (geoJson.type === 'FeatureCollection') {
        eeGeometry = new ee.FeatureCollection(geoJson.features.map((f: any) => 
          new ee.Feature(new ee.Geometry(f.geometry), f.properties || {})
        ));
      } else if (geoJson.type === 'Feature') {
        eeGeometry = new ee.Feature(new ee.Geometry(geoJson.geometry), geoJson.properties || properties);
      } else if (geoJson.type && geoJson.coordinates) {
        // Direct geometry
        eeGeometry = new ee.Geometry(geoJson);
      } else {
        throw new Error('Invalid GeoJSON format');
      }
      
      // For now, we'll work with the geometry directly without uploading to assets
      // (Asset upload requires additional authentication and permissions)
      
      // Calculate area
      const geometry = (eeGeometry as any).geometry ? (eeGeometry as any).geometry() : eeGeometry;
      const area = await geometry.area().getInfo();
      
      return {
        success: true,
        assetId: `memory://${name}`,
        geometry: geometry,
        area_km2: Math.round(area / 1000000),
        message: `Custom shapefile "${name}" loaded successfully (${Math.round(area / 1000000)} km²). Use the geometry directly in operations.`
      };
      
    } catch (error) {
      throw new Error(`Failed to import shapefile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
