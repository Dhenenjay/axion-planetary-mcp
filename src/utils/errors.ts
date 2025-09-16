export class AppError extends Error {
  code: string; details?: any;
  constructor(code: string, message: string, details?: any){ super(message); this.code=code; this.details=details; }
}
export const Guards = {
  checkMaxPixels(maxPixels?: number){ if(maxPixels && maxPixels>1e9) throw new AppError('MAX_PIXELS','maxPixels too large',{maxPixels}); },
  checkBandCount(bands?: string[]){ if(bands && bands.length>20) throw new AppError('BANDS_LIMIT','Too many bands',{count: bands.length}); },
};
export function toSafeMessage(e: any){
  if(e instanceof AppError){ return { code:e.code, message:e.message, details:e.details}; }
  return { code:'UNKNOWN', message: e?.message ?? 'Unknown error' };
}
