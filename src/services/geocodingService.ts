/**
 * High-performance Geocoding and Location Search Service
 * Integrates OpenStreetMap Photon, Open-Meteo, and Nominatim for worldwide
 * autocomplete, pinpointing, and reverse geocoding with zero API key requirement.
 */

export interface GeocodedLocation {
  id: string;
  name: string;
  sub: string;
  displayName: string;
  lat: number;
  lng: number;
  category?: string;
  source?: 'photon' | 'meteo' | 'nominatim';
}

/**
 * Searches global locations, venues, addresses, and landmarks.
 */
export async function searchGlobalLocations(
  query: string,
  options?: { signal?: AbortSignal; limit?: number }
): Promise<GeocodedLocation[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const limit = options?.limit || 8;
  const results: GeocodedLocation[] = [];
  const seen = new Set<string>();

  const addLocation = (
    id: string,
    name: string,
    state?: string,
    country?: string,
    district?: string,
    lat?: number,
    lng?: number,
    category?: string,
    source?: 'photon' | 'meteo' | 'nominatim'
  ) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !name) return;
    if (isNaN(lat) || isNaN(lng)) return;

    let cleanState = state || '';
    if (
      country?.toLowerCase() === 'nigeria' &&
      cleanState &&
      !cleanState.toLowerCase().includes('state') &&
      !cleanState.toLowerCase().includes('fct')
    ) {
      cleanState = `${cleanState} State`;
    }

    const subList: string[] = [];
    if (district && district.toLowerCase() !== name.toLowerCase()) {
      subList.push(district);
    }
    if (cleanState) subList.push(cleanState);
    if (country) subList.push(country);

    const sub = subList.join(', ');
    const displayList = [name];
    if (cleanState && cleanState.toLowerCase() !== name.toLowerCase()) {
      displayList.push(cleanState);
    }
    if (country) displayList.push(country);
    const displayName = displayList.join(', ');

    // Deduplicate by rounded lat/lng and name
    const coordKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
    const textKey = `${name.toLowerCase()}|${cleanState.toLowerCase()}`;
    if (!seen.has(coordKey) && !seen.has(textKey)) {
      seen.add(coordKey);
      seen.add(textKey);
      results.push({
        id,
        name,
        sub,
        displayName,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        category,
        source,
      });
    }
  };

  try {
    const [nomRes, photonRes] = await Promise.allSettled([
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          clean
        )}&format=json&limit=6&addressdetails=1`,
        {
          signal: options?.signal,
          headers: {
            'User-Agent': 'AttendanceAdminApp/1.0',
          },
        }
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=${limit}`,
        { signal: options?.signal }
      ).then((r) => (r.ok ? r.json() : null)),
    ]);

    // Parse Nominatim results first (Best accuracy for street numbers, Nigerian roads & cities)
    if (
      nomRes.status === 'fulfilled' &&
      nomRes.value &&
      Array.isArray(nomRes.value)
    ) {
      for (const item of nomRes.value) {
        const addr = item.address || {};
        const streetPart = addr.house_number && addr.road
          ? `${addr.house_number} ${addr.road}`
          : addr.road || addr.suburb || addr.neighbourhood || addr.amenity || addr.building;
        const name = streetPart || item.name || (item.display_name ? item.display_name.split(',')[0] : clean);

        addLocation(
          `nom-${item.place_id || Math.random()}`,
          name,
          addr.state,
          addr.country,
          addr.city || addr.town || addr.county || addr.suburb,
          parseFloat(item.lat),
          parseFloat(item.lon),
          item.type || 'address',
          'nominatim'
        );
      }
    }

    // Parse Photon results
    if (
      photonRes.status === 'fulfilled' &&
      photonRes.value &&
      Array.isArray(photonRes.value.features)
    ) {
      for (const f of photonRes.value.features) {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [];
        const streetPart = p.housenumber && p.street
          ? `${p.housenumber} ${p.street}`
          : p.street;
        const name =
          streetPart ||
          p.name ||
          p.city ||
          p.district ||
          p.county ||
          clean;
        const category = p.osm_value || p.type || 'place';

        addLocation(
          `ph-${p.osm_id || Math.random()}`,
          name,
          p.state,
          p.country,
          p.district || p.county || p.city,
          coords[1],
          coords[0],
          category,
          'photon'
        );
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name !== 'AbortError') {
      console.warn('Geocoding lookup error:', err);
    }
  }

  return results.slice(0, limit);
}

/**
 * Reverse geocodes coordinates to a human-readable venue or street name.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<{ displayName: string; name: string } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        signal,
        headers: {
          'User-Agent': 'AttendanceAdminApp/1.0',
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;

    const addr = data.address || {};
    const primaryName =
      addr.amenity ||
      addr.building ||
      addr.road ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.city ||
      addr.town ||
      data.name ||
      'Pinned Premises Location';

    const parts: string[] = [];
    if (primaryName) parts.push(primaryName);
    if (addr.suburb && addr.suburb !== primaryName) parts.push(addr.suburb);
    if (addr.city && addr.city !== primaryName) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);

    return {
      name: primaryName,
      displayName: parts.join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  } catch {
    return null;
  }
}

/**
 * Parses latitude and longitude from raw coordinate strings or Google Maps URLs.
 * Supports:
 * - "4.960234, 8.327651" or "4.960234,8.327651"
 * - "4.960234 8.327651"
 * - Google Maps URLs containing /@lat,lng or ?q=lat,lng or ?query=lat,lng
 */
export function parseCoordinatesOrUrl(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;

  const isValidCoord = (lat: number, lng: number): boolean => {
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };

  // 1. Check for @lat,lng in Google Maps URLs (e.g. .../@4.960234,8.327651,17z...)
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // 2. Check for q=lat,lng or query=lat,lng in query strings
  const queryMatch = str.match(/[?&](?:q|query)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // 3. Check for standard coordinate pair: "4.960234, 8.327651" or "4.960234 8.327651"
  const pairMatch = str.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (pairMatch) {
    const lat = parseFloat(pairMatch[1]);
    const lng = parseFloat(pairMatch[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // 4. Loose coordinate match anywhere in text (e.g. copied text containing numbers)
  const looseMatch = str.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (looseMatch) {
    const lat = parseFloat(looseMatch[1]);
    const lng = parseFloat(looseMatch[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  return null;
}
