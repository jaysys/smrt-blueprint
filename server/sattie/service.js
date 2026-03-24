import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SCENARIO_BASELINES, SATELLITE_TYPE_PROFILES } from "./catalog.js";
import { all, get, run, sattieDbPath } from "./db.js";
import {
  appendImageMetadataFooter,
  buildImageFilePath,
  clearGeneratedImages,
  deriveExternalCenter,
  fileExists,
  renderExternalMapPng,
  renderExternalMapPreviewPng,
  writeExternalMapImage,
  writeOpticalImage,
  writeSarImage,
} from "./image.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const pipelineTimers = new Map();

function nowIso() {
  return new Date().toISOString();
}

function getRequestProfileCenter(requestProfile) {
  if (requestProfile?.aoi_center?.lat != null && requestProfile?.aoi_center?.lon != null) {
    return {
      lat: Number(requestProfile.aoi_center.lat),
      lon: Number(requestProfile.aoi_center.lon),
    };
  }

  const bbox = Array.isArray(requestProfile?.aoi_bbox) ? requestProfile.aoi_bbox : null;
  if (bbox?.length === 4) {
    const [minLon, minLat, maxLon, maxLat] = bbox.map((value) => Number(value));
    return {
      lat: (minLat + maxLat) / 2,
      lon: (minLon + maxLon) / 2,
    };
  }

  return null;
}

function formatLatLon(center) {
  if (!center) {
    return null;
  }
  return `${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}`;
}

function normalizeName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function makeId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function parseJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function mapSatellite(row) {
  return {
    satellite_id: row.satellite_id,
    internal_satellite_code: row.internal_satellite_code,
    name: row.name,
    eng_model: row.eng_model,
    domain: row.domain,
    resolution_perf: row.resolution_perf,
    baseline_status: row.baseline_status,
    primary_mission: row.primary_mission,
    tracker_name: row.tracker_name,
    tracker_domestic_name: row.tracker_domestic_name,
    norad_cat_id: row.norad_cat_id,
    object_type: row.object_type,
    object_id: row.object_id,
    tracker_current: row.tracker_current,
    launch_date: row.launch_date,
    launch_site: row.launch_site,
    period_minutes: row.period_minutes,
    inclination_deg: row.inclination_deg,
    apogee_km: row.apogee_km,
    perigee_km: row.perigee_km,
    orbit_class: row.orbit_class,
    orbit_label: row.orbit_label,
    orbital_slot: row.orbital_slot,
    tracker_source: row.tracker_source,
    type: row.type,
    status: row.status,
    profile: SATELLITE_TYPE_PROFILES[row.type],
  };
}

function mapGroundStation(row) {
  return {
    ground_station_id: row.ground_station_id,
    internal_ground_station_code: row.internal_ground_station_code,
    name: row.name,
    type: row.type,
    status: row.status,
    location: row.location,
  };
}

function mapRequestor(row) {
  return {
    requestor_id: row.requestor_id,
    name: row.name,
    ground_station_id: row.ground_station_id,
    ground_station_name: row.ground_station_name,
  };
}

function mapCommand(row, satelliteType) {
  const requestProfile = parseJson(row.request_profile_json, {});
  const acquisitionMetadata = parseJson(row.acquisition_metadata_json, null);
  const productMetadata = parseJson(row.product_metadata_json, null);
  const downloadReady = row.state === "DOWNLINK_READY" && fileExists(resolveImagePath(row.image_path));
  const archivedImagePath = resolveImagePath(row.image_path);
  const archivedImageRelativePath = archivedImagePath
    ? path.relative(process.cwd(), archivedImagePath).replace(/\\/g, "/")
    : null;

  return {
    command_id: row.command_id,
    satellite_id: row.satellite_id,
    satellite_type: satelliteType,
    ground_station_id: requestProfile?.ground_station?.ground_station_id ?? null,
    ground_station_name: requestProfile?.ground_station?.name ?? null,
    ground_station_type: requestProfile?.ground_station?.type ?? null,
    requestor_id: requestProfile?.requestor?.requestor_id ?? null,
    requestor_name: requestProfile?.requestor?.name ?? null,
    mission_name: row.mission_name,
    aoi_name: row.aoi_name,
    width: row.width,
    height: row.height,
    cloud_percent: row.cloud_percent,
    fail_probability: row.fail_probability,
    state: downloadReady ? row.state : row.state === "DOWNLINK_READY" ? "FAILED" : row.state,
    message:
      row.state === "DOWNLINK_READY" && !downloadReady
        ? "Downlink image file missing. Retry is required."
        : row.message,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_image_path: archivedImagePath,
    archived_image_relative_path: archivedImageRelativePath,
    download_url: downloadReady ? `/api/sattie/downloads/${row.command_id}` : null,
    request_profile: requestProfile,
    acquisition_metadata: acquisitionMetadata,
    product_metadata: productMetadata,
  };
}

function resolveImagePath(imagePath) {
  if (!imagePath) {
    return null;
  }
  return path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath);
}

async function getSatelliteRow(db, satelliteId) {
  return get(
    db,
    `SELECT *
     FROM sattie_satellites
     WHERE satellite_id = ?`,
    [satelliteId],
  );
}

async function getGroundStationRow(db, groundStationId) {
  return get(
    db,
    `SELECT *
     FROM sattie_ground_stations
     WHERE ground_station_id = ?`,
    [groundStationId],
  );
}

async function getRequestorRow(db, requestorId) {
  return get(
    db,
    `SELECT
      r.requestor_id,
      r.name,
      g.internal_ground_station_code,
      g.ground_station_id,
      g.name AS ground_station_name
     FROM sattie_requestors r
     JOIN sattie_ground_stations g
       ON g.internal_ground_station_code = r.internal_ground_station_code
     WHERE r.requestor_id = ?`,
    [requestorId],
  );
}

async function getCommandRow(db, commandId) {
  return get(
    db,
    `SELECT *
     FROM sattie_commands
     WHERE command_id = ?`,
    [commandId],
  );
}

async function normalizeCommandFileState(db, commandRow) {
  if (!commandRow || commandRow.state !== "DOWNLINK_READY" || fileExists(resolveImagePath(commandRow.image_path))) {
    return commandRow;
  }

  const updatedAt = nowIso();
  await run(
    db,
    `UPDATE sattie_commands
     SET state = ?, message = ?, image_path = NULL, updated_at = ?
     WHERE command_id = ?`,
    ["FAILED", "Downlink image file missing. Retry is required.", updatedAt, commandRow.command_id],
  );

  return getCommandRow(db, commandRow.command_id);
}

function buildAcquisitionMetadata(satellite, command) {
  const requestProfile = parseJson(command.request_profile_json, {});
  if (satellite.type === "EO_OPTICAL") {
    return {
      captured_at: nowIso(),
      sensor_mode: "NADIR",
      off_nadir_deg: 12.5,
      sun_elevation_deg: 31.2,
      cloud_cover_percent: command.cloud_percent,
      ground_track: "ASCENDING",
      aoi_name: command.aoi_name,
      aoi_center: requestProfile.aoi_center ?? null,
      aoi_bbox: requestProfile.aoi_bbox ?? null,
      generation_mode: requestProfile.generation?.mode ?? "INTERNAL",
    };
  }

  return {
    captured_at: nowIso(),
    sensor_mode: "STRIPMAP",
    incidence_angle_deg: 27.5,
    look_side: requestProfile.sar_constraints?.look_side ?? "ANY",
    pass_direction: requestProfile.sar_constraints?.pass_direction ?? "ANY",
    polarization: requestProfile.sar_constraints?.polarization ?? "VV",
    aoi_name: command.aoi_name,
    aoi_center: requestProfile.aoi_center ?? null,
    aoi_bbox: requestProfile.aoi_bbox ?? null,
    generation_mode: requestProfile.generation?.mode ?? "INTERNAL",
  };
}

function buildProductMetadata(satellite, command) {
  const requestProfile = parseJson(command.request_profile_json, {});
  if (satellite.type === "EO_OPTICAL") {
    return {
      product_type: SATELLITE_TYPE_PROFILES.EO_OPTICAL.default_product_type,
      bands: SATELLITE_TYPE_PROFILES.EO_OPTICAL.default_bands_or_polarization,
      gsd_m: 0.8,
      width_px: command.width,
      height_px: command.height,
      bit_depth: 8,
      format: "PNG",
      image_source: requestProfile.generation ?? {},
    };
  }

  return {
    product_type: SATELLITE_TYPE_PROFILES.SAR.default_product_type,
    resolution_m: 1.2,
    width_px: command.width,
    height_px: command.height,
    format: "PNG",
    speckle_filter: "NONE",
    image_source: requestProfile.generation ?? {},
  };
}

function getExternalMapGenerationOptions(commandRow) {
  const requestProfile = parseJson(commandRow.request_profile_json, {});
  const generation = requestProfile?.generation ?? {};
  const center = deriveExternalCenter(requestProfile);

  return {
    centerLat: center.lat,
    centerLon: center.lon,
    zoom: clampInt(generation.external_map_zoom, 0, 19, 14),
    width: commandRow.width,
    height: commandRow.height,
    mapSource: generation.external_map_source === "OSM" ? "OSM" : "OSM",
  };
}

async function setCommandState(db, commandId, state, message, extra = {}) {
  const updatedAt = nowIso();
  await run(
    db,
    `UPDATE sattie_commands
     SET state = ?, message = ?, image_path = COALESCE(?, image_path),
         acquisition_metadata_json = COALESCE(?, acquisition_metadata_json),
         product_metadata_json = COALESCE(?, product_metadata_json),
         updated_at = ?
     WHERE command_id = ?`,
    [
      state,
      message,
      Object.hasOwn(extra, "imagePath") ? extra.imagePath : null,
      Object.hasOwn(extra, "acquisitionMetadataJson") ? extra.acquisitionMetadataJson : null,
      Object.hasOwn(extra, "productMetadataJson") ? extra.productMetadataJson : null,
      updatedAt,
      commandId,
    ],
  );
}

function scheduleStep(db, commandId, delayMs, stepFn) {
  const timer = setTimeout(async () => {
    try {
      await stepFn();
    } catch (error) {
      console.error(`Sattie pipeline step failed for ${commandId}`, error);
      try {
        await setCommandState(
          db,
          commandId,
          "FAILED",
          `Post-capture pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } catch (setStateError) {
        console.error(`Failed to persist FAILED state for ${commandId}`, setStateError);
      }
    } finally {
      if (pipelineTimers.get(commandId) === timer) {
        pipelineTimers.delete(commandId);
      }
    }
  }, delayMs);
  pipelineTimers.set(commandId, timer);
}

async function runCommandPipeline(db, commandId) {
  const command = await getCommandRow(db, commandId);
  if (!command) {
    return;
  }

  const satellite = await getSatelliteRow(db, command.satellite_id);
  if (!satellite) {
    await setCommandState(db, commandId, "FAILED", "Satellite not found");
    return;
  }

  if (satellite.status !== "AVAILABLE") {
    await setCommandState(db, commandId, "FAILED", "Satellite is not available");
    return;
  }

  await setCommandState(db, commandId, "QUEUED", "Queued for next contact window");

  scheduleStep(db, commandId, 500, async () => {
    await setCommandState(db, commandId, "ACKED", "Uplink ACK received from satellite");

    scheduleStep(db, commandId, 450, async () => {
      const acked = await getCommandRow(db, commandId);
      if (!acked) {
        return;
      }

      if (Math.random() < acked.fail_probability * 0.6) {
        await setCommandState(db, commandId, "FAILED", "Uplink transmission failed");
        return;
      }

      await setCommandState(db, commandId, "ACCESSING_AOI", "Satellite is accessing the target AOI");

      scheduleStep(db, commandId, 3000 + Math.floor(Math.random() * 3001), async () => {
        const accessing = await getCommandRow(db, commandId);
        if (!accessing) {
          return;
        }

        if (Math.random() < accessing.fail_probability * 0.2) {
          await setCommandState(db, commandId, "FAILED", "AOI access window expired before capture");
          return;
        }

        await setCommandState(db, commandId, "CAPTURING", "Satellite is capturing image");

        scheduleStep(db, commandId, 900, async () => {
          const capturing = await getCommandRow(db, commandId);
          if (!capturing) {
            return;
          }

          if (Math.random() < capturing.fail_probability * 0.4) {
            await setCommandState(db, commandId, "FAILED", "Capture aborted due to onboard condition");
            return;
          }

          const activeSatellite = await getSatelliteRow(db, capturing.satellite_id);
          if (!activeSatellite) {
            await setCommandState(db, commandId, "FAILED", "Satellite not found");
            return;
          }

          const imagePath = buildImageFilePath(commandId);
          const imageCreatedAt = nowIso();
          const requestProfile = parseJson(capturing.request_profile_json, {});
          const generationMode = requestProfile?.generation?.mode ?? "INTERNAL";
          if (generationMode === "EXTERNAL") {
            await writeExternalMapImage(imagePath, getExternalMapGenerationOptions(capturing));
          } else if (activeSatellite.type === "SAR") {
            writeSarImage(imagePath, capturing.width, capturing.height);
          } else {
            writeOpticalImage(imagePath, capturing.width, capturing.height);
          }
          const footerCenter = getRequestProfileCenter(requestProfile);
          await appendImageMetadataFooter(imagePath, {
            satellite: activeSatellite.name || activeSatellite.satellite_id,
            missionName: capturing.mission_name,
            aoiName: capturing.aoi_name,
            latLon: formatLatLon(footerCenter),
            imageCreatedAt,
            groundStation: requestProfile?.ground_station?.name ?? null,
            requestor: requestProfile?.requestor?.name ?? null,
          });

          const acquisitionMetadata = buildAcquisitionMetadata(activeSatellite, capturing);
          const productMetadata = buildProductMetadata(activeSatellite, capturing);
          await setCommandState(
            db,
            commandId,
            "DOWNLINK_READY",
            `Image archived to ${imagePath} and ready for download access`,
            {
            imagePath,
            acquisitionMetadataJson: JSON.stringify(acquisitionMetadata),
            productMetadataJson: JSON.stringify(productMetadata),
            },
          );
        });
      });
    });
  });
}

async function normalizeInFlightCommands(db) {
  await run(
    db,
    `UPDATE sattie_commands
     SET state = ?, message = ?, updated_at = ?
     WHERE state IN ('QUEUED', 'ACKED', 'ACCESSING_AOI', 'CAPTURING')`,
    ["FAILED", "Server restarted during processing. Retry is required.", nowIso()],
  );
}

export async function initializeSattieRuntime(db) {
  await normalizeInFlightCommands(db);
}

export async function getSattieHealth(db) {
  const versionRow = await get(db, "SELECT sqlite_version() AS sqlite_version");
  const countsRow = await get(
    db,
    `SELECT
      (SELECT COUNT(*) FROM sattie_satellites) AS satellites_count,
      (SELECT COUNT(*) FROM sattie_ground_stations) AS ground_stations_count,
      (SELECT COUNT(*) FROM sattie_requestors) AS requestors_count,
      (SELECT COUNT(*) FROM sattie_commands) AS commands_count`,
  );

  return {
    ok: true,
    service: "sattie",
    dbPath: sattieDbPath,
    sqliteVersion: String(versionRow?.sqlite_version ?? "unknown"),
    counts: {
      satellites: Number(countsRow?.satellites_count ?? 0),
      groundStations: Number(countsRow?.ground_stations_count ?? 0),
      requestors: Number(countsRow?.requestors_count ?? 0),
      commands: Number(countsRow?.commands_count ?? 0),
    },
  };
}

export async function listSatelliteTypes() {
  return SATELLITE_TYPE_PROFILES;
}

export async function listScenarios() {
  return SCENARIO_BASELINES;
}

export async function listSatellites(db) {
  const rows = await all(db, `SELECT * FROM sattie_satellites ORDER BY name`);
  return rows.map(mapSatellite);
}

export async function createSatellite(db, payload) {
  const name = String(payload?.name ?? "").trim();
  const type = String(payload?.type ?? "");
  const status = String(payload?.status ?? "AVAILABLE");
  const publicId = String(payload?.satellite_id ?? "").trim() || `USR-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  if (!name || !["EO_OPTICAL", "SAR"].includes(type)) {
    throw new HttpError(400, "Invalid satellite payload");
  }

  const existingById = await get(db, `SELECT 1 FROM sattie_satellites WHERE satellite_id = ?`, [publicId]);
  if (existingById) {
    throw new HttpError(409, "Satellite system_id already exists");
  }

  const existingByName = await get(db, `SELECT 1 FROM sattie_satellites WHERE lower(name) = ?`, [normalizeName(name)]);
  if (existingByName) {
    throw new HttpError(409, "Satellite name already exists");
  }

  await run(
    db,
    `INSERT INTO sattie_satellites (
      internal_satellite_code, satellite_id, name, type, status,
      eng_model, domain, resolution_perf, baseline_status, primary_mission,
      tracker_name, tracker_domestic_name, norad_cat_id, object_id, launch_date,
      orbit_class, orbit_label, orbital_slot, tracker_source,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      makeId("sat"),
      publicId,
      name,
      type,
      status,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      nowIso(),
      nowIso(),
    ],
  );

  return { satellite_id: publicId };
}

export async function updateSatellite(db, satelliteId, payload) {
  const row = await getSatelliteRow(db, satelliteId);
  if (!row) {
    throw new HttpError(404, "Satellite not found");
  }

  const nextName = payload?.name != null ? String(payload.name).trim() : row.name;
  const nextType = payload?.type != null ? String(payload.type) : row.type;
  const nextStatus = payload?.status != null ? String(payload.status) : row.status;

  if (!nextName || !["EO_OPTICAL", "SAR"].includes(nextType)) {
    throw new HttpError(400, "Invalid satellite payload");
  }

  const duplicate = await get(
    db,
    `SELECT 1 FROM sattie_satellites WHERE lower(name) = ? AND satellite_id != ?`,
    [normalizeName(nextName), satelliteId],
  );
  if (duplicate) {
    throw new HttpError(409, "Satellite name already exists");
  }

  await run(
    db,
    `UPDATE sattie_satellites
     SET name = ?, type = ?, status = ?, updated_at = ?
     WHERE satellite_id = ?`,
    [nextName, nextType, nextStatus, nowIso(), satelliteId],
  );

  return mapSatellite(await getSatelliteRow(db, satelliteId));
}

export async function deleteSatellite(db, satelliteId) {
  const row = await getSatelliteRow(db, satelliteId);
  if (!row) {
    throw new HttpError(404, "Satellite not found");
  }
  await run(db, `DELETE FROM sattie_satellites WHERE satellite_id = ?`, [satelliteId]);
  return { deleted_satellite_id: satelliteId, deleted_name: row.name };
}

export async function listGroundStations(db) {
  const rows = await all(db, `SELECT * FROM sattie_ground_stations ORDER BY name`);
  return rows.map(mapGroundStation);
}

export async function createGroundStation(db, payload) {
  const name = String(payload?.name ?? "").trim();
  const type = String(payload?.type ?? "");
  const status = String(payload?.status ?? "OPERATIONAL");
  const location = payload?.location != null ? String(payload.location).trim() || null : null;
  const groundStationId = String(payload?.ground_station_id ?? "").trim() || `GND-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

  if (!name || !["FIXED", "LAND_MOBILE", "MARITIME", "AIRBORNE"].includes(type)) {
    throw new HttpError(400, "Invalid ground station payload");
  }

  const duplicateId = await get(
    db,
    `SELECT 1 FROM sattie_ground_stations WHERE ground_station_id = ?`,
    [groundStationId],
  );
  if (duplicateId) {
    throw new HttpError(409, "Ground station id already exists");
  }

  const duplicateName = await get(
    db,
    `SELECT 1 FROM sattie_ground_stations WHERE lower(name) = ?`,
    [normalizeName(name)],
  );
  if (duplicateName) {
    throw new HttpError(409, "Ground station name already exists");
  }

  await run(
    db,
    `INSERT INTO sattie_ground_stations (
      internal_ground_station_code, ground_station_id, name, type, status, location, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [makeId("gnd"), groundStationId, name, type, status, location, nowIso(), nowIso()],
  );

  return { ground_station_id: groundStationId };
}

export async function updateGroundStation(db, groundStationId, payload) {
  const row = await getGroundStationRow(db, groundStationId);
  if (!row) {
    throw new HttpError(404, "Ground station not found");
  }

  const nextName = payload?.name != null ? String(payload.name).trim() : row.name;
  const nextStatus = payload?.status != null ? String(payload.status) : row.status;
  const nextLocation = payload?.location != null ? String(payload.location).trim() || null : row.location;

  const duplicate = await get(
    db,
    `SELECT 1 FROM sattie_ground_stations WHERE lower(name) = ? AND ground_station_id != ?`,
    [normalizeName(nextName), groundStationId],
  );
  if (duplicate) {
    throw new HttpError(409, "Ground station name already exists");
  }

  await run(
    db,
    `UPDATE sattie_ground_stations
     SET name = ?, status = ?, location = ?, updated_at = ?
     WHERE ground_station_id = ?`,
    [nextName, nextStatus, nextLocation, nowIso(), groundStationId],
  );

  return mapGroundStation(await getGroundStationRow(db, groundStationId));
}

export async function deleteGroundStation(db, groundStationId) {
  const row = await getGroundStationRow(db, groundStationId);
  if (!row) {
    throw new HttpError(404, "Ground station not found");
  }

  await run(db, `DELETE FROM sattie_ground_stations WHERE ground_station_id = ?`, [groundStationId]);
  return { deleted_ground_station_id: groundStationId, deleted_name: row.name };
}

export async function listRequestors(db, groundStationId) {
  const rows = await all(
    db,
    `SELECT
      r.requestor_id,
      r.name,
      g.ground_station_id,
      g.name AS ground_station_name
     FROM sattie_requestors r
     JOIN sattie_ground_stations g
       ON g.internal_ground_station_code = r.internal_ground_station_code
     ${groundStationId ? "WHERE g.ground_station_id = ?" : ""}
     ORDER BY r.name`,
    groundStationId ? [groundStationId] : [],
  );
  return rows.map(mapRequestor);
}

export async function createRequestor(db, payload) {
  const name = String(payload?.name ?? "").trim();
  const groundStationId = String(payload?.ground_station_id ?? "").trim();

  if (!name || !groundStationId) {
    throw new HttpError(400, "Invalid requestor payload");
  }

  const station = await getGroundStationRow(db, groundStationId);
  if (!station) {
    throw new HttpError(404, "Ground station not found");
  }

  const requestorId = makeId("req");
  await run(
    db,
    `INSERT INTO sattie_requestors (
      requestor_id, name, internal_ground_station_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)`,
    [requestorId, name, station.internal_ground_station_code, nowIso(), nowIso()],
  );

  return { requestor_id: requestorId };
}

export async function updateRequestor(db, requestorId, payload) {
  const row = await getRequestorRow(db, requestorId);
  if (!row) {
    throw new HttpError(404, "Requestor not found");
  }

  const nextName = payload?.name != null ? String(payload.name).trim() : row.name;
  let internalGroundStationCode = row.internal_ground_station_code;

  if (payload?.ground_station_id != null) {
    const station = await getGroundStationRow(db, String(payload.ground_station_id));
    if (!station) {
      throw new HttpError(404, "Ground station not found");
    }
    internalGroundStationCode = station.internal_ground_station_code;
  }

  await run(
    db,
    `UPDATE sattie_requestors
     SET name = ?, internal_ground_station_code = ?, updated_at = ?
     WHERE requestor_id = ?`,
    [nextName, internalGroundStationCode, nowIso(), requestorId],
  );

  return (await listRequestors(db)).find((item) => item.requestor_id === requestorId);
}

export async function deleteRequestor(db, requestorId) {
  const row = await getRequestorRow(db, requestorId);
  if (!row) {
    throw new HttpError(404, "Requestor not found");
  }

  await run(db, `DELETE FROM sattie_requestors WHERE requestor_id = ?`, [requestorId]);
  return { deleted_requestor_id: requestorId, deleted_name: row.name };
}

export async function createUplink(db, payload) {
  const satelliteId = String(payload?.satellite_id ?? "").trim();
  const missionName = String(payload?.mission_name ?? "").trim();
  const aoiName = String(payload?.aoi_name ?? "unknown-aoi").trim();

  if (!satelliteId || !missionName) {
    throw new HttpError(400, "Invalid uplink payload");
  }

  const satellite = await getSatelliteRow(db, satelliteId);
  if (!satellite) {
    throw new HttpError(404, "Satellite not found");
  }

  let groundStation = null;
  if (payload?.ground_station_id) {
    groundStation = await getGroundStationRow(db, String(payload.ground_station_id));
    if (!groundStation) {
      throw new HttpError(404, "Ground station not found");
    }
    if (groundStation.status !== "OPERATIONAL") {
      throw new HttpError(409, "Ground station is not operational");
    }
  }

  let requestor = null;
  if (payload?.requestor_id) {
    requestor = await getRequestorRow(db, String(payload.requestor_id));
    if (!requestor) {
      throw new HttpError(404, "Requestor not found");
    }
    if (!groundStation || requestor.ground_station_id !== groundStation.ground_station_id) {
      throw new HttpError(409, "Requestor does not belong to selected ground station");
    }
  }

  const width = clampInt(payload?.width, 128, 4096, 1024);
  const height = clampInt(payload?.height, 128, 4096, 1024);
  const cloudPercent = clampInt(payload?.cloud_percent, 0, 100, 20);
  const failProbability = clampNumber(payload?.fail_probability, 0, 1, 0.05);
  const generationMode = ["INTERNAL", "EXTERNAL"].includes(String(payload?.generation_mode))
    ? String(payload.generation_mode)
    : "INTERNAL";

  const commandId = `cmd-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const requestProfile = {
    ground_station: groundStation
      ? {
          ground_station_id: groundStation.ground_station_id,
          name: groundStation.name,
          type: groundStation.type,
          status: groundStation.status,
          location: groundStation.location,
        }
      : null,
    requestor: requestor
      ? {
          requestor_id: requestor.requestor_id,
          name: requestor.name,
          ground_station_id: requestor.ground_station_id,
        }
      : null,
    aoi_center:
      payload?.aoi_center_lat != null && payload?.aoi_center_lon != null
        ? {
            lat: Number(payload.aoi_center_lat),
            lon: Number(payload.aoi_center_lon),
          }
        : null,
    aoi_bbox: Array.isArray(payload?.aoi_bbox) ? payload.aoi_bbox : null,
    window_open_utc: payload?.window_open_utc ?? null,
    window_close_utc: payload?.window_close_utc ?? null,
    priority: payload?.priority ?? "COMMERCIAL",
    eo_constraints: {
      max_cloud_cover_percent: payload?.max_cloud_cover_percent ?? null,
      max_off_nadir_deg: payload?.max_off_nadir_deg ?? null,
      min_sun_elevation_deg: payload?.min_sun_elevation_deg ?? null,
    },
    sar_constraints: {
      incidence_min_deg: payload?.incidence_min_deg ?? null,
      incidence_max_deg: payload?.incidence_max_deg ?? null,
      look_side: payload?.look_side ?? "ANY",
      pass_direction: payload?.pass_direction ?? "ANY",
      polarization: payload?.polarization ?? null,
    },
    delivery: {
      method: payload?.delivery_method ?? "DOWNLOAD",
      path: payload?.delivery_path ?? null,
    },
    generation: {
      mode: generationMode,
      external_map_source: payload?.external_map_source ?? "OSM",
      external_map_zoom: clampInt(payload?.external_map_zoom, 0, 19, 14),
    },
  };

  await run(
    db,
    `INSERT INTO sattie_commands (
      command_id, satellite_id, mission_name, aoi_name, width, height,
      cloud_percent, fail_probability, state, message, image_path,
      request_profile_json, acquisition_metadata_json, product_metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      commandId,
      satelliteId,
      missionName,
      aoiName,
      width,
      height,
      cloudPercent,
      failProbability,
      "QUEUED",
      "Queued for next contact window",
      null,
      JSON.stringify(requestProfile),
      null,
      null,
      nowIso(),
      nowIso(),
    ],
  );

  void runCommandPipeline(db, commandId);

  return {
    command_id: commandId,
    state: "QUEUED",
    satellite_id: satelliteId,
    satellite_type: satellite.type,
    ground_station_id: groundStation?.ground_station_id ?? null,
    ground_station_name: groundStation?.name ?? null,
    ground_station_type: groundStation?.type ?? null,
    requestor_id: requestor?.requestor_id ?? null,
    requestor_name: requestor?.name ?? null,
    mission_name: missionName,
    aoi_name: aoiName,
    created_at: nowIso(),
  };
}

export async function listCommands(db) {
  const rows = await all(
    db,
    `SELECT c.*, s.type AS satellite_type
     FROM sattie_commands c
     JOIN sattie_satellites s
       ON s.satellite_id = c.satellite_id
     ORDER BY c.created_at DESC`,
  );

  const normalized = [];
  for (const row of rows) {
    const nextRow = await normalizeCommandFileState(db, row);
    normalized.push(mapCommand(nextRow, row.satellite_type));
  }
  return normalized;
}

export async function getCommand(db, commandId) {
  const row = await get(
    db,
    `SELECT c.*, s.type AS satellite_type
     FROM sattie_commands c
     JOIN sattie_satellites s
       ON s.satellite_id = c.satellite_id
     WHERE c.command_id = ?`,
    [commandId],
  );
  if (!row) {
    throw new HttpError(404, "Command not found");
  }
  const nextRow = await normalizeCommandFileState(db, row);
  return mapCommand(nextRow, row.satellite_type);
}

export async function rerunCommand(db, commandId) {
  const current = await getCommand(db, commandId);
  if (["QUEUED", "ACKED", "ACCESSING_AOI", "CAPTURING"].includes(current.state)) {
    throw new HttpError(409, "Command is already in progress");
  }
  if (current.state !== "FAILED") {
    throw new HttpError(409, "Only FAILED commands can be rerun");
  }

  const generation = current.request_profile?.generation ?? {};
  current.request_profile.generation = {
    mode: ["INTERNAL", "EXTERNAL"].includes(generation.mode) ? generation.mode : "INTERNAL",
    external_map_source: generation.external_map_source === "OSM" ? "OSM" : "OSM",
    external_map_zoom: clampInt(generation.external_map_zoom, 0, 19, 14),
  };

  await run(
    db,
    `UPDATE sattie_commands
     SET state = ?, message = ?, image_path = NULL,
         acquisition_metadata_json = NULL, product_metadata_json = NULL,
         request_profile_json = ?, updated_at = ?
     WHERE command_id = ?`,
    [
      "QUEUED",
      "Re-run requested by operator",
      JSON.stringify(current.request_profile),
      nowIso(),
      commandId,
    ],
  );

  void runCommandPipeline(db, commandId);
  return getCommand(db, commandId);
}

export async function getDownloadInfo(db, commandId) {
  const command = await getCommand(db, commandId);
  if (command.state !== "DOWNLINK_READY") {
    throw new HttpError(409, "Image is not ready");
  }

  const row = await getCommandRow(db, commandId);
  const imagePath = resolveImagePath(row?.image_path);
  if (!fileExists(imagePath)) {
    throw new HttpError(404, "Image file not found");
  }

  return {
    filePath: imagePath,
    fileName: `${commandId}.png`,
    command,
  };
}

export async function saveLocalDownload(db, commandId) {
  const { filePath } = await getDownloadInfo(db, commandId);
  const stats = fs.statSync(filePath);
  return {
    command_id: commandId,
    saved_path: filePath,
    file_size_bytes: stats.size,
    message: "Image is saved in local data/images directory",
  };
}

export async function clearImages(db) {
  const deletedCount = clearGeneratedImages();
  await run(
    db,
    `UPDATE sattie_commands
     SET image_path = NULL,
         state = CASE WHEN state = 'DOWNLINK_READY' THEN 'FAILED' ELSE state END,
         message = CASE
           WHEN state = 'DOWNLINK_READY' THEN 'Image cleared by operator. Retry is required.'
           ELSE 'Image cleared by operator'
         END,
         updated_at = ?`,
    [nowIso()],
  );

  const affectedRow = await get(
    db,
    `SELECT COUNT(*) AS affected_count
     FROM sattie_commands
     WHERE message IN ('Image cleared by operator. Retry is required.', 'Image cleared by operator')`,
  );

  return {
    deleted_count: deletedCount,
    cleared_command_count: Number(affectedRow?.affected_count ?? 0),
    message: "All generated sample images were cleared",
  };
}

export async function previewExternalMap(query) {
  const lat = Number(query?.lat);
  const lon = Number(query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpError(400, "Preview requires valid lat/lon query values");
  }

  try {
    return renderExternalMapPreviewPng({
      centerLat: Math.max(-90, Math.min(90, lat)),
      centerLon: Math.max(-180, Math.min(180, lon)),
      zoom: clampInt(query?.zoom, 0, 19, 14),
      width: clampInt(query?.width, 128, 4096, 768),
      height: clampInt(query?.height, 128, 4096, 768),
      mapSource: query?.source === "OSM" ? "OSM" : "OSM",
    });
  } catch (error) {
    throw new HttpError(502, `External map preview failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { HttpError };
