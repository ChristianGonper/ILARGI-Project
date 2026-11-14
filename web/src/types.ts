export interface HistoricalSite {
  id: string;
  name: string;
  mission: string;
  latitude_deg: number;
  longitude_east_deg: number;
  region: string;
  in_lola_sample: boolean;
}

export interface PointDraft {
  uid: number;
  presetId: string;
  siteName: string;
  latitudeDeg: number;
  longitudeEastDeg: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
}

export interface AnalysisParams {
  durationHours: number;
  stepMinutes: number;
  instrumentHeightM: number;
  azimuthStepDeg: number;
  demMode: "auto" | "polar" | "global" | "sample20" | "sample80" | "ideal";
}

export interface SkySample {
  utc: string;
  azimuth_deg: number;
  elevation_deg: number;
  horizon_deg: number;
  margin_deg: number;
  visible: boolean;
  range_km: number;
  angular_radius_deg: number;
  above_horizon_fraction: number | null;
  eclipsed_fraction: number | null;
  direct_visible_fraction: number | null;
}

export interface VisibilityEvent {
  body: string;
  event_type: string;
  utc: string;
  azimuth_deg: number;
  horizon_deg: number;
}

export interface ShadowSpan {
  body: string;
  start_utc: string;
  end_utc: string;
  duration_hours: number;
  bounded_start: boolean;
  bounded_end: boolean;
}

export interface ElementData {
  value: number | null;
  unit: string;
  category: string;
}

export interface SiteAnalysisResult {
  label: string;
  site_name: string;
  latitude_deg: number;
  longitude_east_deg: number;
  start_utc: string;
  duration_hours: number;
  step_minutes: number;
  instrument_height_m: number;
  horizon_mode: "lola" | "ideal";
  horizon_label: string;
  search_radius_km: number;
  ground_elevation_m: number | null;
  pixel_m: number;
  horizon_profile: {
    azimuth_deg: number[];
    elevation_deg: (number | null)[];
    coverage_km: number[];
    truncated: boolean[];
  };
  series: {
    sun: SkySample[];
    earth: SkySample[];
  };
  visibility: {
    sun_pct: number;
    earth_pct: number;
    both_pct: number;
    sun_hours: number;
    earth_hours: number;
    both_hours: number;
    max_eclipse_pct: number;
    eclipse_samples: number;
  };
  events: {
    sunsets: VisibilityEvent[];
    sunrises: VisibilityEvent[];
    earthsets: VisibilityEvent[];
    earthrises: VisibilityEvent[];
  };
  nights: {
    longest: ShadowSpan | null;
    others: ShadowSpan[];
    earth_outages: ShadowSpan[];
  };
  incidence: {
    min_deg: number | null;
    max_deg: number | null;
    mean_deg: number | null;
    median_deg: number | null;
    std_deg: number | null;
    max_sun_elevation_deg: number;
    min_sun_elevation_deg: number;
    sunlit_samples: number;
    total_samples: number;
  };
  materials: {
    in_coverage: boolean;
    region_id: number | null;
    elements: Record<string, ElementData>;
    water_status: string;
  };
  temperature_status: string;
}

export interface HealthResponse {
  status: string;
  kernels: string;
  frame: string;
  abcorr: string;
  dem: {
    polar_80m: boolean;
    global_240m: boolean;
    sample_20m: boolean;
    sample_80m: boolean;
  };
}

export interface MineralLayerMeta {
  id: string;
  label: string;
  unit: string;
  color: string;
  available: boolean;
  status?: string;
}

export interface MaterialRegionOverlay {
  south: number;
  north: number;
  west: number;
  east: number;
  levels: Record<string, number>;
}

export interface MaterialsOverlayResponse {
  elements: MineralLayerMeta[];
  regions: MaterialRegionOverlay[];
}

/**
 * Contrato de adaptador para el visor lunar 3D.
 * Permite intercambiar Three.js por CesiumJS (o combinarlos) sin cambiar el resto de la app.
 */
export interface MoonViewport3DProps {
  historicalSites: HistoricalSite[];
  activePoints: PointDraft[];
  focusedIndex: number | null;
  pinMode: boolean;
  mineralOverlay: MaterialsOverlayResponse | null;
  selectedMinerals: string[];
  onSelectHistoricalSite: (site: HistoricalSite) => void;
  onSelectActivePoint?: (index: number) => void;
  onSurfacePick?: (latitudeDeg: number, longitudeEastDeg: number) => void;
}

export type AppMode = "home" | "pro" | "education";

export type EducationCategory = "landing" | "eternal_light" | "psr" | "mirror";

export interface EducationSite {
  id: string;
  name: string;
  category: EducationCategory;
  category_label: string;
  mission_or_source: string;
  latitude_deg: number;
  longitude_east_deg: number;
  region: string;
  illumination_note: string;
  earth_visibility_note: string;
  water_note: string;
  ilargi_story: string;
}

export interface EducationCycleFrame {
  utc: string;
  hours_from_start: number;
  sun_me_unit: [number, number, number];
  earth_me_unit: [number, number, number];
  sun_azimuth_deg: number;
  sun_elevation_deg: number;
  sun_horizon_deg: number;
  sun_visible: boolean;
  earth_azimuth_deg: number;
  earth_elevation_deg: number;
  earth_horizon_deg: number;
  earth_visible: boolean;
  sun_earth_km: [number, number, number];
  sun_moon_km: [number, number, number];
  earth_moon_km: [number, number, number];
  sun_earth_dist_km: number;
  earth_moon_dist_km: number;
  sun_moon_dist_km: number;
  illumination_fraction: number;
}

export interface EducationCycleResponse {
  start_utc: string;
  duration_hours: number;
  step_minutes: number;
  lunar_day_hours: number;
  site: {
    latitude_deg: number;
    longitude_east_deg: number;
    ground_elevation_m: number | null;
    horizon_mode: "lola" | "ideal";
  };
  frames: EducationCycleFrame[];
}
