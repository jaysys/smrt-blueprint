import type { Intent } from "@blueprintjs/core";

export interface DomainOption {
  id: string;
  label: string;
  team: string;
  summary: string;
}

export interface TeamOption {
  id: string;
  label: string;
  role: string;
}

export interface StatusRow {
  area: string;
  owner: string;
  status: string;
  progress: number;
  latency: string;
}

export interface ActivityItem {
  title: string;
  detail: string;
  time: string;
  intent: Intent;
}

export interface QueueStat {
  label: string;
  value: string;
  intent: Intent;
}

export type ApprovalState = "대기" | "검토 중" | "승인 필요" | "승인 완료";
export type ApprovalPriority = "P1" | "P2" | "P3";
export type PermissionLevel = "viewer" | "editor" | "approver" | "admin";
export type ServerHealth = "healthy" | "degraded" | "incident";
export type AuditSeverity = "primary" | "success" | "warning" | "danger";

export interface ApprovalRow {
  id: number;
  request: string;
  requester: string;
  priority: ApprovalPriority;
  state: ApprovalState;
  age: string;
  domainId: string;
  reviewerId: string | null;
  reviewerLabel: string | null;
}

export interface ApprovalComment {
  id: number;
  approvalId: number;
  authorId: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  domainId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  severity: AuditSeverity;
  createdAt: string;
}

export interface PermissionEntry {
  id: number;
  domainId: string;
  subject: string;
  resource: string;
  level: PermissionLevel;
  inherited: boolean;
}

export interface ServerItem {
  id: string;
  domainId: string;
  name: string;
  environment: string;
  status: ServerHealth;
  latency: string;
  cpu: number;
  memory: number;
  lastChecked: string;
  incident: string | null;
}

export interface WorkspaceSettings {
  selectedDomainId: string;
  defaultOwnerTeamId: string;
  workspaceName: string;
  description: string;
  notificationsEnabled: boolean;
}

export interface DashboardSummary {
  readiness: number;
  widgets: number;
  queues: number;
  uptime: string;
  syncLabel: string;
  pendingApprovals: number;
}

export interface BootstrapResponse {
  domains: DomainOption[];
  teams: TeamOption[];
  settings: WorkspaceSettings;
}

export interface DashboardResponse {
  queueStats: QueueStat[];
  statusRows: StatusRow[];
  activityFeed: ActivityItem[];
  summary: DashboardSummary;
}

export interface ApprovalsResponse {
  approvals: ApprovalRow[];
}

export interface ApprovalDetailResponse {
  approval: ApprovalRow;
  comments: ApprovalComment[];
  auditLogs: AuditLog[];
}

export interface ServersResponse {
  servers: ServerItem[];
}

export interface PermissionsResponse {
  permissions: PermissionEntry[];
}

export interface AuditLogsResponse {
  auditLogs: AuditLog[];
}
