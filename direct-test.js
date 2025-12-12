const { callTool } = require('./src/mcp/server-consolidated');

async function test() {
    console.log('Testing Earth Engine MCP Server...\n');
    
    // Set environment
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json';
    
    try {
        // Test 1: Authentication
        console.log('1. Testing authentication...');
        const authResult = await callTool('earth_engine_system', {
            operation: 'auth',
            checkType: 'status'
        });
        console.log('   Auth result:', authResult.authenticated ? '✓ Authenticated' : '✗ Not authenticated');
        
        // Test 2: Search
        console.log('\n2. Testing data search...');
        const searchResult = await callTool('earth_engine_data', {
            operation: 'search',
            query: 'sentinel',
            limit: 3
        });
        console.log('   Found datasets:', searchResult.count || 0);
        
        // Test 3: Geometry
        console.log('\n3. Testing geometry lookup...');
        const geoResult = await callTool('earth_engine_data', {
            operation: 'geometry',
            placeName: 'San Francisco'
        });
        console.log('   Geometry result:', geoResult.success ? '✓ Found' : '✗ Not found');
        
        console.log('\n✓ All tests completed!');
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
}

test();
