export const domains = [
  {
    id: "operations",
    label: "Operations",
    team: "Platform Team",
    summary: "운영 흐름과 배포 상태를 함께 본다.",
  },
  {
    id: "security",
    label: "Security",
    team: "Security Admin",
    summary: "정책 예외, 접근 권한, 감사 로그를 본다.",
  },
  {
    id: "finance",
    label: "Finance",
    team: "FinOps",
    summary: "정산 파이프라인과 승인 절차를 본다.",
  },
  {
    id: "logistics",
    label: "Logistics",
    team: "Logistics Planner",
    summary: "현장 배차와 단말 상태를 본다.",
  },
];

export const teams = [
  { id: "platform", label: "Platform Team", role: "운영 콘솔 오너" },
  { id: "security", label: "Security Admin", role: "권한 승인 담당" },
  { id: "analytics", label: "Analytics Lead", role: "데이터 모델 검토" },
  { id: "logistics", label: "Logistics Planner", role: "현장 배차 승인" },
];

export const queueStats = [
  { id: 1, label: "열린 이슈", value: "14", intent: "warning" },
  { id: 2, label: "승인 대기", value: "6", intent: "primary" },
  { id: 3, label: "정상 플로우", value: "128", intent: "success" },
  { id: 4, label: "SLA 위험", value: "2", intent: "danger" },
];

export const dashboardSummaries = [
  {
    domainId: "operations",
    readiness: 78,
    widgets: 12,
    queues: 4,
    uptime: "99.2%",
    syncLabel: "실시간 동기화 정상",
    pendingApprovals: 2,
  },
  {
    domainId: "security",
    readiness: 73,
    widgets: 10,
    queues: 3,
    uptime: "98.7%",
    syncLabel: "정책 인덱스 재동기화 중",
    pendingApprovals: 1,
  },
  {
    domainId: "finance",
    readiness: 81,
    widgets: 9,
    queues: 2,
    uptime: "99.8%",
    syncLabel: "정산 흐름 정상",
    pendingApprovals: 1,
  },
  {
    domainId: "logistics",
    readiness: 76,
    widgets: 11,
    queues: 5,
    uptime: "99.1%",
    syncLabel: "현장 단말 동기화 지연 없음",
    pendingApprovals: 2,
  },
];

export const statusRows = [
  {
    id: 1,
    domainId: "operations",
    area: "데이터 파이프라인",
    owner: "Analytics",
    status: "안정",
    progress: 82,
    latency: "320ms",
  },
  {
    id: 2,
    domainId: "operations",
    area: "운영 콘솔",
    owner: "Platform",
    status: "점검 중",
    progress: 61,
    latency: "1.8s",
  },
  {
    id: 3,
    domainId: "security",
    area: "권한 정책",
    owner: "Security",
    status: "승인 대기",
    progress: 46,
    latency: "740ms",
  },
  {
    id: 4,
    domainId: "logistics",
    area: "현장 배차 보드",
    owner: "Logistics",
    status: "안정",
    progress: 89,
    latency: "280ms",
  },
  {
    id: 5,
    domainId: "finance",
    area: "정산 배치",
    owner: "FinOps",
    status: "안정",
    progress: 91,
    latency: "410ms",
  },
];

export const activityFeed = [
  {
    id: 1,
    domainId: "operations",
    title: "권한 정책 변경 요청",
    detail: "Security Admin이 새 데이터셋 권한 승인 요청을 올렸습니다.",
    time: "3분 전",
    intent: "warning",
  },
  {
    id: 2,
    domainId: "logistics",
    title: "배차 최적화 배치 완료",
    detail: "Logistics Planner 배치가 성공적으로 종료되었습니다.",
    time: "12분 전",
    intent: "success",
  },
  {
    id: 3,
    domainId: "operations",
    title: "운영 콘솔 배포 예정",
    detail: "Platform Team이 14:00 배포 윈도우를 예약했습니다.",
    time: "27분 전",
    intent: "primary",
  },
  {
    id: 4,
    domainId: "security",
    title: "감사 로그 정책 검토",
    detail: "보존 주기 예외 요청이 정책 큐에 추가되었습니다.",
    time: "41분 전",
    intent: "warning",
  },
  {
    id: 5,
    domainId: "finance",
    title: "정산 배치 재실행 완료",
    detail: "FinOps 재시도 배치가 정상적으로 끝났습니다.",
    time: "1시간 전",
    intent: "success",
  },
];

export const approvals = [
  {
    id: 1,
    domainId: "operations",
    request: "새 파이프라인 접근 권한",
    requester: "Analytics Sandbox",
    priority: "P1",
    state: "승인 필요",
    age: "12m",
    reviewerId: "security",
  },
  {
    id: 2,
    domainId: "operations",
    request: "배포 윈도우 변경",
    requester: "Platform Team",
    priority: "P2",
    state: "검토 중",
    age: "31m",
    reviewerId: "platform",
  },
  {
    id: 3,
    domainId: "security",
    request: "감사 로그 보존 정책 예외",
    requester: "Security Admin",
    priority: "P1",
    state: "대기",
    age: "46m",
    reviewerId: "security",
  },
  {
    id: 4,
    domainId: "finance",
    request: "정산 배치 재실행",
    requester: "FinOps",
    priority: "P3",
    state: "대기",
    age: "1h",
    reviewerId: "analytics",
  },
  {
    id: 5,
    domainId: "logistics",
    request: "현장 단말 정책 예외",
    requester: "Logistics Planner",
    priority: "P2",
    state: "승인 필요",
    age: "1h 18m",
    reviewerId: "logistics",
  },
];

export const settings = {
  selectedDomainId: "operations",
  defaultOwnerTeamId: "platform",
  workspaceName: "Operations Command",
  description: "고밀도 운영 콘솔, 승인 워크플로우, 상태 테이블을 중심으로 시작한다.",
  notificationsEnabled: 1,
};
