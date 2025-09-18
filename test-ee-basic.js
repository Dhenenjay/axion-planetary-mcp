// Test basic Earth Engine functionality
const API_URL = 'http://localhost:3000/api/mcp/sse';

function parseResponse(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    return JSON.parse(line.substring(6));
                } catch (e) {}
            }
        }
    }
    return null;
}

async function testEEBasic() {
    console.log('===================================');
    console.log('Testing Earth Engine Initialization');
    console.log('===================================\n');
    
    // Test 1: Check system status
    console.log('1. Checking Earth Engine system status...');
    const systemRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_system",
            arguments: {
                operation: "status"
            }
        }
    };
    
    const response1 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemRequest)
    });
    
    const text1 = await response1.text();
    const systemResult = parseResponse(text1);
    
    console.log('   Initialized:', systemResult?.initialized);
    console.log('   Authenticated:', systemResult?.authenticated);
    console.log('   Project:', systemResult?.projectId);
    
    // Test 2: Try to get a simple Earth Engine value
    console.log('\n2. Testing simple Earth Engine computation...');
    const simpleRequest = {
        method: "tools/call", 
        params: {
            tool: "earth_engine_data",
            arguments: {
                operation: "collection",
                datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                startDate: "2024-01-01",
                endDate: "2024-01-31",
                region: {
                    type: "point",
                    coordinates: [-55.0, -10.0]  // Point in Amazon
                }
            }
        }
    };
    
    const response2 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simpleRequest)
    });
    
    const text2 = await response2.text();
    const dataResult = parseResponse(text2);
    
    console.log('   Success:', dataResult?.success);
    console.log('   Has count:', dataResult?.count !== undefined);
    console.log('   Image count:', dataResult?.count);
    
    // Test 3: Initialize Earth Engine if not initialized
    if (!systemResult?.initialized) {
        console.log('\n3. Attempting to initialize Earth Engine...');
        const initRequest = {
            method: "tools/call",
            params: {
                tool: "earth_engine_system",
                arguments: {
                    operation: "initialize"
                }
            }
        };
        
        const response3 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initRequest)
        });
        
        const text3 = await response3.text();
        const initResult = parseResponse(text3);
        console.log('   Init result:', initResult);
    }
    
    // Summary
    console.log('\n===================================');
    console.log('DIAGNOSTICS');
    console.log('===================================');
    
    if (!systemResult?.initialized || !systemResult?.authenticated) {
        console.log('❌ Earth Engine not properly initialized/authenticated');
        console.log('   This is why NDVI values are not being calculated!');
        console.log('\n📋 SOLUTION:');
        console.log('   1. Ensure Earth Engine credentials are set up');
        console.log('   2. Check GOOGLE_APPLICATION_CREDENTIALS env var');
        console.log('   3. Verify service account has Earth Engine access');
    } else if (dataResult?.count === 0) {
        console.log('⚠️ Earth Engine is working but no data found');
        console.log('   Check date ranges and regions');
    } else {
        console.log('✅ Earth Engine appears to be working');
        console.log('   The issue may be with value evaluation in the process tool');
    }
}

// Run test
console.log('Starting Earth Engine diagnostics...\n');
setTimeout(testEEBasic, 1000);