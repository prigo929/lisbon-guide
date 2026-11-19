import { BureaucracyVerification, DecodedPortuguese, SavedSpot, TripPlan } from '../types';

const KEYS = {
  SAVED_SPOTS: 'caderno_lx_saved_spots_v1',
  CHECKLIST_DONE: 'caderno_lx_checklist_done_v1',
  CHECKLIST_VERIFIED: 'caderno_lx_checklist_verified_v1',
  SAVED_TRIPS: 'caderno_lx_saved_trips_v1',
  DECODED_HISTORY: 'caderno_lx_decoded_v1',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadSavedSpots(): SavedSpot[] {
  return readJson<SavedSpot[]>(KEYS.SAVED_SPOTS, []);
}

export function saveSavedSpots(spots: SavedSpot[]): void {
  writeJson(KEYS.SAVED_SPOTS, spots);
}

export function loadChecklistDone(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(KEYS.CHECKLIST_DONE, {});
}

export function saveChecklistDone(done: Record<string, boolean>): void {
  writeJson(KEYS.CHECKLIST_DONE, done);
}

export function loadChecklistVerifications(): Record<string, BureaucracyVerification> {
  return readJson<Record<string, BureaucracyVerification>>(KEYS.CHECKLIST_VERIFIED, {});
}

export function saveChecklistVerifications(data: Record<string, BureaucracyVerification>): void {
  writeJson(KEYS.CHECKLIST_VERIFIED, data);
}

export function loadSavedTrips(): TripPlan[] {
  return readJson<TripPlan[]>(KEYS.SAVED_TRIPS, []);
}

export function saveSavedTrips(trips: TripPlan[]): void {
  writeJson(KEYS.SAVED_TRIPS, trips);
}

export function loadDecodedHistory(): DecodedPortuguese[] {
  return readJson<DecodedPortuguese[]>(KEYS.DECODED_HISTORY, []);
}

export function saveDecodedHistory(items: DecodedPortuguese[]): void {
  writeJson(KEYS.DECODED_HISTORY, items.slice(0, 12));
}
