declare module '@google/earthengine' {
  export namespace data {
    function authenticateViaPrivateKey(
      privateKey: any,
      success: () => void,
      error: (err: Error) => void
    ): void;
    
    function authenticateViaOauth(
      clientId: string,
      success?: () => void,
      error?: (err: Error) => void,
      extraScopes?: string[],
      onImmediateFailed?: () => void
    ): void;
    
    function getAssetRoots(callback: (roots: any) => void): void;
    
    function getTaskStatus(ids: string[], callback: (statusResponse: any) => void): void;

    export function getTaskList(arg0: {}, arg1: (taskList: any) => void) {
      throw new Error('Function not implemented.')
    }

    export function cancelTask(taskId: string, arg1: (response: any) => void) {
      throw new Error('Function not implemented.')
    }
  }
  
  export function initialize(
    opt_baseurl?: string | null,
    opt_tileurl?: string | null,
    opt_success?: (() => void) | null,
    opt_error?: ((e: Error) => void) | null
  ): void;
  
  export class Image {
    constructor(imageId: string);
    
    getMap(
      visParams: Record<string, any>,
      callback: (map: { url: string, mapId: string, token: string }) => void
    ): void;
    
    getInfo(callback: (info: any) => void): void;
    
    reduceRegion(params: {
      reducer: any,
      geometry: any,
      scale: number
    }): {
      getInfo: (callback: (stats: any) => void) => void
    };
    
    select(bandNames: string | string[]): Image;
    
    addBands(bands: Image | Image[]): Image;
    
    normalizedDifference(bandNames: string[]): Image;
    
    expression(expression: string, params?: Record<string, any>): Image;
    
    updateMask(mask: Image): Image;
    
    clip(geometry: Geometry): Image;
  }
  
  export class ImageCollection {
    constructor(collectionId: string);
    
    filterDate(start: Date | string, end: Date | string): ImageCollection;
    
    filterBounds(geometry: Geometry): ImageCollection;
    
    filterMetadata(property: string, operator: string, value: any): ImageCollection;
    
    map(algorithm: Function): ImageCollection;
    
    median(): Image;
    
    mean(): Image;
    
    min(): Image;
    
    max(): Image;
    
    mosaic(): Image;
    
    first(): Image;
    
    sort(property: string, ascending?: boolean): ImageCollection;
    
    reduce(reducer: any): Image;
    
    getInfo(callback: (info: any) => void): void;
    
    size(): {
      getInfo: (callback: (size: number) => void) => void
    };
  }
  
  export class FeatureCollection {
    constructor(collectionId: string);
    
    filterBounds(geometry: Geometry): FeatureCollection;
    
    filter(filter: Filter): FeatureCollection;
    
    getInfo(callback: (info: any) => void): void;
  }
  
  export class Feature {
    constructor(geometry: Geometry, properties?: Record<string, any>);
  }
  
  export class Geometry {
    constructor(geoJson: any);
    
    static Point(coords: [number, number]): Geometry;
    static MultiPoint(coords: [number, number][]): Geometry;
    static LineString(coords: [number, number][]): Geometry;
    static MultiLineString(coords: [number, number][][]): Geometry;
    static Polygon(coords: [number, number][][]): Geometry;
    static MultiPolygon(coords: [number, number][][][]): Geometry;
    static Rectangle(coords: [number, number, number, number]): Geometry;
    static BBox(west: number, south: number, east: number, north: number): Geometry;
  }
  
  export class Reducer {
    static mean(): any;
    static sum(): any;
    static stdDev(): any;
    static min(): any;
    static max(): any;
    static count(): any;
    static percentile(percentiles: number[]): any;
    static histogram(options?: { minBucketWidth?: number, maxBucketWidth?: number, maxBuckets?: number }): any;
  }
  
  export class Filter {
    static eq(name: string, value: any): Filter;
    static gt(name: string, value: any): Filter;
    static gte(name: string, value: any): Filter;
    static lt(name: string, value: any): Filter;
    static lte(name: string, value: any): Filter;
    static date(start: Date | string, end?: Date | string): Filter;
    static and(...filters: Filter[]): Filter;
    static or(...filters: Filter[]): Filter;
  }
  
  export class Date {
    constructor(date: string | number);
    
    format(format: string): {
      getInfo: (callback: (date: string) => void) => void
    };
    
    advance(count: number, unit: string): Date;
    
    difference(date: Date, unit: string): {
      getInfo: (callback: (diff: number) => void) => void
    };
  }
  
  export namespace Algorithms {
    namespace Landsat {
      function simpleCloudScore(image: Image): Image;
    }
    
    namespace Sentinel2 {
      function CDI(image: Image): Image;
    }
  }
  
  export namespace batch {
    namespace Export {
      namespace image {
        function toDrive(params: {
          image: Image,
          description: string,
          folder: string,
          fileNamePrefix: string,
          region: Geometry,
          scale: number,
          maxPixels?: number
        }): ExportTask;
        
        function toAsset(params: {
          image: Image,
          description: string,
          assetId: string,
          region: Geometry,
          scale: number,
          maxPixels?: number
        }): ExportTask;
        
        function toCloudStorage(params: {
          image: Image,
          description: string,
          bucket: string,
          fileNamePrefix: string,
          region: Geometry,
          scale: number,
          maxPixels?: number
        }): ExportTask;
      }
      
      namespace table {
        function toDrive(params: {
          collection: FeatureCollection,
          description: string,
          folder: string,
          fileNamePrefix: string,
          fileFormat?: string
        }): ExportTask;
      }
    }
  }
  
  export interface ExportTask {
    id: string;
    start(): void;
  }
  
  export namespace List {
    function sequence(start: number, end: number, step?: number): any;
  }
  
  export namespace Dictionary {
    function fromLists(keys: any, values: any): any;
  }
} 