export type SatelliteType = "EO_OPTICAL" | "SAR";
export type SatelliteStatus = "AVAILABLE" | "MAINTENANCE";
export type GroundStationType = "FIXED" | "LAND_MOBILE" | "MARITIME" | "AIRBORNE";
export type GroundStationStatus = "OPERATIONAL" | "MAINTENANCE";
export type CommandState = "QUEUED" | "ACKED" | "CAPTURING" | "DOWNLINK_READY" | "FAILED";
export type TaskPriority = "BACKGROUND" | "COMMERCIAL" | "URGENT";
export type LookSide = "ANY" | "LEFT" | "RIGHT";
export type PassDirection = "ANY" | "ASCENDING" | "DESCENDING";
export type DeliveryMethod = "DOWNLOAD" | "S3" | "WEBHOOK";
export type GenerationMode = "INTERNAL" | "EXTERNAL";
export type ExternalMapSource = "OSM";

export interface SatelliteTypeProfile {
  platform: string;
  orbit_type: string;
  nominal_altitude_km: number;
  nominal_swath_km: number;
  revisit_hours: number;
  sensor_modes: string[];
  default_product_type: string;
  default_bands_or_polarization: string[];
}

export interface Satellite {
  satellite_id: string;
  internal_satellite_code: string | null;
  name: string;
  eng_model: string | null;
  domain: string | null;
  resolution_perf: string | null;
  baseline_status: string | null;
  primary_mission: string | null;
  tracker_name: string | null;
  tracker_domestic_name: string | null;
  norad_cat_id: string | null;
  object_type: string | null;
  object_id: string | null;
  tracker_current: string | null;
  launch_date: string | null;
  launch_site: string | null;
  period_minutes: number | null;
  inclination_deg: number | null;
  apogee_km: number | null;
  perigee_km: number | null;
  orbit_class: string | null;
  orbit_label: string | null;
  orbital_slot: string | null;
  tracker_source: string | null;
  type: SatelliteType;
  status: SatelliteStatus;
  profile: SatelliteTypeProfile;
}

export interface GroundStation {
  ground_station_id: string;
  internal_ground_station_code: string | null;
  name: string;
  type: GroundStationType;
  status: GroundStationStatus;
  location: string | null;
}

export interface Requestor {
  requestor_id: string;
  name: string;
  ground_station_id: string;
  ground_station_name: string | null;
}

export interface CommandStatus {
  command_id: string;
  satellite_id: string;
  satellite_type: SatelliteType;
  ground_station_id: string | null;
  ground_station_name: string | null;
  ground_station_type: GroundStationType | null;
  requestor_id: string | null;
  requestor_name: string | null;
  mission_name: string;
  aoi_name: string;
  width: number;
  height: number;
  cloud_percent: number;
  fail_probability: number;
  state: CommandState;
  message: string | null;
  created_at: string;
  updated_at: string;
  archived_image_path: string | null;
  archived_image_relative_path: string | null;
  download_url: string | null;
  request_profile: Record<string, unknown>;
  acquisition_metadata: Record<string, unknown> | null;
  product_metadata: Record<string, unknown> | null;
}

export interface Scenario {
  scenario_id: string;
  scenario_name: string;
  scenario_desc: string;
  satellite_system_ids: string[];
}

export interface ApiCallLogEntry {
  time: string;
  method: string;
  path: string;
  status: number;
  summary: string;
  client_ip?: string | null;
}

export interface SattieHealthResponse {
  ok: boolean;
  service: string;
  dbPath: string;
  sqliteVersion: string;
  counts: {
    satellites: number;
    groundStations: number;
    requestors: number;
    commands: number;
  };
}

export type SatelliteTypeProfilesResponse = Record<SatelliteType, SatelliteTypeProfile>;

export interface SeedSatellitesResponse {
  satellite_ids: string[];
}

export interface SeedGroundStationsResponse {
  ground_station_ids: string[];
}

export interface SeedRequestorsResponse {
  requestor_ids: string[];
}

export interface SaveLocalDownloadResponse {
  command_id: string;
  saved_path: string;
  file_size_bytes: number;
  message: string;
}

export interface ClearImagesResponse {
  deleted_count: number;
  cleared_command_count: number;
  message: string;
}

export interface CreateSatellitePayload {
  satellite_id?: string;
  name: string;
  type: SatelliteType;
  status?: SatelliteStatus;
}

export interface CreateGroundStationPayload {
  ground_station_id?: string;
  name: string;
  type: GroundStationType;
  status?: GroundStationStatus;
  location?: string | null;
}

export interface CreateRequestorPayload {
  name: string;
  ground_station_id: string;
}

export interface UpdateSatellitePayload {
  name?: string;
  type?: SatelliteType;
  status?: SatelliteStatus;
}

export interface UpdateGroundStationPayload {
  name?: string;
  status?: GroundStationStatus;
  location?: string | null;
}

export interface UpdateRequestorPayload {
  name?: string;
  ground_station_id?: string;
}

export interface UplinkPayload {
  satellite_id: string;
  ground_station_id?: string | null;
  requestor_id?: string | null;
  mission_name: string;
  aoi_name: string;
  aoi_center_lat?: number | null;
  aoi_center_lon?: number | null;
  aoi_bbox?: number[] | null;
  window_open_utc?: string | null;
  window_close_utc?: string | null;
  priority?: TaskPriority;
  width?: number;
  height?: number;
  cloud_percent?: number;
  max_cloud_cover_percent?: number | null;
  max_off_nadir_deg?: number | null;
  min_sun_elevation_deg?: number | null;
  incidence_min_deg?: number | null;
  incidence_max_deg?: number | null;
  look_side?: LookSide;
  pass_direction?: PassDirection;
  polarization?: string | null;
  delivery_method?: DeliveryMethod;
  delivery_path?: string | null;
  generation_mode?: GenerationMode;
  external_map_source?: ExternalMapSource;
  external_map_zoom?: number;
  fail_probability?: number;
}

export interface UplinkResponse {
  command_id: string;
  state: CommandState;
  satellite_id: string;
  satellite_type: SatelliteType;
  ground_station_id: string | null;
  ground_station_name: string | null;
  ground_station_type: GroundStationType | null;
  requestor_id: string | null;
  requestor_name: string | null;
  mission_name: string;
  aoi_name: string;
  created_at: string;
}

export interface SattieConsoleBootstrap {
  health: SattieHealthResponse;
  satellites: Satellite[];
  groundStations: GroundStation[];
  requestors: Requestor[];
  scenarios: Scenario[];
  satelliteTypes: SatelliteTypeProfilesResponse;
}

export interface OrbitBackdropPoint {
  norad: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude_km: number;
  source_date: string | null;
  source_state: string | null;
}

export interface OrbitTrackLeoBackdropResponse {
  source: string;
  updated_at: string | null;
  fetched_at: string | null;
  generated_at: string;
  total_count: number;
  rendered_count: number;
  points: OrbitBackdropPoint[];
}

export interface OrbitTrackLiveEntry {
  norad: string;
  english_name: string | null;
  domestic_name: string | null;
  orbit_class: string | null;
  orbit_label: string | null;
  source_date: string | null;
  source_label: string | null;
  fetched_at: string | null;
  period_minutes: number;
  current: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
  };
  track: Array<{
    latitude: number;
    longitude: number;
    altitudeKm: number;
  }>;
}

export interface OrbitTrackKoreanLiveResponse {
  source: string;
  updated_at: string | null;
  generated_at: string;
  count: number;
  entries: OrbitTrackLiveEntry[];
}
