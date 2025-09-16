declare module '@google/earthengine' {
  export class Image {
    constructor(args?: any);
    select(bands: string | string[]): Image;
    clip(geometry: Geometry): Image;
    updateMask(mask: Image): Image;
    bandNames(): any;
    getInfo(callback?: Function, errorCallback?: Function): any;
    reduceRegion(params: any): any;
    reduceRegions(params: any): any;
    reproject(params: any): Image;
    projection(): any;
    subtract(image: Image): Image;
    add(value: number | Image): Image;
    multiply(value: number | Image): Image;
    divide(value: number | Image): Image;
    normalizedDifference(bands: string[]): Image;
    expression(expression: string, map?: any): Image;
    rename(names: string | string[]): Image;
    toArray(): any;
    addBands(image: Image): Image;
    bitwiseAnd(value: number): Image;
    eq(value: number): Image;
    neq(value: number): Image;
    gt(value: number): Image;
    lt(value: number): Image;
    and(image: Image): Image;
    not(): Image;
    or(image: Image): Image;
    selfMask(): Image;
    set(key: string, value: any): Image;
    date(): any;
    metadata(key: string): any;
    getThumbURL(params: any): string;
    getMap(visParams: any): { mapid: string; urlFormat: string };
    static loadGeoTIFF(url: string): Image;
  }

  export class ImageCollection {
    constructor(args?: any);
    filterDate(start: string, end: string): ImageCollection;
    filterBounds(geometry: Geometry): ImageCollection;
    filter(filter: Filter): ImageCollection;
    filterMetadata(property: string, operator: string, value: any): ImageCollection;
    select(bands: string | string[]): ImageCollection;
    first(): Image;
    size(): any;
    median(): Image;
    mean(): Image;
    min(): Image;
    max(): Image;
    mosaic(): Image;
    map(func: Function): ImageCollection;
    aggregate_array(property: string): any;
    reduceRegions(params: any): FeatureCollection;
    getInfo(callback?: Function, errorCallback?: Function): any;
  }

  export class Geometry {
    constructor(geoJson?: any, proj?: any);
    buffer(distance: number): Geometry;
    static Point(coords: number[], proj?: any): Geometry;
    static Polygon(coords: any, proj?: any): Geometry;
  }

  export class Feature {
    constructor(geometry?: Geometry, properties?: any);
    geometry(): Geometry;
  }

  export class FeatureCollection {
    constructor(features: any);
    geometry(): Geometry;
    size(): any;
  }

  export class Filter {
    static eq(name: string, value: any): Filter;
    static lt(name: string, value: any): Filter;
    static and(...filters: Filter[]): Filter;
    static dayOfYear(start: number, end: number): Filter;
  }

  export class Reducer {
    static mean(): Reducer;
    static stdDev(): Reducer;
    static sum(): Reducer;
    static centeredCovariance(): Reducer;
    combine(params: { reducer2: Reducer; sharedInputs?: boolean }): Reducer;
  }

  export class List {
    constructor(list: any[]);
    map(func: Function): List;
    distinct(): List;
    getInfo(): any;
  }

  export class Dictionary {
    constructor(dict: any);
    get(key: string): any;
    values(keys?: any): any;
  }

  export class Array {
    constructor(values: any);
    static constant(values: any): Array;
    slice(axis: number, start: number, end?: number): Array;
    eigen(): Array;
    getInfo(): any;
  }

  export namespace Terrain {
    function products(dem: Image): Image;
    function hillshade(dem: Image, azimuth?: number, elevation?: number): Image;
  }

  export namespace Classifier {
    function smileCart(): any;
  }

  export namespace batch {
    export namespace Export {
      export namespace image {
        function toCloudStorage(params: {
          image: Image;
          description: string;
          bucket: string;
          fileNamePrefix: string;
          region: any;
          scale?: number;
          crs?: string;
          maxPixels?: number;
        }): { start: () => void; id: string };
      }
    }
  }

  export namespace data {
    function authenticateViaPrivateKey(
      privateKey: any,
      callback: () => void,
      errorCallback?: (error: any) => void
    ): void;
    function getTaskStatus(taskId: string): any[];
  }

  function initialize(
    baseurl?: string | null,
    tileurl?: string | null,
    callback?: () => void,
    errorCallback?: (error: any) => void
  ): void;

  const ee: {
    Image: typeof Image;
    ImageCollection: typeof ImageCollection;
    Geometry: typeof Geometry;
    Feature: typeof Feature;
    FeatureCollection: typeof FeatureCollection;
    Filter: typeof Filter;
    Reducer: typeof Reducer;
    List: typeof List;
    Dictionary: typeof Dictionary;
    Array: typeof Array;
    Terrain: typeof Terrain;
    Classifier: typeof Classifier;
    batch: typeof batch;
    data: typeof data;
    initialize: typeof initialize;
  };

  export default ee;
}
