// Debug test to see raw SSE response
const API_URL = 'http://localhost:3000/api/mcp/sse';

async function debugTest() {
    console.log('Testing raw SSE response...\n');
    
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
        console.log('Raw response (first 500 chars):');
        console.log(text.substring(0, 500));
        console.log('\n---\n');
        
        // Try to parse each line
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            if (line.trim()) {
                console.log(`Line ${i}: ${line.substring(0, 100)}`);
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        console.log('  Parsed:', JSON.stringify(data).substring(0, 200));
                    } catch (e) {
                        console.log('  Parse error:', e.message);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugTest();