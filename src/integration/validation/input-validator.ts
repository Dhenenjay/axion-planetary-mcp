// Input validation for tools
export class InputValidator {
  static validateDuckDBQuery(args: any): void {
    if (!args.query || typeof args.query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    // Prevent dangerous SQL operations
    const dangerous = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER'];
    const upperQuery = args.query.toUpperCase();
    
    for (const keyword of dangerous) {
      if (upperQuery.includes(keyword)) {
        throw new Error(`Dangerous SQL keyword not allowed: ${keyword}`);
      }
    }
  }

  static validateTerraTorchInference(args: any): void {
    if (!args.data) {
      throw new Error('Data is required for inference');
    }

    if (args.model && !['prithvi', 'satmae'].includes(args.model)) {
      throw new Error('Invalid model. Must be "prithvi" or "satmae"');
    }
  }

  static validateIntegratedAnalysis(args: any): void {
    if (!args.dataset || typeof args.dataset !== 'string') {
      throw new Error('Dataset must be a non-empty string');
    }

    if (!args.region || typeof args.region !== 'object') {
      throw new Error('Region must be an object');
    }
  }
}
