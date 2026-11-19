import { LatLngLiteral, RouteSummary, TransitStepInfo } from '../types';

export function haversineMeters(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTimeShort(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function extractLatLng(loc: any): LatLngLiteral | undefined {
  if (!loc) return undefined;
  const inner = loc.location ?? loc;
  const lat = typeof inner.lat === 'function' ? inner.lat() : inner.lat;
  const lng = typeof inner.lng === 'function' ? inner.lng() : inner.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return { lat, lng };
  }
  return undefined;
}

// Official Lisbon transit line color fallback when Google Routes omits hex colors
export function resolveLisbonLineColors(
  lineName?: string | null,
  shortName?: string | null,
  apiColor?: string | null,
  apiTextColor?: string | null,
  vehicleType?: string | null
): { bg: string; fg: string } {
  if (apiColor && apiColor.startsWith('#')) {
    return {
      bg: apiColor,
      fg: apiTextColor && apiTextColor.startsWith('#') ? apiTextColor : '#FFFFFF',
    };
  }
  const combined = `${lineName || ''} ${shortName || ''}`.toLowerCase();
  if (combined.includes('amarela') || combined.includes('yellow')) {
    return { bg: '#F4B400', fg: '#1D1D1F' };
  }
  if (combined.includes('verde') || combined.includes('green')) {
    return { bg: '#00A859', fg: '#FFFFFF' };
  }
  if (combined.includes('vermelha') || combined.includes('red')) {
    return { bg: '#E30613', fg: '#FFFFFF' };
  }
  if (combined.includes('azul') || combined.includes('blue')) {
    return { bg: '#0072BC', fg: '#FFFFFF' };
  }
  if (combined.includes('fertagus')) {
    return { bg: '#0055A5', fg: '#FFFFFF' };
  }
  if (combined.includes('sintra') || combined.includes('cascais') || combined.includes('azambuja')) {
    return { bg: '#15803D', fg: '#FFFFFF' };
  }
  const vt = (vehicleType || '').toUpperCase();
  if (vt.includes('TRAM') || vt.includes('LIGHT_RAIL')) {
    return { bg: '#D97706', fg: '#FFFFFF' };
  }
  if (vt.includes('FERRY')) {
    return { bg: '#0284C7', fg: '#FFFFFF' };
  }
  if (vt.includes('RAIL') || vt.includes('TRAIN')) {
    return { bg: '#0F766E', fg: '#FFFFFF' };
  }
  if (vt.includes('BUS')) {
    return { bg: '#EAB308', fg: '#1D1D1F' };
  }
  return { bg: '#0071E3', fg: '#FFFFFF' };
}

export function parseComputedRoute(
  route: any,
  travelMode: 'TRANSIT' | 'WALKING' | 'BICYCLING'
): RouteSummary {
  const durationMinutes = Math.max(1, Math.round((route?.durationMillis ?? 0) / 60000));
  const distanceMeters = route?.distanceMeters ?? 0;
  const leg = route?.legs?.[0];
  const rawSteps: any[] = leg?.steps || [];

  const steps: TransitStepInfo[] = rawSteps.map((step) => {
    const stepMode = String(step?.travelMode || travelMode).toUpperCase();
    const stepMins = Math.max(
      1,
      Math.round(((step?.staticDurationMillis ?? step?.durationMillis ?? 0) as number) / 60000)
    );
    const td = step?.transitDetails;

    if (td) {
      const line = td.transitLine;
      const vehicleType = line?.vehicle?.type ? String(line.vehicle.type) : undefined;
      const vehicleName = line?.vehicle?.name ? String(line.vehicle.name) : undefined;
      const colors = resolveLisbonLineColors(
        line?.name,
        line?.shortName,
        line?.color,
        line?.textColor,
        vehicleType
      );
      const headwayMinutes =
        typeof td.headwayMillis === 'number' && Number.isFinite(td.headwayMillis) && td.headwayMillis > 0
          ? Math.max(1, Math.round(td.headwayMillis / 60000))
          : undefined;

      return {
        travelMode: 'TRANSIT',
        distanceMeters: step?.distanceMeters ?? 0,
        durationMinutes: stepMins,
        instructions: step?.instructions || undefined,
        lineName: line?.name || undefined,
        lineShortName: line?.shortName || line?.name || td.tripShortText || 'Transit',
        lineColor: colors.bg,
        lineTextColor: colors.fg,
        vehicleType,
        vehicleName,
        agencyName: line?.agencies?.[0]?.name || undefined,
        departureStop: td.departureStop?.name || undefined,
        arrivalStop: td.arrivalStop?.name || undefined,
        departureTimeText: formatTimeShort(td.departureTime),
        arrivalTimeText: formatTimeShort(td.arrivalTime),
        headsign: td.headsign || undefined,
        stopCount: typeof td.stopCount === 'number' ? td.stopCount : undefined,
        headwayMinutes,
        departureLocation: extractLatLng(td.departureStop?.location),
        arrivalLocation: extractLatLng(td.arrivalStop?.location),
      };
    }

    return {
      travelMode:
        stepMode === 'WALKING' || stepMode === 'BICYCLING' || stepMode === 'DRIVING'
          ? (stepMode as TransitStepInfo['travelMode'])
          : 'WALKING',
      distanceMeters: step?.distanceMeters ?? 0,
      durationMinutes: stepMins,
      instructions: step?.instructions || undefined,
    };
  });

  const transitSteps = steps.filter((s) => s.travelMode === 'TRANSIT');
  const firstTransit = transitSteps[0];
  const lastTransit = transitSteps[transitSteps.length - 1];

  return {
    travelMode,
    distanceMeters,
    durationMinutes,
    departureTimeText: firstTransit?.departureTimeText,
    arrivalTimeText: lastTransit?.arrivalTimeText,
    fareText: route?.localizedValues?.transitFare || undefined,
    steps,
    rawRoute: route,
  };
}

// Draw color-coded polylines per step so each Lisbon Metro/Bus/Train line renders in its true line color
export function drawStyledRoutePolylines(
  map: google.maps.Map,
  route: any,
  travelMode: 'TRANSIT' | 'WALKING' | 'BICYCLING',
  isDark: boolean
): google.maps.Polyline[] {
  const created: google.maps.Polyline[] = [];
  const leg = route?.legs?.[0];
  const steps: any[] = leg?.steps || [];

  if (travelMode === 'TRANSIT' && steps.length > 0) {
    let drewAnyStep = false;
    for (const step of steps) {
      const path = step?.path;
      if (!Array.isArray(path) || path.length < 2) continue;
      drewAnyStep = true;

      const td = step?.transitDetails;
      if (td) {
        const line = td.transitLine;
        const colors = resolveLisbonLineColors(
          line?.name,
          line?.shortName,
          line?.color,
          line?.textColor,
          line?.vehicle?.type
        );
        // Subtle white/dark casing beneath colored transit line for high legibility
        const casing = new google.maps.Polyline({
          path,
          strokeColor: isDark ? '#0B0B0D' : '#FFFFFF',
          strokeOpacity: 0.9,
          strokeWeight: 9,
          zIndex: 10,
          map,
        });
        const inner = new google.maps.Polyline({
          path,
          strokeColor: colors.bg,
          strokeOpacity: 1,
          strokeWeight: 5.5,
          zIndex: 11,
          map,
        });
        created.push(casing, inner);
      } else {
        // Walking connector segment rendered as a crisp dotted path
        const walkLine = new google.maps.Polyline({
          path,
          strokeOpacity: 0,
          zIndex: 9,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillOpacity: 0.9,
                fillColor: isDark ? '#E5E5EA' : '#3A3A3C',
                strokeWeight: 0,
                scale: 2.6,
              },
              offset: '0',
              repeat: '9px',
            },
          ],
          map,
        });
        created.push(walkLine);
      }
    }
    if (drewAnyStep) return created;
  }

  // Standard fallback using Route.createPolylines()
  const basePolylines: google.maps.Polyline[] = route?.createPolylines?.() || [];
  basePolylines.forEach((polyline) => {
    polyline.setOptions({
      strokeColor:
        travelMode === 'BICYCLING'
          ? '#16A34A'
          : travelMode === 'TRANSIT'
          ? isDark
            ? '#0A84FF'
            : '#0071E3'
          : isDark
          ? '#F5F5F7'
          : '#1D1D1F',
      strokeOpacity: 0.92,
      strokeWeight: 5,
    });
    polyline.setMap(map);
    created.push(polyline);
  });

  return created;
}

export function buildGoogleMapsDirectionsUrl(
  origin: LatLngLiteral,
  destination: LatLngLiteral,
  mode: 'TRANSIT' | 'WALKING' | 'BICYCLING'
): string {
  const modeParam =
    mode === 'TRANSIT' ? 'transit' : mode === 'BICYCLING' ? 'bicycling' : 'walking';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${modeParam}`;
}

export function buildAppleMapsDirectionsUrl(
  origin: LatLngLiteral,
  destination: LatLngLiteral,
  mode: 'TRANSIT' | 'WALKING' | 'BICYCLING'
): string {
  const dirflg = mode === 'TRANSIT' ? 'r' : mode === 'BICYCLING' ? 'c' : 'w';
  return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}&dirflg=${dirflg}`;
}

export function buildGoogleMapsPlaceUrl(
  location: LatLngLiteral,
  label?: string,
  existingUri?: string | null
): string {
  if (existingUri) return existingUri;
  const query = label ? encodeURIComponent(`${label}, Lisbon, Portugal`) : `${location.lat},${location.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildAppleMapsPlaceUrl(location: LatLngLiteral, label: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(label)}&ll=${location.lat},${location.lng}`;
}
