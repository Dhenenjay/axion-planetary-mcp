#!/usr/bin/env node

/**
 * Production start script for Next.js on Render
 * Handles standalone Next.js server startup
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if standalone build exists
const standaloneServerPath = path.join(__dirname, '.next', 'standalone', 'server.js');
const regularServerPath = path.join(__dirname, 'node_modules', 'next', 'dist', 'server', 'next-server.js');

if (fs.existsSync(standaloneServerPath)) {
    console.log('Starting Next.js standalone server...');
    console.log(`Server path: ${standaloneServerPath}`);
    
    // Set environment variables
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    process.env.PORT = process.env.PORT || '3000';
    process.env.HOSTNAME = '0.0.0.0';
    
    // Start the standalone server
    require(standaloneServerPath);
} else {
    console.log('Standalone build not found, using next start...');
    
    // Fallback to next start
    const next = spawn('npx', ['next', 'start', '-p', process.env.PORT || '3000'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' },
        shell: true
    });
    
    next.on('error', (err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
    
    next.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Server exited with code ${code}`);
            process.exit(code);
        }
    });
}