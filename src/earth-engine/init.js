const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

let isInitialized = false;

/**
 * Initialize Earth Engine with service account credentials
 * @param {string} keyPath - Path to the service account JSON file
 * @returns {Promise<void>}
 */
async function initializeEarthEngine(keyPath) {
  if (isInitialized) {
    return;
  }

  try {
    // Read the service account key
    const keyFilePath = path.resolve(keyPath);
    if (!fs.existsSync(keyFilePath)) {
      throw new Error(`Service account key file not found: ${keyFilePath}`);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));

    // Initialize Earth Engine with the service account
    await new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        serviceAccount,
        () => {
          ee.initialize(
            null,
            null,
            () => {
              isInitialized = true;
              console.error('[Earth Engine] Initialized successfully');
              resolve();
            },
            (error) => {
              console.error('[Earth Engine] Initialization error:', error);
              reject(error);
            }
          );
        },
        (error) => {
          console.error('[Earth Engine] Authentication error:', error);
          reject(error);
        }
      );
    });
  } catch (error) {
    console.error('[Earth Engine] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get Earth Engine instance (ensures it's initialized)
 * @returns {object} Earth Engine API object
 */
function getEarthEngine() {
  if (!isInitialized) {
    throw new Error('Earth Engine not initialized. Call initializeEarthEngine() first.');
  }
  return ee;
}

module.exports = {
  initializeEarthEngine,
  getEarthEngine,
  ee
};
