# K-Sattie Verification Notes

## 검증 범위

현재 포팅 결과에 대해 아래 두 축으로 검증했다.

- 백엔드 스모크 테스트
- 프런트 프로덕션 빌드

## 백엔드 스모크 테스트

실행 방식:

- Node 모듈 직접 호출
- 대상:
  - DB 초기화
  - baseline seed 확인
  - uplink 생성
  - 상태 전이 완료
  - images clear 이후 실패 보정
  - rerun 이후 재완료

검증 결과:

```json
{
  "satelliteCount": 15,
  "stationCount": 3,
  "requestorCount": 6,
  "readyState": "DOWNLINK_READY",
  "clearedState": "FAILED",
  "rerunState": "QUEUED",
  "finalState": "DOWNLINK_READY"
}
```

판정:

- seed 동작 정상
- uplink 및 상태 전이 정상
- clear 후 실패 보정 정상
- rerun 후 재처리 정상

## EXTERNAL + OSM 검증

실행 방식:

- 외부 인터넷 대신 로컬 fetch stub 사용
- 대상:
  - OSM tile fetch 경로의 PNG decode / 3x3 mosaic / crop / resize
  - `preview/external-map`
  - `generation_mode=EXTERNAL` uplink 후 실제 downlink PNG 생성

검증 결과:

```json
{
  "previewPngBytes": 6005,
  "externalRenderPngBytes": 102231,
  "pipelineState": "DOWNLINK_READY",
  "imageSource": {
    "mode": "EXTERNAL",
    "external_map_source": "OSM",
    "external_map_zoom": 16
  }
}
```

판정:

- `EXTERNAL + OSM` preview PNG 생성 정상
- `EXTERNAL + OSM` uplink 이후 실제 downlink 이미지 생성 정상
- 현재 구현은 `SATTIE_OSM_TILE_URL_TEMPLATE` 환경변수로 타일 엔드포인트를 대체해 로컬/테스트 환경 검증 가능

## 프런트 빌드 검증

실행 명령:

```bash
npm run build
```

결과:

- `tsc -b` 통과
- `vite build` 통과

판정:

- 현재 프런트 타입/라우트/컴포넌트 구조는 빌드 가능 상태

## Orbit Track 화면 포팅 검증

실행 방식:

- React 라우트/컴포넌트 추가
- 대상:
  - `/orbit-track` 신규 라우트
  - 사이드바 `Orbit Track` 탭
  - orbit metadata 기반 캔버스 시각화
  - 검색 / 궤도 필터 / 선택 브라우저

검증 결과:

- `Orbit Track` 메뉴가 현재 콘솔 라우터에 추가됨
- `bootstrap.satellites`를 기반으로 orbit browser와 선택 패널을 렌더링함
- 캔버스는 `norad_cat_id`, `orbit_class`, `orbit_label`, `orbital_slot` 메타로 의사 궤도선을 그림
- 선택 위성 상세에 `NORAD`, `OBJECT_TYPE`, `OBJECT_ID`, `launch_date`, `tracker_source`가 노출됨
- `npm run build` 통과

판정:

- `sattie-skor-tracker` Orbit Track 케이스를 현재 앱 구조로 포팅 완료
- 현재 구현은 Cesium 실시간 GP 추적이 아니라 동기화된 orbit metadata 기반 운영용 궤도 브라우저임
- 별도 외부 의존성 추가 없이 기존 앱 스택 안에서 유지 가능

## Global LEO overlay 검증

실행 방식:

- Node 모듈 직접 호출
- 대상:
  - `sattie-skor-tracker/data/leo-live-cache.json`
  - `GET /api/sattie/orbit-track/leo-backdrop`
  - Orbit Track 3D globe point cloud 렌더링

검증 결과:

- 원본 `leo-live-cache.json`에서 총 `14,999`개 LEO entry를 읽었다.
- 현재 서버는 OMM 기반 단순 케플러 전파로 각 entry의 `latitude`, `longitude`, `altitude_km`를 계산한다.
- 응답은 10초 캐시로 묶이고, 샘플 point 3건에 대해 좌표가 정상 생성됨을 확인했다.
- Orbit Track 캔버스는 비한국 LEO를 원본과 같은 point primitive 스타일로 그리고, 기존 한국 위성 NORAD와 겹치는 point는 제외한다.
- 한국 위성만 label + orbit line을 유지하고, 비한국 LEO는 점만 표기한다.
- `npm run build` 통과

판정:

- `sattie-skor-tracker` 전역 LEO backdrop 스냅샷이 현재 앱에 정상 병합됨
- Orbit Track은 `한국 위성 궤도 + 전역 LEO point cloud` 구성을 지원함

## Korean live propagation 검증

실행 방식:

- Node 모듈 직접 호출
- 대상:
  - `sattie-skor-tracker/data/satellite-live-cache.json`
  - 원본 `satellite.js`
  - `GET /api/sattie/orbit-track/korean-live`
  - Orbit Track 화면의 한국 위성 entry 병합

검증 결과:

- 원본 `satellite-live-cache.json`의 한국 위성 live cache를 읽어 `48`개 propagated entry를 생성했다.
- 서버는 원본 저장소의 `node_modules/satellite.js`를 사용해 `json2satrec/twoline2satrec` 기반으로 현재 위치와 궤도 샘플을 계산한다.
- 샘플 검증에서 `SPACEEYE-T1`은 `period_minutes=94.636`, `track_count=48`, `KOMPSAT 2`는 `period_minutes=98.321`, `track_count=50`으로 확인됐다.
- Orbit Track 페이지는 한국 위성에 대해서 live propagated `current/track`를 우선 적용하고, live cache가 없는 위성만 기존 근사 orbit metadata 계산을 fallback으로 사용한다.
- `npm run build` 통과

판정:

- 한국 위성도 이제 원본과 같은 `satellite.js + OMM/TLE` 전파 방식으로 Orbit Track에 반영됨
- 현재 Orbit Track은 `한국 위성 live propagation + 전역 LEO point cloud` 구조로 동작함

## NEXTSAT-1 orbit metadata 정합성 검증

실행 방식:

- 원본 CSV 대조
- 대상:
  - `space-track-skor-current-payloads.csv`의 `NORAD_CAT_ID=43811`
  - 현재 서비스 `NEXTSAT-1` row
  - Orbit Track 합성 궤도 계산 입력값

검증 결과:

- CSV 기준 `NEXTSAT-1` 값은 아래와 일치한다.
  - `OBJECT_ID=2018-099BF`
  - `SITE=AFWTR`
  - `LAUNCH_DATE=2018-12-03`
  - `APOGEE=549`
  - `PERIGEE=535`
  - `INCLINATION=97.42`
  - `PERIOD=95.48`
- 현재 서비스 DB도 동일 값으로 동기화된다.
- Orbit Track 계산은 이제 저장된 `period_minutes`, `inclination_deg`, `apogee_km`, `perigee_km`를 우선 사용한다.
- 기존 `NEXTSAT-1`과 `KOMPSAT-6` 중복 표시는 원천 CSV 오류가 아니라 합성 궤도 seed 충돌 때문이었다.
- 수정 후 샘플 시각(`2025-01-15T00:00:00Z`) 기준 두 위성의 현재 위치와 주기가 분리됨을 확인했다.

판정:

- `NEXTSAT-1` 메타는 원본 CSV와 정합
- Orbit Track에서 `NEXTSAT-1`은 더 이상 `KOMPSAT-6`와 동일 위치로 계산되지 않음

## Orbit Track 라벨/CSV 보강 검증

실행 방식:

- 원본 CSV 대조
- 대상:
  - `KOMPSAT 3A`
  - `STEP CUBE LAB`
  - `SPACEEYE-T1`
  - Orbit Track 라벨 겹침 완화 로직

검증 결과:

- CSV 기준 세 위성의 `PERIOD`, `INCLINATION`, `APOGEE`, `PERIGEE`, `SITE`, `OBJECT_TYPE`를 서비스 메타에 반영했다.
- `KOMPSAT-3A`는 baseline 메타에, `STEP CUBE LAB`와 `SpaceEye-T`는 확장 카탈로그 메타에 반영했다.
- Orbit Track 캔버스는 가까운 화면 좌표끼리 라벨 오프셋을 분산해 동일 위치 라벨 겹침을 줄이도록 보정했다.
- 동기화 후 현재 계산 좌표는 세 위성이 동일 위치가 아님을 확인했다.

판정:

- 원천 CSV 기준 세 위성은 서로 다른 위성이다.
- 화면상 근접 표시는 극지방 SSO 시점 영향이 있을 수 있지만, 현재 데이터와 계산상 동일 위치 중복은 아님.

## Orbit-Track 메타 동기화 검증

실행 방식:

- Node 모듈 직접 호출
- 대상:
  - `sattie_satellites` 컬럼 마이그레이션
  - 기존 baseline 15종 row에 orbit-track 메타 backfill
  - tracker 직접 매칭 불가 baseline의 `NULL` 유지

검증 결과:

```json
[
  {
    "satellite_id": "CAS500-1",
    "tracker_name": "CAS500-1",
    "norad_cat_id": "47932",
    "orbit_label": "LEO SSO",
    "launch_date": "2021-03-22"
  },
  {
    "satellite_id": "GK-2A",
    "tracker_name": "GEO-KOMPSAT-2A",
    "norad_cat_id": "43823",
    "orbit_label": "GEO",
    "launch_date": "2018-12-04"
  },
  {
    "satellite_id": "KOMPSAT-3",
    "tracker_name": "KOMPSAT 3",
    "norad_cat_id": "38338",
    "orbit_label": "LEO SSO",
    "launch_date": "2012-05-17"
  },
  {
    "satellite_id": "NEONSAT",
    "tracker_name": "NEONSAT-1",
    "norad_cat_id": "59587",
    "orbit_label": "LEO SSO",
    "launch_date": "2024-04-23"
  }
]
```

판정:

- 기존 공개 `satellite_id`는 유지됨
- `KOMPSAT-3/3A/5`, `GK-2A/2B`, `CAS500-1`, `NEONSAT`에 orbit-track 메타 반영 완료
- 사용자 제공 supplemental catalog를 반영해 `425 Project #1~5` 메타도 채움
- `KOMPSAT-6/7`, `CAS500-2`는 source repo 직접 대응값이 없어 `NULL` 유지
- 위성 관리 테이블에서 orbit / NORAD / launch 정보를 함께 확인 가능

## Orbit-Track 2차 확장 검증

실행 방식:

- Node 모듈 직접 호출
- 대상:
  - baseline 15종 유지
  - 활성 orbit-track 추가 위성 seed 적재
  - baseline 대표 위성과 alias 중복 제외

검증 결과:

```json
{
  "count": 58,
  "samples": [
    {
      "satellite_id": "LINK",
      "name": "LINK",
      "domain": "R&D",
      "norad_cat_id": "42714",
      "orbit_label": "LEO"
    },
    {
      "satellite_id": "KOREASAT-6A",
      "name": "무궁화 6A호 (KOREASAT 6A)",
      "domain": "SATCOM",
      "norad_cat_id": "61910",
      "orbit_label": "GEO"
    },
    {
      "satellite_id": "KPLO",
      "name": "KPLO",
      "domain": "LUNAR",
      "norad_cat_id": "53365",
      "orbit_label": "Lunar orbit"
    },
    {
      "satellite_id": "STEP-CUBE-LAB",
      "name": "STEP CUBE LAB",
      "domain": "R&D",
      "norad_cat_id": "43138",
      "orbit_label": "LEO SSO"
    }
  ]
}
```

판정:

- `sattie_satellites`는 15개 baseline에서 58개 관리 카탈로그로 확장됨
- 신규 활성 orbit-track 위성 43개가 추가 seed됨
- 기존 baseline과 425 계열 alias로 판단되는 `KORSAT-*` 항목은 중복 적재하지 않음
- CSV 원본에 있었지만 서비스에 빠져 있던 `LINK`, `SNUSAT-1`, `SNUSAT-1B`, `STSAT 2C`, `OSSI 1`, `STEP CUBE LAB`도 추가 seed됨
- 공개 `satellite_id` 규칙은 기존 baseline 호환성을 유지하면서 신규 자산도 일관되게 생성됨

## 확장 위성 Taxonomy 정제 검증

실행 방식:

- Node 모듈 직접 호출
- 대상:
  - 2차 확장 위성의 `domain`
  - `resolution_perf`
  - `primary_mission`

검증 결과:

```json
[
  {
    "satellite_id": "SPACEEYE-T",
    "domain": "EO",
    "resolution_perf": "상업 광학 지구관측",
    "primary_mission": "상업 초고해상도 광학 지구관측"
  },
  {
    "satellite_id": "KOREASAT-6A",
    "domain": "SATCOM",
    "resolution_perf": "상업 통신 payload",
    "primary_mission": "상업 정지궤도 통신 서비스"
  },
  {
    "satellite_id": "COMS-1",
    "domain": "GEO-EO",
    "resolution_perf": "기상/환경 관측 payload",
    "primary_mission": "정지궤도 기상·환경 관측"
  },
  {
    "satellite_id": "KPLO",
    "domain": "LUNAR",
    "resolution_perf": "달 탐사 payload",
    "primary_mission": "달 궤도 탐사 및 과학 임무"
  },
  {
    "satellite_id": "NEXTSAT-2",
    "domain": "R&D",
    "resolution_perf": "기술검증/과학 payload",
    "primary_mission": "우주기술 검증 및 과학탑재체 운용"
  }
]
```

판정:

- 신규 확장 위성의 도메인 분류가 `SATCOM`, `GEO-EO`, `LUNAR`, `R&D`, `EO` 수준으로 구분됨
- 상업 통신, 상업 광학, 정지궤도 환경관측, 달 탐사, 기술실증 계열을 generic placeholder보다 구체적으로 표시 가능
- 세부 센서/사업명까지 확인되지 않은 위성은 보수적 family taxonomy 기준으로 분류

## 로컬 Dev 경로 검증

실행 방식:

- `npm run dev:server`
- `npm run dev:client -- --host 127.0.0.1 --port 4173`
- `http://127.0.0.1:4173/api/sattie/*` 기준 proxy 경로 확인

검증 결과:

- `GET /api/sattie/health` 응답 정상
- `GET /api/sattie/preview/external-map?...` 응답 `200`, PNG 바이트 생성 정상
- `POST /api/sattie/uplink`로 `generation_mode=EXTERNAL` command 생성 정상
- `GET /api/sattie/commands/{id}`에서 `DOWNLINK_READY`와 `product_metadata.image_source.mode=EXTERNAL` 확인
- `GET /api/sattie/downloads/{id}` 응답 `200 image/png`, 파일 시그니처 `89 50 4E 47 0D 0A 1A 0A` 확인

판정:

- 프런트 dev server의 `/api` proxy를 통해 OSM preview와 downlink download가 실제로 연결됨
- `EXTERNAL + OSM` 흐름은 빌드 수준이 아니라 로컬 dev 경로에서도 동작 확인됨

## 남은 갭

- 브라우저 상호작용 E2E 검증은 아직 수행하지 않음
- `requestor` 역할의 세부 소유권 검증은 프런트 제어 중심이며 서버 권한 모델은 아님
- App bootstrap 데이터는 CRUD, uplink, rerun, scenario 실행 이후 전체 셸 카운트와 함께 자동 동기화되도록 보강함
- orbit-track 확장 위성의 세부 mission/domain taxonomy는 현재 generic heuristic 기반임

## 결론

현재 포팅은 아래 범위를 충족한다.

- `data-sattie` 도메인 자원 CRUD
- uplink / command / rerun / download / clear 흐름
- Blueprint 기반 대시보드, 관리, 분석, uplink, monitor, scenario 화면
- mock role mode 기반 UI 접근 제어

실사용 기준 다음 우선순위는 브라우저 E2E 검증과 서버 권한 모델 보강이다.
