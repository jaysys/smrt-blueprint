# K-Sattie SQLite Schema And Seed Design

## 목적

이 문서는 `data-sattie`의 SQLite 구조와 런타임 영속화 방식을 현재 저장소의 `Express + sqlite3` 구조로 옮기기 위한 설계 기준이다.

- 기준 API 계약: [./sattie-api-contract.md](./sattie-api-contract.md)
- 기준 포팅 플랜: [./sattie-porting-plan.md](./sattie-porting-plan.md)

## 설계 원칙

- 원본 Python 구현의 엔터티 의미를 유지한다.
- 외부 API 응답 필드와 내부 DB 컬럼은 1:1에 가깝게 맞춘다.
- 원본처럼 일부 필드는 JSON blob으로 저장해 구현 복잡도를 낮춘다.
- CRUD 대상 자원과 명령 이력은 SQLite에 영속화한다.
- 역할 모드(`admin`, `operator`, `requestor`)는 DB가 아니라 프런트 상태로 관리한다.

## 데이터 저장 범위

### 영속화 대상

- satellites
- ground_stations
- requestors
- commands
- generated image file path

### 비영속화 대상

- 프런트 선택 상태
- 현재 로그인한 mock user
- 폴링 on/off 상태
- 화면 필터

### 선택 영속화 대상

- API 호출 로그
  - 1차 구현에서는 메모리 보관 우선
  - 필요 시 SQLite 테이블로 확장 가능

## 테이블 목록

### `sattie_satellites`

위성 자원 마스터.

```sql
CREATE TABLE IF NOT EXISTS sattie_satellites (
  internal_satellite_code TEXT PRIMARY KEY,
  satellite_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  eng_model TEXT,
  domain TEXT,
  resolution_perf TEXT,
  baseline_status TEXT,
  primary_mission TEXT,
  tracker_name TEXT,
  tracker_domestic_name TEXT,
  norad_cat_id TEXT,
  object_type TEXT,
  object_id TEXT,
  tracker_current TEXT,
  launch_date TEXT,
  launch_site TEXT,
  period_minutes REAL,
  inclination_deg REAL,
  apogee_km REAL,
  perigee_km REAL,
  orbit_class TEXT,
  orbit_label TEXT,
  orbital_slot TEXT,
  tracker_source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

비고:

- `internal_satellite_code`: 내부 키 (`sat-xxxx`)
- `satellite_id`: 외부 공개 ID (`KOMPSAT-3`, `USR-XXXX`)
- `satellite_id`는 기존 화면 preset과 scenario 키를 보존하기 위해 유지
- orbit-track 연동 데이터는 `tracker_*`, `norad_cat_id`, `object_id`, `launch_date`, `orbit_*` 컬럼에 별도 저장
- 이름 중복은 서비스 레이어에서 차단

### `sattie_ground_stations`

지상국 마스터.

```sql
CREATE TABLE IF NOT EXISTS sattie_ground_stations (
  internal_ground_station_code TEXT PRIMARY KEY,
  ground_station_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

비고:

- `ground_station_id`는 외부 alias ID (`DAE-MC` 형식)
- alias 자동 생성 규칙은 서비스 레이어에서 처리

### `sattie_requestors`

지상국 소속 요청자.

```sql
CREATE TABLE IF NOT EXISTS sattie_requestors (
  requestor_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  internal_ground_station_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (internal_ground_station_code)
    REFERENCES sattie_ground_stations (internal_ground_station_code)
    ON DELETE CASCADE
);
```

비고:

- 요청자는 지상국에 종속된다
- 지상국 삭제 시 요청자 연쇄 삭제

### `sattie_commands`

업링크 명령과 다운링크 결과.

```sql
CREATE TABLE IF NOT EXISTS sattie_commands (
  command_id TEXT PRIMARY KEY,
  satellite_id TEXT NOT NULL,
  mission_name TEXT NOT NULL,
  aoi_name TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  cloud_percent INTEGER NOT NULL,
  fail_probability REAL NOT NULL,
  state TEXT NOT NULL,
  message TEXT,
  image_path TEXT,
  request_profile_json TEXT NOT NULL,
  acquisition_metadata_json TEXT,
  product_metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

비고:

- 원본과 동일하게 `request_profile_json`, `acquisition_metadata_json`, `product_metadata_json`는 JSON 문자열로 저장
- `satellite_id`는 외부 공개 ID 기준으로 저장
- download URL은 저장하지 않고 응답 생성 시 계산

### `sattie_seed_history`

시드 및 초기화 추적용 보조 테이블.

```sql
CREATE TABLE IF NOT EXISTS sattie_seed_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed_type TEXT NOT NULL,
  seed_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

비고:

- 필수는 아니지만 현재 포팅에서는 운영 추적과 검증 편의를 위해 추가
- `mock-satellites`, `mock-ground-stations`, `mock-requestors`, `db-reset` 이벤트 기록

## 인덱스

```sql
CREATE INDEX IF NOT EXISTS idx_sattie_satellites_name
ON sattie_satellites (name);

CREATE INDEX IF NOT EXISTS idx_sattie_ground_stations_name
ON sattie_ground_stations (name);

CREATE INDEX IF NOT EXISTS idx_sattie_requestors_station
ON sattie_requestors (internal_ground_station_code);

CREATE INDEX IF NOT EXISTS idx_sattie_commands_state
ON sattie_commands (state);

CREATE INDEX IF NOT EXISTS idx_sattie_commands_satellite
ON sattie_commands (satellite_id);

CREATE INDEX IF NOT EXISTS idx_sattie_commands_created_at
ON sattie_commands (created_at DESC);
```

## 컬럼 매핑

| 원본 Python 개념 | SQLite 컬럼 | 비고 |
| --- | --- | --- |
| `Satellite.satellite_id` | `internal_satellite_code` | 내부 키 |
| `Satellite.system_id` | `satellite_id` | 공개 ID |
| `GroundStation.ground_station_id` | `internal_ground_station_code` | 내부 키 |
| `GroundStation.ground_station_alias_id` | `ground_station_id` | 공개 alias |
| `Requestor.ground_station_id` | `internal_ground_station_code` | FK |
| `Command.request_profile` | `request_profile_json` | JSON 직렬화 |
| `Command.acquisition_metadata` | `acquisition_metadata_json` | JSON 직렬화 |
| `Command.product_metadata` | `product_metadata_json` | JSON 직렬화 |

## Seed 전략

### 초기 기동

원본 `data-sattie`는 DB가 비어 있으면 자동 시드를 넣는다. 현재 포팅에서도 이 동작을 유지한다.

초기화 순서:

1. 스키마 생성
2. `sattie_satellites` 비어 있으면 baseline satellite seed
3. `sattie_ground_stations` 비어 있으면 baseline ground station seed
4. `sattie_requestors` 비어 있으면 station 기준 requestor seed

### 위성 시드

기준 데이터:

- 원본 `SATELLITE_BASELINES`

전략:

- `eng_model`을 기반으로 공개 `satellite_id` 생성
- domain이 `SAR`이면 `SAR`, 나머지는 `EO_OPTICAL`
- runtime `status`는 모두 `AVAILABLE`
- baseline 정보(`eng_model`, `domain`, `resolution_perf`, `baseline_status`, `primary_mission`) 유지
- `sattie-skor-tracker`에서 확인 가능한 위성은 orbit-track 메타를 함께 병합
- tracker에 직접 대응값이 없는 baseline 위성은 기존 baseline 정보만 유지하고 orbit-track 메타는 `NULL`
- 2차 확장에서는 baseline이 이미 대표하는 위성을 제외한 활성 orbit-track 위성을 추가 seed로 적재

### 지상국 시드

기준 데이터:

- Daejeon / Jeju / Incheon preset

전략:

- 이름과 location 기반 alias 생성
- `status`는 `OPERATIONAL`
- 이름 중복이면 skip

### 요청자 시드

전략:

- 각 지상국마다 Alpha / Bravo 2명 생성
- 지상국명 키워드가 있으면 정해진 명명 규칙 적용
- 이미 같은 이름 + 같은 지상국 조합이 있으면 skip

### DB 초기화

`POST /api/sattie/admin/db/clear` 동작 기준:

1. 이미지 파일 삭제
2. satellites / ground_stations / requestors / commands 전체 삭제
3. seed 재적재
4. seed 이력 기록

## 명령 상태 영속화 규칙

### 상태 머신

```text
QUEUED -> ACKED -> CAPTURING -> DOWNLINK_READY
QUEUED -> FAILED
ACKED -> FAILED
CAPTURING -> FAILED
DOWNLINK_READY -> FAILED   (파일 누락 보정 시)
FAILED -> QUEUED          (rerun 시)
```

### 저장 타이밍

다음 이벤트마다 즉시 `UPDATE` 또는 `INSERT` 반영:

- uplink 명령 생성
- 상태 전이
- 이미지 파일 경로 생성
- acquisition/product metadata 생성
- rerun 요청
- images clear 이후 실패 보정

### 구현 기준

- 원본 Python은 전체 스냅샷 재저장 방식이지만, Node 포팅은 row 단위 upsert/update로 단순화한다.
- 명령 상태 전이는 메모리 타이머 기반으로 돌리되, 각 단계 완료 시 DB를 갱신한다.
- 서버 재기동 시 `QUEUED`, `ACKED`, `CAPTURING` 상태 명령은 복구 정책이 필요하다.

복구 정책:

- 1차 구현에서는 서버 재기동 후 진행 중 명령을 `FAILED`로 정규화
- 메시지 예시: `Server restarted during processing. Retry is required.`

## 이미지 파일 전략

- 저장 경로: `server/data/sattie/images`
- 파일명: `${command_id}.png`
- DB에는 절대경로 대신 앱 기준 상대경로 저장 권장

예시:

```text
server/data/sattie/images/cmd-123456789abc.png
```

## API 로그 전략

1차 구현:

- 메모리 큐 보관
- 서버 재기동 시 로그 유실 허용

2차 확장 여지:

- `sattie_api_logs` 테이블 추가
- 최근 N건만 유지

## Express 구현 체크포인트

- 스키마 생성 함수는 `server/sattie/db.js`에 둔다
- seed 함수는 `server/sattie/seed.js`로 분리한다
- `commands` JSON 필드는 service 계층에서 serialize/deserialize 한다
- FK cascade가 동작하도록 SQLite pragma 설정 필요

## A03 완료 기준

아래가 정의되면 `A03` 완료로 본다.

- 테이블 목록 확정
- 컬럼 및 키 정의
- 인덱스 정의
- seed 전략 정의
- 상태 영속화 및 재기동 복구 정책 정의
