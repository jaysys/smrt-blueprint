import type {
  ApprovalDetailResponse,
  ApprovalState,
  ApprovalsResponse,
  AuditLogsResponse,
  BootstrapResponse,
  DashboardResponse,
  PermissionLevel,
  PermissionsResponse,
  ServersResponse,
  WorkspaceSettings,
} from "../types";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getBootstrap() {
  return request<BootstrapResponse>("/api/bootstrap");
}

export function getDashboard(domainId: string) {
  return request<DashboardResponse>(`/api/dashboard?domainId=${encodeURIComponent(domainId)}`);
}

export function getApprovals(domainId: string) {
  return request<ApprovalsResponse>(`/api/approvals?domainId=${encodeURIComponent(domainId)}`);
}

export function getApprovalDetail(approvalId: number) {
  return request<ApprovalDetailResponse>(`/api/approvals/${approvalId}`);
}

export function updateApprovalState(approvalId: number, state: ApprovalState, actor: string) {
  return request<{ approval: ApprovalDetailResponse["approval"] }>(`/api/approvals/${approvalId}/state`, {
    method: "POST",
    body: JSON.stringify({ state, actor }),
  });
}

export function addApprovalComment(approvalId: number, authorId: string, body: string) {
  return request<{ ok: true }>(`/api/approvals/${approvalId}/comments`, {
    method: "POST",
    body: JSON.stringify({ authorId, body }),
  });
}

export function assignApprovalReviewer(approvalId: number, reviewerId: string, actor: string) {
  return request<{ approval: ApprovalDetailResponse["approval"] }>(`/api/approvals/${approvalId}/assign`, {
    method: "POST",
    body: JSON.stringify({ reviewerId, actor }),
  });
}

export function assignApprovals(domainId: string, reviewerId: string) {
  return request<{ updatedCount: number }>("/api/approvals/assign", {
    method: "POST",
    body: JSON.stringify({ domainId, reviewerId }),
  });
}

export function updateSettings(settings: WorkspaceSettings) {
  return request<{ settings: WorkspaceSettings }>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function getServers(domainId: string) {
  return request<ServersResponse>(`/api/servers?domainId=${encodeURIComponent(domainId)}`);
}

export function getPermissions(domainId: string) {
  return request<PermissionsResponse>(`/api/permissions?domainId=${encodeURIComponent(domainId)}`);
}

export function updatePermission(permissionId: number, level: PermissionLevel, actor: string) {
  return request<{ ok: true }>(`/api/permissions/${permissionId}`, {
    method: "PUT",
    body: JSON.stringify({ level, actor }),
  });
}

export function getAuditLogs(domainId: string) {
  return request<AuditLogsResponse>(`/api/audit-logs?domainId=${encodeURIComponent(domainId)}`);
}
