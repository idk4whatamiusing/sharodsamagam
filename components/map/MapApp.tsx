"use client";

import "leaflet/dist/leaflet.css";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type {
  CuratedRoute,
  MapFilters,
  MapTab,
  Pandal,
  PlannerResult,
  PlannerStop,
  Poi,
  RouteCopy,
  RouteGeoMap,
  RouteSegment,
  TravelMode,
} from "./types";
import {
  MODE_META,
  copyToClipboard,
  decodePolyline,
  appleMapsUrl,
  googleMapsUrl,
  haversineM,
  pandalsAlongRoute,
  poiIconPath,
  routeModeSeconds,
  stopFromPandal,
  straightLineStopMeters,
  titleCase,
  zoneLabel,
} from "./utils";
import { FilterPanel } from "./FilterPanel";
import { TrailsPanel } from "./TrailsPanel";
import { PlannerPanel } from "./PlannerPanel";
import {
  InstallBanner,
  MobilePanel,
  NearbySheet,
  PandalCard,
  PoiCard,
  RouteSheet,
  SuggestModal,
} from "./Overlays";
import { useSaves } from "../useSaves";
import { AiPlannerPanel } from "./AiPlannerPanel";
import { useAiChat } from "./aiChat";
import type { AiPlan } from "./AiPlannerPanel";
import { Icon, Toast } from "./ui";

const DEFAULT_FILTERS: MapFilters = {
  query: "",
  zone: "all",
  category: "all",
  transit: "all",
  heritage: false,
  crowd: "all",
  savedOnly: false,
};

const INITIAL_CENTER: [number, number] = [22.5726, 88.3639];

const MAJOR_POI_IDS = [
  "metro-howrah",
  "rail-sealdah",
  "metro-kalighat",
  "metro-dum-dum",
  "metro-shyambazar",
  "metro-park-street",
  "metro-esplanade",
  "rail-ballygunge-junction",
];

type MapData = {
  pandals: Pandal[];
  routes: CuratedRoute[];
  copy: Record<string, RouteCopy>;
  pois: Poi[];
};

type NearbyStatus = "idle" | "loading" | "ready" | "denied" | "error";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stopToken(stop: PlannerStop): string {
  if (stop.kind === "pandal" && stop.id) return `p:${stop.id}`;
  if (stop.kind === "poi" && stop.id) return `o:${stop.id}`;
  return `c:${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
}

export default function MapApp() {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pandalLayerRef = useRef<any>(null);
  const poiLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const userLayerRef = useRef<any>(null);
  const standardTileRef = useRef<any>(null);
  const satelliteTileRef = useRef<any>(null);
  const geoCacheRef = useRef<RouteGeoMap | null>(null);
  const plannerCacheRef = useRef<Map<string, PlannerResult>>(new Map());
  const bootedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [data, setData] = useState<MapData | null>(null);
  const [dataError, setDataError] = useState("");
  const [mapError, setMapError] = useState("");
  const [tab, setTab] = useState<MapTab>("filters");
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const { saves, toggle: toggleSaved } = useSaves();
  const saved = saves.pandals;
  const [selected, setSelected] = useState<Pandal | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [style, setStyle] = useState<"standard" | "satellite">("standard");
  const [zoom, setZoom] = useState(12);
  const [searchFocused, setSearchFocused] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [activeRoute, setActiveRoute] = useState<CuratedRoute | null>(null);
  const [activeGeo, setActiveGeo] = useState<RouteGeoMap[string] | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [plannerStops, setPlannerStops] = useState<PlannerStop[]>([]);
  const [plannerMode, setPlannerMode] = useState<TravelMode>("walk");
  const [plannerResult, setPlannerResult] = useState<PlannerResult | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);

  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>("idle");
  const [nearbyPandals, setNearbyPandals] = useState<{ pandal: Pandal; distanceM: number }[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3200);
  }, []);

  /* ------------------------------------------------------------ load data */
  const loadData = useCallback(async () => {
    setDataError("");
    try {
      const [pandalsResponse, routesResponse, copyResponse, poisResponse] = await Promise.all([
        fetch("/map/pandals.json"),
        fetch("/map/routes.json"),
        fetch("/map/route-copy.json"),
        fetch("/map/pois.json"),
      ]);
      if (!pandalsResponse.ok || !routesResponse.ok || !copyResponse.ok || !poisResponse.ok) {
        throw new Error("Map data could not be loaded");
      }
      const [pandals, routes, copy, pois] = await Promise.all([
        pandalsResponse.json(),
        routesResponse.json(),
        copyResponse.json(),
        poisResponse.json(),
      ]);
      if (!Array.isArray(pandals) || !Array.isArray(routes) || !Array.isArray(pois)) {
        throw new Error("Map data is malformed");
      }
      setData({ pandals, routes, copy, pois });
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Map data could not be loaded"
      );
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* --------------------------------------------------------------- map init */
  useEffect(() => {
    let cancelled = false;
    let map: any = null;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapNodeRef.current) return;
        leafletRef.current = L;
        map = L.map(mapNodeRef.current, {
          center: INITIAL_CENTER,
          zoom: window.innerWidth < 1024 ? 11 : 12,
          zoomControl: false,
          attributionControl: false,
          zoomSnap: 0.25,
          minZoom: 9,
          maxZoom: 19,
        });
        mapRef.current = map;
        setZoom(map.getZoom());

        const standard = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        });
        const satellite = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
          }
        );
        standardTileRef.current = standard;
        satelliteTileRef.current = satellite;
        standard.addTo(map);

        L.control
          .attribution({ position: "bottomleft", prefix: false })
          .addTo(map);

        routeLayerRef.current = L.layerGroup().addTo(map);
        pandalLayerRef.current = L.layerGroup().addTo(map);
        poiLayerRef.current = L.layerGroup().addTo(map);
        userLayerRef.current = L.layerGroup().addTo(map);

        map.on("click", () => {
          setSelected(null);
          setSelectedPoi(null);
          setSearchFocused(false);
        });
        map.on("zoomend", () => setZoom(map.getZoom()));
        setMapReady(true);
      } catch {
        if (!cancelled) {
          setMapError("The map could not be initialised. Please reload the page.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      leafletRef.current = null;
      pandalLayerRef.current = null;
      poiLayerRef.current = null;
      routeLayerRef.current = null;
      userLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (style === "satellite") {
      if (standardTileRef.current?.remove) map.removeLayer(standardTileRef.current);
      satelliteTileRef.current?.addTo(map);
    } else {
      if (satelliteTileRef.current?.remove) map.removeLayer(satelliteTileRef.current);
      standardTileRef.current?.addTo(map);
    }
  }, [style, mapReady]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 280);
    return () => clearTimeout(timer);
  }, [mobilePanelOpen, routeSheetOpen, nearbyOpen, suggestOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      setSelectedPoi(null);
      setMobilePanelOpen(false);
      setRouteSheetOpen(false);
      setNearbyOpen(false);
      setSuggestOpen(false);
      setSearchFocused(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* --------------------------------------------------------------- filters */
  const zoneCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data?.pandals.length || 0 };
    for (const pandal of data?.pandals || []) {
      counts[pandal.zone] = (counts[pandal.zone] || 0) + 1;
    }
    return counts;
  }, [data]);

  const { categoryCounts, heritageCount, crowdCounts, featuredCount } = useMemo(() => {
    const categories: Record<string, number> = {};
    const crowd: Record<string, number> = { all: data?.pandals.length || 0, high: 0, medium: 0, low: 0 };
    let heritage = 0;
    let featured = 0;
    for (const pandal of data?.pandals || []) {
      if (pandal.featured) {
        featured += 1;
        categories.featured = (categories.featured || 0) + 1;
      }
      for (const category of pandal.categories) {
        categories[category] = (categories[category] || 0) + 1;
      }
      if (pandal.established && pandal.established < 1951) heritage += 1;
      if (pandal.crowd in crowd) crowd[pandal.crowd] += 1;
    }
    return {
      categoryCounts: categories,
      heritageCount: heritage,
      crowdCounts: crowd,
      featuredCount: featured,
    };
  }, [data]);

  const transitCount = useMemo(
    () =>
      (data?.pois || []).filter((poi) =>
        ["metro-station", "railway-station", "ferry-ghat"].includes(poi.category)
      ).length,
    [data]
  );

  const filteredPandals = useMemo(() => {
    if (!data) return [];
    const query = filters.query.trim().toLowerCase();
    return data.pandals.filter((pandal) => {
      if (filters.zone !== "all" && pandal.zone !== filters.zone) return false;
      if (filters.category === "featured" && !pandal.featured) return false;
      if (
        filters.category !== "all" &&
        filters.category !== "featured" &&
        !pandal.categories.includes(filters.category)
      ) {
        return false;
      }
      if (filters.heritage && !(pandal.established && pandal.established < 1951)) return false;
      if (filters.crowd !== "all" && pandal.crowd !== filters.crowd) return false;
      if (filters.savedOnly && !saved.includes(pandal.slug)) return false;
      if (query) {
        const haystack = `${pandal.name} ${pandal.locality} ${pandal.metro} ${pandal.zone}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [data, filters, saved]);

  useEffect(() => {
    if (selected && !filteredPandals.some((pandal) => pandal.slug === selected.slug)) {
      setSelected(null);
    }
    if (selectedPoi && filters.transit !== "all" && selectedPoi.category !== filters.transit) {
      setSelectedPoi(null);
    }
  }, [filteredPandals, filters.transit, selected, selectedPoi]);

  const updateFilters = (patch: Partial<MapFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const selectChip = (chip: string) => {
    if (chip === "all") {
      setFilters({ ...DEFAULT_FILTERS, transit: filters.transit });
      return;
    }
    if (chip === "featured") {
      setFilters({ ...DEFAULT_FILTERS, transit: filters.transit, category: "featured" });
      return;
    }
    if (chip === "heritage") {
      setFilters({ ...DEFAULT_FILTERS, transit: filters.transit, heritage: true });
      return;
    }
    if (chip === "saved") {
      setFilters({ ...DEFAULT_FILTERS, transit: filters.transit, savedOnly: true });
      return;
    }
    setFilters({ ...DEFAULT_FILTERS, transit: filters.transit, zone: chip });
  };

  const activeChip = filters.savedOnly
    ? "saved"
    : filters.category === "featured"
      ? "featured"
      : filters.heritage
        ? "heritage"
        : filters.zone !== "all"
          ? filters.zone
          : "all";

  /* --------------------------------------------------------------- markers */
  useEffect(() => {
    const L = leafletRef.current;
    const layer = pandalLayerRef.current;
    if (!mapReady || !L || !layer || !data) return;
    layer.clearLayers();
    const query = deferredFilters.query.trim().toLowerCase();
    const matches = data.pandals.filter((pandal) => {
      if (deferredFilters.zone !== "all" && pandal.zone !== deferredFilters.zone) return false;
      if (deferredFilters.category === "featured" && !pandal.featured) return false;
      if (
        deferredFilters.category !== "all" &&
        deferredFilters.category !== "featured" &&
        !pandal.categories.includes(deferredFilters.category)
      ) {
        return false;
      }
      if (
        deferredFilters.heritage &&
        !(pandal.established && pandal.established < 1951)
      ) {
        return false;
      }
      if (deferredFilters.crowd !== "all" && pandal.crowd !== deferredFilters.crowd) return false;
      if (deferredFilters.savedOnly && !saved.includes(pandal.slug)) return false;
      if (query) {
        const haystack = `${pandal.name} ${pandal.locality} ${pandal.metro} ${pandal.zone}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    // Leaflet cannot declutter thousands of large custom pins. The original
    // server thins the viewport as well: roughly 131 pandal pins at the city
    // zoom, 434 once the visitor zooms into the pandal belt, and every pin at
    // neighbourhood zoom. Keep that progression instead of dropping 617 pins
    // into the same 1,000 px of map.
    const visible =
      zoom < 12.5
        ? matches.filter((pandal, index) => pandal.featured || index % 6 === 0)
        : zoom < 13.5
          ? matches.filter((pandal, index) => pandal.featured || index % 3 !== 0)
          : matches;
    for (const pandal of visible) {
      const size: [number, number] = pandal.featured ? [46, 53] : [38, 44];
      const icon = L.divIcon({
        className: `custom-pandal-marker${pandal.featured ? " custom-pandal-featured" : ""}`,
        html: `<div class="pandal-pin-pop" style="width:${size[0]}px;height:${size[1]}px;"><img src="${
          pandal.featured ? "/map/featured_pandals.png" : "/map/para_icon.png"
        }" alt="${escapeHtml(pandal.name)}" style="width:100%;height:100%;object-fit:contain;display:block;"/></div>`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1]],
      });
      const marker = L.marker([pandal.lat, pandal.lng], {
        icon,
        title: titleCase(pandal.name),
        riseOnHover: true,
        zIndexOffset: pandal.featured ? 1000 : 0,
      });
      marker.on("click", () => {
        setSelectedPoi(null);
        setSelected(pandal);
        setSearchFocused(false);
        mapRef.current?.flyTo([pandal.lat, pandal.lng], Math.max(mapRef.current.getZoom(), 15), {
          duration: 0.65,
        });
      });
      layer.addLayer(marker);
    }
  }, [mapReady, data, deferredFilters, saved, zoom]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = poiLayerRef.current;
    if (!mapReady || !L || !layer || !data) return;
    layer.clearLayers();
    const transitOnly = filters.transit !== "all";
    const pois = transitOnly
      ? data.pois.filter((poi) => poi.category === filters.transit)
      : zoom < 13
        ? data.pois.filter((poi) => MAJOR_POI_IDS.includes(poi.id))
        : data.pois.filter((poi) =>
            ["metro-station", "railway-station", "ferry-ghat"].includes(poi.category)
          );
    for (const poi of pois) {
      const icon = L.divIcon({
        className: "custom-poi-marker",
        html: `<div class="poi-pin-pop" style="width:32px;height:32px;"><img src="${poiIconPath(
          poi.category
        )}" alt="${escapeHtml(
          poi.category
        )}" style="width:100%;height:100%;object-fit:contain;display:block;"/></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([poi.lat, poi.lng], {
        icon,
        title: poi.name,
        riseOnHover: true,
      });
      marker.on("click", () => {
        setSelected(null);
        setSelectedPoi(poi);
        setSearchFocused(false);
        mapRef.current?.flyTo([poi.lat, poi.lng], Math.max(mapRef.current.getZoom(), 15), {
          duration: 0.65,
        });
      });
      layer.addLayer(marker);
    }
  }, [mapReady, data, filters.transit, zoom]);

  /* --------------------------------------------------------------- drawing */
  const clearRoute = useCallback(() => {
    routeLayerRef.current?.clearLayers();
  }, []);

  const fitRoute = useCallback((coords: [number, number][]) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map((coord) => [coord[0], coord[1]]));
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
  }, []);

  const drawSegments = useCallback(
    (segments: RouteSegment[], fallback = false) => {
      const L = leafletRef.current;
      const layer = routeLayerRef.current;
      if (!L || !layer) return;
      layer.clearLayers();
      for (const segment of segments) {
        if (!segment.coords || segment.coords.length < 2) continue;
        const isTransit = segment.mode !== "walk";
        const color = isTransit ? "#B45309" : "#D90429";
        const accent = isTransit ? "#FFFFFF" : "#FFB800";
        L.polyline(segment.coords, {
          color,
          weight: fallback ? 4 : 10,
          opacity: fallback ? 0.35 : 0.18,
          lineCap: "round",
          dashArray: fallback ? "8 8" : undefined,
        }).addTo(layer);
        L.polyline(segment.coords, {
          color,
          weight: fallback ? 3 : 5,
          opacity: 0.9,
          lineCap: "round",
          dashArray: fallback ? "8 8" : undefined,
        }).addTo(layer);
        if (!fallback) {
          L.polyline(segment.coords, {
            color: accent,
            weight: 2,
            opacity: 0.95,
            lineCap: "round",
            dashArray: "1 9",
          }).addTo(layer);
        }
      }
      const all = segments.flatMap((segment) => segment.coords);
      if (all.length > 1) {
        const start = all[0];
        const end = all[all.length - 1];
        L.circleMarker(start, {
          radius: 7,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#16A34A",
          fillOpacity: 1,
        }).addTo(layer);
        L.circleMarker(end, {
          radius: 7,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#D90429",
          fillOpacity: 1,
        }).addTo(layer);
      }
    },
    []
  );

  const drawCurated = useCallback(
    (geo: RouteGeoMap[string]) => {
      if (!geo) return;
      drawSegments(
        geo.segments?.length
          ? geo.segments
          : [{ mode: "walk", coords: geo.coords || [] }]
      );
      fitRoute(geo.coords || geo.segments?.flatMap((segment) => segment.coords) || []);
    },
    [drawSegments, fitRoute]
  );

  const drawPlanner = useCallback(
    (result: PlannerResult) => {
      drawSegments(result.segments, result.fallback);
      fitRoute(result.coords);
    },
    [drawSegments, fitRoute]
  );

  const clearPlanner = useCallback(() => {
    setPlannerStops([]);
    setPlannerResult(null);
    setPlannerLoading(false);
    setPlannerMode("walk");
    clearRoute();
  }, [clearRoute]);

  /* ---------------------------------------------------------------- curated */
  const loadGeo = useCallback(async (): Promise<RouteGeoMap> => {
    if (geoCacheRef.current) return geoCacheRef.current;
    const response = await fetch("/map/routes-geo.json");
    if (!response.ok) throw new Error("Trail geometry could not be loaded");
    const json = (await response.json()) as RouteGeoMap;
    geoCacheRef.current = json;
    return json;
  }, []);

  const plotCurated = useCallback(
    async (route: CuratedRoute) => {
      setActiveRoute(route);
      setTab("trails");
      setSelected(null);
      setSelectedPoi(null);
      setSearchFocused(false);
      setMobilePanelOpen(false);
      setRouteSheetOpen(false);
      setGeoLoading(true);
      setActiveGeo(null);
      clearRoute();
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", `/map?route=${encodeURIComponent(route.id)}`);
      }
      try {
        const all = await loadGeo();
        const geo = all[route.id];
        if (!geo) throw new Error("Trail geometry is unavailable");
        setActiveGeo(geo);
        drawCurated(geo);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Trail geometry is unavailable");
      } finally {
        setGeoLoading(false);
      }
    },
    [clearRoute, drawCurated, loadGeo, showToast]
  );

  const editCurated = useCallback(() => {
    setActiveRoute(null);
    setActiveGeo(null);
    clearRoute();
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/map");
  }, [clearRoute]);

  const clearCurated = useCallback(() => {
    setActiveRoute(null);
    setActiveGeo(null);
    setGeoLoading(false);
    clearRoute();
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/map");
    showToast("Trail cleared from the map.");
  }, [clearRoute, showToast]);

  const toggleTrailSave = useCallback(
    async (route: CuratedRoute) => {
      const result = await toggleSaved("trail", route.id);
      if (!result.ok) return;
      showToast(result.saved ? "Trail saved to your profile." : "Trail removed from saved.");
    },
    [showToast, toggleSaved]
  );

  const shareCurated = useCallback(
    async (route: CuratedRoute) => {
      const url = `${window.location.origin}/map?route=${encodeURIComponent(route.id)}`;
      const ok = await copyToClipboard(url);
      showToast(ok ? "Trail link copied." : "Copy failed — select the address bar to share.");
    },
    [showToast]
  );

  /* ---------------------------------------------------------------- planner */
  const addStopAt = useCallback(
    (stop: PlannerStop, position: "start" | "end" | "stop") => {
      setPlannerStops((previous) => {
        const next = [...previous];
        if (position === "start") {
          if (next.length === 0) next.push(stop);
          else next[0] = stop;
        } else if (position === "end") {
          if (next.length === 0) next.push(stop);
          else if (next.length === 1) next.push(stop);
          else next[next.length - 1] = stop;
        } else if (next.length < 2) {
          next.push(stop);
        } else {
          next.splice(next.length - 1, 0, stop);
        }
        return next;
      });
      setPlannerResult(null);
      clearRoute();
      setTab("planner");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setRouteSheetOpen(true);
        setMobilePanelOpen(false);
      }
      setSelected(null);
      setSelectedPoi(null);
      showToast(`Added ${titleCase(stop.name)} to the route planner.`);
    },
    [clearRoute, showToast]
  );

  const generatePlannerRoute = useCallback(
    async (overrideStops?: PlannerStop[], overrideMode?: TravelMode) => {
      const useStops = overrideStops || plannerStops;
      const useMode = overrideMode || plannerMode;
      if (useStops.length < 2) return;
      const key = `${useMode}:${useStops
        .map((stop) => `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`)
        .join("|")}`;
      const cached = plannerCacheRef.current.get(key);
      if (cached) {
        setPlannerResult(cached);
        drawPlanner(cached);
        setPlannerLoading(false);
        return;
      }
      setPlannerLoading(true);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch("https://valhalla1.openstreetmap.de/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            locations: useStops.map((stop) => ({ lat: stop.lat, lon: stop.lng })),
            costing: MODE_META[useMode].valhalla,
            units: "kilometers",
            directions_options: { units: "kilometers" },
          }),
        });
        if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
        const json = await response.json();
        const trip = json?.trip;
        const legs = trip?.legs;
        if (!trip || !Array.isArray(legs) || !legs.length) {
          throw new Error("No route found between these stops");
        }
        const coords: [number, number][] = [];
        for (const leg of legs) {
          const legCoords = decodePolyline(leg.shape || "", 6);
          if (coords.length && legCoords.length) {
            const last = coords[coords.length - 1];
            const first = legCoords[0];
            if (haversineM({ lat: last[0], lng: last[1] }, { lat: first[0], lng: first[1] }) < 2) {
              legCoords.shift();
            }
          }
          coords.push(...legCoords);
        }
        if (coords.length < 2) throw new Error("No usable route geometry was returned");
        const distanceM = Math.max(1, Math.round((trip.summary?.length || 0) * 1000));
        const steps = legs
          .flatMap((leg: any) =>
            (leg.maneuvers || []).map((maneuver: any) => ({
              instruction: maneuver.instruction || "Continue",
              distanceM: Math.round((maneuver.length || 0) * 1000),
              durationS: Math.round(maneuver.time || 0),
            }))
          )
          // Valhalla emits every sub-50m lane change, which made a 3.4 km
          // walk read as 19 "turn steps". The original's step count keeps the
          // departure and the meaningful turns and drops the arrival and the
          // micro-manoeuvres.
          .filter(
            (step: { instruction: string; distanceM: number }, index: number) =>
              !/arrived/i.test(step.instruction) && (index === 0 || step.distanceM >= 45)
          );
        const modeSeconds = routeModeSeconds(distanceM);
        const nearby = pandalsAlongRoute(data?.pandals || [], coords).filter(
          ({ pandal }) => !useStops.some((stop) => stop.id === pandal.slug)
        );
        const result: PlannerResult = {
          stops: useStops,
          mode: useMode,
          distanceM,
          segments: [{ mode: useMode === "transit" ? "transit" : useMode, coords }],
          coords,
          modeSeconds,
          turnSteps: steps.length,
          steps,
          googleUrl: googleMapsUrl(useStops, useMode),
          nearby,
          fallback: false,
          activeModeSeconds: modeSeconds[useMode],
        };
        plannerCacheRef.current.set(key, result);
        setPlannerResult(result);
        drawPlanner(result);
      } catch {
        const straight = straightLineStopMeters(useStops) * 1.18;
        const segments: RouteSegment[] = [];
        const coords: [number, number][] = [];
        for (let i = 1; i < useStops.length; i += 1) {
          const pair: [number, number][] = [
            [useStops[i - 1].lat, useStops[i - 1].lng],
            [useStops[i].lat, useStops[i].lng],
          ];
          segments.push({ mode: useMode === "transit" ? "transit" : useMode, coords: pair });
          coords.push(...pair);
        }
        const modeSeconds = routeModeSeconds(straight);
        const result: PlannerResult = {
          stops: useStops,
          mode: useMode,
          distanceM: Math.round(straight),
          segments,
          coords,
          modeSeconds,
          turnSteps: Math.max(1, useStops.length - 1),
          steps: [],
          googleUrl: googleMapsUrl(useStops, useMode),
          nearby: pandalsAlongRoute(data?.pandals || [], coords).filter(
            ({ pandal }) => !useStops.some((stop) => stop.id === pandal.slug)
          ),
          fallback: true,
          activeModeSeconds: modeSeconds[useMode],
        };
        setPlannerResult(result);
        drawPlanner(result);
        showToast("Live routing is unavailable — showing a direct-line estimate.");
      } finally {
        clearTimeout(timeoutId);
        setPlannerLoading(false);
      }
    },
    [data, drawPlanner, plannerMode, plannerStops, showToast]
  );

  const handleModeChange = useCallback(
    (next: TravelMode) => {
      setPlannerMode(next);
      if (plannerResult && plannerStops.length >= 2) {
        void generatePlannerRoute(plannerStops, next);
      }
    },
    [generatePlannerRoute, plannerResult, plannerStops]
  );

  const plannerSignature = useCallback((result: PlannerResult | null) => {
    if (!result) return "";
    return [result.mode, ...result.stops.map((stop) => `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`)].join("|");
  }, []);

  const savePlannerResult = useCallback(async () => {
    if (!plannerResult) return;
    const signature = plannerSignature(plannerResult);
    const result = await toggleSaved("route", signature);
    if (!result.ok) return;
    showToast(result.saved ? "Route saved to your profile." : "Route removed from saved.");
  }, [plannerResult, plannerSignature, toggleSaved, showToast]);

  /**
   * The AI plan becomes an ordinary route: the stops are handed to the same
   * planner that a hand-built route uses, so the geometry, distance, turn
   * steps and "pandals on the way" all come from the real routing engine.
   */
  const applyAiPlan = useCallback(
    async (plan: AiPlan) => {
      setAiPlan(plan);
      const stops: PlannerStop[] = [];
      for (const stop of plan.stops) {
        if (stop.lat == null || stop.lng == null) continue;
        const pandal = data?.pandals.find((p) => p.slug === stop.id);
        const poi = data?.pois.find((p) => p.id === stop.id);
        stops.push(
          pandal
            ? stopFromPandal(pandal)
            : {
                id: stop.id,
                name: stop.name,
                locality: stop.locality || poi?.address || "",
                zone: stop.zone,
                lat: stop.lat,
                lng: stop.lng,
                metro: poi?.address || "",
                kind: "poi" as const,
              }
        );
      }
      if (stops.length < 2) {
        showToast("The planner needs at least two stops to draw a route.");
        return;
      }
      setPlannerStops(stops);
      setPlannerMode(plan.mode as TravelMode);
      // On a phone the chat stays open so the answer is readable, and
      // "View on map" hands the itinerary to the route sheet. On a desktop
      // the sidebar switches to the planner, which shows the same route in
      // full; the conversation is kept and comes back with the AI tab.
      if (typeof window === "undefined" || window.innerWidth >= 1024) {
        setTab("planner");
      }
      // Draw the plan's own line first so the map answers immediately, then
      // let the router replace it with the real road geometry.
      const straight = straightLineStopMeters(stops) * 1.18;
      const coords: [number, number][] = stops.map((stop) => [stop.lat, stop.lng]);
      const segments: RouteSegment[] = stops.slice(1).map((stop, index) => ({
        mode: plan.mode as TravelMode,
        coords: [
          [stops[index].lat, stops[index].lng],
          [stop.lat, stop.lng],
        ],
      }));
      drawSegments(segments, true);
      fitRoute(coords);
      await generatePlannerRoute(stops, plan.mode as TravelMode);
    },
    [data, drawSegments, fitRoute, generatePlannerRoute, showToast]
  );

  const aiChat = useAiChat(
    useCallback(
      (plan: AiPlan) => {
        void applyAiPlan(plan);
      },
      [applyAiPlan]
    )
  );

  const openAiGoogleMaps = useCallback(() => {
    if (!plannerStops.length) return;
    const url = googleMapsUrl(plannerStops, plannerMode);
    if (url) window.open(url, "_blank", "noopener");
  }, [plannerMode, plannerStops]);

  const openAiAppleMaps = useCallback(() => {
    if (!plannerStops.length) return;
    const url = appleMapsUrl(plannerStops, plannerMode);
    if (url) window.open(url, "_blank", "noopener");
  }, [plannerMode, plannerStops]);

  const shareAiPlan = useCallback(async () => {
    if (!plannerStops.length) {
      showToast("Ask the planner for a route first.");
      return;
    }
    const params = new URLSearchParams();
    params.set("mode", plannerMode);
    params.set("start", stopToken(plannerStops[0]));
    params.set("end", stopToken(plannerStops[plannerStops.length - 1]));
    const middle = plannerStops.slice(1, -1).map(stopToken);
    if (middle.length) params.set("stops", middle.join("|"));
    if (aiPlan?.meetingPoint) params.set("meet", aiPlan.meetingPoint.id);
    const ok = await copyToClipboard(`${window.location.origin}/map?${params.toString()}`);
    showToast(ok ? "Trip link copied." : "Copy failed - select the address bar to share.");
  }, [aiPlan, plannerMode, plannerStops, showToast]);

  const clearAiPlan = useCallback(() => {
    setAiPlan(null);
    clearPlanner();
  }, [clearPlanner]);

  const sharePlannerResult = useCallback(async () => {
    if (!plannerResult || plannerResult.stops.length < 2) return;
    const params = new URLSearchParams();
    params.set("mode", plannerResult.mode);
    params.set("start", stopToken(plannerResult.stops[0]));
    params.set("end", stopToken(plannerResult.stops[plannerResult.stops.length - 1]));
    const middle = plannerResult.stops.slice(1, -1).map(stopToken);
    if (middle.length) params.set("stops", middle.join("|"));
    const ok = await copyToClipboard(`${window.location.origin}/map?${params.toString()}`);
    showToast(ok ? "Route link copied." : "Copy failed — select the address bar to share.");
  }, [plannerResult, showToast]);

  const addNearbyStops = useCallback(
    (items: Pandal[]) => {
      if (!items.length) return;
      setPlannerStops((previous) => {
        const next = [...previous];
        for (const pandal of items) {
          const stop = stopFromPandal(pandal);
          if (next.some((existing) => existing.id === stop.id)) continue;
          if (next.length < 2) next.push(stop);
          else next.splice(next.length - 1, 0, stop);
        }
        return next;
      });
      setPlannerResult(null);
      clearRoute();
      showToast(
        `Added ${items.length} ${items.length === 1 ? "pandal" : "pandals"} to the stops. Generate the route again.`
      );
    },
    [clearRoute, showToast]
  );

  const savePandal = useCallback(
    async (pandal: Pandal) => {
      const result = await toggleSaved("pandal", pandal.slug);
      if (!result.ok) return;
      showToast(result.saved ? "Pandal saved to your profile." : "Pandal removed from saved.");
    },
    [showToast, toggleSaved]
  );

  const focusPandal = useCallback((pandal: Pandal) => {
    setSelected(pandal);
    setSelectedPoi(null);
    setSearchFocused(false);
    mapRef.current?.flyTo([pandal.lat, pandal.lng], Math.max(mapRef.current.getZoom(), 15), {
      duration: 0.7,
    });
  }, []);

  const focusPoi = useCallback((poi: Poi) => {
    setSelectedPoi(poi);
    setSelected(null);
    setSearchFocused(false);
    mapRef.current?.flyTo([poi.lat, poi.lng], Math.max(mapRef.current.getZoom(), 15), {
      duration: 0.7,
    });
  }, []);

  const showUserDot = useCallback((lat: number, lng: number) => {
    const L = leafletRef.current;
    const layer = userLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    L.circleMarker([lat, lng], {
      radius: 7,
      color: "#FFFFFF",
      weight: 3,
      fillColor: "#B45309",
      fillOpacity: 1,
    }).addTo(layer);
    L.circleMarker([lat, lng], {
      radius: 20,
      color: "#B45309",
      weight: 1,
      opacity: 0.35,
      fillColor: "#B45309",
      fillOpacity: 0.1,
    }).addTo(layer);
  }, []);

  const currentPosition = useCallback((): Promise<GeolocationPosition | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
      );
    });
  }, []);

  const recenter = useCallback(async () => {
    const position = await currentPosition();
    if (!position) {
      showToast("Location is unavailable — allow location access in your browser.");
      return;
    }
    const { latitude, longitude } = position.coords;
    showUserDot(latitude, longitude);
    mapRef.current?.flyTo([latitude, longitude], 14, { duration: 0.8 });
  }, [currentPosition, showToast, showUserDot]);

  const locateNearby = useCallback(async () => {
    setNearbyOpen(true);
    setNearbyStatus("loading");
    const position = await currentPosition();
    if (!position) {
      setNearbyStatus("denied");
      setNearbyPandals([]);
      return;
    }
    const { latitude, longitude } = position.coords;
    showUserDot(latitude, longitude);
    mapRef.current?.flyTo([latitude, longitude], 14, { duration: 0.6 });
    const found = (data?.pandals || [])
      .map((pandal) => ({
        pandal,
        distanceM: haversineM(
          { lat: latitude, lng: longitude },
          { lat: pandal.lat, lng: pandal.lng }
        ),
      }))
      .filter((item) => item.distanceM <= 500)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 20);
    setNearbyPandals(found);
    setNearbyStatus("ready");
  }, [currentPosition, data, showUserDot]);

  /* ------------------------------------------------------------- deep links */
  useEffect(() => {
    if (!mapReady || !data || bootedRef.current) return;
    bootedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get("route");
    if (routeParam) {
      const route = data.routes.find(
        (item) => item.id === routeParam || String(item.number) === routeParam
      );
      if (route) {
        void plotCurated(route);
        return;
      }
    }
    const startTokenParam = params.get("start");
    const endTokenParam = params.get("end");
    if (!startTokenParam || !endTokenParam) return;
    const decode = (token: string): PlannerStop | null => {
      if (token.startsWith("p:")) {
        const pandal = data.pandals.find((item) => item.slug === token.slice(2));
        return pandal ? stopFromPandal(pandal) : null;
      }
      if (token.startsWith("o:")) {
        const poi = data.pois.find((item) => item.id === token.slice(2));
        if (!poi) return null;
        return {
          id: poi.id,
          name: poi.name,
          locality: poi.address,
          lat: poi.lat,
          lng: poi.lng,
          kind: "poi",
        };
      }
      if (token.startsWith("c:")) {
        const [lat, lng] = token.slice(2).split(",").map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: `shared-${lat}-${lng}`,
          name: "Shared location",
          locality: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng,
          kind: "gps",
        };
      }
      return null;
    };
    const start = decode(startTokenParam);
    const end = decode(endTokenParam);
    if (!start || !end) return;
    const middle = (params.get("stops") || "")
      .split("|")
      .map((token) => decode(token))
      .filter((stop): stop is PlannerStop => !!stop);
    const stops = [start, ...middle, end];
    const mode = (params.get("mode") || "walk") as TravelMode;
    setPlannerStops(stops);
    setPlannerMode(["walk", "drive", "cycle", "transit"].includes(mode) ? mode : "walk");
    setTab("planner");
    if (window.innerWidth < 1024) setRouteSheetOpen(true);
    void generatePlannerRoute(stops, mode);
  }, [data, generatePlannerRoute, mapReady, plotCurated]);

  /* --------------------------------------------------------------- searches */
  const searchResults = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    if (query.length < 2 || !data) return { pandals: [] as Pandal[], pois: [] as Poi[] };
    return {
      pandals: filteredPandals.slice(0, 5),
      pois: data.pois
        .filter((poi) => `${poi.name} ${poi.address}`.toLowerCase().includes(query))
        .slice(0, 3),
    };
  }, [data, filteredPandals, filters.query]);

  const activeSearchRoute = activeRoute;
  const savedTrail = activeSearchRoute ? saves.trails.includes(activeSearchRoute.id) : false;
  const plannerSaved = plannerResult
    ? saves.routes.includes(plannerSignature(plannerResult))
    : false;

  const chips = useMemo(() => {
    const list = [
      { id: "all", label: `All ${data?.pandals.length || 0}` },
      { id: "featured", label: `Featured (${featuredCount})` },
      { id: "heritage", label: "Heritage (>75 Yrs)" },
      { id: "saved", label: `Saved (${saved.length})` },
      { id: "north", label: "North Kolkata" },
      { id: "south", label: "South Kolkata" },
      { id: "central", label: "Central Kolkata" },
      { id: "east", label: "East Kolkata" },
      { id: "howrah", label: "Howrah" },
      { id: "others", label: "Others" },
    ];
    return list;
  }, [data, featuredCount, saved.length]);

  const filterPanel = (
    <FilterPanel
      filters={filters}
      onChange={updateFilters}
      onReset={resetFilters}
      filteredCount={filteredPandals.length}
      totalCount={data?.pandals.length || 0}
      zoneCounts={zoneCounts}
      categoryCounts={categoryCounts}
      heritageCount={heritageCount}
      crowdCounts={crowdCounts}
      savedCount={saved.length}
      transitCount={transitCount}
    />
  );

  const trailsPanel = data ? (
    <TrailsPanel
      routes={data.routes}
      copy={data.copy}
      activeRoute={activeRoute}
      activeGeo={activeGeo}
      geoLoading={geoLoading}
      onPlot={plotCurated}
      onEdit={editCurated}
      onClear={clearCurated}
      onShare={shareCurated}
      onSave={toggleTrailSave}
      saved={savedTrail}
    />
  ) : null;

  const aiPanel = (
    <AiPlannerPanel
      messages={aiChat.messages}
      input={aiChat.input}
      setInput={aiChat.setInput}
      busy={aiChat.busy}
      error={aiChat.error}
      onSend={(text) => void aiChat.send(text)}
      onClear={() => {
        aiChat.clear();
        clearAiPlan();
      }}
      plan={aiPlan}
      onShare={() => void shareAiPlan()}
      onOpenGoogle={openAiGoogleMaps}
      onOpenApple={openAiAppleMaps}
      onSave={() => void savePlannerResult()}
      onViewMap={() => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setMobilePanelOpen(false);
          setRouteSheetOpen(true);
        }
      }}
      saved={plannerSaved}
    />
  );

  const plannerPanel = (
    <PlannerPanel
      stops={plannerStops}
      onStopsChange={(stops) => {
        setPlannerStops(stops);
        setPlannerResult(null);
        clearRoute();
      }}
      mode={plannerMode}
      onModeChange={handleModeChange}
      result={plannerResult}
      loading={plannerLoading}
      onGenerate={() => void generatePlannerRoute()}
      onEdit={() => setPlannerResult(null)}
      onClear={clearPlanner}
      onRecalculate={() => void generatePlannerRoute()}
      onShare={() => void sharePlannerResult()}
      onSave={savePlannerResult}
      onAddNearby={(pandal) => addNearbyStops([pandal])}
      onAddAllNearby={() => addNearbyStops(plannerResult?.nearby.map((item) => item.pandal) || [])}
      onFlyTo={(stop) => {
        mapRef.current?.flyTo([stop.lat, stop.lng], 15, { duration: 0.7 });
        if (window.innerWidth < 1024) setRouteSheetOpen(false);
      }}
      saved={plannerSaved}
      pandals={data?.pandals || []}
      pois={data?.pois || []}
      onToast={showToast}
    />
  );

  return (
    <div
      data-map-app
      className="fixed inset-0 z-30 m-0 overflow-hidden bg-transparent p-0 lg:bottom-4 lg:left-4 lg:right-4 lg:top-[104px]"
    >
      <div className="flex h-full w-full lg:gap-4">
        {/* ---------------------------------------------------------- sidebar */}
        <aside className="hidden h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-3xl border border-[#E5C880] bg-[#FFFBF0] p-3 text-[#2C1210] shadow-sm lg:flex">
          <div className="mb-2 grid shrink-0 grid-cols-4 gap-1 rounded-xl border border-[#E5C880] bg-[#FFF3D6] p-1">
            {(
              [
                ["filters", "Filter & POIs"],
                ["trails", "Curated Trails"],
                ["planner", "Route Planner"],
                ["ai", "AI Planner"],
              ] as [MapTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative cursor-pointer rounded-lg py-1.5 font-mono text-[10px] font-bold transition-all ${
                  tab === id
                    ? "bg-[#FFFBF0] text-[#D90429] shadow-sm"
                    : "text-[#2C1210]/55 hover:text-[#2C1210]"
                }`}
              >
                {label}
                {id === "planner" && plannerStops.length > 0 && (
                  <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D90429] px-1 font-mono text-[8px] font-bold text-white">
                    {plannerStops.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div
            data-sidebar-content
            className="min-h-0 flex-1 overflow-y-auto pr-0.5"
          >
            {!data && !dataError && (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-[#B45309]">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <p className="font-mono text-[9px] font-bold uppercase">Loading map data...</p>
              </div>
            )}
            {dataError && (
              <div className="rounded-xl border border-[#D90429]/30 bg-white p-3 text-center">
                <p className="font-serif text-[12px] font-bold text-[#D90429]">{dataError}</p>
                <p className="mt-1 font-sans text-[9px] text-[#2C1210]/50">
                  Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="mt-2 cursor-pointer rounded-full bg-[#D90429] px-3 py-1 font-serif text-[10px] font-bold text-white"
                >
                  Retry
                </button>
              </div>
            )}
            {data && tab === "filters" && filterPanel}
            {data && tab === "trails" && trailsPanel}
            {data && tab === "planner" && plannerPanel}
            {data && tab === "ai" && aiPanel}

          </div>
          <InstallBanner />
        </aside>

        {/* -------------------------------------------------------------- map */}
        <div className="relative min-w-0 flex-1 overflow-hidden border-0 border-[#E5C880] bg-[#E8E2D4] lg:rounded-3xl lg:border">
          <div ref={mapNodeRef} data-map-canvas className="absolute inset-0 z-0" />

          {mapError && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#FFFBF0]/90 p-4">
              <div className="max-w-sm rounded-2xl border border-[#D90429]/30 bg-white p-4 text-center">
                <p className="font-serif text-sm font-bold text-[#D90429]">{mapError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 cursor-pointer rounded-full bg-[#D90429] px-3 py-1.5 font-serif text-[11px] font-bold text-white"
                >
                  Reload
                </button>
              </div>
            </div>
          )}

          {/* search bar */}
          <div className="absolute left-2.5 right-[62px] top-2.5 z-30 lg:right-auto lg:w-[300px]">
            <div className="flex items-center gap-1 rounded-2xl border-2 border-[#E5C880] bg-[#FFFBF0] p-1 shadow-md">
              <button
                type="button"
                aria-label="Open map filters"
                onClick={() => {
                  setTab("filters");
                  setMobilePanelOpen(true);
                }}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#FFF3D6] text-[#D90429] lg:hidden"
              >
                <Icon name="filter" size={14} />
              </button>
              <Icon name="search" size={13} className="hidden shrink-0 text-[#2C1210]/40 lg:block" />
              <input
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 140)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  if (searchResults.pandals[0]) focusPandal(searchResults.pandals[0]);
                  else if (searchResults.pois[0]) focusPoi(searchResults.pois[0]);
                }}
                placeholder="Search pandals, stations..."
                aria-label="Search pandals, stations and localities"
                className="min-w-0 flex-1 bg-transparent px-1 font-sans text-[11px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35"
              />
              <button
                type="button"
                aria-label="Recenter map on my location"
                onClick={() => void recenter()}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#B45309] text-white shadow-sm transition-transform active:scale-95"
              >
                <Icon name="locate" size={14} />
              </button>
            </div>

            {searchFocused && filters.query.trim().length >= 2 && (
              <div className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#E5C880] bg-[#FFFBF0] p-1 shadow-xl">
                {searchResults.pandals.length === 0 && searchResults.pois.length === 0 ? (
                  <p className="px-2 py-2 font-sans text-[10px] text-[#2C1210]/50">
                    No pandals or stations match “{filters.query}”.
                  </p>
                ) : (
                  <>
                    {searchResults.pandals.map((pandal) => (
                      <button
                        key={pandal.slug}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => focusPandal(pandal)}
                        className="flex w-full cursor-pointer items-start gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-[#FFF3D6]"
                      >
                        <Icon name="mapPin" size={12} className="mt-0.5 shrink-0 text-[#D90429]" />
                        <span className="min-w-0">
                          <span className="block truncate font-sans text-[10px] font-bold text-[#2C1210]">
                            {titleCase(pandal.name)}
                          </span>
                          <span className="block truncate font-sans text-[8px] text-[#2C1210]/45">
                            {pandal.locality} · {zoneLabel(pandal.zone)}
                          </span>
                        </span>
                      </button>
                    ))}
                    {searchResults.pois.map((poi) => (
                      <button
                        key={poi.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => focusPoi(poi)}
                        className="flex w-full cursor-pointer items-start gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-[#FFF3D6]"
                      >
                        <Icon name="transit" size={12} className="mt-0.5 shrink-0 text-[#B45309]" />
                        <span className="min-w-0">
                          <span className="block truncate font-sans text-[10px] font-bold text-[#2C1210]">
                            {titleCase(poi.name)}
                          </span>
                          <span className="block truncate font-sans text-[8px] text-[#2C1210]/45">
                            {poi.category.replace(/-/g, " ")}
                          </span>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* mobile title toggle */}
          <button
            type="button"
            aria-label="Toggle Kolkata Durga Puja 2026 title"
            title="Tap to toggle Kolkata Durga Puja 2026 title"
            onClick={() => setTitleOpen((value) => !value)}
            className="absolute right-2.5 top-2.5 z-30 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#D90429] bg-[#FFFBF0] shadow-md transition-all active:scale-95 lg:hidden"
          >
            <img src="/map/featured_pandals.png" alt="" className="h-8 w-7 object-contain" />
          </button>

          {titleOpen && (
            <div className="absolute left-1/2 top-[108px] z-20 -translate-x-1/2 rounded-full border border-[#E5C880] bg-[#2C1210]/95 px-3 py-1 font-serif text-[10px] font-bold text-[#FFFBF0] shadow-lg lg:hidden">
              Kolkata Durga Puja 2026
            </div>
          )}

          {/* chips */}
          <div className="no-scrollbar absolute left-2.5 right-2.5 top-[68px] z-20 flex gap-1 overflow-x-auto pb-0.5 lg:left-[315px] lg:right-[72px] lg:top-3">
            {chips.map((chip) => {
              const active = activeChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => selectChip(chip.id)}
                  className={`shrink-0 cursor-pointer rounded-full border px-2 py-1 font-mono text-[8.5px] font-bold transition-all ${
                    active
                      ? "border-[#D90429] bg-[#FFFBF0] text-[#D90429] shadow-sm"
                      : "border-[#E5C880] bg-[#FFFBF0]/90 text-[#2C1210] hover:border-[#D90429]"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* desktop filter button */}
          <button
            type="button"
            aria-label="Open map filters"
            title="Filters & POIs"
            onClick={() => {
              setTab("filters");
              document
                .querySelector("[data-sidebar-content]")
                ?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="absolute right-2.5 top-2.5 z-20 hidden h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-[#D90429] text-white shadow-md transition-transform active:scale-95 lg:flex"
          >
            <Icon name="filter" size={18} />
          </button>

          {/* style toggle */}
          <div className="absolute right-2.5 top-[122px] z-20 flex flex-col gap-1 rounded-full border border-[#E5C880] bg-[#FFFBF0] p-1 shadow-md lg:top-[62px]">
            <button
              type="button"
              aria-label="Standard map"
              title="Standard map"
              onClick={() => setStyle("standard")}
              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors ${
                style === "standard" ? "bg-[#D90429] text-white" : "text-[#2C1210]/60"
              }`}
            >
              <Icon name="compass" size={14} />
            </button>
            <button
              type="button"
              aria-label="Satellite view"
              title="Satellite view"
              onClick={() => setStyle("satellite")}
              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors ${
                style === "satellite" ? "bg-[#D90429] text-white" : "text-[#2C1210]/60"
              }`}
            >
              <Icon name="layers" size={14} />
            </button>
          </div>

          {/* mobile action buttons */}
          <button
            type="button"
            onClick={() => void locateNearby()}
            className="absolute bottom-[132px] left-2.5 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-[#B50321] bg-[#D90429] px-3 py-2 font-serif text-[10px] font-bold text-white shadow-lg active:scale-95 lg:hidden"
          >
            <Icon name="users" size={13} /> Nearby Pandals
          </button>
          <button
            type="button"
            onClick={() => setSuggestOpen(true)}
            className="absolute bottom-[84px] left-2.5 z-20 flex cursor-pointer items-center gap-1 rounded-full border border-[#B50321] bg-[#D90429] px-3 py-2 font-serif text-[10px] font-bold text-white shadow-lg active:scale-95 lg:hidden"
          >
            <Icon name="plus" size={12} /> Add Pandal
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("planner");
              setRouteSheetOpen(true);
            }}
            className="absolute bottom-[84px] right-2.5 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-[#E5C880] bg-[#FFFBF0] px-3 py-2 font-serif text-[10px] font-bold text-[#2C1210] shadow-lg active:scale-95 lg:hidden"
          >
            <Icon name="route" size={13} /> Route
          </button>
          <button
            type="button"
            aria-label="Open the AI trip planner"
            onClick={() => {
              setTab("ai");
              setMobilePanelOpen(true);
            }}
            className="absolute bottom-[180px] right-2.5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E5C880] bg-[#FFFBF0] text-[#D90429] shadow-lg active:scale-95 lg:hidden"
          >
            <Icon name="sparkle" size={16} />
          </button>
          <button
            type="button"
            aria-label="Recenter map on my location"
            onClick={() => void recenter()}
            className="absolute bottom-[132px] right-2.5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E5C880] bg-[#FFFBF0] text-[#2C1210] shadow-lg active:scale-95 lg:hidden"
          >
            <Icon name="locate" size={16} />
          </button>

          {/* desktop recenter and suggest */}
          <button
            type="button"
            aria-label="Recenter map on my location"
            title="Recenter on my location"
            onClick={() => void recenter()}
            className="absolute bottom-16 right-3 z-20 hidden h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E5C880] bg-[#FFFBF0] text-[#2C1210] shadow-lg transition-transform active:scale-95 lg:flex"
          >
            <Icon name="locate" size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSuggestOpen(true)}
            className="absolute bottom-3 right-3 z-20 hidden cursor-pointer items-center gap-1.5 rounded-full border border-[#B50321] bg-[#D90429] px-3 py-2 font-serif text-[10px] font-bold text-white shadow-lg transition-transform active:scale-95 lg:flex"
          >
            <Icon name="plus" size={12} /> Suggest Missing Pandal
          </button>

          <InstallBanner variant="floating" />

          {selected && (
            <PandalCard
              pandal={selected}
              saved={saved.includes(selected.slug)}
              onClose={() => setSelected(null)}
              onSave={() => savePandal(selected)}
              onStart={() => addStopAt(stopFromPandal(selected), "start")}
              onEnd={() => addStopAt(stopFromPandal(selected), "end")}
              onStop={() => addStopAt(stopFromPandal(selected), "stop")}
            />
          )}
          {selectedPoi && (
            <PoiCard
              poi={selectedPoi}
              onClose={() => setSelectedPoi(null)}
              onStart={() =>
                addStopAt(
                  {
                    id: selectedPoi.id,
                    name: selectedPoi.name,
                    locality: selectedPoi.address,
                    lat: selectedPoi.lat,
                    lng: selectedPoi.lng,
                    kind: "poi",
                  },
                  "start"
                )
              }
              onEnd={() =>
                addStopAt(
                  {
                    id: selectedPoi.id,
                    name: selectedPoi.name,
                    locality: selectedPoi.address,
                    lat: selectedPoi.lat,
                    lng: selectedPoi.lng,
                    kind: "poi",
                  },
                  "end"
                )
              }
              onStop={() =>
                addStopAt(
                  {
                    id: selectedPoi.id,
                    name: selectedPoi.name,
                    locality: selectedPoi.address,
                    lat: selectedPoi.lat,
                    lng: selectedPoi.lng,
                    kind: "poi",
                  },
                  "stop"
                )
              }
            />
          )}
        </div>
      </div>

      <MobilePanel
        open={mobilePanelOpen}
        tab={tab}
        onTab={setTab}
        onClose={() => setMobilePanelOpen(false)}
        filters={filterPanel}
        trails={trailsPanel}
        planner={plannerPanel}
        ai={aiPanel}
      />
      <RouteSheet open={routeSheetOpen} onClose={() => setRouteSheetOpen(false)}>
        {plannerPanel}
      </RouteSheet>
      <NearbySheet
        open={nearbyOpen}
        onClose={() => setNearbyOpen(false)}
        status={nearbyStatus}
        pandals={nearbyPandals}
        onLocate={() => void locateNearby()}
        onSelect={(pandal) => {
          setNearbyOpen(false);
          focusPandal(pandal);
        }}
        onExplore={() => {
          setNearbyOpen(false);
          setTab("filters");
          setMobilePanelOpen(true);
        }}
      />
      <SuggestModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        onToast={showToast}
      />
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
