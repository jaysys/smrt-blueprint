import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(__dirname, "..", "..", "..", "sattie-skor-tracker");
const liveCachePath = path.join(trackerRoot, "data", "satellite-live-cache.json");
const require = createRequire(import.meta.url);
const satelliteLibPath = path.join(trackerRoot, "node_modules", "satellite.js");
const TRACK_CACHE_MS = 10_000;

let satelliteLib = null;
let sourceCache = null;
let trackCache = null;

function getSatelliteLib() {
  if (satelliteLib) {
    return satelliteLib;
  }

  satelliteLib = require(satelliteLibPath);
  return satelliteLib;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getOrbitPeriodMinutes(item) {
  const periodFromOmm = Number(item?.omm?.PERIOD);
  if (Number.isFinite(periodFromOmm) && periodFromOmm > 0) {
    return periodFromOmm;
  }

  const meanMotion = Number(item?.omm?.MEAN_MOTION);
  if (Number.isFinite(meanMotion) && meanMotion > 0) {
    return 1440 / meanMotion;
  }

  return item?.orbitClass === "geo" ? 1436 : 96;
}

function getOrbitSamplingConfig(item) {
  const periodMinutes = clamp(getOrbitPeriodMinutes(item), 90, 1436);
  const halfWindowMinutes = periodMinutes / 2;
  const sampleStepMinutes = clamp(periodMinutes / 90, 2, 20);

  return {
    periodMinutes,
    halfWindowMinutes,
    sampleStepMinutes,
  };
}

function computeState(satellite, satrec, date) {
  const propagated = satellite.propagate(satrec, date);
  if (!propagated?.position) {
    return null;
  }

  const gmst = satellite.gstime(date);
  const geodetic = satellite.eciToGeodetic(propagated.position, gmst);

  return {
    latitude: satellite.degreesLat(geodetic.latitude),
    longitude: satellite.degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
  };
}

function buildSatrec(satellite, fleetEntry) {
  if (fleetEntry.omm) {
    return satellite.json2satrec(fleetEntry.omm);
  }

  const line1 = fleetEntry?.tle?.[0] ?? fleetEntry?.omm?.TLE_LINE1;
  const line2 = fleetEntry?.tle?.[1] ?? fleetEntry?.omm?.TLE_LINE2;
  if (line1 && line2) {
    return satellite.twoline2satrec(line1, line2);
  }

  return null;
}

async function loadSourceEntries() {
  if (sourceCache) {
    return sourceCache;
  }

  const raw = await fs.readFile(liveCachePath, "utf8");
  const parsed = JSON.parse(raw);
  const satellite = getSatelliteLib();
  const entries = Object.values(parsed.entries ?? {})
    .map((entry) => {
      const fleetEntry = entry?.fleetEntry;
      if (!fleetEntry?.norad) {
        return null;
      }

      const satrec = buildSatrec(satellite, fleetEntry);
      if (!satrec || fleetEntry.orbitClass === "cislunar") {
        return null;
      }

      return {
        fetchedAt: entry.fetchedAt ?? null,
        fleetEntry,
        satrec,
      };
    })
    .filter(Boolean);

  sourceCache = {
    updatedAt: parsed.updatedAt ?? null,
    entries,
  };
  return sourceCache;
}

export async function getKoreanOrbitLiveTracks() {
  const now = new Date();
  if (trackCache && now.getTime() - trackCache.generatedAtMs < TRACK_CACHE_MS) {
    return trackCache.payload;
  }

  const source = await loadSourceEntries();
  const satellite = getSatelliteLib();
  const entries = [];

  for (const record of source.entries) {
    const current = computeState(satellite, record.satrec, now);
    if (!current) {
      continue;
    }

    const sampling = getOrbitSamplingConfig(record.fleetEntry);
    const track = [];
    for (
      let minute = -sampling.halfWindowMinutes;
      minute <= sampling.halfWindowMinutes;
      minute += sampling.sampleStepMinutes
    ) {
      const sampleDate = new Date(now.getTime() + minute * 60_000);
      const state = computeState(satellite, record.satrec, sampleDate);
      if (!state) {
        continue;
      }

      track.push({
        latitude: Number(state.latitude.toFixed(4)),
        longitude: Number(state.longitude.toFixed(4)),
        altitudeKm: Math.round(state.altitudeKm * 10) / 10,
      });
    }

    entries.push({
      norad: String(record.fleetEntry.norad),
      english_name: record.fleetEntry.englishName ?? record.fleetEntry.name,
      domestic_name: record.fleetEntry.domesticName ?? null,
      orbit_class: record.fleetEntry.orbitClass ?? null,
      orbit_label: record.fleetEntry.orbitLabel ?? null,
      source_date: record.fleetEntry.sourceDate ?? null,
      source_label: record.fleetEntry.sourceLabel ?? null,
      fetched_at: record.fetchedAt,
      period_minutes: sampling.periodMinutes,
      current: {
        latitude: Number(current.latitude.toFixed(4)),
        longitude: Number(current.longitude.toFixed(4)),
        altitudeKm: Math.round(current.altitudeKm * 10) / 10,
      },
      track,
    });
  }

  const payload = {
    source: "sattie-skor-tracker satellite-live-cache.json",
    updated_at: source.updatedAt,
    generated_at: now.toISOString(),
    count: entries.length,
    entries,
  };

  trackCache = {
    generatedAtMs: now.getTime(),
    payload,
  };

  return payload;
}
