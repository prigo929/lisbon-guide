import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CalendarPlus,
  CloudSun,
  Wind,
  Droplets,
  TrainFront,
  Bookmark,
  BookmarkCheck,
  Loader2,
  ExternalLink,
  Trash2,
  Compass,
  Sparkles,
  CheckCircle2,
  Ticket,
  Landmark,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { ISCTE_CAMPUS, TRIP_DESTINATIONS } from '../data/lisbonData';
import { CuratedTripPreset, LatLngLiteral, RouteSummary, TripPlan, WeatherSnapshot } from '../types';
import { downloadTripAsIcs } from '../utils/icsExport';
import { handleMapsApiError, notifyMapsQuotaExceeded } from '../utils/mapsQuota';
import {
  buildAppleMapsDirectionsUrl,
  buildGoogleMapsDirectionsUrl,
  drawStyledRoutePolylines,
  parseComputedRoute,
} from '../utils/routeHelpers';
import { RouteBreakdown } from './RouteBreakdown';
import { MapLayersSync, MapLayerToolbar } from './MapLayerControls';

interface TripsViewProps {
  savedTrips: TripPlan[];
  onSaveTrip: (trip: TripPlan) => void;
  onDeleteTrip: (id: string) => void;
  onNotify: (msg: string) => void;
  mapsReady: boolean;
  isDark: boolean;
}

function getNextSaturdayIso(): string {
  const now = new Date();
  const diff = (6 - now.getDay() + 7) % 7 || 7;
  const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  return sat.toISOString().slice(0, 10);
}

function presetToTripPlan(preset: CuratedTripPreset): TripPlan {
  return {
    id: `curated-${preset.id}`,
    destination: preset.name,
    title: `${preset.name} — Architecture & Day Trip`,
    transportBrief: `${preset.transitLine} from ${preset.departureStation}. ${preset.naveganteNote}`,
    architectureHighlight: preset.architectureHighlight,
    estimatedCostEur: `~€${preset.defaultBudget} (${preset.budgetBreakdown.transit} · ${preset.budgetBreakdown.food})`,
    packingTip: preset.packingTip,
    schedule: preset.schedule,
    sources: [],
  };
}

interface TripRouteOverlayProps {
  destination: LatLngLiteral;
  selectedRouteIndex: number;
  isDark: boolean;
  onRoutesComputed: (routes: RouteSummary[], error: string | null, loading: boolean) => void;
}

const TripRouteOverlay: React.FC<TripRouteOverlayProps> = ({
  destination,
  selectedRouteIndex,
  isDark,
  onRoutesComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [rawRoutes, setRawRoutes] = useState<any[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setRawRoutes([]);

    if (!map || !routesLib) return;
    let cancelled = false;
    onRoutesComputed([], null, true);

    (routesLib.Route as any)
      .computeRoutes({
        origin: ISCTE_CAMPUS.location,
        destination,
        travelMode: 'TRANSIT',
        computeAlternativeRoutes: true,
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'localizedValues'],
      })
      .then(({ routes }: { routes: any[] }) => {
        if (cancelled) return;
        const list = routes || [];
        setRawRoutes(list);
        const parsed = list.slice(0, 3).map((r: any) => parseComputedRoute(r, 'TRANSIT'));
        onRoutesComputed(
          parsed,
          parsed.length === 0 ? 'Live transit route unavailable at this hour; use Google or Apple Maps below.' : null,
          false
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        handleMapsApiError(err);
        onRoutesComputed([], 'Could not fetch live transit times right now.', false);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, destination.lat, destination.lng, onRoutesComputed]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    if (!map || rawRoutes.length === 0) return;

    const raw = rawRoutes[selectedRouteIndex] || rawRoutes[0];
    if (!raw) return;
    polylinesRef.current = drawStyledRoutePolylines(map, raw, 'TRANSIT', isDark);
    if (raw.viewport) {
      map.fitBounds(raw.viewport, { top: 48, right: 40, bottom: 40, left: 40 });
    }
  }, [map, rawRoutes, selectedRouteIndex, isDark]);

  return null;
};

export const TripsView: React.FC<TripsViewProps> = ({
  savedTrips,
  onSaveTrip,
  onDeleteTrip,
  onNotify,
  mapsReady,
  isDark,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(TRIP_DESTINATIONS[0].id);
  const [tripDate, setTripDate] = useState<string>(getNextSaturdayIso());

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Live Google Maps Transit Route state
  const [showTransitLayer, setShowTransitLayer] = useState(true);
  const [showBikeLayer, setShowBikeLayer] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [tripRoutes, setTripRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Optional custom AI town planner (collapsed by default so AI is only used when needed)
  const [showCustomAi, setShowCustomAi] = useState(false);
  const [customDestination, setCustomDestination] = useState('');
  const [customDuration, setCustomDuration] = useState('Full day trip');
  const [customBudgetEur, setCustomBudgetEur] = useState<number>(30);
  const [customPlan, setCustomPlan] = useState<TripPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activePreset =
    TRIP_DESTINATIONS.find((d) => d.id === selectedPresetId) || TRIP_DESTINATIONS[0];

  const handleRoutesComputed = useCallback(
    (routes: RouteSummary[], error: string | null, loading: boolean) => {
      setTripRoutes(routes);
      setSelectedRouteIdx(0);
      setRouteError(error);
      setRouteLoading(loading);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    setWeatherLoading(true);
    setWeatherError(null);

    fetch(`/api/weather?lat=${activePreset.coords.lat}&lng=${activePreset.coords.lng}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 || data?.quotaExceeded) {
          notifyMapsQuotaExceeded();
          throw new Error('Weather API quota reached.');
        }
        if (!res.ok) {
          throw new Error(data?.error || 'Live weather unavailable.');
        }
        return data as WeatherSnapshot;
      })
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setWeather(null);
          setWeatherError(err?.message || 'Unable to load current weather.');
        }
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePreset.id]);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setCustomPlan(null);
  };

  const handleGenerateCustomTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDestination.trim()) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch('/api/ai/trip-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: customDestination.trim(),
          duration: customDuration,
          budgetEur: customBudgetEur,
          weatherSummary: 'Check local Portugal forecast',
          transitSummary: 'From Lisbon Entrecampos / Oriente / Sete Rios',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate itinerary.');
      setCustomPlan({
        ...data,
        destination: customDestination.trim(),
      });
    } catch (err: any) {
      setPlanError(err?.message || 'Unable to plan custom trip right now.');
    } finally {
      setPlanLoading(false);
    }
  };

  const activeTripPlan = customPlan || presetToTripPlan(activePreset);
  const isPlanSaved = savedTrips.some(
    (t) => t.title === activeTripPlan.title && t.destination === activeTripPlan.destination
  );

  const handleExportIcs = (targetPlan: TripPlan) => {
    downloadTripAsIcs(targetPlan, tripDate);
    onNotify('Downloaded .ics file — tap it on iPhone to add to Apple Calendar.');
  };

  // Deterministic weather advisory badge (no AI)
  const weatherAdvice = weather
    ? (weather.rainChance ?? 0) >= 35
      ? 'Rain likely — bring a light waterproof shell.'
      : (weather.windKmh ?? 0) >= 24
      ? 'Strong Atlantic breeze — pack a windbreaker.'
      : (weather.temperatureC ?? 20) >= 24
      ? 'Warm & bright — pack water, sunscreen, and a hat.'
      : 'Comfortable walking weather for a day trip.'
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 pb-24 lg:pb-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
            Live train routes · Google Weather · Apple Calendar (.ics)
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
            Weekend Trips & Beaches
          </h1>
        </div>
        <p className="text-sm text-[#6E6E73] dark:text-[#98989D] max-w-md leading-relaxed">
          Complete curated day-trip schedules from ISCTE Entrecampos with Navegante pass coverage, live CP/bus lines on Google Maps, and live coastal weather.
        </p>
      </div>

      {/* Destination Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {TRIP_DESTINATIONS.map((dest) => {
          const active = selectedPresetId === dest.id && !customPlan;
          const imgFailed = failedImages[dest.id];
          return (
            <button
              key={dest.id}
              type="button"
              onClick={() => handleSelectPreset(dest.id)}
              className={`group text-left rounded-3xl bg-white dark:bg-[#1C1C1E] overflow-hidden border transition-all cursor-pointer flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
                active
                  ? 'border-[#0071E3] dark:border-[#0A84FF] ring-2 ring-[#0071E3]/25 dark:ring-[#0A84FF]/30'
                  : 'border-black/[0.06] dark:border-white/[0.08] hover:border-black/15 dark:hover:border-white/20'
              }`}
            >
              <div className="relative aspect-[16/10] w-full bg-[#E5E5EA] dark:bg-[#2C2C2E] overflow-hidden">
                {!imgFailed ? (
                  <img
                    src={dest.image}
                    alt={`${dest.name} — ${dest.subtitle}`}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((prev) => ({ ...prev, [dest.id]: true }))}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#E5E5EA] to-[#D1D1D6] dark:from-[#2C2C2E] dark:to-[#1C1C1E]">
                    <Compass className="w-6 h-6 text-[#0071E3] dark:text-[#0A84FF] mb-2" aria-hidden="true" />
                    <span className="font-semibold text-base text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {dest.name}
                    </span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-xs ${
                      dest.naveganteCovered
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-black/70 text-white'
                    }`}
                  >
                    {dest.naveganteCovered ? 'Navegante Free' : `~€${dest.defaultBudget} Weekend`}
                  </span>
                </div>
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                    <span>{dest.region}</span>
                    <span>~€{dest.defaultBudget}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                    {dest.name}
                  </h2>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-1 leading-relaxed">
                    {dest.subtitle}
                  </p>
                </div>
                <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] truncate">
                  {dest.transitTag}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Curated Trip Dossier + Live Maps Transit & Weather Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Live Weather, Live Transit Route Map & Step-by-Step Transit Lines */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Weather Card */}
          <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Live Google Weather
                </p>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  {activePreset.name}
                </h2>
              </div>
              <CloudSun className="w-6 h-6 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
            </div>

            {weatherLoading ? (
              <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D]">
                <Loader2 className="w-4 h-4 animate-spin text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>Checking current conditions…</span>
              </div>
            ) : weather ? (
              <>
                <div className="grid grid-cols-3 gap-3 tabular-nums">
                  <div>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">Temp</p>
                    <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {weather.temperatureC !== null ? `${Math.round(weather.temperatureC)}°` : '—'}
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">{weather.condition}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Wind</span>
                    </p>
                    <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {weather.windKmh !== null ? `${Math.round(weather.windKmh)}` : '—'}
                      <span className="text-xs font-normal text-[#6E6E73] dark:text-[#98989D] ml-0.5">
                        km/h
                      </span>
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                      UV {weather.uvIndex ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Rain</span>
                    </p>
                    <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {weather.rainChance !== null ? `${weather.rainChance}%` : '0%'}
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                      Humidity {weather.humidity ?? '—'}%
                    </p>
                  </div>
                </div>
                {weatherAdvice && (
                  <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2 rounded-xl">
                    {weatherAdvice}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                {weatherError || 'Weather snapshot unavailable.'}
              </p>
            )}
          </div>

          {/* Interactive Google Maps Transit Route from ISCTE */}
          <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                <TrainFront className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>Live Transit from ISCTE</span>
              </span>
              <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">
                Google Routes
              </span>
            </div>

            <div className="relative w-full h-[260px] bg-[#E5E5EA] dark:bg-[#2C2C2E]">
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
                  defaultCenter={activePreset.coords}
                  defaultZoom={11}
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
                  <AdvancedMarker position={ISCTE_CAMPUS.location} title="ISCTE Entrecampos">
                    <div className="px-2.5 py-1 rounded-full bg-[#0071E3] text-white text-[11px] font-semibold border-2 border-white shadow">
                      ISCTE
                    </div>
                  </AdvancedMarker>
                  <AdvancedMarker position={activePreset.coords} title={activePreset.name}>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1D1D1F] text-white text-[11px] font-semibold border-2 border-white shadow">
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      <span>{activePreset.name}</span>
                    </div>
                  </AdvancedMarker>
                  <TripRouteOverlay
                    destination={activePreset.coords}
                    selectedRouteIndex={selectedRouteIdx}
                    isDark={isDark}
                    onRoutesComputed={handleRoutesComputed}
                  />
                </GoogleMap>
              )}
            </div>

            <div className="p-4 bg-[#F5F5F7]/70 dark:bg-[#2C2C2E]/40">
              {routeLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071E3] dark:text-[#0A84FF]" />
                  <span>Loading CP train & bus connections…</span>
                </div>
              ) : tripRoutes.length > 0 ? (
                <RouteBreakdown
                  routes={tripRoutes}
                  selectedIndex={selectedRouteIdx}
                  onSelectRoute={setSelectedRouteIdx}
                  origin={ISCTE_CAMPUS.location}
                  destination={activePreset.coords}
                  originLabel="ISCTE Campus (Entrecampos)"
                  destinationLabel={activePreset.name}
                />
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                    {routeError || activePreset.transitTag}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={buildGoogleMapsDirectionsUrl(ISCTE_CAMPUS.location, activePreset.coords, 'TRANSIT')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </a>
                    <a
                      href={buildAppleMapsDirectionsUrl(ISCTE_CAMPUS.location, activePreset.coords, 'TRANSIT')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.10] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <span>Apple Maps</span>
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Optional Collapsed Custom Portugal Town Planner (AI) */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={() => setShowCustomAi((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Optional AI planner
                </p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Plan another town (Nazaré, Évora, Coimbra…)
                </p>
              </div>
              {showCustomAi ? (
                <ChevronUp className="w-4 h-4 text-[#6E6E73]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6E6E73]" />
              )}
            </button>

            {showCustomAi && (
              <form
                onSubmit={handleGenerateCustomTrip}
                className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3"
              >
                <input
                  type="text"
                  value={customDestination}
                  onChange={(e) => setCustomDestination(e.target.value)}
                  placeholder="Enter any town in Portugal (e.g. Évora, Óbidos, Coimbra)…"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className="min-h-[40px] px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7]"
                  >
                    <option value="Full day trip">Full day trip</option>
                    <option value="Weekend (2 days)">Weekend (2 days)</option>
                  </select>
                  <input
                    type="number"
                    min={10}
                    max={250}
                    value={customBudgetEur}
                    onChange={(e) => setCustomBudgetEur(Number(e.target.value) || 30)}
                    aria-label="Budget in Euros"
                    className="min-h-[40px] px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-xs font-medium tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={planLoading || !customDestination.trim()}
                  className="w-full min-h-[42px] rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {planLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{planLoading ? 'Building custom plan…' : 'Generate Custom Itinerary'}</span>
                </button>
                {planError && <p className="text-xs text-red-600 dark:text-red-400">{planError}</p>}
              </form>
            )}
          </section>
        </div>

        {/* Right Column (7 cols): Instant Complete Curated Guide + Budget + Schedule + Calendar Export */}
        <div className="lg:col-span-7 space-y-6">
          <article className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  <span>{activeTripPlan.destination}</span>
                  <span>·</span>
                  <span>{customPlan ? activeTripPlan.estimatedCostEur : `~€${activePreset.defaultBudget} student budget`}</span>
                  {customPlan && (
                    <button
                      type="button"
                      onClick={() => setCustomPlan(null)}
                      className="underline text-[#6E6E73] dark:text-[#98989D] ml-1 cursor-pointer"
                    >
                      Back to {activePreset.name}
                    </button>
                  )}
                </div>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                  {activeTripPlan.title}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  aria-label="Trip date for Apple Calendar export"
                  className="min-h-[40px] px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-xs font-medium tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]"
                />
                <button
                  type="button"
                  onClick={() => handleExportIcs(activeTripPlan)}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#0077ED] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Apple Calendar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveTrip({
                      ...activeTripPlan,
                      id: activeTripPlan.id || `trip-${Date.now()}`,
                      savedAt: new Date().toISOString(),
                    });
                    onNotify('Saved trip itinerary offline.');
                  }}
                  disabled={isPlanSaved}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-xs font-semibold inline-flex items-center gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {isPlanSaved ? (
                    <BookmarkCheck className="w-4 h-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                  ) : (
                    <Bookmark className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{isPlanSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Structured Logistics & Budget Grid (when viewing curated preset) */}
            {!customPlan ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1.5">
                    <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                      <span>Transit & Navegante Pass</span>
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                      <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">From:</strong>{' '}
                      {activePreset.departureStation}
                    </p>
                    <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                      {activePreset.naveganteNote}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1.5">
                    <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                      <span>Architecture & Landscape Focus</span>
                    </p>
                    <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                      {activePreset.architectureHighlight}
                    </p>
                  </div>
                </div>

                {/* Budget Breakdown Row */}
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">Transit</p>
                    <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 leading-snug">
                      {activePreset.budgetBreakdown.transit}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">Food</p>
                    <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 leading-snug">
                      {activePreset.budgetBreakdown.food}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">Entry / Extras</p>
                    <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 leading-snug">
                      {activePreset.budgetBreakdown.tickets}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                  <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                    Transit & Tickets
                  </p>
                  <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] mt-1.5 leading-relaxed">
                    {activeTripPlan.transportBrief}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                  <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                    Architecture Highlights
                  </p>
                  <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] mt-1.5 leading-relaxed">
                    {activeTripPlan.architectureHighlight}
                  </p>
                </div>
              </div>
            )}

            {/* Chronological Schedule */}
            <div>
              <h3 className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider mb-1">
                Chronological Day Plan
              </h3>
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {activeTripPlan.schedule.map((item, idx) => (
                  <div key={idx} className="py-3.5 flex items-start gap-4">
                    <div className="w-16 shrink-0 tabular-nums pt-0.5">
                      <div className="text-sm font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                        {item.time}
                      </div>
                      <div className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">
                        {item.durationMinutes} min
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                        {item.location}
                      </p>
                      <p className="text-xs text-[#1D1D1F]/85 dark:text-[#F5F5F7]/85 mt-1.5 leading-relaxed">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insider Tips & Packing */}
            {!customPlan && activePreset.insiderTips.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#0071E3]/[0.06] dark:bg-[#0A84FF]/[0.12] space-y-2">
                <p className="text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF] flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Lisbon Student Insider Tips</span>
                </p>
                <ul className="space-y-1.5 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                  {activePreset.insiderTips.map((tip, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF] shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">What to bring:</strong>{' '}
              {activeTripPlan.packingTip}
            </p>

            {activeTripPlan.sources?.length > 0 && (
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">Sources</p>
                <div className="flex flex-col gap-1.5">
                  {activeTripPlan.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#0071E3] dark:text-[#0A84FF] hover:underline truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Saved Offline Trips */}
          {savedTrips.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Saved Trips ({savedTrips.length})
                </h2>
                <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                  Available offline
                </span>
              </div>
              <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
                {savedTrips.map((t) => (
                  <div
                    key={t.id || t.title}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => setCustomPlan(t)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                        {t.destination} · {t.estimatedCostEur}
                      </p>
                      <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate mt-0.5">
                        {t.title}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleExportIcs(t)}
                        aria-label={`Export ${t.title} to calendar`}
                        className="min-w-[38px] min-h-[38px] rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center text-[#0071E3] dark:text-[#0A84FF] hover:opacity-80 cursor-pointer"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => t.id && onDeleteTrip(t.id)}
                        aria-label={`Delete ${t.title}`}
                        className="min-w-[38px] min-h-[38px] rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
