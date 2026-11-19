export type AppTab = 'mystay' | 'atlas' | 'housing' | 'trips' | 'guide';

export type AtlasCategory =
  | 'architecture'
  | 'print_model'
  | 'study_wifi'
  | 'tascas_views'
  | 'essentials';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface LivePlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: LatLngLiteral;
  rating?: number | null;
  userRatingCount?: number | null;
  openNow?: boolean | null;
  weekdayDescriptions?: string[];
  priceLevel?: string | null;
  nationalPhoneNumber?: string | null;
  editorialSummary?: string | null;
  photoUrl?: string | null;
  primaryTypeDisplayName?: string;
  websiteURI?: string | null;
  googleMapsURI?: string | null;
  category: AtlasCategory | 'search' | 'saved';
}

export interface NearbyTransitStop {
  id: string;
  name: string;
  type: string;
  location: LatLngLiteral;
  distanceMeters: number;
  walkMinutes: number;
}

export interface NearbyAmenity {
  id: string;
  name: string;
  category: 'transit' | 'grocery' | 'cafe';
  typeLabel: string;
  distanceMeters: number;
  walkMinutes: number;
  rating?: number | null;
  location: LatLngLiteral;
  googleMapsURI?: string | null;
}

export interface SavedSpot {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: LatLngLiteral;
  category: string;
  note: string;
  savedAt: string;
  googleMapsURI?: string | null;
}

export interface TransitStepInfo {
  travelMode: 'WALKING' | 'TRANSIT' | 'BICYCLING' | 'DRIVING' | 'OTHER';
  distanceMeters: number;
  durationMinutes: number;
  instructions?: string;
  lineName?: string;
  lineShortName?: string;
  lineColor?: string;
  lineTextColor?: string;
  vehicleType?: string;
  vehicleName?: string;
  agencyName?: string;
  departureStop?: string;
  arrivalStop?: string;
  departureTimeText?: string;
  arrivalTimeText?: string;
  headsign?: string;
  stopCount?: number;
  headwayMinutes?: number;
  departureLocation?: LatLngLiteral;
  arrivalLocation?: LatLngLiteral;
}

export interface RouteSummary {
  travelMode: 'TRANSIT' | 'WALKING' | 'BICYCLING';
  distanceMeters: number;
  durationMinutes: number;
  departureTimeText?: string;
  arrivalTimeText?: string;
  fareText?: string;
  summaryText?: string;
  steps: TransitStepInfo[];
  rawRoute?: any;
}

export interface WebSource {
  title: string;
  uri: string;
}

export interface NeighborhoodDossier {
  id: string;
  name: string;
  query: string;
  coords: LatLngLiteral;
  rentRange: string;
  metroLines: Array<{ label: string; color: string; textColor: string }>;
  commuteNote: string;
  hilliness: 'Flat' | 'Gentle Slopes' | 'Hilly';
  walkability: string;
  vibeTag: string;
  architectureNote: string;
  summary: string;
  bestStreets: string[];
  pros: string[];
  tradeoffs: string[];
  supermarkets: string;
}

export interface HousingAnalysis {
  headline: string;
  typicalStudentRent: string;
  hillinessAndWalkability: string;
  commuteAndTransit: string;
  neighborhoodVibe: string;
  leaseRedFlags: string[];
  questionsForLandlordPt: Array<{
    english: string;
    portuguese: string;
  }>;
  sources: WebSource[];
}

export interface WeatherSnapshot {
  condition: string;
  conditionType: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  windKmh: number | null;
  rainChance: number | null;
  uvIndex: number | null;
  isDaytime: boolean;
  updatedAt: string;
}

export interface TripScheduleItem {
  time: string;
  durationMinutes: number;
  title: string;
  location: string;
  notes: string;
}

export interface CuratedTripPreset {
  id: string;
  name: string;
  region: string;
  subtitle: string;
  transitTag: string;
  departureStation: string;
  transitLine: string;
  naveganteCovered: boolean;
  naveganteNote: string;
  bestFor: string;
  coords: LatLngLiteral;
  image: string;
  defaultBudget: number;
  budgetBreakdown: {
    transit: string;
    food: string;
    tickets: string;
  };
  architectureHighlight: string;
  packingTip: string;
  insiderTips: string[];
  schedule: TripScheduleItem[];
}

export interface TripPlan {
  id?: string;
  destination: string;
  title: string;
  transportBrief: string;
  architectureHighlight: string;
  estimatedCostEur: string;
  packingTip: string;
  schedule: TripScheduleItem[];
  sources: WebSource[];
  savedAt?: string;
}

export interface DecodedPortuguese {
  id?: string;
  detectedType: string;
  originalSummary: string;
  englishTranslation: string;
  lisbonGotchas: string[];
  actionAdvice: string;
  replyPhrases: Array<{
    portuguese: string;
    english: string;
    phonetic: string;
  }>;
  createdAt?: string;
}

export interface PhraseEntry {
  id: string;
  category: 'cafe' | 'studio' | 'transit' | 'housing' | 'essentials' | 'urgent';
  english: string;
  portuguese: string;
  phonetic: string;
  context: string;
}

export interface GlossaryTerm {
  term: string;
  category: 'Menu' | 'Housing' | 'Transit' | 'Daily';
  meaning: string;
  tip: string;
}

export interface ChecklistItemDef {
  id: string;
  topic: string;
  subtitle: string;
  priority: 'Week 1' | 'Before Arrival' | 'First Month';
  whereToGo: string;
  estimatedCost: string;
  documentsNeeded: string[];
  officialUrl?: string;
  officialLabel?: string;
  steps: Array<{ id: string; label: string }>;
  searchPromptContext: string;
}

export interface BureaucracyVerification {
  summary: string;
  currentFeesOrEligibility: string;
  latestSteps: string[];
  verifiedAt: string;
  sources: WebSource[];
}
