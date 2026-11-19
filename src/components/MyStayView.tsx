import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  RefreshCw,
  MapPin,
  Phone,
  ShieldAlert,
  Plane,
  Wallet,
  Home,
  GraduationCap,
  Clock,
  FileCheck2,
  Building2,
  Sparkles,
} from 'lucide-react';
import { BUREAUCRACY_CHECKLISTS, ISCTE_CAMPUS } from '../data/lisbonData';
import {
  DAILY_LISBON_SURVIVAL,
  HOUSING_PORTALS_LIST,
  ISCTE_ARCH_ESSENTIALS,
  KEY_STUDENT_OFFICES,
  LISBON_AIRPORT_COORDS,
  MONEY_CARDS_GUIDE,
  MONTHLY_BUDGET_ROWS,
  PT_TO_RO_GRADING_SCALE,
  ROMANIA_FLIGHTS_INFO,
  ROMANIAN_DOCS_DEEP_DIVE,
  ROMANIAN_EMBASSY,
  ROMANIAN_EU_QUICK_FACTS,
} from '../data/romanianStayData';
import { BureaucracyVerification } from '../types';
import {
  buildAppleMapsDirectionsUrl,
  buildAppleMapsPlaceUrl,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceUrl,
} from '../utils/routeHelpers';

interface MyStayViewProps {
  checklistDone: Record<string, boolean>;
  onToggleChecklistStep: (stepId: string) => void;
  verifications: Record<string, BureaucracyVerification>;
  onSaveVerification: (topicId: string, data: BureaucracyVerification) => void;
  onNotify: (msg: string) => void;
}

type StaySection = 'docs' | 'money' | 'daily' | 'iscte';

function formatClock(timeZone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return '--:--';
  }
}

export const MyStayView: React.FC<MyStayViewProps> = ({
  checklistDone,
  onToggleChecklistStep,
  verifications,
  onSaveVerification,
  onNotify,
}) => {
  const [section, setSection] = useState<StaySection>('docs');
  const [verifyingTopic, setVerifyingTopic] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<Record<string, string>>({});
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const totalSteps = BUREAUCRACY_CHECKLISTS.reduce((acc, c) => acc + c.steps.length, 0);
  const completedSteps = BUREAUCRACY_CHECKLISTS.reduce(
    (acc, c) => acc + c.steps.filter((s) => checklistDone[s.id]).length,
    0
  );
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const handleVerifyTopic = async (topicId: string, topic: string, context: string) => {
    setVerifyingTopic(topicId);
    setVerifyError((prev) => ({ ...prev, [topicId]: '' }));
    try {
      const res = await fetch('/api/ai/bureaucracy-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, detail: context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      onSaveVerification(topicId, data);
      onNotify(`Updated latest Lisbon rules for ${topic}.`);
    } catch (err: any) {
      setVerifyError((prev) => ({
        ...prev,
        [topicId]: err?.message || 'Unable to verify online rules.',
      }));
    } finally {
      setVerifyingTopic(null);
    }
  };

  const lisbonTime = formatClock('Europe/Lisbon', now);
  const bucharestTime = formatClock('Europe/Bucharest', now);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 pb-24 lg:pb-12 space-y-7">
      {/* Header + 4-Way Segmented Control */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
            Romanian EU Citizen · ISCTE School of Architecture · Offline Handbook
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1">
            My Lisbon Stay
          </h1>
        </div>

        <div className="inline-flex p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] overflow-x-auto self-start lg:self-auto max-w-full">
          {(
            [
              { id: 'docs', label: 'EU & RO Docs', icon: FileCheck2 },
              { id: 'money', label: 'Money & Flights', icon: Wallet },
              { id: 'daily', label: 'Daily Lisbon', icon: Home },
              { id: 'iscte', label: 'ISCTE Arch', icon: GraduationCap },
            ] as Array<{ id: StaySection; label: string; icon: React.FC<{ className?: string }> }>
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`min-h-[38px] px-3.5 sm:px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                  section === t.id
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-sm'
                    : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Romanian EU Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {ROMANIAN_EU_QUICK_FACTS.map((fact) => (
          <div
            key={fact.label}
            className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-4 space-y-1 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
          >
            <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
              {fact.label}
            </p>
            <p className="text-sm font-semibold text-[#0071E3] dark:text-[#0A84FF]">
              {fact.value}
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
              {fact.note}
            </p>
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* SECTION 1: EU & ROMANIAN DOCUMENTS + INTERACTIVE CHECKLIST        */}
      {/* ================================================================= */}
      {section === 'docs' && (
        <div className="space-y-6">
          {/* Romanian Citizen Deep-Dive Cards + Embassy Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                    Romanian EU Citizen Playbook
                  </p>
                  <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                    ID Card, CEASS, NIF, CRUE & Sub23 Pass
                  </h2>
                </div>

                <div className="space-y-4">
                  {ROMANIAN_DOCS_DEEP_DIVE.map((doc) => (
                    <article
                      key={doc.id}
                      className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-2.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {doc.title}
                        </h3>
                        <span className="text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                          {doc.badge}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#1D1D1F]/90 dark:text-[#F5F5F7]/90 leading-relaxed">
                        {doc.summary}
                      </p>
                      <ul className="space-y-1.5 pt-1 text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                        {doc.bullets.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-[#0071E3] dark:text-[#0A84FF] font-semibold">·</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Romanian Embassy + Key Lisbon Offices with Dual Maps Buttons */}
            <aside className="lg:col-span-4 space-y-5">
              {/* Romanian Embassy & Emergency Card */}
              <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="pb-3 border-b border-black/[0.06] dark:border-white/[0.08] flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                      Ambasada României · Lisboa
                    </p>
                    <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {ROMANIAN_EMBASSY.name}
                    </h2>
                  </div>
                  <ShieldAlert className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">
                    {ROMANIAN_EMBASSY.address}
                  </p>
                  <p className="text-[#6E6E73] dark:text-[#98989D]">
                    {ROMANIAN_EMBASSY.metro} · {ROMANIAN_EMBASSY.hours}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {ROMANIAN_EMBASSY.phone && (
                    <a
                      href={`tel:${ROMANIAN_EMBASSY.phone.replace(/\s+/g, '')}`}
                      className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-between text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-85"
                    >
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Phone className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                        <span>Embassy Main Desk</span>
                      </span>
                      <span className="tabular-nums font-semibold">{ROMANIAN_EMBASSY.phone}</span>
                    </a>
                  )}
                  {ROMANIAN_EMBASSY.emergencyPhone && (
                    <a
                      href={`tel:${ROMANIAN_EMBASSY.emergencyPhone.replace(/\s+/g, '')}`}
                      className="w-full min-h-[40px] px-3.5 rounded-xl bg-amber-500/[0.10] dark:bg-amber-400/[0.14] flex items-center justify-between text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-85"
                    >
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                        <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>24/7 Consular Emergency</span>
                      </span>
                      <span className="tabular-nums font-semibold">
                        {ROMANIAN_EMBASSY.emergencyPhone}
                      </span>
                    </a>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href="tel:112"
                      className="min-h-[38px] px-3 rounded-xl bg-red-500/10 dark:bg-red-400/15 text-red-700 dark:text-red-300 font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>112 EU Emergency</span>
                    </a>
                    <a
                      href="tel:808242424"
                      className="min-h-[38px] px-3 rounded-xl bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>SNS 24 Health</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <a
                    href={buildGoogleMapsDirectionsUrl(ISCTE_CAMPUS.location, ROMANIAN_EMBASSY.coords, 'TRANSIT')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                  <a
                    href={buildAppleMapsDirectionsUrl(ISCTE_CAMPUS.location, ROMANIAN_EMBASSY.coords, 'TRANSIT')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                  >
                    <span>Apple Maps</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </section>

              {/* Key Lisbon Admin Offices */}
              <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                    One-tap transit from ISCTE
                  </p>
                  <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                    Key Lisbon Offices & Hospital
                  </h2>
                </div>
                <div className="space-y-3">
                  {KEY_STUDENT_OFFICES.map((office) => (
                    <div
                      key={office.id}
                      className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {office.name}
                        </p>
                        <p className="text-[11px] font-medium text-[#0071E3] dark:text-[#0A84FF]">
                          {office.role}
                        </p>
                      </div>
                      <p className="text-[#6E6E73] dark:text-[#98989D] leading-snug">
                        {office.address} · {office.metro}
                      </p>
                      <div className="flex items-center gap-3 pt-0.5 text-[11px] font-semibold">
                        <a
                          href={buildGoogleMapsDirectionsUrl(ISCTE_CAMPUS.location, office.coords, 'TRANSIT')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0071E3] dark:text-[#0A84FF] hover:underline"
                        >
                          <span>Google Maps</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                        <span className="text-black/20 dark:text-white/20">·</span>
                        <a
                          href={buildAppleMapsDirectionsUrl(ISCTE_CAMPUS.location, office.coords, 'TRANSIT')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#1D1D1F] dark:text-[#F5F5F7] hover:underline"
                        >
                          <span>Apple Maps</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          {/* Interactive Arrival Checklist (Offline Synced) */}
          <section className="space-y-4">
            <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Saved offline on your iPhone
                </p>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Arrival & Paperwork Checklist
                </h2>
              </div>
              <div className="sm:w-64 space-y-1.5">
                <div className="flex items-baseline justify-between text-xs tabular-nums">
                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {completedSteps} of {totalSteps} completed
                  </span>
                  <span className="font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.10] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0071E3] dark:bg-[#0A84FF] transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {BUREAUCRACY_CHECKLISTS.map((group) => {
                const doneCount = group.steps.filter((s) => checklistDone[s.id]).length;
                const verified = verifications[group.id];
                const isVerifying = verifyingTopic === group.id;

                return (
                  <section
                    key={group.id}
                    className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                      <div>
                        <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                          {group.priority} · {doneCount}/{group.steps.length} complete
                        </p>
                        <h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                          {group.topic}
                        </h3>
                        <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
                          {group.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {group.officialUrl && (
                          <a
                            href={group.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] px-3 rounded-full bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0071E3] dark:text-[#0A84FF] text-xs font-semibold inline-flex items-center gap-1 hover:opacity-80"
                          >
                            <span>Portal</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleVerifyTopic(group.id, group.topic, group.searchPromptContext)
                          }
                          disabled={isVerifying}
                          title="Check live official rules online"
                          className="min-h-[34px] px-3 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#6E6E73] dark:text-[#98989D] text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{isVerifying ? 'Checking…' : 'Verify'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                        <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1">
                          <MapPin className="w-3 h-3" aria-hidden="true" />
                          <span>Where to go</span>
                        </p>
                        <p className="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium mt-0.5 leading-snug">
                          {group.whereToGo}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                        <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                          Typical Cost
                        </p>
                        <p className="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium mt-0.5 leading-snug">
                          {group.estimatedCost}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                      <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Bring:</strong>{' '}
                      {group.documentsNeeded.join(' · ')}
                    </p>

                    <div className="space-y-1 pt-1">
                      {group.steps.map((step) => {
                        const checked = !!checklistDone[step.id];
                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => onToggleChecklistStep(step.id)}
                            className="w-full text-left py-2 px-2.5 -mx-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] flex items-start gap-3 transition-colors cursor-pointer"
                          >
                            {checked ? (
                              <CheckCircle2
                                className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF] mt-0.5 shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <Circle
                                className="w-5 h-5 text-[#6E6E73]/60 dark:text-[#98989D]/60 mt-0.5 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span
                              className={`text-xs sm:text-sm leading-snug ${
                                checked
                                  ? 'line-through text-[#6E6E73] dark:text-[#98989D]'
                                  : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                              }`}
                            >
                              {step.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {verifyError[group.id] && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {verifyError[group.id]}
                      </p>
                    )}

                    {verified && (
                      <div className="p-3.5 rounded-2xl bg-[#0071E3]/[0.06] dark:bg-[#0A84FF]/[0.12] space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2 font-medium text-[#0071E3] dark:text-[#0A84FF]">
                          <span>Verified online update</span>
                          <span>{new Date(verified.verifiedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                          {verified.summary}
                        </p>
                        <p className="text-[#6E6E73] dark:text-[#98989D]">
                          <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Fees:</strong>{' '}
                          {verified.currentFeesOrEligibility}
                        </p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 2: MONEY, RON → EUR, BUDGET & BUCHAREST ↔ LISBON FLIGHTS  */}
      {/* ================================================================= */}
      {section === 'money' && (
        <div className="space-y-6">
          {/* Live Lisbon vs Bucharest Dual Clock + Flight Connection Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                    RON ↔ EUR & Portuguese Banking
                  </p>
                  <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                    Cards, Multibanco ATMs & Cash
                  </h2>
                </div>
                <Wallet className="w-6 h-6 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
              </div>

              <div className="space-y-3.5">
                {MONEY_CARDS_GUIDE.map((m) => (
                  <div
                    key={m.title}
                    className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {m.title}
                      </h3>
                      <span className="text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF]">
                        {m.tag}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                      {m.detail}
                    </p>
                    <p className="text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] pt-2 border-t border-black/[0.06] dark:border-white/[0.08] leading-relaxed">
                      {m.rule}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Right: Bucharest ↔ Lisbon Flights, Time Zone & Airport Transfer */}
            <div className="lg:col-span-5 space-y-5">
              {/* Dual Live Clocks */}
              <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between text-xs text-[#6E6E73] dark:text-[#98989D]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    <Clock className="w-4 h-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                    <span>Live Time Difference (−2h)</span>
                  </span>
                  <span>Same EU DST dates</span>
                </div>
                <div className="grid grid-cols-2 gap-3 tabular-nums">
                  <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                    <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                      Lisbon (Portugal)
                    </p>
                    <p className="text-2xl font-semibold text-[#0071E3] dark:text-[#0A84FF] mt-0.5">
                      {lisbonTime}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]">
                    <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                      Bucharest (Romania)
                    </p>
                    <p className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {bucharestTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Flights & Airport Transfer */}
              <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <div>
                    <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                      OTP / CLJ ↔ LIS (~4h 25m)
                    </p>
                    <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      Romania Flights & LIS Airport Arrival
                    </h2>
                  </div>
                  <Plane className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                </div>

                <div className="space-y-2.5">
                  {ROMANIA_FLIGHTS_INFO.routes.map((r) => (
                    <div
                      key={r.airline}
                      className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] space-y-1 text-xs"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {r.airline}
                        </span>
                        <span className="text-[11px] text-[#0071E3] dark:text-[#0A84FF] font-medium">
                          {r.duration}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                        {r.route}
                      </p>
                      <p className="text-[#1D1D1F]/85 dark:text-[#F5F5F7]/85 leading-relaxed">
                        {r.tip}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
                  <h3 className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Landing Day: Airport (LIS) → ISCTE Entrecampos
                  </h3>
                  <ol className="space-y-1.5 text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed list-decimal list-inside">
                    {ROMANIA_FLIGHTS_INFO.airportToIscte.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={buildGoogleMapsDirectionsUrl(LISBON_AIRPORT_COORDS, ISCTE_CAMPUS.location, 'TRANSIT')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <a
                      href={buildAppleMapsDirectionsUrl(LISBON_AIRPORT_COORDS, ISCTE_CAMPUS.location, 'TRANSIT')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <span>Apple Maps</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Realistic Monthly Student Budget Table (EUR + RON) */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Planning your Erasmus+ grant & personal savings (approx. 5.0 RON / €1)
                </p>
                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Realistic Monthly Lisbon Architecture Student Budget
                </h2>
              </div>
              <p className="text-sm font-semibold tabular-nums text-[#0071E3] dark:text-[#0A84FF]">
                Typical Total: €725 – €1,150 / mo (~3,625 – 5,750 RON)
              </p>
            </div>

            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {MONTHLY_BUDGET_ROWS.map((row) => (
                <div
                  key={row.item}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {row.item}
                    </p>
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">{row.note}</p>
                  </div>
                  <div className="sm:text-right shrink-0 tabular-nums">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {row.eur}
                    </p>
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D]">{row.ron}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 3: DAILY LISBON LIFE (PORTALS, BILLS, HUMIDITY, PERKS)    */}
      {/* ================================================================= */}
      {section === 'daily' && (
        <div className="space-y-6">
          {/* Trusted Lisbon Rent Portals */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                  Finding a room safely from Romania
                </p>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Lisbon Rent Portals & Anti-Scam Rules
                </h2>
              </div>
              <Building2 className="w-6 h-6 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HOUSING_PORTALS_LIST.map((portal) => (
                <div
                  key={portal.name}
                  className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {portal.name}
                      </h3>
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF] hover:underline shrink-0"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>
                    <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                      {portal.type}
                    </p>
                    <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                      <strong>Best for:</strong> {portal.pros}
                    </p>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/[0.09] dark:bg-amber-400/[0.12] p-2.5 rounded-xl leading-relaxed">
                    <strong>Watch out:</strong> {portal.watchOut}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Daily Lisbon Living Survival Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DAILY_LISBON_SURVIVAL.map((card) => (
              <article
                key={card.title}
                className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div>
                  <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                    {card.tag}
                  </p>
                  <h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                    {card.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                  {card.detail}
                </p>
                <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-[#2C2C2E] p-3.5 rounded-2xl leading-relaxed">
                  <strong>Action tip:</strong> {card.tip}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 4: ISCTE ARCHITECTURE (ECTS, CRITS, WORKSHOPS, LIBRARIES) */}
      {/* ================================================================= */}
      {section === 'iscte' && (
        <div className="space-y-6">
          {/* Campus Quick Anchor with Dual Maps Buttons */}
          <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#0071E3] dark:text-[#0A84FF]">
                Escola de Tecnologias e Arquitetura (ISTA) · Entrecampos
              </p>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {ISCTE_CAMPUS.name}
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                {ISCTE_CAMPUS.address} · {ISCTE_CAMPUS.metro}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={buildGoogleMapsPlaceUrl(ISCTE_CAMPUS.location, ISCTE_CAMPUS.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-4 rounded-xl bg-[#0071E3] dark:bg-[#0A84FF] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
              <a
                href={buildAppleMapsPlaceUrl(ISCTE_CAMPUS.location, ISCTE_CAMPUS.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-4 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90"
              >
                <span>Apple Maps</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Portuguese 0–20 → Romanian 1–10 & ECTS Conversion Table */}
          <section className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <p className="text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Typical Learning Agreement equivalence (confirm exact table with your RO faculty)
                </p>
                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                  Portuguese 0–20 Scale → Romanian 1–10 & ECTS
                </h2>
              </div>
              <Sparkles className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF] shrink-0" aria-hidden="true" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] dark:border-white/[0.10] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D]">
                    <th className="py-2.5 pr-4">Portugal (0–20)</th>
                    <th className="py-2.5 pr-4">Romania (1–10)</th>
                    <th className="py-2.5 pr-4">ECTS</th>
                    <th className="py-2.5">Meaning at ISCTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] tabular-nums">
                  {PT_TO_RO_GRADING_SCALE.map((row) => (
                    <tr key={row.pt}>
                      <td className="py-3 pr-4 font-semibold text-[#0071E3] dark:text-[#0A84FF] whitespace-nowrap">
                        {row.pt}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
                        {row.ro}
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
                        {row.ects}
                      </td>
                      <td className="py-3 text-xs text-[#6E6E73] dark:text-[#98989D]">
                        {row.label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ISCTE Architecture Practical Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ISCTE_ARCH_ESSENTIALS.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
