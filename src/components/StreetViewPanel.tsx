import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { EyeOff, Compass } from 'lucide-react';
import { LatLngLiteral } from '../types';
import { handleMapsApiError } from '../utils/mapsQuota';

interface StreetViewPanelProps {
  location: LatLngLiteral;
  label?: string;
  heightClass?: string;
}

export const StreetViewPanel: React.FC<StreetViewPanelProps> = ({
  location,
  label,
  heightClass = 'h-64',
}) => {
  const streetViewLib = useMapsLibrary('streetView');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    if (!streetViewLib || !containerRef.current) return;

    let cancelled = false;
    setStatus('loading');

    const service = new streetViewLib.StreetViewService();
    service
      .getPanorama({
        location,
        radius: 80,
        preference: streetViewLib.StreetViewPreference.NEAREST,
      })
      .then((res) => {
        if (cancelled || !containerRef.current) return;
        const panoId = res?.data?.location?.pano;
        if (!panoId) {
          setStatus('unavailable');
          return;
        }
        panoramaRef.current = new streetViewLib.StreetViewPanorama(containerRef.current, {
          pano: panoId,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: true,
          motionTracking: false,
          motionTrackingControl: false,
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        handleMapsApiError(err);
        setStatus('unavailable');
      });

    return () => {
      cancelled = true;
      panoramaRef.current = null;
    };
  }, [streetViewLib, location.lat, location.lng]);

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl bg-[#EAEAEF] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden`}
    >
      <div
        ref={containerRef}
        className={`w-full h-full ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        aria-label={label ? `Street View of ${label}` : 'Interactive Street View'}
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989D]">
          <Compass className="w-5 h-5 animate-spin text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
          <span>Loading Street View…</span>
        </div>
      )}

      {status === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center gap-2">
          <EyeOff className="w-5 h-5 text-[#6E6E73] dark:text-[#98989D]" aria-hidden="true" />
          <p className="text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
            Street View isn&apos;t available at this exact spot
          </p>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] max-w-xs leading-relaxed">
            Interior courtyards or pedestrian alleys sometimes lack street-level photos. Try a nearby street address.
          </p>
        </div>
      )}
    </div>
  );
};
