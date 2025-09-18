// Test map creation returns proper public URL
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

async function testMapUrl() {
    console.log('===================================');
    console.log('Testing Map URL Generation');
    console.log('===================================\n');
    
    // First create a composite
    console.log('1. Creating test composite...');
    const compositeRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_process",
            arguments: {
                operation: "composite",
                datasetId: "COPERNICUS/S2_SR_HARMONIZED",
                region: "Los Angeles",
                startDate: "2024-01-01",
                endDate: "2024-01-31",
                compositeType: "median"
            }
        }
    };
    
    const response1 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compositeRequest)
    });
    
    const text1 = await response1.text();
    const compositeResult = parseResponse(text1);
    
    if (!compositeResult?.compositeKey) {
        console.log('❌ Failed to create composite');
        return;
    }
    
    console.log('   Composite created:', compositeResult.compositeKey);
    
    // Now create a map with the composite
    console.log('\n2. Creating map with composite...');
    const mapRequest = {
        method: "tools/call",
        params: {
            tool: "earth_engine_map",
            arguments: {
                operation: "create",
                title: "Los Angeles Test Map",
                center: { lat: 34.0522, lng: -118.2437 },
                zoom: 10,
                region: "Los Angeles",
                datasets: [
                    {
                        name: "S2 Composite",
                        datasetId: compositeResult.compositeKey,
                        opacity: 1,
                        visParams: {
                            bands: ["B4", "B3", "B2"],
                            min: 0,
                            max: 3000,
                            gamma: 1.4
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
    
    console.log('\n===================================');
    console.log('RESULTS');
    console.log('===================================');
    
    console.log('\nMap Creation Result:');
    console.log('   Success:', mapResult?.success);
    console.log('   Map ID:', mapResult?.mapId);
    console.log('\n📍 URLs Generated:');
    console.log('   View URL:', mapResult?.viewUrl);
    console.log('   Viewable At:', mapResult?.viewableAt);
    console.log('   Instructions:', mapResult?.instructions);
    
    if (mapResult?.viewUrl) {
        const url = new URL(mapResult.viewUrl);
        console.log('\n✅ URL Analysis:');
        console.log('   Protocol:', url.protocol);
        console.log('   Host:', url.hostname);
        console.log('   Path:', url.pathname);
        
        if (url.hostname === 'localhost') {
            console.log('\n⚠️  WARNING: Still using localhost!');
            console.log('   Should be: https://axion-planetary-mcp.onrender.com');
        } else if (url.hostname.includes('render.com')) {
            console.log('\n✅ CORRECT: Using Render deployment URL!');
        } else {
            console.log('\n📍 Using deployment URL:', url.hostname);
        }
    } else {
        console.log('\n❌ ERROR: No view URL generated!');
    }
    
    // Show interactive usage
    if (mapResult?.usage?.interactive) {
        console.log('\n🌐 Interactive Map:');
        console.log('   ', mapResult.usage.interactive);
    }
}

// Run test
console.log('Starting map URL test...\n');
setTimeout(testMapUrl, 2000);