import React, { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { TrainFront, Bike, Layers, LocateFixed } from 'lucide-react';

interface MapLayerControlsProps {
  showTransitLayer: boolean;
  onToggleTransitLayer: () => void;
  showBikeLayer: boolean;
  onToggleBikeLayer: () => void;
  mapType: 'roadmap' | 'hybrid';
  onToggleMapType: () => void;
  onLocateMe?: () => void;
  locating?: boolean;
}

// Manages native Google Maps TransitLayer, BicyclingLayer, and MapTypeId
export const MapLayersSync: React.FC<{
  showTransitLayer: boolean;
  showBikeLayer: boolean;
  mapType: 'roadmap' | 'hybrid';
}> = ({ showTransitLayer, showBikeLayer, mapType }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const bikeLayerRef = useRef<google.maps.BicyclingLayer | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;
    if (showTransitLayer) {
      if (!transitLayerRef.current) {
        transitLayerRef.current = new mapsLib.TransitLayer();
      }
      transitLayerRef.current.setMap(map);
    } else if (transitLayerRef.current) {
      transitLayerRef.current.setMap(null);
    }
    return () => {
      if (transitLayerRef.current) {
        transitLayerRef.current.setMap(null);
      }
    };
  }, [map, mapsLib, showTransitLayer]);

  useEffect(() => {
    if (!map || !mapsLib) return;
    if (showBikeLayer) {
      if (!bikeLayerRef.current) {
        bikeLayerRef.current = new mapsLib.BicyclingLayer();
      }
      bikeLayerRef.current.setMap(map);
    } else if (bikeLayerRef.current) {
      bikeLayerRef.current.setMap(null);
    }
    return () => {
      if (bikeLayerRef.current) {
        bikeLayerRef.current.setMap(null);
      }
    };
  }, [map, mapsLib, showBikeLayer]);

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapType);
  }, [map, mapType]);

  return null;
};

export const MapLayerToolbar: React.FC<MapLayerControlsProps> = ({
  showTransitLayer,
  onToggleTransitLayer,
  showBikeLayer,
  onToggleBikeLayer,
  mapType,
  onToggleMapType,
  onLocateMe,
  locating,
}) => {
  return (
    <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-auto">
      <button
        type="button"
        onClick={onToggleTransitLayer}
        aria-pressed={showTransitLayer}
        className={`min-h-[34px] px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl shadow-md border transition-colors cursor-pointer ${
          showTransitLayer
            ? 'bg-[#0071E3] text-white border-[#0071E3]'
            : 'bg-white/90 dark:bg-[#1C1C1E]/90 text-[#1D1D1F] dark:text-[#F5F5F7] border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-[#2C2C2E]'
        }`}
      >
        <TrainFront className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Transit Lines</span>
      </button>

      <button
        type="button"
        onClick={onToggleBikeLayer}
        aria-pressed={showBikeLayer}
        className={`min-h-[34px] px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl shadow-md border transition-colors cursor-pointer ${
          showBikeLayer
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white/90 dark:bg-[#1C1C1E]/90 text-[#1D1D1F] dark:text-[#F5F5F7] border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-[#2C2C2E]'
        }`}
      >
        <Bike className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Bike</span>
      </button>

      <button
        type="button"
        onClick={onToggleMapType}
        aria-pressed={mapType === 'hybrid'}
        className={`min-h-[34px] px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl shadow-md border transition-colors cursor-pointer ${
          mapType === 'hybrid'
            ? 'bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] border-transparent'
            : 'bg-white/90 dark:bg-[#1C1C1E]/90 text-[#1D1D1F] dark:text-[#F5F5F7] border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-[#2C2C2E]'
        }`}
      >
        <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{mapType === 'hybrid' ? 'Satellite' : 'Map'}</span>
      </button>

      {onLocateMe && (
        <button
          type="button"
          onClick={onLocateMe}
          disabled={locating}
          title="Use my current location"
          aria-label="Locate me"
          className="min-w-[34px] min-h-[34px] px-2.5 rounded-full bg-white/90 dark:bg-[#1C1C1E]/90 text-[#0071E3] dark:text-[#0A84FF] border border-black/10 dark:border-white/15 backdrop-blur-xl shadow-md hover:bg-white dark:hover:bg-[#2C2C2E] inline-flex items-center justify-center transition-colors cursor-pointer"
        >
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
