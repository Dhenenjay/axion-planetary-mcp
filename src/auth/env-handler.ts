// Handle Earth Engine credentials from environment for production deployment

export function getEarthEngineCredentials(): any {
  // Priority 1: JSON string in environment variable (for Render deployment)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      console.log('[Auth] Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
      const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      
      // Set project ID and email for other parts of the app
      process.env.GCP_PROJECT_ID = creds.project_id;
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = creds.client_email;
      
      return creds;
    } catch (error) {
      console.error('[Auth] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
    }
  }
  
  // Priority 2: File path in environment variable
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[Auth] Using credentials from file path:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    // Return null to indicate file-based auth should be used
    return null;
  }
  
  // Priority 3: Return null to use existing auth methods
  return null;
}