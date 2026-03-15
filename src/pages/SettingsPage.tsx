import { useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  Callout,
  Card,
  FormGroup,
  InputGroup,
  MenuItem,
  Spinner,
  Switch,
  Tag,
  TextArea,
} from "@blueprintjs/core";
import type { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import { Select } from "@blueprintjs/select";
import { DataTooltip } from "../components/DataTooltip";
import type {
  DomainOption,
  TeamOption,
  WorkspaceSettings,
} from "../types";

interface SettingsPageProps {
  domains: DomainOption[];
  onSaveSettings: (settings: WorkspaceSettings) => Promise<void>;
  settings: WorkspaceSettings;
  teams: TeamOption[];
}

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

export function SettingsPage({
  domains,
  onSaveSettings,
  settings,
  teams,
}: SettingsPageProps) {
  const [formState, setFormState] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  const selectedDomain =
    domains.find((domain) => domain.id === formState.selectedDomainId) ?? domains[0] ?? null;
  const selectedTeam =
    teams.find((team) => team.id === formState.defaultOwnerTeamId) ?? teams[0] ?? null;

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      await onSaveSettings(formState);
      setMessage("설정을 저장했습니다.");
    } catch (requestError) {
      setMessage(
        requestError instanceof Error ? requestError.message : "설정 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">Settings</p>
          <h1>워크스페이스 기본 설정</h1>
          <p className="page-copy">
            전역 도메인, 기본 팀, 설명과 같은 운영 콘솔 기본값을 관리하는 페이지입니다.
          </p>
        </div>
        <DataTooltip content="SQLite `settings`, `domains`, `teams` 조합으로 계산한 현재 워크스페이스 설정 요약입니다.">
          <Card className="mini-summary">
            {saving ? (
              <div className="panel-loading">
                <Spinner size={22} />
                <span>설정 저장 중</span>
              </div>
            ) : (
              <div className="mini-summary__grid">
                <div>
                  <strong>{selectedDomain?.label ?? "-"}</strong>
                  <span>active domain</span>
                </div>
                <div>
                  <strong>{selectedTeam?.label ?? "-"}</strong>
                  <span>default owner</span>
                </div>
                <div>
                  <strong>{formState.notificationsEnabled ? "On" : "Off"}</strong>
                  <span>alerts</span>
                </div>
              </div>
            )}
          </Card>
        </DataTooltip>
      </section>

      <section className="detail-grid">
        <DataTooltip content="SQLite `settings`, `domains`, `teams`를 읽고 `/api/settings`로 저장하는 설정 폼입니다.">
          <Card className="panel">
            <div className="panel__title-row">
              <h2>Workspace Preferences</h2>
              <Tag minimal intent="primary">
                API Forms
              </Tag>
            </div>
            <FormGroup label="기본 도메인" labelFor="settings-domain">
              <Select<DomainOption>
                items={domains}
                itemPredicate={filterDomain}
                itemRenderer={renderDomain}
                noResults={<MenuItem disabled text="No results." roleStructure="listoption" />}
                onItemSelect={(domain) =>
                  setFormState((current) => ({ ...current, selectedDomainId: domain.id }))
                }
              >
                <Button
                  id="settings-domain"
                  alignText="start"
                  endIcon="caret-down"
                  fill
                  icon="globe-network"
                  text={
                    selectedDomain == null
                      ? "도메인 선택"
                      : `${selectedDomain.label} · ${selectedDomain.team}`
                  }
                />
              </Select>
            </FormGroup>
            <FormGroup label="기본 오너 팀" labelFor="settings-team">
              <Select<TeamOption>
                items={teams}
                itemPredicate={filterTeam}
                itemRenderer={renderTeam}
                noResults={<MenuItem disabled text="No results." roleStructure="listoption" />}
                onItemSelect={(team) =>
                  setFormState((current) => ({ ...current, defaultOwnerTeamId: team.id }))
                }
              >
                <Button
                  id="settings-team"
                  alignText="start"
                  endIcon="caret-down"
                  fill
                  icon="people"
                  text={
                    selectedTeam == null
                      ? "오너 팀 선택"
                      : `${selectedTeam.label} · ${selectedTeam.role}`
                  }
                />
              </Select>
            </FormGroup>
            <FormGroup label="워크스페이스 이름" labelFor="workspace-name">
              <InputGroup
                id="workspace-name"
                leftIcon="cube"
                value={formState.workspaceName}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, workspaceName: value }))
                }
              />
            </FormGroup>
            <FormGroup label="설명" labelFor="workspace-description">
              <TextArea
                id="workspace-description"
                autoResize
                fill
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
              />
            </FormGroup>
            <Switch
              checked={formState.notificationsEnabled}
              label="운영 알림 활성화"
              onChange={() =>
                setFormState((current) => ({
                  ...current,
                  notificationsEnabled: !current.notificationsEnabled,
                }))
              }
            />
            {message ? (
              <Callout icon="info-sign" intent="success" className="stack-actions">
                {message}
              </Callout>
            ) : null}
            <div className="stack-actions">
              <ButtonGroup fill>
                <Button intent="primary" icon="floppy-disk" loading={saving} onClick={handleSave}>
                  저장
                </Button>
                <Button icon="reset" onClick={() => setFormState(settings)}>
                  초기화
                </Button>
              </ButtonGroup>
            </div>
          </Card>
        </DataTooltip>

        <Card className="panel">
          <div className="panel__title-row">
            <h2>Backend Notes</h2>
            <Tag minimal intent="success">
              SQLite
            </Tag>
          </div>
          <div className="guidance-grid">
            <Callout icon="application" intent="primary">
              현재 설정은 SQLite `settings` 테이블에 저장됩니다. 저장 후 앱 전역 상태도 함께 갱신됩니다.
            </Callout>
            <Callout icon="properties" intent="success">
              공통 필터는 좌측 레일에 두고, 라우트별 패널은 우측 메인 영역에서 바꾸는 구조를
              유지했습니다.
            </Callout>
            <Callout icon="th" intent="warning">
              샘플 단계에서는 SQLite가 충분하지만, 동시성이나 권한 감사가 커지면 RDBMS 본 서버로
              옮겨야 합니다.
            </Callout>
          </div>
        </Card>
      </section>
    </div>
  );
}
