import ee from '@google/earthengine';

export function exportImageToGCS(params: {image: any, description:string, bucket:string, fileNamePrefix:string, region:any, scale?:number, crs?:string}){
  const exportParams: any = {
    image: params.image, description: params.description, bucket: params.bucket,
    fileNamePrefix: params.fileNamePrefix, region: params.region
  };
  if (params.scale !== undefined) exportParams.scale = params.scale;
  if (params.crs !== undefined) exportParams.crs = params.crs;
  const task = ee.batch.Export.image.toCloudStorage(exportParams);
  task.start();
  // @ts-ignore
  return { taskId: task.id };
}
export function getTaskStatus(taskId: string){
  // @ts-ignore
  const status = ee.data.getTaskStatus(taskId)?.[0] ?? {};
  return { state: status.state, errorMessage: status.error_message, progress: status.progress };
}
