import { z } from 'zod';

const EnvSchema = z.object({
  GEE_SA_EMAIL: z.string().min(3),
  GEE_SA_KEY_JSON: z.string().min(10), // base64 of SA JSON
  GCP_PROJECT_ID: z.string().min(3),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

// For development, use defaults if not provided
export const env = EnvSchema.parse({
  GEE_SA_EMAIL: process.env.GEE_SA_EMAIL || 'development@example.com',
  GEE_SA_KEY_JSON: process.env.GEE_SA_KEY_JSON || Buffer.from(JSON.stringify({
    type: 'service_account',
    project_id: 'development',
    private_key_id: 'dev',
    private_key: '-----BEGIN PRIVATE KEY-----\nDEVELOPMENT\n-----END PRIVATE KEY-----',
    client_email: 'development@example.com',
    client_id: 'dev',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/dev'
  })).toString('base64'),
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'development',
  REDIS_URL: process.env.REDIS_URL,
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
});

export function decodeSaJson(): Record<string, any> {
  return JSON.parse(Buffer.from(env.GEE_SA_KEY_JSON, 'base64').toString('utf8'));
}
