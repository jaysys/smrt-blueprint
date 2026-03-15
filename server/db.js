import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import {
  activityFeed,
  approvals,
  dashboardSummaries,
  domains,
  queueStats,
  settings,
  statusRows,
  teams,
} from "./seedData.js";

const dataDir = path.resolve("server", "data");
const dbPath = path.join(dataDir, "sample.db");

sqlite3.verbose();

export function createDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  return new sqlite3.Database(dbPath);
}

function run(db, sql, params = []) {
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

function get(db, sql, params = []) {
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

function all(db, sql, params = []) {
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

export async function initDatabase(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      team TEXT NOT NULL,
      summary TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      role TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS queue_stats (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      intent TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS dashboard_summaries (
      domain_id TEXT PRIMARY KEY,
      readiness INTEGER NOT NULL,
      widgets INTEGER NOT NULL,
      queues INTEGER NOT NULL,
      uptime TEXT NOT NULL,
      sync_label TEXT NOT NULL,
      pending_approvals INTEGER NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS status_rows (
      id INTEGER PRIMARY KEY,
      domain_id TEXT NOT NULL,
      area TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      latency TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS activity_feed (
      id INTEGER PRIMARY KEY,
      domain_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      time TEXT NOT NULL,
      intent TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY,
      domain_id TEXT NOT NULL,
      request TEXT NOT NULL,
      requester TEXT NOT NULL,
      priority TEXT NOT NULL,
      state TEXT NOT NULL,
      age TEXT NOT NULL,
      reviewer_id TEXT
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      selected_domain_id TEXT NOT NULL,
      default_owner_team_id TEXT NOT NULL,
      workspace_name TEXT NOT NULL,
      description TEXT NOT NULL,
      notifications_enabled INTEGER NOT NULL
    )`,
  );

  for (const item of domains) {
    await run(
      db,
      `INSERT OR REPLACE INTO domains (id, label, team, summary) VALUES (?, ?, ?, ?)`,
      [item.id, item.label, item.team, item.summary],
    );
  }

  for (const item of teams) {
    await run(db, `INSERT OR REPLACE INTO teams (id, label, role) VALUES (?, ?, ?)`, [
      item.id,
      item.label,
      item.role,
    ]);
  }

  for (const item of queueStats) {
    await run(
      db,
      `INSERT OR REPLACE INTO queue_stats (id, label, value, intent) VALUES (?, ?, ?, ?)`,
      [item.id, item.label, item.value, item.intent],
    );
  }

  for (const item of dashboardSummaries) {
    await run(
      db,
      `INSERT OR REPLACE INTO dashboard_summaries
      (domain_id, readiness, widgets, queues, uptime, sync_label, pending_approvals)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.domainId,
        item.readiness,
        item.widgets,
        item.queues,
        item.uptime,
        item.syncLabel,
        item.pendingApprovals,
      ],
    );
  }

  for (const item of statusRows) {
    await run(
      db,
      `INSERT OR REPLACE INTO status_rows
      (id, domain_id, area, owner, status, progress, latency)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.domainId, item.area, item.owner, item.status, item.progress, item.latency],
    );
  }

  for (const item of activityFeed) {
    await run(
      db,
      `INSERT OR REPLACE INTO activity_feed
      (id, domain_id, title, detail, time, intent)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [item.id, item.domainId, item.title, item.detail, item.time, item.intent],
    );
  }

  for (const item of approvals) {
    await run(
      db,
      `INSERT OR REPLACE INTO approvals
      (id, domain_id, request, requester, priority, state, age, reviewer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.domainId,
        item.request,
        item.requester,
        item.priority,
        item.state,
        item.age,
        item.reviewerId,
      ],
    );
  }

  await run(
    db,
    `INSERT OR REPLACE INTO settings
    (id, selected_domain_id, default_owner_team_id, workspace_name, description, notifications_enabled)
    VALUES (1, ?, ?, ?, ?, ?)`,
    [
      settings.selectedDomainId,
      settings.defaultOwnerTeamId,
      settings.workspaceName,
      settings.description,
      settings.notificationsEnabled,
    ],
  );
}

export async function fetchBootstrap(db) {
  const [domainRows, teamRows, settingsRow] = await Promise.all([
    all(db, `SELECT id, label, team, summary FROM domains ORDER BY label`),
    all(db, `SELECT id, label, role FROM teams ORDER BY label`),
    get(
      db,
      `SELECT
        selected_domain_id AS selectedDomainId,
        default_owner_team_id AS defaultOwnerTeamId,
        workspace_name AS workspaceName,
        description,
        notifications_enabled AS notificationsEnabled
      FROM settings
      WHERE id = 1`,
    ),
  ]);

  return {
    domains: domainRows,
    teams: teamRows,
    settings: {
      ...settingsRow,
      notificationsEnabled: Boolean(settingsRow.notificationsEnabled),
    },
  };
}

export async function fetchDashboard(db, domainId) {
  const [queueRows, statusRowSet, activityRows, summaryRow] = await Promise.all([
    all(db, `SELECT label, value, intent FROM queue_stats ORDER BY id`),
    all(
      db,
      `SELECT area, owner, status, progress, latency
       FROM status_rows
       WHERE domain_id = ?
       ORDER BY id`,
      [domainId],
    ),
    all(
      db,
      `SELECT title, detail, time, intent
       FROM activity_feed
       WHERE domain_id = ?
       ORDER BY id`,
      [domainId],
    ),
    get(
      db,
      `SELECT
        readiness,
        widgets,
        queues,
        uptime,
        sync_label AS syncLabel,
        pending_approvals AS pendingApprovals
      FROM dashboard_summaries
      WHERE domain_id = ?`,
      [domainId],
    ),
  ]);

  return {
    queueStats: queueRows,
    statusRows: statusRowSet,
    activityFeed: activityRows,
    summary: summaryRow,
  };
}

export async function fetchApprovals(db, domainId) {
  const rows = await all(
    db,
    `SELECT
      id,
      request,
      requester,
      priority,
      state,
      age,
      domain_id AS domainId,
      reviewer_id AS reviewerId
    FROM approvals
    WHERE domain_id = ?
    ORDER BY id`,
    [domainId],
  );

  return { approvals: rows };
}

export async function saveSettings(db, nextSettings) {
  await run(
    db,
    `UPDATE settings
     SET selected_domain_id = ?,
         default_owner_team_id = ?,
         workspace_name = ?,
         description = ?,
         notifications_enabled = ?
     WHERE id = 1`,
    [
      nextSettings.selectedDomainId,
      nextSettings.defaultOwnerTeamId,
      nextSettings.workspaceName,
      nextSettings.description,
      nextSettings.notificationsEnabled ? 1 : 0,
    ],
  );

  const bootstrap = await fetchBootstrap(db);
  return bootstrap.settings;
}

export async function assignApprovalsToReviewer(db, domainId, reviewerId) {
  const result = await run(
    db,
    `UPDATE approvals
     SET reviewer_id = ?
     WHERE domain_id = ?`,
    [reviewerId, domainId],
  );

  return { updatedCount: result.changes ?? 0 };
}
