import { useEffect, useMemo, useState } from "react";
import {
  Button,
  ButtonGroup,
  Callout,
  Card,
  FormGroup,
  MenuItem,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import type { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import { Select } from "@blueprintjs/select";
import { Cell, Column, Table2 } from "@blueprintjs/table";
import { DataTooltip } from "../components/DataTooltip";
import { assignApprovals, getApprovals } from "../lib/api";
import type { ApprovalRow, DomainOption, TeamOption } from "../types";

interface ApprovalsPageProps {
  defaultReviewerId: string;
  selectedDomain: DomainOption;
  teams: TeamOption[];
}

const filterTeam: ItemPredicate<TeamOption> = (query, team) => {
  const normalizedQuery = query.toLowerCase();
  return `${team.label} ${team.role}`.toLowerCase().includes(normalizedQuery);
};

const renderTeam: ItemRenderer<TeamOption> = (team, { handleClick, handleFocus, modifiers }) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }

  return (
    <MenuItem
      active={modifiers.active}
      key={team.id}
      label={team.role}
      onClick={handleClick}
      onFocus={handleFocus}
      roleStructure="listoption"
      text={team.label}
    />
  );
};

export function ApprovalsPage({
  defaultReviewerId,
  selectedDomain,
  teams,
}: ApprovalsPageProps) {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<TeamOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedReviewer(
      teams.find((team) => team.id === defaultReviewerId) ?? teams[0] ?? null,
    );
  }, [defaultReviewerId, teams]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setAssignMessage(null);

    getApprovals(selectedDomain.id)
      .then((data) => {
        if (!cancelled) {
          setRows(data.approvals);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "승인 큐 로딩 실패");
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

  const criticalCount = useMemo(
    () => rows.filter((row) => row.priority === "P1").length,
    [rows],
  );

  async function handleAssign() {
    if (selectedReviewer == null) {
      return;
    }

    setAssigning(true);
    setAssignMessage(null);

    try {
      const response = await assignApprovals(selectedDomain.id, selectedReviewer.id);
      setRows((currentRows) =>
        currentRows.map((row) => ({ ...row, reviewerId: selectedReviewer.id })),
      );
      setAssignMessage(`${response.updatedCount}건을 ${selectedReviewer.label}에게 배정했습니다.`);
    } catch (requestError) {
      setAssignMessage(
        requestError instanceof Error ? requestError.message : "승인 배정에 실패했습니다.",
      );
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">Approvals</p>
          <h1>{selectedDomain.label} 승인 큐</h1>
          <p className="page-copy">
            선택한 도메인 기준으로 승인 요청을 묶고, 담당 리뷰어를 즉시 배정할 수 있게
            구성했습니다.
          </p>
        </div>
        <DataTooltip content="SQLite `approvals` 테이블을 집계한 승인 큐 요약 카드입니다.">
          <Card className="mini-summary">
            {loading ? (
              <div className="panel-loading">
                <Spinner size={22} />
                <span>승인 큐 로딩 중</span>
              </div>
            ) : (
              <div className="mini-summary__grid">
                <div>
                  <strong>{rows.length}</strong>
                  <span>visible items</span>
                </div>
                <div>
                  <strong>{criticalCount}</strong>
                  <span>P1 critical</span>
                </div>
                <div>
                  <strong>{selectedReviewer?.label ?? "-"}</strong>
                  <span>assigned reviewer</span>
                </div>
              </div>
            )}
          </Card>
        </DataTooltip>
      </section>

      {error ? (
        <Callout icon="error" intent="danger">
          {error}
        </Callout>
      ) : null}

      <section className="split-grid">
        <DataTooltip content="SQLite `approvals` 테이블에서 읽은 승인 큐 본문 테이블입니다.">
          <Card className="panel">
            <div className="panel__title-row">
              <h2>Approval Queue Table</h2>
              <Tag minimal intent="warning">
                Table
              </Tag>
            </div>
            <div className="table-shell table-shell--large">
              <Table2 defaultRowHeight={54} enableRowHeader={false} numRows={rows.length}>
                <Column
                  id="request"
                  name="요청"
                  cellRenderer={(rowIndex) => {
                    const row = rows[rowIndex];
                    return (
                      <Cell>
                        <div className="cell-stack">
                          <strong>{row?.request}</strong>
                          <span>{row?.requester}</span>
                        </div>
                      </Cell>
                    );
                  }}
                />
                <Column
                  id="priority"
                  name="우선순위"
                  cellRenderer={(rowIndex) => {
                    const row = rows[rowIndex];
                    return (
                      <Cell>
                        <Tag minimal intent={getPriorityIntent(row?.priority ?? "P3")}>
                          {row?.priority}
                        </Tag>
                      </Cell>
                    );
                  }}
                />
                <Column
                  id="state"
                  name="상태"
                  cellRenderer={(rowIndex) => {
                    const row = rows[rowIndex];
                    return (
                      <Cell>
                        <Tag minimal intent={getStateIntent(row?.state ?? "대기")}>
                          {row?.state}
                        </Tag>
                      </Cell>
                    );
                  }}
                />
                <Column id="age" name="경과" cellRenderer={(rowIndex) => <Cell>{rows[rowIndex]?.age}</Cell>} />
              </Table2>
            </div>
          </Card>
        </DataTooltip>

        <div className="detail-stack">
          <DataTooltip content="SQLite `teams`와 `approvals`를 기반으로 리뷰어를 선택하고 `/api/approvals/assign`으로 DB에 반영하는 패널입니다.">
            <Card className="panel">
              <div className="panel__title-row">
                <h2>Assign Reviewer</h2>
                <Tag minimal intent="primary">
                  API
                </Tag>
              </div>
              <FormGroup label="담당 리뷰어" labelFor="reviewer-select">
                <Select<TeamOption>
                  items={teams}
                  itemPredicate={filterTeam}
                  itemRenderer={renderTeam}
                  noResults={<MenuItem disabled text="No results." roleStructure="listoption" />}
                  onItemSelect={setSelectedReviewer}
                >
                  <Button
                    id="reviewer-select"
                    alignText="start"
                    endIcon="caret-down"
                    fill
                    icon="people"
                    text={
                      selectedReviewer == null
                        ? "리뷰어 선택"
                        : `${selectedReviewer.label} · ${selectedReviewer.role}`
                    }
                  />
                </Select>
              </FormGroup>
              <Callout icon="endorsed" intent="primary">
                선택된 도메인의 승인 요청을 지정 리뷰어에게 일괄 배정합니다. 변경은 SQLite DB에
                반영됩니다.
              </Callout>
              {assignMessage ? (
                <Callout icon="info-sign" intent="success" className="stack-actions">
                  {assignMessage}
                </Callout>
              ) : null}
              <div className="stack-actions">
                <ButtonGroup fill>
                  <Button
                    intent="primary"
                    icon="endorsed"
                    loading={assigning}
                    onClick={handleAssign}
                  >
                    승인 진행
                  </Button>
                  <Button icon="send-message">코멘트 남기기</Button>
                </ButtonGroup>
              </div>
            </Card>
          </DataTooltip>

          <Card className="panel">
            <div className="panel__title-row">
              <h2>Policy Notes</h2>
              <Tag minimal>Ops</Tag>
            </div>
            <div className="activity-list">
              {rows.slice(0, 3).map((row) => (
                <div key={row.id} className="activity-item">
                  <div>
                    <strong>{row.request}</strong>
                    <p>{row.requester}</p>
                  </div>
                  <Tag minimal intent={getPriorityIntent(row.priority)}>
                    {row.priority}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function getPriorityIntent(priority: ApprovalRow["priority"]) {
  switch (priority) {
    case "P1":
      return "danger";
    case "P2":
      return "warning";
    default:
      return "primary";
  }
}

function getStateIntent(state: ApprovalRow["state"]) {
  switch (state) {
    case "승인 필요":
      return "danger";
    case "검토 중":
      return "warning";
    default:
      return "primary";
  }
}
