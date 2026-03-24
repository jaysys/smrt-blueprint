import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Callout, Card, Collapse, HTMLTable, Icon, InputGroup, Spinner, Switch, Tag } from "@blueprintjs/core";
import { PanelTitle } from "../components/PanelTitle";
import { useLocation, useSearchParams } from "react-router-dom";
import { getCommand, getCommands, rerunCommand } from "../lib/sattieApi";
import type { CommandState, CommandStatus, Satellite } from "../sattie-types";

const TIMELINE_STEPS: Array<{ id: CommandState; label: string; icon: string }> = [
  { id: "ACKED", label: "ACKED", icon: "endorsed" },
  { id: "QUEUED", label: "QUEUED", icon: "time" },
  { id: "ACCESSING_AOI", label: "Accessing AOI", icon: "satellite" },
  { id: "CAPTURING", label: "CAPTURING", icon: "camera" },
  { id: "DOWNLINK_READY", label: "DOWNLINK_READY", icon: "cloud-download" },
];

interface SattieCommandsPageProps {
  onDataChange?: () => Promise<void> | void;
  satellites: Satellite[];
}

function formatKstDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
}

function isTerminalState(state: CommandState) {
  return state === "DOWNLINK_READY" || state === "FAILED";
}

function getTimelineStepStatus(
  selectedCommand: CommandStatus | null,
  stepId: CommandState,
) {
  if (selectedCommand == null) {
    return { active: false, complete: false, failed: false };
  }

  const currentState = selectedCommand.state;
  const progressIndexByState: Record<CommandState, number> = {
    ACKED: 0,
    QUEUED: 1,
    ACCESSING_AOI: 2,
    CAPTURING: 3,
    DOWNLINK_READY: 4,
    FAILED: 5,
  };

  const currentIndex = progressIndexByState[currentState];
  const failed = currentState === "FAILED" && stepId === "CAPTURING";

  if (currentState === "DOWNLINK_READY") {
    return {
      active: false,
      complete: stepId === "DOWNLINK_READY",
      failed: false,
    };
  }

  if (currentState === "FAILED") {
    return {
      active: false,
      complete: stepId !== "DOWNLINK_READY" && stepId !== "CAPTURING",
      failed,
    };
  }

  const stepIndex = progressIndexByState[stepId];
  const active = stepId === currentState;
  const complete =
    !active &&
    !failed &&
    currentIndex > stepIndex;

  return { active, complete, failed };
}

export function SattieCommandsPage({ onDataChange, satellites }: SattieCommandsPageProps) {
  const completedPageSize = 20;
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const commandLookupRef = useRef<HTMLDivElement | null>(null);
  const [commands, setCommands] = useState<CommandStatus[]>([]);
  const [commandIdInput, setCommandIdInput] = useState(searchParams.get("commandId") ?? "");
  const [selectedCommand, setSelectedCommand] = useState<CommandStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);

  const sortedCommands = useMemo(
    () => commands.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))),
    [commands],
  );
  const completedPageCount = Math.max(1, Math.ceil(sortedCommands.length / completedPageSize));
  const pagedCommands = useMemo(() => {
    const startIndex = (completedPage - 1) * completedPageSize;
    return sortedCommands.slice(startIndex, startIndex + completedPageSize);
  }, [completedPage, sortedCommands]);

  async function refreshCommands() {
    const items = await getCommands();
    setCommands(items);
    return items;
  }

  async function fetchSelectedCommand(commandId: string) {
    if (!commandId.trim()) {
      return null;
    }

    setFetching(true);
    setError(null);

    try {
      const command = await getCommand(commandId.trim());
      const stateChanged = selectedCommand?.command_id === command.command_id && selectedCommand.state !== command.state;
      setSelectedCommand(command);
      setCommandIdInput(command.command_id);
      setSearchParams({ commandId: command.command_id });
      const items = await refreshCommands();
      const fromList = items.find((item) => item.command_id === command.command_id);
      if (fromList) {
        setSelectedCommand(fromList);
      }
      if (stateChanged) {
        await onDataChange?.();
      }
      return command;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Command fetch failed");
      return null;
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const items = await getCommands();
        if (cancelled) {
          return;
        }
        setCommands(items);
        const commandId = searchParams.get("commandId");
        if (commandId) {
          setCommandIdInput(commandId);
          const command = await getCommand(commandId);
          if (!cancelled) {
            setSelectedCommand(command);
          }
        } else if (!cancelled) {
          setCommandIdInput("");
          setSelectedCommand(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Commands load failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!autoPoll || selectedCommand == null || isTerminalState(selectedCommand.state)) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchSelectedCommand(selectedCommand.command_id);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoPoll, selectedCommand]);

  useEffect(() => {
    if (location.hash !== "#command-lookup") {
      return;
    }

    commandLookupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, selectedCommand?.command_id]);

  useEffect(() => {
    setCompletedPage((current) => Math.min(current, completedPageCount));
  }, [completedPageCount]);

  async function handleRerun() {
    if (selectedCommand == null) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const command = await rerunCommand(selectedCommand.command_id);
      setSelectedCommand(command);
      await refreshCommands();
      await onDataChange?.();
      setActionMessage(`Retry started for ${command.command_id}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Retry failed");
    } finally {
      setActionLoading(false);
    }
  }

  const readyCount = commands.filter((item) => item.state === "DOWNLINK_READY").length;
  const failedCount = commands.filter((item) => item.state === "FAILED").length;
  const inProgressCount = commands.filter((item) => !isTerminalState(item.state)).length;

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">Commands Monitor</p>
          <h1>Command Tracking</h1>
          <p className="page-copy">
            command 단건 조회, auto poll, 상태 타임라인, rerun, save-local, download 흐름을
            한 화면에서 추적하는 콘솔이다.
          </p>
        </div>
        <Card className="mini-summary">
          {loading ? (
            <div className="panel-loading">
              <Spinner size={22} />
              <span>commands loading</span>
            </div>
          ) : (
            <div className="mini-summary__grid">
              <div>
                <strong>{commands.length}</strong>
                <span>tracked commands</span>
              </div>
              <div>
                <strong>{readyCount}</strong>
                <span>downlink ready</span>
              </div>
              <div>
                <strong>{failedCount}</strong>
                <span>failed</span>
              </div>
            </div>
          )}
        </Card>
      </section>

      {error ? (
        <Callout icon="error" intent="danger">
          {error}
        </Callout>
      ) : null}

      {actionMessage ? (
        <Callout icon="endorsed" intent="success">
          {actionMessage}
        </Callout>
      ) : null}

      <section className="detail-grid">
        <Card className="panel" id="command-lookup" ref={commandLookupRef}>
          <div className="panel__title-row">
            <PanelTitle icon="search">Command Lookup</PanelTitle>
            <Tag minimal intent="primary">
              Fetch
            </Tag>
          </div>
          <div className="form-stack">
            <div className="action-row">
              <InputGroup
                fill
                leftIcon="search"
                value={commandIdInput}
                onValueChange={setCommandIdInput}
                placeholder="cmd-xxxxxxxxxxxx"
              />
              <Button loading={fetching} onClick={() => void fetchSelectedCommand(commandIdInput)}>
                Fetch
              </Button>
            </div>
            <Switch
              checked={autoPoll}
              label={`Auto Poll: ${autoPoll ? "ON" : "OFF"}`}
              onChange={() => setAutoPoll((current) => !current)}
            />
            <div className="timeline">
              {TIMELINE_STEPS.map((step) => {
                const { active, complete, failed } = getTimelineStepStatus(selectedCommand, step.id);
                const statusText = failed ? "Interrupted" : step.id === "DOWNLINK_READY" ? "Passed" : "Waiting";

                return (
                  <span
                    data-step={step.id}
                    key={step.id}
                    className={`timeline__step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""} ${failed ? "is-failed" : ""}`}
                  >
                    <span className="timeline__step-icon">
                      <Icon icon={step.icon as never} />
                    </span>
                    <span className="timeline__step-copy">
                      <span className="timeline__step-label">{step.label}</span>
                      <span className="timeline__step-status">{statusText}</span>
                    </span>
                  </span>
                );
              })}
            </div>
            <Callout icon="info-sign" intent={selectedCommand ? getStateIntent(selectedCommand.state) : "primary"}>
              {selectedCommand ? (
                <div className="callout-stack">
                  <div>{`State: ${selectedCommand.state}`}</div>
                  <div>
                    {(selectedCommand.archived_image_relative_path || selectedCommand.archived_image_path)
                      ? `Message: Image downlinked and ready at ${selectedCommand.archived_image_relative_path ?? selectedCommand.archived_image_path}`
                      : `Message: ${selectedCommand.message ?? "-"}`}
                  </div>
                </div>
              ) : (
                "No command selected."
              )}
            </Callout>
            <div className="button-cluster">
              <Button
                intent="warning"
                loading={actionLoading}
                disabled={selectedCommand == null || selectedCommand.state !== "FAILED"}
                onClick={() => void handleRerun()}
              >
                Retry Failed Command
              </Button>
              {selectedCommand?.download_url ? (
                <a
                  className="bp6-button bp6-intent-success"
                  href={selectedCommand.download_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download Image
                </a>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="panel">
          <div className="panel__title-row">
              <PanelTitle icon="document-open">Command Detail</PanelTitle>
            <div className="button-cluster">
              <Tag minimal intent="success">
                JSON
              </Tag>
              <Button minimal small onClick={() => setMetadataOpen((current) => !current)}>
                {metadataOpen ? "접기" : "Command 정보 펼치기"}
              </Button>
            </div>
          </div>
          <Collapse isOpen={metadataOpen}>
            <pre className="json-panel">
              {JSON.stringify(
                selectedCommand
                  ? {
                      archived_image_relative_path: selectedCommand.archived_image_relative_path,
                      archived_image_path: selectedCommand.archived_image_path,
                      acquisition_metadata: selectedCommand.acquisition_metadata,
                      product_metadata: selectedCommand.product_metadata,
                    }
                  : {},
                null,
                2,
              )}
            </pre>
          </Collapse>
        </Card>
      </section>

      <Card className="panel">
        <div className="panel__title-row">
          <PanelTitle icon="media">Completed Image Links</PanelTitle>
          <Tag minimal intent="success">
            Total {commands.length} | Ready {readyCount} | Failed {failedCount} | In Progress {inProgressCount}
          </Tag>
        </div>
        <HTMLTable bordered interactive striped className="data-table">
          <thead>
            <tr>
              <th>Command ID</th>
              <th>Satellite Name</th>
              <th>Image Created At (KST)</th>
              <th>업무이름</th>
              <th>대상지역명칭</th>
              <th>Ground Station</th>
              <th>Requestor ID</th>
              <th>State</th>
              <th>Downlink</th>
            </tr>
          </thead>
          <tbody>
            {pagedCommands.length === 0 ? (
              <tr>
                <td colSpan={9} className="subtle-text">
                  No command data.
                </td>
              </tr>
            ) : (
              pagedCommands.map((command) => (
                <tr key={command.command_id}>
                  <td>
                    <Button minimal small onClick={() => void fetchSelectedCommand(command.command_id)}>
                      {command.command_id}
                    </Button>
                  </td>
                  <td>{satellites.find((item) => item.satellite_id === command.satellite_id)?.name ?? command.satellite_id}</td>
                  <td>{formatKstDateTime(String(command.acquisition_metadata?.captured_at ?? command.updated_at ?? ""))}</td>
                  <td>{command.mission_name || "(none)"}</td>
                  <td>{command.aoi_name || "(none)"}</td>
                  <td>{command.ground_station_name || command.ground_station_id || "(none)"}</td>
                  <td>{command.requestor_id || "(none)"}</td>
                  <td>
                    <Tag minimal intent={getStateIntent(command.state)}>
                      {command.state}
                    </Tag>
                  </td>
                  <td>
                    {command.download_url ? (
                      <div className="downlink-cell">
                        <a href={command.download_url} target="_blank" rel="noreferrer">
                          <img
                            className="downlink-thumb"
                            src={command.download_url}
                            alt="downlink thumbnail"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        </a>
                        <a href={command.download_url} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </div>
                    ) : command.state === "FAILED" ? (
                      <span className="text-danger">FAILED</span>
                    ) : (
                      <span className="subtle-text">Not Ready</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </HTMLTable>
        {sortedCommands.length > completedPageSize ? (
          <div className="pagination-row">
            <span className="subtle-text">
              {`${completedPage} / ${completedPageCount} 페이지 · 총 ${sortedCommands.length}건`}
            </span>
            <div className="button-cluster">
              <Button
                small
                icon="chevron-left"
                disabled={completedPage <= 1}
                onClick={() => setCompletedPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                small
                icon="chevron-right"
                disabled={completedPage >= completedPageCount}
                onClick={() => setCompletedPage((current) => Math.min(completedPageCount, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function getStateIntent(state: CommandStatus["state"]) {
  switch (state) {
    case "DOWNLINK_READY":
      return "success";
    case "FAILED":
      return "danger";
    case "CAPTURING":
    case "ACCESSING_AOI":
      return "warning";
    default:
      return "primary";
  }
}
