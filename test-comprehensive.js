// Comprehensive test for deforestation detection and map creation
const API_URL = 'http://localhost:3000/api/mcp/sse';

// Helper to parse response (handles both JSON and SSE)
function parseResponse(text) {
    // First try to parse as direct JSON
    try {
        return JSON.parse(text);
    } catch (e) {
        // Not JSON, might be SSE
    }
    
    // Try to parse as SSE
    const lines = text.split('\n');
    let result = null;
    
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                const data = JSON.parse(line.substring(6));
                // Handle direct response format
                if (data && !data.type) {
                    result = data;
                }
                // Handle MCP tool_result format
                else if (data.type === 'tool_result' && data.content) {
                    try {
                        result = JSON.parse(data.content[0].text);
                    } catch (e) {
                        result = data.content[0].text;
                    }
                }
            } catch (e) {
                // Continue
            }
        }
    }
    
    return result;
}

async function testDeforestation() {
    console.log('\n🌲 Testing Deforestation Detection...\n');
    
    const request = {
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
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        
        const text = await response.text();
        const result = parseResponse(text);
        
        console.log('✅ Deforestation Response:');
        console.log('   - Success:', result?.success);
        console.log('   - Forest Cover Baseline:', result?.forestCover?.baseline);
        console.log('   - Forest Cover Current:', result?.forestCover?.current);
        console.log('   - Percent Loss:', result?.deforestation?.percentLoss);
        console.log('   - Alerts:', result?.alerts?.length || 0);
        console.log('   - Error:', result?.error || 'None');
        
        if (result?.error) {
            console.error('❌ Error in deforestation detection:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Failed to test deforestation:', error.message);
        return null;
    }
}

async function testNDVIIndex() {
    console.log('\n🍃 Testing NDVI Index Calculation...\n');
    
    const request = {
        method: "tools/call",
        params: {
            tool: "earth_engine_process",
            arguments: {
                operation: "index",
                indexType: "NDVI",
                datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                startDate: "2024-01-01",
                endDate: "2024-03-31",
                region: "Amazon rainforest"
            }
        }
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        
        const text = await response.text();
        const result = parseResponse(text);
        
        console.log('✅ NDVI Response:');
        console.log('   - Success:', result?.success);
        console.log('   - Value:', result?.value || result?.result?.value);
        console.log('   - Composite ID:', result?.compositeId || result?.compositeKey);
        console.log('   - Message:', result?.message);
        
        return result;
    } catch (error) {
        console.error('❌ Failed to test NDVI:', error.message);
        return null;
    }
}

async function testMapCreation() {
    console.log('\n🗺️ Testing Map Creation...\n');
    
    const request = {
        method: "tools/call",
        params: {
            tool: "earth_engine_map",
            arguments: {
                operation: "create",
                datasets: [
                    {
                        datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                        name: "Sentinel-2 2024",
                        opacity: 1,
                        visParams: {
                            bands: ["B4", "B3", "B2"],
                            min: 0,
                            max: 3000
                        }
                    }
                ],
                region: "Amazon rainforest",
                center: { lat: -3.4653, lng: -62.2159 },
                zoom: 5,
                title: "Amazon Test Map"
            }
        }
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        
        const text = await response.text();
        const result = parseResponse(text);
        
        console.log('✅ Map Response:');
        console.log('   - Success:', result?.success);
        console.log('   - Tile URL:', result?.tileUrl ? 'Generated' : 'Failed');
        console.log('   - Map ID:', result?.mapId);
        console.log('   - Message:', result?.message);
        
        if (result?.tileUrl) {
            console.log('\n📍 Tile URL (use in any mapping library):');
            console.log('   ', result.tileUrl);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Failed to test map:', error.message);
        return null;
    }
}

async function testComposite() {
    console.log('\n🌍 Testing Composite Creation...\n');
    
    const request = {
        method: "tools/call",
        params: {
            tool: "earth_engine_process",
            arguments: {
                operation: "composite",
                datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                region: "Amazon rainforest",
                startDate: "2024-01-01",
                endDate: "2024-03-31",
                compositeType: "median",
                scale: 30
            }
        }
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        
        const text = await response.text();
        const result = parseResponse(text);
        
        console.log('✅ Composite Response:');
        console.log('   - Success:', result?.success);
        console.log('   - Composite ID:', result?.compositeId || result?.compositeKey);
        console.log('   - Message:', result?.message);
        
        return result;
    } catch (error) {
        console.error('❌ Failed to test composite:', error.message);
        return null;
    }
}

async function runAllTests() {
    console.log('========================================');
    console.log('COMPREHENSIVE EARTH ENGINE TESTING');
    console.log('========================================');
    console.log('\nWaiting for Next.js server to be ready...\n');
    
    // Wait for server
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: NDVI Index
    const ndviResult = await testNDVIIndex();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Composite Creation
    const compositeResult = await testComposite();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Map Creation
    const mapResult = await testMapCreation();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 4: Deforestation Detection
    const deforestationResult = await testDeforestation();
    
    // Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    
    const tests = [
        { name: 'NDVI Index', passed: ndviResult?.success },
        { name: 'Composite Creation', passed: compositeResult?.success },
        { name: 'Map Creation', passed: mapResult?.success && mapResult?.tileUrl },
        { name: 'Deforestation Detection', passed: deforestationResult?.success && !deforestationResult?.error }
    ];
    
    tests.forEach(test => {
        console.log(`${test.passed ? '✅' : '❌'} ${test.name}: ${test.passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = tests.every(t => t.passed);
    console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'));
    
    if (!allPassed) {
        console.log('\n⚠️ DO NOT DEPLOY UNTIL ALL TESTS PASS!');
    }
}

// Run tests
runAllTests().catch(console.error);