# Creating Multi-Layer Interactive Maps

## Important: Single Map with Multiple Layers

To create ONE map with multiple switchable layers (instead of multiple separate maps), you must pass ALL layers in a SINGLE `earth_engine_map` call with the `layers` array.

## Correct Example - ONE Map with Multiple Layers

```javascript
earth_engine_map({
  "operation": "create",
  "region": "Los Angeles",
  "center": [-118.2437, 34.0522],
  "zoom": 10,
  "basemap": "satellite",
  "layers": [
    {
      "name": "Natural Color (RGB)",
      "input": "composite_1757682536493",  // Reference to main composite
      "bands": ["B4", "B3", "B2"],
      "visParams": {
        "min": 0,
        "max": 0.3,
        "gamma": 1.4
      }
    },
    {
      "name": "False Color (NIR-R-G)",
      "input": "composite_1757682536493",  // Same composite, different bands
      "bands": ["B8", "B4", "B3"],
      "visParams": {
        "min": 0,
        "max": 0.3,
        "gamma": 1.4
      }
    },
    {
      "name": "NDVI",
      "input": "ndvi_1757682617657",  // Reference to NDVI index result
      "bands": ["NDVI"],
      "visParams": {
        "min": -0.2,
        "max": 0.8,
        "palette": ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"]
      }
    },
    {
      "name": "NDWI",
      "input": "ndwi_1757682624675",  // Reference to NDWI index result
      "bands": ["NDWI"],
      "visParams": {
        "min": -0.5,
        "max": 0.8,
        "palette": ["#8B0000", "#CD853F", "#FFFF00", "#ADFF2F", "#00FFFF", "#0000FF"]
      }
    },
    {
      "name": "EVI",
      "input": "evi_1757682632849",  // Reference to EVI index result
      "bands": ["EVI"],
      "visParams": {
        "min": 0,
        "max": 0.5,
        "palette": ["#800000", "#8B4513", "#DAA520", "#ADFF2F", "#228B22", "#006400"]
      }
    },
    {
      "name": "NDBI",
      "input": "ndbi_1757682644458",  // Reference to NDBI index result
      "bands": ["NDBI"],
      "visParams": {
        "min": -0.5,
        "max": 0.5,
        "palette": ["#0000FF", "#00FFFF", "#FFFF00", "#FF8C00", "#FF0000", "#8B0000"]
      }
    }
  ]
})
```

## Result

This creates:
- **ONE interactive map** accessible at a single URL (e.g., `http://localhost:3000/map/map_xyz`)
- Multiple layers that users can switch between using a layer control
- Each layer can come from different data sources (composites, indices, etc.)
- All layers share the same map view (zoom, pan, etc.)

## INCORRECT Approach (Creates Multiple Separate Maps)

❌ DO NOT call earth_engine_map multiple times:
```javascript
// This creates 6 separate maps - WRONG!
earth_engine_map({ operation: "create", input: "composite_123", ... })
earth_engine_map({ operation: "create", input: "ndvi_456", ... })
earth_engine_map({ operation: "create", input: "ndwi_789", ... })
// etc.
```

## Key Points

1. **Use the `layers` array** to specify multiple layers in one call
2. **Each layer has its own `input`** field to reference different data sources
3. **Each layer has its own visualization parameters** 
4. **All layers appear on the same map** with a layer switcher control