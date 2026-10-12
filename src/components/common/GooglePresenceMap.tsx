import React from 'react';
import { PresenceMap } from './PresenceMap';

interface GooglePresenceMapProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  locationLabel?: string;
  height?: string | number;
  hideOverlay?: boolean;
}

/**
 * High-Resolution Presence Map Component
 * Powered by Google Satellite Hybrid and Streets tiles.
 * Completely free forever — zero Google Cloud billing, zero prepayment, zero API keys.
 */
export const GooglePresenceMap: React.FC<GooglePresenceMapProps> = ({
  latitude,
  longitude,
  radiusMeters,
  onCoordinatesChange,
  locationLabel,
  height = 360,
  hideOverlay = false,
}) => {
  return (
    <PresenceMap
      latitude={latitude}
      longitude={longitude}
      radiusMeters={radiusMeters}
      onCoordinatesChange={onCoordinatesChange}
      locationLabel={locationLabel}
      height={height}
      hideOverlay={hideOverlay}
    />
  );
};
