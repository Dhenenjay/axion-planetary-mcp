#!/usr/bin/env node

/**
 * Ground Truth Data Generator for All Geospatial Models
 * Creates realistic ground truth data that users would typically provide
 */

const fs = require('fs');
const path = require('path');

// Create ground truth directory
const GT_DIR = path.join(__dirname, 'ground_truth_data');
if (!fs.existsSync(GT_DIR)) {
  fs.mkdirSync(GT_DIR);
}

// ========== 1. AGRICULTURE GROUND TRUTH ==========
function generateAgricultureGroundTruth() {
  // Typical user data: GPS locations with crop types, yields, planting dates, soil samples
  const cropYieldData = `latitude,longitude,field_id,crop_type,planting_date,harvest_date,actual_yield_tons_per_hectare,soil_nitrogen_ppm,soil_phosphorus_ppm,soil_moisture_percent,pest_detected,pest_type,disease_detected,disease_type
34.0522,-118.2437,CA_001,wheat,2024-02-15,2024-07-20,4.8,45,22,28,true,aphids,false,none
34.0622,-118.2537,CA_002,wheat,2024-02-18,2024-07-22,5.2,48,25,31,false,none,true,rust
34.0722,-118.2637,CA_003,corn,2024-03-01,2024-08-15,9.5,52,28,35,true,corn_borer,false,none
34.0822,-118.2737,CA_004,soybeans,2024-03-10,2024-09-05,3.2,38,20,25,false,none,false,none
34.0922,-118.2837,CA_005,wheat,2024-02-20,2024-07-25,4.5,42,23,29,true,aphids,true,powdery_mildew
33.9522,-118.2437,CA_006,corn,2024-03-05,2024-08-20,10.2,55,30,38,false,none,false,none
33.9622,-118.2537,CA_007,soybeans,2024-03-12,2024-09-08,3.5,40,21,27,true,beetles,false,none
33.9722,-118.2637,CA_008,wheat,2024-02-22,2024-07-28,5.0,46,24,30,false,none,true,septoria
33.9822,-118.2737,CA_009,corn,2024-03-08,2024-08-25,8.8,50,27,34,true,rootworm,true,gray_leaf_spot
33.9922,-118.2837,CA_010,wheat,2024-02-25,2024-07-30,4.3,41,22,26,false,none,false,none`;

  fs.writeFileSync(path.join(GT_DIR, 'agriculture_yield_ground_truth.csv'), cropYieldData);

  // Irrigation and fertilizer application records
  const irrigationData = {
    "fields": {
      "CA_001": {
        "irrigation_events": [
          { "date": "2024-03-15", "amount_mm": 25, "method": "drip" },
          { "date": "2024-04-20", "amount_mm": 30, "method": "drip" },
          { "date": "2024-05-25", "amount_mm": 35, "method": "sprinkler" }
        ],
        "fertilizer_applications": [
          { "date": "2024-03-01", "type": "nitrogen", "amount_kg_per_hectare": 120 },
          { "date": "2024-04-15", "type": "phosphorus", "amount_kg_per_hectare": 60 }
        ],
        "weather_station_data": {
          "avg_temperature_c": 22.5,
          "total_rainfall_mm": 250,
          "solar_radiation_mj_m2": 18.5
        }
      }
    }
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'agriculture_management_ground_truth.json'),
    JSON.stringify(irrigationData, null, 2)
  );

  console.log('✅ Agriculture ground truth data generated');
}

// ========== 2. FOREST CARBON GROUND TRUTH ==========
function generateForestGroundTruth() {
  // Typical user data: Plot locations with tree measurements, species, DBH, height
  const forestInventoryData = `plot_id,latitude,longitude,tree_id,species,dbh_cm,height_m,crown_diameter_m,health_status,age_years,biomass_kg
PLOT_001,47.6062,-122.3321,T001,Douglas Fir,45.2,28.5,8.2,healthy,65,1250
PLOT_001,47.6062,-122.3321,T002,Western Hemlock,38.5,25.3,7.1,healthy,55,850
PLOT_001,47.6062,-122.3321,T003,Red Cedar,52.1,31.2,9.5,healthy,85,1680
PLOT_001,47.6062,-122.3321,T004,Douglas Fir,41.3,27.1,7.8,damaged,60,980
PLOT_002,47.6162,-122.3421,T005,Sitka Spruce,48.6,29.8,8.8,healthy,70,1420
PLOT_002,47.6162,-122.3421,T006,Western Hemlock,35.2,23.5,6.5,healthy,50,720
PLOT_002,47.6162,-122.3421,T007,Douglas Fir,55.8,32.5,10.2,healthy,90,2100
PLOT_003,47.6262,-122.3521,T008,Red Alder,28.5,18.2,5.8,healthy,35,450
PLOT_003,47.6262,-122.3521,T009,Big Leaf Maple,32.1,20.5,6.2,diseased,40,580
PLOT_003,47.6262,-122.3521,T010,Douglas Fir,62.3,35.1,11.5,healthy,110,2850`;

  fs.writeFileSync(path.join(GT_DIR, 'forest_inventory_ground_truth.csv'), forestInventoryData);

  // Carbon flux and species diversity data
  const carbonFluxData = {
    "study_sites": {
      "pacific_northwest_forest": {
        "location": { "lat": 47.6062, "lon": -122.3321 },
        "ecosystem_type": "temperate_coniferous",
        "carbon_stock_tons_per_hectare": 285,
        "annual_sequestration_rate": 4.2,
        "soil_carbon_tons_per_hectare": 95,
        "species_diversity": {
          "total_species": 24,
          "dominant_species": ["Douglas Fir", "Western Hemlock", "Red Cedar"],
          "shannon_index": 2.8,
          "simpson_index": 0.85,
          "rare_species": ["Pacific Yew", "Vine Maple"]
        },
        "disturbance_history": [
          { "year": 2018, "type": "selective_logging", "area_hectares": 5.2 },
          { "year": 2020, "type": "windthrow", "area_hectares": 2.1 }
        ]
      }
    }
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'forest_carbon_ground_truth.json'),
    JSON.stringify(carbonFluxData, null, 2)
  );

  console.log('✅ Forest carbon ground truth data generated');
}

// ========== 3. WATER QUALITY GROUND TRUTH ==========
function generateWaterQualityGroundTruth() {
  // Typical user data: Water sampling locations with lab results
  const waterSamplesData = `sample_id,latitude,longitude,collection_date,collection_time,water_body,depth_m,temperature_c,ph,dissolved_oxygen_mg_l,turbidity_ntu,chlorophyll_a_ug_l,total_nitrogen_mg_l,total_phosphorus_mg_l,e_coli_cfu_100ml,conductivity_us_cm
WQ001,37.8099,-122.4103,2024-06-01,09:30,San Francisco Bay,0.5,18.2,7.8,7.5,12.3,8.5,1.2,0.08,120,45000
WQ002,37.8199,-122.4203,2024-06-01,10:15,San Francisco Bay,1.0,17.8,7.9,7.8,11.8,7.2,1.1,0.07,95,44500
WQ003,37.8299,-122.4303,2024-06-01,11:00,San Francisco Bay,0.5,18.5,8.0,8.2,10.5,6.8,0.9,0.06,85,44000
WQ004,37.8399,-122.4403,2024-06-15,09:45,San Francisco Bay,2.0,17.2,7.7,6.9,14.2,11.3,1.5,0.12,150,46000
WQ005,37.8499,-122.4503,2024-06-15,10:30,San Francisco Bay,0.5,19.1,8.1,8.5,9.8,5.5,0.8,0.05,70,43500
WQ006,37.7099,-122.4103,2024-07-01,09:00,San Francisco Bay,1.5,20.3,7.9,7.2,13.5,12.8,1.8,0.15,180,47000
WQ007,37.7199,-122.4203,2024-07-01,10:00,San Francisco Bay,0.5,20.8,8.0,7.8,11.2,10.2,1.3,0.10,140,45500
WQ008,37.7299,-122.4303,2024-07-15,09:30,San Francisco Bay,1.0,21.5,8.2,8.0,10.8,9.5,1.2,0.09,110,44800`;

  fs.writeFileSync(path.join(GT_DIR, 'water_quality_samples_ground_truth.csv'), waterSamplesData);

  // Calibration data for sensors
  const sensorCalibrationData = {
    "sensors": {
      "SENSOR_SF_001": {
        "location": { "lat": 37.8099, "lon": -122.4103 },
        "calibration_date": "2024-05-15",
        "calibration_coefficients": {
          "turbidity": { "slope": 1.02, "intercept": 0.5 },
          "chlorophyll": { "slope": 0.98, "intercept": 0.3 },
          "temperature": { "slope": 1.0, "intercept": 0.1 }
        },
        "validation_r_squared": {
          "turbidity": 0.95,
          "chlorophyll": 0.92,
          "temperature": 0.99
        }
      }
    },
    "algae_bloom_events": [
      {
        "date": "2024-07-20",
        "location": { "lat": 37.7299, "lon": -122.4303 },
        "species": "Microcystis aeruginosa",
        "cell_count_per_ml": 50000,
        "toxin_level_ug_l": 2.5
      }
    ]
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'water_quality_calibration_ground_truth.json'),
    JSON.stringify(sensorCalibrationData, null, 2)
  );

  console.log('✅ Water quality ground truth data generated');
}

// ========== 4. FLOOD GROUND TRUTH ==========
function generateFloodGroundTruth() {
  // Typical user data: Historical flood extents, water levels, damage assessments
  const floodEventsData = `event_id,event_date,latitude,longitude,flood_depth_m,flood_duration_hours,affected_area_km2,property_damage_usd,evacuation_count,rainfall_mm_24h,river_discharge_m3_s
FLOOD_2017_01,2017-08-27,29.7604,-95.3698,2.1,72,125.5,8500000,15000,380,2850
FLOOD_2017_02,2017-08-28,29.7704,-95.3798,2.5,96,98.2,6200000,12000,350,3100
FLOOD_2017_03,2017-08-29,29.7804,-95.3898,1.8,48,75.3,4800000,8500,320,2600
FLOOD_2020_01,2020-05-15,29.7904,-95.3998,1.2,36,45.2,2100000,3200,220,1850
FLOOD_2020_02,2020-05-16,29.8004,-95.4098,1.5,42,52.8,2800000,4100,245,2100
FLOOD_2023_01,2023-04-20,29.8104,-95.4198,0.8,24,28.5,950000,1500,180,1200
FLOOD_2023_02,2023-04-21,29.8204,-95.4298,1.0,30,35.2,1250000,2000,195,1450
FLOOD_2024_01,2024-06-10,29.8304,-95.4398,0.6,18,20.1,620000,800,150,950`;

  fs.writeFileSync(path.join(GT_DIR, 'flood_events_ground_truth.csv'), floodEventsData);

  // Flood risk zones and infrastructure
  const floodRiskData = {
    "flood_zones": {
      "houston_metropolitan": {
        "high_risk_areas": [
          {
            "zone_id": "HR_001",
            "coordinates": [[29.7604, -95.3698], [29.7704, -95.3798], [29.7804, -95.3898]],
            "return_period_years": 10,
            "expected_depth_m": 1.5,
            "population_at_risk": 25000,
            "critical_infrastructure": ["Memorial Hospital", "Water Treatment Plant"]
          }
        ],
        "elevation_data": {
          "min_elevation_m": 15,
          "max_elevation_m": 45,
          "mean_elevation_m": 28
        },
        "drainage_capacity_m3_s": 500,
        "levee_heights_m": [3.5, 4.0, 3.8],
        "pump_stations": [
          { "id": "PS_001", "capacity_m3_s": 50, "location": [29.7704, -95.3798] }
        ]
      }
    }
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'flood_risk_ground_truth.json'),
    JSON.stringify(floodRiskData, null, 2)
  );

  console.log('✅ Flood ground truth data generated');
}

// ========== 5. URBAN GROUND TRUTH ==========
function generateUrbanGroundTruth() {
  // Typical user data: Building footprints, land use classifications, temperature measurements
  const urbanLandUseData = `parcel_id,latitude,longitude,land_use_class,building_height_m,building_footprint_m2,impervious_surface_percent,green_space_m2,tree_canopy_percent,population_density_per_km2,surface_temperature_c,air_temperature_c
PHX_001,33.4484,-112.0740,residential,8.5,250,75,100,15,3500,42.5,38.2
PHX_002,33.4584,-112.0840,commercial,15.2,1200,95,50,5,500,45.8,39.5
PHX_003,33.4684,-112.0940,industrial,12.8,2500,98,20,2,100,48.2,40.1
PHX_004,33.4784,-112.1040,park,3.0,100,10,5000,65,50,35.2,36.5
PHX_005,33.4884,-112.1140,residential,7.2,200,70,150,20,4200,41.8,37.8
PHX_006,33.4984,-112.1240,commercial,18.5,1800,96,30,3,300,46.5,39.8
PHX_007,33.5084,-112.1340,mixed_use,11.0,800,85,200,12,2800,43.2,38.5
PHX_008,33.5184,-112.1440,residential,6.8,180,65,200,25,3800,40.5,37.2
PHX_009,33.5284,-112.1540,institutional,14.0,3000,88,500,18,1500,44.0,38.8
PHX_010,33.5384,-112.1640,vacant,0,0,5,1000,8,0,47.5,39.2`;

  fs.writeFileSync(path.join(GT_DIR, 'urban_land_use_ground_truth.csv'), urbanLandUseData);

  // Building inventory and energy consumption
  const buildingData = {
    "buildings": {
      "PHX_COMM_001": {
        "type": "office",
        "year_built": 2010,
        "floors": 5,
        "total_area_m2": 5000,
        "occupancy": 250,
        "energy_consumption_kwh_year": 750000,
        "water_consumption_m3_year": 2500,
        "hvac_type": "central_ac",
        "solar_panels": true,
        "green_roof": false,
        "leed_certified": "gold"
      }
    },
    "urban_heat_measurements": [
      {
        "date": "2024-07-15",
        "time": "14:00",
        "location": [33.4484, -112.0740],
        "surface_temp_c": 52.3,
        "air_temp_c": 42.1,
        "relative_humidity": 18,
        "wind_speed_m_s": 2.5
      }
    ]
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'urban_buildings_ground_truth.json'),
    JSON.stringify(buildingData, null, 2)
  );

  console.log('✅ Urban ground truth data generated');
}

// ========== 6. CLIMATE GROUND TRUTH ==========
function generateClimateGroundTruth() {
  // Typical user data: Weather station records, climate observations
  const climateStationData = `station_id,latitude,longitude,date,max_temp_c,min_temp_c,mean_temp_c,precipitation_mm,humidity_percent,wind_speed_km_h,pressure_hpa,solar_radiation_mj_m2,evapotranspiration_mm
CHI_001,41.8781,-87.6298,2024-01-01,2.1,-5.2,-1.5,12.5,75,22,1015,3.2,0.8
CHI_001,41.8781,-87.6298,2024-01-15,-3.5,-10.8,-7.1,8.2,82,28,1020,2.8,0.5
CHI_001,41.8781,-87.6298,2024-02-01,5.2,-2.1,1.5,15.8,70,18,1012,5.5,1.2
CHI_001,41.8781,-87.6298,2024-02-15,8.5,0.5,4.5,22.3,68,20,1010,7.2,1.8
CHI_001,41.8781,-87.6298,2024-03-01,12.1,3.2,7.6,35.2,65,25,1008,10.5,2.5
CHI_001,41.8781,-87.6298,2024-03-15,15.8,6.5,11.1,42.8,62,22,1005,13.2,3.2
CHI_001,41.8781,-87.6298,2024-04-01,18.5,9.2,13.8,55.3,60,20,1003,16.8,4.1
CHI_001,41.8781,-87.6298,2024-04-15,22.1,12.5,17.3,48.2,58,18,1002,19.5,4.8
CHI_001,41.8781,-87.6298,2024-05-01,25.8,15.2,20.5,62.5,55,16,1000,22.3,5.5
CHI_001,41.8781,-87.6298,2024-05-15,28.5,18.1,23.3,58.8,52,15,998,24.8,6.2`;

  fs.writeFileSync(path.join(GT_DIR, 'climate_station_ground_truth.csv'), climateStationData);

  // Climate anomalies and extremes
  const climateAnomaliesData = {
    "climate_records": {
      "chicago_metro": {
        "normal_values_1991_2020": {
          "annual_temp_c": 10.5,
          "annual_precip_mm": 950,
          "frost_days": 120,
          "heat_wave_days": 15
        },
        "extreme_events": [
          {
            "date": "2024-01-15",
            "type": "cold_wave",
            "min_temp_c": -25.5,
            "duration_days": 5,
            "anomaly_c": -15.2
          },
          {
            "date": "2024-07-20",
            "type": "heat_wave",
            "max_temp_c": 41.2,
            "duration_days": 7,
            "anomaly_c": 8.5
          }
        ],
        "trends_per_decade": {
          "temperature_c": 0.3,
          "precipitation_percent": 2.5,
          "extreme_events": 1.2
        }
      }
    }
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'climate_anomalies_ground_truth.json'),
    JSON.stringify(climateAnomaliesData, null, 2)
  );

  console.log('✅ Climate ground truth data generated');
}

// ========== 7. ML CLASSIFICATION GROUND TRUTH ==========
function generateMLClassificationGroundTruth() {
  // Typical user data: Training samples with class labels
  const trainingPointsData = `sample_id,latitude,longitude,class_label,confidence,collection_date,verified_by,notes
ML_001,25.7617,-80.1918,urban,0.95,2024-06-01,field_survey,High density residential
ML_002,25.7717,-80.2018,water,1.00,2024-06-01,field_survey,Biscayne Bay
ML_003,25.7817,-80.2118,vegetation,0.92,2024-06-01,field_survey,Mangrove forest
ML_004,25.7917,-80.2218,bare_soil,0.88,2024-06-01,aerial_photo,Construction site
ML_005,25.8017,-80.2318,urban,0.96,2024-06-02,field_survey,Commercial district
ML_006,25.8117,-80.2418,vegetation,0.90,2024-06-02,field_survey,Urban park
ML_007,25.8217,-80.2518,water,0.98,2024-06-02,satellite,Canal
ML_008,25.8317,-80.2618,wetland,0.85,2024-06-03,field_survey,Freshwater marsh
ML_009,25.8417,-80.2718,agriculture,0.91,2024-06-03,field_survey,Nursery
ML_010,25.8517,-80.2818,urban,0.93,2024-06-03,aerial_photo,Industrial area`;

  fs.writeFileSync(path.join(GT_DIR, 'ml_training_points_ground_truth.csv'), trainingPointsData);

  // Polygon training areas
  const trainingPolygonsData = {
    "training_polygons": {
      "urban_areas": [
        {
          "polygon_id": "URB_001",
          "coordinates": [[25.7617, -80.1918], [25.7717, -80.1918], [25.7717, -80.2018], [25.7617, -80.2018]],
          "area_hectares": 45.2,
          "sub_class": "residential_high_density",
          "samples_collected": 150
        }
      ],
      "vegetation_areas": [
        {
          "polygon_id": "VEG_001",
          "coordinates": [[25.7817, -80.2118], [25.7917, -80.2118], [25.7917, -80.2218], [25.7817, -80.2218]],
          "area_hectares": 82.5,
          "sub_class": "mangrove",
          "samples_collected": 200
        }
      ],
      "validation_metrics": {
        "overall_accuracy": 0.89,
        "kappa_coefficient": 0.86,
        "confusion_matrix": {
          "urban": { "urban": 145, "water": 2, "vegetation": 8, "bare_soil": 5 },
          "water": { "urban": 1, "water": 198, "vegetation": 1, "bare_soil": 0 },
          "vegetation": { "urban": 5, "water": 2, "vegetation": 185, "bare_soil": 8 },
          "bare_soil": { "urban": 3, "water": 0, "vegetation": 7, "bare_soil": 90 }
        }
      }
    }
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'ml_training_polygons_ground_truth.json'),
    JSON.stringify(trainingPolygonsData, null, 2)
  );

  console.log('✅ ML classification ground truth data generated');
}

// ========== 8. SHORELINE GROUND TRUTH ==========
function generateShorelineGroundTruth() {
  // Typical user data: Historical shoreline positions, erosion measurements
  const shorelinePositionsData = `transect_id,latitude,longitude,measurement_date,distance_from_baseline_m,elevation_m,erosion_rate_m_per_year,beach_width_m,sediment_type,wave_height_m
T001,25.7909,-80.1263,2020-01-15,125.5,1.2,-1.5,45,fine_sand,0.8
T001,25.7909,-80.1263,2021-01-15,124.0,1.1,-1.5,43,fine_sand,0.9
T001,25.7909,-80.1263,2022-01-15,122.5,1.0,-1.5,41,fine_sand,0.8
T001,25.7909,-80.1263,2023-01-15,121.0,0.9,-1.5,39,fine_sand,1.0
T001,25.7909,-80.1263,2024-01-15,119.5,0.8,-1.5,37,fine_sand,0.9
T002,25.7809,-80.1263,2020-01-15,132.2,1.5,-1.2,52,coarse_sand,0.7
T002,25.7809,-80.1263,2021-01-15,131.0,1.4,-1.2,50,coarse_sand,0.8
T002,25.7809,-80.1263,2022-01-15,129.8,1.3,-1.2,48,coarse_sand,0.7
T002,25.7809,-80.1263,2023-01-15,128.6,1.2,-1.2,46,coarse_sand,0.9
T002,25.7809,-80.1263,2024-01-15,127.4,1.1,-1.2,44,coarse_sand,0.8`;

  fs.writeFileSync(path.join(GT_DIR, 'shoreline_positions_ground_truth.csv'), shorelinePositionsData);

  // Beach nourishment and coastal structures
  const coastalManagementData = {
    "coastal_segments": {
      "miami_beach_south": {
        "length_km": 5.2,
        "orientation_degrees": 45,
        "shoreline_type": "sandy_beach",
        "infrastructure": {
          "seawalls": [
            { "id": "SW_001", "length_m": 500, "height_m": 2.5, "year_built": 2015 }
          ],
          "groins": [
            { "id": "GR_001", "length_m": 100, "spacing_m": 200, "year_built": 2018 }
          ],
          "breakwaters": []
        },
        "nourishment_history": [
          {
            "year": 2020,
            "volume_m3": 500000,
            "cost_usd": 12000000,
            "sand_source": "offshore",
            "grain_size_mm": 0.35
          }
        ],
        "storm_impacts": [
          {
            "storm_name": "Hurricane Irma",
            "date": "2017-09-10",
            "surge_height_m": 1.8,
            "erosion_volume_m3": 150000,
            "recovery_time_months": 18
          }
        ]
      }
    }
  };

  fs.writeFileSync(
    path.join(GT_DIR, 'coastal_management_ground_truth.json'),
    JSON.stringify(coastalManagementData, null, 2)
  );

  console.log('✅ Shoreline ground truth data generated');
}

// ========== MAIN FUNCTION ==========
function generateAllGroundTruthData() {
  console.log('\n🌍 Generating Realistic Ground Truth Data for All Geospatial Models');
  console.log('=' .repeat(70));
  
  generateAgricultureGroundTruth();
  generateForestGroundTruth();
  generateWaterQualityGroundTruth();
  generateFloodGroundTruth();
  generateUrbanGroundTruth();
  generateClimateGroundTruth();
  generateMLClassificationGroundTruth();
  generateShorelineGroundTruth();
  
  console.log('\n✨ All ground truth data files generated successfully!');
  console.log(`📁 Files saved in: ${GT_DIR}`);
  
  // List all generated files
  console.log('\n📋 Generated Files:');
  const files = fs.readdirSync(GT_DIR);
  files.forEach(file => {
    const stats = fs.statSync(path.join(GT_DIR, file));
    console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
  
  return GT_DIR;
}

// Run the generator
if (require.main === module) {
  generateAllGroundTruthData();
}

module.exports = { generateAllGroundTruthData, GT_DIR };
