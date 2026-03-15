import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Callout,
  Card,
  Classes,
  Dialog,
  FormGroup,
  InputGroup,
  MenuItem,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  Spinner,
  Switch,
  Tag,
} from "@blueprintjs/core";
import type { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import { Select } from "@blueprintjs/select";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { DataTooltip } from "./components/DataTooltip";
import { getBootstrap, updateSettings } from "./lib/api";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { DomainOption, TeamOption, WorkspaceSettings } from "./types";

const filterDomain: ItemPredicate<DomainOption> = (query, domain) => {
  const normalizedQuery = query.toLowerCase();
  return `${domain.label} ${domain.team} ${domain.summary}`.toLowerCase().includes(normalizedQuery);
};

const renderDomain: ItemRenderer<DomainOption> = (domain, { handleClick, handleFocus, modifiers }) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }

  return (
    <MenuItem
      active={modifiers.active}
      key={domain.id}
      label={domain.team}
      onClick={handleClick}
      onFocus={handleFocus}
      roleStructure="listoption"
      text={domain.label}
    />
  );
};

export function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getBootstrap()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setDomains(data.domains);
        setTeams(data.teams);
        setSettings(data.settings);
        setSelectedDomainId(data.settings.selectedDomainId);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "부트스트랩 로딩 실패");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? domains[0] ?? null,
    [domains, selectedDomainId],
  );

  async function handleSaveSettings(nextSettings: WorkspaceSettings) {
    const response = await updateSettings(nextSettings);
    setSettings(response.settings);
    setSelectedDomainId(response.settings.selectedDomainId);
  }

  return (
    <div className={`app-shell ${darkMode ? Classes.DARK : ""}`}>
      <div className="app-backdrop" />
      <main className="app-frame">
        <Navbar className="topbar">
          <NavbarGroup align="left" className="topbar__brand">
            <NavbarHeading>Palantir Blueprint Sample</NavbarHeading>
            <NavbarDivider />
            <Tag minimal round large>
              Command Console
            </Tag>
          </NavbarGroup>
          <NavbarGroup align="right" className="topbar__actions">
            <Button minimal icon="notifications" />
            <Button minimal icon="history" />
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
                <h2>Console Map</h2>
                <Tag minimal intent="primary">
                  Router
                </Tag>
              </div>
              <nav className="rail-links" aria-label="Primary">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">Dashboard</span>
                  <span className="rail-link__meta">실시간 관제와 활동 피드</span>
                </NavLink>
                <NavLink
                  to="/approvals"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">Approvals</span>
                  <span className="rail-link__meta">승인 큐와 담당자 할당</span>
                </NavLink>
                <NavLink
                  to="/settings"
                  className={({ isActive }) => `rail-link ${isActive ? "is-active" : ""}`}
                >
                  <span className="rail-link__title">Settings</span>
                  <span className="rail-link__meta">도메인 기본값과 콘솔 설정</span>
                </NavLink>
              </nav>
            </Card>

            <DataTooltip content="SQLite `domains`, `teams`, `settings` 테이블을 `/api/bootstrap`으로 읽어온 필터 패널입니다.">
              <Card className="panel panel--sidebar">
                <div className="panel__title-row">
                  <h2>Workspace Filters</h2>
                  <Tag minimal intent="success">
                    API
                  </Tag>
                </div>
                {loading ? (
                  <div className="panel-loading">
                    <Spinner size={22} />
                    <span>필터 로딩 중</span>
                  </div>
                ) : error ? (
                  <Callout icon="error" intent="danger">
                    {error}
                  </Callout>
                ) : selectedDomain != null ? (
                  <>
                    <FormGroup label="기준 도메인" labelFor="domain-select-button">
                      <Select<DomainOption>
                        items={domains}
                        itemPredicate={filterDomain}
                        itemRenderer={renderDomain}
                        noResults={
                          <MenuItem disabled text="No results." roleStructure="listoption" />
                        }
                        onItemSelect={(domain) => setSelectedDomainId(domain.id)}
                      >
                        <Button
                          id="domain-select-button"
                          alignText="start"
                          endIcon="caret-down"
                          fill
                          icon="database"
                          text={`${selectedDomain.label} · ${selectedDomain.team}`}
                        />
                      </Select>
                    </FormGroup>
                    <FormGroup label="빠른 검색" labelFor="workspace-search">
                      <InputGroup
                        id="workspace-search"
                        leftIcon="search"
                        placeholder="서비스, 팀, 큐 검색"
                      />
                    </FormGroup>
                    <div className="tag-row">
                      <Tag minimal>SQLite</Tag>
                      <Tag minimal>Express API</Tag>
                      <Tag minimal>Blueprint</Tag>
                    </div>
                    <Callout icon="data-connection" intent="primary">
                      현재 좌측 필터와 각 페이지 데이터는 `sqlite3` 샘플 DB를 읽습니다.
                    </Callout>
                  </>
                ) : null}
              </Card>
            </DataTooltip>
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
            ) : selectedDomain != null && settings != null ? (
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage selectedDomain={selectedDomain} />} />
                <Route
                  path="/approvals"
                  element={
                    <ApprovalsPage
                      selectedDomain={selectedDomain}
                      teams={teams}
                      defaultReviewerId={settings.defaultOwnerTeamId}
                    />
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <SettingsPage
                      domains={domains}
                      teams={teams}
                      settings={settings}
                      onSaveSettings={handleSaveSettings}
                    />
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
        title="이번 확장에서 추가한 것"
      >
        <div className={Classes.DIALOG_BODY}>
          <ol className="dialog-list">
            <li>프론트가 목데이터 대신 SQLite 기반 Express API를 읽도록 전환했습니다.</li>
            <li>설정 저장과 승인 담당자 배정이 DB 업데이트를 통과하도록 구성했습니다.</li>
            <li>Vite 개발 서버는 `/api`를 백엔드 포트 `3001`로 프록시합니다.</li>
          </ol>
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
