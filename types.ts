
export interface ConvertedImage {
  id: string;
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ConversionStats {
  totalPages: number;
  processedPages: number;
  fileName: string;
  fileSize: number;
}
