// Import consolidated super tools
// These 5 tools replace the 32 individual tools for better MCP stability
import './consolidated/earth_engine_data';     // Data operations: search, info, geometry
import './consolidated/earth_engine_system';   // System operations: auth, setup, help  
import './consolidated/earth_engine_process';  // Processing: NDVI, NDWI, thumbnail, timeseries
import './consolidated/earth_engine_export';   // Export operations: toAsset, toDrive, toGCS
import './consolidated/earth_engine_map';      // Interactive map viewer for large regions
import './consolidated/crop_classification';   // Crop classification: build, train, visualize models

// Legacy tool imports commented out - replaced by consolidated tools above
// import './auth_check';
// import './search_gee_catalog';
// import './shapefile_to_geometry';
// import './get_shapefile_boundary';
// import './use_shapefile_instead';
// import './filter_collection';
// import './smart_filter';
// import './get_band_names';
// import './load_cog_from_gcs';
// import './mask_clouds';
// import './create_mosaic';
// import './clip_image';
// import './resample_image';
// import './spectral_index';
// import './reduce_stats';
// import './zonal_stats';
// import './change_detect';
// import './terrain';
// import './time_series';
// import './get_tiles';
// import './get_thumbnail';
// import './export_image';
// import './export_composite';
// import './export_to_drive';
// import './export_to_gcs';
// import './setup_gcs';
// import './export_status';
// import './gee_script_js';
// import './gee_sdk_call';
