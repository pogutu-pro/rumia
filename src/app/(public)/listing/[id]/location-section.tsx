'use client';

import { Map, AdvancedMarker, Pin, APIProvider } from '@vis.gl/react-google-maps';
import { Compass, Eye } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface LocationSectionProps {
  listingTitle: string;
  latitude: number | string | null;
  longitude: number | string | null;
}

function toCoordinate(value: number | string | null) {
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LocationSection({ listingTitle, latitude, longitude }: LocationSectionProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
  const lat = toCoordinate(latitude);
  const lng = toCoordinate(longitude);

  if (!apiKey || lat === null || lng === null) {
    return null;
  }

  return <ResolvedLocationSection apiKey={apiKey} mapId={mapId} listingTitle={listingTitle} lat={lat} lng={lng} />;
}

function ResolvedLocationSection({
  apiKey,
  mapId,
  listingTitle,
  lat,
  lng,
}: {
  apiKey: string;
  mapId: string;
  listingTitle: string;
  lat: number;
  lng: number;
}) {
  const [streetViewStatus, setStreetViewStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const streetViewRef = useRef<HTMLDivElement>(null);
  const streetViewInitialized = useRef(false);
  const center = { lat, lng };

  // Initialize Street View panorama using the JS API
  const initStreetView = useCallback(() => {
    if (!apiKey || !streetViewRef.current || streetViewInitialized.current) return;
    if (typeof google === 'undefined' || !google.maps) return;

    streetViewInitialized.current = true;

    const streetViewService = new google.maps.StreetViewService();
    const location = new google.maps.LatLng(lat, lng);

    streetViewService.getPanorama(
      { location, radius: 50, preference: google.maps.StreetViewPreference.NEAREST },
      (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
          setStreetViewStatus('available');
          new google.maps.StreetViewPanorama(streetViewRef.current!, {
            position: data.location.latLng,
            pov: { heading: 165, pitch: 0 },
            zoom: 1,
            addressControl: false,
            showRoadLabels: true,
            motionTracking: false,
            motionTrackingControl: false,
          });
        } else {
          setStreetViewStatus('unavailable');
        }
      }
    );
  }, [apiKey, lat, lng]);

  // Wait for the Google Maps JS API to be ready (loaded by APIProvider), then init Street View
  useEffect(() => {
    if (!apiKey) {
      setStreetViewStatus('unavailable');
      return;
    }

    // Poll for google.maps to become available (loaded by APIProvider above)
    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps && google.maps.StreetViewService) {
        clearInterval(interval);
        initStreetView();
      }
    }, 300);

    return () => clearInterval(interval);
  }, [apiKey, initStreetView]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-600" />
          Map
        </h2>

        <div className="h-80 rounded-2xl overflow-hidden border border-slate-100 shadow-xs relative bg-slate-100">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={center}
              defaultZoom={14}
              mapId={mapId}
              disableDefaultUI={false}
              gestureHandling="cooperative"
              className="h-full w-full"
            >
              <AdvancedMarker position={center} title={listingTitle}>
                <div className="flex -translate-y-2 flex-col items-center gap-1">
                  <span className="max-w-[180px] rounded-md bg-white px-2 py-1 text-center text-xs font-bold text-slate-900 shadow-md">
                    {listingTitle}
                  </span>
                  <Pin
                    background="#10b981"
                    borderColor="#047857"
                    glyphColor="#ffffff"
                    scale={1.15}
                  />
                </div>
              </AdvancedMarker>
            </Map>
          </APIProvider>
        </div>
      </div>

      {/* Street View Panorama */}
      {streetViewStatus !== 'unavailable' && (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Eye className="h-5 w-5 text-emerald-600" />
          Street View
        </h3>

        <div className="relative h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-100 shadow-xs bg-slate-100">
          <div ref={streetViewRef} className="h-full w-full" />
          {streetViewStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 z-10">
              <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
