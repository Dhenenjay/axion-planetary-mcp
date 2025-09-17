#!/usr/bin/env node

/**
 * Production start script for Next.js on Render
 * Simple wrapper to handle PORT environment variable
 */

const { spawn } = require('child_process');

// Get PORT from environment or use default
const port = process.env.PORT || '3000';
process.env.NODE_ENV = 'production';

console.log(`Starting Next.js production server on port ${port}...`);

// Start Next.js with the specified port
const next = spawn('npx', ['next', 'start', '-p', port], {
    stdio: 'inherit',
    env: process.env,
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
