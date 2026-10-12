import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crosshair,
  Search,
  X,
  Navigation,
} from 'lucide-react';
import {
  parseCoordinatesOrUrl,
  reverseGeocode,
  searchGlobalLocations,
} from '../../services/geocodingService';
import type { GeocodedLocation } from '../../services/geocodingService';
import styles from './LocationSearchPinpoint.module.css';

interface LocationSearchPinpointProps {
  currentLat: number;
  currentLng: number;
  onCoordinatesChange: (lat: number, lng: number, label?: string) => void;
  locationLabel?: string;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
}

const PRESET_CITIES = [
  { name: 'Calabar', state: 'Cross River', lat: 4.9757, lng: 8.3417 },
  { name: 'Uyo', state: 'Akwa Ibom', lat: 5.0377, lng: 7.9128 },
  { name: 'Port Harcourt', state: 'Rivers', lat: 4.8156, lng: 7.0498 },
  { name: 'Katsina', state: 'Katsina', lat: 12.9908, lng: 7.6018 },
  { name: 'Abuja', state: 'FCT', lat: 9.0765, lng: 7.3986 },
  { name: 'Lagos', state: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { name: 'Kano', state: 'Kano', lat: 12.0022, lng: 8.5920 },
  { name: 'Enugu', state: 'Enugu', lat: 6.4584, lng: 7.5464 },
];

export const LocationSearchPinpoint: React.FC<LocationSearchPinpointProps> = ({
  currentLat,
  currentLng,
  onCoordinatesChange,
  locationLabel,
  onUseCurrentLocation,
  isLocating = false,
}) => {
  // 2 Methods: 'gps' (Use Current Location) | 'search' (Search Address or Coordinates)
  const [activeMethod, setActiveMethod] = useState<'gps' | 'search'>('gps');

  // Search & Pinpoint state
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(locationLabel || null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync label from parent
  useEffect(() => {
    if (locationLabel) {
      setPinnedName(locationLabel);
      if (!addressQuery) {
        setAddressQuery(locationLabel);
      }
    }
  }, [locationLabel]);

  // Reverse geocode when coordinates change
  useEffect(() => {
    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchReverse = async () => {
      const rev = await reverseGeocode(currentLat, currentLng, controller.signal);
      if (isMounted && rev?.displayName) {
        setPinnedName(rev.displayName);
      }
    };

    const timer = setTimeout(fetchReverse, 500);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [currentLat, currentLng]);

  // Debounced autocomplete suggestions for address search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const clean = addressQuery.trim();
    if (clean.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // If input is raw coordinates, don't query autocomplete
    const parsedCoords = parseCoordinatesOrUrl(clean);
    if (parsedCoords) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchGlobalLocations(clean, { limit: 6 });
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        console.warn('Geocoding search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [addressQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: GeocodedLocation) => {
    onCoordinatesChange(item.lat, item.lng, item.displayName);
    setPinnedName(item.displayName);
    setAddressQuery(item.name);
    setShowDropdown(false);
    setSearchError(null);
    setSuccessFeedback(`Map centered on ${item.name}`);
    setTimeout(() => setSuccessFeedback(null), 3500);
  };

  const handleQuickCitySelect = (city: (typeof PRESET_CITIES)[0]) => {
    const fullLabel = `${city.name}, ${city.state}`;
    onCoordinatesChange(city.lat, city.lng, fullLabel);
    setPinnedName(fullLabel);
    setAddressQuery(`${city.name}, ${city.state}`);
    setShowDropdown(false);
    setSearchError(null);
    setSuccessFeedback(`Map centered on ${city.name}`);
    setTimeout(() => setSuccessFeedback(null), 3500);
  };

  // Submit Search / Fly to location
  const handleExecuteSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);
    setSuccessFeedback(null);
    setShowDropdown(false);

    const clean = addressQuery.trim();
    if (!clean) {
      setSearchError('Please enter an address, venue name, or coordinates.');
      return;
    }

    // 1. Check if user typed or pasted coordinates (e.g. 4.960234, 8.327651) or a map link
    const parsedCoords = parseCoordinatesOrUrl(clean);
    if (parsedCoords) {
      const { lat, lng } = parsedCoords;
      const label = pinnedName || 'Pinned Coordinates';
      onCoordinatesChange(lat, lng, label);
      setSuccessFeedback(`Map centered on coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
      setTimeout(() => setSuccessFeedback(null), 3500);
      return;
    }

    // 2. Perform address search
    setIsSearching(true);
    try {
      const results = await searchGlobalLocations(clean, { limit: 5 });
      if (results.length > 0) {
        handleSelectSuggestion(results[0]);
        if (results.length > 1) {
          setSuggestions(results);
          setShowDropdown(true);
        }
      } else {
        setSearchError(
          `Could not locate "${clean}". Try adding the city name (e.g. "${clean}, Calabar") or paste coordinates directly.`
        );
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {/* 2 Clear Method Tabs */}
      <div className={styles.methodTabs}>
        <button
          type="button"
          className={`${styles.methodTabBtn} ${
            activeMethod === 'gps' ? styles.methodTabBtnActive : ''
          }`}
          onClick={() => setActiveMethod('gps')}
        >
          <Compass size={16} />
          <span>Method 1: Use Current Location</span>
        </button>

        <button
          type="button"
          className={`${styles.methodTabBtn} ${
            activeMethod === 'search' ? styles.methodTabBtnActive : ''
          }`}
          onClick={() => setActiveMethod('search')}
        >
          <Search size={16} />
          <span>Method 2: Search Venue / Address</span>
        </button>
      </div>

      {/* METHOD 1: Use Current Location */}
      {activeMethod === 'gps' && (
        <div className={styles.cardContainer}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <div className={styles.cardIconCircle}>
                <Crosshair size={20} />
              </div>
              <div className={styles.cardTitleGroup}>
                <span className={styles.cardTitle}>Sync from Current Physical Device</span>
                <span className={styles.cardSubtitle}>
                  Acquires your device’s current GPS location to place the centerpoint directly on your building.
                </span>
              </div>
            </div>
          </div>

          <div className={styles.gpsActionRow}>
            <span className={styles.helperText}>
              Ensure location services are enabled on your browser and device.
            </span>
            {onUseCurrentLocation && (
              <button
                type="button"
                className={styles.gpsActionBtn}
                onClick={onUseCurrentLocation}
                disabled={isLocating}
                title="Acquire current location coordinates"
              >
                {isLocating ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>Acquiring GPS Lock...</span>
                  </>
                ) : (
                  <>
                    <Navigation size={16} />
                    <span>Use My Current Location</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* METHOD 2: Search Venue / Address */}
      {activeMethod === 'search' && (
        <div className={styles.cardContainer}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <div className={styles.cardIconCircle}>
                <Search size={20} />
              </div>
              <div className={styles.cardTitleGroup}>
                <span className={styles.cardTitle}>Search Venue or Address</span>
                <span className={styles.cardSubtitle}>
                  Search by street name, church or building name, or paste latitude and longitude coordinates.
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleExecuteSearch} className={styles.searchForm}>
            <div className={styles.inputWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Enter street, landmark, city, or coordinates (e.g. 4.9750, 8.3417)..."
                value={addressQuery}
                onChange={(e) => {
                  setAddressQuery(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
              />

              {isSearching && !addressQuery && (
                <div style={{ position: 'absolute', right: '14px', display: 'flex', alignItems: 'center' }}>
                  <Loader2 size={16} className={styles.spinner} color="#2563EB" />
                </div>
              )}

              {addressQuery && (
                <button
                  type="button"
                  className={styles.clearInputBtn}
                  onClick={() => {
                    setAddressQuery('');
                    setSuggestions([]);
                    setShowDropdown(false);
                    setSearchError(null);
                  }}
                  title="Clear input"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              type="submit"
              className={styles.searchSubmitBtn}
              title="Search and center map on this location"
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 size={15} className={styles.spinner} />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Navigation size={15} />
                  <span>Locate on Map</span>
                </>
              )}
            </button>

            {/* Suggestions Autocomplete Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <ul className={styles.suggestionsList}>
                {suggestions.map((item) => (
                  <li
                    key={item.id}
                    className={styles.suggestionItem}
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <MapPin size={16} className={styles.suggestionIcon} />
                    <div className={styles.suggestionTexts}>
                      <span className={styles.suggestionName}>{item.name}</span>
                      <span className={styles.suggestionSub}>{item.displayName}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {/* Quick Town Jump Chips */}
          <div className={styles.quickCityRow}>
            <span className={styles.quickCityLabel}>
              <MapPin size={12} />
              Quick jump:
            </span>
            {PRESET_CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                className={styles.cityPill}
                onClick={() => handleQuickCitySelect(city)}
                title={`Jump to ${city.name}, ${city.state}`}
              >
                <span>{city.name}</span>
              </button>
            ))}
          </div>

          <div className={styles.helperText}>
            <MapPin size={14} style={{ flexShrink: 0 }} />
            <span>
              Tip: When located, you can also fine-tune the centerpoint by clicking or dragging the blue pin on the map below.
            </span>
          </div>

          {searchError && (
            <div className={styles.feedbackError}>
              <AlertCircle size={15} />
              <span>{searchError}</span>
            </div>
          )}

          {successFeedback && (
            <div className={styles.feedbackSuccess}>
              <CheckCircle2 size={15} />
              <span>{successFeedback}</span>
            </div>
          )}
        </div>
      )}

      {/* Confirmed Active Pinpoint Badge */}
      <div className={styles.pinnedRow}>
        <div className={styles.pinnedCard}>
          <div className={styles.pinnedText}>
            <CheckCircle2 size={15} color="#166534" />
            <span>Active Pinpoint:</span>
            <span className={styles.pinnedLabel}>
              {pinnedName
                ? pinnedName.length > 50
                  ? `${pinnedName.slice(0, 50)}...`
                  : pinnedName
                : 'Premises Location Anchor'}
            </span>
          </div>
          <span className={styles.pinnedCoords}>
            {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
          </span>
        </div>
      </div>
    </div>
  );
};
