import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";

const dataDir = path.resolve("server", "data");
const dbPath = path.join(dataDir, "sattie.db");

sqlite3.verbose();

export function createSattieDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  return new sqlite3.Database(dbPath);
}

export function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

export function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

export function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const rows = await all(db, `PRAGMA table_info(${tableName})`);
  if (rows.some((row) => row.name === columnName)) {
    return;
  }

  await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
}

export async function initSattieDatabase(db) {
  await run(db, "PRAGMA foreign_keys = ON");

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sattie_satellites (
      internal_satellite_code TEXT PRIMARY KEY,
      satellite_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      eng_model TEXT,
      domain TEXT,
      resolution_perf TEXT,
      baseline_status TEXT,
      primary_mission TEXT,
      tracker_name TEXT,
      tracker_domestic_name TEXT,
      norad_cat_id TEXT,
      object_type TEXT,
      object_id TEXT,
      tracker_current TEXT,
      launch_date TEXT,
      launch_site TEXT,
      period_minutes REAL,
      inclination_deg REAL,
      apogee_km REAL,
      perigee_km REAL,
      orbit_class TEXT,
      orbit_label TEXT,
      orbital_slot TEXT,
      tracker_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await ensureColumn(db, "sattie_satellites", "tracker_name", "tracker_name TEXT");
  await ensureColumn(
    db,
    "sattie_satellites",
    "tracker_domestic_name",
    "tracker_domestic_name TEXT",
  );
  await ensureColumn(db, "sattie_satellites", "norad_cat_id", "norad_cat_id TEXT");
  await ensureColumn(db, "sattie_satellites", "object_type", "object_type TEXT");
  await ensureColumn(db, "sattie_satellites", "object_id", "object_id TEXT");
  await ensureColumn(db, "sattie_satellites", "tracker_current", "tracker_current TEXT");
  await ensureColumn(db, "sattie_satellites", "launch_date", "launch_date TEXT");
  await ensureColumn(db, "sattie_satellites", "launch_site", "launch_site TEXT");
  await ensureColumn(db, "sattie_satellites", "period_minutes", "period_minutes REAL");
  await ensureColumn(db, "sattie_satellites", "inclination_deg", "inclination_deg REAL");
  await ensureColumn(db, "sattie_satellites", "apogee_km", "apogee_km REAL");
  await ensureColumn(db, "sattie_satellites", "perigee_km", "perigee_km REAL");
  await ensureColumn(db, "sattie_satellites", "orbit_class", "orbit_class TEXT");
  await ensureColumn(db, "sattie_satellites", "orbit_label", "orbit_label TEXT");
  await ensureColumn(db, "sattie_satellites", "orbital_slot", "orbital_slot TEXT");
  await ensureColumn(db, "sattie_satellites", "tracker_source", "tracker_source TEXT");

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sattie_ground_stations (
      internal_ground_station_code TEXT PRIMARY KEY,
      ground_station_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sattie_requestors (
      requestor_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      internal_ground_station_code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (internal_ground_station_code)
        REFERENCES sattie_ground_stations (internal_ground_station_code)
        ON DELETE CASCADE
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sattie_commands (
      command_id TEXT PRIMARY KEY,
      satellite_id TEXT NOT NULL,
      mission_name TEXT NOT NULL,
      aoi_name TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      cloud_percent INTEGER NOT NULL,
      fail_probability REAL NOT NULL,
      state TEXT NOT NULL,
      message TEXT,
      image_path TEXT,
      request_profile_json TEXT NOT NULL,
      acquisition_metadata_json TEXT,
      product_metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sattie_seed_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_type TEXT NOT NULL,
      seed_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sattie_satellites_name
      ON sattie_satellites (name)`,
  );

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sattie_ground_stations_name
      ON sattie_ground_stations (name)`,
  );

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sattie_requestors_station
      ON sattie_requestors (internal_ground_station_code)`,
  );

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sattie_commands_state
      ON sattie_commands (state)`,
  );

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sattie_commands_satellite
      ON sattie_commands (satellite_id)`,
  );

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sattie_commands_created_at
      ON sattie_commands (created_at DESC)`,
  );
}

export { dbPath as sattieDbPath };
