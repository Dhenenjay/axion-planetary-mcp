/**
 * CROP CLASSIFICATION TOOL
 * Comprehensive tool for building, training, and visualizing crop classification models
 * Supports custom ground truth data and automatic map generation
 */

import ee from '@google/earthengine';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { register } from '../../registry';
import { parseAoi } from '@/src/utils/geo';
import { 
  addComposite, 
  getComposite, 
  globalCompositeStore as compositeStore,
  addMapSession,
  globalMapSessions as activeMaps
} from '@/src/lib/global-store';

// Training point schema
const TrainingPointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  label: z.number(),
  class_name: z.string()
});

// Main tool schema
const CropClassificationSchema = z.object({
  operation: z.enum(['classify', 'train', 'evaluate', 'export']).describe('Operation type: classify (full classification), train (model only), evaluate (accuracy metrics), export (save results)'),
  
  // Region parameters
  region: z.string().describe('US state name (e.g., Iowa, California) or geometry. Supported states: Iowa, California, Texas, Kansas, Nebraska, Illinois'),
  
  // Time parameters
  startDate: z.string().optional().describe('Start date for imagery in YYYY-MM-DD format. Default: 6 months ago'),
  endDate: z.string().optional().describe('End date for imagery in YYYY-MM-DD format. Default: current date'),
  
// Training data
  trainingData: z.union([
    z.array(TrainingPointSchema),
    z.string() // Path to training data file
  ]).optional().describe('Optional custom training points. If not provided, uses default training data for the specified state'),
  
  // Ground truth data path for loading from file
  groundTruthPath: z.string().optional().describe('Path to ground truth JSON/CSV file for training data'),
  
  // Classification parameters
  classifier: z.enum(['randomForest', 'svm', 'cart', 'naiveBayes']).optional().describe('Machine learning classifier. Default: randomForest (best accuracy)'),
  numberOfTrees: z.number().optional().describe('Number of trees for Random Forest classifier (10-500). Default: 50'),
  seed: z.number().optional().describe('Random seed for reproducibility. Default: 42'),
  
  // Feature selection
  features: z.array(z.string()).optional().describe('Specific bands and indices to use. Default: all available bands'),
  includeIndices: z.boolean().optional().describe('Include vegetation indices (NDVI, EVI, SAVI, NDWI). Default: true'),
  
  // Visualization
  createMap: z.boolean().optional().describe('Create interactive web map (slower for large areas). Default: false. Set to false for faster processing'),
  palette: z.array(z.string()).optional().describe('Color palette for classes. Default: automatic based on class count'),
  
  // Class definitions
  classDefinitions: z.record(z.string(), z.string()).optional().describe('Mapping of class numbers to names. Default: uses training data class names'),
  
  // Additional options
  scale: z.number().optional().describe('Pixel resolution in meters (10-1000). Default: 30 for Landsat/Sentinel'),
  cloudCoverMax: z.number().optional().describe('Maximum cloud cover percentage (0-100). Default: 20'),
  spatialFiltering: z.boolean().optional().describe('Apply spatial filtering to reduce noise. Default: false'),
  kernelSize: z.number().optional().describe('Kernel size for spatial filtering (1-9). Default: 3')
});

// Type definitions
type CropClassificationParams = z.infer<typeof CropClassificationSchema>;

/**
 * Get default training data for a state
 */
function getDefaultTrainingData(stateName: string): any[] {
  const trainingDataSets: Record<string, any[]> = {
    'Iowa': [
      // Corn
      { lat: 41.5868, lon: -93.6250, label: 1, class_name: 'corn' },
      { lat: 42.0458, lon: -93.5801, label: 1, class_name: 'corn' },
      { lat: 41.2619, lon: -91.5301, label: 1, class_name: 'corn' },
      { lat: 42.5011, lon: -94.1627, label: 1, class_name: 'corn' },
      { lat: 40.5847, lon: -91.3976, label: 1, class_name: 'corn' },
      // Soybean
      { lat: 41.6912, lon: -93.0519, label: 2, class_name: 'soybean' },
      { lat: 42.7411, lon: -94.6831, label: 2, class_name: 'soybean' },
      { lat: 41.0381, lon: -92.4046, label: 2, class_name: 'soybean' },
      { lat: 43.0835, lon: -94.2376, label: 2, class_name: 'soybean' },
      { lat: 40.8089, lon: -95.0172, label: 2, class_name: 'soybean' },
      // Other crops
      { lat: 41.3306, lon: -94.3831, label: 3, class_name: 'wheat' },
      { lat: 42.3875, lon: -92.1821, label: 3, class_name: 'wheat' },
      { lat: 40.7392, lon: -94.8463, label: 3, class_name: 'wheat' },
      // Urban
      { lat: 41.5868, lon: -93.6250, label: 4, class_name: 'urban' },
      { lat: 41.6611, lon: -91.5302, label: 4, class_name: 'urban' },
      // Water
      { lat: 41.0000, lon: -91.0960, label: 5, class_name: 'water' },
      { lat: 42.0458, lon: -93.3688, label: 5, class_name: 'water' }
    ],
    'California': [
      // Almonds
      { lat: 36.5370, lon: -119.5217, label: 1, class_name: 'almonds' },
      { lat: 37.3200, lon: -120.4800, label: 1, class_name: 'almonds' },
      { lat: 38.2500, lon: -121.3500, label: 1, class_name: 'almonds' },
      // Grapes
      { lat: 38.5049, lon: -122.4694, label: 2, class_name: 'grapes' },
      { lat: 38.2919, lon: -122.4580, label: 2, class_name: 'grapes' },
      { lat: 35.6138, lon: -120.1937, label: 2, class_name: 'grapes' },
      // Citrus
      { lat: 34.0536, lon: -117.8104, label: 3, class_name: 'citrus' },
      { lat: 33.8700, lon: -117.0300, label: 3, class_name: 'citrus' },
      { lat: 36.1400, lon: -119.3700, label: 3, class_name: 'citrus' },
      // Rice
      { lat: 39.3600, lon: -121.5900, label: 4, class_name: 'rice' },
      { lat: 39.5200, lon: -121.8500, label: 4, class_name: 'rice' },
      { lat: 39.1400, lon: -121.6300, label: 4, class_name: 'rice' },
      // Forest
      { lat: 41.2132, lon: -124.0046, label: 5, class_name: 'forest' },
      { lat: 40.8000, lon: -123.8000, label: 5, class_name: 'forest' },
      { lat: 37.8651, lon: -119.5383, label: 5, class_name: 'forest' },
      // Urban
      { lat: 34.0522, lon: -118.2437, label: 6, class_name: 'urban' },
      { lat: 37.7749, lon: -122.4194, label: 6, class_name: 'urban' },
      { lat: 32.7157, lon: -117.1611, label: 6, class_name: 'urban' },
      // Desert
      { lat: 35.1000, lon: -116.0000, label: 7, class_name: 'desert' },
      { lat: 33.0000, lon: -115.5000, label: 7, class_name: 'desert' },
      // Water
      { lat: 39.0000, lon: -122.0000, label: 8, class_name: 'water' },
      { lat: 38.0000, lon: -122.2500, label: 8, class_name: 'water' }
    ],
    'Texas': [
      // Cotton
      { lat: 33.5779, lon: -101.8552, label: 1, class_name: 'cotton' },
      { lat: 32.3513, lon: -102.0779, label: 1, class_name: 'cotton' },
      // Wheat
      { lat: 35.2220, lon: -101.8313, label: 2, class_name: 'wheat' },
      { lat: 34.0522, lon: -100.9810, label: 2, class_name: 'wheat' },
      // Corn
      { lat: 36.0726, lon: -102.0770, label: 3, class_name: 'corn' },
      { lat: 35.8403, lon: -100.5355, label: 3, class_name: 'corn' },
      // Sorghum
      { lat: 31.9686, lon: -102.0779, label: 4, class_name: 'sorghum' },
      { lat: 33.5779, lon: -99.0901, label: 4, class_name: 'sorghum' },
      // Grassland
      { lat: 31.0000, lon: -100.0000, label: 5, class_name: 'grassland' },
      { lat: 32.0000, lon: -99.0000, label: 5, class_name: 'grassland' },
      // Urban
      { lat: 29.7604, lon: -95.3698, label: 6, class_name: 'urban' },
      { lat: 32.7767, lon: -96.7970, label: 6, class_name: 'urban' },
      { lat: 30.2672, lon: -97.7431, label: 6, class_name: 'urban' }
    ],
    'Kansas': [
      // Wheat
      { lat: 38.5000, lon: -98.5000, label: 1, class_name: 'wheat' },
      { lat: 37.6000, lon: -97.3000, label: 1, class_name: 'wheat' },
      { lat: 39.0000, lon: -99.0000, label: 1, class_name: 'wheat' },
      // Corn
      { lat: 39.0469, lon: -95.6775, label: 2, class_name: 'corn' },
      { lat: 38.0000, lon: -96.0000, label: 2, class_name: 'corn' },
      // Sorghum
      { lat: 37.0000, lon: -98.0000, label: 3, class_name: 'sorghum' },
      { lat: 38.0000, lon: -99.0000, label: 3, class_name: 'sorghum' },
      // Soybean
      { lat: 39.5000, lon: -95.0000, label: 4, class_name: 'soybean' },
      { lat: 38.5000, lon: -94.8000, label: 4, class_name: 'soybean' },
      // Grassland
      { lat: 37.5000, lon: -100.0000, label: 5, class_name: 'grassland' },
      { lat: 38.0000, lon: -101.0000, label: 5, class_name: 'grassland' },
      // Urban
      { lat: 37.6872, lon: -97.3301, label: 6, class_name: 'urban' },
      { lat: 39.0473, lon: -95.6752, label: 6, class_name: 'urban' }
    ],
    'Nebraska': [
      // Corn
      { lat: 41.2565, lon: -95.9345, label: 1, class_name: 'corn' },
      { lat: 40.8136, lon: -96.7026, label: 1, class_name: 'corn' },
      { lat: 41.5000, lon: -97.5000, label: 1, class_name: 'corn' },
      // Soybean
      { lat: 40.5000, lon: -96.0000, label: 2, class_name: 'soybean' },
      { lat: 41.0000, lon: -95.5000, label: 2, class_name: 'soybean' },
      // Wheat
      { lat: 41.0000, lon: -100.0000, label: 3, class_name: 'wheat' },
      { lat: 42.0000, lon: -101.0000, label: 3, class_name: 'wheat' },
      // Grassland
      { lat: 41.5000, lon: -101.5000, label: 4, class_name: 'grassland' },
      { lat: 42.0000, lon: -102.0000, label: 4, class_name: 'grassland' },
      // Urban
      { lat: 41.2565, lon: -95.9345, label: 5, class_name: 'urban' },
      { lat: 40.8136, lon: -96.7026, label: 5, class_name: 'urban' }
    ],
    'Illinois': [
      // Corn
      { lat: 41.8781, lon: -87.6298, label: 1, class_name: 'corn' },
      { lat: 40.1106, lon: -88.2073, label: 1, class_name: 'corn' },
      { lat: 39.7817, lon: -89.6501, label: 1, class_name: 'corn' },
      { lat: 41.5000, lon: -89.0000, label: 1, class_name: 'corn' },
      // Soybean
      { lat: 40.5000, lon: -89.5000, label: 2, class_name: 'soybean' },
      { lat: 39.5000, lon: -88.5000, label: 2, class_name: 'soybean' },
      { lat: 41.0000, lon: -88.0000, label: 2, class_name: 'soybean' },
      // Wheat
      { lat: 38.5000, lon: -89.0000, label: 3, class_name: 'wheat' },
      { lat: 37.5000, lon: -88.5000, label: 3, class_name: 'wheat' },
      // Urban
      { lat: 41.8781, lon: -87.6298, label: 4, class_name: 'urban' },
      { lat: 39.7817, lon: -89.6501, label: 4, class_name: 'urban' },
      // Water
      { lat: 42.0000, lon: -87.5000, label: 5, class_name: 'water' }
    ]
  };
  
  return trainingDataSets[stateName] || [];
}

/**
 * Automatically add common sense classes (urban, water, vegetation) to training data
 * This function ALWAYS adds these classes if they're missing to ensure comprehensive classification
 */
function augmentWithCommonSenseClasses(
  trainingPoints: any[], 
  stateName: string
): any[] {
  // Check what classes are already present
  const existingClasses = new Set(trainingPoints.map(p => p.class_name.toLowerCase()));
  const existingLabels = new Set(trainingPoints.map(p => p.label));
  
  // Find the next available label
  let nextLabel = Math.max(...Array.from(existingLabels)) + 1;
  const augmentedPoints = [...trainingPoints];
  
  // Track if we added any common classes
  let addedCommonClasses = false;
  
  // Add urban class if not present
  const hasUrban = existingClasses.has('urban') || existingClasses.has('built-up') || 
                   existingClasses.has('city') || existingClasses.has('developed');
  if (!hasUrban) {
    const urbanPoints = [
      // Major cities based on state - add more points for better coverage
      ...(stateName === 'Iowa' ? [
        { lat: 41.5868, lon: -93.6250 }, // Des Moines
        { lat: 41.6611, lon: -91.5302 }, // Cedar Rapids
        { lat: 42.5003, lon: -96.4003 }, // Sioux City
        { lat: 42.0308, lon: -92.9134 }  // Waterloo
      ] : []),
      ...(stateName === 'California' ? [
        { lat: 34.0522, lon: -118.2437 }, // Los Angeles  
        { lat: 37.7749, lon: -122.4194 }, // San Francisco
        { lat: 32.7157, lon: -117.1611 }, // San Diego
        { lat: 38.5816, lon: -121.4944 }  // Sacramento
      ] : []),
      ...(stateName === 'Texas' ? [
        { lat: 29.7604, lon: -95.3698 }, // Houston
        { lat: 32.7767, lon: -96.7970 }, // Dallas
        { lat: 30.2672, lon: -97.7431 }, // Austin
        { lat: 29.4241, lon: -98.4936 }  // San Antonio
      ] : []),
      ...(stateName === 'Kansas' ? [
        { lat: 37.6872, lon: -97.3301 }, // Wichita
        { lat: 39.0473, lon: -95.6752 }, // Topeka
        { lat: 39.0997, lon: -94.5786 }, // Kansas City
        { lat: 38.9717, lon: -95.2353 }  // Lawrence
      ] : []),
      ...(stateName === 'Nebraska' ? [
        { lat: 41.2565, lon: -95.9345 }, // Omaha
        { lat: 40.8136, lon: -96.7026 }, // Lincoln
        { lat: 40.9264, lon: -98.3420 }, // Grand Island
        { lat: 42.0250, lon: -97.4195 }  // Norfolk
      ] : []),
      ...(stateName === 'Illinois' ? [
        { lat: 41.8781, lon: -87.6298 }, // Chicago
        { lat: 39.7817, lon: -89.6501 }, // Springfield
        { lat: 41.5253, lon: -88.0817 }, // Aurora
        { lat: 40.4842, lon: -88.9937 }  // Bloomington
      ] : [])
    ];
    
    urbanPoints.forEach(p => {
      augmentedPoints.push({
        ...p,
        label: nextLabel,
        class_name: 'urban'
      });
    });
    if (urbanPoints.length > 0) {
      nextLabel++;
      addedCommonClasses = true;
    }
  }
  
  // Add water class if not present
  const hasWater = existingClasses.has('water') || existingClasses.has('lake') || 
                   existingClasses.has('river') || existingClasses.has('wetland');
  if (!hasWater) {
    const waterPoints = [
      ...(stateName === 'Iowa' ? [
        { lat: 41.0585, lon: -91.5955 }, // Mississippi River
        { lat: 42.0458, lon: -93.3688 }, // Clear Lake
        { lat: 42.4039, lon: -94.7014 }, // Storm Lake
        { lat: 41.3911, lon: -91.0432 }  // Coralville Lake
      ] : []),
      ...(stateName === 'California' ? [
        { lat: 39.0968, lon: -120.0324 }, // Lake Tahoe
        { lat: 33.2175, lon: -115.6139 }, // Salton Sea
        { lat: 37.9993, lon: -122.1339 }, // San Francisco Bay
        { lat: 36.9806, lon: -121.8814 }  // Monterey Bay
      ] : []),
      ...(stateName === 'Texas' ? [
        { lat: 30.4064, lon: -98.1145 }, // Lake Travis
        { lat: 29.5964, lon: -95.0565 }, // Galveston Bay
        { lat: 32.7714, lon: -97.8056 }, // Lake Worth
        { lat: 31.0969, lon: -97.7171 }  // Belton Lake
      ] : []),
      ...(stateName === 'Kansas' ? [
        { lat: 38.7022, lon: -99.3236 }, // Cedar Bluff Reservoir
        { lat: 39.0558, lon: -96.5864 }, // Tuttle Creek Lake
        { lat: 37.2739, lon: -97.8684 }, // Cheney Reservoir
        { lat: 38.3714, lon: -95.7308 }  // Pomona Lake
      ] : []),
      ...(stateName === 'Nebraska' ? [
        { lat: 41.2044, lon: -96.0819 }, // Missouri River
        { lat: 41.1756, lon: -100.7715 }, // Lake McConaughy
        { lat: 40.7719, lon: -96.8867 }, // Branched Oak Lake
        { lat: 42.7614, lon: -97.3584 }  // Lewis and Clark Lake
      ] : []),
      ...(stateName === 'Illinois' ? [
        { lat: 41.8919, lon: -87.6051 }, // Lake Michigan
        { lat: 39.0000, lon: -90.6731 }, // Mississippi River
        { lat: 37.2289, lon: -88.7270 }, // Rend Lake
        { lat: 40.6389, lon: -89.3981 }  // Illinois River
      ] : [])
    ];
    
    waterPoints.forEach(p => {
      augmentedPoints.push({
        ...p,
        label: nextLabel,
        class_name: 'water'
      });
    });
    if (waterPoints.length > 0) {
      nextLabel++;
      addedCommonClasses = true;
    }
  }
  
  // Add natural vegetation if not present (forest/grassland)
  const hasVegetation = existingClasses.has('forest') || existingClasses.has('grassland') || 
                        existingClasses.has('pasture') || existingClasses.has('woods') ||
                        existingClasses.has('natural_vegetation');
  if (!hasVegetation) {
    const vegetationPoints = [
      ...(stateName === 'Iowa' ? [
        { lat: 42.4313, lon: -90.7093 }, // Yellow River State Forest
        { lat: 41.9908, lon: -91.6806 }  // Wapsipinicon State Park
      ] : []),
      ...(stateName === 'California' ? [
        { lat: 37.8651, lon: -119.5383 }, // Yosemite
        { lat: 41.2132, lon: -124.0046 }  // Redwood Forest
      ] : []),
      ...(stateName === 'Texas' ? [
        { lat: 30.2500, lon: -103.5000 }, // Big Bend grassland
        { lat: 30.6077, lon: -96.3344 }  // Brazos Valley
      ] : []),
      ...(stateName === 'Kansas' ? [
        { lat: 38.7839, lon: -99.3185 }, // Prairie grassland
        { lat: 37.7528, lon: -100.0217 }  // Cimarron National Grassland
      ] : []),
      ...(stateName === 'Nebraska' ? [
        { lat: 42.8136, lon: -103.0019 }, // Nebraska National Forest
        { lat: 41.9047, lon: -100.5089 }  // Sandhills grassland
      ] : []),
      ...(stateName === 'Illinois' ? [
        { lat: 37.5006, lon: -88.9995 }, // Shawnee National Forest
        { lat: 41.8661, lon: -88.1436 }  // Morton Arboretum
      ] : [])
    ];
    
    vegetationPoints.forEach(p => {
      augmentedPoints.push({
        ...p,
        label: nextLabel,
        class_name: 'natural_vegetation'
      });
    });
    if (vegetationPoints.length > 0) nextLabel++;
  }
  
  return augmentedPoints;
}

/**
 * Get default class definitions and palette for a state
 */
function getDefaultClassInfo(stateName: string): { definitions: Record<string, string>, palette: string[] } {
  const classInfo: Record<string, any> = {
    'Iowa': {
      definitions: {
        '1': 'corn',
        '2': 'soybean',
        '3': 'other_crops',
        '4': 'urban',
        '5': 'water'
      },
      palette: ['FFD700', '228B22', '8B4513', 'DC143C', '4682B4']
    },
    'California': {
      definitions: {
        '1': 'almonds',
        '2': 'grapes',
        '3': 'citrus',
        '4': 'rice',
        '5': 'forest',
        '6': 'urban',
        '7': 'desert',
        '8': 'water'
      },
      palette: ['D4A76A', '800080', 'FFA500', '87CEEB', '228B22', 'DC143C', 'DEB887', '4682B4']
    },
    'Texas': {
      definitions: {
        '1': 'cotton',
        '2': 'wheat',
        '3': 'corn',
        '4': 'sorghum',
        '5': 'grassland',
        '6': 'urban'
      },
      palette: ['F5DEB3', 'D2691E', 'FFD700', 'CD853F', '90EE90', 'DC143C']
    },
    'Kansas': {
      definitions: {
        '1': 'wheat',
        '2': 'corn',
        '3': 'sorghum',
        '4': 'soybean',
        '5': 'grassland',
        '6': 'urban'
      },
      palette: ['D2691E', 'FFD700', 'CD853F', '228B22', '90EE90', 'DC143C']
    },
    'Nebraska': {
      definitions: {
        '1': 'corn',
        '2': 'soybean',
        '3': 'wheat',
        '4': 'grassland',
        '5': 'urban'
      },
      palette: ['FFD700', '228B22', 'D2691E', '90EE90', 'DC143C']
    },
    'Illinois': {
      definitions: {
        '1': 'corn',
        '2': 'soybean',
        '3': 'wheat',
        '4': 'urban',
        '5': 'water'
      },
      palette: ['FFD700', '228B22', 'D2691E', 'DC143C', '4682B4']
    },
    'default': {
      definitions: {
        '1': 'class_1',
        '2': 'class_2',
        '3': 'class_3',
        '4': 'class_4',
        '5': 'class_5'
      },
      palette: ['FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF']
    }
  };
  
  return classInfo[stateName] || classInfo['default'];
}

/**
 * Load ground truth data from file
 */
function loadGroundTruthFromFile(filePath: string): any[] {
  try {
    // Try to load the file if it exists
    const fs = require('fs');
    const path = require('path');
    
    // Resolve the file path
    const resolvedPath = path.resolve(filePath);
    
    if (fs.existsSync(resolvedPath)) {
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Extract training points from the ground truth data
      if (data.training_points && Array.isArray(data.training_points)) {
        return data.training_points.map((point: any) => ({
          lat: point.location.lat,
          lon: point.location.lon,
          label: point.label,
          class_name: point.crop_type
        }));
      }
    }
  } catch (error) {
    console.log('Could not load ground truth file:', error);
  }
  return [];
}

/**
 * Main crop classification function
 */
async function classifyCrops(params: CropClassificationParams & { groundTruthPath?: string }) {
  const {
    region,
    startDate = '2024-06-01',
    endDate = '2024-08-31',
    trainingData,
    groundTruthPath,
    classifier = 'randomForest',
    numberOfTrees = 100,
    seed = Date.now() % 100000,
    features,
    includeIndices = true,
    createMap = true,
    palette,
    classDefinitions,
    scale = 30,
    cloudCoverMax = 20,
    spatialFiltering = true,
    kernelSize = 1
  } = params;
  
  try {
    // Get region geometry
    let geometry;
    let stateName = region;
    
    // Check if region is a known state
    const states = ee.FeatureCollection('TIGER/2018/States');
    const stateFeature = states.filter(ee.Filter.eq('NAME', region));
    const stateInfo = await stateFeature.first().getInfo();
    
    if (stateInfo && stateInfo.geometry) {
      geometry = stateFeature.geometry();
    } else {
      // Try to parse as custom geometry
      geometry = await parseAoi(region);
      stateName = 'default';  // Use 'default' instead of 'custom' to ensure class definitions exist
    }
    
    // Get training data
    let trainingPoints = trainingData;
    
    // Try to load from ground truth file if specified
    if (!trainingPoints && groundTruthPath) {
      // Use the standard Iowa ground truth path if specified
      const groundTruthFile = groundTruthPath === 'iowa' 
        ? 'C:\\Users\\Dhenenjay\\Downloads\\iowa-ground-truth.json'
        : groundTruthPath;
      
      trainingPoints = loadGroundTruthFromFile(groundTruthFile);
      
      if (trainingPoints.length > 0) {
        console.log(`Loaded ${trainingPoints.length} training points from ground truth file`);
      }
    }
    
    // Fall back to default training data if still no points
    if (!trainingPoints || trainingPoints.length === 0) {
      trainingPoints = getDefaultTrainingData(stateName);
      if (trainingPoints.length === 0) {
        throw new Error(`No training data available for ${stateName}. Please provide custom training data or specify groundTruthPath.`);
      }
    }
    
    // ALWAYS augment with common sense classes
    // This ensures urban, water, and natural vegetation are always included
    trainingPoints = augmentWithCommonSenseClasses(trainingPoints, stateName);
    
    // Get class info
    let classInfo = classDefinitions && palette 
      ? { definitions: classDefinitions, palette } 
      : getDefaultClassInfo(stateName);
    
    // Always update class definitions to include augmented classes
    // This ensures urban, water, and vegetation are always in the classification
    if (trainingPoints.length > (trainingData ? trainingData.length : 0)) {
      // Create new class definitions including augmented classes
      const updatedDefinitions: Record<string, string> = {};
      const updatedPalette: string[] = [];
      
      // Get unique labels and class names from augmented training points
      const labelMap = new Map<number, string>();
      trainingPoints.forEach((p: any) => {
        if (!labelMap.has(p.label)) {
          labelMap.set(p.label, p.class_name);
        }
      });
      
      // Sort labels and create definitions
      const sortedLabels = Array.from(labelMap.keys()).sort((a, b) => a - b);
      sortedLabels.forEach((label, index) => {
        updatedDefinitions[label.toString()] = labelMap.get(label) || `class_${label}`;
        
        // Generate palette colors
        const className = labelMap.get(label) || '';
        if (className.includes('corn')) updatedPalette.push('FFD700');
        else if (className.includes('soybean')) updatedPalette.push('228B22');
        else if (className.includes('wheat')) updatedPalette.push('D2691E');
        else if (className.includes('cotton')) updatedPalette.push('F5DEB3');
        else if (className.includes('urban')) updatedPalette.push('DC143C');
        else if (className.includes('water')) updatedPalette.push('4682B4');
        else if (className.includes('vegetation') || className.includes('forest')) updatedPalette.push('006400');
        else if (className.includes('grassland')) updatedPalette.push('90EE90');
        else updatedPalette.push(['FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF'][index % 5]);
      });
      
      classInfo = {
        definitions: updatedDefinitions,
        palette: updatedPalette
      };
    }
    
    // Create Earth Engine feature collection from training points
    const trainingFeaturesCode = trainingPoints.map((p: any) => 
      `ee.Feature(ee.Geometry.Point([${p.lon}, ${p.lat}]), {
        'label': ${p.label},
        'class_name': '${p.class_name}'
      })`
    ).join(',\n    ');
    
    // Get Sentinel-2 composite
    let s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(startDate, endDate)
      .filterBounds(geometry)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCoverMax));
    
    // Cloud masking function
    const maskClouds = (image: any) => {
      const qa = image.select('QA60');
      const mask = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
      return image.updateMask(mask).divide(10000).select('B.*');
    };
    
    // Apply cloud mask and create composite
    const composite = s2Collection.map(maskClouds).median().clip(geometry);
    
    // Calculate indices if requested
    let featureBands = composite;
    const bandNames = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'];
    
    if (includeIndices) {
      // Core vegetation indices
      const ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');
      const ndwi = composite.normalizedDifference(['B3', 'B8']).rename('NDWI');
      const ndbi = composite.normalizedDifference(['B11', 'B8']).rename('NDBI');
      const evi = composite.expression(
        '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
        'NIR': composite.select('B8'),
        'RED': composite.select('B4'),
        'BLUE': composite.select('B2')
      }).rename('EVI');
      const savi = composite.expression(
        '1.5 * (NIR - RED) / (NIR + RED + 0.5)', {
        'NIR': composite.select('B8'),
        'RED': composite.select('B4')
      }).rename('SAVI');
      const bsi = composite.expression(
        '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))', {
        'SWIR1': composite.select('B11'),
        'RED': composite.select('B4'),
        'NIR': composite.select('B8'),
        'BLUE': composite.select('B2')
      }).rename('BSI');
      
      // Add agricultural indices
      const gndvi = composite.normalizedDifference(['B8', 'B3']).rename('GNDVI');
      const ndre = composite.normalizedDifference(['B8', 'B5']).rename('NDRE');
      
      featureBands = composite.select(bandNames)
        .addBands([ndvi, ndwi, ndbi, evi, savi, bsi, gndvi, ndre]);
    }
    
    // Select features to use
    const selectedFeatures = features || featureBands.bandNames();
    featureBands = featureBands.select(selectedFeatures);
    
    // Create training features collection
    // Use Function constructor instead of eval to avoid scope issues
    const createTrainingFC = new Function('ee', `return ee.FeatureCollection([${trainingFeaturesCode}]);`);
    const trainingFC = createTrainingFC(ee);
    
    // Sample training data (adjust scale for large states)
    const sampleScale = stateName === 'California' || stateName === 'Texas' ? scale * 2 : scale;
    const training = featureBands.sampleRegions({
      collection: trainingFC,
      properties: ['label'],
      scale: sampleScale,
      tileScale: 8,
      geometries: false
    });
    
    // Create and train classifier
    let trainedClassifier;
    switch (classifier) {
      case 'randomForest':
        // Use a reasonable default for variablesPerSplit
        const numFeatures = Array.isArray(selectedFeatures) ? selectedFeatures.length : 10;
        trainedClassifier = ee.Classifier.smileRandomForest({
          numberOfTrees: numberOfTrees,
          variablesPerSplit: Math.max(1, Math.floor(Math.sqrt(numFeatures))),
          minLeafPopulation: 2,
          bagFraction: 0.8,
          seed: seed
        }).train(training, 'label', selectedFeatures);
        break;
      
      case 'svm':
        trainedClassifier = ee.Classifier.libsvm({
          kernelType: 'RBF',
          gamma: 0.5,
          cost: 10
        }).train(training, 'label', selectedFeatures);
        break;
      
      case 'cart':
        trainedClassifier = ee.Classifier.smileCart()
          .train(training, 'label', selectedFeatures);
        break;
      
      case 'naiveBayes':
        trainedClassifier = ee.Classifier.smileNaiveBayes()
          .train(training, 'label', selectedFeatures);
        break;
      
      default:
        throw new Error(`Unknown classifier: ${classifier}`);
    }
    
    // Classify the image
    let classified = featureBands.classify(trainedClassifier);
    
    // Apply spatial filtering if requested
    if (spatialFiltering) {
      const kernel = ee.Kernel.square({ radius: kernelSize });
      classified = classified.reduceNeighborhood({
        reducer: ee.Reducer.mode(),
        kernel: kernel
      }).rename('classification');  // Rename back to 'classification'
    }
    
    // Store the classified image
    const classificationKey = `classification_${stateName}_${Date.now()}`;
    compositeStore[classificationKey] = classified;
    
    // Store the classifier
    const classifierKey = `classifier_${stateName}_${Date.now()}`;
    compositeStore[classifierKey] = trainedClassifier;
    
    // Calculate statistics (skip for very large states to avoid memory issues)
    let stats = null;
    const largeStates = ['California', 'Texas', 'Alaska', 'Montana', 'Iowa'];
    
    if (!largeStates.includes(stateName)) {
      try {
        const statsScale = scale * 20;
        const pixelCount = classified.select(['classification']).reduceRegion({
          reducer: ee.Reducer.frequencyHistogram(),
          geometry: geometry,
          scale: statsScale,
          maxPixels: 1e7,
          bestEffort: true
        });
        stats = await pixelCount.getInfo();
      } catch (error) {
        console.log('Statistics calculation skipped due to memory constraints');
        stats = null;
      }
    } else {
      console.log(`Statistics calculation skipped for large state: ${stateName}`);
    }
    
    // Create result object - simplified version for large responses
    let result: any = {
      success: true,
      operation: 'classify',
      classificationKey,
      classifierKey,
      message: 'Crop classification completed successfully',
      region: stateName,
      dateRange: { start: startDate, end: endDate },
      classifier: classifier,
      numberOfClasses: Object.keys(classInfo.definitions).length,
      classDefinitions: classInfo.definitions,
      trainingPoints: trainingPoints.length
    };
    
    // Only include detailed data if not too large
    const includeDetails = !stats || JSON.stringify(stats).length < 1000;
    if (includeDetails) {
      result.features = selectedFeatures;
      result.statistics = stats;
    } else {
      result.note = 'Detailed statistics omitted due to size. Map visualization available below.';
    }
    
    // Create interactive map if requested or if statistics failed  
    // Always create map for better visualization
    if (createMap || !stats) {
      console.log('Creating interactive map for crop classification...');
      
      // IMPORTANT: Visualize the classification before getting tiles
      // This ensures proper color rendering
      const visParams = {
        min: 1,
        max: Object.keys(classInfo.definitions).length,
        palette: classInfo.palette
      };
      
      console.log('Visualization parameters:', visParams);
      
      // Apply visualization to get RGB image
      const visualized = classified.visualize(visParams);
      
      // Get map ID from the visualized image
      console.log('Getting map ID from Earth Engine...');
      const mapId = await new Promise((resolve, reject) => {
        visualized.getMapId({}, (mapIdResult: any, error: any) => {
          if (error) {
            console.error('Error getting map ID:', error);
            reject(error);
          } else {
            console.log('Map ID obtained successfully');
            resolve(mapIdResult);
          }
        });
      });
      
      // Generate tile URL
      const mapIdStr = (mapId as any).mapid || (mapId as any).urlFormat;
      console.log('Map ID string:', mapIdStr);
      
      let tileUrl: string;
      
      if (mapIdStr.includes('http')) {
        // Already a full URL
        tileUrl = mapIdStr;
      } else if (mapIdStr.includes('projects/earthengine-legacy/maps/')) {
        // Already has the path prefix, don't add it again
        tileUrl = `https://earthengine.googleapis.com/v1/${mapIdStr}/tiles/{z}/{x}/{y}`;
      } else {
        // Just the map ID, add the full path
        tileUrl = `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapIdStr}/tiles/{z}/{x}/{y}`;
      }
      
      console.log('Generated tile URL:', tileUrl);
      
      // Create map session
      const mapSessionId = `map_${Date.now()}_${uuidv4().slice(0, 8)}`;
      const mapUrl = `https://axion-planetary-mcp.onrender.com/map/${mapSessionId}`;
      
      // Determine map center
      const bounds = await geometry.bounds().getInfo();
      const coords = bounds.coordinates[0];
      const minLng = Math.min(...coords.map((c: any) => c[0]));
      const maxLng = Math.max(...coords.map((c: any) => c[0]));
      const minLat = Math.min(...coords.map((c: any) => c[1]));
      const maxLat = Math.max(...coords.map((c: any) => c[1]));
      const center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
      
      // No legend data needed
      
      // Store map session
      const mapSession = {
        id: mapSessionId,
        input: classificationKey,
        tileUrl: tileUrl,
        created: new Date(),
        region: stateName,
        layers: [{
          name: 'Crop Classification',
          tileUrl: tileUrl,
          visParams: visParams
        }],
        metadata: {
          center: center,
          zoom: stateName === 'California' ? 6 : 7,
          basemap: 'satellite'
        }
      };
      
      addMapSession(mapSessionId, mapSession);
      console.log(`Map session created: ${mapSessionId}`);
      console.log(`Map URL: ${mapUrl}`);
      
      result.map = {
        url: mapUrl,
        tileUrl: tileUrl,
        center: center,
        visualization: visParams,
        mapId: mapSessionId
      };
      result.mapUrl = mapUrl;  // Add mapUrl at top level for easier access
      result.mapSessionId = mapSessionId;
      
      // If response is too large, return just the essential map info
      const currentSize = JSON.stringify(result).length;
      if (currentSize > 50000) {
        // Return simplified response with map list
        const maps = Object.values(activeMaps).map((session: any) => ({
          id: session.id,
          url: `https://axion-planetary-mcp.onrender.com/map/${session.id}`,
          region: session.region,
          created: session.created.toISOString(),
          layers: session.layers.length
        }));
        
        return {
          success: true,
          operation: 'classify',
          message: 'Crop classification completed. Map created successfully.',
          region: stateName,
          classifier: classifier,
          numberOfClasses: Object.keys(classInfo.definitions).length,
          classDefinitions: classInfo.definitions,
          mapCreated: true,
          mapUrl: `https://axion-planetary-mcp.onrender.com/map/${mapSessionId}`,
          availableMaps: maps,
          instruction: 'Open the mapUrl in your browser to view the interactive crop classification map',
          note: 'Full classification details available but omitted due to size. Use the map URL to visualize results.'
        };
      }
    }
    
    return result;
    
  } catch (error: any) {
    return {
      success: false,
      operation: 'classify',
      error: error.message || 'Classification failed',
      suggestion: 'Check your training data and region parameters'
    };
  }
}

/**
 * Export function for tool registration
 */
export async function execute(params: any) {
  // Validate parameters
  const parsed = CropClassificationSchema.safeParse(params);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid parameters',
      details: parsed.error.errors
    };
  }
  
  const { operation } = parsed.data;
  
  switch (operation) {
    case 'classify':
      return await classifyCrops(parsed.data);
    
    case 'train':
      // Train operation also creates a map to visualize results
      return await classifyCrops({ ...parsed.data, createMap: true });
    
    case 'evaluate':
      // For future: model evaluation
      return {
        success: false,
        error: 'Evaluation operation not yet implemented'
      };
    
    case 'export':
      // For future: export classification results
      return {
        success: false,
        error: 'Export operation not yet implemented'
      };
    
    default:
      return {
        success: false,
        error: `Unknown operation: ${operation}`
      };
  }
}

// Register the tool with MCP
register({
  name: 'crop_classification',
  description: `Machine learning crop and land cover classification using satellite imagery. 
    SUPPORTED REGIONS: Iowa, California, Texas, Kansas, Nebraska, Illinois (or custom coordinates).
    FEATURES: Automatic cloud masking, vegetation indices (NDVI, EVI, SAVI, NDWI), multiple classifiers (Random Forest, SVM, CART, Naive Bayes).
    OUTPUTS: Classification map, accuracy metrics, optional interactive web map.
    PERFORMANCE: For faster processing, set createMap=false. Large regions may timeout with map creation enabled.
    DEFAULT CLASSES by state: Iowa (corn, soybean, wheat, urban, water), California (almonds, grapes, citrus, rice, forest, urban, desert, water), Texas (cotton, wheat, corn, sorghum, grassland, urban).`,
  input: CropClassificationSchema,
  output: z.object({
    success: z.boolean(),
    operation: z.string(),
    classificationKey: z.string().optional(),
    classifierKey: z.string().optional(),
    message: z.string(),
    region: z.string(),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }),
    classifier: z.string(),
    numberOfClasses: z.number(),
    classDefinitions: z.record(z.string(), z.string()),
    features: z.array(z.string()),
    trainingPoints: z.number(),
    statistics: z.any().optional(),
    mapUrl: z.string().optional(),
    tileUrl: z.string().optional(),
    mapSessionId: z.string().optional()
  }),
  handler: execute
});

// Export handler for direct use
export const handler = execute;

// Tool metadata for reference
export const metadata = {
  name: 'crop_classification',
  description: 'Machine learning crop and land cover classification',
  parameters: CropClassificationSchema,
  examples: [
    {
      description: 'Quick classification for Iowa (no map for speed)',
      params: {
        operation: 'classify',
        region: 'Iowa',
        startDate: '2024-05-01',
        endDate: '2024-09-30',
        classifier: 'randomForest',
        numberOfTrees: 50,
        includeIndices: true,
        createMap: false  // Fast mode
      }
    },
    {
      description: 'California classification with map',
      params: {
        operation: 'classify',
        region: 'California',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        classifier: 'svm',
        includeIndices: true,
        scale: 30,
        createMap: true  // Will be slower
      }
    },
    {
      description: 'Custom training data example',
      params: {
        operation: 'classify',
        region: 'Texas',
        startDate: '2024-06-01',
        endDate: '2024-10-31',
        trainingData: [
          { lat: 33.5779, lon: -101.8552, label: 1, class_name: 'cotton' },
          { lat: 35.2220, lon: -101.8313, label: 2, class_name: 'wheat' },
          { lat: 36.0726, lon: -102.0770, label: 3, class_name: 'corn' },
          { lat: 31.9686, lon: -102.0779, label: 4, class_name: 'sorghum' },
          { lat: 31.0000, lon: -100.0000, label: 5, class_name: 'grassland' }
        ],
        classifier: 'randomForest',
        numberOfTrees: 100,
        includeIndices: true,
        spatialFiltering: true,
        kernelSize: 3,
        createMap: false  // Recommended for large regions
      }
    },
    {
      description: 'Train model only (no classification)',
      params: {
        operation: 'train',
        region: 'Kansas',
        startDate: '2024-05-01',
        endDate: '2024-09-30',
        classifier: 'cart',
        includeIndices: true
      }
    }
  ]
};

export default {};
