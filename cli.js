#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log();
  log('═'.repeat(60), 'cyan');
  log(`  ${message}`, 'bright');
  log('═'.repeat(60), 'cyan');
  console.log();
}

function subheader(message) {
  console.log();
  log(`▸ ${message}`, 'yellow');
  log('─'.repeat(50), 'cyan');
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

function checkEarthEngineSetup() {
  header('Checking Earth Engine Setup');
  
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                 join(homedir(), '.config', 'earthengine', 'credentials.json');
  
  if (existsSync(keyPath)) {
    success(`Earth Engine credentials found at: ${keyPath}`);
    return true;
  } else {
    warn('Earth Engine credentials not found!');
    console.log();
    info('To set up Earth Engine authentication:');
    console.log();
    log('  1. Go to https://console.cloud.google.com/', 'white');
    log('  2. Create a new project or select existing one', 'white');
    log('  3. Enable Earth Engine API', 'white');
    log('  4. Create a service account and download JSON key', 'white');
    log('  5. Save the key to one of these locations:', 'white');
    log(`     • ${join(homedir(), '.config', 'earthengine', 'credentials.json')}`, 'cyan');
    log(`     • Set GOOGLE_APPLICATION_CREDENTIALS env variable`, 'cyan');
    console.log();
    return false;
  }
}

function getPackageRoot() {
  // Check if we're in development (cli.js exists in current dir)
  if (existsSync(join(process.cwd(), 'package.json'))) {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    if (pkg.name === 'axion-planetary-mcp') {
      return process.cwd();
    }
  }
  
  // Check if we're installed globally or locally in node_modules
  const possiblePaths = [
    join(__dirname), // Same directory as cli.js
    join(__dirname, '..'), // Parent directory
    join(process.cwd(), 'node_modules', 'axion-planetary-mcp'),
    join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'axion-planetary-mcp'),
    join(homedir(), '.npm-global', 'lib', 'node_modules', 'axion-planetary-mcp'),
    '/usr/local/lib/node_modules/axion-planetary-mcp',
    '/usr/lib/node_modules/axion-planetary-mcp'
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(join(path, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf-8'));
        if (pkg.name === 'axion-planetary-mcp') {
          return path;
        }
      } catch {}
    }
  }
  
  // Fallback to __dirname
  return __dirname;
}

function generateConfig() {
  header('Generating MCP Configuration');
  
  const packageRoot = getPackageRoot();
  const mcpServerPath = join(packageRoot, 'mcp-sse-complete.cjs');
  
  if (!existsSync(mcpServerPath)) {
    error(`MCP server not found at: ${mcpServerPath}`);
    warn('Please ensure the package is properly installed');
    return null;
  }
  
  success(`Package root found: ${packageRoot}`);
  
  const config = {
    mcpServers: {
      "axion-planetary": {
        command: "node",
        args: [mcpServerPath.replace(/\\/g, '/')],
        env: {}
      }
    }
  };
  
  // Add Earth Engine credentials if found
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                 join(homedir(), '.config', 'earthengine', 'credentials.json');
  
  if (existsSync(keyPath)) {
    config.mcpServers["axion-planetary"].env.GOOGLE_APPLICATION_CREDENTIALS = keyPath.replace(/\\/g, '/');
  }
  
  return { config, packageRoot };
}

function showClaudeConfig(config) {
  subheader('MCP Client Configuration');
  
  info('Add this to your MCP client config:');
  console.log();
  
  const configPath = process.platform === 'win32'
    ? join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
    : process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
  
  log(`Config file location (Claude Desktop): ${configPath}`, 'cyan');
  log('For other MCP clients, check their documentation for config location', 'blue');
  console.log();
  log('Configuration to add:', 'yellow');
  console.log();
  console.log(JSON.stringify(config, null, 2));
  console.log();
}

function showNextJsInstructions(packageRoot) {
  header('🚀 IMPORTANT: Start the Next.js Web Server');
  
  warn('The MCP server requires the Next.js backend to be running!');
  console.log();
  info('The Next.js server provides:');
  log('  • Web interface for map visualization', 'white');
  log('  • Backend API for consolidated tools', 'white');
  log('  • Real-time processing of Earth Engine data', 'white');
  console.log();
  
  log('═════════════════════════════════════════════', 'yellow');
  log('  STEP 1: Open a NEW terminal window', 'bright');
  log('═════════════════════════════════════════════', 'yellow');
  console.log();
  
  log('  Then run these commands:', 'cyan');
  console.log();
  
  if (process.platform === 'win32') {
    log('  Windows (PowerShell):', 'yellow');
    log(`    cd "${packageRoot}"`, 'bright');
    log('    npm run build:next', 'bright');
    log('    npm run start:next', 'bright');
  } else {
    log('  Mac/Linux:', 'yellow');
    log(`    cd "${packageRoot}"`, 'bright');
    log('    npm run build:next', 'bright');
    log('    npm run start:next', 'bright');
  }
  
  console.log();
  log('═════════════════════════════════════════════', 'yellow');
  log('  STEP 2: Keep the server running', 'bright');
  log('═════════════════════════════════════════════', 'yellow');
  console.log();
  
  success('Once started, the web interface will be at: http://localhost:3000');
  warn('Leave this terminal open while using your MCP client!');
  console.log();
  
  info('If port 3000 is busy, you can change it:');
  log('  PORT=3001 npm run start:next', 'cyan');
  console.log();
}

function showQuickStartGuide() {
  header('🎯 Quick Start Guide');
  
  log('After setup, follow these steps:', 'bright');
  console.log();
  
  log('1️⃣  Start the Next.js server (in a new terminal):', 'yellow');
  log('    See instructions above', 'cyan');
  console.log();
  
  log('2️⃣  Add the configuration to your MCP client:', 'yellow');
  log('    Copy the JSON config shown above', 'cyan');
  log('    Paste into your MCP client config file', 'cyan');
  console.log();
  
  log('3️⃣  Restart your MCP client completely:', 'yellow');
  log('    Quit and reopen the application', 'cyan');
  console.log();
  
  log('4️⃣  Test the connection in your MCP client:', 'yellow');
  log('    Try: "Show me NDVI for California"', 'cyan');
  log('    Or: "Create a crop classification for Iowa"', 'cyan');
  console.log();
}

function showUsageExamples() {
  header('📚 What You Can Do');
  
  info('Example prompts for your MCP client:');
  console.log();
  
  const categories = {
    'Vegetation Analysis': [
      'Analyze NDVI changes in California farmland',
      'Calculate EVI for Amazon rainforest regions',
      'Show vegetation stress in drought areas'
    ],
    'Crop Classification': [
      'Create crop classification model for Iowa',
      'Identify corn vs soybean fields in Nebraska',
      'Map agricultural land use in Texas'
    ],
    'Water Analysis': [
      'Monitor water levels in Lake Mead over time',
      'Detect water stress in agricultural regions',
      'Analyze coastal erosion patterns'
    ],
    'Urban Studies': [
      'Track urban expansion in Phoenix since 2020',
      'Analyze heat islands in major cities',
      'Monitor construction in developing areas'
    ],
    'Disaster Response': [
      'Assess wildfire damage in recent burns',
      'Monitor flood extent after heavy rains',
      'Evaluate drought impact on vegetation'
    ],
    'Advanced Features': [
      'Create custom training data for classification',
      'Generate time-series animations',
      'Export results to GeoTIFF format'
    ]
  };
  
  for (const [category, examples] of Object.entries(categories)) {
    log(`  ${category}:`, 'yellow');
    examples.forEach(example => {
      log(`    • "${example}"`, 'white');
    });
    console.log();
  }
}

function showTroubleshooting() {
  header('🔧 Troubleshooting Guide');
  
  log('Common Issues and Solutions:', 'yellow');
  console.log();
  
  log('❌ "MCP server not responding" in MCP client:', 'red');
  log('  ✓ Ensure Next.js server is running (npm run start:next)', 'green');
  log('  ✓ Check if port 3000 is accessible', 'green');
  log('  ✓ Restart your MCP client after config changes', 'green');
  log('  ✓ Verify the config path is correct in JSON', 'green');
  console.log();
  
  log('❌ Earth Engine authentication errors:', 'red');
  log('  ✓ Verify credentials.json exists and is valid', 'green');
  log('  ✓ Enable Earth Engine API in Google Cloud Console', 'green');
  log('  ✓ Check service account has Earth Engine permissions', 'green');
  log('  ✓ Set GOOGLE_APPLICATION_CREDENTIALS if needed', 'green');
  console.log();
  
  log('❌ Maps not showing in responses:', 'red');
  log('  ✓ Confirm Next.js server is running', 'green');
  log('  ✓ Visit http://localhost:3000 directly to test', 'green');
  log('  ✓ Check browser console for JavaScript errors', 'green');
  log('  ✓ Ensure map visualization is requested in prompt', 'green');
  console.log();
  
  log('❌ Installation problems:', 'red');
  log('  ✓ Use Node.js version 18 or higher', 'green');
  log('  ✓ Clear npm cache: npm cache clean --force', 'green');
  log('  ✓ Try global install: npm i -g axion-planetary-mcp', 'green');
  log('  ✓ On Windows, run terminal as Administrator', 'green');
  console.log();
  
  info('Still having issues? Visit:');
  log('  https://github.com/Dhenenjay/axion-planetary-mcp/issues', 'cyan');
  console.log();
}

function showSystemRequirements() {
  header('📋 System Requirements');
  
  info('Minimum Requirements:');
  log('  • Node.js 18.0 or higher', 'white');
  log('  • 4GB RAM (8GB recommended)', 'white');
  log('  • 2GB free disk space', 'white');
  log('  • Internet connection for Earth Engine API', 'white');
  console.log();
  
  info('Required Services:');
  log('  • Google Cloud Account (free tier works)', 'white');
  log('  • Earth Engine API enabled', 'white');
  log('  • Service Account with credentials', 'white');
  console.log();
  
  info('Supported MCP Clients:');
  log('  • Claude Desktop', 'white');
  log('  • Cline', 'white');
  log('  • Any MCP-compatible client', 'white');
  console.log();
}

async function main() {
  console.clear();
  
  log(` 
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║       🌍  AXION PLANETARY MCP - SETUP WIZARD  🛸       ║
    ║                                                          ║
    ║    Turn your MCP Client into a Geospatial Powerhouse    ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
  `, 'cyan');
  
  // Show system requirements first
  showSystemRequirements();
  
  // Check Earth Engine setup
  const hasEarthEngine = checkEarthEngineSetup();
  
  // Generate configuration
  const result = generateConfig();
  
  if (!result) {
    error('Failed to generate configuration');
    console.log();
    warn('Please ensure the package is installed correctly:');
    log('  npm install -g axion-planetary-mcp', 'cyan');
    process.exit(1);
  }
  
  const { config, packageRoot } = result;
  
  // Show Claude configuration
  showClaudeConfig(config);
  
  // IMPORTANT: Show Next.js server instructions prominently
  showNextJsInstructions(packageRoot);
  
  // Show quick start guide
  showQuickStartGuide();
  
  // Show usage examples
  showUsageExamples();
  
  // Show troubleshooting
  showTroubleshooting();
  
  header('✨ Setup Information Complete!');
  
  if (!hasEarthEngine) {
    console.log();
    warn('⚠️  IMPORTANT: Set up Earth Engine credentials before using!');
    info('See instructions above for credential setup');
  }
  
  console.log();
  log('═══════════════════════════════════════════════════════', 'green');
  log('  NEXT STEPS:', 'bright');
  log('═══════════════════════════════════════════════════════', 'green');
  console.log();
  success('1. Start Next.js server (REQUIRED):');
  log(`     cd "${packageRoot}"`, 'cyan');
  log('     npm run build:next && npm run start:next', 'cyan');
  console.log();
  success('2. Configure your MCP client with the JSON above');
  console.log();
  success('3. Restart your MCP client');
  console.log();
  success('4. Start analyzing Earth data!');
  console.log();
  
  info('Documentation: https://github.com/Dhenenjay/axion-planetary-mcp');
  info('Support: https://github.com/Dhenenjay/axion-planetary-mcp/issues');
  console.log();
}

// Run the setup wizard
main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});