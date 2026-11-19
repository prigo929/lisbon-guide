import React, { useState } from 'react';
import {
  TrainFront,
  Footprints,
  Bus,
  TramFront,
  Ship,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  ArrowRight,
  Bike,
} from 'lucide-react';
import { LatLngLiteral, RouteSummary, TransitStepInfo } from '../types';
import {
  buildGoogleMapsDirectionsUrl,
  formatDistance,
  formatDuration,
} from '../utils/routeHelpers';

interface RouteBreakdownProps {
  routes: RouteSummary[];
  selectedIndex: number;
  onSelectRoute: (idx: number) => void;
  origin: LatLngLiteral;
  destination: LatLngLiteral;
  originLabel?: string;
  destinationLabel?: string;
}

function getVehicleIcon(vehicleType?: string) {
  const vt = (vehicleType || '').toUpperCase();
  if (vt.includes('BUS')) return Bus;
  if (vt.includes('TRAM') || vt.includes('LIGHT_RAIL') || vt.includes('FUNICULAR')) {
    return TramFront;
  }
  if (vt.includes('FERRY')) return Ship;
  return TrainFront;
}

const TransitChainBadges: React.FC<{ steps: TransitStepInfo[] }> = ({ steps }) => {
  const transitOnly = steps.filter((s) => s.travelMode === 'TRANSIT');
  if (transitOnly.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#6E6E73] dark:text-[#98989D]">
        <Footprints className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Direct walk</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {transitOnly.map((step, i) => {
        const Icon = getVehicleIcon(step.vehicleType);
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <ArrowRight
                className="w-3 h-3 text-[#6E6E73] dark:text-[#98989D] shrink-0"
                aria-hidden="true"
              />
            )}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold leading-tight shadow-xs"
              style={{
                backgroundColor: step.lineColor || '#0071E3',
                color: step.lineTextColor || '#FFFFFF',
              }}
            >
              <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="max-w-[110px] truncate">
                {step.lineShortName || step.lineName || 'Transit'}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const RouteBreakdown: React.FC<RouteBreakdownProps> = ({
  routes,
  selectedIndex,
  onSelectRoute,
  origin,
  destination,
  originLabel,
  destinationLabel,
}) => {
  const [expanded, setExpanded] = useState(true);
  const activeRoute = routes[selectedIndex] || routes[0];
  if (!activeRoute) return null;

  const googleDirUrl = buildGoogleMapsDirectionsUrl(origin, destination, activeRoute.travelMode);
  const totalWalkMinutes = activeRoute.steps
    .filter((s) => s.travelMode === 'WALKING')
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <div className="space-y-3">
      {/* Alternative Routes Picker (when Google returns multiple options) */}
      {routes.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
            {routes.length} live route options
          </p>
          <div className="space-y-1.5">
            {routes.map((r, idx) => {
              const selected = idx === selectedIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectRoute(idx)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-[#1C1C1E] border-[#0071E3] dark:border-[#0A84FF] shadow-xs'
                      : 'bg-black/[0.03] dark:bg-white/[0.04] border-transparent hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <TransitChainBadges steps={r.steps} />
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {formatDuration(r.durationMinutes)}
                      </span>
                      <span className="block text-[11px] text-[#6E6E73] dark:text-[#98989D]">
                        {formatDistance(r.distanceMeters)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Route Header */}
      <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {formatDuration(activeRoute.durationMinutes)}
              </span>
              <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                · {formatDistance(activeRoute.distanceMeters)}
              </span>
              {activeRoute.fareText && (
                <span className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  · {activeRoute.fareText}
                </span>
              )}
            </div>

            {activeRoute.travelMode === 'TRANSIT' && (
              <TransitChainBadges steps={activeRoute.steps} />
            )}

            {(activeRoute.departureTimeText || totalWalkMinutes > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                {activeRoute.departureTimeText && activeRoute.arrivalTimeText && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>
                      {activeRoute.departureTimeText} → {activeRoute.arrivalTimeText}
                    </span>
                  </span>
                )}
                {activeRoute.travelMode === 'TRANSIT' && totalWalkMinutes > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Footprints className="w-3 h-3" aria-hidden="true" />
                    <span>{totalWalkMinutes} min walking total</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <a
            href={googleDirUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[34px] px-3 rounded-full bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] text-xs font-semibold inline-flex items-center gap-1 hover:opacity-80 shrink-0"
          >
            <span>Navigate</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>

        {/* Step-by-Step Timeline */}
        {activeRoute.steps.length > 0 && (
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="w-full flex items-center justify-between text-xs font-medium text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] py-1 cursor-pointer"
            >
              <span>
                Step-by-step directions ({activeRoute.steps.length})
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {expanded && (
              <ol className="mt-2.5 space-y-3">
                {originLabel && (
                  <li className="flex items-center gap-2.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0071E3] dark:bg-[#0A84FF] shrink-0" />
                    <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                      {originLabel}
                    </span>
                  </li>
                )}

                {activeRoute.steps.map((step, idx) => {
                  if (step.travelMode === 'TRANSIT') {
                    const Icon = getVehicleIcon(step.vehicleType);
                    return (
                      <li
                        key={idx}
                        className="pl-3.5 ml-1 border-l-[3px] space-y-1.5"
                        style={{ borderColor: step.lineColor || '#0071E3' }}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                            style={{
                              backgroundColor: step.lineColor || '#0071E3',
                              color: step.lineTextColor || '#FFFFFF',
                            }}
                          >
                            <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>{step.lineShortName || step.lineName}</span>
                          </span>
                          {step.headsign && (
                            <span className="text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                              toward {step.headsign}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] space-y-0.5">
                          {step.departureStop && (
                            <p>
                              <span className="text-[#6E6E73] dark:text-[#98989D]">Board: </span>
                              <span className="font-medium">{step.departureStop}</span>
                              {step.departureTimeText && (
                                <span className="text-[#6E6E73] dark:text-[#98989D] tabular-nums ml-1.5">
                                  ({step.departureTimeText})
                                </span>
                              )}
                            </p>
                          )}
                          {step.arrivalStop && (
                            <p>
                              <span className="text-[#6E6E73] dark:text-[#98989D]">Exit: </span>
                              <span className="font-medium">{step.arrivalStop}</span>
                              {step.arrivalTimeText && (
                                <span className="text-[#6E6E73] dark:text-[#98989D] tabular-nums ml-1.5">
                                  ({step.arrivalTimeText})
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                          <span>{formatDuration(step.durationMinutes)}</span>
                          {step.stopCount !== undefined && step.stopCount > 0 && (
                            <span>
                              · {step.stopCount} {step.stopCount === 1 ? 'stop' : 'stops'}
                            </span>
                          )}
                          {step.headwayMinutes && <span>· every ~{step.headwayMinutes} min</span>}
                          {step.agencyName && <span>· {step.agencyName}</span>}
                        </div>
                      </li>
                    );
                  }

                  const StepIcon = step.travelMode === 'BICYCLING' ? Bike : Footprints;
                  return (
                    <li
                      key={idx}
                      className="pl-3.5 ml-1 border-l-2 border-dashed border-black/20 dark:border-white/25 text-xs text-[#6E6E73] dark:text-[#98989D]"
                    >
                      <div className="flex items-start gap-1.5">
                        <StepIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {step.instructions ||
                              (step.travelMode === 'BICYCLING' ? 'Cycle' : 'Walk')}
                          </span>
                          <span className="ml-1.5 tabular-nums">
                            ({formatDuration(step.durationMinutes)} · {formatDistance(step.distanceMeters)})
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}

                {destinationLabel && (
                  <li className="flex items-center gap-2.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1D1D1F] dark:bg-[#F5F5F7] shrink-0" />
                    <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                      {destinationLabel}
                    </span>
                  </li>
                )}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
