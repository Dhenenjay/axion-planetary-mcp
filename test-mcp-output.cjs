const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'axion-planetary-mcp', 'mcp-hosted.cjs');

const child = spawn('node', [scriptPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
  console.log('STDOUT:', JSON.stringify(data.toString()));
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
  console.log('STDERR:', JSON.stringify(data.toString()));
});

// Send the same sequence Claude sends
setTimeout(() => {
  const messages = [
    {"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"claude-ai","version":"0.1.0"}},"jsonrpc":"2.0","id":0},
    {"method":"initialized","jsonrpc":"2.0"},
    {"method":"tools/list","params":{},"jsonrpc":"2.0","id":1},
    {"method":"prompts/list","params":{},"jsonrpc":"2.0","id":2},
    {"method":"resources/list","params":{},"jsonrpc":"2.0","id":3}
  ];
  
  messages.forEach(msg => {
    child.stdin.write(JSON.stringify(msg) + '\n');
  });
}, 100);

setTimeout(() => {
  child.kill();
  console.log('\n=== FINAL OUTPUT ===');
  console.log('Total stdout lines:', stdout.split('\n').filter(l => l).length);
  console.log('Total stderr output:', stderr);
  process.exit(0);
}, 2000);