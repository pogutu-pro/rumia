'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

interface ResolvedLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface GoogleLocationInputProps {
  id?: string;
  label?: string;
  value: string;
  latitude: number | null;
  longitude: number | null;
  required?: boolean;
  placeholder?: string;
  inputClassName?: string;
  onChange: (location: ResolvedLocation) => void;
}

const NYERI_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: -0.34,
  south: -0.49,
  east: 37.05,
  west: 36.86,
};

let mapsOptionsSet = false;

async function loadGoogleLocationLibraries(apiKey: string, mapId?: string) {
  if (!mapsOptionsSet) {
    setOptions({
      key: apiKey,
      v: 'weekly',
      region: 'KE',
      mapIds: mapId ? [mapId] : undefined,
    });

    mapsOptionsSet = true;
  }

  await Promise.all([
    importLibrary('maps'),
    importLibrary('places'),
    importLibrary('marker'),
    importLibrary('geocoding'),
  ]);
}

function getValidCoords(latitude: number | null, longitude: number | null) {
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return { lat: latitude, lng: longitude };
  }

  return null;
}

export function GoogleLocationInput({
  id = 'location',
  value,
  latitude,
  longitude,
  required,
  placeholder = 'Start typing the hostel address or area',
  inputClassName,
  onChange,
}: GoogleLocationInputProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const coords = getValidCoords(latitude, longitude);

  useEffect(() => {
    if (!apiKey || !inputRef.current || autocompleteRef.current) return;

    let mounted = true;
    setIsLoadingGoogle(true);

    loadGoogleLocationLibraries(apiKey, mapId)
      .then(() => {
        if (!mounted || !inputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          bounds: NYERI_BOUNDS,
          componentRestrictions: { country: 'ke' },
          fields: ['formatted_address', 'geometry', 'name'],
          strictBounds: false,
        });

        autocompleteRef.current = autocomplete;
        listenerRef.current = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const placeLocation = place.geometry?.location;

          if (!placeLocation) {
            onChange({ address: inputRef.current?.value || '', latitude: null, longitude: null });
            setLookupError('Choose a suggestion from the location list to pin this hostel.');
            return;
          }

          const address = place.formatted_address || place.name || inputRef.current?.value || '';
          setLookupError(null);
          onChange({
            address,
            latitude: placeLocation.lat(),
            longitude: placeLocation.lng(),
          });
        });

        setGoogleReady(true);
      })
      .catch(() => {
        if (mounted) {
          setLookupError('Google location lookup is unavailable right now.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingGoogle(false);
      });

    return () => {
      mounted = false;
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [apiKey, mapId, onChange]);

  useEffect(() => {
    if (!apiKey || !googleReady || !coords || !mapRef.current) return;

    const position = coords;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom: 16,
        mapId,
        clickableIcons: false,
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
      });
    } else {
      mapInstanceRef.current.setCenter(position);
      mapInstanceRef.current.setZoom(16);
    }

    if ('marker' in google.maps && google.maps.marker?.AdvancedMarkerElement) {
      if (markerRef.current && 'map' in markerRef.current) {
        markerRef.current.map = null;
      }

      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position,
        title: value || 'Hostel location',
      });
    } else {
      if (markerRef.current && 'setMap' in markerRef.current) {
        markerRef.current.setMap(null);
      }

      markerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        position,
        title: value || 'Hostel location',
      });
    }
  }, [apiKey, coords, googleReady, mapId, value]);

  const handleManualChange = (nextValue: string) => {
    setLookupError(null);
    onChange({ address: nextValue, latitude: null, longitude: null });
  };

  const resolveCurrentLocation = useCallback(() => {
    if (!apiKey) {
      setLookupError('Google location lookup is unavailable right now.');
      return;
    }

    if (!navigator.geolocation) {
      setLookupError('Current location is not available in this browser.');
      return;
    }

    setIsResolvingCurrentLocation(true);
    setLookupError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await loadGoogleLocationLibraries(apiKey, mapId);

          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ location });
          const address = response.results[0]?.formatted_address;

          if (!address) {
            setLookupError('Google could not find an address for your current location.');
            onChange({ address: value, latitude: null, longitude: null });
            return;
          }

          onChange({
            address,
            latitude: location.lat,
            longitude: location.lng,
          });
        } catch {
          setLookupError('Could not resolve your current location.');
        } finally {
          setIsResolvingCurrentLocation(false);
        }
      },
      () => {
        setLookupError('Location permission was not granted.');
        setIsResolvingCurrentLocation(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 12000,
      }
    );
  }, [apiKey, mapId, onChange, value]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={(event) => handleManualChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn('pr-10', inputClassName)}
        />
        {isLoadingGoogle ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : (
          <MapPin className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={resolveCurrentLocation}
        disabled={isResolvingCurrentLocation || isLoadingGoogle}
        className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
      >
        {isResolvingCurrentLocation ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LocateFixed className="mr-2 h-4 w-4" />
        )}
        Use my current location
      </Button>

      {lookupError && (
        <p className="text-xs font-semibold text-amber-600">{lookupError}</p>
      )}

      {coords && apiKey && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs">
          <div ref={mapRef} className="h-56 w-full" />
        </div>
      )}
    </div>
  );
}
