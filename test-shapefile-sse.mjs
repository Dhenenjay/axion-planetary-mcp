#!/usr/bin/env node

import { EventSource } from 'undici';

const SERVER_URL = 'http://localhost:3000/api/mcp/sse';  // Using the correct MCP SSE endpoint

async function testShapefileTool() {
    console.log('Testing Shapefile Tool via SSE endpoint...\n');
    
    const testCases = [
        { place: 'San Francisco', expectedType: 'county' },
        { place: 'Los Angeles', expectedType: 'county' },
        { place: 'California', expectedType: 'state' }
    ];

    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.place}`);
        console.log('─'.repeat(50));
        
        try {
            const request = {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: 'convert_place_to_shapefile_geometry',
                    arguments: {
                        place_name: testCase.place
                    }
                },
                id: Date.now()
            };

            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                console.error(`❌ HTTP error! status: ${response.status}`);
                const text = await response.text();
                console.error('Response:', text.substring(0, 200));
                continue;
            }

            const contentType = response.headers.get('content-type');
            console.log('Content-Type:', contentType);

            if (contentType && contentType.includes('text/event-stream')) {
                // Handle SSE response
                const text = await response.text();
                const lines = text.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.result) {
                                console.log('✅ Success!');
                                console.log('Result:', JSON.stringify(data.result, null, 2).substring(0, 500));
                                
                                if (data.result.content && data.result.content[0]) {
                                    const content = data.result.content[0];
                                    if (content.text) {
                                        const parsed = JSON.parse(content.text);
                                        if (parsed.geometry) {
                                            console.log(`  - Geometry type: ${parsed.geometry.type}`);
                                            console.log(`  - Area: ${parsed.area_km2?.toFixed(2)} km²`);
                                            console.log(`  - Source: ${parsed.source}`);
                                        }
                                    }
                                }
                            } else if (data.error) {
                                console.error('❌ Error:', data.error);
                            }
                        } catch (e) {
                            // Skip non-JSON lines
                        }
                    }
                }
            } else {
                // Handle regular JSON response
                const data = await response.json();
                console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
            }

        } catch (error) {
            console.error(`❌ Error testing ${testCase.place}:`, error.message);
        }
    }
}

// Run the test
console.log('Earth Engine MCP Shapefile Tool Test');
console.log('=====================================');
testShapefileTool().then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
