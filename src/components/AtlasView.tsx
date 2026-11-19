import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Search,
  Bookmark,
  BookmarkCheck,
  Navigation,
  Eye,
  X,
  ExternalLink,
  Footprints,
  TrainFront,
  Bike,
  Loader2,
  Compass,
  MapPin,
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  ATLAS_CATEGORIES,
  ISCTE_CAMPUS,
  LISBON_TRANSIT_LINES,
} from '../data/lisbonData';
import {
  AtlasCategory,
  LatLngLiteral,
  LivePlace,
  NearbyTransitStop,
  RouteSummary,
  SavedSpot,
} from '../types';
import { handleMapsApiError } from '../utils/mapsQuota';
import {
  drawStyledRoutePolylines,
  formatDistance,
  haversineMeters,
  parseComputedRoute,
} from '../utils/routeHelpers';
import { StreetViewPanel } from './StreetViewPanel';
import { RouteBreakdown } from './RouteBreakdown';
import { MapLayersSync, MapLayerToolbar } from './MapLayerControls';

interface AtlasViewProps {
  savedSpots: SavedSpot[];
  onToggleSaveSpot: (place: LivePlace, note?: string) => void;
  onUpdateSpotNote: (id: string, note: string) => void;
  onNotify: (message: string) => void;
  mapsReady: boolean;
  isDark: boolean;
}

interface AtlasMapControllerProps {
  places: LivePlace[];
  selectedPlace: LivePlace | null;
  routeOrigin: LatLngLiteral | null;
  routeDestination: LatLngLiteral | null;
  travelMode: 'TRANSIT' | 'WALKING' | 'BICYCLING';
  selectedRouteIndex: number;
  onRoutesCalculated: (routes: RouteSummary[], error: string | null, loading: boolean) => void;
  recenterSignal: number;
  panTarget: LatLngLiteral | null;
  isDark: boolean;
}

function formatPriceLevel(level: any): string | null {
  if (!level) return null;
  const s = String(level).toUpperCase();
  if (s.includes('FREE')) return 'Free';
  if (s.includes('INEXPENSIVE')) return '€';
  if (s.includes('MODERATE')) return '€€';
  if (s.includes('VERY_EXPENSIVE')) return '€€€€';
  if (s.includes('EXPENSIVE')) return '€€€';
  return null;
}

const AtlasMapController: React.FC<AtlasMapControllerProps> = ({
  places,
  selectedPlace,
  routeOrigin,
  routeDestination,
  travelMode,
  selectedRouteIndex,
  onRoutesCalculated,
  recenterSignal,
  panTarget,
  isDark,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const computedRawRoutesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || recenterSignal === 0) return;
    map.panTo(ISCTE_CAMPUS.location);
    map.setZoom(14);
  }, [map, recenterSignal]);

  useEffect(() => {
    if (!map || !panTarget) return;
    map.panTo(panTarget);
    map.setZoom(15);
  }, [map, panTarget]);

  useEffect(() => {
    if (!map || !selectedPlace) return;
    map.panTo(selectedPlace.location);
    if ((map.getZoom() ?? 13) < 14) {
      map.setZoom(15);
    }
  }, [map, selectedPlace]);

  useEffect(() => {
    if (!map || places.length === 0 || selectedPlace) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(ISCTE_CAMPUS.location);
    places.slice(0, 12).forEach((p) => bounds.extend(p.location));
    map.fitBounds(bounds, { top: 64, right: 48, bottom: 48, left: 48 });
  }, [map, places, selectedPlace]);

  // Compute routes when origin/destination/mode changes
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    computedRawRoutesRef.current = [];

    if (!map || !routesLib || !routeOrigin || !routeDestination) {
      onRoutesCalculated([], null, false);
      return;
    }

    let cancelled = false;
    onRoutesCalculated([], null, true);

    const request: any = {
      origin: routeOrigin,
      destination: routeDestination,
      travelMode,
      computeAlternativeRoutes: travelMode === 'TRANSIT',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'localizedValues'],
    };

    (routesLib.Route as any)
      .computeRoutes(request)
      .then(({ routes }: { routes: any[] }) => {
        if (cancelled) return;
        if (!routes || routes.length === 0) {
          onRoutesCalculated([], 'No direct route found for this travel mode.', false);
          return;
        }
        computedRawRoutesRef.current = routes;
        const parsed = routes.slice(0, 3).map((r) => parseComputedRoute(r, travelMode));
        onRoutesCalculated(parsed, null, false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        handleMapsApiError(err);
        onRoutesCalculated(
          [],
          'Could not calculate route right now. Try switching travel mode.',
          false
        );
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, routeOrigin, routeDestination, travelMode, onRoutesCalculated]);

  // Draw active alternative route polylines whenever selectedRouteIndex or theme changes
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || computedRawRoutesRef.current.length === 0) return;
    const raw =
      computedRawRoutesRef.current[selectedRouteIndex] || computedRawRoutesRef.current[0];
    if (!raw) return;

    polylinesRef.current = drawStyledRoutePolylines(map, raw, travelMode, isDark);
    if (raw.viewport) {
      map.fitBounds(raw.viewport, { top: 68, right: 52, bottom: 52, left: 52 });
    }
  }, [map, selectedRouteIndex, travelMode, isDark, routeOrigin, routeDestination]);

  return null;
};

export const AtlasView: React.FC<AtlasViewProps> = ({
  savedSpots,
  onToggleSaveSpot,
  onUpdateSpotNote,
  onNotify,
  mapsReady,
  isDark,
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [activeCategory, setActiveCategory] = useState<AtlasCategory | 'saved'>('architecture');
  const [places, setPlaces] = useState<LivePlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<LivePlace | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // Direct Google Places Search + Live Autocomplete (Zero AI)
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [sortBy, setSortBy] = useState<'default' | 'closest' | 'rating'>('default');
  const [openNowOnly, setOpenNowOnly] = useState(false);

  // Rich live place details (fetched via Place.fetchFields on selection)
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [nearbyStops, setNearbyStops] = useState<NearbyTransitStop[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);

  // Map Layers & Geolocation
  const [showTransitLayer, setShowTransitLayer] = useState(true);
  const [showBikeLayer, setShowBikeLayer] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [showMetroLegend, setShowMetroLegend] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLngLiteral | null>(null);
  const [locating, setLocating] = useState(false);
  const [panTarget, setPanTarget] = useState<LatLngLiteral | null>(null);

  // Routing State
  const [showStreetView, setShowStreetView] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [routeFrom, setRouteFrom] = useState<'iscte' | 'user'>('iscte');
  const [travelMode, setTravelMode] = useState<'TRANSIT' | 'WALKING' | 'BICYCLING'>('TRANSIT');
  const [routeOptions, setRouteOptions] = useState<RouteSummary[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');

  const handleRoutesCalculated = useCallback(
    (routes: RouteSummary[], error: string | null, loading: boolean) => {
      setRouteOptions(routes);
      setSelectedRouteIndex(0);
      setRouteError(error);
      setRouteLoading(loading);
    },
    []
  );

  // Live Autocomplete Suggestions as user types (Zero AI)
  useEffect(() => {
    if (!placesLib || !searchInput.trim() || searchInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchInput.trim(),
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['pt'],
          locationBias: {
            center: ISCTE_CAMPUS.location,
            radius: 12000,
          },
          language: 'en',
        });
        setSuggestions((res.suggestions || []).slice(0, 5));
      } catch (err) {
        handleMapsApiError(err);
        setSuggestions([]);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [placesLib, searchInput]);

  const runLivePlacesSearch = useCallback(
    async (query: string, category: AtlasCategory | 'search') => {
      if (!placesLib) return;
      setLoadingPlaces(true);
      setPlacesError(null);
      setSelectedPlace(null);
      setShowRoute(false);
      setShowStreetView(false);

      try {
        const { Place } = placesLib;
        const { places: rawPlaces } = await Place.searchByText({
          textQuery: query,
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'rating',
            'userRatingCount',
            'regularOpeningHours',
            'priceLevel',
            'primaryTypeDisplayName',
            'websiteURI',
            'googleMapsURI',
            'photos',
          ],
          locationBias: {
            center: ISCTE_CAMPUS.location,
            radius: 5000,
          },
          maxResultCount: 14,
          language: 'en',
          region: 'PT',
        });

        const mapped: LivePlace[] = (rawPlaces || [])
          .filter((p) => p.location)
          .map((p: any) => {
            const loc = p.location!;
            let openNow: boolean | null = null;
            try {
              if (typeof p.isOpen === 'function') {
                openNow = p.isOpen();
              }
            } catch {
              openNow = null;
            }
            const photoUrl = p.photos?.[0]?.getURI?.({ maxWidth: 640 }) ?? null;
            return {
              id: p.id,
              displayName: p.displayName || 'Unnamed location',
              formattedAddress: p.formattedAddress || 'Lisbon, Portugal',
              location: {
                lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
                lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
              },
              rating: p.rating ?? null,
              userRatingCount: p.userRatingCount ?? null,
              openNow,
              weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions || undefined,
              priceLevel: formatPriceLevel(p.priceLevel),
              primaryTypeDisplayName: p.primaryTypeDisplayName || undefined,
              websiteURI: p.websiteURI ?? null,
              googleMapsURI: p.googleMapsURI ?? null,
              photoUrl,
              category,
            };
          });

        setPlaces(mapped);
        if (mapped.length === 0) {
          setPlacesError('No places matched that query around Lisbon. Try broadening your search.');
        }
      } catch (err: any) {
        console.error('Places searchByText error:', err);
        const quotaHit = handleMapsApiError(err);
        setPlacesError(
          quotaHit
            ? 'Google Maps Places quota reached. Saved offline spots remain available.'
            : 'Unable to load live Lisbon places right now. Check connection and retry.'
        );
      } finally {
        setLoadingPlaces(false);
      }
    },
    [placesLib]
  );

  useEffect(() => {
    if (activeCategory === 'saved') {
      const mapped: LivePlace[] = savedSpots.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        formattedAddress: s.formattedAddress,
        location: s.location,
        googleMapsURI: s.googleMapsURI,
        category: 'saved',
      }));
      setPlaces(mapped);
      setPlacesError(null);
      return;
    }

    if (!placesLib) return;
    const cat = ATLAS_CATEGORIES.find((c) => c.id === activeCategory);
    if (cat) {
      void runLivePlacesSearch(cat.searchQuery, activeCategory);
    }
  }, [activeCategory, placesLib, runLivePlacesSearch, savedSpots.length]);

  const enrichPlaceAndTransit = useCallback(
    async (basePlace: LivePlace) => {
      if (!placesLib) return;
      setLoadingDetails(true);
      setLoadingStops(true);
      setNearbyStops([]);
      setShowHours(false);

      // 1. Fetch extended Place fields (editorial summary, phone, full opening hours, photo)
      try {
        if (basePlace.id && basePlace.category !== 'saved') {
          const placeObj = new placesLib.Place({ id: basePlace.id });
          await placeObj.fetchFields({
            fields: [
              'editorialSummary',
              'nationalPhoneNumber',
              'regularOpeningHours',
              'priceLevel',
              'photos',
              'websiteURI',
              'googleMapsURI',
            ],
          });
          const raw: any = placeObj;
          let openNow: boolean | null = basePlace.openNow ?? null;
          try {
            if (typeof raw.isOpen === 'function') {
              const check = raw.isOpen();
              if (typeof check === 'boolean') openNow = check;
            }
          } catch {
            // Keep existing openNow
          }
          setSelectedPlace((prev) =>
            prev && prev.id === basePlace.id
              ? {
                  ...prev,
                  editorialSummary: raw.editorialSummary || prev.editorialSummary || null,
                  nationalPhoneNumber: raw.nationalPhoneNumber || prev.nationalPhoneNumber || null,
                  weekdayDescriptions:
                    raw.regularOpeningHours?.weekdayDescriptions || prev.weekdayDescriptions,
                  priceLevel: formatPriceLevel(raw.priceLevel) || prev.priceLevel,
                  openNow,
                  photoUrl: raw.photos?.[0]?.getURI?.({ maxWidth: 800 }) || prev.photoUrl || null,
                  websiteURI: raw.websiteURI || prev.websiteURI,
                  googleMapsURI: raw.googleMapsURI || prev.googleMapsURI,
                }
              : prev
          );
        }
      } catch (err) {
        handleMapsApiError(err);
      } finally {
        setLoadingDetails(false);
      }

      // 2. Fetch live nearest Metro / Train / Bus stations within 650m via Place.searchNearby
      try {
        const { Place } = placesLib;
        const { places: stops } = await Place.searchNearby({
          fields: ['id', 'displayName', 'location', 'primaryTypeDisplayName'],
          locationRestriction: {
            center: basePlace.location,
            radius: 650,
          },
          includedPrimaryTypes: ['subway_station', 'train_station', 'transit_station', 'bus_stop'],
          maxResultCount: 5,
          rankPreference: 'DISTANCE' as any,
          language: 'en',
        });

        const parsedStops: NearbyTransitStop[] = (stops || [])
          .filter((s) => s.location)
          .map((s: any) => {
            const loc = {
              lat: typeof s.location.lat === 'function' ? s.location.lat() : s.location.lat,
              lng: typeof s.location.lng === 'function' ? s.location.lng() : s.location.lng,
            };
            const dist = haversineMeters(basePlace.location, loc);
            return {
              id: s.id,
              name: s.displayName || 'Transit Stop',
              type: s.primaryTypeDisplayName || 'Transit',
              location: loc,
              distanceMeters: dist,
              walkMinutes: Math.max(1, Math.round(dist / 75)),
            };
          })
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 4);

        setNearbyStops(parsedStops);
      } catch (err) {
        handleMapsApiError(err);
      } finally {
        setLoadingStops(false);
      }
    },
    [placesLib]
  );

  const selectPlace = useCallback(
    (place: LivePlace) => {
      setSelectedPlace(place);
      setShowStreetView(false);
      setShowRoute(false);
      setRouteOptions([]);
      setRouteError(null);
      const existing = savedSpots.find((s) => s.id === place.id);
      setNoteDraft(existing?.note || '');
      void enrichPlaceAndTransit(place);
    },
    [savedSpots, enrichPlaceAndTransit]
  );

  const handleDirectSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSuggestions([]);
    const q = searchInput.trim();
    const withLisbon = q.toLowerCase().includes('lisbon') || q.toLowerCase().includes('lisboa')
      ? q
      : `${q}, Lisbon, Portugal`;
    await runLivePlacesSearch(withLisbon, 'search');
  };

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    setSuggestions([]);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'regularOpeningHours',
          'priceLevel',
          'primaryTypeDisplayName',
          'websiteURI',
          'googleMapsURI',
          'photos',
        ],
      });
      sessionTokenRef.current = null;
      const raw: any = place;
      if (raw.location) {
        const mapped: LivePlace = {
          id: raw.id || `sug-${Date.now()}`,
          displayName: raw.displayName || searchInput,
          formattedAddress: raw.formattedAddress || 'Lisbon, Portugal',
          location: {
            lat: typeof raw.location.lat === 'function' ? raw.location.lat() : raw.location.lat,
            lng: typeof raw.location.lng === 'function' ? raw.location.lng() : raw.location.lng,
          },
          rating: raw.rating ?? null,
          userRatingCount: raw.userRatingCount ?? null,
          weekdayDescriptions: raw.regularOpeningHours?.weekdayDescriptions || undefined,
          priceLevel: formatPriceLevel(raw.priceLevel),
          primaryTypeDisplayName: raw.primaryTypeDisplayName || undefined,
          websiteURI: raw.websiteURI ?? null,
          googleMapsURI: raw.googleMapsURI ?? null,
          photoUrl: raw.photos?.[0]?.getURI?.({ maxWidth: 800 }) ?? null,
          category: 'search',
        };
        setPlaces((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
        setSearchInput('');
        selectPlace(mapped);
      }
    } catch (err) {
      handleMapsApiError(err);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      onNotify('Geolocation is not supported on this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setPanTarget(loc);
        setLocating(false);
        onNotify('Located your position on the Lisbon map.');
      },
      () => {
        setLocating(false);
        onNotify('Location access denied — using ISCTE Entrecampos as anchor.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const displayedPlaces = useMemo(() => {
    let list = [...places];
    if (openNowOnly) {
      list = list.filter((p) => p.openNow === true);
    }
    if (sortBy === 'closest') {
      const anchor = userLocation || ISCTE_CAMPUS.location;
      list.sort(
        (a, b) => haversineMeters(anchor, a.location) - haversineMeters(anchor, b.location)
      );
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return list;
  }, [places, openNowOnly, sortBy, userLocation]);

  const activeCategoryDef = ATLAS_CATEGORIES.find((c) => c.id === activeCategory);
  const isSelectedSaved = selectedPlace
    ? savedSpots.some((s) => s.id === selectedPlace.id)
    : false;

  const activeOrigin =
    routeFrom === 'user' && userLocation ? userLocation : ISCTE_CAMPUS.location;
  const activeOriginLabel =
    routeFrom === 'user' && userLocation ? 'Your Location' : 'ISCTE Campus (Entrecampos)';

  // Transfer stop markers from active transit route
  const activeRouteSteps = routeOptions[selectedRouteIndex]?.steps || [];
  const transitStopPins = useMemo(() => {
    if (!showRoute) return [];
    const pins: Array<{ name: string; location: LatLngLiteral; color: string }> = [];
    for (const s of activeRouteSteps) {
      if (s.travelMode === 'TRANSIT') {
        if (s.departureStop && s.departureLocation) {
          pins.push({
            name: s.departureStop,
            location: s.departureLocation,
            color: s.lineColor || '#0071E3',
          });
        }
        if (s.arrivalStop && s.arrivalLocation) {
          pins.push({
            name: s.arrivalStop,
            location: s.arrivalLocation,
            color: s.lineColor || '#0071E3',
          });
        }
      }
    }
    return pins;
  }, [showRoute, activeRouteSteps]);

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[440px_1fr] xl:grid-cols-[470px_1fr] min-h-[calc(100vh-116px)] lg:h-[calc(100vh-61px)]">
      {/* Left Sidebar / Mobile Content Panel */}
      <section className="order-2 lg:order-1 flex flex-col bg-[#F5F5F7] dark:bg-[#0B0B0D] border-t lg:border-t-0 lg:border-r border-black/[0.06] dark:border-white/[0.08] lg:overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.08] space-y-3.5 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                Live Google Places & Lisbon Transit
              </p>
              <h1 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                Explore Lisbon
              </h1>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowMetroLegend((v) => !v)}
                className={`inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  showMetroLegend
                    ? 'bg-[#0071E3] text-white'
                    : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.09] dark:hover:bg-white/[0.14]'
                }`}
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lines</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPlace(null);
                  setShowRoute(false);
                  setRecenterSignal((n) => n + 1);
                }}
                className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:bg-black/[0.09] dark:hover:bg-white/[0.14] transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ISCTE</span>
              </button>
            </div>
          </div>

          {/* Collapsible Lisbon Metro & Rail Line Legend */}
          {showMetroLegend && (
            <div className="rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] p-3 space-y-2 text-xs">
              <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Lisbon Metro & Entrecampos Rail Lines
              </p>
              <div className="space-y-1.5">
                {LISBON_TRANSIT_LINES.map((line) => (
                  <div key={line.id} className="flex items-start gap-2">
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 mt-0.5"
                      style={{ backgroundColor: line.color, color: line.textColor }}
                    >
                      {line.badge}
                    </span>
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] leading-snug">
                      {line.iscteNote}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Google Places Search + Live Autocomplete (Zero AI) */}
          <div className="relative">
            <form onSubmit={handleDirectSearchSubmit} className="flex gap-2">
              <label htmlFor="atlas-search" className="sr-only">
                Search Google Places in Lisbon
              </label>
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-[#6E6E73] dark:text-[#98989D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="atlas-search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search places, print shops, museums, stations…"
                  className="w-full min-h-[42px] pl-10 pr-8 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] dark:focus:border-[#0A84FF] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] focus:outline-none transition-colors"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSuggestions([]);
                    }}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loadingPlaces || !mapsReady}
                className="min-h-[42px] px-4 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-sm font-medium hover:bg-[#0077ED] dark:hover:bg-[#3399FF] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Search
              </button>
            </form>

            {suggestions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 mt-1.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-xl divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
                {suggestions.map((sug, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="w-full text-left px-3.5 py-2.5 text-xs sm:text-sm text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] flex items-center gap-2.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
                      <span className="truncate">{sug.placePrediction?.text.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {ATLAS_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`min-h-[34px] px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F]'
                      : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.09] dark:hover:bg-white/[0.14]'
                  }`}
                >
                  {cat.shortLabel}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActiveCategory('saved')}
              className={`min-h-[34px] px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === 'saved'
                  ? 'bg-[#0071E3] dark:bg-[#0A84FF] text-white'
                  : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.09] dark:hover:bg-white/[0.14]'
              }`}
            >
              Saved ({savedSpots.length})
            </button>
          </div>

          {/* Sort & Filter Row */}
          {!selectedPlace && places.length > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                {(['default', 'closest', 'rating'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortBy(mode)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      sortBy === mode
                        ? 'bg-[#0071E3]/12 dark:bg-[#0A84FF]/20 text-[#0071E3] dark:text-[#0A84FF]'
                        : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white'
                    }`}
                  >
                    {mode === 'default' ? 'Top' : mode === 'closest' ? 'Closest' : 'Top Rated'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpenNowOnly((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  openNowOnly
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                Open now
              </button>
            </div>
          )}
        </div>

        {/* Place Detail Sheet OR Live List */}
        <div className="flex-1 lg:overflow-y-auto p-4 pb-24 lg:pb-6">
          {selectedPlace ? (
            <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {/* Live Google Places Photo */}
              {selectedPlace.photoUrl && (
                <div className="relative h-44 w-full bg-[#E5E5EA] dark:bg-[#2C2C2E]">
                  <img
                    src={selectedPlace.photoUrl}
                    alt={selectedPlace.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlace(null);
                      setShowRoute(false);
                    }}
                    aria-label="Back to place list"
                    className="absolute top-3 right-3 min-w-[36px] min-h-[36px] rounded-full bg-black/65 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
                      {selectedPlace.primaryTypeDisplayName && (
                        <span>{selectedPlace.primaryTypeDisplayName}</span>
                      )}
                      {selectedPlace.rating && (
                        <span className="tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                          ★ {selectedPlace.rating.toFixed(1)} ({selectedPlace.userRatingCount ?? 0})
                        </span>
                      )}
                      {selectedPlace.priceLevel && (
                        <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {selectedPlace.priceLevel}
                        </span>
                      )}
                      {selectedPlace.openNow !== null && selectedPlace.openNow !== undefined && (
                        <span
                          className={`font-semibold ${
                            selectedPlace.openNow
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {selectedPlace.openNow ? 'Open now' : 'Closed'}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                      {selectedPlace.displayName}
                    </h2>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5 leading-relaxed">
                      {selectedPlace.formattedAddress} ·{' '}
                      <span className="tabular-nums font-medium">
                        {formatDistance(haversineMeters(ISCTE_CAMPUS.location, selectedPlace.location))} from ISCTE
                      </span>
                    </p>
                  </div>
                  {!selectedPlace.photoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlace(null);
                        setShowRoute(false);
                      }}
                      aria-label="Back to place list"
                      className="min-w-[36px] min-h-[36px] rounded-full bg-black/[0.05] dark:bg-white/[0.08] flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {selectedPlace.editorialSummary && (
                  <p className="text-xs text-[#1D1D1F]/85 dark:text-[#F5F5F7]/85 leading-relaxed bg-[#F5F5F7] dark:bg-[#2C2C2E] p-3 rounded-xl">
                    {selectedPlace.editorialSummary}
                  </p>
                )}

                {/* Action Row */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoute((v) => !v);
                      setShowStreetView(false);
                    }}
                    className={`min-h-[42px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      showRoute
                        ? 'bg-[#0071E3] dark:bg-[#0A84FF] text-white'
                        : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.14]'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">Directions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStreetView((v) => !v)}
                    className={`min-h-[42px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      showStreetView
                        ? 'bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F]'
                        : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.14]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">Street View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToggleSaveSpot(selectedPlace, noteDraft);
                      onNotify(
                        isSelectedSaved
                          ? 'Removed from saved spots.'
                          : 'Saved offline to your device.'
                      );
                    }}
                    className={`min-h-[42px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isSelectedSaved
                        ? 'bg-[#0071E3]/12 dark:bg-[#0A84FF]/20 text-[#0071E3] dark:text-[#0A84FF]'
                        : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.14]'
                    }`}
                  >
                    {isSelectedSaved ? (
                      <BookmarkCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="whitespace-nowrap">{isSelectedSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>

                {/* Live Route & Step-by-Step Transit Breakdown */}
                {showRoute && (
                  <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex p-0.5 rounded-lg bg-black/[0.06] dark:bg-black/30 text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={() => setRouteFrom('iscte')}
                          className={`px-2.5 py-1 rounded-md cursor-pointer ${
                            routeFrom === 'iscte'
                              ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs'
                              : 'text-[#6E6E73] dark:text-[#98989D]'
                          }`}
                        >
                          From ISCTE
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!userLocation) {
                              handleLocateMe();
                            }
                            setRouteFrom('user');
                          }}
                          className={`px-2.5 py-1 rounded-md cursor-pointer ${
                            routeFrom === 'user'
                              ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs'
                              : 'text-[#6E6E73] dark:text-[#98989D]'
                          }`}
                        >
                          My Location
                        </button>
                      </div>

                      <div className="inline-flex p-0.5 rounded-lg bg-black/[0.06] dark:bg-black/30">
                        {(
                          [
                            { id: 'TRANSIT', icon: TrainFront, label: 'Transit' },
                            { id: 'WALKING', icon: Footprints, label: 'Walk' },
                            { id: 'BICYCLING', icon: Bike, label: 'Bike' },
                          ] as const
                        ).map((m) => {
                          const MIcon = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setTravelMode(m.id)}
                              className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                travelMode === m.id
                                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs'
                                  : 'text-[#6E6E73] dark:text-[#98989D]'
                              }`}
                            >
                              <MIcon className="w-3 h-3" aria-hidden="true" />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {routeLoading && (
                      <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D] py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                        <span>Finding live Lisbon transit lines & stops…</span>
                      </div>
                    )}
                    {routeError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{routeError}</p>
                    )}
                    {!routeLoading && routeOptions.length > 0 && (
                      <RouteBreakdown
                        routes={routeOptions}
                        selectedIndex={selectedRouteIndex}
                        onSelectRoute={setSelectedRouteIndex}
                        origin={activeOrigin}
                        destination={selectedPlace.location}
                        originLabel={activeOriginLabel}
                        destinationLabel={selectedPlace.displayName}
                      />
                    )}
                  </div>
                )}

                {showStreetView && (
                  <StreetViewPanel
                    location={selectedPlace.location}
                    label={selectedPlace.displayName}
                    heightClass="h-56"
                  />
                )}

                {/* Nearest Transit Stops (Live Google Places Nearby Search) */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                      <TrainFront className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                      <span>Nearest Metro & Transit Stops</span>
                    </span>
                    {loadingStops && (
                      <Loader2 className="w-3 h-3 animate-spin text-[#6E6E73]" aria-hidden="true" />
                    )}
                  </div>
                  {!loadingStops && nearbyStops.length === 0 ? (
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                      Toggle Transit Lines on the map to view nearby stops.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {nearbyStops.map((stop) => (
                        <button
                          key={stop.id}
                          type="button"
                          onClick={() => setPanTarget(stop.location)}
                          className="w-full text-left px-3 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate block">
                              {stop.name}
                            </span>
                            <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">
                              {stop.type}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium tabular-nums text-[#0071E3] dark:text-[#0A84FF] shrink-0">
                            {stop.walkMinutes} min ({formatDistance(stop.distanceMeters)})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opening Hours & Contact */}
                {(selectedPlace.weekdayDescriptions?.length || selectedPlace.nationalPhoneNumber) && (
                  <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2 text-xs">
                    {selectedPlace.weekdayDescriptions && selectedPlace.weekdayDescriptions.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowHours((v) => !v)}
                          className="w-full flex items-center justify-between py-1 text-[#1D1D1F] dark:text-[#F5F5F7] font-medium cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
                            <span>Opening Hours</span>
                          </span>
                          {showHours ? (
                            <ChevronUp className="w-4 h-4 text-[#6E6E73]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#6E6E73]" />
                          )}
                        </button>
                        {showHours && (
                          <ul className="mt-1.5 space-y-1 pl-5 text-[11px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                            {selectedPlace.weekdayDescriptions.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {selectedPlace.nationalPhoneNumber && (
                      <a
                        href={`tel:${selectedPlace.nationalPhoneNumber}`}
                        className="inline-flex items-center gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0071E3] dark:hover:text-[#0A84FF]"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
                        <span className="tabular-nums">{selectedPlace.nationalPhoneNumber}</span>
                      </a>
                    )}
                  </div>
                )}

                {loadingDetails && (
                  <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    <span>Loading hours & details…</span>
                  </p>
                )}

                {/* Personal Offline Note */}
                <div className="space-y-1.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <label
                    htmlFor="spot-note"
                    className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
                  >
                    Personal note (saved offline)
                  </label>
                  <textarea
                    id="spot-note"
                    rows={2}
                    value={noteDraft}
                    onChange={(e) => {
                      setNoteDraft(e.target.value);
                      if (isSelectedSaved) {
                        onUpdateSpotNote(selectedPlace.id, e.target.value);
                      }
                    }}
                    placeholder="Good A1 plotting, outlets by window, €9 prato do dia…"
                    className="w-full p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] dark:focus:border-[#0A84FF] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-5 pt-1 text-xs">
                  {selectedPlace.googleMapsURI && (
                    <a
                      href={selectedPlace.googleMapsURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#0071E3] dark:text-[#0A84FF] font-medium hover:underline"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                  {selectedPlace.websiteURI && (
                    <a
                      href={selectedPlace.websiteURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white hover:underline"
                    >
                      <span>Website</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeCategoryDef && (
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] px-1 leading-relaxed">
                  {activeCategoryDef.description}
                </p>
              )}

              {loadingPlaces && (
                <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] p-6 flex items-center gap-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  <span>Loading live Lisbon places…</span>
                </div>
              )}

              {placesError && !loadingPlaces && (
                <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] p-5 text-xs text-red-600 dark:text-red-400">
                  {placesError}
                </div>
              )}

              {!loadingPlaces && !placesError && displayedPlaces.length === 0 && (
                <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-6 text-sm text-[#6E6E73] dark:text-[#98989D] space-y-1.5">
                  <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {activeCategory === 'saved'
                      ? 'No saved spots yet'
                      : openNowOnly
                      ? 'No places currently marked open'
                      : 'Choose a category or search Lisbon'}
                  </p>
                  <p className="text-xs leading-relaxed">
                    {activeCategory === 'saved'
                      ? 'Tap any architecture site, print shop, study cafe, or tasca and press Save to keep it offline.'
                      : openNowOnly
                      ? 'Turn off the Open now filter to see all live results.'
                      : 'All pins load live from Google Places around ISCTE Entrecampos.'}
                  </p>
                </div>
              )}

              {!loadingPlaces && displayedPlaces.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  {displayedPlaces.map((place, index) => {
                    const saved = savedSpots.some((s) => s.id === place.id);
                    const distFromIscte = haversineMeters(ISCTE_CAMPUS.location, place.location);
                    return (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="w-full text-left px-4 py-3.5 hover:bg-black/[0.025] dark:hover:bg-white/[0.04] transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <span className="w-6 h-6 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[11px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center mt-0.5 shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                              {place.displayName}
                            </h3>
                            <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D] tabular-nums shrink-0">
                              {formatDistance(distFromIscte)}
                            </span>
                          </div>
                          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                            {place.formattedAddress}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6E6E73] dark:text-[#98989D] mt-1 tabular-nums">
                            {place.rating && (
                              <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">
                                ★ {place.rating.toFixed(1)}
                              </span>
                            )}
                            {place.priceLevel && <span>· {place.priceLevel}</span>}
                            {place.openNow !== null && place.openNow !== undefined && (
                              <span
                                className={
                                  place.openNow
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                    : 'text-red-500 dark:text-red-400'
                                }
                              >
                                · {place.openNow ? 'Open' : 'Closed'}
                              </span>
                            )}
                            {place.primaryTypeDisplayName && (
                              <span className="truncate">· {place.primaryTypeDisplayName}</span>
                            )}
                            {saved && (
                              <BookmarkCheck
                                className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF] shrink-0"
                                aria-label="Saved offline"
                              />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Right Interactive Google Map with Live TransitLayer, Bike Lanes & Satellite */}
      <section className="order-1 lg:order-2 relative w-full h-[46vh] min-h-[320px] lg:h-full bg-[#E5E5EA] dark:bg-[#1C1C1E]">
        {mapsReady && (
          <MapLayerToolbar
            showTransitLayer={showTransitLayer}
            onToggleTransitLayer={() => setShowTransitLayer((v) => !v)}
            showBikeLayer={showBikeLayer}
            onToggleBikeLayer={() => setShowBikeLayer((v) => !v)}
            mapType={mapType}
            onToggleMapType={() => setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))}
            onLocateMe={handleLocateMe}
            locating={locating}
          />
        )}

        {mapsReady ? (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            colorScheme={isDark ? 'DARK' : 'LIGHT'}
            defaultCenter={ISCTE_CAMPUS.location}
            defaultZoom={14}
            gestureHandling="greedy"
            disableDefaultUI={false}
            streetViewControl={false}
            mapTypeControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            <MapLayersSync
              showTransitLayer={showTransitLayer}
              showBikeLayer={showBikeLayer}
              mapType={mapType}
            />

            <AdvancedMarker
              position={ISCTE_CAMPUS.location}
              title={ISCTE_CAMPUS.name}
              zIndex={40}
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071E3] text-white border-2 border-white shadow-md text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>ISCTE</span>
              </div>
            </AdvancedMarker>

            {userLocation && (
              <AdvancedMarker position={userLocation} title="Your Location" zIndex={45}>
                <div className="w-4 h-4 rounded-full bg-[#0071E3] border-[3px] border-white shadow-lg ring-4 ring-[#0071E3]/25" />
              </AdvancedMarker>
            )}

            {/* Boarding & alighting transit station markers along active route */}
            {transitStopPins.map((stop, idx) => (
              <AdvancedMarker
                key={`${stop.name}-${idx}`}
                position={stop.location}
                title={stop.name}
                zIndex={35}
              >
                <div
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white border-2 border-white shadow-md whitespace-nowrap"
                  style={{ backgroundColor: stop.color }}
                >
                  {stop.name}
                </div>
              </AdvancedMarker>
            ))}

            {displayedPlaces.map((place, index) => {
              const isSelected = selectedPlace?.id === place.id;
              return (
                <AdvancedMarker
                  key={place.id}
                  position={place.location}
                  title={place.displayName}
                  zIndex={isSelected ? 50 : 20}
                  onClick={() => selectPlace(place)}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums border-2 transition-transform cursor-pointer ${
                      isSelected
                        ? 'bg-[#0071E3] text-white border-white scale-120 shadow-lg'
                        : 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] border-[#1D1D1F]/20 dark:border-white/30 shadow-md hover:scale-110'
                    }`}
                  >
                    {index + 1}
                  </div>
                </AdvancedMarker>
              );
            })}

            <AtlasMapController
              places={displayedPlaces}
              selectedPlace={selectedPlace}
              routeOrigin={showRoute && selectedPlace ? activeOrigin : null}
              routeDestination={showRoute && selectedPlace ? selectedPlace.location : null}
              travelMode={travelMode}
              selectedRouteIndex={selectedRouteIndex}
              onRoutesCalculated={handleRoutesCalculated}
              recenterSignal={recenterSignal}
              panTarget={panTarget}
              isDark={isDark}
            />
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 text-center text-sm text-[#6E6E73] dark:text-[#98989D]">
            Loading Lisbon map…
          </div>
        )}
      </section>
    </div>
  );
};
