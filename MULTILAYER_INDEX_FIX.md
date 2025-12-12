# Multi-Layer Index Map Fix

## Problem Identified
When creating multi-layer maps with vegetation indices (NDVI, NDWI, NDBI, etc.), the system was incorrectly using RGB bands `['B4', 'B3', 'B2']` instead of the actual index band names `['NDVI']`, `['NDWI']`, `['NDBI']`. This caused the map creation to fail with error: "Failed to create map".

## Root Cause
In `earth_engine_map.ts`, when a layer didn't explicitly specify bands, the system defaulted to the global RGB bands without checking if the layer was an index layer.

```typescript
// OLD CODE (line 269)
const layerBands = layer.bands || bands; // Always defaults to ['B4', 'B3', 'B2']
```

## Solution Implemented

### 1. Smart Band Detection
Added intelligent band detection based on the input key name and layer name:

```typescript
// NEW CODE (lines 269-294)
let layerBands = layer.bands;
if (!layerBands) {
  // Check if this is an index layer based on the input key
  const inputLower = (layer.input || '').toLowerCase();
  const nameLower = layer.name.toLowerCase();
  
  if (inputLower.includes('ndvi') || nameLower.includes('ndvi')) {
    layerBands = ['NDVI'];
  } else if (inputLower.includes('ndwi') || nameLower.includes('ndwi')) {
    layerBands = ['NDWI'];
  } else if (inputLower.includes('ndbi') || nameLower.includes('ndbi')) {
    layerBands = ['NDBI'];
  } else if (inputLower.includes('evi') || nameLower.includes('evi')) {
    layerBands = ['EVI'];
  } else if (inputLower.includes('savi') || nameLower.includes('savi')) {
    layerBands = ['SAVI'];
  } else if (inputLower.includes('nbr') || nameLower.includes('nbr')) {
    layerBands = ['NBR'];
  } else {
    // Default to RGB bands for composite images
    layerBands = bands;
  }
  
  console.log(`[Map] Auto-detected bands for layer ${layer.name}: ${layerBands}`);
}
```

### 2. Enhanced Index Detection
Updated the `normalizeVisParams` function to include NDBI in the index detection:

```typescript
// Added 'ndbi' to the list of recognized indices
const isIndex = bands.length === 1 || 
                bands.some(b => ['ndvi', 'ndwi', 'ndbi', 'evi', 'savi', 'nbr'].includes(b.toLowerCase()));
```

## How It Works Now

1. **Input Key Analysis**: When creating a layer without explicit bands, the system analyzes the input key (e.g., `ndvi_1757688799908`) to determine the type of data.

2. **Automatic Band Selection**: 
   - If the input contains "ndvi" → bands = `['NDVI']`
   - If the input contains "ndwi" → bands = `['NDWI']`
   - If the input contains "ndbi" → bands = `['NDBI']`
   - Otherwise → bands = `['B4', 'B3', 'B2']` (RGB default)

3. **Proper Visualization**: Index layers now correctly use their single-band data with appropriate visualization parameters.

## Usage Example

```javascript
{
  "operation": "create",
  "region": "Los Angeles",
  "layers": [
    {
      "name": "NDVI (Vegetation)",
      "input": "ndvi_1757688799908",  // System detects this is NDVI
      // No need to specify bands - auto-detected as ['NDVI']
      "visParams": {
        "min": -1,
        "max": 1,
        "palette": ["#d73027", "..."]
      }
    },
    {
      "name": "NDWI (Water)",
      "input": "ndwi_1757688806696",  // System detects this is NDWI
      // No need to specify bands - auto-detected as ['NDWI']
      "visParams": {
        "min": -1,
        "max": 1,
        "palette": ["#8c510a", "..."]
      }
    }
  ]
}
```

## Testing

Run the test script to verify the fix:
```powershell
.\test-index-layers.ps1
```

Check server logs for:
- `[Map] Auto-detected bands for layer NDVI (Vegetation): NDVI`
- `[Map] Auto-detected bands for layer NDWI (Water): NDWI`
- `[Map] Auto-detected bands for layer NDBI (Urban/Built-up): NDBI`

## Benefits

✅ **No manual band specification needed** - System intelligently detects index types
✅ **Backward compatible** - Explicit band specifications still work
✅ **Cleaner API** - Users don't need to remember band names for indices
✅ **Error prevention** - Prevents RGB bands being used for single-band indices
✅ **Multiple indices supported** - NDVI, NDWI, NDBI, EVI, SAVI, NBR

## Files Modified

- `src/mcp/tools/consolidated/earth_engine_map.ts` (lines 269-294, 114-115)
- Built output: `dist/index.mjs`

## Status

✅ **FIXED** - Multi-layer index maps now work correctly with automatic band detection.