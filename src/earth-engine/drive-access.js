const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Initialize Google Drive API with service account credentials
 * @param {string} keyPath - Path to service account JSON key file
 * @returns {object} Drive API client
 */
async function initializeDriveAPI(keyPath) {
  // Create JWT client using keyFile path
  const auth = new google.auth.JWT({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  // Authorize
  await auth.authorize();
  
  // Create Drive API client
  const drive = google.drive({ version: 'v3', auth });
  
  return drive;
}

/**
 * List files in service account's Drive
 * @param {string} keyPath - Path to service account JSON key file
 * @param {string} folderName - Optional folder name to filter
 * @returns {Promise<array>} List of files
 */
async function listDriveFiles(keyPath, folderName = null) {
  try {
    const drive = await initializeDriveAPI(keyPath);
    
    // Build query
    let query = "mimeType != 'application/vnd.google-apps.folder'";
    if (folderName) {
      // First, find the folder ID
      const folderResponse = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)'
      });
      
      if (folderResponse.data.files.length > 0) {
        const folderId = folderResponse.data.files[0].id;
        query = `'${folderId}' in parents`;
      }
    }
    
    // List files
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, size, createdTime, mimeType, webContentLink, webViewLink)',
      orderBy: 'createdTime desc',
      pageSize: 100
    });
    
    return response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size ? `${Math.round(file.size / (1024 * 1024))} MB` : 'Unknown',
      created: file.createdTime,
      mimeType: file.mimeType,
      downloadLink: file.webContentLink,
      viewLink: file.webViewLink
    }));
    
  } catch (error) {
    console.error('Error listing Drive files:', error);
    throw error;
  }
}

/**
 * Download file from service account's Drive
 * @param {string} keyPath - Path to service account JSON key file
 * @param {string} fileId - File ID or name to download
 * @param {string} outputPath - Local path to save the file
 * @returns {Promise<object>} Download result
 */
async function downloadFromDrive(keyPath, fileId, outputPath) {
  try {
    const drive = await initializeDriveAPI(keyPath);
    
    // If fileId looks like a name, search for it first
    let actualFileId = fileId;
    if (!fileId.match(/^[a-zA-Z0-9_-]{20,}/)) {
      // Search by name
      const searchResponse = await drive.files.list({
        q: `name='${fileId}'`,
        fields: 'files(id, name)',
        pageSize: 1
      });
      
      if (searchResponse.data.files.length === 0) {
        throw new Error(`File not found: ${fileId}`);
      }
      
      actualFileId = searchResponse.data.files[0].id;
    }
    
    // Get file metadata
    const metadata = await drive.files.get({
      fileId: actualFileId,
      fields: 'id, name, size, mimeType'
    });
    
    // Download file
    const dest = fs.createWriteStream(outputPath);
    const response = await drive.files.get(
      { fileId: actualFileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          resolve({
            status: 'Downloaded successfully',
            fileName: metadata.data.name,
            fileSize: metadata.data.size ? `${Math.round(metadata.data.size / (1024 * 1024))} MB` : 'Unknown',
            savedTo: outputPath,
            mimeType: metadata.data.mimeType
          });
        })
        .on('error', err => {
          reject(err);
        })
        .pipe(dest);
    });
    
  } catch (error) {
    console.error('Error downloading from Drive:', error);
    throw error;
  }
}

/**
 * Get download URL for a file in service account's Drive
 * @param {string} keyPath - Path to service account JSON key file
 * @param {string} fileName - Name of the file
 * @returns {Promise<object>} File information with download URL
 */
async function getFileDownloadUrl(keyPath, fileName) {
  try {
    const drive = await initializeDriveAPI(keyPath);
    
    // Search for file by name
    const response = await drive.files.list({
      q: `name='${fileName}'`,
      fields: 'files(id, name, size, createdTime, webContentLink)',
      pageSize: 1
    });
    
    if (response.data.files.length === 0) {
      return {
        found: false,
        message: `File not found: ${fileName}`,
        suggestion: 'The export may still be processing. Check again in a few minutes.'
      };
    }
    
    const file = response.data.files[0];
    
    // Generate a temporary download URL
    const downloadUrl = await drive.files.get({
      fileId: file.id,
      alt: 'media'
    }, {
      responseType: 'stream'
    }).then(res => {
      // This is the direct download URL
      return `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    });
    
    return {
      found: true,
      fileName: file.name,
      fileId: file.id,
      size: file.size ? `${Math.round(file.size / (1024 * 1024))} MB` : 'Unknown',
      created: file.createdTime,
      downloadUrl: file.webContentLink || downloadUrl,
      directUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
      note: 'Use service account credentials to download programmatically'
    };
    
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
}

/**
 * Monitor export task and download when complete
 * @param {string} keyPath - Path to service account JSON key file
 * @param {string} fileName - Expected file name
 * @param {string} outputPath - Local path to save when ready
 * @param {number} maxWaitMinutes - Maximum time to wait in minutes
 * @returns {Promise<object>} Download result
 */
async function waitAndDownload(keyPath, fileName, outputPath, maxWaitMinutes = 30) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  const checkInterval = 30000; // Check every 30 seconds
  
  console.log(`Waiting for export to complete: ${fileName}`);
  console.log(`Will check every 30 seconds for up to ${maxWaitMinutes} minutes...`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check if file exists
      const fileInfo = await getFileDownloadUrl(keyPath, fileName);
      
      if (fileInfo.found) {
        console.log(`File found! Size: ${fileInfo.size}`);
        console.log('Downloading...');
        
        // Download the file
        const result = await downloadFromDrive(keyPath, fileInfo.fileId, outputPath);
        return result;
      }
      
      // Wait before next check
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`File not ready yet. Elapsed: ${elapsed}s`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
    } catch (error) {
      console.error('Error checking for file:', error.message);
    }
  }
  
  throw new Error(`Timeout: File ${fileName} was not available after ${maxWaitMinutes} minutes`);
}

/**
 * Create a folder in service account's Drive if it doesn't exist
 * @param {string} keyPath - Path to service account JSON key file
 * @param {string} folderName - Name of the folder to create
 * @returns {Promise<object>} Folder information
 */
async function createFolderIfNotExists(keyPath, folderName) {
  try {
    const drive = await initializeDriveAPI(keyPath);
    
    // Check if folder already exists
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1
    });
    
    if (searchResponse.data.files.length > 0) {
      // Folder exists
      return {
        exists: true,
        id: searchResponse.data.files[0].id,
        name: searchResponse.data.files[0].name,
        message: 'Folder already exists'
      };
    }
    
    // Create the folder
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name'
    });
    
    return {
      exists: false,
      created: true,
      id: folder.data.id,
      name: folder.data.name,
      message: 'Folder created successfully'
    };
    
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

module.exports = {
  initializeDriveAPI,
  listDriveFiles,
  downloadFromDrive,
  getFileDownloadUrl,
  waitAndDownload,
  createFolderIfNotExists
};
