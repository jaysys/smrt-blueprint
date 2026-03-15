import express from "express";
import {
  assignApprovalsToReviewer,
  createDatabase,
  fetchApprovals,
  fetchBootstrap,
  fetchDashboard,
  initDatabase,
  saveSettings,
} from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const db = createDatabase();

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/bootstrap", async (_request, response) => {
  try {
    response.json(await fetchBootstrap(db));
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

app.get("/api/dashboard", async (request, response) => {
  try {
    const domainId = String(request.query.domainId ?? "");
    response.json(await fetchDashboard(db, domainId));
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

app.get("/api/approvals", async (request, response) => {
  try {
    const domainId = String(request.query.domainId ?? "");
    response.json(await fetchApprovals(db, domainId));
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

app.put("/api/settings", async (request, response) => {
  try {
    const settings = await saveSettings(db, request.body);
    response.json({ settings });
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

app.post("/api/approvals/assign", async (request, response) => {
  try {
    const { domainId, reviewerId } = request.body;
    response.json(await assignApprovalsToReviewer(db, domainId, reviewerId));
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

initDatabase(db)
  .then(() => {
    app.listen(port, () => {
      console.log(`API server running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
