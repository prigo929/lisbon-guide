import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Search,
  TrainFront,
  Footprints,
  Bike,
  Eye,
  MapPin,
  Loader2,
  ExternalLink,
  Volume2,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  Coffee,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mountain,
  Building,
  Square,
} from 'lucide-react';
import {
  ISCTE_CAMPUS,
  LANDLORD_QUESTIONS_PT,
  LEASE_CHECKLIST_ITEMS,
  LISBON_NEIGHBORHOODS,
} from '../data/lisbonData';
import {
  HousingAnalysis,
  LatLngLiteral,
  NearbyAmenity,
  NeighborhoodDossier,
  RouteSummary,
} from '../types';
import { handleMapsApiError } from '../utils/mapsQuota';
import {
  buildAppleMapsPlaceUrl,
  buildGoogleMapsPlaceUrl,
  drawStyledRoutePolylines,
  formatDistance,
  haversineMeters,
  parseComputedRoute,
} from '../utils/routeHelpers';
import { StreetViewPanel } from './StreetViewPanel';
import { RouteBreakdown } from './RouteBreakdown';
import { MapLayersSync, MapLayerToolbar } from './MapLayerControls';

interface HousingViewProps {
  mapsReady: boolean;
  isDark: boolean;
  onSpeakPt: (text: string) => void;
  speakingText: string | null;
  speakingLoadingText: string | null;
}

interface HousingRouteOverlayProps {
  origin: LatLngLiteral | null;
  travelMode: 'TRANSIT' | 'WALKING' | 'BICYCLING';
  selectedRouteIndex: number;
  isDark: boolean;
  onCommuteMeasured: (
    transitRoutes: RouteSummary[],
    walkingRoute: RouteSummary | null,
    bikeRoute: RouteSummary | null,
    error: string | null,
    loading: boolean
  ) => void;
}

const HousingRouteOverlay: React.FC<HousingRouteOverlayProps> = ({
  origin,
  travelMode,
  selectedRouteIndex,
  isDark,
  onCommuteMeasured,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [rawRoutes, setRawRoutes] = useState<{
    transit: any[];
    walk: any | null;
    bike: any | null;
  }>({ transit: [], walk: null, bike: null });

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setRawRoutes({ transit: [], walk: null, bike: null });

    if (!map || !routesLib || !origin) {
      onCommuteMeasured([], null, null, null, false);
      return;
    }

    let cancelled = false;
    onCommuteMeasured([], null, null, null, true);

    const compute = async (mode: 'TRANSIT' | 'WALKING' | 'BICYCLING') => {
      try {
        const res = await (routesLib.Route as any).computeRoutes({
          origin,
          destination: ISCTE_CAMPUS.location,
          travelMode: mode,
          computeAlternativeRoutes: mode === 'TRANSIT',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'localizedValues'],
        });
        return res?.routes || [];
      } catch (err) {
        handleMapsApiError(err);
        return [];
      }
    };

    Promise.all([compute('TRANSIT'), compute('WALKING'), compute('BICYCLING')])
      .then(([transitRaw, walkRaw, bikeRaw]) => {
        if (cancelled) return;
        setRawRoutes({
          transit: transitRaw,
          walk: walkRaw[0] || null,
          bike: bikeRaw[0] || null,
        });

        const transitParsed = transitRaw
          .slice(0, 3)
          .map((r: any) => parseComputedRoute(r, 'TRANSIT'));
        const walkParsed = walkRaw[0] ? parseComputedRoute(walkRaw[0], 'WALKING') : null;
        const bikeParsed = bikeRaw[0] ? parseComputedRoute(bikeRaw[0], 'BICYCLING') : null;

        onCommuteMeasured(
          transitParsed,
          walkParsed,
          bikeParsed,
          transitParsed.length === 0 && !walkParsed
            ? 'Unable to compute commute route to ISCTE.'
            : null,
          false
        );
      })
      .catch(() => {
        if (!cancelled) {
          onCommuteMeasured([], null, null, 'Unable to compute commute route to ISCTE.', false);
        }
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin?.lat, origin?.lng, onCommuteMeasured]);

  // Draw active polyline cleanly whenever routes compute, mode changes, or alternative/theme changes
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    if (!map) return;

    const activeRaw =
      travelMode === 'TRANSIT'
        ? rawRoutes.transit[selectedRouteIndex] || rawRoutes.transit[0] || rawRoutes.walk
        : travelMode === 'BICYCLING'
        ? rawRoutes.bike || rawRoutes.walk
        : rawRoutes.walk || rawRoutes.transit[0];

    if (!activeRaw) return;
    polylinesRef.current = drawStyledRoutePolylines(map, activeRaw, travelMode, isDark);
    if (activeRaw.viewport) {
      map.fitBounds(activeRaw.viewport, { top: 56, right: 44, bottom: 44, left: 44 });
    }
  }, [map, rawRoutes, travelMode, selectedRouteIndex, isDark]);

  return null;
};

export const HousingView: React.FC<HousingViewProps> = ({
  mapsReady,
  isDark,
  onSpeakPt,
  speakingText,
  speakingLoadingText,
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [addressInput, setAddressInput] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [activeDossier, setActiveDossier] = useState<NeighborhoodDossier | null>(
    LISBON_NEIGHBORHOODS[3]
  );
  const [selectedLabel, setSelectedLabel] = useState<string>(LISBON_NEIGHBORHOODS[3].name);
  const [selectedLocation, setSelectedLocation] = useState<LatLngLiteral>(
    LISBON_NEIGHBORHOODS[3].coords
  );

  // Map Layers & Visual Mode
  const [activeVisual, setActiveVisual] = useState<'map' | 'streetview'>('map');
  const [showTransitLayer, setShowTransitLayer] = useState(true);
  const [showBikeLayer, setShowBikeLayer] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');

  // Commute routes
  const [routeMode, setRouteMode] = useState<'TRANSIT' | 'WALKING' | 'BICYCLING'>('TRANSIT');
  const [transitRoutes, setTransitRoutes] = useState<RouteSummary[]>([]);
  const [selectedTransitIdx, setSelectedTransitIdx] = useState(0);
  const [walkingCommute, setWalkingCommute] = useState<RouteSummary | null>(null);
  const [bikeCommute, setBikeCommute] = useState<RouteSummary | null>(null);
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteLoading, setCommuteLoading] = useState(false);

  // Live Nearby Amenities Audit (Zero AI — pure Google Places searchNearby)
  const [amenities, setAmenities] = useState<NearbyAmenity[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);
  const [amenityTab, setAmenityTab] = useState<'transit' | 'grocery' | 'cafe'>('transit');

  // Optional collapsed AI ad decoder (only if user pastes a raw Portuguese rental ad)
  const [showAiDecoder, setShowAiDecoder] = useState(false);
  const [listingText, setListingText] = useState('');
  const [analysis, setAnalysis] = useState<HousingAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleCommuteMeasured = useCallback(
    (
      transit: RouteSummary[],
      walking: RouteSummary | null,
      bike: RouteSummary | null,
      error: string | null,
      loading: boolean
    ) => {
      setTransitRoutes(transit);
      setSelectedTransitIdx(0);
      setWalkingCommute(walking);
      setBikeCommute(bike);
      setCommuteError(error);
      setCommuteLoading(loading);
    },
    []
  );

  // Live Nearby Transit, Supermarkets & Cafes around selected flat/neighborhood (Zero AI)
  useEffect(() => {
    if (!placesLib || !selectedLocation) return;
    let cancelled = false;
    setAmenitiesLoading(true);

    const fetchGroup = async (
      types: string[],
      category: NearbyAmenity['category'],
      radius: number
    ): Promise<NearbyAmenity[]> => {
      try {
        const { Place } = placesLib;
        const { places } = await Place.searchNearby({
          fields: ['id', 'displayName', 'location', 'primaryTypeDisplayName', 'rating', 'googleMapsURI'],
          locationRestriction: { center: selectedLocation, radius },
          includedPrimaryTypes: types,
          maxResultCount: 4,
          rankPreference: 'DISTANCE' as any,
          language: 'en',
        });
        return (places || [])
          .filter((p) => p.location)
          .map((p: any) => {
            const loc = {
              lat: typeof p.location.lat === 'function' ? p.location.lat() : p.location.lat,
              lng: typeof p.location.lng === 'function' ? p.location.lng() : p.location.lng,
            };
            const dist = haversineMeters(selectedLocation, loc);
            return {
              id: `${category}-${p.id}`,
              name: p.displayName || 'Place',
              category,
              typeLabel: p.primaryTypeDisplayName || category,
              distanceMeters: dist,
              walkMinutes: Math.max(1, Math.round(dist / 75)),
              rating: p.rating ?? null,
              location: loc,
              googleMapsURI: p.googleMapsURI ?? null,
            };
          });
      } catch (err) {
        handleMapsApiError(err);
        return [];
      }
    };

    Promise.all([
      fetchGroup(['subway_station', 'train_station', 'transit_station'], 'transit', 900),
      fetchGroup(['supermarket', 'grocery_store'], 'grocery', 850),
      fetchGroup(['cafe', 'coffee_shop', 'bakery'], 'cafe', 600),
    ])
      .then(([t, g, c]) => {
        if (!cancelled) {
          setAmenities([...t, ...g, ...c]);
        }
      })
      .finally(() => {
        if (!cancelled) setAmenitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [placesLib, selectedLocation]);

  // Street Autocomplete
  useEffect(() => {
    if (!placesLib || !addressInput.trim() || addressInput.trim().length < 3) {
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
          input: addressInput.trim(),
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['pt'],
          locationBias: {
            center: ISCTE_CAMPUS.location,
            radius: 12000,
          },
          language: 'en',
        });
        setSuggestions(res.suggestions || []);
      } catch (err) {
        handleMapsApiError(err);
        setSuggestions([]);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [placesLib, addressInput]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      if (place.location) {
        const loc = place.location;
        const coords = {
          lat: typeof loc.lat === 'function' ? loc.lat() : (loc as any).lat,
          lng: typeof loc.lng === 'function' ? loc.lng() : (loc as any).lng,
        };
        setSelectedLocation(coords);
        setSelectedLabel(place.formattedAddress || place.displayName || addressInput);
        // Find closest curated neighborhood dossier for context
        const nearest = [...LISBON_NEIGHBORHOODS].sort(
          (a, b) => haversineMeters(coords, a.coords) - haversineMeters(coords, b.coords)
        )[0];
        setActiveDossier(nearest || null);
        setAddressInput('');
        setSuggestions([]);
        sessionTokenRef.current = null;
      }
    } catch (err) {
      handleMapsApiError(err);
    }
  };

  const handleSelectNeighborhood = (dossier: NeighborhoodDossier) => {
    setActiveDossier(dossier);
    setSelectedLabel(dossier.name);
    setSelectedLocation(dossier.coords);
    setAnalysis(null);
  };

  const handleAnalyzeAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingText.trim()) return;
    setAnalyzing(true);
    setAnalysisError(null);
    const primaryTransit = transitRoutes[0];
    const commuteSummary = [
      primaryTransit ? `Transit: ${primaryTransit.durationMinutes} min` : null,
      walkingCommute
        ? `Walking: ${walkingCommute.durationMinutes} min (${formatDistance(walkingCommute.distanceMeters)})`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

    try {
      const res = await fetch('/api/ai/housing-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaName: selectedLabel,
          listingText: listingText.trim(),
          commuteSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not decode listing.');
      setAnalysis(data);
    } catch (err: any) {
      setAnalysisError(err?.message || 'Unable to decode rental ad right now.');
    } finally {
      setAnalyzing(false);
    }
  };

  const primaryTransit = transitRoutes[0] || null;
  const activeRouteList: RouteSummary[] =
    routeMode === 'TRANSIT'
      ? transitRoutes
      : routeMode === 'BICYCLING'
      ? bikeCommute
        ? [bikeCommute]
        : []
      : walkingCommute
      ? [walkingCommute]
      : [];

  const filteredAmenities = amenities.filter((a) => a.category === amenityTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 pb-24 lg:pb-12 space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
            Anchored to ISCTE · Av. das Forças Armadas, Entrecampos
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
            Flats & Neighborhoods
          </h1>
        </div>
        <p className="text-sm text-[#6E6E73] dark:text-[#98989D] max-w-md leading-relaxed">
          Compare Lisbon student districts, measure live Metro/bus lines to ISCTE, audit nearby supermarkets and stations, and inspect streets in Street View.
        </p>
      </div>

      {/* Neighborhood Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {LISBON_NEIGHBORHOODS.map((n) => {
          const active = activeDossier?.id === n.id && selectedLabel === n.name;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => handleSelectNeighborhood(n)}
              className={`min-h-[40px] px-4 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                active
                  ? 'bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F]'
                  : 'bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.03] dark:hover:bg-white/[0.08]'
              }`}
            >
              <span>{n.name}</span>
              <span className="opacity-65 tabular-nums">{n.rentRange.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Address Search, Commute Modes, Live Map/StreetView & Step-by-Step Transit */}
        <div className="lg:col-span-7 space-y-5">
          {/* Street Autocomplete */}
          <div className="relative">
            <label
              htmlFor="flat-address"
              className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-2"
            >
              Check any exact Lisbon street address or metro station
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#6E6E73] dark:text-[#98989D] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="flat-address"
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="e.g. Avenida Almirante Reis 115, Rua Morais Soares…"
                className="w-full min-h-[46px] pl-11 pr-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.10] focus:border-[#0071E3] dark:focus:border-[#0A84FF] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus:outline-none transition-colors"
              />
            </div>

            {suggestions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-xl divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
                {suggestions.map((sug, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="w-full text-left px-4 py-3 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] flex items-center gap-3 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
                      <span className="truncate">{sug.placePrediction?.text.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3 Live Commute Mode Cards */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setRouteMode('TRANSIT');
                setActiveVisual('map');
              }}
              className={`rounded-2xl p-4 text-left border transition-all cursor-pointer ${
                routeMode === 'TRANSIT'
                  ? 'bg-[#0071E3]/8 dark:bg-[#0A84FF]/15 border-[#0071E3]/35 dark:border-[#0A84FF]/45'
                  : 'bg-white dark:bg-[#1C1C1E] border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.05]'
              }`}
            >
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
                <TrainFront className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>Transit</span>
              </p>
              <p className="text-xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                {commuteLoading ? '…' : primaryTransit ? `${primaryTransit.durationMinutes} min` : '—'}
              </p>
              <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                {primaryTransit ? formatDistance(primaryTransit.distanceMeters) : 'To ISCTE'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setRouteMode('WALKING');
                setActiveVisual('map');
              }}
              className={`rounded-2xl p-4 text-left border transition-all cursor-pointer ${
                routeMode === 'WALKING'
                  ? 'bg-black/[0.05] dark:bg-white/[0.10] border-black/20 dark:border-white/25'
                  : 'bg-white dark:bg-[#1C1C1E] border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.05]'
              }`}
            >
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5 text-[#1D1D1F] dark:text-[#F5F5F7]" aria-hidden="true" />
                <span>Walk</span>
              </p>
              <p className="text-xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                {commuteLoading ? '…' : walkingCommute ? `${walkingCommute.durationMinutes} min` : '—'}
              </p>
              <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                {walkingCommute ? formatDistance(walkingCommute.distanceMeters) : 'To ISCTE'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setRouteMode('BICYCLING');
                setActiveVisual('map');
              }}
              className={`rounded-2xl p-4 text-left border transition-all cursor-pointer ${
                routeMode === 'BICYCLING'
                  ? 'bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500/35'
                  : 'bg-white dark:bg-[#1C1C1E] border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.05]'
              }`}
            >
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>GIRA Bike</span>
              </p>
              <p className="text-xl font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                {commuteLoading ? '…' : bikeCommute ? `${bikeCommute.durationMinutes} min` : '—'}
              </p>
              <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                {bikeCommute ? formatDistance(bikeCommute.distanceMeters) : 'To ISCTE'}
              </p>
            </button>
          </div>
          {commuteError && <p className="text-xs text-red-600 dark:text-red-400">{commuteError}</p>}

          {/* Interactive Map / Street View Card */}
          <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] truncate">
                {selectedLabel} → ISCTE
              </span>
              <div className="inline-flex p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveVisual('map')}
                  className={`min-h-[32px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeVisual === 'map'
                      ? 'bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white shadow-sm'
                      : 'text-[#6E6E73] dark:text-[#98989D]'
                  }`}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVisual('streetview')}
                  className={`min-h-[32px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeVisual === 'streetview'
                      ? 'bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white shadow-sm'
                      : 'text-[#6E6E73] dark:text-[#98989D]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Street View</span>
                </button>
              </div>
            </div>

            {activeVisual === 'map' ? (
              <div className="relative w-full h-[370px] sm:h-[420px] bg-[#E5E5EA] dark:bg-[#2C2C2E]">
                {mapsReady && (
                  <MapLayerToolbar
                    showTransitLayer={showTransitLayer}
                    onToggleTransitLayer={() => setShowTransitLayer((v) => !v)}
                    showBikeLayer={showBikeLayer}
                    onToggleBikeLayer={() => setShowBikeLayer((v) => !v)}
                    mapType={mapType}
                    onToggleMapType={() =>
                      setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))
                    }
                  />
                )}
                {mapsReady && (
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    colorScheme={isDark ? 'DARK' : 'LIGHT'}
                    defaultCenter={ISCTE_CAMPUS.location}
                    defaultZoom={13}
                    gestureHandling="greedy"
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

                    <AdvancedMarker position={ISCTE_CAMPUS.location} title={ISCTE_CAMPUS.name} zIndex={40}>
                      <div className="px-3 py-1 rounded-full bg-[#0071E3] text-white text-xs font-semibold border-2 border-white shadow">
                        ISCTE
                      </div>
                    </AdvancedMarker>
                    <AdvancedMarker position={selectedLocation} title={selectedLabel} zIndex={45}>
                      <div className="px-3 py-1 rounded-full bg-[#1D1D1F] text-white text-xs font-semibold border-2 border-white shadow">
                        Flat Area
                      </div>
                    </AdvancedMarker>

                    {/* Nearby amenity markers on the map */}
                    {filteredAmenities.map((item) => (
                      <AdvancedMarker
                        key={item.id}
                        position={item.location}
                        title={item.name}
                        zIndex={20}
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow" />
                      </AdvancedMarker>
                    ))}

                    <HousingRouteOverlay
                      origin={selectedLocation}
                      travelMode={routeMode}
                      selectedRouteIndex={selectedTransitIdx}
                      isDark={isDark}
                      onCommuteMeasured={handleCommuteMeasured}
                    />
                  </GoogleMap>
                )}
              </div>
            ) : (
              <div className="p-3">
                <StreetViewPanel
                  location={selectedLocation}
                  label={selectedLabel}
                  heightClass="h-[350px] sm:h-[400px]"
                />
              </div>
            )}
          </div>

          {/* Live Step-by-Step Transit Lines Breakdown to ISCTE */}
          {activeRouteList.length > 0 && (
            <div className="rounded-3xl bg-[#F5F5F7] dark:bg-[#1C1C1E]/60 border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Live Commute Lines to ISCTE
                </h2>
                <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                  Google Routes API
                </span>
              </div>
              <RouteBreakdown
                routes={activeRouteList}
                selectedIndex={routeMode === 'TRANSIT' ? selectedTransitIdx : 0}
                onSelectRoute={setSelectedTransitIdx}
                origin={selectedLocation}
                destination={ISCTE_CAMPUS.location}
                originLabel={selectedLabel}
                destinationLabel="ISCTE — Av. das Forças Armadas"
              />
            </div>
          )}

          {/* Live Nearby Essentials Audit (Zero AI — Google Places searchNearby) */}
          <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  Live Google Places Audit
                </p>
                <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Within Walking Distance
                </h2>
              </div>

              <div className="inline-flex p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] self-start">
                {(
                  [
                    { id: 'transit', label: 'Transit', icon: TrainFront },
                    { id: 'grocery', label: 'Groceries', icon: ShoppingBag },
                    { id: 'cafe', label: 'Cafes', icon: Coffee },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAmenityTab(t.id)}
                      className={`min-h-[32px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        amenityTab === t.id
                          ? 'bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white shadow-xs'
                          : 'text-[#6E6E73] dark:text-[#98989D]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {amenitiesLoading ? (
              <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D] py-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>Scanning nearby stations, supermarkets & cafes…</span>
              </div>
            ) : filteredAmenities.length === 0 ? (
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                No nearby places found within 900m for this category.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredAmenities.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-start justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                        {item.typeLabel}
                        {item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold tabular-nums text-[#0071E3] dark:text-[#0A84FF] block">
                        {item.walkMinutes} min
                      </span>
                      <span className="text-[10px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                        {formatDistance(item.distanceMeters)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Structured Neighborhood Dossier + Lease Checklist + Optional AI Ad Decoder */}
        <div className="lg:col-span-5 space-y-5">
          {/* Structured Curated Neighborhood Dossier (Zero AI — Instant!) */}
          {activeDossier && (
            <article className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="pb-4 border-b border-black/[0.06] dark:border-white/[0.08] space-y-2">
                <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  {activeDossier.vibeTag}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {activeDossier.name}
                  </h2>
                  <div className="flex items-center gap-2.5 text-xs font-semibold shrink-0">
                    <a
                      href={buildGoogleMapsPlaceUrl(activeDossier.coords, activeDossier.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#0071E3] dark:text-[#0A84FF] hover:underline"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <a
                      href={buildAppleMapsPlaceUrl(activeDossier.coords, activeDossier.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1D1D1F] dark:text-[#F5F5F7] hover:underline"
                    >
                      <span>Apple Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
                <p className="text-sm text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                  {activeDossier.summary}
                </p>

                {/* Metro & Rail Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {activeDossier.metroLines.map((line) => (
                    <span
                      key={line.label}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ backgroundColor: line.color, color: line.textColor }}
                    >
                      {line.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Structured Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                  <p className="text-[#6E6E73] dark:text-[#98989D]">Student Room Rent</p>
                  <p className="text-sm font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                    {activeDossier.rentRange}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                  <p className="text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1">
                    <Mountain className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Terrain / Hills</span>
                  </p>
                  <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                    {activeDossier.hilliness}
                  </p>
                </div>
              </div>

              <dl className="space-y-3.5 text-xs">
                <div>
                  <dt className="font-semibold text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Architecture & Urban Fabric</span>
                  </dt>
                  <dd className="text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 leading-relaxed">
                    {activeDossier.architectureNote}
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-[#6E6E73] dark:text-[#98989D]">
                    ISCTE Commute Pattern
                  </dt>
                  <dd className="text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 leading-relaxed">
                    {activeDossier.commuteNote}
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-[#6E6E73] dark:text-[#98989D]">
                    Best Streets to Look For
                  </dt>
                  <dd className="flex flex-wrap gap-1.5 mt-1.5">
                    {activeDossier.bestStreets.map((st) => (
                      <span
                        key={st}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] font-medium"
                      >
                        {st}
                      </span>
                    ))}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/[0.07] dark:bg-emerald-400/[0.10] space-y-1.5">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Highlights
                    </p>
                    <ul className="space-y-1 text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
                      {activeDossier.pros.map((pro, i) => (
                        <li key={i} className="flex gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-500/[0.07] dark:bg-amber-400/[0.10] space-y-1.5">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">
                      Trade-offs
                    </p>
                    <ul className="space-y-1 text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
                      {activeDossier.tradeoffs.map((t, i) => (
                        <li key={i} className="flex gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </dl>
            </article>
          )}

          {/* Structured Lisbon Rental Contract Checklist + Landlord PT Questions (Zero AI) */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div>
              <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                Before paying any deposit
              </p>
              <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                Lisbon Lease Essentials
              </h2>
            </div>

            <div className="space-y-2.5">
              {LEASE_CHECKLIST_ITEMS.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1">
                  <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {item.term}
                  </p>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                    {item.check}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
              <h3 className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D]">
                Ask the landlord in Portuguese (tap to play)
              </h3>
              <div className="space-y-2">
                {LANDLORD_QUESTIONS_PT.map((q, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {q.portuguese}
                      </p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                        {q.english}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSpeakPt(q.portuguese)}
                      aria-label={
                        speakingText === q.portuguese
                          ? `Stop audio for ${q.english}`
                          : `Play Portuguese pronunciation for ${q.english}`
                      }
                      className={`min-w-[40px] min-h-[40px] rounded-full shadow-xs flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        speakingText === q.portuguese
                          ? 'bg-[#0071E3] dark:bg-[#0A84FF] text-white'
                          : 'bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#0A84FF] hover:scale-105'
                      }`}
                    >
                      {speakingLoadingText === q.portuguese ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : speakingText === q.portuguese ? (
                        <Square className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Optional Collapsed AI Ad Decoder (Minimized — Only Used If User Pastes a Portuguese Ad) */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={() => setShowAiDecoder((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Optional AI tool
                </p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Decode a pasted Portuguese Idealista / lease ad
                </p>
              </div>
              {showAiDecoder ? (
                <ChevronUp className="w-4 h-4 text-[#6E6E73]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6E6E73]" />
              )}
            </button>

            {showAiDecoder && (
              <div className="px-5 pb-5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-4">
                <form onSubmit={handleAnalyzeAd} className="space-y-3">
                  <textarea
                    rows={4}
                    value={listingText}
                    onChange={(e) => setListingText(e.target.value)}
                    placeholder="Paste Portuguese ad text here (e.g. 'Quarto individual perto do metro Arroios, 550€ despesas não incluídas, 2 meses de caução')…"
                    className="w-full p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] dark:focus:border-[#0A84FF] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={analyzing || !listingText.trim()}
                    className="w-full min-h-[44px] rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#0077ED] disabled:opacity-50 cursor-pointer"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Decoding ad…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                        <span>Decode Portuguese Listing</span>
                      </>
                    )}
                  </button>
                  {analysisError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{analysisError}</p>
                  )}
                </form>

                {analysis && (
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3 text-xs">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {analysis.headline}
                    </p>
                    <p className="text-[#6E6E73] dark:text-[#98989D]">
                      Typical rent: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{analysis.typicalStudentRent}</strong>
                    </p>
                    {analysis.leaseRedFlags?.length > 0 && (
                      <ul className="space-y-1.5 p-3 rounded-xl bg-amber-500/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {analysis.leaseRedFlags.map((flag, i) => (
                          <li key={i}>· {flag}</li>
                        ))}
                      </ul>
                    )}
                    {analysis.sources?.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {analysis.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0071E3] dark:text-[#0A84FF] hover:underline truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
