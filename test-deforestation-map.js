// Test deforestation detection and map creation with special dataset IDs
const API_URL = 'http://localhost:3000/api/mcp/sse';

// Helper to parse response (handles both JSON and SSE)
function parseResponse(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        // Not JSON, might be SSE
    }
    
    // Try to parse as SSE
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                return JSON.parse(line.substring(6));
            } catch (e) {
                // Continue
            }
        }
    }
    return null;
}

async function testDeforestationMapCreation() {
    console.log('===================================');
    console.log('Testing Deforestation Map Creation');
    console.log('===================================\n');
    
    // Test 1: Deforestation detection first
    console.log('1. Running deforestation detection...');
    const deforestationRequest = {
        method: "tools/call",
        params: {
            tool: "deforestation_detection",
            arguments: {
                region: "Amazon rainforest",
                baselineYear: 2020,
                currentYear: 2024,
                sensitivity: "high"
            }
        }
    };
    
    const response1 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deforestationRequest)
    });
    
    const text1 = await response1.text();
    const deforestationResult = parseResponse(text1);
    
    console.log('   Success:', deforestationResult?.success);
    console.log('   Has composites:', !!deforestationResult?.composites);
    console.log('   Map data ready:', deforestationResult?.visualizationReady);
    
    // Test 2: Create map with special deforestation dataset IDs
    console.log('\n2. Creating map with deforestation dataset IDs...');
    const mapRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_map",
            arguments: {
                operation: "create",
                title: "Amazon Deforestation Analysis (2020-2024)",
                center: { lat: -8.7832, lng: -55.4915 },
                zoom: 5,
                region: "Amazon rainforest",
                datasets: [
                    {
                        name: "Forest Cover 2020",
                        datasetId: "forest_baseline_2020",
                        opacity: 0.7,
                        visParams: {
                            bands: ["B4", "B3", "B2"],
                            min: 0,
                            max: 3000
                        }
                    },
                    {
                        name: "Forest Cover 2024",
                        datasetId: "forest_cover_2024",
                        opacity: 0.7,
                        visParams: {
                            bands: ["B4", "B3", "B2"],
                            min: 0,
                            max: 3000
                        }
                    }
                ]
            }
        }
    };
    
    const response2 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapRequest)
    });
    
    const text2 = await response2.text();
    const mapResult = parseResponse(text2);
    
    console.log('   Success:', mapResult?.success);
    console.log('   Map ID:', mapResult?.mapId);
    console.log('   Has tile URL:', !!mapResult?.tileUrl);
    console.log('   Error:', mapResult?.error || 'None');
    
    // Test 3: Try with actual composite IDs if available
    if (deforestationResult?.composites?.baseline) {
        console.log('\n3. Creating map with actual composite IDs...');
        const compositeMapRequest = {
            method: "tools/call",
            params: {
                tool: "earth_engine_map",
                arguments: {
                    operation: "create",
                    title: "Amazon Deforestation (Using Composites)",
                    center: { lat: -8.7832, lng: -55.4915 },
                    zoom: 5,
                    region: "Amazon rainforest",
                    datasets: [
                        {
                            name: "Baseline Forest",
                            datasetId: deforestationResult.composites.baseline,
                            opacity: 1,
                            visParams: {
                                bands: ["B4", "B3", "B2"],
                                min: 0,
                                max: 3000
                            }
                        }
                    ]
                }
            }
        };
        
        const response3 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(compositeMapRequest)
        });
        
        const text3 = await response3.text();
        const compositeMapResult = parseResponse(text3);
        
        console.log('   Success:', compositeMapResult?.success);
        console.log('   Map ID:', compositeMapResult?.mapId);
        console.log('   Has tile URL:', !!compositeMapResult?.tileUrl);
    }
    
    // Test 4: Test standard dataset as fallback
    console.log('\n4. Testing standard Sentinel-2 dataset (fallback)...');
    const standardMapRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_map",
            arguments: {
                operation: "create",
                title: "Amazon Standard View",
                center: { lat: -8.7832, lng: -55.4915 },
                zoom: 5,
                region: "Amazon rainforest",
                datasets: [
                    {
                        name: "Sentinel-2",
                        datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                        opacity: 1,
                        visParams: {
                            bands: ["B4", "B3", "B2"],
                            min: 0,
                            max: 3000
                        }
                    }
                ]
            }
        }
    };
    
    const response4 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(standardMapRequest)
    });
    
    const text4 = await response4.text();
    const standardMapResult = parseResponse(text4);
    
    console.log('   Success:', standardMapResult?.success);
    console.log('   Has tile URL:', !!standardMapResult?.tileUrl);
    
    // Summary
    console.log('\n===================================');
    console.log('TEST SUMMARY');
    console.log('===================================');
    
    const tests = [
        { name: 'Deforestation Detection', passed: deforestationResult?.success },
        { name: 'Map with Deforestation IDs', passed: mapResult?.success && !mapResult?.error },
        { name: 'Map with Standard Dataset', passed: standardMapResult?.success }
    ];
    
    tests.forEach(test => {
        console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    
    const allPassed = tests.every(t => t.passed);
    console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED - Check errors above'));
    
    if (mapResult?.tileUrl) {
        console.log('\n📍 Example Tile URL Generated:');
        console.log(mapResult.tileUrl.substring(0, 100) + '...');
    }
}

// Wait for server and run tests
console.log('Waiting for Next.js server to be ready...\n');
setTimeout(testDeforestationMapCreation, 3000);