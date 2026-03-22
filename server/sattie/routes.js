import express from "express";
import { getKoreanOrbitLiveTracks } from "./koreanOrbitLive.js";
import { getLeoBackdropPoints } from "./leoBackdrop.js";
import {
  HttpError,
  clearImages,
  createGroundStation,
  createRequestor,
  createSatellite,
  createUplink,
  deleteGroundStation,
  deleteRequestor,
  deleteSatellite,
  getCommand,
  getDownloadInfo,
  getSattieHealth,
  listCommands,
  listGroundStations,
  listRequestors,
  listSatelliteTypes,
  listSatellites,
  listScenarios,
  previewExternalMap,
  rerunCommand,
  saveLocalDownload,
  updateGroundStation,
  updateRequestor,
  updateSatellite,
} from "./service.js";
import {
  seedMockGroundStations,
  seedMockRequestors,
  seedMockSatellites,
} from "./seed.js";

const API_LOG_LIMIT = 300;
const apiCallLogs = [];

function sendError(response, error) {
  if (error instanceof HttpError) {
    response.status(error.status).json({ detail: error.message });
    return;
  }
  response.status(500).json({ error: String(error) });
}

function nowIso() {
  return new Date().toISOString();
}

function summarizePayload(payload) {
  if (payload == null) {
    return "OK";
  }
  if (typeof payload === "string") {
    return payload.length > 240 ? `${payload.slice(0, 237)}...` : payload;
  }
  try {
    const serialized = JSON.stringify(payload);
    return serialized.length > 240 ? `${serialized.slice(0, 237)}...` : serialized;
  } catch {
    return "OK";
  }
}

function appendApiLog(entry) {
  apiCallLogs.unshift(entry);
  while (apiCallLogs.length > API_LOG_LIMIT) {
    apiCallLogs.pop();
  }
}

export function createSattieRouter({ db }) {
  const router = express.Router();

  router.use((request, response, next) => {
    if (request.path === "/monitor/api-calls") {
      next();
      return;
    }

    let summary = "";
    const originalJson = response.json.bind(response);
    const originalSend = response.send.bind(response);

    response.json = (body) => {
      summary = summarizePayload(body);
      return originalJson(body);
    };

    response.send = (body) => {
      if (!summary && typeof body !== "undefined") {
        summary = summarizePayload(body);
      }
      return originalSend(body);
    };

    response.on("finish", () => {
      const contentType = String(response.getHeader("content-type") ?? "");
      const contentLength = String(response.getHeader("content-length") ?? "");
      appendApiLog({
        time: nowIso(),
        method: request.method,
        path: request.originalUrl,
        status: response.statusCode,
        summary:
          summary ||
          (contentType.includes("image/png")
            ? `image/png ${contentLength || "-" } bytes`
            : response.statusCode >= 400
              ? "Request failed"
              : "OK"),
        client_ip: request.ip,
      });
    });

    next();
  });

  router.get("/health", async (_request, response) => {
    try {
      response.json(await getSattieHealth(db));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/preview/external-map", async (request, response) => {
    try {
      const png = await previewExternalMap(request.query);
      response.setHeader("Content-Type", "image/png");
      response.send(png);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/monitor/api-calls", async (request, response) => {
    const limitRaw = Number.parseInt(String(request.query.limit ?? "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;
    response.json(apiCallLogs.slice(0, limit));
  });

  router.get("/orbit-track/leo-backdrop", async (_request, response) => {
    try {
      response.json(await getLeoBackdropPoints());
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/orbit-track/korean-live", async (_request, response) => {
    try {
      response.json(await getKoreanOrbitLiveTracks());
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/satellite-types", async (_request, response) => {
    try {
      response.json(await listSatelliteTypes());
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/scenarios", async (_request, response) => {
    try {
      response.json(await listScenarios());
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/satellites", async (_request, response) => {
    try {
      response.json(await listSatellites(db));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/satellites", async (request, response) => {
    try {
      response.json(await createSatellite(db, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.patch("/satellites/:satelliteId", async (request, response) => {
    try {
      response.json(await updateSatellite(db, request.params.satelliteId, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.delete("/satellites/:satelliteId", async (request, response) => {
    try {
      response.json(await deleteSatellite(db, request.params.satelliteId));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/seed/mock-satellites", async (_request, response) => {
    try {
      response.json({ satellite_ids: await seedMockSatellites(db) });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/ground-stations", async (_request, response) => {
    try {
      response.json(await listGroundStations(db));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/ground-stations", async (request, response) => {
    try {
      response.json(await createGroundStation(db, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.patch("/ground-stations/:groundStationId", async (request, response) => {
    try {
      response.json(await updateGroundStation(db, request.params.groundStationId, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.delete("/ground-stations/:groundStationId", async (request, response) => {
    try {
      response.json(await deleteGroundStation(db, request.params.groundStationId));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/seed/mock-ground-stations", async (_request, response) => {
    try {
      response.json({ ground_station_ids: await seedMockGroundStations(db) });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/requestors", async (request, response) => {
    try {
      response.json(await listRequestors(db, String(request.query.ground_station_id ?? "").trim() || null));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/requestors", async (request, response) => {
    try {
      response.json(await createRequestor(db, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.patch("/requestors/:requestorId", async (request, response) => {
    try {
      response.json(await updateRequestor(db, request.params.requestorId, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.delete("/requestors/:requestorId", async (request, response) => {
    try {
      response.json(await deleteRequestor(db, request.params.requestorId));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/seed/mock-requestors", async (_request, response) => {
    try {
      response.json({ requestor_ids: await seedMockRequestors(db) });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/uplink", async (request, response) => {
    try {
      response.json(await createUplink(db, request.body));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/commands", async (_request, response) => {
    try {
      response.json(await listCommands(db));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/commands/:commandId", async (request, response) => {
    try {
      response.json(await getCommand(db, request.params.commandId));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/commands/:commandId/rerun", async (request, response) => {
    try {
      response.json(await rerunCommand(db, request.params.commandId));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/downloads/:commandId", async (request, response) => {
    try {
      const download = await getDownloadInfo(db, request.params.commandId);
      response.download(download.filePath, download.fileName);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/downloads/:commandId/save-local", async (request, response) => {
    try {
      response.json(await saveLocalDownload(db, request.params.commandId));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/images/clear", async (_request, response) => {
    try {
      response.json(await clearImages(db));
    } catch (error) {
      sendError(response, error);
    }
  });

  return router;
}
