// This file is temporarily disabled due to build issues
// It will be re-enabled once the MCP adapter issues are resolved

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Advanced route is disabled' }, { status: 503 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Advanced route is disabled' }, { status: 503 });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ message: 'Advanced route is disabled' }, { status: 503 });
}

/*
import {
  // Basic initialization
  initializeEarthEngine,
  
  // Collection operations
  getImageCollection,
  filterCollectionByDate,
  filterCollectionByBounds,
  filterCollectionByMetadata,
  
  // Image operations
  calculateIndex,
  applyCloudMask,
  createComposite,
  applyExpression,
  
  // Analysis
  timeSeriesAnalysis,
  
  // Export
  exportImageToDrive,
  getExportTaskStatus,
  getAllExportTasks,
  cancelExportTask,
  
  // Schemas
  PrivateKeySchema,
  DatasetIdSchema,
  CollectionIdSchema,
  DateSchema,
  BandNameSchema,
  BandNamesSchema,
  MethodSchema,
  ExpressionSchema,
  GeometrySchema,
  VisParamsSchema,
  ScaleSchema,
  TaskIdSchema,
  CloudThresholdSchema
} from "./advancedEarthEngineTools";

const handler = createMcpHandler(
  (server) => {
    // Re-export the basic initialization tool
    server.tool(
      "earthengine_initialize",
      "Initialize and authenticate with Google Earth Engine using a service account private key",
      { privateKeyJson: PrivateKeySchema },
      async ({ privateKeyJson }) => {
        const result = await initializeEarthEngine(privateKeyJson);
        
        if (result.success) {
          return {
            content: [{ type: "text", text: "Earth Engine initialized successfully!" }],
          };
        } else {
          return {
            content: [{ type: "text", text: `Failed to initialize Earth Engine: ${result.message}` }],
          };
        }
      }
    );

    // Tool to get an image collection
    server.tool(
      "earthengine_get_collection",
      "Get information about an Earth Engine image collection",
      { collectionId: CollectionIdSchema },
      async ({ collectionId }) => {
        try {
          const result = await getImageCollection(collectionId);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { type: "text", text: `Information for collection ${collectionId}:` },
              { type: "text", text: JSON.stringify(result, null, 2) }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error getting collection: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to filter a collection by date
    server.tool(
      "earthengine_filter_by_date",
      "Filter an Earth Engine image collection by date range",
      { 
        collectionId: CollectionIdSchema,
        startDate: DateSchema,
        endDate: DateSchema
      },
      async ({ collectionId, startDate, endDate }) => {
        try {
          const result = await filterCollectionByDate(collectionId, startDate, endDate);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Filtered collection ${collectionId} from ${startDate} to ${endDate}:` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error filtering collection: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to filter a collection by bounds
    server.tool(
      "earthengine_filter_by_bounds",
      "Filter an Earth Engine image collection by geographic bounds",
      { 
        collectionId: CollectionIdSchema,
        geometry: GeometrySchema
      },
      async ({ collectionId, geometry }) => {
        try {
          const result = await filterCollectionByBounds(collectionId, geometry);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Filtered collection ${collectionId} by geographic bounds:` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error filtering collection: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to filter a collection by metadata
    server.tool(
      "earthengine_filter_by_metadata",
      "Filter an Earth Engine image collection by a metadata property",
      { 
        collectionId: CollectionIdSchema,
        property: z.string().describe("Property name to filter by"),
        operator: z.string().describe("Operator for comparison (e.g., 'less_than', 'equals')"),
        value: z.any().describe("Value to compare against")
      },
      async ({ collectionId, property, operator, value }) => {
        try {
          const result = await filterCollectionByMetadata(collectionId, property, operator, value);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Filtered collection ${collectionId} by ${property} ${operator} ${value}:` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error filtering collection: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to calculate an index (e.g., NDVI)
    server.tool(
      "earthengine_calculate_index",
      "Calculate a normalized difference index (e.g., NDVI) for an image",
      { 
        imageId: DatasetIdSchema,
        bandA: BandNameSchema,
        bandB: BandNameSchema,
        visParams: VisParamsSchema
      },
      async ({ imageId, bandA, bandB, visParams = {} }) => {
        try {
          const result = await calculateIndex(imageId, bandA, bandB, visParams);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Calculated normalized difference index using bands ${bandA} and ${bandB}:` 
              },
              {
                type: "text",
                text: `Map URL: ${result.url}\nMap ID: ${result.mapId}\nToken: ${result.token}`
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error calculating index: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to apply a cloud mask
    server.tool(
      "earthengine_apply_cloud_mask",
      "Apply a cloud mask to a Landsat image",
      { 
        imageId: DatasetIdSchema,
        cloudThreshold: CloudThresholdSchema,
        visParams: VisParamsSchema
      },
      async ({ imageId, cloudThreshold, visParams = {} }) => {
        try {
          const result = await applyCloudMask(imageId, cloudThreshold, visParams);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Applied cloud mask with threshold ${cloudThreshold}:` 
              },
              {
                type: "text",
                text: `Map URL: ${result.url}\nMap ID: ${result.mapId}\nToken: ${result.token}`
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error applying cloud mask: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to create a composite
    server.tool(
      "earthengine_create_composite",
      "Create a composite image from a collection (median, mean, etc.)",
      { 
        collectionId: CollectionIdSchema,
        method: MethodSchema,
        startDate: DateSchema.optional(),
        endDate: DateSchema.optional(),
        geometry: GeometrySchema.optional(),
        cloudCoverMax: z.number().optional().describe("Maximum cloud cover percentage"),
        visParams: VisParamsSchema
      },
      async ({ collectionId, method, startDate, endDate, geometry, cloudCoverMax, visParams = {} }) => {
        try {
          const filterParams = {
            startDate,
            endDate,
            geometry,
            cloudCoverMax
          };
          
          const result = await createComposite(collectionId, method, filterParams, visParams);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Created ${method} composite from collection ${collectionId}:` 
              },
              {
                type: "text",
                text: `Map URL: ${result.url}\nMap ID: ${result.mapId}\nToken: ${result.token}`
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error creating composite: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to apply a custom expression
    server.tool(
      "earthengine_apply_expression",
      "Apply a custom band math expression to an image",
      { 
        imageId: DatasetIdSchema,
        expression: ExpressionSchema,
        visParams: VisParamsSchema
      },
      async ({ imageId, expression, visParams = {} }) => {
        try {
          const result = await applyExpression(imageId, expression, visParams);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Applied expression "${expression}" to image:` 
              },
              {
                type: "text",
                text: `Map URL: ${result.url}\nMap ID: ${result.mapId}\nToken: ${result.token}`
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error applying expression: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to run time series analysis
    server.tool(
      "earthengine_time_series",
      "Run a time series analysis on an image collection for a region",
      { 
        collectionId: CollectionIdSchema,
        geometry: GeometrySchema,
        startDate: DateSchema,
        endDate: DateSchema,
        bands: BandNamesSchema
      },
      async ({ collectionId, geometry, startDate, endDate, bands }) => {
        try {
          const result = await timeSeriesAnalysis(collectionId, geometry, startDate, endDate, bands);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Time series analysis for collection ${collectionId} from ${startDate} to ${endDate}:` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error in time series analysis: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to export an image to Google Drive
    server.tool(
      "earthengine_export_to_drive",
      "Export an Earth Engine image to Google Drive",
      { 
        imageId: DatasetIdSchema,
        description: z.string().describe("Description for the export task"),
        folder: z.string().describe("Google Drive folder name"),
        geometry: GeometrySchema,
        scale: ScaleSchema,
        maxPixels: z.number().optional().describe("Maximum number of pixels")
      },
      async ({ imageId, description, folder, geometry, scale, maxPixels }) => {
        try {
          const exportParams = {
            description,
            folder,
            region: geometry,
            scale: scale || 30, // Default to 30 meters if scale is undefined
            maxPixels
          };
          
          const result = await exportImageToDrive(imageId, exportParams);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Export task started:` 
              },
              {
                type: "text",
                text: `Task ID: ${result.taskId}\nStatus: ${result.status}\nDescription: ${result.description}`
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error exporting image: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to get export task status
    server.tool(
      "earthengine_task_status",
      "Get the status of an Earth Engine export task",
      { taskId: TaskIdSchema },
      async ({ taskId }) => {
        try {
          const result = await getExportTaskStatus(taskId);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Status for task ${taskId}:` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error getting task status: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to list all Earth Engine tasks
    server.tool(
      "earthengine_list_tasks",
      "Get a list of all Earth Engine export tasks",
      {},
      async () => {
        try {
          const result = await getAllExportTasks();
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Earth Engine tasks:` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error listing tasks: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );

    // Tool to cancel an Earth Engine task
    server.tool(
      "earthengine_cancel_task",
      "Cancel a running Earth Engine export task",
      { taskId: TaskIdSchema },
      async ({ taskId }) => {
        try {
          const result = await cancelExportTask(taskId);
          
          if ('error' in result) {
            return {
              content: [{ type: "text", text: `Error: ${result.message}` }],
            };
          }
          
          return {
            content: [
              { 
                type: "text", 
                text: `Task ${taskId} cancelled successfully.` 
              },
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
          };
        } catch (error) {
          return {
            content: [
              { 
                type: "text", 
                text: `Error cancelling task: ${error instanceof Error ? error.message : String(error)}` 
              }
            ],
          };
        }
      }
    );
  },
  {
    capabilities: {
      tools: {
        earthengine_initialize: {
          description: "Initialize and authenticate with Google Earth Engine using a service account private key",
        },
        earthengine_get_collection: {
          description: "Get information about an Earth Engine image collection",
        },
        earthengine_filter_by_date: {
          description: "Filter an Earth Engine image collection by date range",
        },
        earthengine_filter_by_bounds: {
          description: "Filter an Earth Engine image collection by geographic bounds",
        },
        earthengine_filter_by_metadata: {
          description: "Filter an Earth Engine image collection by a metadata property",
        },
        earthengine_calculate_index: {
          description: "Calculate a normalized difference index (e.g., NDVI) for an image",
        },
        earthengine_apply_cloud_mask: {
          description: "Apply a cloud mask to a Landsat image",
        },
        earthengine_create_composite: {
          description: "Create a composite image from a collection (median, mean, etc.)",
        },
        earthengine_apply_expression: {
          description: "Apply a custom band math expression to an image",
        },
        earthengine_time_series: {
          description: "Run a time series analysis on an image collection for a region",
        },
        earthengine_export_to_drive: {
          description: "Export an Earth Engine image to Google Drive",
        },
        earthengine_task_status: {
          description: "Get the status of an Earth Engine export task",
        },
        earthengine_list_tasks: {
          description: "Get a list of all Earth Engine export tasks",
        },
        earthengine_cancel_task: {
          description: "Cancel a running Earth Engine export task",
        },
      },
    },
  },
  {
    redisUrl: process.env.REDIS_URL,
    basePath: "",
    verboseLogs: true,
    maxDuration: 300, // Increased to 5 minutes for long-running operations
  }
);

export { handler as GET, handler as POST, handler as DELETE }; 
*/
