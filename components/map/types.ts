export type Pandal = {
  slug: string;
  name: string;
  zone: string;
  locality: string;
  categories: string[];
  description: string;
  established: number | null;
  rating: number | null;
  views: number | null;
  crowd: string;
  lat: number;
  lng: number;
  address: string;
  metro: string;
  featured: boolean;
  verified: boolean;
  image: string;
  coordinateStatus: string;
};

export type Poi = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  openHours: string;
};

export type RouteStop = {
  id?: string | number | null;
  name: string;
  locality: string;
  zone: string;
  lat: number;
  lng: number;
  nearestMetro: string;
};

export type CuratedRoute = {
  id: string;
  shareCode: string;
  number: number;
  title: string;
  zone: string;
  metroHub: string;
  earlyExits: string;
  bestUse: string;
  finishLocation: string;
  travelMode: string;
  stopsCount: number;
  likeCount: number;
  start: RouteStop | null;
  end: RouteStop | null;
  waypoints: RouteStop[];
  apiSummary: { distance?: number; duration?: number } | null;
};

export type TrailSection = { title: string; stops: string[] };

export type RouteCopy = {
  zone: string;
  stops: number;
  title: string;
  metro: string;
  description: string;
  start: string;
  finish: string;
  earlyExits: string;
  sectionCount: number;
  sections: TrailSection[];
  likesDisplay: string;
  arrival?: string;
};

export type RouteSegment = {
  mode: string;
  coords: [number, number][];
  label?: string;
};

export type RouteGeo = {
  stopCount: number;
  distanceM: number | null;
  durationS: number | null;
  km: number | null;
  summaryMode: string | null;
  summaryLine: string;
  turnSteps: number | null;
  savesSeconds: number | null;
  modeTimes: { walk: string | null; drive: string | null; cycle: string | null; transit: string | null };
  modeSeconds: { walk: number | null; drive: number | null; cycle: number | null; transit: number | null };
  segments: RouteSegment[];
  coords: [number, number][];
  legs: { label: string; href: string }[];
};

export type RouteGeoMap = Record<string, RouteGeo>;

export type PlannerStop = {
  id: string;
  name: string;
  locality: string;
  zone?: string;
  lat: number;
  lng: number;
  metro?: string;
  kind: "pandal" | "poi" | "gps";
};

export type TravelMode = "walk" | "drive" | "cycle" | "transit";

export type PlannerResult = {
  stops: PlannerStop[];
  mode: TravelMode;
  distanceM: number;
  segments: RouteSegment[];
  coords: [number, number][];
  modeSeconds: Record<TravelMode, number>;
  turnSteps: number;
  steps: { instruction: string; distanceM: number; durationS: number }[];
  googleUrl: string;
  nearby: { pandal: Pandal; distanceM: number; alongIndex: number }[];
  fallback: boolean;
  activeModeSeconds: number;
};

export type MapTab = "filters" | "trails" | "planner" | "ai";

export type MapFilters = {
  query: string;
  zone: string;
  category: string;
  transit: string;
  heritage: boolean;
  crowd: string;
  savedOnly: boolean;
};
