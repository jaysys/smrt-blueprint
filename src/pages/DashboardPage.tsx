import { useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  Callout,
  Card,
  ProgressBar,
  Spinner,
  Tab,
  Tabs,
  Tag,
} from "@blueprintjs/core";
import { Cell, Column, Table2 } from "@blueprintjs/table";
import { DataTooltip } from "../components/DataTooltip";
import { getDashboard } from "../lib/api";
import type { DashboardResponse, DomainOption } from "../types";

interface DashboardPageProps {
  selectedDomain: DomainOption;
}

const emptyDashboard: DashboardResponse = {
  queueStats: [],
  statusRows: [],
  activityFeed: [],
  summary: {
    readiness: 0,
    widgets: 0,
    queues: 0,
    uptime: "-",
    syncLabel: "데이터 없음",
    pendingApprovals: 0,
  },
};

export function DashboardPage({ selectedDomain }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getDashboard(selectedDomain.id)
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "대시보드 로딩 실패");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDomain.id]);

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">Dashboard</p>
          <h1>{selectedDomain.label} 운영 현황</h1>
          <p className="page-copy">
            {selectedDomain.summary} 상태 테이블과 활동 피드를 함께 두어 운영자가 한 화면에서
            판단할 수 있게 구성했습니다.
          </p>
        </div>
        <DataTooltip content="SQLite `dashboard_summaries` 테이블에서 읽은 요약 값입니다.">
          <Card className="mini-summary">
            {loading ? (
              <div className="panel-loading">
                <Spinner size={22} />
                <span>대시보드 로딩 중</span>
              </div>
            ) : (
              <>
                <div className="mini-summary__row">
                  <span>Workspace readiness</span>
                  <Tag intent="success" minimal>
                    {dashboard.summary.readiness}%
                  </Tag>
                </div>
                <ProgressBar
                  animate
                  stripes
                  intent="success"
                  value={dashboard.summary.readiness / 100}
                />
                <div className="mini-summary__grid">
                  <div>
                    <strong>{dashboard.summary.widgets}</strong>
                    <span>widgets</span>
                  </div>
                  <div>
                    <strong>{dashboard.summary.queues}</strong>
                    <span>queues</span>
                  </div>
                  <div>
                    <strong>{dashboard.summary.uptime}</strong>
                    <span>uptime</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </DataTooltip>
      </section>

      {error ? (
        <Callout icon="error" intent="danger">
          {error}
        </Callout>
      ) : null}

      <section className="metric-grid">
        {dashboard.queueStats.map((item) => (
          <DataTooltip
            key={item.label}
            content="SQLite `queue_stats` 테이블에서 읽은 대시보드 KPI 카드입니다."
          >
            <Card className="metric-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <Tag minimal intent={item.intent}>
                live
              </Tag>
            </Card>
          </DataTooltip>
        ))}
      </section>

      <DataTooltip content="SQLite `domains`와 `dashboard_summaries`를 조합해 현재 도메인 상태를 표출하는 패널입니다.">
        <Card className="panel panel--feature">
          <div className="panel__title-row">
            <div>
              <p className="panel__eyebrow">Current domain</p>
              <h2>{selectedDomain.label}</h2>
            </div>
            <ButtonGroup>
              <Button icon="refresh">새로고침</Button>
              <Button intent="primary" icon="send-message">
                작업 실행
              </Button>
            </ButtonGroup>
          </div>
          <div className="panel__summary">
            <Tag large intent="primary">
              {selectedDomain.team}
            </Tag>
            <Tag large minimal intent="success">
              {dashboard.summary.syncLabel}
            </Tag>
            <Tag large minimal intent="warning">
              {dashboard.summary.pendingApprovals} approvals waiting
            </Tag>
          </div>
        </Card>
      </DataTooltip>

      <Card className="panel">
        <Tabs
          id="command-tabs"
          large
          selectedTabId={activeTab}
          onChange={(newTabId) => setActiveTab(String(newTabId))}
          renderActiveTabPanelOnly
        >
          <Tab
            id="overview"
            title="Overview"
            panel={
              <div className="tab-panel">
                <DataTooltip content="SQLite `status_rows` 테이블에서 읽은 운영 상태 테이블입니다.">
                  <div className="table-shell">
                    <Table2
                      defaultRowHeight={52}
                      enableRowHeader={false}
                      numRows={dashboard.statusRows.length}
                    >
                      <Column
                        id="area"
                        name="영역"
                        cellRenderer={(rowIndex) => {
                          const row = dashboard.statusRows[rowIndex];
                          return (
                            <Cell>
                              <div className="cell-stack">
                                <strong>{row?.area}</strong>
                                <span>{row?.owner}</span>
                              </div>
                            </Cell>
                          );
                        }}
                      />
                      <Column
                        id="status"
                        name="상태"
                        cellRenderer={(rowIndex) => {
                          const row = dashboard.statusRows[rowIndex];
                          return (
                            <Cell>
                              <Tag minimal intent={getIntent(row?.status ?? "")}>
                                {row?.status}
                              </Tag>
                            </Cell>
                          );
                        }}
                      />
                      <Column
                        id="progress"
                        name="진척도"
                        cellRenderer={(rowIndex) => {
                          const row = dashboard.statusRows[rowIndex];
                          return (
                            <Cell>
                              <div className="progress-cell">
                                <ProgressBar
                                  intent={getIntent(row?.status ?? "")}
                                  value={(row?.progress ?? 0) / 100}
                                />
                                <span>{row?.progress ?? 0}%</span>
                              </div>
                            </Cell>
                          );
                        }}
                      />
                      <Column
                        id="latency"
                        name="응답"
                        cellRenderer={(rowIndex) => <Cell>{dashboard.statusRows[rowIndex]?.latency}</Cell>}
                      />
                    </Table2>
                  </div>
                </DataTooltip>
              </div>
            }
          />
          <Tab
            id="activity"
            title="Activity"
            panel={
              <DataTooltip content="SQLite `activity_feed` 테이블에서 읽은 최근 활동 피드입니다.">
                <div className="tab-panel activity-list">
                  {dashboard.activityFeed.map((item) => (
                    <div key={item.title} className="activity-item">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <Tag minimal intent={item.intent}>
                        {item.time}
                      </Tag>
                    </div>
                  ))}
                </div>
              </DataTooltip>
            }
          />
          <Tab
            id="guidance"
            title="Guidance"
            panel={
              <div className="tab-panel guidance-grid">
                <Callout icon="add" intent="primary">
                  우선 `core`로 구조를 잡고, 필요한 밀도에 맞춰 `select`, `table`을 추가하는 편이
                  안정적입니다.
                </Callout>
                <Callout icon="desktop" intent="success">
                  큰 설명 블록보다 상태 카드와 표를 우선 노출하는 것이 운영 콘솔에는 더 맞습니다.
                </Callout>
                <Callout icon="database" intent="warning">
                  현재 데이터는 SQLite 샘플 DB에서 오므로, 프론트 변경 흐름을 API 기준으로 검토할
                  수 있습니다.
                </Callout>
              </div>
            }
          />
        </Tabs>
      </Card>
    </div>
  );
}

function getIntent(status: string) {
  switch (status) {
    case "안정":
      return "success";
    case "점검 중":
      return "warning";
    default:
      return "primary";
  }
}
