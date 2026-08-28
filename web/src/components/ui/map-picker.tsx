'use client';

import * as React from 'react';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { BrandedLoader } from '@/components/ui/branded-loader';
import { cn } from '@/lib/utils/cn';

interface LatLng {
  lat: number;
  lng: number;
}

interface MapPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  initialCenter: LatLng;
  currentLocation: LatLng;
  onLocationChange: (coords: LatLng) => void;
  zoom?: number;
  height?: string | number;
  mapId?: string;
}

/**
 * Enterprise-grade Location Picker.
 * Features a draggable AdvancedMarker and polished interactions.
 */
export function MapPicker({
  initialCenter,
  currentLocation,
  onLocationChange,
  zoom = 15,
  height = '400px',
  className,
  mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
  ...props
}: MapPickerProps) {
  const [isTilesLoaded, setIsTilesLoaded] = React.useState(false);

  // Synchronize internal state with dragged position
  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      onLocationChange({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  };

  return (
    <div
      className={cn('relative rounded-xl shadow-lg border border-border bg-muted overflow-hidden', className)}
      style={{ height, width: '100%' }}
      {...props}
    >
      {/* Branded Loading Overlay */}
      {!isTilesLoaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300">
          <BrandedLoader size={48} text="Loading Location..." />
        </div>
      )}

      <Map
        defaultCenter={initialCenter || currentLocation}
        defaultZoom={zoom}
        mapId={mapId}
        onTilesLoaded={() => setIsTilesLoaded(true)}
        disableDefaultUI={false}
        gestureHandling={'greedy'}
        reuseMaps={true}
        className="h-full w-full"
      >
        <AdvancedMarker
          position={currentLocation}
          draggable={true}
          onDragEnd={handleMarkerDragEnd}
        >
          <Pin
            background={'#007aff'}
            borderColor={'#005bb7'}
            glyphColor={'#ffffff'}
            scale={1.4}
          />
        </AdvancedMarker>
      </Map>

      {/* Helper Prompt */}
      {isTilesLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/90 backdrop-blur shadow-md border border-border rounded-full text-xs font-medium text-muted-foreground pointer-events-none transition-all hover:opacity-0 animate-in fade-in slide-in-from-bottom-2">
          Drag the marker to pinpoint the exact location
        </div>
      )}
    </div>
  );
}

export default MapPicker;
