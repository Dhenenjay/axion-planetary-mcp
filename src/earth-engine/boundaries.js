const { getEarthEngine } = require('./init');

/**
 * Get administrative boundary for a location using Earth Engine's built-in datasets
 * @param {object} params - Boundary parameters
 * @returns {Promise<object>} Boundary geometry and metadata
 */
async function getAdminBoundary(params) {
  const ee = getEarthEngine();
  const {
    placeName,      // e.g., "San Francisco"
    adminLevel = 2, // 0=country, 1=state/province, 2=county/district
    country = 'USA',
    returnType = 'geometry' // 'geometry' or 'feature'
  } = params;

  try {
    let boundaryFeature;
    let dataset;
    let filterProperty;
    
    // Select appropriate dataset based on admin level
    switch(adminLevel) {
      case 0: // Country level
        // Use Large Scale International Boundaries (LSIB)
        dataset = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
        filterProperty = 'country_na';
        break;
        
      case 1: // State/Province level
        // FAO GAUL Level 1 (States/Provinces)
        dataset = ee.FeatureCollection('FAO/GAUL/2015/level1');
        filterProperty = 'ADM1_NAME';
        break;
        
      case 2: // County/District level
        // FAO GAUL Level 2 (Districts/Counties)
        dataset = ee.FeatureCollection('FAO/GAUL/2015/level2');
        filterProperty = 'ADM2_NAME';
        break;
        
      case 3: // City/Municipality (US specific)
        // US Census Tiger boundaries
        dataset = ee.FeatureCollection('TIGER/2018/Counties');
        filterProperty = 'NAME';
        break;
        
      default:
        throw new Error('Invalid admin level. Use 0 (country), 1 (state), 2 (county), or 3 (city)');
    }
    
    // Filter to get the specific boundary
    let filtered;
    if (adminLevel === 0) {
      // For countries, direct filter
      filtered = dataset.filter(ee.Filter.eq(filterProperty, placeName));
    } else {
      // For sub-national, filter by name (and country if needed)
      filtered = dataset.filter(ee.Filter.eq(filterProperty, placeName));
      
      // Additional country filter for non-US locations
      if (country !== 'USA' && adminLevel > 0) {
        filtered = filtered.filter(ee.Filter.eq('ADM0_NAME', country));
      }
    }
    
    // Get the first matching feature
    boundaryFeature = ee.Feature(filtered.first());
    
    // Get the geometry
    const geometry = boundaryFeature.geometry();
    
    // Simplify if it's too complex (helps with export size)
    const simplifiedGeometry = geometry.simplify(100); // 100m simplification
    
    // Get bounds and metadata
    const bounds = geometry.bounds();
    const centroid = geometry.centroid();
    const area = geometry.area();
    
    // Evaluate to get actual values
    const result = await new Promise((resolve, reject) => {
      if (returnType === 'geometry') {
        // Return just the geometry
        simplifiedGeometry.evaluate((geo, error) => {
          if (error) reject(error);
          else {
            // Also get metadata
            Promise.all([
              new Promise((res) => bounds.evaluate((b) => res(b))),
              new Promise((res) => centroid.evaluate((c) => res(c))),
              new Promise((res) => area.evaluate((a) => res(a))),
              new Promise((res) => boundaryFeature.evaluate((f) => res(f)))
            ]).then(([boundsData, centroidData, areaData, featureData]) => {
              resolve({
                geometry: geo,
                bounds: boundsData,
                centroid: centroidData,
                area: areaData / 1000000, // Convert to km²
                properties: featureData.properties,
                name: placeName,
                adminLevel: adminLevel
              });
            });
          }
        });
      } else {
        // Return full feature with properties
        boundaryFeature.evaluate((feat, error) => {
          if (error) reject(error);
          else resolve(feat);
        });
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('Error getting boundary:', error);
    throw error;
  }
}

/**
 * Get US-specific boundaries (cities, counties, states)
 * @param {object} params - Search parameters
 * @returns {Promise<object>} Boundary geometry
 */
async function getUSBoundary(params) {
  const ee = getEarthEngine();
  const {
    city,
    county,
    state,
    type = 'county' // 'state', 'county', or 'city'
  } = params;
  
  try {
    let dataset;
    let filters = [];
    
    switch(type) {
      case 'state':
        dataset = ee.FeatureCollection('TIGER/2018/States');
        if (state) filters.push(ee.Filter.eq('NAME', state));
        break;
        
      case 'county':
        dataset = ee.FeatureCollection('TIGER/2018/Counties');
        if (county) filters.push(ee.Filter.eq('NAME', county));
        if (state) filters.push(ee.Filter.eq('STATEFP', getStateFIPS(state)));
        break;
        
      case 'city':
        // For cities, we often need to use Places dataset
        dataset = ee.FeatureCollection('TIGER/2016/CBSAs');
        if (city) filters.push(ee.Filter.stringContains('NAME', city));
        break;
        
      default:
        throw new Error('Invalid type. Use "state", "county", or "city"');
    }
    
    // Apply filters
    let filtered = dataset;
    filters.forEach(filter => {
      filtered = filtered.filter(filter);
    });
    
    // Get the first match
    const feature = ee.Feature(filtered.first());
    const geometry = feature.geometry();
    
    // Evaluate and return
    const result = await new Promise((resolve, reject) => {
      Promise.all([
        new Promise((res) => geometry.evaluate((g) => res(g))),
        new Promise((res) => feature.evaluate((f) => res(f)))
      ]).then(([geometryData, featureData]) => {
        resolve({
          geometry: geometryData,
          properties: featureData.properties,
          type: type,
          name: city || county || state
        });
      }).catch(reject);
    });
    
    return result;
    
  } catch (error) {
    console.error('Error getting US boundary:', error);
    throw error;
  }
}

/**
 * Import and use a custom shapefile from Earth Engine Assets
 * @param {string} assetId - Earth Engine asset ID of the uploaded shapefile
 * @returns {Promise<object>} Feature collection
 */
async function useCustomShapefile(assetId) {
  const ee = getEarthEngine();
  
  try {
    // Load the asset
    const customBoundary = ee.FeatureCollection(assetId);
    
    // Get metadata
    const count = customBoundary.size();
    const first = customBoundary.first();
    const geometry = customBoundary.geometry();
    
    const result = await new Promise((resolve, reject) => {
      Promise.all([
        new Promise((res) => count.evaluate((c) => res(c))),
        new Promise((res) => first.evaluate((f) => res(f))),
        new Promise((res) => geometry.evaluate((g) => res(g)))
      ]).then(([countData, firstFeature, geometryData]) => {
        resolve({
          featureCount: countData,
          firstFeature: firstFeature,
          combinedGeometry: geometryData,
          assetId: assetId,
          message: `Loaded ${countData} features from custom shapefile`
        });
      }).catch(reject);
    });
    
    return result;
    
  } catch (error) {
    console.error('Error loading custom shapefile:', error);
    throw error;
  }
}

/**
 * Search for available boundaries by name
 * @param {object} params - Search parameters
 * @returns {Promise<array>} List of matching boundaries
 */
async function searchBoundaries(params) {
  const ee = getEarthEngine();
  const {
    searchTerm,
    adminLevel = 2,
    country = null,
    limit = 10
  } = params;
  
  try {
    // Select dataset based on admin level
    let dataset;
    let nameProperty;
    
    switch(adminLevel) {
      case 0:
        dataset = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
        nameProperty = 'country_na';
        break;
      case 1:
        dataset = ee.FeatureCollection('FAO/GAUL/2015/level1');
        nameProperty = 'ADM1_NAME';
        break;
      case 2:
        dataset = ee.FeatureCollection('FAO/GAUL/2015/level2');
        nameProperty = 'ADM2_NAME';
        break;
      default:
        throw new Error('Invalid admin level');
    }
    
    // Filter by search term (case insensitive)
    let filtered = dataset.filter(ee.Filter.stringContains(nameProperty, searchTerm));
    
    // Add country filter if specified
    if (country && adminLevel > 0) {
      filtered = filtered.filter(ee.Filter.eq('ADM0_NAME', country));
    }
    
    // Limit results
    filtered = filtered.limit(limit);
    
    // Get the results
    const results = await new Promise((resolve, reject) => {
      filtered.evaluate((features, error) => {
        if (error) reject(error);
        else {
          const matches = features.features.map(f => ({
            name: f.properties[nameProperty],
            country: f.properties.ADM0_NAME || f.properties.country_na,
            properties: f.properties,
            id: f.id
          }));
          resolve(matches);
        }
      });
    });
    
    return results;
    
  } catch (error) {
    console.error('Error searching boundaries:', error);
    throw error;
  }
}

/**
 * Helper function to get state FIPS code
 */
function getStateFIPS(stateName) {
  const fipsMap = {
    'California': '06',
    'Texas': '48',
    'New York': '36',
    'Florida': '12',
    // Add more as needed
  };
  return fipsMap[stateName] || '06'; // Default to CA
}

/**
 * Export data for a specific administrative boundary
 * @param {object} params - Export parameters
 * @returns {Promise<object>} Export task info
 */
async function exportWithBoundary(params) {
  const ee = getEarthEngine();
  const {
    placeName,
    adminLevel = 2,
    country = 'USA',
    datasetId,
    startDate,
    endDate,
    bands,
    scale = 10,
    description
  } = params;
  
  try {
    // Get the boundary
    const boundary = await getAdminBoundary({
      placeName: placeName,
      adminLevel: adminLevel,
      country: country
    });
    
    console.log(`Found boundary for ${placeName}:`);
    console.log(`  Area: ${Math.round(boundary.area)} km²`);
    console.log(`  Admin Level: ${boundary.adminLevel}`);
    
    // Create the export region from the boundary geometry
    // Use the original EE geometry object, not the evaluated one
    const boundaryFeature = ee.FeatureCollection('FAO/GAUL/2015/level2')
      .filter(ee.Filter.eq('ADM2_NAME', placeName))
      .first();
    const exportRegion = ee.Feature(boundaryFeature).geometry();
    
    // Load and process the imagery
    let collection = ee.ImageCollection(datasetId)
      .filterDate(startDate, endDate)
      .filterBounds(exportRegion);
    
    // Apply cloud masking for Sentinel-2
    if (datasetId.includes('S2')) {
      collection = collection.map(function(img) {
        const qa = img.select('QA60');
        const cloudBitMask = 1 << 10;
        const cirrusBitMask = 1 << 11;
        const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
          .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
        return img.updateMask(mask)
          .select('B.*')
          .divide(10000);
      });
    }
    
    // Create composite
    let image = collection.median();
    if (bands) {
      image = image.select(bands);
    }
    
    // Clip to boundary
    image = image.clip(exportRegion);
    
    // Scale to 16-bit
    const exportImage = image.multiply(10000).toInt16();
    
    // Create export task
    const task = ee.batch.Export.image.toDrive({
      image: exportImage,
      description: description || `${placeName}_export_${Date.now()}`,
      fileNamePrefix: description || `${placeName}_export`,
      region: exportRegion,
      scale: scale,
      maxPixels: 1e10,
      fileFormat: 'GeoTIFF',
      formatOptions: {
        cloudOptimized: true
      }
    });
    
    // Start the task
    task.start();
    
    return {
      status: 'Export task started',
      placeName: placeName,
      area: `${Math.round(boundary.area)} km²`,
      adminLevel: boundary.adminLevel,
      properties: boundary.properties,
      message: `Exporting ${placeName} with actual administrative boundaries`
    };
    
  } catch (error) {
    console.error('Error in boundary export:', error);
    throw error;
  }
}

module.exports = {
  getAdminBoundary,
  getUSBoundary,
  useCustomShapefile,
  searchBoundaries,
  exportWithBoundary
};
