import { Button, NonIdealState, Spinner } from "@blueprintjs/core";
import { useEffect, useRef, useState } from "react";
import type { OrbitTrackEntry } from "../lib/orbitTrack";
import type { OrbitBackdropPoint } from "../sattie-types";

interface SattieOrbitTrackCanvasProps {
  entries: OrbitTrackEntry[];
  backdropPoints: OrbitBackdropPoint[];
  selectedNorad: string | null;
  onSelect: (norad: string | null) => void;
  interactive?: boolean;
  showNavigation?: boolean;
  className?: string;
  renderTracks?: boolean;
  showLabels?: boolean;
}

declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

const CESIUM_BASE_URL = "https://cdn.jsdelivr.net/npm/cesium@1.139.1/Build/Cesium/";
const CESIUM_JS_URL = `${CESIUM_BASE_URL}Cesium.js`;
const CESIUM_CSS_URL = `${CESIUM_BASE_URL}Widgets/widgets.css`;

let cesiumLoaderPromise: Promise<any> | null = null;

function getBaseLabelOffset(Cesium: any, selected: boolean) {
  return new Cesium.Cartesian2(10, selected ? -18 : -14);
}

function getDistributedLabelOffset(Cesium: any, selected: boolean, clusterIndex: number, clusterSize: number) {
  const baseX = 10;
  const baseY = selected ? -18 : -14;
  if (clusterSize <= 1) {
    return new Cesium.Cartesian2(baseX, baseY);
  }

  const fanOffsets = [
    [10, baseY - 16],
    [10, baseY + 12],
    [10, baseY - 30],
    [10, baseY + 26],
    [10, baseY - 44],
    [10, baseY + 40],
    [10, baseY - 58],
    [10, baseY + 54],
  ];
  const [x, y] = fanOffsets[clusterIndex] ?? [baseX + Math.min(clusterIndex, 6) * 3, baseY - 12 + clusterIndex * 12];
  return new Cesium.Cartesian2(x, y);
}

function distributeVisibleLabelOffsets(Cesium: any, scene: any, visibleRecords: Array<any>) {
  const projectedRecords = visibleRecords
    .map((record) => {
      const windowPosition =
        typeof scene.cartesianToCanvasCoordinates === "function"
          ? scene.cartesianToCanvasCoordinates(record.position)
          : typeof Cesium.SceneTransforms?.worldToWindowCoordinates === "function"
            ? Cesium.SceneTransforms.worldToWindowCoordinates(scene, record.position)
            : null;
      if (!windowPosition) {
        return null;
      }

      return {
        ...record,
        windowX: windowPosition.x,
        windowY: windowPosition.y,
      };
    })
    .filter(Boolean)
    .sort((left: any, right: any) => {
      if (left.windowY !== right.windowY) {
        return left.windowY - right.windowY;
      }
      return left.windowX - right.windowX;
    });

  const clusters: Array<Array<any>> = [];
  const horizontalThreshold = 28;
  const verticalThreshold = 18;

  for (const record of projectedRecords) {
    const cluster = clusters.find((group) =>
      group.some(
        (groupedRecord) =>
          Math.abs(groupedRecord.windowX - record.windowX) <= horizontalThreshold &&
          Math.abs(groupedRecord.windowY - record.windowY) <= verticalThreshold,
      ),
    );

    if (cluster) {
      cluster.push(record);
      continue;
    }

    clusters.push([record]);
  }

  for (const cluster of clusters) {
    cluster
      .sort((left, right) => left.entry.englishName.localeCompare(right.entry.englishName, "en"))
      .forEach((record, index) => {
        record.pointEntity.label.pixelOffset = getDistributedLabelOffset(
          Cesium,
          record.selected,
          index,
          cluster.length,
        );
      });
  }
}

function isPositionInCameraView(Cesium: any, scene: any, occluder: any, position: any) {
  if (!position) {
    return false;
  }

  if (!occluder.isPointVisible(position)) {
    return false;
  }

  const cameraToPoint = Cesium.Cartesian3.subtract(position, scene.camera.positionWC, new Cesium.Cartesian3());
  return Cesium.Cartesian3.dot(cameraToPoint, scene.camera.directionWC) > 0;
}

function ensureCesiumCss() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.querySelector(`link[data-cesium-css="${CESIUM_CSS_URL}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CESIUM_CSS_URL;
  link.dataset.cesiumCss = CESIUM_CSS_URL;
  document.head.appendChild(link);
}

function loadCesium() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cesium is unavailable during SSR."));
  }

  if (window.Cesium) {
    return Promise.resolve(window.Cesium);
  }

  if (cesiumLoaderPromise) {
    return cesiumLoaderPromise;
  }

  window.CESIUM_BASE_URL = CESIUM_BASE_URL;
  ensureCesiumCss();

  cesiumLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-cesium-src="${CESIUM_JS_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Cesium), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cesium failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = CESIUM_JS_URL;
    script.async = true;
    script.dataset.cesiumSrc = CESIUM_JS_URL;
    script.onload = () => {
      if (window.Cesium) {
        resolve(window.Cesium);
        return;
      }
      reject(new Error("Cesium did not expose a global object."));
    };
    script.onerror = () => reject(new Error("Cesium failed to load."));
    document.head.appendChild(script);
  });

  return cesiumLoaderPromise;
}

export function SattieOrbitTrackCanvas({
  entries,
  backdropPoints,
  selectedNorad,
  onSelect,
  interactive = true,
  showNavigation = true,
  className,
  renderTracks = true,
  showLabels = true,
}: SattieOrbitTrackCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const CesiumRef = useRef<any>(null);
  const backdropCollectionRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const entityMapRef = useRef(new Map<string, { pointEntity: any; trackEntity: any; position: any; entry: OrbitTrackEntry; selected: boolean }>());
  const clickHandlerRef = useRef<any>(null);
  const preRenderCallbackRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  function panCamera(direction: "up" | "down" | "left" | "right") {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const amount = Math.max(viewer.camera.positionCartographic?.height ?? 0, 1000000) * 0.16;

    if (direction === "up") {
      viewer.camera.moveUp(amount);
      return;
    }

    if (direction === "down") {
      viewer.camera.moveDown(amount);
      return;
    }

    if (direction === "left") {
      viewer.camera.moveLeft(amount);
      return;
    }

    viewer.camera.moveRight(amount);
  }

  function moveHome() {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium) {
      return;
    }

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(127.8, 36.2, 5200000),
      orientation: {
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
      duration: 0.9,
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        if (!containerRef.current) {
          return;
        }

        const Cesium = await loadCesium();
        if (cancelled || !containerRef.current) {
          return;
        }

        CesiumRef.current = Cesium;
        containerRef.current.innerHTML = "";

        const imageryProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
        );
        const baseLayer = await Cesium.ImageryLayer.fromProviderAsync(imageryProvider);
        if (cancelled || !containerRef.current) {
          return;
        }

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer,
          baseLayerPicker: false,
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          scene3DOnly: true,
        });

        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#16324b");
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#030912");
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(126.978, 18, 16500000),
          orientation: {
            heading: 0,
            pitch: -Math.PI / 2,
            roll: 0,
          },
        });

        const clickHandler = interactive ? new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas) : null;
        clickHandler?.setInputAction((movement: any) => {
          const picked = viewer.scene.pick(movement.position);
          const norad = picked?.id?.properties?.norad?.getValue?.();
          onSelectRef.current(typeof norad === "string" ? norad : null);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        const handlePreRender = () => {
          const scene = viewer.scene;
          const occluder = new Cesium.EllipsoidalOccluder(scene.globe.ellipsoid, scene.camera.positionWC);
          const visibleRecords = [];

          for (const record of entityMapRef.current.values()) {
            const visible = isPositionInCameraView(Cesium, scene, occluder, record.position);
            if (record.pointEntity) {
              record.pointEntity.show = visible;
              if (record.pointEntity.label) {
                record.pointEntity.label.show = showLabels && visible;
                record.pointEntity.label.pixelOffset = getBaseLabelOffset(Cesium, record.selected);
              }
            }
            if (visible) {
              visibleRecords.push(record);
            }
          }

          distributeVisibleLabelOffsets(Cesium, scene, visibleRecords);
        };
        viewer.scene.preRender.addEventListener(handlePreRender);
        backdropCollectionRef.current = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());

        viewerRef.current = viewer;
        clickHandlerRef.current = clickHandler;
        preRenderCallbackRef.current = handlePreRender;
        setStatus("ready");
      } catch (initError) {
        if (!cancelled) {
          setError(initError instanceof Error ? initError.message : "3D globe initialization failed");
          setStatus("error");
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      clickHandlerRef.current?.destroy?.();
      clickHandlerRef.current = null;
      entityMapRef.current.clear();

      const viewer = viewerRef.current;
      if (viewer && preRenderCallbackRef.current) {
        viewer.scene.preRender.removeEventListener(preRenderCallbackRef.current);
      }
      preRenderCallbackRef.current = null;
      if (viewer && backdropCollectionRef.current) {
        viewer.scene.primitives.remove(backdropCollectionRef.current);
      }
      backdropCollectionRef.current = null;
      if (viewer && !viewer.isDestroyed?.()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, [interactive, showLabels]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium || status !== "ready") {
      return;
    }

    const backdropCollection = backdropCollectionRef.current;
    backdropCollection?.removeAll?.();
    for (const point of backdropPoints) {
      backdropCollection?.add?.({
        position: Cesium.Cartesian3.fromDegrees(
          point.longitude,
          point.latitude,
          point.altitude_km * 1000,
        ),
        color: Cesium.Color.fromCssColorString("#9bc6ff").withAlpha(0.82),
        outlineColor: Cesium.Color.fromCssColorString("#e8f3ff").withAlpha(0.28),
        outlineWidth: 1,
        pixelSize: 3,
      });
    }
  }, [backdropPoints, status]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium || status !== "ready") {
      return;
    }

    viewer.entities.removeAll();
    entityMapRef.current.clear();

    for (const entry of entries) {
      const currentPosition = Cesium.Cartesian3.fromDegrees(
        entry.current.longitude,
        entry.current.latitude,
        entry.current.altitudeKm * 1000,
      );
      const selected = entry.norad === selectedNorad;
      const sourceTrackColor = Cesium.Color.fromCssColorString(entry.color).withAlpha(0.92);
      const pointColor = Cesium.Color.fromCssColorString(entry.color);

      const trackPositions = entry.track.map((point) =>
        Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitudeKm * 1000),
      );

      const trackEntity =
        !renderTracks || entry.orbitClass === "geo"
          ? null
          : viewer.entities.add({
              polyline: {
                positions: trackPositions,
                width: entry.englishName === "SpaceEye-T" ? 1.2 : 0.8,
                material: new Cesium.PolylineDashMaterialProperty({
                  color: sourceTrackColor,
                  gapColor: Cesium.Color.fromCssColorString("#ffffff").withAlpha(0.08),
                  dashLength: 14,
                }),
                arcType: Cesium.ArcType.NONE,
              },
            });

      const entity = viewer.entities.add({
        id: `orbit-${entry.norad}`,
        position: currentPosition,
        point: {
          pixelSize: 13,
          color: pointColor,
          outlineColor: Cesium.Color.fromCssColorString("#f5fbff"),
          outlineWidth: 2,
        },
        label: {
          text: entry.englishName,
          font: selected
            ? '20px "Avenir Next", "Segoe UI", sans-serif'
            : '17px "Avenir Next", "Segoe UI", sans-serif',
          show: showLabels,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(
            selected ? "rgba(11, 19, 28, 0.88)" : "rgba(11, 19, 28, 0.62)",
          ),
          fillColor: Cesium.Color.fromCssColorString("#f5fbff"),
          pixelOffset: getBaseLabelOffset(Cesium, selected),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(500000, selected ? 0.96 : 0.78, 30000000, selected ? 0.72 : 0.54),
        },
        properties: {
          norad: entry.norad,
        },
      });

      entityMapRef.current.set(entry.norad, {
        pointEntity: entity,
        trackEntity,
        position: currentPosition,
        entry,
        selected,
      });
    }
  }, [entries, renderTracks, selectedNorad, showLabels, status]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium || !selectedNorad) {
      return;
    }

    const entity = entityMapRef.current.get(selectedNorad);
    if (!entity) {
      return;
    }

    viewer.flyTo(entity, {
      duration: 0.9,
      offset: new Cesium.HeadingPitchRange(0, -0.6, 2200000),
    });
  }, [selectedNorad]);

  if (status === "error") {
    return (
      <div className="orbit-track-globe orbit-track-globe--fallback">
        <NonIdealState
          icon="globe-network"
          title="3D globe load failed"
          description={error}
        />
      </div>
    );
  }

  return (
    <div className={`orbit-track-globe-shell ${className ?? ""}`.trim()}>
      <div ref={containerRef} className="orbit-track-globe" />
      {status === "ready" && showNavigation ? (
        <div className="orbit-track-globe__nav">
          <Button
            small
            outlined
            icon="arrow-up"
            aria-label="Pan up"
            onClick={() => panCamera("up")}
          />
          <div className="orbit-track-globe__nav-row">
            <Button
              small
              outlined
              icon="arrow-left"
              aria-label="Pan left"
              onClick={() => panCamera("left")}
            />
            <Button
              small
              intent="primary"
              className="orbit-track-globe__home"
              icon="home"
              aria-label="Move home"
              onClick={moveHome}
            />
            <Button
              small
              outlined
              icon="arrow-right"
              aria-label="Pan right"
              onClick={() => panCamera("right")}
            />
          </div>
          <Button
            small
            outlined
            icon="arrow-down"
            aria-label="Pan down"
            onClick={() => panCamera("down")}
          />
        </div>
      ) : null}
      {status !== "ready" ? (
        <div className="orbit-track-globe__loading">
          <Spinner size={30} />
          <span>3D globe loading</span>
        </div>
      ) : null}
    </div>
  );
}
