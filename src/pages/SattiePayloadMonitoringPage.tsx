import { useEffect, useState } from "react";
import { Button, Callout, Card, FormGroup, HTMLTable, InputGroup, Tag } from "@blueprintjs/core";
import { PanelTitle } from "../components/PanelTitle";
import {
  clearApiCallLogs,
  clearImages,
  getApiCallLogs,
  getSattieApiConfig,
  getSattieHealth,
  setSattieApiConfig,
} from "../lib/sattieApi";
import type { ApiCallLogEntry, SattieHealthResponse } from "../sattie-types";

function formatLogTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
}

export function SattiePayloadMonitoringPage() {
  const initialConfig = getSattieApiConfig();
  const [apiBaseUrl, setApiBaseUrl] = useState(initialConfig.apiBaseUrl || window.location.origin);
  const [apiKey, setApiKey] = useState(initialConfig.apiKey || "change-me");
  const [health, setHealth] = useState<SattieHealthResponse | null>(null);
  const [logs, setLogs] = useState<ApiCallLogEntry[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshLogs() {
    setError(null);

    try {
      const nextLogs = await getApiCallLogs(100);
      setLogs(
        nextLogs
          .slice()
          .sort((a, b) => Date.parse(b.time || "") - Date.parse(a.time || "")),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Payload monitoring load failed");
    } finally {
    }
  }

  useEffect(() => {
    void refreshLogs();
    const timer = window.setInterval(() => {
      void refreshLogs();
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  function handleApplyUrl() {
    setSattieApiConfig({ apiBaseUrl, apiKey });
    setMessage("API Base URL / API Key applied to current console.");
    void refreshLogs();
  }

  async function handleHealthCheck() {
    setHealthLoading(true);
    setError(null);

    try {
      const nextHealth = await getSattieHealth();
      setHealth(nextHealth);
      await refreshLogs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Health check failed");
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleClearImages() {
    setError(null);
    setMessage(null);
    try {
      const response = await clearImages();
      setMessage(`Images cleared: ${response.deleted_count}, Commands updated: ${response.cleared_command_count}`);
      await refreshLogs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Clear images failed");
    }
  }

  async function handleClearLogs() {
    setError(null);
    setMessage(null);
    try {
      const response = await clearApiCallLogs();
      setLogs([]);
      setMessage(`Recent API Calls cleared: ${response.cleared_count}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Clear logs failed");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">API Call Logs</p>
          <h1>External API Call Logs</h1>
          <p className="page-copy">
            API base URL, API key, health 확인, image clear, recent API call 로그를 한
            화면에서 추적한다.
          </p>
        </div>
        <Card className="mini-summary">
          <div className="mini-summary__grid">
            <div>
              <strong>{health?.counts.commands ?? 0}</strong>
              <span>commands</span>
            </div>
            <div>
              <strong>{logs.length}</strong>
              <span>recent api calls</span>
            </div>
            <div>
              <strong>{health?.ok ? "OK" : "-"}</strong>
              <span>health</span>
            </div>
          </div>
        </Card>
      </section>

      {error ? (
        <Callout icon="error" intent="danger">
          {error}
        </Callout>
      ) : null}

      {message ? (
        <Callout icon="endorsed" intent="success">
          {message}
        </Callout>
      ) : null}

      <Card className="panel panel--payload-controls">
        <div className="panel__title-row">
          <PanelTitle icon="control">Console Controls</PanelTitle>
          <Tag minimal intent="primary">
            Monitor
          </Tag>
        </div>
        <div className="form-inline form-inline--triple">
          <FormGroup label="API Base URL">
            <InputGroup value={apiBaseUrl} onValueChange={setApiBaseUrl} />
          </FormGroup>
          <FormGroup label="API Key">
            <InputGroup value={apiKey} onValueChange={setApiKey} />
          </FormGroup>
          <FormGroup label="Service Status">
            <InputGroup
              readOnly
              value={health ? `${health.service} · SQLite ${health.sqliteVersion}` : "Not checked"}
            />
          </FormGroup>
        </div>
        <div className="button-cluster">
          <Button icon="endorsed" intent="primary" onClick={handleApplyUrl}>
            Apply URL
          </Button>
          <Button icon="pulse" onClick={() => void handleHealthCheck()} loading={healthLoading}>
            Health Check
          </Button>
          <Button icon="trash" intent="warning" onClick={() => void handleClearImages()}>
            Clear Images
          </Button>
          <Button icon="clean" onClick={() => void handleClearLogs()}>
            Clear Logs
          </Button>
        </div>
      </Card>

      <Card className="panel">
        <div className="panel__title-row">
          <PanelTitle icon="exchange">Recent API Calls</PanelTitle>
          <Tag minimal intent="success">
            Max 100
          </Tag>
        </div>
        <div className="log-table-wrap">
          <HTMLTable bordered interactive striped className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="subtle-text">
                    No API calls captured.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={`${log.time}-${index}`}>
                    <td>{formatLogTime(log.time)}</td>
                    <td>{log.method}</td>
                    <td>{log.path}</td>
                    <td>{log.status}</td>
                    <td>{log.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </HTMLTable>
        </div>
      </Card>
    </div>
  );
}
