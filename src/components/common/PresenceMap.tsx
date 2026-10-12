import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map, Satellite, ShieldCheck } from "lucide-react";
import styles from "./PresenceMap.module.css";

interface PresenceMapProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  locationLabel?: string;
  height?: string | number;
  hideOverlay?: boolean;
}

export const PresenceMap: React.FC<PresenceMapProps> = ({
  latitude,
  longitude,
  radiusMeters,
  onCoordinatesChange,
  locationLabel,
  height = 360,
  hideOverlay = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Default to satellite so users immediately see physical structures and can pinch in
  const [activeLayer, setActiveLayer] = useState<'streets' | 'satellite'>('satellite');
  const streetTileLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteTileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = Number.isFinite(latitude) ? latitude : 4.9796;
    const initialLng = Number.isFinite(longitude) ? longitude : 8.3374;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 18,
      minZoom: 3,
      maxZoom: 22,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
    });

    // High-Resolution Google Satellite Hybrid Layer (Aerial + road/building labels)
    // maxNativeZoom: 20 prevents any "Map data not yet available" tiles; maxZoom: 22 enables deep pinch-to-zoom
    const satLayer = L.tileLayer(
      "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      {
        subdomains: ["0", "1", "2", "3"],
        maxZoom: 22,
        maxNativeZoom: 20,
      }
    );

    // High-Resolution Google Streets Layer
    const streetLayer = L.tileLayer(
      "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      {
        subdomains: ["0", "1", "2", "3"],
        maxZoom: 22,
        maxNativeZoom: 20,
      }
    );

    // Add satellite layer by default
    satLayer.addTo(map);
    satelliteTileLayerRef.current = satLayer;
    streetTileLayerRef.current = streetLayer;

    // Custom modern SVG Pin
    const pinIcon = L.divIcon({
      className: styles.customPinIcon,
      html: `
        <div class="${styles.pinMarkerWrapper}">
          <div class="${styles.pinPulse}"></div>
          <div class="${styles.pinDot}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    if (locationLabel) {
      marker
        .bindPopup(
          `<div style="display:flex;align-items:center;gap:6px;font-family:sans-serif;"><img src="/image/app-icon.png" width="16" height="16" style="border-radius:3px;vertical-align:middle;"/><strong>${locationLabel}</strong></div><div style="font-size:11px;color:#64748B;margin-top:2px;">Premises Centerpoint</div>`
        )
        .openPopup();
    }

    const circle = L.circle([initialLat, initialLng], {
      radius: radiusMeters,
      color: "#2563EB",
      weight: 2,
      opacity: 0.85,
      fillColor: "#3B82F6",
      fillOpacity: 0.22,
    }).addTo(map);

    // Drag marker updates coordinates
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      circle.setLatLng(pos);
      if (onCoordinatesChange) {
        onCoordinatesChange(
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6))
        );
      }
    });

    // Map click places pin
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      if (onCoordinatesChange) {
        onCoordinatesChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      }
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Trigger resize calculation
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      streetTileLayerRef.current = null;
      satelliteTileLayerRef.current = null;
    };
  }, []);

  // Switch between High-Res Streets and High-Res Satellite layers
  const switchLayer = (type: 'streets' | 'satellite') => {
    if (!mapInstanceRef.current || !streetTileLayerRef.current || !satelliteTileLayerRef.current) return;
    setActiveLayer(type);

    if (type === 'streets') {
      if (mapInstanceRef.current.hasLayer(satelliteTileLayerRef.current)) {
        mapInstanceRef.current.removeLayer(satelliteTileLayerRef.current);
      }
      if (!mapInstanceRef.current.hasLayer(streetTileLayerRef.current)) {
        streetTileLayerRef.current.addTo(mapInstanceRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(streetTileLayerRef.current)) {
        mapInstanceRef.current.removeLayer(streetTileLayerRef.current);
      }
      if (!mapInstanceRef.current.hasLayer(satelliteTileLayerRef.current)) {
        satelliteTileLayerRef.current.addTo(mapInstanceRef.current);
      }
    }
  };

  // Sync position updates with smooth flyTo animation (preserves close zoom level if user has zoomed in)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const currentMarker = markerRef.current.getLatLng();
    if (
      Math.abs(currentMarker.lat - latitude) > 0.00001 ||
      Math.abs(currentMarker.lng - longitude) > 0.00001
    ) {
      markerRef.current.setLatLng([latitude, longitude]);
      circleRef.current.setLatLng([latitude, longitude]);
      const currentZoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.flyTo([latitude, longitude], Math.max(currentZoom, 18), { duration: 1.2 });
    }
  }, [latitude, longitude]);

  // Update popup label if locationLabel changes
  useEffect(() => {
    if (markerRef.current && locationLabel) {
      markerRef.current.bindPopup(
        `<div style="display:flex;align-items:center;gap:6px;font-family:sans-serif;"><img src="/image/app-icon.png" width="16" height="16" style="border-radius:3px;vertical-align:middle;"/><strong>${locationLabel}</strong></div><div style="font-size:11px;color:#64748B;margin-top:2px;">Premises Centerpoint</div>`
      );
    }
  }, [locationLabel]);

  // Sync radius circumference updates
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setRadius(radiusMeters);
  }, [radiusMeters]);

  return (
    <div className={styles.mapWrapper} style={{ height }}>
      {/* High-Resolution Calibrated Map Badge */}
      <div className={styles.mapStatusBadge}>
        <span className={styles.statusDot} />
        <ShieldCheck size={13} color="#10B981" />
        <span>High-Res Satellite · Deep Zoom Active</span>
      </div>

      {/* Layer Switcher: Streets vs Satellite (High-Res, zero missing data) */}
      <div className={styles.layerSelector}>
        <button
          type="button"
          className={`${styles.layerBtn} ${
            activeLayer === 'satellite' ? styles.layerBtnActive : ''
          }`}
          onClick={() => switchLayer('satellite')}
          title="Satellite Imagery with Road Overlays"
        >
          <Satellite size={13} />
          <span>Satellite</span>
        </button>

        <button
          type="button"
          className={`${styles.layerBtn} ${
            activeLayer === 'streets' ? styles.layerBtnActive : ''
          }`}
          onClick={() => switchLayer('streets')}
          title="Street & Landmark Map View"
        >
          <Map size={13} />
          <span>Streets</span>
        </button>
      </div>

      <div ref={mapContainerRef} className={styles.mapContainer} style={{ height }} />

      {!hideOverlay && (
        <div className={styles.mapBadgeOverlay}>
          <div className={styles.badgeItem}>
            <span className={styles.badgeDot}></span>
            <span>Perimeter: <strong>{radiusMeters}m radius</strong></span>
          </div>
          <div className={styles.badgeItem}>
            <span>Diameter: <strong>{radiusMeters * 2}m</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};
