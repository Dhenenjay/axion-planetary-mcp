// Model caching for TerraTorch
export class ModelCache {
  private models = new Map<string, any>();

  set(modelName: string, model: any): void {
    this.models.set(modelName, model);
  }

  get(modelName: string): any | null {
    return this.models.get(modelName) || null;
  }

  has(modelName: string): boolean {
    return this.models.has(modelName);
  }

  clear(): void {
    this.models.clear();
  }
}

export const modelCache = new ModelCache();
