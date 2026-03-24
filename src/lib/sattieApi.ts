import type {
  ApiCallLogEntry,
  ClearImagesResponse,
  CommandStatus,
  CreateGroundStationPayload,
  CreateRequestorPayload,
  CreateSatellitePayload,
  GroundStation,
  OrbitTrackLeoBackdropResponse,
  OrbitTrackKoreanLiveResponse,
  Requestor,
  Satellite,
  SatelliteTypeProfilesResponse,
  SaveLocalDownloadResponse,
  Scenario,
  SeedGroundStationsResponse,
  SeedRequestorsResponse,
  SeedSatellitesResponse,
  SattieConsoleBootstrap,
  SattieHealthResponse,
  UpdateGroundStationPayload,
  UpdateRequestorPayload,
  UpdateSatellitePayload,
  UplinkPayload,
  UplinkResponse,
} from "../sattie-types";

const basePath = "/api/sattie";
const apiBaseUrlStorageKey = "sattieApiBaseUrl";
const apiKeyStorageKey = "sattieApiKey";

function getStoredValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(key) ?? "";
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function resolveApiUrl(input: string) {
  const configuredBaseUrl = normalizeBaseUrl(getStoredValue(apiBaseUrlStorageKey));
  if (!configuredBaseUrl || /^https?:\/\//.test(input)) {
    return input;
  }
  return `${configuredBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const apiKey = getStoredValue(apiKeyStorageKey).trim();
  if (apiKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", apiKey);
  }

  const response = await fetch(resolveApiUrl(input), {
    headers,
    ...init,
    body: init?.body,
    method: init?.method,
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ detail: `API request failed: ${response.status}` }));
    throw new Error(payload?.detail ?? payload?.error ?? `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getSattieApiConfig() {
  return {
    apiBaseUrl: normalizeBaseUrl(getStoredValue(apiBaseUrlStorageKey)),
    apiKey: getStoredValue(apiKeyStorageKey),
  };
}

export function setSattieApiConfig(config: { apiBaseUrl: string; apiKey: string }) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(apiBaseUrlStorageKey, normalizeBaseUrl(config.apiBaseUrl));
  window.localStorage.setItem(apiKeyStorageKey, config.apiKey);
}

export function buildExternalMapPreviewUrl(params: {
  height?: number;
  lat: number;
  lon: number;
  source?: "OSM";
  width?: number;
  zoom?: number;
}) {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    zoom: String(params.zoom ?? 14),
    width: String(params.width ?? 512),
    height: String(params.height ?? 512),
    source: params.source ?? "OSM",
  });

  return resolveApiUrl(`${basePath}/preview/external-map?${query.toString()}`);
}

export function getSattieHealth() {
  return request<SattieHealthResponse>(`${basePath}/health`);
}

export function clearApiCallLogs() {
  return request<{ cleared_count: number }>(`${basePath}/monitor/api-calls/clear`, {
    method: "POST",
  });
}

export function getSatellites() {
  return request<Satellite[]>(`${basePath}/satellites`);
}

export function getOrbitTrackLeoBackdrop() {
  return request<OrbitTrackLeoBackdropResponse>(`${basePath}/orbit-track/leo-backdrop`);
}

export function getOrbitTrackKoreanLive() {
  return request<OrbitTrackKoreanLiveResponse>(`${basePath}/orbit-track/korean-live`);
}

export function createSatellite(payload: CreateSatellitePayload) {
  return request<{ satellite_id: string }>(`${basePath}/satellites`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSatellite(satelliteId: string, payload: UpdateSatellitePayload) {
  return request<Satellite>(`${basePath}/satellites/${encodeURIComponent(satelliteId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSatellite(satelliteId: string) {
  return request<{ deleted_satellite_id: string; deleted_name: string }>(
    `${basePath}/satellites/${encodeURIComponent(satelliteId)}`,
    {
      method: "DELETE",
    },
  );
}

export function getGroundStations() {
  return request<GroundStation[]>(`${basePath}/ground-stations`);
}

export function createGroundStation(payload: CreateGroundStationPayload) {
  return request<{ ground_station_id: string }>(`${basePath}/ground-stations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateGroundStation(
  groundStationId: string,
  payload: UpdateGroundStationPayload,
) {
  return request<GroundStation>(
    `${basePath}/ground-stations/${encodeURIComponent(groundStationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteGroundStation(groundStationId: string) {
  return request<{ deleted_ground_station_id: string; deleted_name: string }>(
    `${basePath}/ground-stations/${encodeURIComponent(groundStationId)}`,
    {
      method: "DELETE",
    },
  );
}

export function getRequestors(groundStationId?: string) {
  const query = groundStationId
    ? `?ground_station_id=${encodeURIComponent(groundStationId)}`
    : "";
  return request<Requestor[]>(`${basePath}/requestors${query}`);
}

export function createRequestor(payload: CreateRequestorPayload) {
  return request<{ requestor_id: string }>(`${basePath}/requestors`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRequestor(requestorId: string, payload: UpdateRequestorPayload) {
  return request<Requestor>(`${basePath}/requestors/${encodeURIComponent(requestorId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteRequestor(requestorId: string) {
  return request<{ deleted_requestor_id: string; deleted_name: string }>(
    `${basePath}/requestors/${encodeURIComponent(requestorId)}`,
    {
      method: "DELETE",
    },
  );
}

export function getCommands() {
  return request<CommandStatus[]>(`${basePath}/commands`);
}

export function getCommand(commandId: string) {
  return request<CommandStatus>(`${basePath}/commands/${encodeURIComponent(commandId)}`);
}

export function rerunCommand(commandId: string) {
  return request<CommandStatus>(`${basePath}/commands/${encodeURIComponent(commandId)}/rerun`, {
    method: "POST",
  });
}

export function createUplink(payload: UplinkPayload) {
  return request<UplinkResponse>(`${basePath}/uplink`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function clearImages() {
  return request<ClearImagesResponse>(`${basePath}/images/clear`, {
    method: "POST",
  });
}

export function saveLocalDownload(commandId: string) {
  return request<SaveLocalDownloadResponse>(
    `${basePath}/downloads/${encodeURIComponent(commandId)}/save-local`,
    {
      method: "POST",
    },
  );
}

export function getScenarios() {
  return request<Scenario[]>(`${basePath}/scenarios`);
}

export function getSatelliteTypes() {
  return request<SatelliteTypeProfilesResponse>(`${basePath}/satellite-types`);
}

export function getApiCallLogs(limit = 100) {
  return request<ApiCallLogEntry[]>(`${basePath}/monitor/api-calls?limit=${limit}`);
}

export function seedMockSatellites() {
  return request<SeedSatellitesResponse>(`${basePath}/seed/mock-satellites`, {
    method: "POST",
  });
}

export function seedMockGroundStations() {
  return request<SeedGroundStationsResponse>(`${basePath}/seed/mock-ground-stations`, {
    method: "POST",
  });
}

export function seedMockRequestors() {
  return request<SeedRequestorsResponse>(`${basePath}/seed/mock-requestors`, {
    method: "POST",
  });
}

export async function getSattieBootstrap(): Promise<SattieConsoleBootstrap> {
  const [satellites, groundStations, requestors, scenarios, satelliteTypes] =
    await Promise.all([
      getSatellites(),
      getGroundStations(),
      getRequestors(),
      getScenarios(),
      getSatelliteTypes(),
    ]);

  return {
    health: {
      ok: false,
      service: "sattie",
      dbPath: "",
      sqliteVersion: "-",
      counts: {
        satellites: satellites.length,
        groundStations: groundStations.length,
        requestors: requestors.length,
        commands: 0,
      },
    },
    satellites,
    groundStations,
    requestors,
    scenarios,
    satelliteTypes,
  };
}
