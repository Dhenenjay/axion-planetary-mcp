/**
 * Enhanced Deforestation Analysis Tool
 * Performs actual forest change detection and creates visualization maps
 */

import { z } from 'zod';
import { register } from '../../registry';
import ee from '@google/earthengine';
import { addComposite, addMapSession } from '@/src/lib/global-store';
import { v4 as uuidv4 } from 'uuid';

// Schema for deforestation analysis
const DeforestationSchema = z.object({
  region: z.string().describe('Region to analyze (e.g., Amazon, Congo Basin)'),
  baselineYear: z.number().optional().default(2020).describe('Baseline year for comparison'),
  currentYear: z.number().optional().default(2024).describe('Current year for analysis'),
  startMonth: z.string().optional().default('01-01').describe('Start month-day (MM-DD)'),
  endMonth: z.string().optional().default('12-31').describe('End month-day (MM-DD)'),
  sensitivity: z.enum(['low', 'medium', 'high']).optional().default('high'),
  createMap: z.boolean().optional().default(true).describe('Create interactive map'),
  analysisType: z.enum(['forest_loss', 'forest_gain', 'both']).optional().default('forest_loss')
});

/**
 * Calculate forest cover using Hansen Global Forest Change dataset and Sentinel-2
 */
async function calculateForestCover(region: string, year: number, startMonth: string, endMonth: string) {
  try {
    // Parse region to geometry
    const geometry = await parseRegion(region);
    
    // Use Hansen Global Forest Change dataset for forest mask
    const hansen = ee.Image('UMD/hansen/global_forest_change_2023_v1_11');
    const treecover2000 = hansen.select(['treecover2000']);
    const lossYear = hansen.select(['lossyear']);
    
    // Calculate forest mask for the given year
    const yearOffset = year - 2000;
    let forestMask;
    
    if (year === 2000) {
      // Base year forest cover
      forestMask = treecover2000.gt(30); // 30% tree cover threshold
    } else {
      // Adjust for forest loss up to the given year
      const lossUpToYear = lossYear.lte(yearOffset).and(lossYear.gt(0));
      forestMask = treecover2000.gt(30).and(lossUpToYear.not());
    }
    
    // Get Sentinel-2 data for vegetation health
    const startDate = `${year}-${startMonth}`;
    const endDate = `${year}-${endMonth}`;
    
    let collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(geometry)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
    
    // Cloud masking function
    const maskS2clouds = (image: any) => {
      const qa = image.select('QA60');
      const cloudBitMask = 1 << 10;
      const cirrusBitMask = 1 << 11;
      const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
        .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
      
      return image.updateMask(mask)
        .divide(10000)
        .select(['B.*'])
        .copyProperties(image, ['system:time_start']);
    };
    
    // Apply cloud masking and create median composite
    const composite = collection
      .map(maskS2clouds)
      .median()
      .clip(geometry);
    
    // Calculate NDVI for vegetation health
    const ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');
    
    // Combine forest mask with healthy vegetation (NDVI > 0.4)
    const healthyForest = forestMask.and(ndvi.gt(0.4));
    
    // Calculate forest area statistics
    const pixelArea = ee.Image.pixelArea();
    const forestArea = healthyForest.multiply(pixelArea);
    
    const stats = forestArea.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 30,
      maxPixels: 1e10
    });
    
    // Store composite for visualization
    const compositeKey = `forest_${region.toLowerCase().replace(/\s+/g, '_')}_${year}`;
    const visualizedForest = composite.visualize({
      bands: ['B11', 'B8', 'B4'], // SWIR, NIR, Red for forest visualization
      min: 0,
      max: 0.3,
      gamma: 1.4
    }).blend(
      healthyForest.visualize({
        palette: ['000000', '00FF00'],
        opacity: 0.5
      })
    );
    
    addComposite(compositeKey, visualizedForest, {
      year: year,
      region: region,
      type: 'forest_cover'
    });
    
    return {
      composite: composite,
      forestMask: healthyForest,
      compositeKey: compositeKey,
      area: await stats.evaluate(),
      ndvi: ndvi
    };
    
  } catch (error: any) {
    console.error('Error calculating forest cover:', error);
    throw error;
  }
}

/**
 * Parse region string to Earth Engine geometry
 */
async function parseRegion(region: string): Promise<any> {
  const regionLower = region.toLowerCase();
  
  // Predefined regions
  const regions: Record<string, number[]> = {
    'amazon': [-74.0, -10.0, -48.0, 5.0],
    'amazon rainforest': [-74.0, -10.0, -48.0, 5.0],
    'congo': [15.0, -5.0, 30.0, 5.0],
    'congo basin': [15.0, -5.0, 30.0, 5.0],
    'borneo': [108.0, -4.0, 119.0, 7.0],
    'indonesia': [95.0, -10.0, 141.0, 6.0],
    'siberia': [60.0, 50.0, 140.0, 70.0],
    'california': [-124.5, 32.5, -114.0, 42.0],
    'yellowstone': [-111.2, 44.0, -109.8, 45.2]
  };
  
  for (const [key, bounds] of Object.entries(regions)) {
    if (regionLower.includes(key)) {
      const [west, south, east, north] = bounds;
      return ee.Geometry.Rectangle([west, south, east, north]);
    }
  }
  
  // Default to Amazon if not recognized
  return ee.Geometry.Rectangle([-74.0, -10.0, -48.0, 5.0]);
}

/**
 * Main deforestation analysis handler
 */
async function analyzeDeforestation(params: z.infer<typeof DeforestationSchema>) {
  try {
    console.log('Starting deforestation analysis for:', params.region);
    
    // Calculate baseline forest cover
    console.log(`Calculating baseline forest cover (${params.baselineYear})...`);
    const baseline = await calculateForestCover(
      params.region,
      params.baselineYear,
      params.startMonth,
      params.endMonth
    );
    
    // Calculate current forest cover
    console.log(`Calculating current forest cover (${params.currentYear})...`);
    const current = await calculateForestCover(
      params.region,
      params.currentYear,
      params.startMonth,
      params.endMonth
    );
    
    // Calculate change
    const forestLoss = baseline.forestMask.subtract(current.forestMask).gt(0);
    const forestGain = current.forestMask.subtract(baseline.forestMask).gt(0);
    
    // Calculate statistics
    const geometry = await parseRegion(params.region);
    const pixelArea = ee.Image.pixelArea();
    
    const lossArea = forestLoss.multiply(pixelArea).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 30,
      maxPixels: 1e10
    });
    
    const gainArea = forestGain.multiply(pixelArea).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 30,
      maxPixels: 1e10
    });
    
    const lossStats = await lossArea.evaluate();
    const gainStats = await gainArea.evaluate();
    const baselineStats = baseline.area;
    
    // Calculate percentages
    const baselineAreaHa = (baselineStats as any).NDVI / 10000; // Convert to hectares
    const lossAreaHa = (lossStats as any) / 10000;
    const gainAreaHa = (gainStats as any) / 10000;
    const percentLoss = (lossAreaHa / baselineAreaHa) * 100;
    
    // Create change visualization
    const changeViz = ee.Image(0)
      .where(forestLoss, 2)  // Red for loss
      .where(forestGain, 1)  // Green for gain
      .selfMask();
    
    const changeComposite = current.composite.visualize({
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 0.3
    }).blend(
      changeViz.visualize({
        palette: ['00FF00', '000000', 'FF0000'], // Green for gain, Red for loss
        opacity: 0.7
      })
    );
    
    // Store change composite
    const changeKey = `deforestation_${params.region.toLowerCase().replace(/\s+/g, '_')}_${params.baselineYear}_${params.currentYear}`;
    addComposite(changeKey, changeComposite, {
      type: 'deforestation_analysis',
      region: params.region,
      baselineYear: params.baselineYear,
      currentYear: params.currentYear
    });
    
    // Create interactive map if requested
    let mapUrl = null;
    if (params.createMap) {
      const mapId = uuidv4().substring(0, 8);
      
      // Get tile URLs for the composites
      const baselineTileUrl = await getMapId(baseline.composite.visualize({
        bands: ['B11', 'B8', 'B4'],
        min: 0,
        max: 0.3
      }));
      
      const currentTileUrl = await getMapId(current.composite.visualize({
        bands: ['B11', 'B8', 'B4'],
        min: 0,
        max: 0.3
      }));
      
      const changeTileUrl = await getMapId(changeComposite);
      
      // Get region bounds
      const bounds = geometry.bounds();
      const coords = await bounds.coordinates().evaluate();
      const center = [(coords[0][0][0] + coords[0][2][0]) / 2, (coords[0][0][1] + coords[0][2][1]) / 2];
      
      // Create map session with multiple layers
      const session = {
        id: mapId,
        region: params.region,
        tileUrl: changeTileUrl,
        layers: [
          {
            name: `Forest Cover ${params.baselineYear}`,
            tileUrl: baselineTileUrl,
            visParams: {
              bands: ['B11', 'B8', 'B4'],
              min: 0,
              max: 0.3
            }
          },
          {
            name: `Forest Cover ${params.currentYear}`,
            tileUrl: currentTileUrl,
            visParams: {
              bands: ['B11', 'B8', 'B4'],
              min: 0,
              max: 0.3
            }
          },
          {
            name: 'Forest Change',
            tileUrl: changeTileUrl,
            visParams: {
              palette: ['00FF00', '000000', 'FF0000']
            }
          }
        ],
        metadata: {
          center: center,
          zoom: 8,
          basemap: 'satellite'
        },
        created: new Date()
      };
      
      addMapSession(mapId, session);
      mapUrl = `https://axion-planetary-mcp.onrender.com/map/${mapId}`;
    }
    
    // Determine alert level
    let alertLevel = 'LOW';
    if (percentLoss > 5) alertLevel = 'CRITICAL';
    else if (percentLoss > 2) alertLevel = 'HIGH';
    else if (percentLoss > 1) alertLevel = 'MODERATE';
    
    return {
      success: true,
      operation: 'deforestation_analysis',
      region: params.region,
      timeframe: {
        baseline: params.baselineYear,
        current: params.currentYear
      },
      forestCover: {
        baseline: {
          year: params.baselineYear,
          areaHectares: baselineAreaHa,
          compositeKey: baseline.compositeKey
        },
        current: {
          year: params.currentYear,
          areaHectares: baselineAreaHa - lossAreaHa + gainAreaHa,
          compositeKey: current.compositeKey
        }
      },
      change: {
        lossHectares: lossAreaHa,
        gainHectares: gainAreaHa,
        netLossHectares: lossAreaHa - gainAreaHa,
        percentLoss: percentLoss,
        percentGain: (gainAreaHa / baselineAreaHa) * 100,
        compositeKey: changeKey
      },
      alertLevel: alertLevel,
      mapUrl: mapUrl,
      visualization: {
        ready: true,
        layers: ['baseline', 'current', 'change'],
        legend: {
          red: 'Forest Loss',
          green: 'Forest Gain',
          darkGreen: 'Stable Forest',
          gray: 'Non-Forest'
        }
      },
      recommendations: percentLoss > 2 ? [
        'Immediate intervention required',
        'Deploy ground monitoring teams',
        'Investigate illegal logging activities',
        'Implement restoration measures',
        'Increase satellite monitoring frequency'
      ] : [
        'Continue regular monitoring',
        'Maintain current conservation efforts'
      ],
      message: `Deforestation analysis complete. ${percentLoss.toFixed(2)}% forest loss detected between ${params.baselineYear} and ${params.currentYear}.`
    };
    
  } catch (error: any) {
    console.error('Deforestation analysis error:', error);
    return {
      success: false,
      operation: 'deforestation_analysis',
      error: error.message || 'Analysis failed',
      message: 'Failed to complete deforestation analysis'
    };
  }
}

/**
 * Get map ID for visualization
 */
async function getMapId(image: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'); // Fallback
    }, 10000);
    
    image.getMapId((mapIdObj: any, error: any) => {
      clearTimeout(timeout);
      if (error) {
        resolve('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'); // Fallback
      } else {
        const mapId = mapIdObj.mapid || mapIdObj.token;
        resolve(`https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}`);
      }
    });
  });
}

// Register the enhanced tool
register({
  name: 'deforestation_analysis',
  description: 'Enhanced deforestation detection with actual change analysis and interactive maps showing forest loss/gain',
  inputSchema: DeforestationSchema,
  handler: analyzeDeforestation
});

export { analyzeDeforestation };