#!/usr/bin/env python3

import pandas as pd
import json

# Read the Excel file
df = pd.read_excel('C:\\Users\\Dhenenjay\\Downloads\\AxionOrbital (Responses).xlsx')

print("=" * 80)
print("AXION ORBITAL USER RESPONSES ANALYSIS")
print("=" * 80)
print(f"\nTotal Responses: {len(df)}")
print(f"\nColumns in dataset:")
for col in df.columns:
    print(f"  - {col}")

# Analyze the key columns for use cases
key_columns = []
for col in df.columns:
    if 'use case' in col.lower() or 'application' in col.lower() or 'build' in col.lower() or 'project' in col.lower():
        key_columns.append(col)

print(f"\n📊 Key Use Case Columns Found:")
for col in key_columns:
    print(f"  - {col}")

# Extract and categorize use cases
use_cases = []
for idx, row in df.iterrows():
    for col in df.columns:
        if pd.notna(row[col]) and isinstance(row[col], str) and len(row[col]) > 20:
            # Check if it mentions geospatial/satellite/earth observation terms
            keywords = ['satellite', 'imagery', 'ndvi', 'vegetation', 'crop', 'agriculture', 
                       'forest', 'water', 'land', 'climate', 'weather', 'monitor', 'analysis',
                       'detection', 'classification', 'map', 'earth', 'observation', 'remote sensing',
                       'wildfire', 'flood', 'drought', 'yield', 'urban', 'deforestation']
            
            text = str(row[col]).lower()
            if any(keyword in text for keyword in keywords):
                use_cases.append({
                    'user': idx + 1,
                    'column': col,
                    'use_case': row[col]
                })

print(f"\n🎯 Found {len(use_cases)} Geospatial Use Cases")
print("\n" + "=" * 80)
print("DETAILED USE CASE ANALYSIS")
print("=" * 80)

# Categorize use cases
categories = {
    'Agriculture': ['crop', 'agriculture', 'farm', 'yield', 'soil', 'irrigation', 'harvest'],
    'Forest/Vegetation': ['forest', 'vegetation', 'ndvi', 'deforestation', 'tree', 'biomass'],
    'Water Resources': ['water', 'flood', 'drought', 'lake', 'river', 'moisture', 'rainfall'],
    'Climate/Weather': ['climate', 'weather', 'temperature', 'precipitation', 'storm'],
    'Disaster Management': ['wildfire', 'flood', 'disaster', 'risk', 'emergency', 'damage'],
    'Urban Planning': ['urban', 'city', 'building', 'infrastructure', 'land use'],
    'Environmental Monitoring': ['pollution', 'air quality', 'emission', 'environmental']
}

categorized = {cat: [] for cat in categories}
uncategorized = []

for use_case in use_cases:
    text = use_case['use_case'].lower()
    categorized_flag = False
    
    for category, keywords in categories.items():
        if any(keyword in text for keyword in keywords):
            categorized[category].append(use_case)
            categorized_flag = True
            break
    
    if not categorized_flag:
        uncategorized.append(use_case)

# Print categorized use cases
for category, cases in categorized.items():
    if cases:
        print(f"\n🔹 {category} ({len(cases)} use cases)")
        print("-" * 40)
        for i, case in enumerate(cases[:3], 1):  # Show first 3 examples
            print(f"{i}. User {case['user']}: {case['use_case'][:150]}...")

if uncategorized:
    print(f"\n🔸 Other/Uncategorized ({len(uncategorized)} use cases)")
    print("-" * 40)
    for i, case in enumerate(uncategorized[:3], 1):
        print(f"{i}. User {case['user']}: {case['use_case'][:150]}...")

# Analyze MCP compatibility
print("\n" + "=" * 80)
print("MCP SERVER COMPATIBILITY ANALYSIS")
print("=" * 80)

mcp_capabilities = {
    'NDVI Calculation': ['ndvi', 'vegetation index', 'vegetation health'],
    'Water Index (NDWI)': ['water', 'ndwi', 'water bodies', 'moisture'],
    'Cloud-free Composites': ['composite', 'cloud-free', 'median', 'mosaic'],
    'Wildfire Risk': ['wildfire', 'fire risk', 'fire detection'],
    'Time Series Analysis': ['time series', 'temporal', 'change detection', 'monitoring'],
    'Export/Visualization': ['export', 'map', 'visualization', 'thumbnail'],
    'Custom Analysis': ['custom', 'algorithm', 'classification', 'machine learning']
}

supported_count = 0
partial_support = 0
needs_extension = 0

print("\n🚀 Checking Use Case Support:")
print("-" * 40)

for use_case in use_cases[:10]:  # Analyze first 10 in detail
    text = use_case['use_case'].lower()
    supported_features = []
    
    for capability, keywords in mcp_capabilities.items():
        if any(keyword in text for keyword in keywords):
            supported_features.append(capability)
    
    if len(supported_features) >= 2:
        support_level = "✅ FULLY SUPPORTED"
        supported_count += 1
    elif len(supported_features) == 1:
        support_level = "⚠️ PARTIALLY SUPPORTED"
        partial_support += 1
    else:
        support_level = "🔧 NEEDS EXTENSION"
        needs_extension += 1
    
    print(f"\nUser {use_case['user']}: {support_level}")
    print(f"Use Case: {use_case['use_case'][:100]}...")
    if supported_features:
        print(f"Supported Features: {', '.join(supported_features)}")

# Summary statistics
print("\n" + "=" * 80)
print("SUMMARY STATISTICS")
print("=" * 80)

total_analyzed = min(len(use_cases), 10)
print(f"\n📊 Support Level Analysis (from {total_analyzed} detailed cases):")
print(f"  ✅ Fully Supported: {supported_count} ({supported_count/total_analyzed*100:.1f}%)")
print(f"  ⚠️ Partially Supported: {partial_support} ({partial_support/total_analyzed*100:.1f}%)")
print(f"  🔧 Needs Extension: {needs_extension} ({needs_extension/total_analyzed*100:.1f}%)")

print("\n🎯 Top Required Capabilities:")
capability_count = {}
for use_case in use_cases:
    text = use_case['use_case'].lower()
    for capability, keywords in mcp_capabilities.items():
        if any(keyword in text for keyword in keywords):
            capability_count[capability] = capability_count.get(capability, 0) + 1

sorted_capabilities = sorted(capability_count.items(), key=lambda x: x[1], reverse=True)
for cap, count in sorted_capabilities[:5]:
    print(f"  • {cap}: {count} use cases")

# Generate test cases for MCP
print("\n" + "=" * 80)
print("GENERATING MCP TEST CASES")
print("=" * 80)

test_cases = []

# Find specific testable use cases
for use_case in use_cases[:5]:
    text = use_case['use_case'].lower()
    
    if 'ndvi' in text or 'vegetation' in text:
        test_cases.append({
            'name': 'Vegetation Monitoring',
            'operation': 'earth_engine_process',
            'args': {
                'operation': 'index',
                'indexType': 'NDVI',
                'region': 'Los Angeles',
                'startDate': '2024-01-01',
                'endDate': '2024-01-31',
                'includeVisualization': True
            },
            'use_case': use_case['use_case'][:100]
        })
    
    if 'water' in text:
        test_cases.append({
            'name': 'Water Resources Monitoring',
            'operation': 'earth_engine_process',
            'args': {
                'operation': 'index',
                'indexType': 'NDWI',
                'region': 'San Francisco',
                'startDate': '2024-01-01',
                'endDate': '2024-01-31',
                'includeVisualization': True
            },
            'use_case': use_case['use_case'][:100]
        })
    
    if 'wildfire' in text or 'fire' in text:
        test_cases.append({
            'name': 'Wildfire Risk Assessment',
            'operation': 'wildfire_risk_assessment',
            'args': {
                'region': 'Los Angeles',
                'startDate': '2024-06-01',
                'endDate': '2024-08-31'
            },
            'use_case': use_case['use_case'][:100]
        })

# Save test cases
with open('user-test-cases.json', 'w') as f:
    json.dump(test_cases, f, indent=2)

print(f"\n✅ Generated {len(test_cases)} test cases based on user requirements")
print("   Saved to: user-test-cases.json")

print("\n🎯 Recommendations for MCP Enhancement:")
print("-" * 40)
print("1. Add crop yield prediction models for agriculture use cases")
print("2. Implement change detection algorithms for deforestation monitoring")
print("3. Add flood prediction and water quality assessment")
print("4. Include urban heat island analysis for city planning")
print("5. Develop custom classification tools for land use mapping")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
