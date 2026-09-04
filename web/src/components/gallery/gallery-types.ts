export interface GalleryImage {
  id?: string;
  r2_url: string;
  category?: string;
  blur_data_url?: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
}

export type GalleryViewMode = 'hero' | 'grid' | 'carousel';
