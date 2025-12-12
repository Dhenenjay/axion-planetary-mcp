#!/usr/bin/env node

/**
 * Earth Engine MCP - Setup Verification Script
 * Run this to check if your configuration is correct
 */

const fs = require('fs');
const path = require('path');

console.log('\n====================================');
console.log('Earth Engine MCP - Setup Checker');
console.log('====================================\n');

let hasErrors = false;

// Check 1: .env.local file exists
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found');
  console.log('   → Copy .env.example to .env.local and update it');
  hasErrors = true;
} else {
  console.log('✅ .env.local file found');
  
  // Load environment variables
  try {
    require('dotenv').config({ path: envPath });
  } catch (e) {
    // If dotenv is not installed, manually parse the .env file
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    });
  }
  
  // Check 2: Service account key path is set
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || keyPath === 'YOUR_SERVICE_ACCOUNT_KEY_PATH_HERE') {
    console.log('❌ Service account key path not configured');
    console.log('   → Edit .env.local and set GOOGLE_APPLICATION_CREDENTIALS');
    hasErrors = true;
  } else {
    console.log('✅ Service account key path configured:', keyPath);
    
    // Check 3: Service account key file exists
    if (!fs.existsSync(keyPath)) {
      console.log('❌ Service account key file not found at:', keyPath);
      console.log('   → Make sure the file exists at this path');
      console.log('   → Or update the path in .env.local');
      hasErrors = true;
    } else {
      console.log('✅ Service account key file exists');
      
      // Check 4: Service account key is valid JSON
      try {
        const keyContent = fs.readFileSync(keyPath, 'utf-8');
        const key = JSON.parse(keyContent);
        
        // Check 5: Required fields exist
        if (!key.client_email || !key.private_key || !key.project_id) {
          console.log('❌ Service account key is missing required fields');
          console.log('   → Make sure it\'s a valid Earth Engine service account key');
          hasErrors = true;
        } else {
          console.log('✅ Service account key is valid');
          console.log('   Project ID:', key.project_id);
          console.log('   Service Account:', key.client_email);
        }
        
        // Check 6: Earth Engine API permissions
        if (key.client_email && !key.client_email.includes('gserviceaccount.com')) {
          console.log('⚠️  This doesn\'t look like a service account email');
          console.log('   → Make sure you\'re using a service account, not a user account');
        }
        
      } catch (error) {
        console.log('❌ Service account key is not valid JSON');
        console.log('   Error:', error.message);
        hasErrors = true;
      }
    }
  }
}

// Check 7: Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion < 18) {
  console.log('⚠️  Node.js version', nodeVersion, 'is outdated');
  console.log('   → Recommended: Node.js 18 or higher');
} else {
  console.log('✅ Node.js version:', nodeVersion);
}

// Check 8: Dependencies installed
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('❌ Dependencies not installed');
  console.log('   → Run: npm install');
  hasErrors = true;
} else {
  console.log('✅ Dependencies installed');
}

// Summary
console.log('\n====================================');
if (hasErrors) {
  console.log('❌ Setup incomplete - fix the issues above');
  console.log('\nQuick Setup Guide:');
  console.log('1. Copy .env.example to .env.local');
  console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path');
  console.log('3. Make sure the service account has Earth Engine API access');
  console.log('4. Run: npm install');
  console.log('5. Run: npm run dev');
} else {
  console.log('✅ Setup complete! You\'re ready to go!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Configure Claude Desktop (see README)');
  console.log('3. Use the Earth Engine tools in Claude!');
}
console.log('====================================\n');

process.exit(hasErrors ? 1 : 0);
