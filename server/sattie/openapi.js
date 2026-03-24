const nullableString = { type: "string", nullable: true };
const nullableNumber = { type: "number", nullable: true };
const timestamp = { type: "string", format: "date-time" };

function toShellJson(value) {
  return JSON.stringify(value, null, 2).replace(/'/g, "'\"'\"'");
}

function buildCurlExample({ method, path, body }) {
  const lines = [
    `curl -X ${method} "http://localhost:6005/api/sattie${path}"`,
    `  -H "Accept: application/json"`,
    `  -H "x-api-key: change-me"`,
  ];

  if (body) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${toShellJson(body)}'`);
  }

  return `\`\`\`bash\n${lines.join(" \\\n")}\n\`\`\``;
}

function buildOperationDescription({ overview, whenToUse, requestNotes, responseNotes, method, path, body }) {
  return [
    "### What this endpoint does",
    overview,
    "",
    "### How it is typically used",
    whenToUse ?? "This endpoint is called by the corresponding console screen or automation flow.",
    "",
    "### Request guide",
    requestNotes ?? "Send the documented path, query, and body fields as shown below. Optional fields may be omitted unless your scenario requires them.",
    "",
    "### Response guide",
    responseNotes ?? "On success the server returns the schema shown in this operation. On failure it returns a JSON error object with detail or error fields.",
    "",
    "Example request:",
    buildCurlExample({ method, path, body }),
  ]
    .filter(Boolean)
    .join("\n");
}
const exampleSatelliteTypeProfile = {
  platform: "GEO Communications Bus",
  orbit_type: "GEO",
  nominal_altitude_km: 35786,
  nominal_swath_km: 1200,
  revisit_hours: 0.5,
  sensor_modes: ["EO_OPTICAL"],
  default_product_type: "BROADCAST",
  default_bands_or_polarization: ["RGB"],
};
const exampleSatellite = {
  satellite_id: "sat-abs1a",
  internal_satellite_code: "ABS-1A-KOREASAT-2",
  name: "ABS 1A (KOREASAT 2)",
  eng_model: "ABS-1A",
  domain: "COMM",
  resolution_perf: "Broadcast / communications relay",
  baseline_status: "Nominal",
  primary_mission: "Broadcast and communication service",
  tracker_name: "ABS-1A",
  tracker_domestic_name: "코리아샛 2",
  norad_cat_id: "23560",
  object_type: "PAYLOAD",
  object_id: "1995-010A",
  tracker_current: "ACTIVE",
  launch_date: "1995-01-26",
  launch_site: "Kourou",
  period_minutes: 1436.1,
  inclination_deg: 0.1,
  apogee_km: 35790,
  perigee_km: 35780,
  orbit_class: "GEO",
  orbit_label: "Geostationary Orbit",
  orbital_slot: "116.0E",
  tracker_source: "sattie-skor-tracker",
  type: "EO_OPTICAL",
  status: "AVAILABLE",
  profile: exampleSatelliteTypeProfile,
};
const exampleGroundStation = {
  ground_station_id: "DAE-DM",
  internal_ground_station_code: "GS-DAE-001",
  name: "Daejeon Mission Control Ground Station",
  type: "FIXED",
  status: "OPERATIONAL",
  location: "Daejeon, KR",
};
const exampleRequestor = {
  requestor_id: "req-03ac066b",
  name: "Daejeon Requestor Alpha",
  ground_station_id: "DAE-DM",
  ground_station_name: "Daejeon Mission Control Ground Station",
};
const exampleScenario = {
  scenario_id: "scn-eo-baseline",
  scenario_name: "EO Baseline Run",
  scenario_desc: "Nominal EO capture scenario for regression and PoC runs.",
  satellite_system_ids: ["sat-abs1a"],
};
const exampleApiCallLog = {
  time: "2026-03-24T07:15:31.102Z",
  method: "POST",
  path: "/api/sattie/uplink",
  status: 200,
  summary: "{\"command_id\":\"cmd-20260324-001\",\"state\":\"ACKED\"}",
  client_ip: "::1",
};
const exampleHealth = {
  ok: true,
  service: "sattie-express",
  dbPath: "/data/sattie.sqlite",
  sqliteVersion: "3.45.1",
  counts: {
    satellites: 53,
    groundStations: 8,
    requestors: 12,
    commands: 104,
  },
};
const exampleCreateSatellitePayload = {
  satellite_id: "sat-geo-demo",
  name: "GEO Demo Satellite",
  type: "EO_OPTICAL",
  status: "AVAILABLE",
};
const exampleCreateGroundStationPayload = {
  ground_station_id: "BUS-MC",
  name: "Busan Mission Control Ground Station",
  type: "FIXED",
  status: "OPERATIONAL",
  location: "Busan, KR",
};
const exampleCreateRequestorPayload = {
  name: "Busan Requestor Beta",
  ground_station_id: "BUS-MC",
};
const exampleUplinkPayload = {
  satellite_id: "sat-abs1a",
  ground_station_id: "DAE-DM",
  requestor_id: "req-03ac066b",
  mission_name: "EO 촬영 임무",
  aoi_name: "기본 EO 촬영지역",
  aoi_center_lat: 36.35,
  aoi_center_lon: 127.38,
  aoi_bbox: [126.9, 36.0, 127.85, 36.75],
  window_open_utc: "2026-03-24T07:20:00.000Z",
  window_close_utc: "2026-03-24T07:35:00.000Z",
  priority: "COMMERCIAL",
  width: 1024,
  height: 1024,
  cloud_percent: 15,
  max_cloud_cover_percent: 30,
  max_off_nadir_deg: 20,
  min_sun_elevation_deg: 20,
  incidence_min_deg: null,
  incidence_max_deg: null,
  look_side: "ANY",
  pass_direction: "ANY",
  polarization: null,
  delivery_method: "DOWNLOAD",
  delivery_path: null,
  generation_mode: "EXTERNAL",
  external_map_source: "OSM",
  external_map_zoom: 14,
  fail_probability: 0.05,
};
const exampleUplinkResponse = {
  command_id: "cmd-20260324-001",
  state: "ACKED",
  satellite_id: "sat-abs1a",
  satellite_type: "EO_OPTICAL",
  ground_station_id: "DAE-DM",
  ground_station_name: "Daejeon Mission Control Ground Station",
  ground_station_type: "FIXED",
  requestor_id: "req-03ac066b",
  requestor_name: "Daejeon Requestor Alpha",
  mission_name: "EO 촬영 임무",
  aoi_name: "기본 EO 촬영지역",
  created_at: "2026-03-24T07:20:03.112Z",
};
const exampleCommandStatus = {
  command_id: "cmd-20260324-001",
  satellite_id: "sat-abs1a",
  satellite_type: "EO_OPTICAL",
  ground_station_id: "DAE-DM",
  ground_station_name: "Daejeon Mission Control Ground Station",
  ground_station_type: "FIXED",
  requestor_id: "req-03ac066b",
  requestor_name: "Daejeon Requestor Alpha",
  mission_name: "EO 촬영 임무",
  aoi_name: "기본 EO 촬영지역",
  width: 1024,
  height: 1024,
  cloud_percent: 15,
  fail_probability: 0.05,
  state: "DOWNLINK_READY",
  message: "Archived image ready for download",
  created_at: "2026-03-24T07:20:03.112Z",
  updated_at: "2026-03-24T07:25:19.001Z",
  archived_image_path: "/archive/cmd-20260324-001.png",
  archived_image_relative_path: "archive/cmd-20260324-001.png",
  download_url: "/api/sattie/downloads/cmd-20260324-001",
  request_profile: exampleUplinkPayload,
  acquisition_metadata: {
    lat: 36.35,
    lon: 127.38,
    source: "OSM",
  },
  product_metadata: {
    file_name: "cmd-20260324-001.png",
    format: "png",
  },
};
const exampleLeoBackdropResponse = {
  source: "leo-live-cache",
  updated_at: "2026-03-24T07:00:00.000Z",
  fetched_at: "2026-03-24T07:05:00.000Z",
  generated_at: "2026-03-24T07:05:01.000Z",
  total_count: 312,
  rendered_count: 280,
  points: [
    {
      norad: "33487",
      name: "KOMPSAT-5",
      latitude: 36.1,
      longitude: 127.2,
      altitude_km: 550.2,
      source_date: "2026-03-24",
      source_state: "CURRENT",
    },
  ],
};
const exampleKoreanLiveResponse = {
  source: "sattie-skor-tracker",
  updated_at: "2026-03-24T07:05:00.000Z",
  generated_at: "2026-03-24T07:05:01.000Z",
  count: 53,
  entries: [
    {
      norad: "33487",
      english_name: "KOMPSAT-5",
      domestic_name: "아리랑 5호",
      orbit_class: "LEO",
      orbit_label: "Sun-Synchronous Orbit",
      source_date: "2026-03-24",
      source_label: "Current Track",
      fetched_at: "2026-03-24T07:05:00.000Z",
      period_minutes: 97.1,
      current: { latitude: 36.1, longitude: 127.2, altitudeKm: 550.2 },
      track: [
        { latitude: 35.8, longitude: 126.9, altitudeKm: 550.1 },
        { latitude: 36.1, longitude: 127.2, altitudeKm: 550.2 },
      ],
    },
  ],
};
const exampleClearLogsResponse = { cleared_count: 28 };
const exampleSaveLocalDownloadResponse = {
  command_id: "cmd-20260324-001",
  saved_path: "/home/js/Downloads/cmd-20260324-001.png",
  file_size_bytes: 584229,
  message: "Image saved to local path",
};
const exampleClearImagesResponse = {
  deleted_count: 14,
  cleared_command_count: 14,
  message: "Archived images cleared",
};
const exampleValidationError = { detail: "mission_name is required" };
const exampleNotFoundError = { detail: "Command not found: cmd-missing" };
const exampleConflictError = { detail: "Satellite already exists: sat-geo-demo" };

export function createSattieOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "K-Sattie Image Hub API",
      version: "1.0.0",
      description:
        "Operational API contract for the sattie console. This spec covers the /api/sattie namespace used by the React + Express + SQLite port. The client may send an optional x-api-key header; the current Express server does not enforce it directly.",
    },
    servers: [
      {
        url: "/api/sattie",
        description: "Current server",
      },
    ],
    security: [{ ApiKeyHeader: [] }, {}],
    tags: [
      {
        name: "System",
        description:
          "Health, preview, and API monitoring endpoints. Start here when validating environment readiness or inspecting backend traffic.",
      },
      {
        name: "Orbit Track",
        description:
          "Endpoints used by the orbit tracking screens. They provide Korean live tracks and wider LEO backdrop context for the map.",
      },
      {
        name: "Satellites",
        description:
          "Satellite catalog and management endpoints. These are the core resource records used by uplink and tracking flows.",
      },
      {
        name: "Ground Stations",
        description:
          "Ground station management endpoints. These resources define where commands are routed and which stations operators can select.",
      },
      {
        name: "Requestors",
        description:
          "Requestor management endpoints. Requestors are mission owners or consumers linked to a ground station.",
      },
      {
        name: "Commands",
        description:
          "Mission uplink, scenario, and command tracking endpoints. Use these APIs to create, inspect, and rerun command executions.",
      },
      {
        name: "Downloads",
        description:
          "Archived output and file management endpoints. They are used after image generation has completed.",
      },
      {
        name: "Seed",
        description:
          "PoC data seeding endpoints. These rapidly populate the environment with mock resources for simulation and demos.",
      },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          summary: "Get service health",
          operationId: "getSattieHealth",
          description: buildOperationDescription({
            overview:
              "Checks whether the sattie backend is alive and returns SQLite version and current resource counts.",
            whenToUse:
              "Call this first when wiring a new client, checking a deployment, or confirming that the in-memory/runtime state is populated.",
            responseNotes:
              "A successful response includes aggregate counts for satellites, ground stations, requestors, and commands.",
            method: "GET",
            path: "/health",
          }),
          responses: {
            200: {
              description: "Service health payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SattieHealthResponse" },
                  example: exampleHealth,
                },
              },
            },
          },
        },
      },
      "/preview/external-map": {
        get: {
          tags: ["System"],
          summary: "Render external map preview PNG",
          operationId: "previewExternalMap",
          description: buildOperationDescription({
            overview:
              "Renders a preview PNG from the external map source for the requested latitude/longitude, zoom, and image dimensions.",
            whenToUse:
              "Use this before an uplink or archive generation flow when the UI needs a live map preview for an AOI center.",
            requestNotes:
              "All coordinates are decimal degrees. Width and height are pixel values for the generated PNG.",
            responseNotes:
              "The response body is binary image data with content-type image/png rather than JSON.",
            method: "GET",
            path: "/preview/external-map?lat=36.35&lon=127.38&zoom=14&width=512&height=512&source=OSM",
          }),
          parameters: [
            {
              name: "lat",
              in: "query",
              required: true,
              description: "AOI center latitude in decimal degrees.",
              schema: { type: "number" },
            },
            {
              name: "lon",
              in: "query",
              required: true,
              description: "AOI center longitude in decimal degrees.",
              schema: { type: "number" },
            },
            {
              name: "zoom",
              in: "query",
              description: "Map zoom level used for tile fetch and render.",
              schema: { type: "integer", default: 14 },
            },
            {
              name: "width",
              in: "query",
              description: "PNG width in pixels.",
              schema: { type: "integer", default: 512 },
            },
            {
              name: "height",
              in: "query",
              description: "PNG height in pixels.",
              schema: { type: "integer", default: 512 },
            },
            {
              name: "source",
              in: "query",
              description: "External map provider identifier.",
              schema: { $ref: "#/components/schemas/ExternalMapSource" },
            },
          ],
          responses: {
            200: {
              description: "PNG preview image",
              content: {
                "image/png": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
      },
      "/monitor/api-calls": {
        get: {
          tags: ["System"],
          summary: "List recent API call logs",
          operationId: "getApiCallLogs",
          description: buildOperationDescription({
            overview:
              "Returns the most recent in-memory API call log entries captured by the sattie router middleware.",
            whenToUse:
              "Use this to drive the API Call Logs screen, validate traffic during demos, or inspect recent backend activity without tailing a server log.",
            requestNotes:
              "The limit is capped server-side to avoid returning the entire retained buffer.",
            responseNotes:
              "Entries are returned newest first from the in-memory ring buffer.",
            method: "GET",
            path: "/monitor/api-calls?limit=50",
          }),
          parameters: [
            {
              name: "limit",
              in: "query",
              description: "Maximum number of log entries to return.",
              schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
            },
          ],
          responses: {
            200: {
              description: "Recent API calls",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ApiCallLogEntry" },
                  },
                  example: [exampleApiCallLog],
                },
              },
            },
          },
        },
      },
      "/monitor/api-calls/clear": {
        post: {
          tags: ["System"],
          summary: "Clear recent API call logs",
          operationId: "clearApiCallLogs",
          description: buildOperationDescription({
            overview:
              "Clears the in-memory recent API call buffer used by the monitoring console.",
            whenToUse:
              "Use this before a demo, test run, or focused troubleshooting session when you want to start observing traffic from a clean slate.",
            responseNotes:
              "The response includes how many buffered entries were removed.",
            method: "POST",
            path: "/monitor/api-calls/clear",
          }),
          responses: {
            200: {
              description: "Clear result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["cleared_count"],
                    properties: {
                      cleared_count: { type: "integer" },
                    },
                  },
                  example: exampleClearLogsResponse,
                },
              },
            },
          },
        },
      },
      "/orbit-track/leo-backdrop": {
        get: {
          tags: ["Orbit Track"],
          summary: "Get LEO backdrop points",
          operationId: "getOrbitTrackLeoBackdrop",
          description: buildOperationDescription({
            overview:
              "Returns backdrop points used to render the broader low-earth-orbit context behind the main Korean satellite tracks.",
            whenToUse:
              "Call this when drawing the Orbit Track map background or when you need the non-primary orbital context layer.",
            responseNotes:
              "The payload includes both total cached points and the subset actually rendered by the service.",
            method: "GET",
            path: "/orbit-track/leo-backdrop",
          }),
          responses: {
            200: {
              description: "LEO backdrop response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrbitTrackLeoBackdropResponse" },
                  example: exampleLeoBackdropResponse,
                },
              },
            },
          },
        },
      },
      "/orbit-track/korean-live": {
        get: {
          tags: ["Orbit Track"],
          summary: "Get live Korean satellite orbit tracks",
          operationId: "getOrbitTrackKoreanLive",
          description: buildOperationDescription({
            overview:
              "Returns current Korean satellite positions and precomputed orbit track segments for the orbit tracking console.",
            whenToUse:
              "Use this to refresh the main Orbit Track map and popup satellite selector on a live cadence.",
            responseNotes:
              "Each entry includes current position plus a track array suitable for direct map rendering.",
            method: "GET",
            path: "/orbit-track/korean-live",
          }),
          responses: {
            200: {
              description: "Live orbit track response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrbitTrackKoreanLiveResponse" },
                  example: exampleKoreanLiveResponse,
                },
              },
            },
          },
        },
      },
      "/satellite-types": {
        get: {
          tags: ["Satellites"],
          summary: "List satellite type profiles",
          operationId: "listSatelliteTypes",
          description: buildOperationDescription({
            overview:
              "Returns the static type profile catalog that describes EO and SAR capabilities used throughout the console.",
            whenToUse:
              "Use this when populating type selectors or when the UI needs orbit/sensor defaults for a selected satellite type.",
            responseNotes:
              "The payload is a keyed object map rather than an array.",
            method: "GET",
            path: "/satellite-types",
          }),
          responses: {
            200: {
              description: "Satellite type profile map",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: { $ref: "#/components/schemas/SatelliteTypeProfile" },
                  },
                },
              },
            },
          },
        },
      },
      "/scenarios": {
        get: {
          tags: ["Commands"],
          summary: "List multi-scenario definitions",
          operationId: "listScenarios",
          description: buildOperationDescription({
            overview:
              "Lists the predefined multi-scenario templates used by the scenario execution and regression views.",
            whenToUse:
              "Call this when showing the scenario catalog or when a user needs to select a prepared regression bundle.",
            responseNotes:
              "Each scenario entry contains human-readable metadata plus the participating satellite system ids.",
            method: "GET",
            path: "/scenarios",
          }),
          responses: {
            200: {
              description: "Scenario list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Scenario" },
                  },
                  example: [exampleScenario],
                },
              },
            },
          },
        },
      },
      "/satellites": {
        get: {
          tags: ["Satellites"],
          summary: "List satellites",
          operationId: "listSatellites",
          description: buildOperationDescription({
            overview:
              "Returns all managed satellite resources currently registered in the sattie database.",
            whenToUse:
              "Use this for the satellite management table, uplink form selectors, dashboard counts, and bootstrap flows.",
            responseNotes:
              "Each row includes both management metadata and tracker/orbit metadata when present.",
            method: "GET",
            path: "/satellites",
          }),
          responses: {
            200: {
              description: "Satellite list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Satellite" },
                  },
                  example: [exampleSatellite],
                },
              },
            },
          },
        },
        post: {
          tags: ["Satellites"],
          summary: "Create satellite",
          operationId: "createSatellite",
          description: buildOperationDescription({
            overview:
              "Creates a new managed satellite resource that becomes available to the console immediately.",
            whenToUse:
              "Use this from the Satellites management form when onboarding a new satellite into the PoC environment.",
            requestNotes:
              "Only name and type are mandatory. A custom satellite_id can be supplied, otherwise the service may generate or normalize one.",
            responseNotes:
              "The response returns the created satellite id; fetch the list again if the UI needs the full hydrated row.",
            method: "POST",
            path: "/satellites",
            body: exampleCreateSatellitePayload,
          }),
          requestBody: {
            required: true,
            description: "Satellite creation payload.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateSatellitePayload" },
                example: exampleCreateSatellitePayload,
              },
            },
          },
          responses: {
            200: {
              description: "Created satellite id",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["satellite_id"],
                    properties: { satellite_id: { type: "string" } },
                  },
                  example: { satellite_id: "sat-geo-demo" },
                },
              },
            },
            400: {
              $ref: "#/components/responses/BadRequestError",
            },
          },
        },
      },
      "/satellites/{satelliteId}": {
        patch: {
          tags: ["Satellites"],
          summary: "Update satellite",
          operationId: "updateSatellite",
          description: buildOperationDescription({
            overview:
              "Updates editable metadata for a single satellite resource.",
            whenToUse:
              "Use this from the edit dialog when an operator changes the display name, operational type, or current availability.",
            requestNotes:
              "This is a partial update. Only send the fields that need to change.",
            responseNotes:
              "The response returns the fully updated satellite row.",
            method: "PATCH",
            path: "/satellites/sat-abs1a",
            body: { name: "ABS 1A (KOREASAT 2)", status: "AVAILABLE" },
          }),
          parameters: [
            {
              name: "satelliteId",
              in: "path",
              required: true,
              description: "Unique satellite identifier.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            description: "Partial satellite update payload.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateSatellitePayload" },
              },
            },
          },
          responses: {
            200: {
              description: "Updated satellite",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Satellite" },
                  example: exampleSatellite,
                },
              },
            },
            400: {
              $ref: "#/components/responses/BadRequestError",
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
        delete: {
          tags: ["Satellites"],
          summary: "Delete satellite",
          operationId: "deleteSatellite",
          description: buildOperationDescription({
            overview:
              "Removes a satellite resource from the management database.",
            whenToUse:
              "Use this only when cleaning up seeded demo data or removing an invalid registration from the PoC environment.",
            responseNotes:
              "The service returns the deleted id and deleted display name for confirmation.",
            method: "DELETE",
            path: "/satellites/sat-geo-demo",
          }),
          parameters: [
            {
              name: "satelliteId",
              in: "path",
              required: true,
              description: "Unique satellite identifier.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Deleted satellite result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["deleted_satellite_id", "deleted_name"],
                    properties: {
                      deleted_satellite_id: { type: "string" },
                      deleted_name: { type: "string" },
                    },
                  },
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/seed/mock-satellites": {
        post: {
          tags: ["Seed"],
          summary: "Seed mock satellites",
          operationId: "seedMockSatellites",
          description: buildOperationDescription({
            overview:
              "Inserts a prepared set of mock satellite records for PoC and demo use.",
            whenToUse:
              "Use this on a clean database when you want enough sample satellites to exercise the management and uplink flows quickly.",
            responseNotes:
              "The response returns only the inserted ids, not the full satellite rows.",
            method: "POST",
            path: "/seed/mock-satellites",
          }),
          responses: {
            200: {
              description: "Seed result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["satellite_ids"],
                    properties: {
                      satellite_ids: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/ground-stations": {
        get: {
          tags: ["Ground Stations"],
          summary: "List ground stations",
          operationId: "listGroundStations",
          description: buildOperationDescription({
            overview:
              "Returns all managed ground station resources registered in the sattie database.",
            whenToUse:
              "Use this to populate the ground station management table and the uplink form station selector.",
            responseNotes:
              "Each record contains the operational state and optional human-readable location string.",
            method: "GET",
            path: "/ground-stations",
          }),
          responses: {
            200: {
              description: "Ground station list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/GroundStation" },
                  },
                  example: [exampleGroundStation],
                },
              },
            },
          },
        },
        post: {
          tags: ["Ground Stations"],
          summary: "Create ground station",
          operationId: "createGroundStation",
          description: buildOperationDescription({
            overview:
              "Creates a new ground station resource available for uplink routing and resource management.",
            whenToUse:
              "Use this when adding a mission control site or a new communications endpoint to the PoC console.",
            requestNotes:
              "Name and type are required. Location is optional display metadata.",
            responseNotes:
              "The response returns the created ground_station_id.",
            method: "POST",
            path: "/ground-stations",
            body: exampleCreateGroundStationPayload,
          }),
          requestBody: {
            required: true,
            description: "Ground station creation payload.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateGroundStationPayload" },
                example: exampleCreateGroundStationPayload,
              },
            },
          },
          responses: {
            200: {
              description: "Created ground station id",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ground_station_id"],
                    properties: { ground_station_id: { type: "string" } },
                  },
                  example: { ground_station_id: "BUS-MC" },
                },
              },
            },
          },
        },
      },
      "/ground-stations/{groundStationId}": {
        patch: {
          tags: ["Ground Stations"],
          summary: "Update ground station",
          operationId: "updateGroundStation",
          description: buildOperationDescription({
            overview:
              "Updates editable metadata for a ground station.",
            whenToUse:
              "Use this from the edit dialog when operational status, display name, or location text changes.",
            requestNotes:
              "This is a partial update endpoint.",
            responseNotes:
              "The updated full ground station row is returned.",
            method: "PATCH",
            path: "/ground-stations/DAE-DM",
            body: { status: "OPERATIONAL", location: "Daejeon, KR" },
          }),
          parameters: [
            {
              name: "groundStationId",
              in: "path",
              required: true,
              description: "Unique ground station identifier.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            description: "Partial ground station update payload.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateGroundStationPayload" },
              },
            },
          },
          responses: {
            200: {
              description: "Updated ground station",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GroundStation" },
                  example: exampleGroundStation,
                },
              },
            },
            400: {
              $ref: "#/components/responses/BadRequestError",
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
        delete: {
          tags: ["Ground Stations"],
          summary: "Delete ground station",
          operationId: "deleteGroundStation",
          description: buildOperationDescription({
            overview:
              "Deletes a ground station resource from the database.",
            whenToUse:
              "Use this only for cleanup or when a seeded/demo station should no longer be selectable.",
            responseNotes:
              "The response contains the deleted id and name for confirmation.",
            method: "DELETE",
            path: "/ground-stations/BUS-MC",
          }),
          parameters: [
            {
              name: "groundStationId",
              in: "path",
              required: true,
              description: "Unique ground station identifier.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Deleted ground station result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["deleted_ground_station_id", "deleted_name"],
                    properties: {
                      deleted_ground_station_id: { type: "string" },
                      deleted_name: { type: "string" },
                    },
                  },
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/seed/mock-ground-stations": {
        post: {
          tags: ["Seed"],
          summary: "Seed mock ground stations",
          operationId: "seedMockGroundStations",
          description: buildOperationDescription({
            overview:
              "Inserts the canned ground station seed set used by the PoC flows.",
            whenToUse:
              "Use this after resetting the database or when the environment lacks enough station data for the resource management page.",
            responseNotes:
              "Only the inserted ids are returned.",
            method: "POST",
            path: "/seed/mock-ground-stations",
          }),
          responses: {
            200: {
              description: "Seed result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ground_station_ids"],
                    properties: {
                      ground_station_ids: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/requestors": {
        get: {
          tags: ["Requestors"],
          summary: "List requestors",
          operationId: "listRequestors",
          description: buildOperationDescription({
            overview:
              "Returns all requestor resources, optionally filtered to a single ground station.",
            whenToUse:
              "Use this for the requestor management table or to populate the uplink form requestor selector after a station is chosen.",
            requestNotes:
              "ground_station_id is optional; omit it to retrieve the full list.",
            responseNotes:
              "Each requestor row includes the linked ground station name when available.",
            method: "GET",
            path: "/requestors?ground_station_id=DAE-DM",
          }),
          parameters: [
            {
              name: "ground_station_id",
              in: "query",
              description: "Optional ground station filter.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Requestor list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Requestor" },
                  },
                  example: [exampleRequestor],
                },
              },
            },
          },
        },
        post: {
          tags: ["Requestors"],
          summary: "Create requestor",
          operationId: "createRequestor",
          description: buildOperationDescription({
            overview:
              "Creates a new requestor and associates it with a ground station.",
            whenToUse:
              "Use this when onboarding a mission consumer or operational request owner in the PoC console.",
            requestNotes:
              "A valid ground_station_id must already exist before creating the requestor.",
            responseNotes:
              "The response returns the created requestor_id.",
            method: "POST",
            path: "/requestors",
            body: exampleCreateRequestorPayload,
          }),
          requestBody: {
            required: true,
            description: "Requestor creation payload.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateRequestorPayload" },
                example: exampleCreateRequestorPayload,
              },
            },
          },
          responses: {
            200: {
              description: "Created requestor id",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["requestor_id"],
                    properties: { requestor_id: { type: "string" } },
                  },
                  example: { requestor_id: "req-busan-beta" },
                },
              },
            },
          },
        },
      },
      "/requestors/{requestorId}": {
        patch: {
          tags: ["Requestors"],
          summary: "Update requestor",
          operationId: "updateRequestor",
          description: buildOperationDescription({
            overview:
              "Updates editable requestor metadata such as display name or linked ground station.",
            whenToUse:
              "Use this from the requestor edit dialog when ownership or station linkage changes.",
            requestNotes:
              "This is a partial update endpoint.",
            responseNotes:
              "The fully updated requestor row is returned.",
            method: "PATCH",
            path: "/requestors/req-03ac066b",
            body: { name: "Daejeon Requestor Alpha", ground_station_id: "DAE-DM" },
          }),
          parameters: [
            {
              name: "requestorId",
              in: "path",
              required: true,
              description: "Unique requestor identifier.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            description: "Partial requestor update payload.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateRequestorPayload" },
              },
            },
          },
          responses: {
            200: {
              description: "Updated requestor",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Requestor" },
                  example: exampleRequestor,
                },
              },
            },
            400: {
              $ref: "#/components/responses/BadRequestError",
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
        delete: {
          tags: ["Requestors"],
          summary: "Delete requestor",
          operationId: "deleteRequestor",
          description: buildOperationDescription({
            overview:
              "Deletes a requestor resource from the management database.",
            whenToUse:
              "Use this only for cleanup or when removing stale seeded identities from the PoC environment.",
            responseNotes:
              "The response returns the deleted id and name for confirmation.",
            method: "DELETE",
            path: "/requestors/req-busan-beta",
          }),
          parameters: [
            {
              name: "requestorId",
              in: "path",
              required: true,
              description: "Unique requestor identifier.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Deleted requestor result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["deleted_requestor_id", "deleted_name"],
                    properties: {
                      deleted_requestor_id: { type: "string" },
                      deleted_name: { type: "string" },
                    },
                  },
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/seed/mock-requestors": {
        post: {
          tags: ["Seed"],
          summary: "Seed mock requestors",
          operationId: "seedMockRequestors",
          description: buildOperationDescription({
            overview:
              "Inserts the canned requestor seed set used by the PoC console.",
            whenToUse:
              "Use this after database reset or when you need a quick set of requestors linked to the seeded ground stations.",
            responseNotes:
              "The response returns the inserted ids only.",
            method: "POST",
            path: "/seed/mock-requestors",
          }),
          responses: {
            200: {
              description: "Seed result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["requestor_ids"],
                    properties: {
                      requestor_ids: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/uplink": {
        post: {
          tags: ["Commands"],
          summary: "Create uplink command",
          operationId: "createUplink",
          description: buildOperationDescription({
            overview:
              "Creates a new uplink command and starts the command state progression managed by the sattie runtime.",
            whenToUse:
              "Use this from the Send a Uplink flow whenever an imaging or external map generation command should be issued.",
            requestNotes:
              "satellite_id, mission_name, and aoi_name are mandatory. Other fields refine AOI geometry, constraints, routing, and generation mode.",
            responseNotes:
              "The initial state is returned immediately. Subsequent state transitions are observed through the commands endpoints.",
            method: "POST",
            path: "/uplink",
            body: exampleUplinkPayload,
          }),
          requestBody: {
            required: true,
            description: "Uplink creation payload with mission context, AOI, and generation constraints.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UplinkPayload" },
                example: exampleUplinkPayload,
              },
            },
          },
          responses: {
            200: {
              description: "Created command",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UplinkResponse" },
                  example: exampleUplinkResponse,
                },
              },
            },
            400: {
              $ref: "#/components/responses/BadRequestError",
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/commands": {
        get: {
          tags: ["Commands"],
          summary: "List commands",
          operationId: "listCommands",
          description: buildOperationDescription({
            overview:
              "Returns the current command list with state, timing, resource linkage, and download metadata.",
            whenToUse:
              "Use this to drive the Command Tracking page and to poll command progression after creating or rerunning an uplink.",
            responseNotes:
              "Each row includes both the current state and archived download fields when an image has been generated.",
            method: "GET",
            path: "/commands",
          }),
          responses: {
            200: {
              description: "Command list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CommandStatus" },
                  },
                  example: [exampleCommandStatus],
                },
              },
            },
          },
        },
      },
      "/commands/{commandId}": {
        get: {
          tags: ["Commands"],
          summary: "Get command detail",
          operationId: "getCommand",
          description: buildOperationDescription({
            overview:
              "Returns the fully detailed record for a single command, including request and product metadata.",
            whenToUse:
              "Use this when the UI needs more than the list row, such as a detail drawer, drill-in panel, or downstream automation.",
            responseNotes:
              "The payload includes request_profile, acquisition_metadata, and product_metadata when available.",
            method: "GET",
            path: "/commands/cmd-20260324-001",
          }),
          parameters: [
            {
              name: "commandId",
              in: "path",
              required: true,
              description: "Unique command identifier.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Command detail",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CommandStatus" },
                  example: exampleCommandStatus,
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/commands/{commandId}/rerun": {
        post: {
          tags: ["Commands"],
          summary: "Rerun command",
          operationId: "rerunCommand",
          description: buildOperationDescription({
            overview:
              "Creates a rerun of an existing command using the prior command context as the base input.",
            whenToUse:
              "Use this from the Command Tracking screen when an operator wants to execute the same mission again without reentering all fields.",
            responseNotes:
              "The rerun behaves like a fresh uplink and returns a new command id with an initial state.",
            method: "POST",
            path: "/commands/cmd-20260324-001/rerun",
          }),
          parameters: [
            {
              name: "commandId",
              in: "path",
              required: true,
              description: "Unique command identifier to clone and rerun.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Rerun result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UplinkResponse" },
                  example: exampleUplinkResponse,
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/downloads/{commandId}": {
        get: {
          tags: ["Downloads"],
          summary: "Download archived image",
          operationId: "downloadCommandImage",
          description: buildOperationDescription({
            overview:
              "Downloads the archived image artifact for a command whose generation has completed.",
            whenToUse:
              "Use this after a command reaches DOWNLINK_READY and the UI needs to hand the user the final PNG file.",
            responseNotes:
              "The response is a file download, not JSON. A 404 indicates that the command exists without an archived image or the command id is invalid.",
            method: "GET",
            path: "/downloads/cmd-20260324-001",
          }),
          parameters: [
            {
              name: "commandId",
              in: "path",
              required: true,
              description: "Unique command identifier.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Archived image file",
              content: {
                "application/octet-stream": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/downloads/{commandId}/save-local": {
        post: {
          tags: ["Downloads"],
          summary: "Save archived image to local path",
          operationId: "saveLocalDownload",
          description: buildOperationDescription({
            overview:
              "Copies or persists the archived image for a command to the service's configured local download destination.",
            whenToUse:
              "Use this when an operator wants the backend to materialize the file on disk instead of streaming it immediately to the browser.",
            responseNotes:
              "The response contains the local saved path and file size.",
            method: "POST",
            path: "/downloads/cmd-20260324-001/save-local",
          }),
          parameters: [
            {
              name: "commandId",
              in: "path",
              required: true,
              description: "Unique command identifier.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Local save result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["command_id", "saved_path", "file_size_bytes", "message"],
                    properties: {
                      command_id: { type: "string" },
                      saved_path: { type: "string" },
                      file_size_bytes: { type: "integer" },
                      message: { type: "string" },
                    },
                  },
                  example: exampleSaveLocalDownloadResponse,
                },
              },
            },
            404: {
              $ref: "#/components/responses/NotFoundError",
            },
          },
        },
      },
      "/images/clear": {
        post: {
          tags: ["Downloads"],
          summary: "Clear archived images and command links",
          operationId: "clearImages",
          description: buildOperationDescription({
            overview:
              "Deletes archived image files and clears the associated command image metadata tracked by the service.",
            whenToUse:
              "Use this before a new demo cycle or during cleanup when the archive directory should be reset without removing commands themselves.",
            responseNotes:
              "The response returns how many files were deleted and how many command rows had image metadata cleared.",
            method: "POST",
            path: "/images/clear",
          }),
          responses: {
            200: {
              description: "Image clear result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["deleted_count", "cleared_command_count", "message"],
                    properties: {
                      deleted_count: { type: "integer" },
                      cleared_command_count: { type: "integer" },
                      message: { type: "string" },
                    },
                  },
                  example: exampleClearImagesResponse,
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description:
            "Optional client header. The current Express implementation does not enforce this key directly, but the React client can send it and upstream gateways may validate it.",
        },
      },
      responses: {
        BadRequestError: {
          description: "Validation failure or malformed request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: exampleValidationError,
            },
          },
        },
        NotFoundError: {
          description: "Requested resource was not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: exampleNotFoundError,
            },
          },
        },
        InternalServerError: {
          description: "Unhandled server failure",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: "Internal server error" },
            },
          },
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            detail: { type: "string" },
            error: { type: "string" },
          },
          additionalProperties: true,
        },
        SatelliteType: {
          type: "string",
          enum: ["EO_OPTICAL", "SAR"],
        },
        SatelliteStatus: {
          type: "string",
          enum: ["AVAILABLE", "MAINTENANCE"],
        },
        GroundStationType: {
          type: "string",
          enum: ["FIXED", "LAND_MOBILE", "MARITIME", "AIRBORNE"],
        },
        GroundStationStatus: {
          type: "string",
          enum: ["OPERATIONAL", "MAINTENANCE"],
        },
        CommandState: {
          type: "string",
          enum: ["QUEUED", "ACKED", "ACCESSING_AOI", "CAPTURING", "DOWNLINK_READY", "FAILED"],
        },
        TaskPriority: {
          type: "string",
          enum: ["BACKGROUND", "COMMERCIAL", "URGENT"],
        },
        LookSide: {
          type: "string",
          enum: ["ANY", "LEFT", "RIGHT"],
        },
        PassDirection: {
          type: "string",
          enum: ["ANY", "ASCENDING", "DESCENDING"],
        },
        DeliveryMethod: {
          type: "string",
          enum: ["DOWNLOAD", "S3", "WEBHOOK"],
        },
        GenerationMode: {
          type: "string",
          enum: ["INTERNAL", "EXTERNAL"],
        },
        ExternalMapSource: {
          type: "string",
          enum: ["OSM"],
        },
        SatelliteTypeProfile: {
          type: "object",
          description:
            "Static capability profile for a satellite type. This is used by the UI to explain expected orbit, sensor, and product defaults.",
          required: [
            "platform",
            "orbit_type",
            "nominal_altitude_km",
            "nominal_swath_km",
            "revisit_hours",
            "sensor_modes",
            "default_product_type",
            "default_bands_or_polarization",
          ],
          properties: {
            platform: { type: "string", description: "Platform or bus family label." },
            orbit_type: { type: "string", description: "Nominal orbit category for this type." },
            nominal_altitude_km: { type: "number", description: "Typical operating altitude in kilometers." },
            nominal_swath_km: { type: "number", description: "Typical swath width in kilometers." },
            revisit_hours: { type: "number", description: "Expected revisit interval in hours." },
            sensor_modes: { type: "array", description: "Supported sensor or operating modes.", items: { type: "string" } },
            default_product_type: { type: "string", description: "Default product class produced by this type." },
            default_bands_or_polarization: {
              type: "array",
              description: "Default spectral bands or polarization defaults.",
              items: { type: "string" },
            },
          },
          example: exampleSatelliteTypeProfile,
        },
        Satellite: {
          type: "object",
          description:
            "Managed satellite resource. This combines operational management fields with tracker/orbit metadata when known.",
          required: ["satellite_id", "name", "type", "status", "profile"],
          properties: {
            satellite_id: { type: "string", description: "Primary unique id used by the console and API." },
            internal_satellite_code: { ...nullableString, description: "Optional internal or legacy satellite code." },
            name: { type: "string", description: "Display name shown in the UI." },
            eng_model: { ...nullableString, description: "Engineering model or shortened technical name." },
            domain: { ...nullableString, description: "Mission or business domain classification." },
            resolution_perf: { ...nullableString, description: "Human-readable performance summary." },
            baseline_status: { ...nullableString, description: "Baseline health or readiness note." },
            primary_mission: { ...nullableString, description: "Primary mission statement or service purpose." },
            tracker_name: { ...nullableString, description: "Name used by the orbit tracker source." },
            tracker_domestic_name: { ...nullableString, description: "Localized or domestic name used in Korea-focused displays." },
            norad_cat_id: { ...nullableString, description: "NORAD catalog identifier when available." },
            object_type: { ...nullableString, description: "Tracker object type such as payload or platform." },
            object_id: { ...nullableString, description: "International designator or external object id." },
            tracker_current: { ...nullableString, description: "Current state reported by the tracker source." },
            launch_date: { ...nullableString, description: "Launch date string from tracker metadata." },
            launch_site: { ...nullableString, description: "Launch site or facility label." },
            period_minutes: { ...nullableNumber, description: "Orbital period in minutes." },
            inclination_deg: { ...nullableNumber, description: "Orbital inclination in degrees." },
            apogee_km: { ...nullableNumber, description: "Apogee altitude in kilometers." },
            perigee_km: { ...nullableNumber, description: "Perigee altitude in kilometers." },
            orbit_class: { ...nullableString, description: "Short orbit class code such as GEO or LEO." },
            orbit_label: { ...nullableString, description: "Expanded orbit class label." },
            orbital_slot: { ...nullableString, description: "Orbital slot or position label when relevant." },
            tracker_source: { ...nullableString, description: "Origin of the tracker metadata." },
            type: { $ref: "#/components/schemas/SatelliteType" },
            status: { $ref: "#/components/schemas/SatelliteStatus" },
            profile: { $ref: "#/components/schemas/SatelliteTypeProfile" },
          },
          example: exampleSatellite,
        },
        GroundStation: {
          type: "object",
          description:
            "Managed ground station resource used for routing, ownership linkage, and display in operational forms.",
          required: ["ground_station_id", "name", "type", "status"],
          properties: {
            ground_station_id: { type: "string", description: "Primary unique id for the ground station." },
            internal_ground_station_code: { ...nullableString, description: "Optional internal or legacy station code." },
            name: { type: "string", description: "Display name shown in selectors and tables." },
            type: { $ref: "#/components/schemas/GroundStationType" },
            status: { $ref: "#/components/schemas/GroundStationStatus" },
            location: { ...nullableString, description: "Optional free-form location label." },
          },
          example: exampleGroundStation,
        },
        Requestor: {
          type: "object",
          description:
            "Mission request owner linked to a ground station. Requestors are selectable during uplink creation and shown in command history.",
          required: ["requestor_id", "name", "ground_station_id"],
          properties: {
            requestor_id: { type: "string", description: "Primary unique id for the requestor." },
            name: { type: "string", description: "Display name of the request owner." },
            ground_station_id: { type: "string", description: "Linked ground station id." },
            ground_station_name: { ...nullableString, description: "Linked ground station display name when joined." },
          },
          example: exampleRequestor,
        },
        Scenario: {
          type: "object",
          required: ["scenario_id", "scenario_name", "scenario_desc", "satellite_system_ids"],
          properties: {
            scenario_id: { type: "string" },
            scenario_name: { type: "string" },
            scenario_desc: { type: "string" },
            satellite_system_ids: { type: "array", items: { type: "string" } },
          },
          example: exampleScenario,
        },
        ApiCallLogEntry: {
          type: "object",
          description:
            "Single in-memory API log entry captured by the router middleware for monitoring and troubleshooting screens.",
          required: ["time", "method", "path", "status", "summary"],
          properties: {
            time: { ...timestamp, description: "Timestamp when the request finished." },
            method: { type: "string", description: "HTTP method." },
            path: { type: "string", description: "Original request path captured by the backend." },
            status: { type: "integer", description: "HTTP status code returned by the server." },
            summary: { type: "string", description: "Compact serialized summary of the response body or asset result." },
            client_ip: { ...nullableString, description: "Requester IP address as seen by Express." },
          },
          example: exampleApiCallLog,
        },
        SattieHealthResponse: {
          type: "object",
          description:
            "Overall service health payload returned by the backend health endpoint.",
          required: ["ok", "service", "dbPath", "sqliteVersion", "counts"],
          properties: {
            ok: { type: "boolean", description: "Whether the service considers itself healthy." },
            service: { type: "string", description: "Backend service identifier." },
            dbPath: { type: "string", description: "SQLite database path used by the service." },
            sqliteVersion: { type: "string", description: "SQLite library version reported by the runtime." },
            counts: {
              type: "object",
              description: "Current resource counts in the managed datastore.",
              required: ["satellites", "groundStations", "requestors", "commands"],
              properties: {
                satellites: { type: "integer", description: "Number of managed satellite records." },
                groundStations: { type: "integer", description: "Number of managed ground stations." },
                requestors: { type: "integer", description: "Number of managed requestors." },
                commands: { type: "integer", description: "Number of command records." },
              },
            },
          },
          example: exampleHealth,
        },
        CreateSatellitePayload: {
          type: "object",
          required: ["name", "type"],
          properties: {
            satellite_id: { type: "string" },
            name: { type: "string" },
            type: { $ref: "#/components/schemas/SatelliteType" },
            status: { $ref: "#/components/schemas/SatelliteStatus" },
          },
          example: exampleCreateSatellitePayload,
        },
        CreateGroundStationPayload: {
          type: "object",
          required: ["name", "type"],
          properties: {
            ground_station_id: { type: "string" },
            name: { type: "string" },
            type: { $ref: "#/components/schemas/GroundStationType" },
            status: { $ref: "#/components/schemas/GroundStationStatus" },
            location: nullableString,
          },
          example: exampleCreateGroundStationPayload,
        },
        CreateRequestorPayload: {
          type: "object",
          required: ["name", "ground_station_id"],
          properties: {
            name: { type: "string" },
            ground_station_id: { type: "string" },
          },
          example: exampleCreateRequestorPayload,
        },
        UpdateSatellitePayload: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { $ref: "#/components/schemas/SatelliteType" },
            status: { $ref: "#/components/schemas/SatelliteStatus" },
          },
        },
        UpdateGroundStationPayload: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { $ref: "#/components/schemas/GroundStationStatus" },
            location: nullableString,
          },
        },
        UpdateRequestorPayload: {
          type: "object",
          properties: {
            name: { type: "string" },
            ground_station_id: { type: "string" },
          },
        },
        UplinkPayload: {
          type: "object",
          description:
            "Mission command creation payload. It combines mission context, AOI geometry, timing, and generation constraints.",
          required: ["satellite_id", "mission_name", "aoi_name"],
          properties: {
            satellite_id: { type: "string", description: "Target satellite id." },
            ground_station_id: { type: "string", nullable: true, description: "Optional selected ground station id." },
            requestor_id: { type: "string", nullable: true, description: "Optional request owner id." },
            mission_name: { type: "string", description: "Human-readable mission title." },
            aoi_name: { type: "string", description: "Human-readable AOI label." },
            aoi_center_lat: { type: "number", nullable: true, description: "AOI center latitude in decimal degrees." },
            aoi_center_lon: { type: "number", nullable: true, description: "AOI center longitude in decimal degrees." },
            aoi_bbox: {
              type: "array",
              nullable: true,
              description: "AOI bounding box in [minLon, minLat, maxLon, maxLat] order.",
              minItems: 4,
              maxItems: 4,
              items: { type: "number" },
            },
            window_open_utc: { type: "string", format: "date-time", nullable: true, description: "Earliest acceptable acquisition time." },
            window_close_utc: { type: "string", format: "date-time", nullable: true, description: "Latest acceptable acquisition time." },
            priority: { $ref: "#/components/schemas/TaskPriority" },
            width: { type: "integer", description: "Requested output width in pixels." },
            height: { type: "integer", description: "Requested output height in pixels." },
            cloud_percent: { type: "number", description: "Requested or expected cloud cover percentage for simulation." },
            max_cloud_cover_percent: { type: "number", nullable: true, description: "Maximum acceptable cloud cover." },
            max_off_nadir_deg: { type: "number", nullable: true, description: "Maximum off-nadir angle constraint." },
            min_sun_elevation_deg: { type: "number", nullable: true, description: "Minimum sun elevation constraint." },
            incidence_min_deg: { type: "number", nullable: true, description: "Minimum SAR incidence angle when relevant." },
            incidence_max_deg: { type: "number", nullable: true, description: "Maximum SAR incidence angle when relevant." },
            look_side: { $ref: "#/components/schemas/LookSide" },
            pass_direction: { $ref: "#/components/schemas/PassDirection" },
            polarization: { type: "string", nullable: true, description: "SAR polarization or other sensor-specific mode." },
            delivery_method: { $ref: "#/components/schemas/DeliveryMethod" },
            delivery_path: { type: "string", nullable: true, description: "Optional destination path for non-download delivery methods." },
            generation_mode: { $ref: "#/components/schemas/GenerationMode" },
            external_map_source: { $ref: "#/components/schemas/ExternalMapSource" },
            external_map_zoom: { type: "integer", description: "Map zoom level used for EXTERNAL generation mode." },
            fail_probability: { type: "number", description: "Simulation failure probability used by the runtime." },
          },
          example: exampleUplinkPayload,
        },
        UplinkResponse: {
          type: "object",
          description:
            "Immediate acknowledgement payload returned when a new uplink command is created.",
          required: [
            "command_id",
            "state",
            "satellite_id",
            "satellite_type",
            "mission_name",
            "aoi_name",
            "created_at",
          ],
          properties: {
            command_id: { type: "string" },
            state: { $ref: "#/components/schemas/CommandState" },
            satellite_id: { type: "string" },
            satellite_type: { $ref: "#/components/schemas/SatelliteType" },
            ground_station_id: { type: "string", nullable: true },
            ground_station_name: nullableString,
            ground_station_type: {
              allOf: [{ $ref: "#/components/schemas/GroundStationType" }],
              nullable: true,
            },
            requestor_id: { type: "string", nullable: true },
            requestor_name: nullableString,
            mission_name: { type: "string" },
            aoi_name: { type: "string" },
            created_at: timestamp,
          },
          example: exampleUplinkResponse,
        },
        CommandStatus: {
          type: "object",
          description:
            "Full command record used by the tracking UI. It contains mission context, current state, archived output, and metadata produced during execution.",
          required: [
            "command_id",
            "satellite_id",
            "satellite_type",
            "mission_name",
            "aoi_name",
            "width",
            "height",
            "cloud_percent",
            "fail_probability",
            "state",
            "created_at",
            "updated_at",
            "request_profile",
          ],
          properties: {
            command_id: { type: "string", description: "Primary unique command identifier." },
            satellite_id: { type: "string", description: "Satellite targeted by the command." },
            satellite_type: { $ref: "#/components/schemas/SatelliteType" },
            ground_station_id: { type: "string", nullable: true, description: "Linked ground station id." },
            ground_station_name: { ...nullableString, description: "Linked ground station display name." },
            ground_station_type: {
              allOf: [{ $ref: "#/components/schemas/GroundStationType" }],
              nullable: true,
              description: "Linked ground station type when joined.",
            },
            requestor_id: { type: "string", nullable: true, description: "Linked requestor id." },
            requestor_name: { ...nullableString, description: "Linked requestor display name." },
            mission_name: { type: "string", description: "Mission title captured at command creation time." },
            aoi_name: { type: "string", description: "AOI label captured at command creation time." },
            width: { type: "integer", description: "Requested output width." },
            height: { type: "integer", description: "Requested output height." },
            cloud_percent: { type: "number", description: "Cloud value stored with the request profile." },
            fail_probability: { type: "number", description: "Failure probability used by the simulator." },
            state: { $ref: "#/components/schemas/CommandState" },
            message: { ...nullableString, description: "Latest runtime message associated with the command." },
            created_at: { ...timestamp, description: "Creation timestamp." },
            updated_at: { ...timestamp, description: "Last mutation timestamp." },
            archived_image_path: { ...nullableString, description: "Absolute or service-side archive path to the generated image." },
            archived_image_relative_path: { ...nullableString, description: "Relative archive path used for UI display." },
            download_url: { ...nullableString, description: "Download endpoint for the archived image when ready." },
            request_profile: { type: "object", additionalProperties: true, description: "Normalized request payload stored with the command." },
            acquisition_metadata: { type: "object", nullable: true, additionalProperties: true, description: "Runtime-generated acquisition metadata." },
            product_metadata: { type: "object", nullable: true, additionalProperties: true, description: "Runtime-generated product or file metadata." },
          },
          example: exampleCommandStatus,
        },
        OrbitBackdropPoint: {
          type: "object",
          required: ["norad", "name", "latitude", "longitude", "altitude_km"],
          properties: {
            norad: { type: "string" },
            name: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            altitude_km: { type: "number" },
            source_date: nullableString,
            source_state: nullableString,
          },
        },
        OrbitTrackLeoBackdropResponse: {
          type: "object",
          required: [
            "source",
            "generated_at",
            "total_count",
            "rendered_count",
            "points",
          ],
          properties: {
            source: { type: "string" },
            updated_at: nullableString,
            fetched_at: nullableString,
            generated_at: timestamp,
            total_count: { type: "integer" },
            rendered_count: { type: "integer" },
            points: {
              type: "array",
              items: { $ref: "#/components/schemas/OrbitBackdropPoint" },
            },
          },
          example: exampleLeoBackdropResponse,
        },
        OrbitTrackLivePoint: {
          type: "object",
          required: ["latitude", "longitude", "altitudeKm"],
          properties: {
            latitude: { type: "number" },
            longitude: { type: "number" },
            altitudeKm: { type: "number" },
          },
        },
        OrbitTrackLiveEntry: {
          type: "object",
          required: ["norad", "period_minutes", "current", "track"],
          properties: {
            norad: { type: "string" },
            english_name: nullableString,
            domestic_name: nullableString,
            orbit_class: nullableString,
            orbit_label: nullableString,
            source_date: nullableString,
            source_label: nullableString,
            fetched_at: nullableString,
            period_minutes: { type: "number" },
            current: { $ref: "#/components/schemas/OrbitTrackLivePoint" },
            track: {
              type: "array",
              items: { $ref: "#/components/schemas/OrbitTrackLivePoint" },
            },
          },
        },
        OrbitTrackKoreanLiveResponse: {
          type: "object",
          required: ["source", "generated_at", "count", "entries"],
          properties: {
            source: { type: "string" },
            updated_at: nullableString,
            generated_at: timestamp,
            count: { type: "integer" },
            entries: {
              type: "array",
              items: { $ref: "#/components/schemas/OrbitTrackLiveEntry" },
            },
          },
          example: exampleKoreanLiveResponse,
        },
      },
    },
  };
}
