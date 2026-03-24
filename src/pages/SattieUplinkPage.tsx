import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Callout, Card, FormGroup, HTMLSelect, InputGroup, Tag, TextArea } from "@blueprintjs/core";
import { PanelTitle } from "../components/PanelTitle";
import { useNavigate } from "react-router-dom";
import { buildExternalMapPreviewUrl, createUplink } from "../lib/sattieApi";
import type {
  DeliveryMethod,
  GenerationMode,
  GroundStation,
  PassDirection,
  Requestor,
  Satellite,
  TaskPriority,
  UplinkResponse,
} from "../sattie-types";

interface SattieUplinkPageProps {
  canSend: boolean;
  groundStations: GroundStation[];
  onCommandCreated?: () => Promise<void> | void;
  requestors: Requestor[];
  satellites: Satellite[];
}

type UplinkFormState = {
  satellite_id: string;
  ground_station_id: string;
  requestor_id: string;
  mission_name: string;
  aoi_name: string;
  aoi_center_lat: string;
  aoi_center_lon: string;
  aoi_bbox: string;
  priority: TaskPriority;
  width: string;
  height: string;
  cloud_percent: string;
  max_cloud_cover_percent: string;
  max_off_nadir_deg: string;
  min_sun_elevation_deg: string;
  incidence_min_deg: string;
  incidence_max_deg: string;
  look_side: "ANY" | "LEFT" | "RIGHT";
  pass_direction: PassDirection;
  polarization: string;
  delivery_method: DeliveryMethod;
  delivery_path: string;
  generation_mode: GenerationMode;
  external_map_zoom: string;
  fail_probability: string;
};

type PreviewDragState = {
  pointerId: number;
  rectHeight: number;
  rectWidth: number;
  startClientX: number;
  startClientY: number;
  startLat: number;
  startLon: number;
  zoom: number;
};

const UPLINK_PRESETS_BY_SATELLITE_ID: Record<string, Partial<UplinkFormState>> = {
  "KOMPSAT-3": {
    mission_name: "국토 정사영상 갱신",
    aoi_name: "수도권",
    aoi_center_lat: "37.56",
    aoi_center_lon: "126.98",
    aoi_bbox: "126.75,37.40,127.22,37.72",
    priority: "COMMERCIAL",
    width: "1536",
    height: "1536",
    cloud_percent: "15",
    max_cloud_cover_percent: "25",
    max_off_nadir_deg: "20",
    min_sun_elevation_deg: "25",
    generation_mode: "EXTERNAL",
    external_map_zoom: "14",
    fail_probability: "0.03",
  },
  "KOMPSAT-3A": {
    mission_name: "야간 산불 열원 탐지",
    aoi_name: "강원 산림",
    aoi_center_lat: "37.75",
    aoi_center_lon: "128.45",
    aoi_bbox: "128.05,37.45,128.85,38.05",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "20",
    max_cloud_cover_percent: "30",
    max_off_nadir_deg: "25",
    min_sun_elevation_deg: "10",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "KOMPSAT-7": {
    mission_name: "도시변화 탐지",
    aoi_name: "부산 도심",
    aoi_center_lat: "35.1796",
    aoi_center_lon: "129.0756",
    aoi_bbox: "128.92,35.05,129.23,35.31",
    priority: "URGENT",
    width: "1536",
    height: "1536",
    cloud_percent: "12",
    max_cloud_cover_percent: "20",
    max_off_nadir_deg: "18",
    min_sun_elevation_deg: "24",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "KOMPSAT-5": {
    mission_name: "홍수지역 SAR 판독",
    aoi_name: "낙동강 하류",
    aoi_center_lat: "35.15",
    aoi_center_lon: "128.95",
    aoi_bbox: "128.65,34.95,129.20,35.35",
    priority: "URGENT",
    width: "1024",
    height: "1024",
    cloud_percent: "0",
    incidence_min_deg: "25",
    incidence_max_deg: "42",
    look_side: "RIGHT",
    pass_direction: "DESCENDING",
    polarization: "VV",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "KOMPSAT-6": {
    mission_name: "정밀 레이더 표적 재식별",
    aoi_name: "동해 연안",
    aoi_center_lat: "37.48",
    aoi_center_lon: "129.19",
    aoi_bbox: "128.95,37.15,129.45,37.75",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "0",
    incidence_min_deg: "20",
    incidence_max_deg: "40",
    look_side: "LEFT",
    pass_direction: "ASCENDING",
    polarization: "VH",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "GK-2A": {
    mission_name: "태풍 실황 추적",
    aoi_name: "한반도 남해",
    aoi_center_lat: "34.35",
    aoi_center_lon: "127.95",
    aoi_bbox: "127.10,33.75,128.80,34.95",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "35",
    max_cloud_cover_percent: "60",
    max_off_nadir_deg: "30",
    min_sun_elevation_deg: "5",
    generation_mode: "EXTERNAL",
    external_map_zoom: "8",
    fail_probability: "0.03",
  },
  "GK-2B": {
    mission_name: "미세먼지 이동 추적",
    aoi_name: "서해-수도권",
    aoi_center_lat: "36.95",
    aoi_center_lon: "126.10",
    aoi_bbox: "125.40,36.20,126.90,37.55",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "25",
    max_cloud_cover_percent: "50",
    max_off_nadir_deg: "28",
    min_sun_elevation_deg: "8",
    generation_mode: "EXTERNAL",
    external_map_zoom: "8",
    fail_probability: "0.03",
  },
  "425-PROJECT-1": {
    mission_name: "전략표적 EO/IR 감시",
    aoi_name: "북부 접경",
    aoi_center_lat: "38.12",
    aoi_center_lon: "127.05",
    aoi_bbox: "126.75,37.90,127.35,38.35",
    priority: "URGENT",
    width: "1536",
    height: "1536",
    cloud_percent: "10",
    max_cloud_cover_percent: "18",
    max_off_nadir_deg: "16",
    min_sun_elevation_deg: "22",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "425-PROJECT-2": {
    mission_name: "악천후 표적 감시",
    aoi_name: "중부 접경",
    aoi_center_lat: "38.05",
    aoi_center_lon: "127.55",
    aoi_bbox: "127.20,37.85,127.95,38.25",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "0",
    incidence_min_deg: "20",
    incidence_max_deg: "38",
    polarization: "VV",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "425-PROJECT-3": {
    mission_name: "SAR 군집 재방문 감시",
    aoi_name: "동부 산악",
    aoi_center_lat: "37.66",
    aoi_center_lon: "128.55",
    aoi_bbox: "128.05,37.28,129.02,38.02",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "0",
    incidence_min_deg: "20",
    incidence_max_deg: "38",
    look_side: "RIGHT",
    pass_direction: "ASCENDING",
    polarization: "VV",
    generation_mode: "EXTERNAL",
    external_map_zoom: "15",
    fail_probability: "0.03",
  },
  "425-PROJECT-4": {
    mission_name: "SAR 군집 재방문 감시",
    aoi_name: "동부 산악",
    aoi_center_lat: "37.64",
    aoi_center_lon: "128.62",
    aoi_bbox: "128.12,37.24,129.06,38.00",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "0",
    incidence_min_deg: "20",
    incidence_max_deg: "38",
    look_side: "RIGHT",
    pass_direction: "DESCENDING",
    polarization: "VH",
    generation_mode: "EXTERNAL",
    external_map_zoom: "15",
    fail_probability: "0.03",
  },
  "425-PROJECT-5": {
    mission_name: "SAR 군집 재방문 감시",
    aoi_name: "동부 산악",
    aoi_center_lat: "37.70",
    aoi_center_lon: "128.48",
    aoi_bbox: "128.00,37.32,128.96,38.06",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "0",
    incidence_min_deg: "20",
    incidence_max_deg: "38",
    look_side: "LEFT",
    pass_direction: "ASCENDING",
    polarization: "VV",
    generation_mode: "EXTERNAL",
    external_map_zoom: "15",
    fail_probability: "0.03",
  },
  "CAS500-1": {
    mission_name: "국토 자원 관리",
    aoi_name: "전라 농경지",
    aoi_center_lat: "35.05",
    aoi_center_lon: "126.9",
    aoi_bbox: "126.55,34.75,127.3,35.35",
    priority: "COMMERCIAL",
    width: "1024",
    height: "1024",
    cloud_percent: "18",
    max_cloud_cover_percent: "28",
    max_off_nadir_deg: "20",
    min_sun_elevation_deg: "20",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  "CAS500-2": {
    mission_name: "재난 대응 표준 관측",
    aoi_name: "충청 내륙",
    aoi_center_lat: "36.55",
    aoi_center_lon: "127.45",
    aoi_bbox: "127.0,36.2,127.9,36.9",
    priority: "URGENT",
    width: "1280",
    height: "1280",
    cloud_percent: "20",
    max_cloud_cover_percent: "30",
    max_off_nadir_deg: "22",
    min_sun_elevation_deg: "18",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
  NEONSAT: {
    mission_name: "초소형 군집 모니터링",
    aoi_name: "수도권 순환",
    aoi_center_lat: "37.45",
    aoi_center_lon: "127.15",
    aoi_bbox: "126.8,37.1,127.6,37.8",
    priority: "COMMERCIAL",
    width: "1024",
    height: "1024",
    cloud_percent: "22",
    max_cloud_cover_percent: "35",
    max_off_nadir_deg: "24",
    min_sun_elevation_deg: "16",
    generation_mode: "EXTERNAL",
    external_map_zoom: "16",
    fail_probability: "0.03",
  },
};

function getTypeFallbackPreset(type: Satellite["type"]): Partial<UplinkFormState> {
  if (type === "SAR") {
    return {
      mission_name: "SAR 촬영 임무",
      aoi_name: "기본 SAR 촬영지역",
      aoi_center_lat: "37.55",
      aoi_center_lon: "128.45",
      aoi_bbox: "128.00,37.20,128.90,37.90",
      priority: "COMMERCIAL",
      width: "1024",
      height: "1024",
      cloud_percent: "0",
      incidence_min_deg: "20",
      incidence_max_deg: "40",
      look_side: "ANY",
      pass_direction: "ANY",
      polarization: "VV",
      delivery_method: "DOWNLOAD",
      generation_mode: "EXTERNAL",
      external_map_zoom: "14",
      fail_probability: "0.05",
    };
  }

  return {
    mission_name: "EO 촬영 임무",
    aoi_name: "기본 EO 촬영지역",
    aoi_center_lat: "36.35",
    aoi_center_lon: "127.38",
    aoi_bbox: "126.90,36.00,127.85,36.75",
    priority: "COMMERCIAL",
    width: "1024",
    height: "1024",
    cloud_percent: "15",
    max_cloud_cover_percent: "30",
    max_off_nadir_deg: "20",
    min_sun_elevation_deg: "20",
    delivery_method: "DOWNLOAD",
    generation_mode: "EXTERNAL",
    external_map_zoom: "14",
    fail_probability: "0.05",
  };
}

function createInitialForm(satellites: Satellite[], groundStations: GroundStation[]): UplinkFormState {
  const firstSatellite = satellites[0];
  const preset = firstSatellite
    ? UPLINK_PRESETS_BY_SATELLITE_ID[firstSatellite.satellite_id] ?? getTypeFallbackPreset(firstSatellite.type)
    : {};

  return {
    satellite_id: firstSatellite?.satellite_id ?? "",
    ground_station_id: groundStations[0]?.ground_station_id ?? "",
    requestor_id: "",
    mission_name: preset.mission_name ?? "",
    aoi_name: preset.aoi_name ?? "",
    aoi_center_lat: preset.aoi_center_lat ?? "",
    aoi_center_lon: preset.aoi_center_lon ?? "",
    aoi_bbox: preset.aoi_bbox ?? "",
    priority: preset.priority ?? "COMMERCIAL",
    width: preset.width ?? "1024",
    height: preset.height ?? "1024",
    cloud_percent: preset.cloud_percent ?? "15",
    max_cloud_cover_percent: preset.max_cloud_cover_percent ?? "",
    max_off_nadir_deg: preset.max_off_nadir_deg ?? "",
    min_sun_elevation_deg: preset.min_sun_elevation_deg ?? "",
    incidence_min_deg: preset.incidence_min_deg ?? "",
    incidence_max_deg: preset.incidence_max_deg ?? "",
    look_side: preset.look_side ?? "ANY",
    pass_direction: preset.pass_direction ?? "ANY",
    polarization: preset.polarization ?? "",
    delivery_method: preset.delivery_method ?? "DOWNLOAD",
    delivery_path: preset.delivery_path ?? "",
    generation_mode: preset.generation_mode ?? "EXTERNAL",
    external_map_zoom: preset.external_map_zoom ?? "14",
    fail_probability: preset.fail_probability ?? "0.05",
  };
}

function parseNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMapZoomInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return "14";
  }

  return String(Math.max(0, Math.min(19, parsed)));
}

function parseFloatOr(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBbox(value: string) {
  const numbers = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
  return numbers.length === 4 ? numbers : null;
}

function derivePreviewCenter(form: UplinkFormState) {
  const lat = parseNumberOrNull(form.aoi_center_lat);
  const lon = parseNumberOrNull(form.aoi_center_lon);
  if (lat != null && lon != null) {
    return { lat, lon };
  }

  const bbox = parseBbox(form.aoi_bbox);
  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return {
      lat: (minLat + maxLat) / 2,
      lon: (minLon + maxLon) / 2,
    };
  }

  return null;
}

function clampLatitude(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

function latLonToWorld(lat: number, lon: number, zoom: number) {
  const tileScale = 256 * 2 ** zoom;
  const normalizedLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const sinLat = Math.sin((clampLatitude(lat) * Math.PI) / 180);
  const x = ((normalizedLon + 180) / 360) * tileScale;
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * tileScale;
  return { x, y };
}

function worldToLatLon(x: number, y: number, zoom: number) {
  const tileScale = 256 * 2 ** zoom;
  const lon = ((x / tileScale) * 360) - 180;
  const mercator = Math.PI - ((2 * Math.PI * y) / tileScale);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  return {
    lat: clampLatitude(lat),
    lon: ((((lon + 180) % 360) + 360) % 360) - 180,
  };
}

function panPreviewCenter(center: { lat: number; lon: number }, dx: number, dy: number, width: number, height: number, zoom: number) {
  const world = latLonToWorld(center.lat, center.lon, zoom);
  const worldX = world.x - (dx * 512) / Math.max(width, 1);
  const worldY = world.y - (dy * 512) / Math.max(height, 1);
  return worldToLatLon(worldX, worldY, zoom);
}

export function SattieUplinkPage({
  canSend,
  groundStations,
  onCommandCreated,
  requestors,
  satellites,
}: SattieUplinkPageProps) {
  const navigate = useNavigate();
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState<UplinkFormState>(() => createInitialForm(satellites, groundStations));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [previewDrag, setPreviewDrag] = useState<PreviewDragState | null>(null);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [result, setResult] = useState<UplinkResponse | null>(null);

  const selectedSatellite = satellites.find((item) => item.satellite_id === form.satellite_id) ?? satellites[0] ?? null;
  const filteredRequestors = useMemo(
    () =>
      form.ground_station_id
        ? requestors.filter((item) => item.ground_station_id === form.ground_station_id)
        : requestors,
    [form.ground_station_id, requestors],
  );
  const previewCenter = useMemo(() => derivePreviewCenter(form), [form]);
  const previewZoom = Math.max(0, Math.min(19, parseInteger(form.external_map_zoom, 14)));
  const previewUrl = useMemo(() => {
    if (!previewRequested || form.generation_mode !== "EXTERNAL" || previewCenter == null) {
      return null;
    }

    return buildExternalMapPreviewUrl({
      lat: previewCenter.lat,
      lon: previewCenter.lon,
      zoom: previewZoom,
      width: 512,
      height: 512,
      source: "OSM",
    });
  }, [form.generation_mode, previewCenter, previewRequested, previewZoom]);
  const previewMessage = useMemo(() => {
    if (!previewRequested) {
      return "No preview requested.";
    }
    if (form.generation_mode !== "EXTERNAL") {
      return "외부 프리뷰는 외부생성 모드에서만 사용할 수 있다.";
    }
    if (previewCenter == null) {
      return "AOI center 또는 bbox를 입력한 뒤 다시 시도해라.";
    }
    return `external_map_source: OSM · zoom ${previewZoom} · center ${previewCenter.lat.toFixed(5)}, ${previewCenter.lon.toFixed(5)}`;
  }, [form.generation_mode, previewCenter, previewRequested, previewZoom]);

  useEffect(() => {
    if (filteredRequestors.some((item) => item.requestor_id === form.requestor_id)) {
      return;
    }
    setForm((current) => ({
      ...current,
      requestor_id: filteredRequestors[0]?.requestor_id ?? "",
    }));
  }, [filteredRequestors, form.requestor_id]);

  function applyPresetForSatellite(satelliteId: string) {
    const satellite = satellites.find((item) => item.satellite_id === satelliteId);
    if (!satellite) {
      return;
    }
    const preset = UPLINK_PRESETS_BY_SATELLITE_ID[satellite.satellite_id] ?? getTypeFallbackPreset(satellite.type);
    setForm((current) => ({
      ...current,
      satellite_id: satelliteId,
      mission_name: preset.mission_name ?? current.mission_name,
      aoi_name: preset.aoi_name ?? current.aoi_name,
      aoi_center_lat: preset.aoi_center_lat ?? "",
      aoi_center_lon: preset.aoi_center_lon ?? "",
      aoi_bbox: preset.aoi_bbox ?? "",
      priority: preset.priority ?? current.priority,
      width: preset.width ?? current.width,
      height: preset.height ?? current.height,
      cloud_percent: preset.cloud_percent ?? current.cloud_percent,
      max_cloud_cover_percent: preset.max_cloud_cover_percent ?? "",
      max_off_nadir_deg: preset.max_off_nadir_deg ?? "",
      min_sun_elevation_deg: preset.min_sun_elevation_deg ?? "",
      incidence_min_deg: preset.incidence_min_deg ?? "",
      incidence_max_deg: preset.incidence_max_deg ?? "",
      look_side: preset.look_side ?? current.look_side,
      pass_direction: preset.pass_direction ?? current.pass_direction,
      polarization: preset.polarization ?? "",
      delivery_method: preset.delivery_method ?? current.delivery_method,
      delivery_path: preset.delivery_path ?? "",
      generation_mode: preset.generation_mode ?? current.generation_mode,
      external_map_zoom: preset.external_map_zoom ?? current.external_map_zoom,
      fail_probability: preset.fail_probability ?? current.fail_probability,
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await createUplink({
        satellite_id: form.satellite_id,
        ground_station_id: form.ground_station_id || null,
        requestor_id: form.requestor_id || null,
        mission_name: form.mission_name,
        aoi_name: form.aoi_name,
        aoi_center_lat: parseNumberOrNull(form.aoi_center_lat),
        aoi_center_lon: parseNumberOrNull(form.aoi_center_lon),
        aoi_bbox: parseBbox(form.aoi_bbox),
        priority: form.priority,
        width: parseInteger(form.width, 1024),
        height: parseInteger(form.height, 1024),
        cloud_percent: parseInteger(form.cloud_percent, 20),
        max_cloud_cover_percent: parseNumberOrNull(form.max_cloud_cover_percent),
        max_off_nadir_deg: parseNumberOrNull(form.max_off_nadir_deg),
        min_sun_elevation_deg: parseNumberOrNull(form.min_sun_elevation_deg),
        incidence_min_deg: parseNumberOrNull(form.incidence_min_deg),
        incidence_max_deg: parseNumberOrNull(form.incidence_max_deg),
        look_side: form.look_side,
        pass_direction: form.pass_direction,
        polarization: form.polarization.trim() || null,
        delivery_method: form.delivery_method,
        delivery_path: form.delivery_path.trim() || null,
        generation_mode: form.generation_mode,
        external_map_source: "OSM",
        external_map_zoom: Math.max(0, Math.min(19, parseInteger(form.external_map_zoom, 14))),
        fail_probability: parseFloatOr(form.fail_probability, 0.05),
      });
      setResult(response);
      await onCommandCreated?.();
      navigate(`/commands?commandId=${response.command_id}#command-lookup`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Uplink failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePreviewExternalMap() {
    setPreviewRequested(true);
  }

  function adjustPreviewZoom(delta: number) {
    setPreviewRequested(true);
    setForm((current) => {
      const currentZoom = Math.max(0, Math.min(19, parseInteger(current.external_map_zoom, 14)));
      const nextZoom = Math.max(0, Math.min(19, currentZoom + delta));
      if (nextZoom === currentZoom) {
        return current;
      }
      return {
        ...current,
        external_map_zoom: String(nextZoom),
      };
    });
  }

  function handlePreviewWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (previewUrl == null) {
      return;
    }

    event.preventDefault();
    adjustPreviewZoom(event.deltaY < 0 ? 1 : -1);
  }

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (previewUrl == null || previewCenter == null || previewFrameRef.current == null) {
      return;
    }

    const rect = previewFrameRef.current.getBoundingClientRect();
    previewFrameRef.current.setPointerCapture(event.pointerId);
    setPreviewOffset({ x: 0, y: 0 });
    setPreviewDrag({
      pointerId: event.pointerId,
      rectHeight: rect.height,
      rectWidth: rect.width,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLat: previewCenter.lat,
      startLon: previewCenter.lon,
      zoom: previewZoom,
    });
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (previewDrag == null || previewDrag.pointerId !== event.pointerId) {
      return;
    }

    setPreviewOffset({
      x: event.clientX - previewDrag.startClientX,
      y: event.clientY - previewDrag.startClientY,
    });
  }

  function finishPreviewDrag(event: ReactPointerEvent<HTMLDivElement>, commit: boolean) {
    if (previewDrag == null || previewDrag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - previewDrag.startClientX;
    const dy = event.clientY - previewDrag.startClientY;
    if (previewFrameRef.current?.hasPointerCapture(event.pointerId)) {
      previewFrameRef.current.releasePointerCapture(event.pointerId);
    }

    if (commit && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      const nextCenter = panPreviewCenter(
        { lat: previewDrag.startLat, lon: previewDrag.startLon },
        dx,
        dy,
        previewDrag.rectWidth,
        previewDrag.rectHeight,
        previewDrag.zoom,
      );
      setForm((current) => ({
        ...current,
        aoi_center_lat: nextCenter.lat.toFixed(6),
        aoi_center_lon: nextCenter.lon.toFixed(6),
      }));
    }

    setPreviewDrag(null);
    setPreviewOffset({ x: 0, y: 0 });
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">Send a Uplink</p>
          <h1>Tasking Console</h1>
          <p className="page-copy">
            자가검증목적으로 satellite preset을 기준으로 business tasking payload를 입력하고
            실제 uplink command를 생성한다. 제출 후 결과는 즉시 확인하고 Commands Monitor로
            넘길 수 있다.
          </p>
        </div>
        <Card className="mini-summary">
          <div className="mini-summary__grid">
            <div>
              <strong>{satellites.length}</strong>
              <span>target satellites</span>
            </div>
            <div>
              <strong>{groundStations.length}</strong>
              <span>stations</span>
            </div>
            <div>
              <strong>{filteredRequestors.length}</strong>
              <span>filtered requestors</span>
            </div>
          </div>
        </Card>
      </section>

      {error ? (
        <Callout icon="error" intent="danger">
          {error}
        </Callout>
      ) : null}

      {!canSend ? (
        <Callout icon="lock" intent="warning">
          현재 역할에서는 uplink 명령 전송이 비활성화된다.
        </Callout>
      ) : null}

      {result ? (
        <Callout icon="endorsed" intent="success">
          Command `{result.command_id}` created with state `{result.state}`.
        </Callout>
      ) : null}

      <Card className="panel uplink-form-cluster">
        <div className="panel__title-row">
          <PanelTitle icon="layers">Tasking Parameters</PanelTitle>
          <Tag minimal intent="primary">
            Grouped Form
          </Tag>
        </div>
        <section className="uplink-grid uplink-grid--triple uplink-context-grid uplink-form-cluster__grid">
        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="satellite">Mission Context</PanelTitle>
            <Tag minimal intent="primary">
              Target
            </Tag>
          </div>
          <div className="form-stack">
            <FormGroup label="Satellite">
              <HTMLSelect
                fill
                value={form.satellite_id}
                onChange={(event) => applyPresetForSatellite(event.target.value)}
                options={satellites.map((item) => ({
                  label: `${item.satellite_id} · ${item.name}`,
                  value: item.satellite_id,
                }))}
              />
            </FormGroup>
            <FormGroup label="Ground Station">
              <HTMLSelect
                fill
                value={form.ground_station_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ground_station_id: event.target.value,
                  }))
                }
                options={[
                  { label: "(none)", value: "" },
                  ...groundStations.map((item) => ({
                    label: `${item.ground_station_id} · ${item.name}`,
                    value: item.ground_station_id,
                  })),
                ]}
              />
            </FormGroup>
            <FormGroup label="Requestor">
              <HTMLSelect
                fill
                value={form.requestor_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requestor_id: event.target.value,
                  }))
                }
                options={[
                  { label: "(none)", value: "" },
                  ...filteredRequestors.map((item) => ({
                    label: `${item.requestor_id} · ${item.name}`,
                    value: item.requestor_id,
                  })),
                ]}
              />
            </FormGroup>
            <div className="form-inline">
              <FormGroup label="Mission Name">
                <InputGroup
                  value={form.mission_name}
                  onValueChange={(value) => setForm((current) => ({ ...current, mission_name: value }))}
                />
              </FormGroup>
              <FormGroup label="AOI Name">
                <InputGroup
                  value={form.aoi_name}
                  onValueChange={(value) => setForm((current) => ({ ...current, aoi_name: value }))}
                />
              </FormGroup>
            </div>
            {selectedSatellite ? (
              <Callout icon="satellite" intent={selectedSatellite.type === "SAR" ? "warning" : "success"}>
                {selectedSatellite.name} · {selectedSatellite.type} · {selectedSatellite.primary_mission ?? selectedSatellite.domain}
              </Callout>
            ) : null}
          </div>
        </Card>

        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="map-marker">AOI / Timing</PanelTitle>
            <Tag minimal intent="success">
              Geometry
            </Tag>
          </div>
          <div className="form-stack">
            <div className="form-inline">
              <FormGroup label="AOI Center Lat">
                <InputGroup
                  value={form.aoi_center_lat}
                  onValueChange={(value) => setForm((current) => ({ ...current, aoi_center_lat: value }))}
                />
              </FormGroup>
              <FormGroup label="AOI Center Lon">
                <InputGroup
                  value={form.aoi_center_lon}
                  onValueChange={(value) => setForm((current) => ({ ...current, aoi_center_lon: value }))}
                />
              </FormGroup>
            </div>
            <FormGroup label="AOI BBox (minLon,minLat,maxLon,maxLat)">
              <TextArea
                fill
                autoResize
                value={form.aoi_bbox}
                onChange={(event) => setForm((current) => ({ ...current, aoi_bbox: event.target.value }))}
              />
            </FormGroup>
            <FormGroup label="Priority">
              <HTMLSelect
                fill
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))
                }
                options={[
                  { label: "BACKGROUND", value: "BACKGROUND" },
                  { label: "COMMERCIAL", value: "COMMERCIAL" },
                  { label: "URGENT", value: "URGENT" },
                ]}
              />
            </FormGroup>
          </div>
        </Card>

        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="camera">Imaging Constraints</PanelTitle>
            <Tag minimal intent="warning">
              EO / SAR
            </Tag>
          </div>
          <div className="form-stack">
            <div className="form-inline">
              <FormGroup label="Width">
                <InputGroup value={form.width} onValueChange={(value) => setForm((current) => ({ ...current, width: value }))} />
              </FormGroup>
              <FormGroup label="Height">
                <InputGroup value={form.height} onValueChange={(value) => setForm((current) => ({ ...current, height: value }))} />
              </FormGroup>
            </div>
            <div className="form-inline">
              <FormGroup label="Cloud %">
                <InputGroup
                  value={form.cloud_percent}
                  onValueChange={(value) => setForm((current) => ({ ...current, cloud_percent: value }))}
                />
              </FormGroup>
              <FormGroup label="Fail Probability">
                <InputGroup
                  value={form.fail_probability}
                  onValueChange={(value) => setForm((current) => ({ ...current, fail_probability: value }))}
                />
              </FormGroup>
            </div>
            <div className="form-inline">
              <FormGroup label="Max Cloud Cover">
                <InputGroup
                  value={form.max_cloud_cover_percent}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, max_cloud_cover_percent: value }))
                  }
                />
              </FormGroup>
              <FormGroup label="Max Off Nadir">
                <InputGroup
                  value={form.max_off_nadir_deg}
                  onValueChange={(value) => setForm((current) => ({ ...current, max_off_nadir_deg: value }))}
                />
              </FormGroup>
            </div>
            <div className="form-inline">
              <FormGroup label="Min Sun Elevation">
                <InputGroup
                  value={form.min_sun_elevation_deg}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, min_sun_elevation_deg: value }))
                  }
                />
              </FormGroup>
              <FormGroup label="Polarization">
                <InputGroup
                  value={form.polarization}
                  onValueChange={(value) => setForm((current) => ({ ...current, polarization: value }))}
                />
              </FormGroup>
            </div>
            <div className="form-inline">
              <FormGroup label="Incidence Min">
                <InputGroup
                  value={form.incidence_min_deg}
                  onValueChange={(value) => setForm((current) => ({ ...current, incidence_min_deg: value }))}
                />
              </FormGroup>
              <FormGroup label="Incidence Max">
                <InputGroup
                  value={form.incidence_max_deg}
                  onValueChange={(value) => setForm((current) => ({ ...current, incidence_max_deg: value }))}
                />
              </FormGroup>
            </div>
            <div className="form-inline">
              <FormGroup label="Look Side">
                <HTMLSelect
                  fill
                  value={form.look_side}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      look_side: event.target.value as "ANY" | "LEFT" | "RIGHT",
                    }))
                  }
                  options={[
                    { label: "ANY", value: "ANY" },
                    { label: "LEFT", value: "LEFT" },
                    { label: "RIGHT", value: "RIGHT" },
                  ]}
                />
              </FormGroup>
              <FormGroup label="Pass Direction">
                <HTMLSelect
                  fill
                  value={form.pass_direction}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pass_direction: event.target.value as PassDirection,
                    }))
                  }
                  options={[
                    { label: "ANY", value: "ANY" },
                    { label: "ASCENDING", value: "ASCENDING" },
                    { label: "DESCENDING", value: "DESCENDING" },
                  ]}
                />
              </FormGroup>
            </div>
          </div>
        </Card>
        </section>
      </Card>

      <section className="uplink-submit-row">
        <Button intent="primary" large loading={submitting} disabled={!canSend} onClick={() => void handleSubmit()}>
          Send Uplink
        </Button>
      </section>

      <section className="uplink-grid uplink-grid--double uplink-grid--preview-emphasis">
        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="cube">위성촬영모사(Delivery/Generation)</PanelTitle>
            <Tag minimal intent="primary">
              Output
            </Tag>
          </div>
          <div className="form-stack">
            <div className="form-inline">
              <FormGroup label="Delivery Method">
                <HTMLSelect
                  fill
                  value={form.delivery_method}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      delivery_method: event.target.value as DeliveryMethod,
                    }))
                  }
                  options={[
                    { label: "DOWNLOAD", value: "DOWNLOAD" },
                    { label: "S3", value: "S3" },
                    { label: "WEBHOOK", value: "WEBHOOK" },
                  ]}
                />
              </FormGroup>
              <FormGroup label="Generation Mode">
                <HTMLSelect
                  fill
                  value={form.generation_mode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      generation_mode: event.target.value as GenerationMode,
                    }))
                  }
                  options={[
                    { label: "INTERNAL", value: "INTERNAL" },
                    { label: "EXTERNAL", value: "EXTERNAL" },
                  ]}
                />
              </FormGroup>
            </div>
            <div className="form-inline">
              <FormGroup label="Delivery Path">
                <InputGroup
                  value={form.delivery_path}
                  onValueChange={(value) => setForm((current) => ({ ...current, delivery_path: value }))}
                />
              </FormGroup>
            </div>
            <div className="simulator-block">
              <div className="simulator-block__title">위성사진촬영(downlink생성) 시뮬레이션 옵션</div>
              <div className="simulator-choice">
                <label className="simulator-choice__label">
                  <input
                    checked={form.generation_mode === "INTERNAL"}
                    name="generationModeInline"
                    onChange={() => setForm((current) => ({ ...current, generation_mode: "INTERNAL" }))}
                    type="radio"
                    value="INTERNAL"
                  />
                  <span>내부생성</span>
                </label>
                <span className="simulator-choice__desc">
                  파이썬 PIL library를 사용하여 간단한 패턴 이미지 생성해서 보냅니다.
                </span>
              </div>
              <div className="simulator-choice">
                <label className="simulator-choice__label">
                  <input
                    checked={form.generation_mode === "EXTERNAL"}
                    name="generationModeInline"
                    onChange={() => setForm((current) => ({ ...current, generation_mode: "EXTERNAL" }))}
                    type="radio"
                    value="EXTERNAL"
                  />
                  <span>외부생성</span>
                </label>
                <span className="simulator-choice__desc">
                  오픈소스맵 온라인사이트 연동해서 해당 위경도 지도맵이미지를 생성해서 보내줍니다.
                </span>
                <HTMLSelect
                  value="OSM"
                  options={[{ label: "external_map_source: OSM", value: "OSM" }]}
                />
                <InputGroup
                  className="simulator-choice__zoom"
                  value={form.external_map_zoom}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      external_map_zoom: normalizeMapZoomInput(value),
                    }))
                  }
                />
                <Button className="map-preview-btn" onClick={handlePreviewExternalMap}>
                  Map Preview 보기
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="panel panel--preview">
          <div className="panel__title-row">
            <PanelTitle icon="globe-network">External Map Preview</PanelTitle>
            <div className="preview-toolbar">
              <Tag minimal intent="primary">
                OSM
              </Tag>
              <div className="preview-zoom-controls" role="group" aria-label="External preview zoom controls">
                <Button
                  className="preview-zoom-btn"
                  disabled={form.generation_mode !== "EXTERNAL" || previewZoom <= 0}
                  icon="minus"
                  minimal
                  onClick={() => adjustPreviewZoom(-1)}
                  small
                />
                <span className="preview-zoom-level">Zoom {previewZoom}</span>
                <Button
                  className="preview-zoom-btn"
                  disabled={form.generation_mode !== "EXTERNAL" || previewZoom >= 19}
                  icon="plus"
                  minimal
                  onClick={() => adjustPreviewZoom(1)}
                  small
                />
              </div>
            </div>
          </div>
          <div className="preview-meta">{previewMessage}</div>
          {previewUrl ? (
            <div className="preview-stack">
              <div
                ref={previewFrameRef}
                className={`preview-frame ${previewDrag ? "is-dragging" : ""}`}
                onPointerCancel={(event) => finishPreviewDrag(event, false)}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={(event) => finishPreviewDrag(event, true)}
                onWheel={handlePreviewWheel}
              >
                <img
                  alt="External OSM preview"
                  className="map-preview"
                  draggable={false}
                  src={previewUrl}
                  style={{
                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px)`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="detail-grid">

        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="application">Preset Snapshot</PanelTitle>
            <Tag minimal intent="success">
              Auto
            </Tag>
          </div>
          {selectedSatellite ? (
            <div className="simple-list">
              <div className="simple-list__item">
                <div>
                  <strong>{selectedSatellite.satellite_id}</strong>
                  <p>{selectedSatellite.name}</p>
                </div>
                <Tag minimal intent={selectedSatellite.type === "SAR" ? "warning" : "success"}>
                  {selectedSatellite.type}
                </Tag>
              </div>
              <div className="simple-list__item">
                <div>
                  <strong>Mission</strong>
                  <p>{form.mission_name || "-"}</p>
                </div>
                <Tag minimal>{form.priority}</Tag>
              </div>
              <div className="simple-list__item">
                <div>
                  <strong>AOI</strong>
                  <p>{form.aoi_name || "-"}</p>
                </div>
                <Tag minimal>{form.generation_mode}</Tag>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="code-block">Result JSON</PanelTitle>
            <Tag minimal intent="warning">
              API
            </Tag>
          </div>
          <pre className="json-panel">{JSON.stringify(result, null, 2)}</pre>
        </Card>
      </section>
    </div>
  );
}
