#!/usr/bin/env tsx
import { writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, CreateTableCommand, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { AWS_REGION } from '@/src/utils/aws-config';

function randSuffix() { return Math.floor(Math.random() * 1e9).toString(36); }
const timestamp = new Date().toISOString().replace(/[-:TZ\.]/g, '').slice(0,14);

async function ensureBucket(s3: S3Client, name: string){
  try{
    const input: any = { Bucket: name };
    if (AWS_REGION !== 'us-east-1') {
      input.CreateBucketConfiguration = { LocationConstraint: AWS_REGION };
    }
    await s3.send(new CreateBucketCommand(input));
    return { created: true, name };
  }catch(e:any){
    const msg = String(e?.name||e?.message||e);
    if(msg.includes('BucketAlreadyOwnedByYou')) return { created:false, name };
    if(msg.includes('BucketAlreadyExists')){
      return { created:false, name: name+'-'+randSuffix() };
    }
    throw e;
  }
}

async function ensureTable(ddb: DynamoDBClient, params: any){
  try{ await ddb.send(new CreateTableCommand(params)); return { created:true, name: params.TableName }; }
  catch(e){ if(e instanceof ResourceInUseException){ return { created:false, name: params.TableName }; } throw e; }
}

(async()=>{
  const s3 = new S3Client({ region: AWS_REGION });
  const ddb = new DynamoDBClient({ region: AWS_REGION });

  const suffix = `${timestamp}-${randSuffix()}`;
  let exportsBucket = `axion-exports-usw2-${suffix}`;
  let tilesBucket = `axion-tiles-usw2-${suffix}`;
  let boundariesBucket = `axion-boundaries-usw2-${suffix}`;

  const e = await ensureBucket(s3, exportsBucket); exportsBucket = e.name;
  const t = await ensureBucket(s3, tilesBucket); tilesBucket = t.name;
  const b = await ensureBucket(s3, boundariesBucket); boundariesBucket = b.name;

  // DynamoDB tables
  await ensureTable(ddb, {
    TableName: 'axion-sessions',
    AttributeDefinitions: [{AttributeName:'session_id',AttributeType:'S'}],
    KeySchema: [{AttributeName:'session_id',KeyType:'HASH'}],
    BillingMode: 'PAY_PER_REQUEST'
  });
  await ensureTable(ddb, {
    TableName: 'axion-tasks',
    AttributeDefinitions: [{AttributeName:'task_id',AttributeType:'S'}],
    KeySchema: [{AttributeName:'task_id',KeyType:'HASH'}],
    BillingMode: 'PAY_PER_REQUEST'
  });
  await ensureTable(ddb, {
    TableName: 'axion-boundaries',
    AttributeDefinitions: [
      {AttributeName:'name',AttributeType:'S'},
      {AttributeName:'level',AttributeType:'S'}
    ],
    KeySchema: [
      {AttributeName:'name',KeyType:'HASH'},
      {AttributeName:'level',KeyType:'RANGE'}
    ],
    BillingMode: 'PAY_PER_REQUEST'
  });
  await ensureTable(ddb, {
    TableName: 'axion-cache',
    AttributeDefinitions: [{AttributeName:'cache_key',AttributeType:'S'}],
    KeySchema: [{AttributeName:'cache_key',KeyType:'HASH'}],
    BillingMode: 'PAY_PER_REQUEST'
  });

  // Write .env.local
  const envPath = resolve(process.cwd(), '.env.local');
  const lines = [
    `AWS_REGION=${AWS_REGION}`,
    `AXION_S3_EXPORTS_BUCKET=${exportsBucket}`,
    `AXION_STAC_ENDPOINT=https://earth-search.aws.element84.com/v1`
  ].join('\n') + '\n';

  if(!existsSync(envPath)) writeFileSync(envPath, lines); else appendFileSync(envPath, lines);

  // Output summary
  const summary = {
    region: AWS_REGION,
    exportsBucket, tilesBucket, boundariesBucket,
    tables: ['axion-sessions','axion-tasks','axion-boundaries','axion-cache']
  };
  console.log(JSON.stringify({ success:true, summary }, null, 2));
})();
