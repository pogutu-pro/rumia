'use client';

import {
  Map,
  AdvancedMarker,
  Pin,
  APIProvider,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps';
import { Compass, Eye } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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

const DEFAULT_STREETVIEW_LAT = -0.3946;
const DEFAULT_STREETVIEW_LNG = 36.9635;

export function LocationSection({
  listingTitle,
  latitude,
  longitude,
}: LocationSectionProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
  const lat = toCoordinate(latitude);
  const lng = toCoordinate(longitude);

  if (!apiKey || lat === null || lng === null) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-600" />
          Map
        </h2>

        <div className="h-80 rounded-2xl overflow-hidden border border-slate-100 shadow-xs bg-slate-100">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={{ lat, lng }}
              defaultZoom={14}
              mapId={mapId}
              disableDefaultUI={false}
              gestureHandling="cooperative"
              className="h-full w-full"
            >
              <AdvancedMarker position={{ lat, lng }} title={listingTitle}>
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

            <StreetViewContent lat={lat} lng={lng} />
          </APIProvider>
        </div>
      </div>
    </div>
  );
}

function StreetViewContent({ lat, lng }: { lat: number; lng: number }) {
  const isLoaded = useApiIsLoaded();
  const streetViewRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'available' | 'unavailable'
  >('loading');

  useEffect(() => {
    if (!isLoaded) return;

    const container = streetViewRef.current;
    if (!container) return;

    setStatus('loading');

    const sv = new google.maps.StreetViewService();
    const listingLocation = new google.maps.LatLng(lat, lng);

    const tryPanorama = (coords: google.maps.LatLng) => {
      sv.getPanorama(
        {
          location: coords,
          radius: 50,
          preference: google.maps.StreetViewPreference.NEAREST,
        },
        (data, statusCode) => {
          if (
            statusCode === google.maps.StreetViewStatus.OK &&
            data?.location?.latLng &&
            streetViewRef.current
          ) {
            setStatus('available');
            panoramaRef.current = new google.maps.StreetViewPanorama(
              streetViewRef.current,
              {
                position: data.location.latLng,
                pov: { heading: 165, pitch: 0 },
                zoom: 1,
                addressControl: false,
                showRoadLabels: true,
                motionTracking: false,
                motionTrackingControl: false,
                zoomControl: false,
                panControl: false,
                enableCloseButton: false,
                linksControl: false,
                fullscreenControl: false,
              },
            );
          } else {
            const defaultCoords = new google.maps.LatLng(
              DEFAULT_STREETVIEW_LAT,
              DEFAULT_STREETVIEW_LNG,
            );
            if (coords.toString() !== defaultCoords.toString()) {
              tryPanorama(defaultCoords);
            } else {
              setStatus('unavailable');
            }
          }
        },
      );
    };

    tryPanorama(listingLocation);

    return () => {
      if (panoramaRef.current) {
        const node = streetViewRef.current;
        if (node) {
          node.innerHTML = '';
        }
        panoramaRef.current = null;
      }
    };
  }, [isLoaded, lat, lng]);

  if (status === 'unavailable') return null;

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Eye className="h-5 w-5 text-emerald-600" />
        Street View
      </h3>

      <div className="relative h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-100 shadow-xs bg-slate-100">
        <div ref={streetViewRef} className="h-full w-full" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
            <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
