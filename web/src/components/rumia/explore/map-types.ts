/** A search result that has usable coordinates, reduced to what the map needs. */
export interface MapPoint {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  price?: string | null;
}
