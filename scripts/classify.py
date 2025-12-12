#!/usr/bin/env python3
"""
Real ML Classification using rasterio and scikit-learn
Applies trained Random Forest model pixel-by-pixel to satellite imagery
"""

import sys
import json
import os
import tempfile
import numpy as np
from pathlib import Path

# Suppress warnings
import warnings
warnings.filterwarnings('ignore')

def search_stac_for_point(collection, lon, lat, datetime_range=None):
    """Search STAC for imagery covering a specific point"""
    import urllib.request
    import urllib.parse
    
    # Build search URL
    base_url = "https://earth-search.aws.element84.com/v1/search"
    
    # Create small bbox around point
    delta = 0.01
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta]
    
    params = {
        "collections": [collection],
        "bbox": bbox,
        "limit": 1,
        "query": {"eo:cloud_cover": {"lt": 30}}
    }
    
    if datetime_range:
        params["datetime"] = datetime_range
    
    try:
        req = urllib.request.Request(
            base_url,
            data=json.dumps(params).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode())
            features = result.get('features', [])
            if features:
                return features[0]
    except Exception as e:
        print(f"[Classify] STAC search failed for ({lat}, {lon}): {e}", file=sys.stderr)
    
    return None


def classify_image(config):
    """
    Perform real pixel-by-pixel classification
    
    Args:
        config: dict with training_data, stac_url, bbox, output_path, etc.
    """
    import rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds
    import planetary_computer as pc
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    
    training_data = config['training_data']
    stac_item_url = config['stac_item_url']
    collection = config.get('collection', 'sentinel-2-l2a')
    output_path = config['output_path']
    num_trees = config.get('num_trees', 50)
    include_indices = config.get('include_indices', True)
    
    print(f"[Classify] Starting classification with {len(training_data)} training points", file=sys.stderr)
    print(f"[Classify] Primary STAC item: {stac_item_url}", file=sys.stderr)
    
    # Fetch primary STAC item to get asset URLs
    import urllib.request
    with urllib.request.urlopen(stac_item_url) as response:
        stac_item = json.loads(response.read().decode())
    
    # Get asset URLs for required bands
    assets = stac_item.get('assets', {})
    
    # Sentinel-2 band mapping
    band_keys = {
        'red': 'red',
        'green': 'green',
        'blue': 'blue',
        'nir': 'nir',
        'swir16': 'swir16',
        'swir22': 'swir22'
    }
    
    band_urls = {}
    for band_name, asset_key in band_keys.items():
        if asset_key in assets:
            url = assets[asset_key].get('href', '')
            # Sign URL if needed (Planetary Computer)
            if 'blob.core.windows.net' in url:
                try:
                    signed = pc.sign(url)
                    band_urls[band_name] = signed
                except:
                    band_urls[band_name] = url
            else:
                band_urls[band_name] = url
    
    if len(band_urls) < 4:
        raise ValueError(f"Not enough bands found. Got: {list(band_urls.keys())}")
    
    print(f"[Classify] Found {len(band_urls)} bands", file=sys.stderr)
    
    # Step 1: Sample training points from appropriate imagery
    print("[Classify] Sampling training points...", file=sys.stderr)
    
    feature_matrix = []
    labels = []
    sampled_classes = set()
    
    # Store primary image metadata
    with rasterio.open(band_urls['nir']) as src:
        src_crs = src.crs
        src_transform = src.transform
        src_bounds = src.bounds
        src_width = src.width
        src_height = src.height
    
    def get_band_urls_for_item(item):
        """Extract band URLs from a STAC item"""
        item_assets = item.get('assets', {})
        urls = {}
        for band_name, asset_key in band_keys.items():
            if asset_key in item_assets:
                url = item_assets[asset_key].get('href', '')
                if 'blob.core.windows.net' in url:
                    try:
                        urls[band_name] = pc.sign(url)
                    except:
                        urls[band_name] = url
                else:
                    urls[band_name] = url
        return urls
    
    def sample_point_from_urls(point_band_urls, lon, lat):
        """Sample band values at a point"""
        band_values = {}
        for band_name, url in point_band_urls.items():
            try:
                with rasterio.open(url) as src:
                    from rasterio.warp import transform as transform_coords
                    xs, ys = transform_coords('EPSG:4326', src.crs, [lon], [lat])
                    
                    if not (src.bounds.left <= xs[0] <= src.bounds.right and 
                            src.bounds.bottom <= ys[0] <= src.bounds.top):
                        continue
                    
                    row, col = src.index(xs[0], ys[0])
                    if 0 <= row < src.height and 0 <= col < src.width:
                        window = rasterio.windows.Window(col, row, 1, 1)
                        data = src.read(1, window=window)
                        band_values[band_name] = float(data[0, 0])
            except Exception as e:
                pass
        return band_values
    
    for point in training_data:
        lat, lon = point['lat'], point['lon']
        label = point['label']
        class_name = point.get('class_name', f'class_{label}')
        
        try:
            # First try primary image
            band_values = sample_point_from_urls(band_urls, lon, lat)
            
            # If not enough bands, search for another image covering this point
            if len(band_values) < 4:
                print(f"[Classify] Searching for imagery at ({lat:.2f}, {lon:.2f})...", file=sys.stderr)
                item = search_stac_for_point(collection, lon, lat)
                if item:
                    alt_band_urls = get_band_urls_for_item(item)
                    if len(alt_band_urls) >= 4:
                        band_values = sample_point_from_urls(alt_band_urls, lon, lat)
            
            if len(band_values) >= 4:
                # Build feature vector
                features = [
                    band_values.get('red', 0),
                    band_values.get('green', 0),
                    band_values.get('blue', 0),
                    band_values.get('nir', 0),
                    band_values.get('swir16', 0),
                    band_values.get('swir22', 0)
                ]
                
                # Add spectral indices if requested
                if include_indices:
                    nir = band_values.get('nir', 0)
                    red = band_values.get('red', 0)
                    green = band_values.get('green', 0)
                    blue = band_values.get('blue', 0)
                    swir = band_values.get('swir16', 0)
                    
                    ndvi = (nir - red) / (nir + red + 1e-10)
                    ndwi = (green - nir) / (green + nir + 1e-10)
                    ndbi = (swir - nir) / (swir + nir + 1e-10)
                    evi = 2.5 * (nir - red) / (nir + 6 * red - 7.5 * blue + 10000)
                    
                    features.extend([ndvi, ndwi, ndbi, evi])
                
                feature_matrix.append(features)
                labels.append(label)
                sampled_classes.add(label)
                print(f"[Classify] ✓ Sampled {class_name} at ({lat:.2f}, {lon:.2f})", file=sys.stderr)
            else:
                print(f"[Classify] ✗ Could not sample {class_name} at ({lat:.2f}, {lon:.2f})", file=sys.stderr)
                
        except Exception as e:
            print(f"[Classify] Warning: Failed to sample point ({lat}, {lon}): {e}", file=sys.stderr)
            continue
    
    if len(feature_matrix) < 3:
        raise ValueError(f"Not enough valid training samples: {len(feature_matrix)}. Got {len(sampled_classes)} classes.")
    
    print(f"[Classify] Sampled {len(feature_matrix)} training points from {len(sampled_classes)} classes", file=sys.stderr)
    
    # Step 2: Train Random Forest
    print("[Classify] Training Random Forest classifier...", file=sys.stderr)
    
    X = np.array(feature_matrix)
    y = np.array(labels)
    
    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train classifier
    clf = RandomForestClassifier(
        n_estimators=num_trees,
        max_features='sqrt',
        n_jobs=-1,
        random_state=42
    )
    clf.fit(X_scaled, y)
    
    # Calculate training accuracy
    train_accuracy = clf.score(X_scaled, y)
    print(f"[Classify] Training accuracy: {train_accuracy:.2%}", file=sys.stderr)
    
    # Step 3: Apply classification to full image
    print("[Classify] Applying classification to image...", file=sys.stderr)
    
    # Calculate a reasonable window to process (avoid memory issues)
    # Use the bounding box from training points with some buffer
    lats = [p['lat'] for p in training_data]
    lons = [p['lon'] for p in training_data]
    
    min_lat, max_lat = min(lats) - 0.5, max(lats) + 0.5
    min_lon, max_lon = min(lons) - 0.5, max(lons) + 0.5
    
    # Transform bbox to image CRS
    from rasterio.warp import transform as transform_coords
    xs, ys = transform_coords('EPSG:4326', src_crs, 
                               [min_lon, max_lon], [min_lat, max_lat])
    
    # Clip to image bounds
    window_left = max(src_bounds.left, min(xs))
    window_right = min(src_bounds.right, max(xs))
    window_bottom = max(src_bounds.bottom, min(ys))
    window_top = min(src_bounds.top, max(ys))
    
    # Read all bands for the window
    # Use smaller output size (max 1000x1000) and read at low resolution for speed
    MAX_DIM = 1000
    
    band_data = {}
    window = None
    out_transform = None
    out_width = None
    out_height = None
    
    for i, (band_name, url) in enumerate(band_urls.items()):
        print(f"[Classify] Reading band {i+1}/{len(band_urls)}: {band_name}...", file=sys.stderr)
        with rasterio.open(url) as src:
            # Get window from bounds
            window = from_bounds(window_left, window_bottom, window_right, window_top, src.transform)
            
            # Clamp window to valid range
            window = rasterio.windows.Window(
                max(0, int(window.col_off)),
                max(0, int(window.row_off)),
                min(int(window.width), src.width - int(window.col_off)),
                min(int(window.height), src.height - int(window.row_off))
            )
            
            # Always downsample to MAX_DIM for speed (uses COG overviews)
            if out_width is None:
                scale = max(window.width / MAX_DIM, window.height / MAX_DIM, 1)
                out_width = int(window.width / scale)
                out_height = int(window.height / scale)
                out_transform = rasterio.transform.from_bounds(
                    window_left, window_bottom, window_right, window_top,
                    out_width, out_height
                )
            
            # Read with resampling (leverages COG overviews for speed)
            data = src.read(
                1,
                window=window,
                out_shape=(out_height, out_width),
                resampling=rasterio.enums.Resampling.bilinear
            )
            
            band_data[band_name] = data.astype(np.float32)
    
    height, width = band_data['nir'].shape
    print(f"[Classify] Processing {width}x{height} pixels...", file=sys.stderr)
    
    # Stack bands into feature array
    n_features = 6 + (4 if include_indices else 0)
    pixels = np.zeros((height * width, n_features), dtype=np.float32)
    
    # Fill base bands
    pixels[:, 0] = band_data.get('red', np.zeros((height, width))).flatten()
    pixels[:, 1] = band_data.get('green', np.zeros((height, width))).flatten()
    pixels[:, 2] = band_data.get('blue', np.zeros((height, width))).flatten()
    pixels[:, 3] = band_data.get('nir', np.zeros((height, width))).flatten()
    pixels[:, 4] = band_data.get('swir16', np.zeros((height, width))).flatten()
    pixels[:, 5] = band_data.get('swir22', np.zeros((height, width))).flatten()
    
    # Add indices
    if include_indices:
        nir = pixels[:, 3]
        red = pixels[:, 0]
        green = pixels[:, 1]
        blue = pixels[:, 2]
        swir = pixels[:, 4]
        
        pixels[:, 6] = (nir - red) / (nir + red + 1e-10)  # NDVI
        pixels[:, 7] = (green - nir) / (green + nir + 1e-10)  # NDWI
        pixels[:, 8] = (swir - nir) / (swir + nir + 1e-10)  # NDBI
        pixels[:, 9] = 2.5 * (nir - red) / (nir + 6 * red - 7.5 * blue + 10000)  # EVI
    
    # Handle nodata (zeros typically mean no data)
    valid_mask = (pixels[:, 3] > 0)  # NIR > 0 indicates valid pixel
    
    # Scale features
    pixels_scaled = scaler.transform(pixels)
    
    # Classify
    print("[Classify] Running classification...", file=sys.stderr)
    classification = np.zeros(height * width, dtype=np.uint8)
    
    # Only classify valid pixels
    if np.any(valid_mask):
        classification[valid_mask] = clf.predict(pixels_scaled[valid_mask])
    
    # Reshape to image
    classification = classification.reshape(height, width)
    
    # Step 4: Save as GeoTIFF
    print(f"[Classify] Saving to {output_path}...", file=sys.stderr)
    
    profile = {
        'driver': 'GTiff',
        'dtype': 'uint8',
        'width': width,
        'height': height,
        'count': 1,
        'crs': src_crs,
        'transform': out_transform,
        'compress': 'lzw',
        'nodata': 0
    }
    
    with rasterio.open(output_path, 'w', **profile) as dst:
        dst.write(classification, 1)
        
        # Add color table for visualization
        colormap = {
            0: (0, 0, 0, 0),  # nodata - transparent
            1: (230, 25, 75, 255),    # Class 1 - Red
            2: (60, 180, 75, 255),    # Class 2 - Green
            3: (255, 225, 25, 255),   # Class 3 - Yellow
            4: (67, 99, 216, 255),    # Class 4 - Blue
            5: (245, 130, 49, 255),   # Class 5 - Orange
            6: (145, 30, 180, 255),   # Class 6 - Purple
            7: (66, 212, 244, 255),   # Class 7 - Cyan
            8: (240, 50, 230, 255),   # Class 8 - Magenta
            9: (191, 239, 69, 255),   # Class 9 - Lime
            10: (250, 190, 212, 255), # Class 10 - Pink
        }
        dst.write_colormap(1, colormap)
    
    # Get unique classes from output
    unique_classes = np.unique(classification[classification > 0])
    
    # Build class info from training data
    class_info = {}
    for point in training_data:
        label = point['label']
        if label not in class_info:
            class_info[label] = point.get('class_name', f'class_{label}')
    
    print(f"[Classify] Classification complete!", file=sys.stderr)
    print(f"[Classify] Classes in output: {[int(c) for c in unique_classes]}", file=sys.stderr)
    print(f"[Classify] Classes sampled: {sorted(sampled_classes)}", file=sys.stderr)
    
    return {
        'success': True,
        'output_path': output_path,
        'width': width,
        'height': height,
        'training_accuracy': float(train_accuracy),
        'training_samples': len(feature_matrix),
        'classes_in_output': [int(c) for c in unique_classes],
        'classes_sampled': sorted([int(c) for c in sampled_classes]),
        'class_names': {str(k): v for k, v in class_info.items()},
        'crs': str(src_crs),
        'bounds': [window_left, window_bottom, window_right, window_top]
    }


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Config file path required'}))
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        result = classify_image(config)
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        print(json.dumps({
            'error': str(e),
            'traceback': traceback.format_exc()
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
