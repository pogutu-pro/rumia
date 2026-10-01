import { serverApi } from './server';

export interface ImageUploadRegistration {
  original_filename: string;
  width: number;
  height: number;
  file_size: number;
  format: string;
  thumbnail_key: string;
  small_key: string;
  medium_key: string;
  large_key: string;
}

export const imagesApi = {
  /** Server-only: record metadata for an image the pipeline already stored in R2. */
  registerUploadServer: (data: ImageUploadRegistration) =>
    serverApi.post<{ id: string }>('/images/uploads', data),
};
