import { TripPlan } from '../types';

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatLocalDateTime(dateStr: string, timeStr: string, addMinutes = 0): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '09:00').split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 9, (mm || 0) + addMinutes, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

export function downloadTripAsIcs(plan: TripPlan, tripDateIso: string): void {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Caderno Lisboa//ISCTE Erasmus Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(plan.title)}`,
    'X-WR-TIMEZONE:Europe/Lisbon',
  ];

  plan.schedule.forEach((item, idx) => {
    const start = formatLocalDateTime(tripDateIso, item.time, 0);
    const end = formatLocalDateTime(tripDateIso, item.time, item.durationMinutes || 60);
    const uid = `caderno-lx-${Date.now()}-${idx}@lisbon.local`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;TZID=Europe/Lisbon:${start}`,
      `DTEND;TZID=Europe/Lisbon:${end}`,
      `SUMMARY:${escapeIcsText(`${plan.destination}: ${item.title}`)}`,
      `LOCATION:${escapeIcsText(item.location || plan.destination)}`,
      `DESCRIPTION:${escapeIcsText(`${item.notes}\n\nTransit: ${plan.transportBrief}\nBudget: ${plan.estimatedCostEur}`)}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  const icsContent = lines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tripDateIso}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
