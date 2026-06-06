'use client';

import { Map, AdvancedMarker, Pin, APIProvider } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Compass, Eye } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface LocationSectionProps {
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

export function LocationSection({
  locationName = 'Opposite DeKUT Gate B',
  latitude = -0.3975, // Default DeKUT area lat
  longitude = 36.9615, // Default DeKUT area lng
}: LocationSectionProps) {
  const [isTilesLoaded, setIsTilesLoaded] = useState(false);
  const [streetViewStatus, setStreetViewStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const streetViewRef = useRef<HTMLDivElement>(null);
  const streetViewInitialized = useRef(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

  const center = { lat: latitude, lng: longitude };

  const nearbyPlaces = [
    { name: 'Gate B', time: '2 min walk', distance: '150m' },
    { name: 'University Cafeteria', time: '3 min walk', distance: '250m' },
    { name: 'Main Library', time: '5 min walk', distance: '400m' },
    { name: 'Nyeri Town', time: '7 min drive', distance: '4.5km' },
  ];

  // Initialize Street View panorama using the JS API
  const initStreetView = useCallback(() => {
    if (!apiKey || !streetViewRef.current || streetViewInitialized.current) return;
    if (typeof google === 'undefined' || !google.maps) return;

    streetViewInitialized.current = true;

    const streetViewService = new google.maps.StreetViewService();
    const location = new google.maps.LatLng(latitude, longitude);

    streetViewService.getPanorama(
      { location, radius: 500, preference: google.maps.StreetViewPreference.NEAREST },
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
  }, [apiKey, latitude, longitude]);

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
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-600" />
          Location
        </h2>
        <p className="text-sm font-semibold text-slate-500 mt-1 flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          {locationName}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-2 h-72 rounded-2xl overflow-hidden border border-slate-100 shadow-xs relative bg-slate-100">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <Map
                defaultCenter={center}
                defaultZoom={15}
                mapId={mapId}
                onTilesLoaded={() => setIsTilesLoaded(true)}
                disableDefaultUI={false}
                gestureHandling={'cooperative'}
                className="h-full w-full"
              >
                <AdvancedMarker position={center}>
                  <Pin
                    background={'#10b981'}
                    borderColor={'#047857'}
                    glyphColor={'#ffffff'}
                    scale={1.2}
                  />
                </AdvancedMarker>
              </Map>
            </APIProvider>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-slate-100/50">
              <MapPin className="h-10 w-10 text-slate-400 mb-2 animate-bounce" />
              <p className="text-sm font-bold text-slate-700">Map is loading</p>
              <p className="text-xs text-slate-400 font-medium max-w-xs mt-1">
                Configure your Google Maps API Key to view the interactive street map.
              </p>
            </div>
          )}
        </div>

        {/* Nearby distances */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-center space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Nearby places</h3>
          <div className="space-y-3.5">
            {nearbyPlaces.map((place, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                    <Navigation className="h-3.5 w-3.5 rotate-45" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{place.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block">{place.time}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{place.distance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Street View Panorama */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Eye className="h-5 w-5 text-emerald-600" />
          Street View
        </h3>
        <p className="text-xs font-semibold text-slate-500">
          Explore the surroundings as if you were there. Drag to look around.
        </p>

        <div className="relative h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-100 shadow-xs bg-slate-100">
          {apiKey && streetViewStatus !== 'unavailable' ? (
            <>
              <div ref={streetViewRef} className="h-full w-full" />
              {streetViewStatus === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 z-10">
                  <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
                  <p className="text-sm font-semibold text-slate-600">Loading Street View...</p>
                </div>
              )}
            </>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-slate-50">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Eye className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                Street View not available
              </p>
              <p className="text-xs text-slate-400 font-medium max-w-sm mt-1.5 leading-relaxed">
                {!apiKey
                  ? 'Configure your Google Maps API Key with Street View enabled to explore this area.'
                  : 'Google Street View imagery is not yet available for this exact location. Try checking the map above for nearby coverage.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
