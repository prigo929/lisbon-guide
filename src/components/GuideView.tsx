import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Volume2,
  Square,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Trash2,
  Sparkles,
  FileText,
  X,
  TrainFront,
  Ticket,
  Search,
  ChevronDown,
  ChevronUp,
  Bookmark,
  ShieldAlert,
} from 'lucide-react';
import {
  LISBON_ESSENTIALS_INFO,
  LISBON_TRANSIT_LINES,
  NAVEGANTE_FARES,
  PORTUGUESE_GLOSSARY,
  SURVIVAL_PHRASES,
} from '../data/lisbonData';
import { DecodedPortuguese, GlossaryTerm, PhraseEntry, SavedSpot } from '../types';
import { buildAppleMapsPlaceUrl, buildGoogleMapsPlaceUrl } from '../utils/routeHelpers';

interface GuideViewProps {
  onSpeakPt: (text: string) => void;
  speakingText: string | null;
  speakingLoadingText: string | null;
  decodedHistory: DecodedPortuguese[];
  onSaveDecoded: (item: DecodedPortuguese) => void;
  savedSpots: SavedSpot[];
  onRemoveSavedSpot: (id: string) => void;
}

type GuideSubTab = 'transit' | 'phrases' | 'decoder' | 'saved';

async function resizeImageToBase64(
  file: File
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, mimeType: 'image/jpeg', previewUrl: dataUrl });
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

const SAMPLE_DECODER_SNIPPETS = [
  {
    label: 'Sample Menu',
    context: 'Restaurant Menu',
    text: 'Couvert: Pão, azeitonas e queijo fresco €3,50. Prato do dia: Bacalhau à Brás com salada €11,50. Bitóque de vaca com ovo a cavalo €12,00. Imperial €1,80. IVA incluído à taxa legal.',
  },
  {
    label: 'Sample Lease',
    context: 'Rental Contract',
    text: 'Renda mensal de 580€ paga até ao dia 8 de cada mês. Caução equivalente a dois meses de renda. Despesas de água, eletricidade e gás não incluídas no valor da renda. Contrato com prazo de 6 meses sem renovação automática.',
  },
];

export const GuideView: React.FC<GuideViewProps> = ({
  onSpeakPt,
  speakingText,
  speakingLoadingText,
  decodedHistory,
  onSaveDecoded,
  savedSpots,
  onRemoveSavedSpot,
}) => {
  const [subTab, setSubTab] = useState<GuideSubTab>('phrases');

  // Phrases & Glossary state (Zero-AI searchable)
  const [phraseCat, setPhraseCat] = useState<'all' | PhraseEntry['category']>('all');
  const [phraseQuery, setPhraseQuery] = useState('');
  const [glossaryCat, setGlossaryCat] = useState<'All' | GlossaryTerm['category']>('All');
  const [showCustomTranslator, setShowCustomTranslator] = useState(false);
  const [customEnglish, setCustomEnglish] = useState('');
  const [translating, setTranslating] = useState(false);
  const [customResult, setCustomResult] = useState<{
    portuguese: string;
    phonetic: string;
    culturalNote: string;
  } | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Camera Decoder state (Optional AI Vision Tool)
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [decodeImage, setDecodeImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const [decodeText, setDecodeText] = useState('');
  const [decodeContext, setDecodeContext] = useState('Auto-detect');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decodedResult, setDecodedResult] = useState<DecodedPortuguese | null>(
    decodedHistory[0] || null
  );

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDecodeError(null);
    try {
      const processed = await resizeImageToBase64(file);
      setDecodeImage(processed);
    } catch (err: any) {
      setDecodeError(err?.message || 'Could not load selected image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDecodeSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!decodeImage && !decodeText.trim()) {
      setDecodeError('Snap a photo or paste Portuguese text first.');
      return;
    }
    setDecoding(true);
    setDecodeError(null);
    try {
      const res = await fetch('/api/ai/decode-pt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: decodeImage?.base64,
          mimeType: decodeImage?.mimeType,
          text: decodeText.trim(),
          context: decodeContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not decode Portuguese content.');
      const enriched: DecodedPortuguese = {
        ...data,
        id: `dec-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setDecodedResult(enriched);
      onSaveDecoded(enriched);
    } catch (err: any) {
      setDecodeError(err?.message || 'Decoding failed. Please retry.');
    } finally {
      setDecoding(false);
    }
  };

  const handleCustomTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEnglish.trim()) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch('/api/ai/translate-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english: customEnglish.trim(),
          situation: 'Lisbon Erasmus student everyday conversation',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed.');
      setCustomResult(data);
    } catch (err: any) {
      setTranslateError(err?.message || 'Unable to translate right now.');
    } finally {
      setTranslating(false);
    }
  };

  const filteredPhrases = useMemo(() => {
    const q = phraseQuery.trim().toLowerCase();
    return SURVIVAL_PHRASES.filter((p) => {
      if (phraseCat !== 'all' && p.category !== phraseCat) return false;
      if (!q) return true;
      return (
        p.english.toLowerCase().includes(q) ||
        p.portuguese.toLowerCase().includes(q) ||
        p.context.toLowerCase().includes(q)
      );
    });
  }, [phraseCat, phraseQuery]);

  const filteredGlossary = useMemo(() => {
    const q = phraseQuery.trim().toLowerCase();
    return PORTUGUESE_GLOSSARY.filter((g) => {
      if (glossaryCat !== 'All' && g.category !== glossaryCat) return false;
      if (!q) return true;
      return (
        g.term.toLowerCase().includes(q) ||
        g.meaning.toLowerCase().includes(q) ||
        g.tip.toLowerCase().includes(q)
      );
    });
  }, [glossaryCat, phraseQuery]);

  const renderSpeakButton = (ptText: string, label: string, sizeClass = 'min-w-[44px] min-h-[44px]') => {
    const isLoading = speakingLoadingText === ptText;
    const isPlaying = speakingText === ptText;
    return (
      <button
        type="button"
        onClick={() => onSpeakPt(ptText)}
        aria-label={isPlaying ? `Stop audio for ${label}` : `Play European Portuguese audio for ${label}`}
        className={`${sizeClass} rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
          isPlaying
            ? 'bg-[#0071E3] dark:bg-[#0A84FF] text-white shadow-sm'
            : 'bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] hover:bg-[#0071E3] hover:text-white dark:hover:bg-[#0A84FF] dark:hover:text-white'
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : isPlaying ? (
          <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 pb-24 lg:pb-12 space-y-7">
      {/* Header + 4-way Pocket Toolkit Control */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
            On-the-street Lisbon toolkit · Spoken pt-PT, transit lines & camera lens
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
            Pocket Guide
          </h1>
        </div>

        <div className="inline-flex p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] overflow-x-auto self-start lg:self-auto max-w-full">
          {(
            [
              { id: 'phrases', label: 'Spoken PT' },
              { id: 'transit', label: 'Transit Network' },
              { id: 'decoder', label: 'Camera Lens' },
              { id: 'saved', label: `Saved (${savedSpots.length})` },
            ] as Array<{ id: GuideSubTab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[38px] px-3.5 sm:px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subTab === t.id
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                  : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SUB-TAB 1: SPOKEN EUROPEAN PORTUGUESE & SEARCHABLE GLOSSARY       */}
      {/* ================================================================= */}
      {subTab === 'phrases' && (
        <div className="space-y-7">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#6E6E73] dark:text-[#98989D] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={phraseQuery}
              onChange={(e) => setPhraseQuery(e.target.value)}
              placeholder="Search offline phrases & Lisbon terms (e.g. bica, couvert, caução, A1, metro)…"
              className="w-full min-h-[46px] pl-11 pr-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.10] focus:border-[#0071E3] dark:focus:border-[#0A84FF] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] focus:outline-none"
            />
          </div>

          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Spoken Lisbon Portuguese (pt-PT)
                </h2>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                  Tap the speaker button to hear natural European Portuguese pronunciation; tap again to stop.
                </p>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'cafe', label: 'Cafes & Tascas' },
                    { id: 'studio', label: 'Print & Studio' },
                    { id: 'transit', label: 'Metro & Pass' },
                    { id: 'housing', label: 'Landlord' },
                    { id: 'essentials', label: 'Shops & SIM' },
                    { id: 'urgent', label: 'Urgent' },
                  ] as Array<{ id: 'all' | PhraseEntry['category']; label: string }>
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPhraseCat(c.id)}
                    className={`min-h-[34px] px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      phraseCat === c.id
                        ? 'bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F]'
                        : 'bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPhrases.map((p) => (
                <div
                  key={p.id}
                  className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 flex flex-col justify-between gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">{p.english}</p>
                      <p className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 leading-snug">
                        {p.portuguese}
                      </p>
                    </div>
                    {renderSpeakButton(p.portuguese, p.english)}
                  </div>
                  <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-1">
                    <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] leading-relaxed">
                      {p.phonetic}
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                      {p.context}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Searchable Instant Lisbon Glossary (Zero AI) */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Instant offline dictionary
                </p>
                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Lisbon Menu, Lease & Transit Glossary
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['All', 'Menu', 'Housing', 'Transit', 'Daily'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setGlossaryCat(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
                      glossaryCat === cat
                        ? 'bg-[#0071E3] dark:bg-[#0A84FF] text-white'
                        : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredGlossary.map((g) => (
                <div
                  key={g.term}
                  className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {g.term}
                    </h3>
                    <span className="text-[10px] font-medium text-[#0071E3] dark:text-[#0A84FF]">
                      {g.category}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#1D1D1F]/90 dark:text-[#F5F5F7]/90">
                    {g.meaning}
                  </p>
                  <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                    {g.tip}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Optional Collapsed Custom Phrase Translator (AI) */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={() => setShowCustomTranslator((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer"
            >
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Optional AI translator
                </p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Need a custom sentence not listed above?
                </p>
              </div>
              {showCustomTranslator ? (
                <ChevronUp className="w-4 h-4 text-[#6E6E73]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6E6E73]" />
              )}
            </button>

            {showCustomTranslator && (
              <form
                onSubmit={handleCustomTranslate}
                className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3"
              >
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={customEnglish}
                    onChange={(e) => setCustomEnglish(e.target.value)}
                    placeholder="Type what you need to say in Lisbon Portuguese…"
                    className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                  <button
                    type="submit"
                    disabled={translating || !customEnglish.trim()}
                    className="min-h-[44px] px-5 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    {translating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Translate</span>
                  </button>
                </div>
                {translateError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{translateError}</p>
                )}
                {customResult && (
                  <div className="p-4 rounded-2xl bg-[#0071E3]/[0.07] dark:bg-[#0A84FF]/[0.14] flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {customResult.portuguese}
                      </p>
                      <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                        {customResult.phonetic}
                      </p>
                      <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                        {customResult.culturalNote}
                      </p>
                    </div>
                    {renderSpeakButton(customResult.portuguese, 'custom phrase')}
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: LISBON TRANSIT NETWORK, FARES & STREET ETIQUETTE       */}
      {/* ================================================================= */}
      {subTab === 'transit' && (
        <div className="space-y-6">
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  Metro de Lisboa · CP Trains · Fertagus
                </p>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Lisbon Transit Network Guide
                </h2>
              </div>
              <TrainFront className="w-6 h-6 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {LISBON_TRANSIT_LINES.map((line) => (
                <div
                  key={line.id}
                  className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: line.color, color: line.textColor }}
                    >
                      {line.badge}
                    </span>
                    <span className="text-[11px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                      {line.frequency}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {line.name}
                  </h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                    {line.route}
                  </p>
                  <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] leading-relaxed">
                    <strong className="text-[#0071E3] dark:text-[#0A84FF]">For ISCTE:</strong>{' '}
                    {line.iscteNote}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Monthly passes & pay-as-you-go
                </p>
                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Navegante & Train Tickets
                </h2>
              </div>
              <Ticket className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {NAVEGANTE_FARES.map((fare) => (
                <div
                  key={fare.name}
                  className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF] tabular-nums">
                      {fare.price}
                    </p>
                    <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {fare.name}
                    </h3>
                    <p className="text-xs text-[#1D1D1F]/85 dark:text-[#F5F5F7]/85 mt-1.5 leading-relaxed">
                      {fare.coverage}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] pt-2 border-t border-black/[0.06] dark:border-white/[0.08] leading-snug">
                    {fare.eligibility}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Quick street reference
                </p>
                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Emergency Numbers & Local Etiquette
                </h2>
              </div>
              <ShieldAlert className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LISBON_ESSENTIALS_INFO.map((item) => (
                <div key={item.label} className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {item.label}
                    </h3>
                    <span className="text-xs font-semibold tabular-nums text-[#0071E3] dark:text-[#0A84FF] shrink-0">
                      {item.value}
                    </span>
                  </div>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 3: CAMERA & TEXT DECODER (OPTIONAL AI VISION TOOL)        */}
      {/* ================================================================= */}
      {subTab === 'decoder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleDecodeSubmit}
            className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div>
              <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                AI Photo & Document Lens
              </p>
              <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                Snap a Menu, Sign, or Lease
              </h2>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageFile}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFile}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[46px] px-3 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#0077ED] transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>iPhone Camera</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[46px] px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-black/[0.08] dark:hover:bg-white/[0.14] transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Upload Photo</span>
              </button>
            </div>

            {decodeImage && (
              <div className="relative rounded-2xl overflow-hidden bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08]">
                <img
                  src={decodeImage.previewUrl}
                  alt="Captured Portuguese document preview"
                  className="w-full max-h-56 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setDecodeImage(null)}
                  aria-label="Remove photo"
                  className="absolute top-2.5 right-2.5 min-w-[36px] min-h-[36px] rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label
                  htmlFor="decode-text"
                  className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
                >
                  Or paste Portuguese text
                </label>
                <div className="flex items-center gap-3">
                  {SAMPLE_DECODER_SNIPPETS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => {
                        setDecodeText(sample.text);
                        setDecodeContext(sample.context);
                      }}
                      className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline cursor-pointer"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="decode-text"
                rows={4}
                value={decodeText}
                onChange={(e) => setDecodeText(e.target.value)}
                placeholder="Paste a menu item, landlord WhatsApp message, utility bill, or lease clause…"
                className="w-full p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] dark:focus:border-[#0A84FF] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="decode-context"
                className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5"
              >
                Document type
              </label>
              <select
                id="decode-context"
                value={decodeContext}
                onChange={(e) => setDecodeContext(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                <option value="Auto-detect">Auto-detect</option>
                <option value="Restaurant Menu">Restaurant / Tasca Menu</option>
                <option value="Rental Contract">Rental Contract / Lease Clause</option>
                <option value="Utility Bill / Letter">Utility Bill / Finanças Letter</option>
                <option value="Street Sign / Transit Notice">Street Sign / Transit Notice</option>
                <option value="Print Shop Price List">Architecture Print Shop Notice</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={decoding}
              className="w-full min-h-[46px] rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {decoding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Decoding…</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span>Decode & Explain</span>
                </>
              )}
            </button>

            {decodeError && <p className="text-xs text-red-600 dark:text-red-400">{decodeError}</p>}
          </form>

          <div className="lg:col-span-7 space-y-5">
            {decodedResult ? (
              <article className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                    Decoded · {decodedResult.detectedType}
                  </p>
                  <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
                    {decodedResult.originalSummary}
                  </h2>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                    Plain English meaning
                  </h3>
                  <p className="text-sm text-[#1D1D1F] dark:text-[#F5F5F7] mt-1.5 leading-relaxed whitespace-pre-line">
                    {decodedResult.englishTranslation}
                  </p>
                </div>

                {decodedResult.lisbonGotchas?.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-400/[0.10] space-y-2">
                    <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Good to know in Lisbon</span>
                    </h3>
                    <ul className="space-y-1.5 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                      {decodedResult.lisbonGotchas.map((g, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-700 dark:text-amber-300 font-semibold">·</span>
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                    What to do next
                  </h3>
                  <p className="text-sm text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 leading-relaxed">
                    {decodedResult.actionAdvice}
                  </p>
                </div>

                {decodedResult.replyPhrases?.length > 0 && (
                  <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
                    <h3 className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                      Ready-to-say Portuguese replies
                    </h3>
                    <div className="space-y-2.5">
                      {decodedResult.replyPhrases.map((rp, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {rp.portuguese}
                            </p>
                            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                              {rp.english}
                            </p>
                            <p className="text-xs text-[#0071E3] dark:text-[#0A84FF] mt-1">
                              {rp.phonetic}
                            </p>
                          </div>
                          {renderSpeakButton(rp.portuguese, rp.english)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-8 sm:p-10 text-center space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  Only when you need AI vision
                </p>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Point your iPhone at any menu, sign, or lease
                </h2>
                <p className="text-sm text-[#6E6E73] dark:text-[#98989D] max-w-md mx-auto leading-relaxed">
                  For everyday phrases, terms, and Lisbon transit rules, use the instant offline tabs above. Use Camera Lens whenever you need to read an unfamiliar Portuguese document.
                </p>
              </div>
            )}

            {decodedHistory.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] px-1">
                  Recent offline decodes
                </p>
                <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
                  {decodedHistory.slice(0, 5).map((item, idx) => (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => setDecodedResult(item)}
                      className="w-full text-left px-4 py-3.5 hover:bg-black/[0.025] dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                        {item.originalSummary}
                      </span>
                      <span className="text-xs text-[#6E6E73] dark:text-[#98989D] shrink-0">
                        {item.detectedType}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 4: SAVED OFFLINE SPOTS WITH GOOGLE & APPLE MAPS BUTTONS   */}
      {/* ================================================================= */}
      {subTab === 'saved' && (
        <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div>
              <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                Stored offline on your device
              </p>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                Saved Lisbon Spots ({savedSpots.length})
              </h2>
            </div>
            <Bookmark className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
          </div>

          {savedSpots.length === 0 ? (
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D] leading-relaxed py-4">
              Spots you save from the Atlas map (architecture sites, print shops, study cafes, and tascas) appear here automatically for offline access with direct Google Maps and Apple Maps launch links.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedSpots.map((spot) => (
                <div
                  key={spot.id}
                  className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                          {spot.displayName}
                        </p>
                        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                          {spot.formattedAddress}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveSavedSpot(spot.id)}
                        aria-label={`Remove ${spot.displayName}`}
                        className="min-w-[36px] min-h-[36px] rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.10] flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:text-red-600 dark:hover:text-red-400 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {spot.note && (
                      <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] bg-white dark:bg-[#1C1C1E] px-3 py-2 rounded-xl">
                        {spot.note}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={buildGoogleMapsPlaceUrl(spot.location, spot.displayName, spot.googleMapsURI)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <a
                      href={buildAppleMapsPlaceUrl(spot.location, spot.displayName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 rounded-xl bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <span>Apple Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
