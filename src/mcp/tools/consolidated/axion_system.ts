import { register, z } from '../../registry';
import { AWS_REGION, STAC_ENDPOINT, EXPORTS_BUCKET } from '@/src/utils/aws-config';
import axios from 'axios';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { s3 } from '@/src/aws/s3/client';

const SystemSchema = z.object({
  operation: z.enum(['auth', 'health', 'info', 'help'])
});

type Params = z.infer<typeof SystemSchema>;

register({
  name: 'axion_system',
  description: 'AWS system tool: auth/health/info for Axion AWS stack',
  input: SystemSchema,
  output: z.any(),
  handler: async (params: Params) => {
    switch (params.operation) {
      case 'auth': {
        // Basic env + S3 bucket check
        let s3Ok = false;
        let s3Error: string | undefined;
        try {
          if (EXPORTS_BUCKET) {
            await s3.send(new HeadBucketCommand({ Bucket: EXPORTS_BUCKET }));
            s3Ok = true;
          }
        } catch (e: any) {
          s3Error = e?.name || e?.message || String(e);
        }
        return {
          success: true,
          awsRegion: AWS_REGION,
          stacEndpoint: STAC_ENDPOINT,
          exportsBucket: EXPORTS_BUCKET,
          s3Access: s3Ok,
          s3Error,
          message: s3Ok ? 'S3 access verified' : 'S3 not verified yet'
        };
      }
      case 'health': {
        // STAC ping + env
        let stacOk = false;
        let stacError: string | undefined;
        try {
          const resp = await axios.get(STAC_ENDPOINT, { timeout: 5000 });
          stacOk = resp.status >= 200 && resp.status < 400;
        } catch (e: any) {
          stacError = e?.message || String(e);
        }
        return {
          success: true,
          status: stacOk ? 'ok' : 'degraded',
          timestamp: new Date().toISOString(),
          checks: {
            env: !!AWS_REGION && !!STAC_ENDPOINT,
            stac: stacOk,
            stacError
          }
        };
      }
      case 'info':
        return {
          success: true,
          runtime: process.version,
          platform: process.platform,
          memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          region: AWS_REGION,
          stac: STAC_ENDPOINT
        };
      case 'help':
      default:
        return {
          success: true,
          operations: {
            auth: 'Validate AWS env + S3 access',
            health: 'Ping STAC endpoint and report environment status',
            info: 'Runtime and configuration info'
          }
        };
    }
  }
});
