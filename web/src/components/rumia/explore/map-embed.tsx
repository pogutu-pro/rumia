'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { APIProvider, AdvancedMarker, Map, Pin } from '@vis.gl/react-google-maps';
import type { LatLng } from '@/lib/rumia/geo';
import type { MapPoint } from './map-types';

interface Props {
  points: MapPoint[];
  center: LatLng;
  zoom?: number;
  hoveredId?: string | null;
  /** Fired only after the visitor moves the map themselves (never on load). */
  onCameraChange?: (center: LatLng) => void;
}

/**
 * The Google Map itself. Loaded through next/dynamic with ssr:false, and only
 * ever mounted when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is present (see ExploreMap).
 */
export default function MapEmbed({ points, center, zoom = 13, hoveredId, onCameraChange }: Props) {
  const router = useRouter();
  const interacted = useRef(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

  const handleCamera = useCallback(
    (ev: { detail?: { center?: { lat: number; lng: number } } }) => {
      if (!interacted.current || !onCameraChange) return;
      const c = ev.detail?.center;
      if (c) onCameraChange({ lat: c.lat, lng: c.lng });
    },
    [onCameraChange],
  );

  return (
    <div
      className="absolute inset-0"
      onPointerDownCapture={() => {
        interacted.current = true;
      }}
      onWheelCapture={() => {
        interacted.current = true;
      }}
      onTouchStartCapture={() => {
        interacted.current = true;
      }}
    >
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId={mapId}
          gestureHandling="greedy"
          reuseMaps
          disableDefaultUI={false}
          onCameraChanged={handleCamera}
          style={{ width: '100%', height: '100%' }}
        >
          {points.map((p) => {
            const active = hoveredId === p.id;
            return (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                title={p.name}
                onClick={() => router.push(`/p/${p.slug}`)}
              >
                <Pin
                  background={active ? '#1f6f5c' : '#2f6f4e'}
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                  scale={active ? 1.4 : 1.1}
                />
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
