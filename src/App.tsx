import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Home, Map as MapIcon, Building2, Compass, BookOpenCheck, Sun, Moon } from 'lucide-react';
import {
  AppTab,
  BureaucracyVerification,
  DecodedPortuguese,
  LivePlace,
  SavedSpot,
  TripPlan,
} from './types';
import {
  loadChecklistDone,
  loadChecklistVerifications,
  loadDecodedHistory,
  loadSavedSpots,
  loadSavedTrips,
  saveChecklistDone,
  saveChecklistVerifications,
  saveDecodedHistory,
  saveSavedSpots,
  saveSavedTrips,
} from './utils/storage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MyStayView } from './components/MyStayView';
import { AtlasView } from './components/AtlasView';
import { HousingView } from './components/HousingView';
import { TripsView } from './components/TripsView';
import { GuideView } from './components/GuideView';

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'mystay', label: 'My Stay', icon: Home },
  { id: 'atlas', label: 'Atlas', icon: MapIcon },
  { id: 'housing', label: 'Housing', icon: Building2 },
  { id: 'trips', label: 'Trips', icon: Compass },
  { id: 'guide', label: 'Guide', icon: BookOpenCheck },
];

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('mystay');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [mapsConfigChecked, setMapsConfigChecked] = useState<boolean>(
    Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>(() => loadSavedSpots());
  const [checklistDone, setChecklistDone] = useState<Record<string, boolean>>(() =>
    loadChecklistDone()
  );
  const [verifications, setVerifications] = useState<Record<string, BureaucracyVerification>>(() =>
    loadChecklistVerifications()
  );
  const [savedTrips, setSavedTrips] = useState<TripPlan[]>(() => loadSavedTrips());
  const [decodedHistory, setDecodedHistory] = useState<DecodedPortuguese[]>(() =>
    loadDecodedHistory()
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Robust Spoken Portuguese Audio Engine State
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [speakingLoadingText, setSpeakingLoadingText] = useState<string | null>(null);
  const audioCacheRef = useRef<Record<string, { bytes: Uint8Array; mimeType: string }>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const speechGuardTimerRef = useRef<number | null>(null);
  const playbackRequestIdRef = useRef<number>(0);

  // Sync dark mode class on <html> and dynamic iOS status bar theme-color
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('caderno_lx_theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', isDark ? '#0B0B0D' : '#F5F5F7');
    }
  }, [isDark]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    if (mapsApiKey) {
      setMapsConfigChecked(true);
      return;
    }
    fetch('/api/maps-config')
      .then((res) => res.json())
      .then((data) => {
        if (data?.apiKey) setMapsApiKey(data.apiKey);
      })
      .catch(() => {})
      .finally(() => setMapsConfigChecked(true));
  }, [mapsApiKey]);

  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const stopAllAudio = useCallback(() => {
    playbackRequestIdRef.current += 1;
    if (speechGuardTimerRef.current) {
      window.clearTimeout(speechGuardTimerRef.current);
      speechGuardTimerRef.current = null;
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // Already stopped
      }
      activeSourceRef.current = null;
    }
    if (activeAudioElRef.current) {
      try {
        activeAudioElRef.current.pause();
        activeAudioElRef.current.currentTime = 0;
      } catch {
        // Ignore
      }
      activeAudioElRef.current = null;
    }
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    setSpeakingText(null);
    setSpeakingLoadingText(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const speakWithBrowserFallback = useCallback(
    (text: string, requestId: number): boolean => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return false;
      }
      try {
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices();
        const ptVoice =
          voices.find((v) => v.lang.toLowerCase() === 'pt-pt') ||
          voices.find((v) => v.lang.toLowerCase().startsWith('pt-pt')) ||
          voices.find((v) => v.lang.toLowerCase().startsWith('pt'));

        setSpeakingLoadingText(null);
        setSpeakingText(text);

        // Short 60ms delay after cancel() avoids Chrome/WebKit bug that drops utterances
        window.setTimeout(() => {
          if (playbackRequestIdRef.current !== requestId) return;
          const utter = new SpeechSynthesisUtterance(text);
          if (ptVoice) utter.voice = ptVoice;
          utter.lang = 'pt-PT';
          utter.rate = 0.92;
          utter.onend = () => {
            if (playbackRequestIdRef.current === requestId) {
              if (speechGuardTimerRef.current) window.clearTimeout(speechGuardTimerRef.current);
              setSpeakingText(null);
            }
          };
          utter.onerror = () => {
            if (playbackRequestIdRef.current === requestId) {
              if (speechGuardTimerRef.current) window.clearTimeout(speechGuardTimerRef.current);
              setSpeakingText(null);
            }
          };
          window.speechSynthesis.speak(utter);

          // Safety timeout so UI never stays stuck if iframe mutes speechSynthesis silently
          speechGuardTimerRef.current = window.setTimeout(() => {
            if (playbackRequestIdRef.current === requestId) {
              setSpeakingText(null);
            }
          }, Math.max(6000, text.length * 140));
        }, 60);

        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const handleSpeakPt = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;

      // Tap again on currently playing/loading phrase to stop cleanly
      if (speakingText === cleaned || speakingLoadingText === cleaned) {
        stopAllAudio();
        return;
      }

      stopAllAudio();
      const requestId = playbackRequestIdRef.current;

      // CRITICAL for iPhone Safari & Chrome: create/resume AudioContext synchronously inside user tap
      let ctx: AudioContext | null = null;
      try {
        const AudioCtxCtor =
          window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxCtor) {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioCtxCtor();
          }
          ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') {
            void ctx.resume();
          }
        }
      } catch {
        ctx = null;
      }

      // Offline-only immediate fallback
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!speakWithBrowserFallback(cleaned, requestId)) {
          notify('Offline audio voice unavailable on this device.');
        }
        return;
      }

      try {
        let cached = audioCacheRef.current[cleaned];
        if (!cached) {
          setSpeakingLoadingText(cleaned);
          const res = await fetch('/api/ai/speak-pt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleaned }),
          });
          const data = await res.json().catch(() => ({}));
          if (playbackRequestIdRef.current !== requestId) return;
          if (!res.ok || !data?.audioBase64) {
            throw new Error(data?.error || 'Could not generate Portuguese audio.');
          }
          cached = {
            bytes: base64ToUint8Array(data.audioBase64),
            mimeType: data.mimeType || 'audio/wav',
          };
          audioCacheRef.current[cleaned] = cached;
        }

        if (playbackRequestIdRef.current !== requestId) return;
        setSpeakingLoadingText(null);
        setSpeakingText(cleaned);

        // Primary path: Web Audio API via synchronously-unlocked AudioContext (works reliably on iOS Safari & Chrome)
        if (ctx) {
          try {
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            const bufferCopy = new Uint8Array(cached.bytes).buffer;
            const decoded = await ctx.decodeAudioData(bufferCopy);
            if (playbackRequestIdRef.current !== requestId) return;
            const source = ctx.createBufferSource();
            source.buffer = decoded;
            source.connect(ctx.destination);
            activeSourceRef.current = source;
            source.onended = () => {
              if (playbackRequestIdRef.current === requestId) {
                activeSourceRef.current = null;
                setSpeakingText(null);
              }
            };
            source.start(0);
            return;
          } catch (decodeErr) {
            console.warn('AudioContext decode failed, trying HTMLAudio Blob fallback:', decodeErr);
          }
        }

        // Secondary path: Blob URL on HTMLAudioElement
        const blob = new Blob([cached.bytes.slice().buffer], { type: cached.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        activeObjectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        activeAudioElRef.current = audio;
        audio.onended = () => {
          if (playbackRequestIdRef.current === requestId) {
            setSpeakingText(null);
            if (activeObjectUrlRef.current === objectUrl) {
              URL.revokeObjectURL(objectUrl);
              activeObjectUrlRef.current = null;
            }
          }
        };
        audio.onerror = () => {
          if (playbackRequestIdRef.current === requestId) {
            setSpeakingText(null);
            if (!speakWithBrowserFallback(cleaned, requestId)) {
              notify('Unable to play audio on this device.');
            }
          }
        };
        await audio.play();
      } catch (err: any) {
        if (playbackRequestIdRef.current !== requestId) return;
        setSpeakingLoadingText(null);
        if (!speakWithBrowserFallback(cleaned, requestId)) {
          setSpeakingText(null);
          notify(err?.message || 'Unable to play European Portuguese audio right now.');
        }
      }
    },
    [notify, speakingText, speakingLoadingText, stopAllAudio, speakWithBrowserFallback]
  );

  const handleToggleSaveSpot = useCallback((place: LivePlace, note = '') => {
    setSavedSpots((prev) => {
      const exists = prev.some((s) => s.id === place.id);
      const next = exists
        ? prev.filter((s) => s.id !== place.id)
        : [
            {
              id: place.id,
              displayName: place.displayName,
              formattedAddress: place.formattedAddress,
              location: place.location,
              category: place.category,
              note,
              savedAt: new Date().toISOString(),
              googleMapsURI: place.googleMapsURI,
            },
            ...prev,
          ];
      saveSavedSpots(next);
      return next;
    });
  }, []);

  const handleUpdateSpotNote = useCallback((id: string, note: string) => {
    setSavedSpots((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, note } : s));
      saveSavedSpots(next);
      return next;
    });
  }, []);

  const handleRemoveSavedSpot = useCallback(
    (id: string) => {
      setSavedSpots((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveSavedSpots(next);
        return next;
      });
      notify('Removed spot from saved list.');
    },
    [notify]
  );

  const handleToggleChecklistStep = useCallback((stepId: string) => {
    setChecklistDone((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      saveChecklistDone(next);
      return next;
    });
  }, []);

  const handleSaveVerification = useCallback((topicId: string, data: BureaucracyVerification) => {
    setVerifications((prev) => {
      const next = { ...prev, [topicId]: data };
      saveChecklistVerifications(next);
      return next;
    });
  }, []);

  const handleSaveTrip = useCallback((trip: TripPlan) => {
    setSavedTrips((prev) => {
      const next = [trip, ...prev.filter((t) => t.id !== trip.id)];
      saveSavedTrips(next);
      return next;
    });
  }, []);

  const handleDeleteTrip = useCallback(
    (id: string) => {
      setSavedTrips((prev) => {
        const next = prev.filter((t) => t.id !== id);
        saveSavedTrips(next);
        return next;
      });
      notify('Deleted saved trip.');
    },
    [notify]
  );

  const handleSaveDecoded = useCallback((item: DecodedPortuguese) => {
    setDecodedHistory((prev) => {
      const next = [item, ...prev].slice(0, 12);
      saveDecodedHistory(next);
      return next;
    });
  }, []);

  const mapsReady = Boolean(mapsApiKey);

  const appContent = (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] dark:bg-[#0B0B0D] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-200">
      {quotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/90 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 dark:text-white hover:opacity-80"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Apple-style Frosted Translucent Header */}
      <header className="sticky top-0 z-30 bg-[#F5F5F7]/80 dark:bg-[#0B0B0D]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[52px] lg:h-[60px] flex items-center justify-between gap-6">
          {/* Zone 1: Clean single-line brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('mystay')}
            className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Caderno Lisboa
          </button>

          {/* Zone 2: Clean 5 single-line nav links (Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-[#0071E3] dark:text-[#0A84FF] font-semibold'
                      : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme Toggle + Install */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-w-[38px] min-h-[38px] rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.09] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'mystay' && (
          <MyStayView
            checklistDone={checklistDone}
            onToggleChecklistStep={handleToggleChecklistStep}
            verifications={verifications}
            onSaveVerification={handleSaveVerification}
            onNotify={notify}
          />
        )}
        {activeTab === 'atlas' && (
          <AtlasView
            savedSpots={savedSpots}
            onToggleSaveSpot={handleToggleSaveSpot}
            onUpdateSpotNote={handleUpdateSpotNote}
            onNotify={notify}
            mapsReady={mapsReady}
            isDark={isDark}
          />
        )}
        {activeTab === 'housing' && (
          <HousingView
            mapsReady={mapsReady}
            isDark={isDark}
            onSpeakPt={handleSpeakPt}
            speakingText={speakingText}
            speakingLoadingText={speakingLoadingText}
          />
        )}
        {activeTab === 'trips' && (
          <TripsView
            savedTrips={savedTrips}
            onSaveTrip={handleSaveTrip}
            onDeleteTrip={handleDeleteTrip}
            onNotify={notify}
            mapsReady={mapsReady}
            isDark={isDark}
          />
        )}
        {activeTab === 'guide' && (
          <GuideView
            onSpeakPt={handleSpeakPt}
            speakingText={speakingText}
            speakingLoadingText={speakingLoadingText}
            decodedHistory={decodedHistory}
            onSaveDecoded={handleSaveDecoded}
            savedSpots={savedSpots}
            onRemoveSavedSpot={handleRemoveSavedSpot}
          />
        )}
      </main>

      {/* iOS Translucent 5-Tab Bottom Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F5F5F7]/85 dark:bg-[#1C1C1E]/85 backdrop-blur-xl border-t border-black/[0.08] dark:border-white/[0.10] pb-safe"
      >
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active
                    ? 'text-[#0071E3] dark:text-[#0A84FF]'
                    : 'text-[#6E6E73] dark:text-[#98989D]'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-4 z-50 max-w-xs rounded-2xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] px-4 py-3 text-xs font-medium shadow-xl"
        >
          {toast}
        </div>
      )}

      <OfflineIndicator />
    </div>
  );

  if (!mapsConfigChecked) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0B0B0D] flex items-center justify-center text-sm text-[#6E6E73] dark:text-[#98989D]">
        Loading Caderno Lisboa…
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      language="en"
      region="PT"
      onError={(err) => {
        console.error('Google Maps APIProvider error:', err);
      }}
    >
      {appContent}
    </APIProvider>
  );
}
