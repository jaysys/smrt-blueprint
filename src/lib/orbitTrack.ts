import type { Satellite } from "../sattie-types";

export type OrbitTrackClass = "leo" | "geo" | "meo" | "cislunar";

export interface OrbitTrackPoint {
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

export interface OrbitTrackEntry {
  satelliteId: string;
  name: string;
  englishName: string;
  domesticName: string | null;
  norad: string;
  orbitClass: OrbitTrackClass;
  orbitLabel: string;
  orbitalSlot: string | null;
  objectType: string | null;
  objectId: string | null;
  launchDate: string | null;
  trackerSource: string | null;
  trackerName: string | null;
  status: string;
  color: string;
  trackable: boolean;
  periodMinutes: number;
  current: OrbitTrackPoint;
  track: OrbitTrackPoint[];
}

const ORBIT_COLORS: Record<OrbitTrackClass, string[]> = {
  leo: ["#ff9f68", "#ffd166", "#7bdff2", "#9bdeac", "#8bd0ff", "#f497b6"],
  geo: ["#65d4a8", "#8bd0ff", "#c7ceea", "#f1a66a"],
  meo: ["#d7a9ff", "#a0c4ff", "#caffbf", "#fdffb6"],
  cislunar: ["#f7b267", "#f79d65", "#f4845f", "#f27059"],
};

const EARTH_RADIUS_KM = 6378.137;
const EARTH_MU_KM3_S2 = 398600.4418;

function hashValue(value: string) {
  return String(value)
    .split("")
    .reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 7);
}

function normalizeLongitude(value: number) {
  let longitude = value;

  while (longitude > 180) {
    longitude -= 360;
  }

  while (longitude < -180) {
    longitude += 360;
  }

  return longitude;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function toFiniteNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : null;
}

function inferOrbitClass(satellite: Satellite): OrbitTrackClass {
  const normalizedClass = String(satellite.orbit_class ?? "").trim().toLowerCase();
  if (normalizedClass === "geo" || normalizedClass === "meo" || normalizedClass === "cislunar") {
    return normalizedClass;
  }

  const label = String(satellite.orbit_label ?? "").toLowerCase();
  if (label.includes("lunar")) {
    return "cislunar";
  }
  if (label.includes("geo")) {
    return "geo";
  }
  if (label.includes("meo")) {
    return "meo";
  }
  return "leo";
}

function getOrbitConfig(orbitClass: OrbitTrackClass, seed: number) {
  if (orbitClass === "geo") {
    const altitudeKm = 35786;
    return {
      periodMinutes: computeOrbitalPeriodMinutes(altitudeKm),
      inclinationDeg: 0.2 + (seed % 6) * 0.08,
      altitudeKm,
    };
  }

  if (orbitClass === "meo") {
    const altitudeKm = 20200;
    return {
      periodMinutes: computeOrbitalPeriodMinutes(altitudeKm),
      inclinationDeg: 55 + (seed % 8),
      altitudeKm,
    };
  }

  if (orbitClass === "cislunar") {
    return {
      periodMinutes: 19660,
      inclinationDeg: 28 + (seed % 10),
      altitudeKm: 384400,
    };
  }

  const altitudeKm = 480 + (seed % 180);
  return {
    periodMinutes: computeOrbitalPeriodMinutes(altitudeKm),
    inclinationDeg: 96.5 + ((seed % 12) * 0.18),
    altitudeKm,
  };
}

function getOrbitSpec(satellite: Satellite, orbitClass: OrbitTrackClass) {
  const hashSource = `${satellite.norad_cat_id ?? satellite.satellite_id}:${satellite.object_id ?? ""}:${satellite.launch_date ?? ""}`;
  const inclinationSeed = hashValue(`${hashSource}:inc`);
  const raanSeed = hashValue(`${hashSource}:raan`);
  const fallback = getOrbitConfig(orbitClass, hashValue(hashSource));
  const apogeeKm = toFiniteNumber(satellite.apogee_km);
  const perigeeKm = toFiniteNumber(satellite.perigee_km);
  const averageAltitudeKm =
    apogeeKm != null && perigeeKm != null
      ? (apogeeKm + perigeeKm) / 2
      : apogeeKm ?? perigeeKm ?? fallback.altitudeKm;

  return {
    periodMinutes: toFiniteNumber(satellite.period_minutes) ?? computeOrbitalPeriodMinutes(averageAltitudeKm),
    inclinationDeg: toFiniteNumber(satellite.inclination_deg) ?? getOrbitConfig(orbitClass, inclinationSeed).inclinationDeg,
    altitudeKm: averageAltitudeKm,
    rightAscensionSeed: raanSeed,
    slotLongitude: parseOrbitalSlot(satellite.orbital_slot),
  };
}

function computeOrbitalPeriodMinutes(altitudeKm: number) {
  const semiMajorAxisKm = EARTH_RADIUS_KM + altitudeKm;
  const periodSeconds =
    2 * Math.PI * Math.sqrt((semiMajorAxisKm ** 3) / EARTH_MU_KM3_S2);
  return periodSeconds / 60;
}

function parseOrbitalSlot(slot: string | null) {
  if (!slot) {
    return null;
  }

  const match = slot.match(/(\d+(?:\.\d+)?)\s*°?\s*([EW])/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }

  return match[2].toUpperCase() === "W" ? -value : value;
}

function buildTrackPoint(entry: Satellite, minuteStamp: number): OrbitTrackPoint {
  const orbitClass = inferOrbitClass(entry);
  const hashSource = `${entry.norad_cat_id ?? entry.satellite_id}:${entry.object_id ?? ""}:${entry.launch_date ?? ""}`;
  const seed = hashValue(hashSource);
  const spec = getOrbitSpec(entry, orbitClass);
  const rightAscensionDeg =
    orbitClass === "geo" && spec.slotLongitude != null
      ? spec.slotLongitude
      : orbitClass === "cislunar"
        ? ((seed % 360) - 180) * 0.45
        : (spec.rightAscensionSeed % 360) - 180;
  const argumentOfLatitude =
    (minuteStamp / spec.periodMinutes) * Math.PI * 2 + toRadians(seed % 360);
  const inclination = toRadians(spec.inclinationDeg);
  const rightAscension = toRadians(rightAscensionDeg);
  const radiusKm = EARTH_RADIUS_KM + spec.altitudeKm;

  const x =
    radiusKm *
    (Math.cos(rightAscension) * Math.cos(argumentOfLatitude) -
      Math.sin(rightAscension) * Math.sin(argumentOfLatitude) * Math.cos(inclination));
  const y =
    radiusKm *
    (Math.sin(rightAscension) * Math.cos(argumentOfLatitude) +
      Math.cos(rightAscension) * Math.sin(argumentOfLatitude) * Math.cos(inclination));
  const z = radiusKm * Math.sin(argumentOfLatitude) * Math.sin(inclination);
  const radialDistance = Math.sqrt(x * x + y * y + z * z);

  return {
    latitude: toDegrees(Math.asin(z / radialDistance)),
    longitude: normalizeLongitude(toDegrees(Math.atan2(y, x))),
    altitudeKm:
      orbitClass === "cislunar"
        ? spec.altitudeKm + Math.cos(argumentOfLatitude) * 12000
        : spec.altitudeKm,
  };
}

function buildTrack(entry: Satellite, now: Date) {
  const orbitClass = inferOrbitClass(entry);
  const spec = getOrbitSpec(entry, orbitClass);
  const stepMinutes =
    orbitClass === "cislunar"
      ? 240
      : Math.max(orbitClass === "geo" ? 12 : 3, Math.min(spec.periodMinutes / 96, 24));
  const halfWindow =
    orbitClass === "geo"
      ? Math.min(Math.max(spec.periodMinutes * 0.08, 45), 120)
      : orbitClass === "meo"
        ? Math.min(Math.max(spec.periodMinutes * 0.12, 40), 110)
        : orbitClass === "cislunar"
          ? Math.min(Math.max(spec.periodMinutes * 0.04, 240), 480)
          : Math.min(Math.max(spec.periodMinutes * 0.16, 16), 30);
  const currentMinute = now.getTime() / 60000;
  const points: OrbitTrackPoint[] = [];

  for (let minuteOffset = -halfWindow; minuteOffset <= halfWindow; minuteOffset += stepMinutes) {
    points.push(buildTrackPoint(entry, currentMinute + minuteOffset));
  }

  return points;
}

export function buildOrbitTrackEntries(satellites: Satellite[], now = new Date()): OrbitTrackEntry[] {
  return satellites
    .map((satellite) => {
      const orbitClass = inferOrbitClass(satellite);
      const norad = satellite.norad_cat_id ?? satellite.satellite_id;
      const colorPalette = ORBIT_COLORS[orbitClass];
      const color = colorPalette[hashValue(norad) % colorPalette.length];
      const spec = getOrbitSpec(satellite, orbitClass);
      const current = buildTrackPoint(satellite, now.getTime() / 60000);

      return {
        satelliteId: satellite.satellite_id,
        name: satellite.name,
        englishName: satellite.tracker_name ?? satellite.eng_model ?? satellite.name,
        domesticName: satellite.tracker_domestic_name,
        norad,
        orbitClass,
        orbitLabel: satellite.orbit_label ?? orbitClass.toUpperCase(),
        orbitalSlot: satellite.orbital_slot,
        objectType: satellite.object_type,
        objectId: satellite.object_id,
        launchDate: satellite.launch_date,
        trackerSource: satellite.tracker_source,
        trackerName: satellite.tracker_name,
        status: satellite.status,
        color,
        trackable: orbitClass !== "cislunar",
        periodMinutes: spec.periodMinutes,
        current,
        track: buildTrack(satellite, now),
      };
    })
    .sort((left, right) => left.englishName.localeCompare(right.englishName, "en"));
}
