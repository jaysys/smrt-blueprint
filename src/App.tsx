import { useEffect, useState } from "react";
import {
  AnchorButton,
  Button,
  Callout,
  Card,
  Classes,
  Dialog,
  HTMLSelect,
  Icon,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  Spinner,
  Switch,
  Tag,
} from "@blueprintjs/core";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PanelTitle } from "./components/PanelTitle";
import { getSattieBootstrap } from "./lib/sattieApi";
import { SattieCommandsPage } from "./pages/SattieCommandsPage";
import { SattieDashboardPage } from "./pages/SattieDashboardPage";
import { SattieOrbitTrackPage } from "./pages/SattieOrbitTrackPage";
import { SattiePerformancePage } from "./pages/SattiePerformancePage";
import { SattiePayloadMonitoringPage } from "./pages/SattiePayloadMonitoringPage";
import { SattieSatellitesPage } from "./pages/SattieSatellitesPage";
import { SattieScenariosPage } from "./pages/SattieScenariosPage";
import { SattieUplinkPage } from "./pages/SattieUplinkPage";
import type { SattieConsoleBootstrap } from "./sattie-types";

type MockRole = "admin" | "operator" | "requestor";

export function App() {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<SattieConsoleBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<MockRole>(() => {
    const savedRole = window.localStorage.getItem("simMockUserId");
    return savedRole === "admin" || savedRole === "operator" || savedRole === "requestor"
      ? savedRole
      : "admin";
  });
  const [operationsOpen, setOperationsOpen] = useState(() => {
    const savedState = window.localStorage.getItem("sattieOperationsOpen");
    return savedState == null ? true : savedState === "true";
  });

  async function refreshBootstrap() {
    try {
      setError(null);
      const data = await getSattieBootstrap();
      setBootstrap(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sattie bootstrap load failed");
    }
  }

  useEffect(() => {
    let cancelled = false;

    refreshBootstrap()
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("simMockUserId", role);
  }, [role]);

  useEffect(() => {
    window.localStorage.setItem("sattieOperationsOpen", String(operationsOpen));
  }, [operationsOpen]);

  const canAccessSatellites = role === "admin";
  const canSendUplink = role !== "requestor";
  const canRunScenarios = role !== "requestor";
  const canManageInfra = role === "admin";
  const operationsRoutes = ["/uplink", "/commands", "/scenarios"];
  const operationsActive = operationsRoutes.some((route) => location.pathname.startsWith(route));
  const canSeeOperationsGroup = canSendUplink || canRunScenarios;

  return (
    <div className={`app-shell ${darkMode ? Classes.DARK : ""}`}>
      <div className="app-backdrop" />
      <main className="app-frame">
        <Navbar className="topbar">
          <NavbarGroup align="left" className="topbar__brand">
            <NavbarHeading>
              <NavLink to="/dashboard" className="brand-title" end>
                <span className="brand-mark" aria-hidden="true">
                  <Icon icon="satellite" />
                </span>
                <span className="brand-copy">
                  <span className="brand-kicker">Operations Console</span>
                  <span className="brand-name">K-Sattie Image Hub</span>
                </span>
              </NavLink>
            </NavbarHeading>
            <NavbarDivider />
            <Tag minimal round large>
              BlueprintJS
            </Tag>
          </NavbarGroup>
          <NavbarGroup align="right" className="topbar__actions">
            <Button minimal icon="satellite" />
            <Button minimal icon="database" />
            <HTMLSelect
              value={role}
              onChange={(event) => setRole(event.target.value as MockRole)}
              options={[
                { label: "admin", value: "admin" },
                { label: "operator", value: "operator" },
                { label: "requestor", value: "requestor" },
              ]}
            />
            <Switch
              checked={darkMode}
              label="Dark"
              onChange={() => setDarkMode((current) => !current)}
            />
            <Button icon="layout-auto" intent="primary" onClick={() => setDialogOpen(true)}>
              구조 설명
            </Button>
          </NavbarGroup>
        </Navbar>

        <section className="workspace-layout">
          <aside className="sidebar-stack">
            <Card className="panel panel--sidebar">
              <div className="panel__title-row">
                <PanelTitle icon="map">Console Map</PanelTitle>
                <Tag minimal intent="primary">
                  Router
                </Tag>
              </div>
              <nav className="rail-links" aria-label="Primary">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">
                    <Icon icon="dashboard" />
                    <span>Dashboard</span>
                  </span>
                </NavLink>
                <NavLink
                  to="/orbit-track"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">
                    <Icon icon="globe-network" />
                    <span>Orbit Track</span>
                  </span>
                  <span className="rail-link__meta">대한민국 위성 궤도를 추적한다</span>
                </NavLink>
                {canAccessSatellites ? (
                  <NavLink
                    to="/satellites"
                    className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                  >
                    <span className="rail-link__title">
                      <Icon icon="satellite" />
                      <span>Satellites</span>
                    </span>
                    <span className="rail-link__meta">위성/기지국/요청자를 관리한다</span>
                  </NavLink>
                ) : null}
                <NavLink
                  to="/performance"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">
                    <Icon icon="timeline-area-chart" />
                    <span>Performance</span>
                  </span>
                </NavLink>
                <NavLink
                  to="/payload-monitoring"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">
                    <Icon icon="data-connection" />
                    <span>API Call Logs</span>
                  </span>
                </NavLink>
                {canSeeOperationsGroup ? (
                  <div className={`rail-group ${operationsOpen ? "is-open" : ""} ${operationsActive ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className={`rail-group__trigger ${operationsOpen || operationsActive ? "is-active" : ""}`}
                      aria-expanded={operationsOpen}
                      onClick={() => setOperationsOpen((current) => !current)}
                    >
                      <span className="rail-group__copy">
                        <span className="rail-link__title">
                          <Icon icon="pulse" />
                          <span>Self Diagnostics</span>
                        </span>
                      </span>
                      <span className="rail-group__chevron">{operationsOpen ? "▾" : "▸"}</span>
                    </button>
                    {operationsOpen ? (
                      <div className="rail-group__items">
                        {canSendUplink ? (
                          <NavLink
                            to="/uplink"
                            className={({ isActive }) => `rail-link rail-link--child ${isActive ? "is-active" : ""}`}
                          >
                            <span className="rail-link__title">
                              <Icon icon="send-to-graph" />
                              <span>Send a Uplink</span>
                            </span>
                            <span className="rail-link__meta">업링크 명령을 전송한다</span>
                          </NavLink>
                        ) : null}
                        {canRunScenarios ? (
                          <NavLink
                            to="/scenarios"
                            className={({ isActive }) => `rail-link rail-link--child ${isActive ? "is-active" : ""}`}
                          >
                            <span className="rail-link__title">
                              <Icon icon="projects" />
                              <span>Multi-Scenario</span>
                            </span>
                          </NavLink>
                        ) : null}
                        <NavLink
                          to="/commands"
                          className={({ isActive }) => `rail-link rail-link--child ${isActive ? "is-active" : ""}`}
                        >
                          <span className="rail-link__title">
                            <Icon icon="search-template" />
                            <span>Commands Monitor</span>
                          </span>
                        </NavLink>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </nav>
            </Card>

            <Card className="panel panel--sidebar">
              <div className="panel__title-row">
                <PanelTitle icon="time">Runtime Snapshot</PanelTitle>
                <Tag minimal intent="success">
                  API
                </Tag>
              </div>
              {loading ? (
                <div className="panel-loading">
                  <Spinner size={22} />
                  <span>bootstrap loading</span>
                </div>
              ) : error ? (
                <Callout icon="error" intent="danger">
                  {error}
                </Callout>
              ) : bootstrap ? (
                <>
                  <div className="tag-row">
                    <Tag minimal>React</Tag>
                    <Tag minimal>Blueprint</Tag>
                    <Tag minimal>Express</Tag>
                    <Tag minimal>SQLite</Tag>
                    <Tag minimal intent="primary">
                      {role}
                    </Tag>
                  </div>
                  <div className="console-facts">
                    <div className="console-facts__item">
                      <span>Service</span>
                      <strong>{bootstrap.health.service}</strong>
                    </div>
                    <div className="console-facts__item">
                      <span>DB</span>
                      <strong>{bootstrap.health.sqliteVersion}</strong>
                    </div>
                    <div className="console-facts__item">
                      <span>Commands</span>
                      <strong>{bootstrap.health.counts.commands}</strong>
                    </div>
                  </div>
                  <Callout icon="data-connection" intent="primary">
                    현재 셸은 `/api/sattie/*` 기준 타입과 라우트 구조로 전환됐다.
                  </Callout>
                  {!canAccessSatellites ? (
                    <Callout icon="lock" intent="warning">
                      {role === "operator"
                        ? "Operator 모드: Satellites 메뉴와 관리 액션은 비활성화된다."
                        : "Requestor 모드: Dashboard / Performance / Commands 읽기 흐름만 사용한다."}
                    </Callout>
                  ) : null}
                </>
              ) : null}
            </Card>
          </aside>

          <section className="content-stack">
            {loading ? (
              <Card className="panel panel--loading">
                <div className="panel-loading">
                  <Spinner />
                  <span>애플리케이션 데이터를 불러오는 중</span>
                </div>
              </Card>
            ) : error ? (
              <Card className="panel panel--loading">
                <Callout icon="error" intent="danger">
                  {error}
                </Callout>
              </Card>
            ) : bootstrap ? (
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={<SattieDashboardPage bootstrap={bootstrap} darkMode={darkMode} />}
                />
                <Route
                  path="/satellites"
                  element={
                    canAccessSatellites ? (
                      <SattieSatellitesPage
                        darkMode={darkMode}
                        satellites={bootstrap.satellites}
                        groundStations={bootstrap.groundStations}
                        requestors={bootstrap.requestors}
                        canManage={canManageInfra}
                        onDataChange={refreshBootstrap}
                      />
                    ) : (
                      <Navigate to="/dashboard" replace />
                    )
                  }
                />
                <Route
                  path="/orbit-track"
                  element={<SattieOrbitTrackPage satellites={bootstrap.satellites} />}
                />
                <Route
                  path="/performance"
                  element={<SattiePerformancePage satellites={bootstrap.satellites} />}
                />
                <Route path="/payload-monitoring" element={<SattiePayloadMonitoringPage />} />
                <Route
                  path="/uplink"
                  element={
                    canSendUplink ? (
                      <SattieUplinkPage
                        satellites={bootstrap.satellites}
                        groundStations={bootstrap.groundStations}
                        requestors={bootstrap.requestors}
                        canSend={canSendUplink}
                        onCommandCreated={refreshBootstrap}
                      />
                    ) : (
                      <Navigate to="/commands" replace />
                    )
                  }
                />
                <Route
                  path="/commands"
                  element={
                    <SattieCommandsPage
                      satellites={bootstrap.satellites}
                      onDataChange={refreshBootstrap}
                    />
                  }
                />
                <Route
                  path="/scenarios"
                  element={
                    canRunScenarios ? (
                      <SattieScenariosPage
                        scenarios={bootstrap.scenarios}
                        satellites={bootstrap.satellites}
                        groundStations={bootstrap.groundStations}
                        requestors={bootstrap.requestors}
                        canRun={canRunScenarios}
                        onDataChange={refreshBootstrap}
                      />
                    ) : (
                      <Navigate to="/commands" replace />
                    )
                  }
                />
              </Routes>
            ) : null}
          </section>
        </section>
      </main>

      <Dialog
        icon="dashboard"
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="현재 포팅 상태"
      >
        <div className={Classes.DIALOG_BODY}>
          <ol className="dialog-list">
            <li>`/api/sattie/*` 백엔드와 연결되는 프런트 타입과 API 계층을 추가했다.</li>
            <li>라우트는 Dashboard, Satellites, Orbit Track, Performance, Uplink, Commands, Scenarios로 재편했다.</li>
            <li>mock role mode(`admin`, `operator`, `requestor`)가 헤더와 메뉴 접근에 반영된다.</li>
          </ol>
          <div className="dialog-docs">
            <div className="dialog-docs__header">
              <strong>API 문서 바로가기</strong>
              <span className="subtle-text">구조 설명 확인 후 바로 문서 화면으로 이동할 수 있다.</span>
            </div>
            <div className="dialog-docs__actions">
              <AnchorButton
                href="/api/sattie/docs"
                target="_blank"
                rel="noreferrer"
                icon="document-open"
                intent="primary"
              >
                Swagger Docs
              </AnchorButton>
              <AnchorButton
                href="/api/sattie/redoc"
                target="_blank"
                rel="noreferrer"
                icon="manual"
              >
                ReDoc
              </AnchorButton>
            </div>
          </div>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setDialogOpen(false)}>닫기</Button>
            <Button intent="primary" onClick={() => setDialogOpen(false)}>
              확인
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
