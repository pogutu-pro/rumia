'use client';

import {
  Map,
  AdvancedMarker,
  Pin,
  APIProvider,
} from '@vis.gl/react-google-maps';
import { Compass, Eye } from 'lucide-react';
import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';

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
    <ResolvedLocationSection
      apiKey={apiKey}
      mapId={mapId}
      listingTitle={listingTitle}
      lat={lat}
      lng={lng}
    />
  );
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
  const [streetViewStatus, setStreetViewStatus] = useState<
    'loading' | 'available' | 'unavailable'
  >(() => (apiKey ? 'loading' : 'unavailable'));
  const streetViewRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const streetViewInitialized = useRef(false);
  const center = { lat, lng };

  // Initialize Street View panorama using the JS API
  const initStreetView = useCallback(() => {
    if (!apiKey || !streetViewRef.current || streetViewInitialized.current) {
      console.log('Early return from initStreetView:', {
        apiKey: !!apiKey,
        refExists: !!streetViewRef.current,
        alreadyInit: streetViewInitialized.current,
      });
      return;
    }
    if (typeof window === 'undefined') {
      console.warn('Window is undefined, skipping Street View init');
      return;
    }
    if (typeof google === 'undefined' || !google.maps) {
      console.warn('Google Maps API not available yet');
      return;
    }

    // Don't reinitialize if we already have a panorama
    if (panoramaRef.current) {
      console.log('Panorama already exists, skipping');
      return;
    }

    streetViewInitialized.current = true;
    console.log('Starting Street View initialization for coordinates:', {
      lat,
      lng,
    });

    try {
      const streetViewService = new google.maps.StreetViewService();
      const location = new google.maps.LatLng(lat, lng);

      streetViewService.getPanorama(
        {
          location,
          radius: 50,
          preference: google.maps.StreetViewPreference.NEAREST,
        },
        (data, status) => {
          console.log('Street View service response:', {
            status,
            dataExists: !!data,
            locationExists: !!data?.location,
          });

          if (
            status === google.maps.StreetViewStatus.OK &&
            data?.location?.latLng &&
            streetViewRef.current
          ) {
            console.log(
              'Street View available, creating panorama at:',
              data.location.latLng,
            );
            setStreetViewStatus('available');

            // Create panorama only if container still exists and ref is empty
            if (!panoramaRef.current) {
              console.log('Container ref exists, creating panorama instance');
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
                },
              );
              console.log('Panorama instance created:', !!panoramaRef.current);
            }
          } else {
            console.warn('Street View unavailable or ref missing:', {
              statusOK: status === google.maps.StreetViewStatus.OK,
              refExists: !!streetViewRef.current,
            });
            setStreetViewStatus('unavailable');
          }
        },
      );
    } catch (error) {
      console.error('Street View initialization error:', error);
      setStreetViewStatus('unavailable');
    }
  }, [apiKey, lat, lng]);

  // Wait for the Google Maps JS API to be ready (loaded by APIProvider), then init Street View
  useEffect(() => {
    // Check if Google Maps is immediately available
    if (
      typeof window !== 'undefined' &&
      typeof google !== 'undefined' &&
      google.maps &&
      google.maps.StreetViewService
    ) {
      queueMicrotask(initStreetView);
      return;
    }

    // Poll for google.maps to become available (loaded by APIProvider)
    let retries = 0;
    const maxRetries = 50; // 50 * 200ms = 10 seconds max wait

    const interval = setInterval(() => {
      retries++;
      if (
        typeof window !== 'undefined' &&
        typeof google !== 'undefined' &&
        google.maps &&
        google.maps.StreetViewService
      ) {
        clearInterval(interval);
        initStreetView();
      } else if (retries >= maxRetries) {
        clearInterval(interval);
        console.warn('Google Maps API failed to load within timeout');
        setStreetViewStatus('unavailable');
      }
    }, 200);

    return () => {
      clearInterval(interval);
    };
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
