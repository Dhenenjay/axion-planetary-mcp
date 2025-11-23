// Input sanitization
export class InputSanitizer {
  static sanitizeQuery(query: string): string {
    // Remove comments
    query = query.replace(/--.*$/gm, '');
    query = query.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Trim and normalize whitespace
    query = query.trim().replace(/\s+/g, ' ');
    
    return query;
  }

  static sanitizeIdentifier(identifier: string): string {
    // Remove non-alphanumeric characters except dots and dashes
    return identifier.replace(/[^a-zA-Z0-9.-]/g, '');
  }

  static sanitizePath(path: string): string {
    // Prevent path traversal
    path = path.replace(/\.\.\//g, '');
    path = path.replace(/\.\.\\/g, '');
    
    return path;
  }
}
