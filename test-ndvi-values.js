// Detailed test to verify NDVI calculations return actual numeric values
const API_URL = 'http://localhost:3000/api/mcp/sse';

function parseResponse(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        // Try SSE format
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

async function testNDVIValues() {
    console.log('=========================================');
    console.log('Testing NDVI Value Calculations');
    console.log('=========================================\n');
    
    // Test 1: Full deforestation detection with detailed output
    console.log('1. Running full deforestation detection...');
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
    const result = parseResponse(text1);
    
    console.log('   Full response:', JSON.stringify(result, null, 2));
    console.log('\n   Key metrics:');
    console.log('   - Success:', result?.success);
    console.log('   - Forest Cover 2020:', result?.forestCover2020);
    console.log('   - Forest Cover 2024:', result?.forestCover2024);
    console.log('   - Percent Loss:', result?.percentLoss);
    console.log('   - Alert Level:', result?.alertLevel);
    console.log('   - Areas of Concern:', result?.areasOfConcern?.length || 0);
    
    // Test 2: Direct NDVI calculation
    console.log('\n2. Testing direct NDVI calculation...');
    const ndviRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_process",
            arguments: {
                operation: "index",
                datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                region: "Amazon rainforest",
                startDate: "2024-01-01",
                endDate: "2024-06-30",
                indexType: "NDVI",
                cloudThreshold: 20
            }
        }
    };
    
    const response2 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ndviRequest)
    });
    
    const text2 = await response2.text();
    const ndviResult = parseResponse(text2);
    
    console.log('   NDVI result:', JSON.stringify(ndviResult, null, 2));
    console.log('\n   NDVI metrics:');
    console.log('   - Success:', ndviResult?.success);
    console.log('   - Has value:', ndviResult?.value !== undefined && ndviResult?.value !== null);
    console.log('   - Value type:', typeof ndviResult?.value);
    console.log('   - Numeric value:', ndviResult?.value);
    console.log('   - Index type:', ndviResult?.indexType);
    
    // Test 3: Create composite and check metadata
    console.log('\n3. Testing composite creation with metadata...');
    const compositeRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_process",
            arguments: {
                operation: "composite",
                datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                region: "Amazon rainforest",
                startDate: "2024-01-01",
                endDate: "2024-06-30",
                cloudThreshold: 20
            }
        }
    };
    
    const response3 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compositeRequest)
    });
    
    const text3 = await response3.text();
    const compositeResult = parseResponse(text3);
    
    console.log('   Composite created:', compositeResult?.success);
    console.log('   Composite ID:', compositeResult?.compositeId);
    console.log('   Has metadata:', !!compositeResult?.metadata);
    
    // Summary
    console.log('\n=========================================');
    console.log('TEST RESULTS ANALYSIS');
    console.log('=========================================');
    
    const issues = [];
    
    if (result?.percentLoss === null || result?.percentLoss === undefined) {
        issues.push('❌ Percent loss is null/undefined - NDVI values likely not calculated');
    } else if (result?.percentLoss === 0) {
        issues.push('⚠️ Percent loss is 0 - might indicate no change or calculation issue');
    } else {
        console.log('✅ Percent loss calculated:', result.percentLoss + '%');
    }
    
    if (!result?.forestCover2020 && !result?.forestCover2024) {
        issues.push('❌ Forest cover values are missing');
    } else if (result?.forestCover2020 || result?.forestCover2024) {
        console.log('✅ Forest cover values present');
    }
    
    if (ndviResult?.value === null || ndviResult?.value === undefined) {
        issues.push('❌ NDVI value is null/undefined - Earth Engine calculation issue');
    } else if (typeof ndviResult?.value === 'number') {
        console.log('✅ NDVI returns numeric value:', ndviResult.value);
    }
    
    if (issues.length > 0) {
        console.log('\n⚠️ ISSUES FOUND:');
        issues.forEach(issue => console.log('  ' + issue));
        console.log('\n📋 RECOMMENDED FIXES:');
        console.log('  1. Check Earth Engine index calculation in earth_engine_process model');
        console.log('  2. Ensure reduceRegion() returns actual numeric values');
        console.log('  3. Verify value property is set in the response');
    } else {
        console.log('\n🎉 All values calculated correctly!');
    }
}

// Run test
console.log('Starting NDVI value tests...\n');
setTimeout(testNDVIValues, 2000);