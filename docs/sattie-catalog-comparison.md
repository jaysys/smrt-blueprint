# Sattie Catalog Comparison

기준 비교:

- 원본 CSV: `/Users/jaehojoo/workspace/codex-lgcns/sattie-skor-tracker/data/space-track-skor-current-payloads.csv`
- 현재 서비스 카탈로그: `sattie-image-hub`의 `sattie_satellites`

비교 기준:

- 1차 키: `NORAD_CAT_ID`
- 보조 확인: `OBJECT_NAME`, `OBJECT_ID`, `LAUNCH_DATE`, 현재 서비스의 `tracker_source`

## 요약

| 항목 | 개수 | 설명 |
| --- | ---: | --- |
| CSV 원본 행 수 | 55 | `space-track-skor-current-payloads.csv` 기준 |
| 현재 서비스 위성 수 | 58 | `sattie_satellites` 기준 |
| 동일 NORAD 반영 | 51 | CSV와 서비스가 같은 NORAD를 공유 |
| CSV에만 존재 | 4 | 정책상 제외한 alias 항목 |
| 서비스에만 존재 | 7 | 보강 데이터로 추가한 항목 |
| 동일 NORAD 이름 차이 | 2 | CSV 이름과 서비스 이름이 다름 |

## CSV에만 존재하는 항목

| NORAD | CSV OBJECT_NAME | OBJECT_ID | LAUNCH_DATE | 비고 |
| --- | --- | --- | --- | --- |
| 58463 | KORSAT 7 | 2023-185B | 2023-12-01 | 425 계열 alias로 판단되어 제외 |
| 59452 | KORSAT-1 | 2024-066L | 2024-04-07 | alias/중복 후보로 제외 |
| 63630 | KORSAT-3 | 2025-081A | 2025-04-22 | alias/중복 후보로 제외 |
| 66293 | KORSAT-4 | 2025-248A | 2025-11-02 | alias/중복 후보로 제외 |

## 서비스에만 존재하는 항목

| NORAD | 서비스 ID | 서비스 Tracker Name | Source | 비고 |
| --- | --- | --- | --- | --- |
| 58468 | 425-PROJECT-1 | 425 PROJ EO/IR | `supplemental military orbit catalog` | 사용자 보강 데이터 |
| 59475 | 425-PROJECT-2 | 425 PROJ SAR 1 | `supplemental military orbit catalog` | 사용자 보강 데이터 |
| 64157 | 425-PROJECT-4 | 425 PROJ SAR 3 | `supplemental military orbit catalog` | 사용자 보강 데이터 |
| 66487 | 425-PROJECT-5 | 425 PROJ SAR 4 | `supplemental military orbit catalog` | 사용자 보강 데이터 |
| 63892 | CAS500-2 | CAS500-2 | `user-supplied orbit catalog` | 사용자 보강 데이터 |
| 62378 | KOMPSAT-6 | KOMPSAT-6 | `user-supplied provisional orbit catalog` | 예상/가배정 NORAD |
| 64512 | KOMPSAT-7 | KOMPSAT-7 | `user-supplied provisional orbit catalog` | 예상/가배정 NORAD |

## 동일 NORAD이지만 이름이 다른 항목

| NORAD | CSV OBJECT_NAME | 서비스 ID | 서비스 Tracker Name | 설명 |
| --- | --- | --- | --- | --- |
| 62377 | KORSAT-2 | 425-PROJECT-3 | 425 PROJ SAR 2 | 같은 NORAD를 425 정찰위성 명명으로 사용 |
| 63229 | SPACEEYE-T1 | SPACEEYE-T | SpaceEye-T | 브랜드명 기준으로 정규화 |

## 해석

| 구분 | 설명 |
| --- | --- |
| 원본 우선 반영 | 현재 서비스의 51개 위성은 CSV와 같은 NORAD를 그대로 반영 |
| 운영용 정규화 | 서비스는 `satellite_id`, `domain`, `primary_mission`, `tracker_source` 같은 운영용 필드를 추가로 가진다 |
| alias 제거 | `KORSAT-*` 일부는 425 계열 alias 또는 중복 후보로 보고 제외했다 |
| 원본 미반영 보강 | `LINK`, `SNUSAT-1`, `SNUSAT-1B`, `STSAT 2C`, `OSSI 1`, `STEP CUBE LAB`은 CSV 원본 기준으로 서비스에 추가 반영했다 |
| 보강 데이터 병합 | `CAS500-2`, `KOMPSAT-6`, `KOMPSAT-7`, 일부 425 위성은 CSV 밖의 사용자 제공 데이터를 합쳐 반영했다 |
