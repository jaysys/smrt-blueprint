import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "sattie-skor-tracker",
  "data",
  "leo-live-cache.json",
);

const EARTH_RADIUS_KM = 6378.137;
const EARTH_MU_KM3_S2 = 398600.4418;
const POINT_CACHE_MS = 10_000;

let sourceCache = null;
let pointCache = null;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function normalizeRadians(value) {
  let angle = value % (Math.PI * 2);
  if (angle < 0) {
    angle += Math.PI * 2;
  }
  return angle;
}

function normalizeLongitude(value) {
  let longitude = value;
  while (longitude > 180) {
    longitude -= 360;
  }
  while (longitude < -180) {
    longitude += 360;
  }
  return longitude;
}

function computeGmstRadians(date) {
  const julianDate = date.getTime() / 86_400_000 + 2440587.5;
  const centuries = (julianDate - 2451545.0) / 36525;
  const gmstDegrees =
    280.46061837 +
    360.98564736629 * (julianDate - 2451545.0) +
    0.000387933 * centuries * centuries -
    (centuries * centuries * centuries) / 38710000;
  return normalizeRadians(toRadians(gmstDegrees));
}

function solveKeplerEquation(meanAnomaly, eccentricity) {
  let eccentricAnomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI;
  for (let index = 0; index < 10; index += 1) {
    const delta =
      (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-8) {
      break;
    }
  }
  return eccentricAnomaly;
}

function propagateOmmPoint(omm, now) {
  const epoch = new Date(String(omm.EPOCH ?? ""));
  if (Number.isNaN(epoch.getTime())) {
    return null;
  }

  const meanMotionRevPerDay = toFiniteNumber(omm.MEAN_MOTION);
  const eccentricity = toFiniteNumber(omm.ECCENTRICITY);
  const inclinationDeg = toFiniteNumber(omm.INCLINATION);
  const raanDeg = toFiniteNumber(omm.RA_OF_ASC_NODE);
  const argPericenterDeg = toFiniteNumber(omm.ARG_OF_PERICENTER);
  const meanAnomalyDeg = toFiniteNumber(omm.MEAN_ANOMALY);

  if (
    meanMotionRevPerDay == null ||
    meanMotionRevPerDay <= 0 ||
    eccentricity == null ||
    inclinationDeg == null ||
    raanDeg == null ||
    argPericenterDeg == null ||
    meanAnomalyDeg == null
  ) {
    return null;
  }

  const meanMotionRadPerSec = (meanMotionRevPerDay * Math.PI * 2) / 86400;
  const semiMajorAxisKm = Math.cbrt(EARTH_MU_KM3_S2 / (meanMotionRadPerSec ** 2));
  const elapsedSeconds = (now.getTime() - epoch.getTime()) / 1000;
  const meanAnomaly = normalizeRadians(toRadians(meanAnomalyDeg) + meanMotionRadPerSec * elapsedSeconds);
  const eccentricAnomaly = solveKeplerEquation(meanAnomaly, eccentricity);
  const trueAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
      Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
    );
  const argumentOfLatitude = toRadians(argPericenterDeg) + trueAnomaly;
  const radiusKm = semiMajorAxisKm * (1 - eccentricity * Math.cos(eccentricAnomaly));
  const inclination = toRadians(inclinationDeg);
  const raan = toRadians(raanDeg);

  const xEci =
    radiusKm *
    (Math.cos(raan) * Math.cos(argumentOfLatitude) -
      Math.sin(raan) * Math.sin(argumentOfLatitude) * Math.cos(inclination));
  const yEci =
    radiusKm *
    (Math.sin(raan) * Math.cos(argumentOfLatitude) +
      Math.cos(raan) * Math.sin(argumentOfLatitude) * Math.cos(inclination));
  const zEci = radiusKm * Math.sin(argumentOfLatitude) * Math.sin(inclination);

  const gmst = computeGmstRadians(now);
  const xEcef = xEci * Math.cos(gmst) + yEci * Math.sin(gmst);
  const yEcef = -xEci * Math.sin(gmst) + yEci * Math.cos(gmst);
  const zEcef = zEci;
  const groundDistance = Math.sqrt(xEcef * xEcef + yEcef * yEcef);
  const radialDistance = Math.sqrt(xEcef * xEcef + yEcef * yEcef + zEcef * zEcef);

  return {
    latitude: Number(toDegrees(Math.atan2(zEcef, groundDistance)).toFixed(4)),
    longitude: Number(normalizeLongitude(toDegrees(Math.atan2(yEcef, xEcef))).toFixed(4)),
    altitude_km: Math.max(0, Math.round((radialDistance - EARTH_RADIUS_KM) * 10) / 10),
  };
}

async function loadSourceEntries() {
  if (sourceCache) {
    return sourceCache;
  }

  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(raw);
  sourceCache = {
    updatedAt: parsed.updatedAt ?? null,
    fetchedAt: parsed.fetchedAt ?? null,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
  };
  return sourceCache;
}

export async function getLeoBackdropPoints() {
  const now = new Date();
  if (pointCache && now.getTime() - pointCache.generatedAtMs < POINT_CACHE_MS) {
    return pointCache.payload;
  }

  const source = await loadSourceEntries();
  const points = [];

  for (const entry of source.entries) {
    const state = propagateOmmPoint(entry.omm ?? {}, now);
    if (!state) {
      continue;
    }

    points.push({
      norad: String(entry.norad ?? entry.omm?.NORAD_CAT_ID ?? ""),
      name: String(entry.name ?? entry.omm?.OBJECT_NAME ?? "UNKNOWN"),
      latitude: state.latitude,
      longitude: state.longitude,
      altitude_km: state.altitude_km,
      source_date: entry.sourceDate ?? null,
      source_state: entry.sourceState ?? null,
    });
  }

  const payload = {
    source: "sattie-skor-tracker leo-live-cache.json",
    updated_at: source.updatedAt,
    fetched_at: source.fetchedAt,
    generated_at: now.toISOString(),
    total_count: source.entries.length,
    rendered_count: points.length,
    points,
  };

  pointCache = {
    generatedAtMs: now.getTime(),
    payload,
  };

  return payload;
}
