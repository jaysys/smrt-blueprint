# K-Sattie API Contract Draft

## 목적

`data-sattie`의 Python API를 현재 저장소의 `Express + SQLite` 구조로 옮기기 위한 타깃 계약 초안이다.

- 기준 네임스페이스: `/api/sattie`
- 응답 포맷: 기존 `data-sattie` JSON 구조를 가능한 한 유지
- 목적: 프런트 타입 정의, DB 스키마 설계, Express 라우팅 구현의 기준점 제공

## 엔터티

### Satellite

```ts
type SatelliteType = "EO_OPTICAL" | "SAR";
type SatelliteStatus = "AVAILABLE" | "MAINTENANCE";

interface SatelliteTypeProfile {
  platform: string;
  orbit_type: string;
  nominal_altitude_km: number;
  nominal_swath_km: number;
  revisit_hours: number;
  sensor_modes: string[];
  default_product_type: string;
  default_bands_or_polarization: string[];
}

interface Satellite {
  satellite_id: string;
  internal_satellite_code: string | null;
  name: string;
  eng_model: string | null;
  domain: string | null;
  resolution_perf: string | null;
  baseline_status: string | null;
  primary_mission: string | null;
  tracker_name: string | null;
  tracker_domestic_name: string | null;
  norad_cat_id: string | null;
  object_type: string | null;
  object_id: string | null;
  tracker_current: string | null;
  launch_date: string | null;
  launch_site: string | null;
  period_minutes: number | null;
  inclination_deg: number | null;
  apogee_km: number | null;
  perigee_km: number | null;
  orbit_class: string | null;
  orbit_label: string | null;
  orbital_slot: string | null;
  tracker_source: string | null;
  type: SatelliteType;
  status: SatelliteStatus;
  profile: SatelliteTypeProfile;
}

interface OrbitBackdropPoint {
  norad: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude_km: number;
  source_date: string | null;
  source_state: string | null;
}

interface OrbitTrackLeoBackdropResponse {
  source: string;
  updated_at: string | null;
  fetched_at: string | null;
  generated_at: string;
  total_count: number;
  rendered_count: number;
  points: OrbitBackdropPoint[];
}

interface OrbitTrackLiveEntry {
  norad: string;
  english_name: string | null;
  domestic_name: string | null;
  orbit_class: string | null;
  orbit_label: string | null;
  source_date: string | null;
  source_label: string | null;
  fetched_at: string | null;
  period_minutes: number;
  current: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
  };
  track: Array<{
    latitude: number;
    longitude: number;
    altitudeKm: number;
  }>;
}

interface OrbitTrackKoreanLiveResponse {
  source: string;
  updated_at: string | null;
  generated_at: string;
  count: number;
  entries: OrbitTrackLiveEntry[];
}
```

### Ground Station

```ts
type GroundStationType = "FIXED" | "LAND_MOBILE" | "MARITIME" | "AIRBORNE";
type GroundStationStatus = "OPERATIONAL" | "MAINTENANCE";

interface GroundStation {
  ground_station_id: string;
  internal_ground_station_code: string | null;
  name: string;
  type: GroundStationType;
  status: GroundStationStatus;
  location: string | null;
}
```

### Requestor

```ts
interface Requestor {
  requestor_id: string;
  name: string;
  ground_station_id: string;
  ground_station_name: string | null;
}
```

### Command

```ts
type CommandState =
  | "QUEUED"
  | "ACKED"
  | "CAPTURING"
  | "DOWNLINK_READY"
  | "FAILED";

interface CommandStatus {
  command_id: string;
  satellite_id: string;
  satellite_type: SatelliteType;
  ground_station_id: string | null;
  ground_station_name: string | null;
  ground_station_type: GroundStationType | null;
  requestor_id: string | null;
  requestor_name: string | null;
  mission_name: string;
  aoi_name: string;
  width: number;
  height: number;
  cloud_percent: number;
  fail_probability: number;
  state: CommandState;
  message: string | null;
  created_at: string;
  updated_at: string;
  download_url: string | null;
  request_profile: Record<string, unknown>;
  acquisition_metadata: Record<string, unknown> | null;
  product_metadata: Record<string, unknown> | null;
}
```

### Scenario

```ts
interface Scenario {
  scenario_id: string;
  scenario_name: string;
  scenario_desc: string;
  satellite_system_ids: string[];
}
```

## 공통 정책

- 보호 API는 `x-api-key` 헤더를 받는다.
- 브라우저 다운로드 링크는 `/downloads/:id?api_key=...` 쿼리 허용이 필요하다.
- 역할 모드(`admin`, `operator`, `requestor`)는 서버 권한 모델이 아니라 프런트 시뮬레이션 제어로 우선 구현한다.
- 응답 필드명은 원본과 동일하게 `snake_case`를 유지한다.
- `satellite_id`는 기존 scenario / uplink preset 호환성을 위해 유지하고, orbit-track 데이터는 별도 메타 필드로 병합한다.

## 라우트 목록

### 운영/모니터링

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/sattie/health` | 헬스 체크 |
| `GET` | `/api/sattie/monitor/api-calls` | API 호출 로그 조회 |
| `GET` | `/api/sattie/orbit-track/leo-backdrop` | 전역 LEO point cloud overlay |
| `GET` | `/api/sattie/orbit-track/korean-live` | 한국 위성 live propagated track |

### Satellite

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/sattie/satellites` | 위성 목록 |
| `POST` | `/api/sattie/satellites` | 위성 생성 |
| `PATCH` | `/api/sattie/satellites/:satelliteId` | 위성 수정 |
| `DELETE` | `/api/sattie/satellites/:satelliteId` | 위성 삭제 |
| `POST` | `/api/sattie/seed/mock-satellites` | 기본 위성 시드 |
| `GET` | `/api/sattie/satellite-types` | 위성 타입 프로파일 조회 |

### Ground Station / Requestor

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/sattie/ground-stations` | 지상국 목록 |
| `POST` | `/api/sattie/ground-stations` | 지상국 생성 |
| `PATCH` | `/api/sattie/ground-stations/:groundStationId` | 지상국 수정 |
| `DELETE` | `/api/sattie/ground-stations/:groundStationId` | 지상국 삭제 |
| `POST` | `/api/sattie/seed/mock-ground-stations` | 지상국 시드 |
| `GET` | `/api/sattie/requestors` | 요청자 목록 |
| `POST` | `/api/sattie/requestors` | 요청자 생성 |
| `PATCH` | `/api/sattie/requestors/:requestorId` | 요청자 수정 |
| `DELETE` | `/api/sattie/requestors/:requestorId` | 요청자 삭제 |
| `POST` | `/api/sattie/seed/mock-requestors` | 요청자 시드 |

### Uplink / Command / Download

| Method | Path | 설명 |
| --- | --- | --- |
| `POST` | `/api/sattie/uplink` | 업링크 명령 생성 |
| `GET` | `/api/sattie/commands` | 명령 목록 |
| `GET` | `/api/sattie/commands/:commandId` | 명령 단건 조회 |
| `POST` | `/api/sattie/commands/:commandId/rerun` | 실패 명령 재실행 |
| `GET` | `/api/sattie/downloads/:commandId` | 생성 이미지 다운로드 |
| `POST` | `/api/sattie/downloads/:commandId/save-local` | 로컬 저장 메타 조회 |
| `POST` | `/api/sattie/images/clear` | 생성 이미지 전체 정리 |
| `GET` | `/api/sattie/preview/external-map` | 외부 지도 프리뷰 |

### Scenario / Admin

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/sattie/scenarios` | 시나리오 카탈로그 조회 |
| `POST` | `/api/sattie/admin/db/clear` | DB 초기화 후 시드 복원 |

## 주요 요청 바디 초안

### `POST /api/sattie/satellites`

```json
{
  "satellite_id": "optional-public-id",
  "name": "KOMPSAT Custom",
  "type": "EO_OPTICAL",
  "status": "AVAILABLE"
}
```

### `POST /api/sattie/ground-stations`

```json
{
  "ground_station_id": "optional-public-id",
  "name": "Daejeon Mission Center",
  "type": "FIXED",
  "status": "OPERATIONAL",
  "location": "Daejeon"
}
```

### `POST /api/sattie/requestors`

```json
{
  "name": "KARI Ops",
  "ground_station_id": "DAE-MC"
}
```

### `POST /api/sattie/uplink`

```json
{
  "satellite_id": "KOMPSAT-3",
  "ground_station_id": "DAE-MC",
  "requestor_id": "req-1234",
  "mission_name": "국토 정사영상 갱신",
  "aoi_name": "수도권",
  "aoi_center_lat": 37.56,
  "aoi_center_lon": 126.98,
  "aoi_bbox": [126.75, 37.40, 127.22, 37.72],
  "window_open_utc": "2026-01-01T00:00:00Z",
  "window_close_utc": "2026-01-01T03:00:00Z",
  "priority": "COMMERCIAL",
  "width": 1024,
  "height": 1024,
  "cloud_percent": 20,
  "max_cloud_cover_percent": 25,
  "max_off_nadir_deg": 20,
  "min_sun_elevation_deg": 25,
  "incidence_min_deg": null,
  "incidence_max_deg": null,
  "look_side": "ANY",
  "pass_direction": "ANY",
  "polarization": null,
  "delivery_method": "DOWNLOAD",
  "delivery_path": null,
  "generation_mode": "INTERNAL",
  "external_map_source": "OSM",
  "external_map_zoom": 16,
  "fail_probability": 0.05
}
```

## Express 구현 메모

- 기존 서버 스타일을 맞추기 위해 `server/index.js`에서 라우터 마운트 방식으로 붙인다.
- 현재 앱과 충돌을 피하기 위해 신규 API는 `/api/sattie/*`로 고정한다.
- 이미지 바이너리 응답과 JSON 응답을 같은 서비스에서 같이 다뤄야 한다.
- 상태 전이는 DB만으로 처리하지 말고 서비스 레이어에서 타이머 기반 작업으로 분리한다.

## 다음 단계 입력

다음 액션아이템 `A03`에서 이 문서를 기준으로 아래를 정리한다.

- SQLite 테이블 목록
- 컬럼 정의
- seed 데이터 적재 전략
- 런타임 상태 전이와 영속화 기준
