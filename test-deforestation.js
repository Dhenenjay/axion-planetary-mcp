// Test deforestation detection and map creation locally
const API_URL = 'http://localhost:3000/api/mcp/sse';

async function testDeforestation() {
    console.log('Testing Deforestation Detection...\n');
    
    // Test 1: Run deforestation detection
    console.log('1. Running deforestation detection for Amazon...');
    const deforestationRequest = {
        method: "tools/call",
        params: {
            tool: "deforestation_detection",
            arguments: {
                region: "Amazon rainforest",
                baselineYear: 2010,
                currentYear: 2024,
                sensitivity: "high"
            }
        }
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deforestationRequest)
        });
        
        const text = await response.text();
        console.log('Deforestation Response:', text.substring(0, 500), '...\n');
        
        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 2: Create a map with dataset ID
        console.log('2. Creating map with Sentinel-2 dataset...');
        const mapRequest = {
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
                    title: "Amazon Deforestation Map"
                }
            }
        };
        
        const mapResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapRequest)
        });
        
        const mapText = await mapResponse.text();
        console.log('Map Response:', mapText.substring(0, 500), '...\n');
        
        // Parse the SSE response to get the actual result
        const lines = mapText.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.substring(6));
                    if (data.type === 'tool_result' && data.content) {
                        const content = JSON.parse(data.content[0].text);
                        if (content.tileUrl) {
                            console.log('✅ SUCCESS! Map tile URL generated:');
                            console.log('   Tile URL:', content.tileUrl);
                            console.log('\n   You can use this URL in any mapping library!');
                        }
                    }
                } catch (e) {
                    // Continue parsing
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

console.log('========================================');
console.log('Testing Deforestation & Map Creation');
console.log('========================================\n');

console.log('Waiting for Next.js server to be ready...\n');
setTimeout(testDeforestation, 3000);