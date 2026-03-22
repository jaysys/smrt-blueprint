import { randomUUID } from "node:crypto";
import {
  GROUND_STATION_PRESETS,
  GROUND_STATION_REQUESTOR_PRESETS,
  ORBIT_TRACK_SOURCE,
  SATELLITE_ORBIT_TRACK_METADATA_BY_ENG_MODEL,
  SATELLITE_BASELINES,
} from "./catalog.js";
import { all, get, run } from "./db.js";
import { EXPANDED_ACTIVE_ORBIT_TRACK_CATALOG } from "./orbitCatalog.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeIdToken(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function makeSatellitePublicId(engModel) {
  return String(engModel ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function makeUniqueId(base, usedIds) {
  if (!usedIds.has(base)) {
    return base;
  }
  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function buildGroundStationAlias(name, location) {
  const locationToken = normalizeIdToken(location).slice(0, 3) || normalizeIdToken(name).slice(0, 3) || "GND";
  const words = String(name)
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  const stopwords = new Set(["GROUND", "STATION", "SATELLITE", "BASE", "CENTER", "CONTROL"]);
  const filtered = words.filter((word) => !stopwords.has(word));
  const initials = (filtered.slice(0, 4).map((word) => word[0]).join("") || "GS").slice(0, 4);
  return `${locationToken}-${initials}`;
}

async function recordSeedEvent(db, seedType, seedCount) {
  await run(
    db,
    `INSERT INTO sattie_seed_history (seed_type, seed_count, created_at)
     VALUES (?, ?, ?)`,
    [seedType, seedCount, nowIso()],
  );
}

function getBaselineSatelliteSeed(baseline) {
  const satelliteId = makeSatellitePublicId(baseline.eng_model);
  const orbitTrack = SATELLITE_ORBIT_TRACK_METADATA_BY_ENG_MODEL[baseline.eng_model] ?? {};
  return {
    satelliteId,
    type: baseline.domain === "SAR" ? "SAR" : "EO_OPTICAL",
    name: `${baseline.kor_name} (${baseline.eng_model})`,
    orbitTrack:
      orbitTrack.tracker_name != null
        ? {
            ...orbitTrack,
            object_type: orbitTrack.object_type ?? "PAYLOAD",
          }
        : orbitTrack,
  };
}

function inferExpandedSatelliteType(entry) {
  return /SAR/i.test(entry.name) || /SAR/i.test(entry.domesticName) ? "SAR" : "EO_OPTICAL";
}

function getExpandedSatelliteCatalogProfile(entry) {
  const name = entry.name;

  if (/^KOREASAT|^ABS .*KOREASAT/i.test(name)) {
    return {
      domain: "SATCOM",
      resolutionPerf: "방송/통신 payload",
      primaryMission: "방송/통신 정지궤도 서비스",
    };
  }

  if (/^COMS 1$|^GEO-KOMPSAT/i.test(name)) {
    return {
      domain: "GEO-EO",
      resolutionPerf: "기상/환경 관측 payload",
      primaryMission: "정지궤도 기상·환경 관측",
    };
  }

  if (name === "KPLO") {
    return {
      domain: "LUNAR",
      resolutionPerf: "달 탐사 payload",
      primaryMission: "달 궤도 탐사 및 과학 임무",
    };
  }

  if (name === "SpaceEye-T") {
    return {
      domain: "EO",
      resolutionPerf: "상업 광학 지구관측",
      primaryMission: "상업 초고해상도 광학 지구관측",
    };
  }

  if (
    /^CAS500-3$|^GYEONGGISAT-1$|^CONTECSAT-1$|^NEONSAT-|^KOMPSAT$|^KOMPSAT 2$/i.test(name)
  ) {
    return {
      domain: "EO",
      resolutionPerf: "광학 지구관측 payload",
      primaryMission: "지구관측 및 운용 실증",
    };
  }

  if (/^NEXTSAT-|^STSAT /i.test(name)) {
    return {
      domain: "R&D",
      resolutionPerf: "기술검증/과학 payload",
      primaryMission: "우주기술 검증 및 과학탑재체 운용",
    };
  }

  if (
    /^JINJUSAT-|^SNUGLITE|^SNUSAT|^KITSAT|^KAISTSAT|^DOORY-SAT$|^OBSERVER-1A$|^PVSAT$|^RANDEV$|^MIMAN$|^DUMMY CUBESAT$|^KSLV-II DUMMY$|^OSSI 1$|^STEP CUBE LAB$|^LINK$/i.test(
      name,
    )
  ) {
    return {
      domain: "R&D",
      resolutionPerf: "기술실증/교육 payload",
      primaryMission: "대학·연구기관 중심 기술실증 및 연구 임무",
    };
  }

  return {
    domain: inferExpandedSatelliteType(entry) === "SAR" ? "SAR" : "EO",
    resolutionPerf:
      inferExpandedSatelliteType(entry) === "SAR"
        ? "radar payload"
        : entry.orbitClass === "cislunar"
          ? "deep-space payload"
          : "payload",
    primaryMission: "활성 orbit-track 한국 위성 자산",
  };
}

function getExpandedOrbitTrackSeed(entry) {
  const satelliteId = makeSatellitePublicId(entry.name);
  const type = inferExpandedSatelliteType(entry);
  const displayName =
    entry.domesticName && entry.domesticName !== entry.name
      ? `${entry.domesticName} (${entry.name})`
      : entry.name;
  const profile = getExpandedSatelliteCatalogProfile(entry);

  return {
    satelliteId,
    type,
    name: displayName,
    engModel: entry.name,
    domain: profile.domain,
    resolutionPerf: profile.resolutionPerf,
    baselineStatus: "활성 카탈로그 반영",
    primaryMission: profile.primaryMission,
    orbitTrack: {
      tracker_name: entry.name,
      tracker_domestic_name: entry.domesticName,
      norad_cat_id: entry.noradCatId,
      object_type: entry.objectType ?? "PAYLOAD",
      object_id: entry.objectId,
      tracker_current: entry.current ?? "Y",
      launch_date: entry.launchDate,
      launch_site: entry.site ?? null,
      period_minutes: entry.periodMinutes ?? null,
      inclination_deg: entry.inclinationDeg ?? null,
      apogee_km: entry.apogeeKm ?? null,
      perigee_km: entry.perigeeKm ?? null,
      orbit_class: entry.orbitClass,
      orbit_label: entry.orbitLabel,
      orbital_slot: entry.orbitalSlot ?? null,
      tracker_source: ORBIT_TRACK_SOURCE,
    },
  };
}

async function upsertManagedSatellite(db, existingRow, seed, now) {
  if (existingRow) {
    await run(
      db,
      `UPDATE sattie_satellites
       SET name = ?, type = ?, eng_model = ?, domain = ?, resolution_perf = ?,
           baseline_status = ?, primary_mission = ?, tracker_name = ?, tracker_domestic_name = ?,
           norad_cat_id = ?, object_type = ?, object_id = ?, tracker_current = ?, launch_date = ?, launch_site = ?,
           period_minutes = ?, inclination_deg = ?, apogee_km = ?, perigee_km = ?, orbit_class = ?, orbit_label = ?,
           orbital_slot = ?, tracker_source = ?, updated_at = ?
       WHERE satellite_id = ?`,
      [
        seed.name,
        seed.type,
        seed.engModel,
        seed.domain,
        seed.resolutionPerf,
        seed.baselineStatus,
        seed.primaryMission,
        seed.orbitTrack.tracker_name ?? null,
        seed.orbitTrack.tracker_domestic_name ?? null,
        seed.orbitTrack.norad_cat_id ?? null,
        seed.orbitTrack.object_type ?? null,
        seed.orbitTrack.object_id ?? null,
        seed.orbitTrack.tracker_current ?? null,
        seed.orbitTrack.launch_date ?? null,
        seed.orbitTrack.launch_site ?? null,
        seed.orbitTrack.period_minutes ?? null,
        seed.orbitTrack.inclination_deg ?? null,
        seed.orbitTrack.apogee_km ?? null,
        seed.orbitTrack.perigee_km ?? null,
        seed.orbitTrack.orbit_class ?? null,
        seed.orbitTrack.orbit_label ?? null,
        seed.orbitTrack.orbital_slot ?? null,
        seed.orbitTrack.tracker_source ?? null,
        now,
        seed.satelliteId,
      ],
    );
    return;
  }

  const internalCode = `sat-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  await run(
    db,
    `INSERT INTO sattie_satellites (
      internal_satellite_code, satellite_id, name, type, status,
      eng_model, domain, resolution_perf, baseline_status, primary_mission,
      tracker_name, tracker_domestic_name, norad_cat_id, object_type, object_id, tracker_current, launch_date,
      launch_site, period_minutes, inclination_deg, apogee_km, perigee_km,
      orbit_class, orbit_label, orbital_slot, tracker_source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      internalCode,
      seed.satelliteId,
      seed.name,
      seed.type,
      "AVAILABLE",
      seed.engModel,
      seed.domain,
      seed.resolutionPerf,
      seed.baselineStatus,
      seed.primaryMission,
      seed.orbitTrack.tracker_name ?? null,
      seed.orbitTrack.tracker_domestic_name ?? null,
      seed.orbitTrack.norad_cat_id ?? null,
      seed.orbitTrack.object_type ?? null,
      seed.orbitTrack.object_id ?? null,
      seed.orbitTrack.tracker_current ?? null,
      seed.orbitTrack.launch_date ?? null,
      seed.orbitTrack.launch_site ?? null,
      seed.orbitTrack.period_minutes ?? null,
      seed.orbitTrack.inclination_deg ?? null,
      seed.orbitTrack.apogee_km ?? null,
      seed.orbitTrack.perigee_km ?? null,
      seed.orbitTrack.orbit_class ?? null,
      seed.orbitTrack.orbit_label ?? null,
      seed.orbitTrack.orbital_slot ?? null,
      seed.orbitTrack.tracker_source ?? null,
      now,
      now,
    ],
  );
}

async function synchronizeBaselineSatellites(db, { recordEvent = false } = {}) {
  const existing = await all(db, `SELECT satellite_id, status FROM sattie_satellites`);
  const existingById = new Map(existing.map((row) => [row.satellite_id, row]));
  const now = nowIso();
  const synchronizedIds = [];

  for (const baseline of SATELLITE_BASELINES) {
    const { satelliteId, type, name, orbitTrack } = getBaselineSatelliteSeed(baseline);
    const existingRow = existingById.get(satelliteId);
    await upsertManagedSatellite(
      db,
      existingRow,
      {
        satelliteId,
        type,
        name,
        engModel: baseline.eng_model,
        domain: baseline.domain,
        resolutionPerf: baseline.resolution_perf,
        baselineStatus: baseline.baseline_status,
        primaryMission: baseline.primary_mission,
        orbitTrack,
      },
      now,
    );
    synchronizedIds.push(satelliteId);
  }

  for (const entry of EXPANDED_ACTIVE_ORBIT_TRACK_CATALOG) {
    const seed = getExpandedOrbitTrackSeed(entry);
    await upsertManagedSatellite(db, existingById.get(seed.satelliteId), seed, now);
    synchronizedIds.push(seed.satelliteId);
  }

  if (recordEvent) {
    await recordSeedEvent(db, "mock-satellites", synchronizedIds.length);
  }

  return synchronizedIds;
}

export async function seedMockSatellites(db) {
  return synchronizeBaselineSatellites(db, { recordEvent: true });
}

export async function syncSatelliteCatalogMetadata(db) {
  return synchronizeBaselineSatellites(db, { recordEvent: false });
}

export async function seedMockGroundStations(db) {
  const rows = await all(db, `SELECT ground_station_id, name FROM sattie_ground_stations`);
  const usedIds = new Set(rows.map((row) => row.ground_station_id));
  const usedNames = new Set(rows.map((row) => row.name.trim().toLowerCase()));
  const seededIds = [];
  const now = nowIso();

  for (const [name, type, location] of GROUND_STATION_PRESETS) {
    if (usedNames.has(name.trim().toLowerCase())) {
      continue;
    }

    const alias = makeUniqueId(buildGroundStationAlias(name, location), usedIds);
    const internalCode = `gnd-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    await run(
      db,
      `INSERT INTO sattie_ground_stations (
        internal_ground_station_code, ground_station_id, name, type, status, location, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [internalCode, alias, name, type, "OPERATIONAL", location, now, now],
    );

    seededIds.push(alias);
    usedIds.add(alias);
    usedNames.add(name.trim().toLowerCase());
  }

  await recordSeedEvent(db, "mock-ground-stations", seededIds.length);
  return seededIds;
}

export async function seedMockRequestors(db) {
  const stations = await all(
    db,
    `SELECT internal_ground_station_code, ground_station_id, name
     FROM sattie_ground_stations
     ORDER BY name`,
  );
  const existing = await all(
    db,
    `SELECT name, internal_ground_station_code FROM sattie_requestors`,
  );
  const existingPairs = new Set(
    existing.map((row) => `${row.internal_ground_station_code}::${row.name.trim().toLowerCase()}`),
  );
  const seededIds = [];
  const now = nowIso();

  for (const station of stations) {
    const preset = Object.entries(GROUND_STATION_REQUESTOR_PRESETS).find(([keyword]) =>
      station.name.includes(keyword),
    )?.[1] ?? [`${station.name} Requestor Alpha`, `${station.name} Requestor Bravo`];

    for (const requestorName of preset) {
      const pairKey = `${station.internal_ground_station_code}::${requestorName.trim().toLowerCase()}`;
      if (existingPairs.has(pairKey)) {
        continue;
      }

      const requestorId = `req-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
      await run(
        db,
        `INSERT INTO sattie_requestors (
          requestor_id, name, internal_ground_station_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [requestorId, requestorName, station.internal_ground_station_code, now, now],
      );

      seededIds.push(requestorId);
      existingPairs.add(pairKey);
    }
  }

  await recordSeedEvent(db, "mock-requestors", seededIds.length);
  return seededIds;
}

export async function ensureSattieBootstrap(db) {
  const row = await get(
    db,
    `SELECT
      (SELECT COUNT(*) FROM sattie_satellites) AS satellites_count,
      (SELECT COUNT(*) FROM sattie_ground_stations) AS ground_stations_count,
      (SELECT COUNT(*) FROM sattie_requestors) AS requestors_count,
      (SELECT COUNT(*) FROM sattie_commands) AS commands_count`,
  );

  const counts = {
    satellites: Number(row?.satellites_count ?? 0),
    groundStations: Number(row?.ground_stations_count ?? 0),
    requestors: Number(row?.requestors_count ?? 0),
    commands: Number(row?.commands_count ?? 0),
  };

  if (counts.satellites === 0) {
    counts.satellites = (await seedMockSatellites(db)).length;
  }

  if (counts.groundStations === 0) {
    counts.groundStations = (await seedMockGroundStations(db)).length;
  }

  if (counts.requestors === 0) {
    counts.requestors = (await seedMockRequestors(db)).length;
  }

  await syncSatelliteCatalogMetadata(db);

  await recordSeedEvent(db, "bootstrap-check", counts.satellites + counts.groundStations + counts.requestors);

  return counts;
}
