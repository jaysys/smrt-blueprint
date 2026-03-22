import { Button, Callout, Card, Dialog, InputGroup, Tag } from "@blueprintjs/core";
import { useEffect, useMemo, useState } from "react";
import { PanelTitle } from "../components/PanelTitle";
import { SattieOrbitTrackCanvas } from "../components/SattieOrbitTrackCanvas";
import { type OrbitTrackClass } from "../lib/orbitTrack";
import { useOrbitTrackScene } from "../hooks/useOrbitTrackScene";
import type { Satellite } from "../sattie-types";

interface SattieOrbitTrackPageProps {
  satellites: Satellite[];
}

function formatCoordinate(value: number, axis: "lat" | "lon") {
  const suffix = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(2)}° ${suffix}`;
}

function formatAltitude(value: number) {
  return value >= 10000 ? `${Math.round(value).toLocaleString()} km` : `${Math.round(value)} km`;
}

function getOrbitGroupLabel(value: OrbitTrackClass) {
  if (value === "geo") {
    return "GEO";
  }
  if (value === "meo") {
    return "MEO";
  }
  if (value === "cislunar") {
    return "Cislunar";
  }
  return "LEO";
}

function getSourceTagIntent(source: string | null) {
  if (!source) {
    return "none" as const;
  }
  if (source.includes("supplemental")) {
    return "warning" as const;
  }
  if (source.includes("user-supplied")) {
    return "primary" as const;
  }
  return "success" as const;
}

export function SattieOrbitTrackPage({ satellites }: SattieOrbitTrackPageProps) {
  const [orbitFilter, setOrbitFilter] = useState<"all" | OrbitTrackClass>("all");
  const [showGeoTracks, setShowGeoTracks] = useState(true);
  const [selectedNorad, setSelectedNorad] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserQuery, setBrowserQuery] = useState("");
  const { clock, entries, orbitFilteredEntries, visibleEntries, visibleLeoBackdropPoints, summary } =
    useOrbitTrackScene(satellites, { orbitFilter, showGeoTracks });

  const browserFilteredEntries = useMemo(() => {
    const searchText = browserQuery.trim().toLowerCase();
    return orbitFilteredEntries.filter((entry) => {
      const matchesSearch =
        !searchText ||
        [entry.englishName, entry.domesticName, entry.norad, entry.orbitLabel, entry.objectId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchText));
      return matchesSearch;
    });
  }, [browserQuery, orbitFilteredEntries]);

  const groupedEntries = useMemo(
    () => [
      { key: "leo" as const, label: "LEO", items: browserFilteredEntries.filter((entry) => entry.orbitClass === "leo") },
      { key: "geo" as const, label: "GEO", items: browserFilteredEntries.filter((entry) => entry.orbitClass === "geo") },
      { key: "meo" as const, label: "MEO", items: browserFilteredEntries.filter((entry) => entry.orbitClass === "meo") },
      {
        key: "cislunar" as const,
        label: "Cislunar / non-Earth",
        items: browserFilteredEntries.filter((entry) => entry.orbitClass === "cislunar"),
      },
    ].filter((group) => group.items.length > 0),
    [browserFilteredEntries],
  );

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.norad === selectedNorad) ?? null,
    [entries, selectedNorad],
  );

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedNorad(null);
      return;
    }
  }, [selectedEntry, selectedNorad]);

  const browserSelectionLabel = selectedEntry
    ? `${selectedEntry.englishName} · NORAD ${selectedEntry.norad}`
    : "선택된 위성 없음";

  function handleBrowserSelect(norad: string) {
    setSelectedNorad(norad);
    setBrowserOpen(false);
  }

  const filteredEntries = browserFilteredEntries;
  /*
   * The browser popup has its own search scope.
   * Keep the existing `filteredEntries` name out of the rest of this component
   * to avoid a wider structural rewrite.
   */

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div className="page-intro__copy">
          <p className="eyebrow">Orbit Track</p>
          <h1>Korean Satellite Orbit Track</h1>
          <p className="page-copy">
            `sattie-skor-tracker`의 Orbit Track 케이스를 현재 운영 콘솔에 맞게 이식한 화면이다. 현재 앱에
            동기화된 orbit metadata를 기준으로 한국 위성 궤도군, 선택 상태, 원천 메타를 한 화면에서 본다.
          </p>
        </div>
        <Card className="mini-summary">
          <div className="mini-summary__grid">
            <div>
              <strong>{summary.koreanLiveCount}</strong>
              <span>`sattie-skor-tracker` synced</span>
            </div>
            <div>
              <strong>{filteredEntries.length}</strong>
              <span>popup-select targets</span>
            </div>
            <div>
              <strong>15s</strong>
              <span>live sync cadence</span>
            </div>
          </div>
        </Card>
      </section>

      <div className="split-grid">
        <Card className="panel orbit-track-panel">
          <div className="panel__title-row">
            <PanelTitle icon="globe-network">Orbit Track Map</PanelTitle>
            <Tag minimal intent="primary">{visibleEntries.length} Korea · {visibleLeoBackdropPoints.length} LEO</Tag>
          </div>
          <SattieOrbitTrackCanvas
            entries={visibleEntries}
            backdropPoints={visibleLeoBackdropPoints}
            selectedNorad={selectedNorad}
            onSelect={setSelectedNorad}
          />
          <div className="orbit-track-map__meta">
            <span>Catalog snapshot</span>
            <span>{new Date(clock).toLocaleTimeString("ko-KR", { hour12: false })}</span>
            <span>{showGeoTracks ? "GEO visible" : "GEO hidden"}</span>
            <span>Global LEO {visibleLeoBackdropPoints.length.toLocaleString()} points</span>
          </div>
        </Card>

        <Card className="panel">
          <div className="panel__title-row">
            <PanelTitle icon="satellite">Telemetry + Overlay Status</PanelTitle>
            <Tag minimal intent="success">Orbit metadata</Tag>
          </div>

          <div className="orbit-track-controls">
            <div className="orbit-track-control-group">
              <span className="orbit-track-control-label">Orbit filter</span>
              <div className="segment-filter">
                <Button active={orbitFilter === "all"} minimal={orbitFilter !== "all"} onClick={() => setOrbitFilter("all")}>
                  All
                </Button>
                <Button active={orbitFilter === "leo"} minimal={orbitFilter !== "leo"} onClick={() => setOrbitFilter("leo")}>
                  LEO
                </Button>
                <Button active={orbitFilter === "geo"} minimal={orbitFilter !== "geo"} onClick={() => setOrbitFilter("geo")}>
                  GEO
                </Button>
                <Button active={orbitFilter === "meo"} minimal={orbitFilter !== "meo"} onClick={() => setOrbitFilter("meo")}>
                  MEO
                </Button>
              </div>
            </div>

            <div className="orbit-track-control-group">
              <span className="orbit-track-control-label">Track layer</span>
              <div className="segment-filter">
                <Button active={showGeoTracks} minimal={!showGeoTracks} onClick={() => setShowGeoTracks(true)}>
                  GEO on
                </Button>
                <Button active={!showGeoTracks} minimal={showGeoTracks} onClick={() => setShowGeoTracks(false)}>
                  GEO off
                </Button>
              </div>
            </div>
          </div>

          <Card className="mini-summary orbit-track-status-summary">
            <div className="mini-summary__grid">
              <div>
                <strong>{summary.total}</strong>
                <span>fleet · {summary.trackable} trackable</span>
              </div>
              <div>
                <strong>{summary.orbitCounts.leo}</strong>
                <span>korean LEO · {summary.orbitCounts.geo} GEO</span>
              </div>
              <div>
                <strong>{visibleLeoBackdropPoints.length.toLocaleString()}</strong>
                <span>global LEO points</span>
              </div>
            </div>
          </Card>

          {selectedEntry ? (
            <Callout icon="satellite" intent="primary">
              <div className="orbit-track-selected__body">
                <strong className="orbit-track-entry-title">{selectedEntry.englishName}</strong>
                {selectedEntry.trackerSource ? (
                  <span>
                    <Tag minimal intent={getSourceTagIntent(selectedEntry.trackerSource)}>
                      {selectedEntry.trackerSource}
                    </Tag>
                  </span>
                ) : null}
                <span>{selectedEntry.domesticName ?? selectedEntry.name}</span>
                <span>
                  NORAD {selectedEntry.norad} · {selectedEntry.orbitLabel} · Period {selectedEntry.periodMinutes.toFixed(1)} min
                </span>
                <span>
                  {formatCoordinate(selectedEntry.current.latitude, "lat")} · {formatCoordinate(selectedEntry.current.longitude, "lon")} · {formatAltitude(selectedEntry.current.altitudeKm)}
                </span>
                <span>
                  {selectedEntry.objectType ?? "-"} · {selectedEntry.objectId ?? "-"} · {selectedEntry.launchDate ?? "launch unknown"}
                </span>
              </div>
            </Callout>
          ) : (
            <Callout icon="info-sign" intent="primary">
              선택한 위성이 없다. 지도나 Orbit Browser에서 한국 위성을 선택하면 현재 위치와 source metadata를 표시한다.
            </Callout>
          )}

          <Callout icon="globe-network" intent="success">
            `sattie-skor-tracker` 전역 LEO point cloud를 같이 표시한다. 한국 위성은 live propagated track, 비한국 LEO는 point cloud로만 표현한다.
          </Callout>
        </Card>
      </div>

      <Card className="panel">
        <div className="panel__title-row">
          <PanelTitle icon="search-template">Orbit Browser</PanelTitle>
          <Tag minimal>{filteredEntries.length} matched</Tag>
        </div>
        <div className="orbit-track-browser-launch">
          <div className="orbit-track-browser-launch__summary">
            <strong>{browserSelectionLabel}</strong>
            <span>Orbit filter {orbitFilter === "all" ? "ALL" : getOrbitGroupLabel(orbitFilter)}</span>
          </div>
          <Button icon="search-template" intent="primary" onClick={() => setBrowserOpen(true)}>
            Open Orbit Browser
          </Button>
        </div>
        <div className="orbit-track-note">Orbit Browser는 팝업에서 검색하고 선택한다. 선택 결과는 지도와 상세 패널에 즉시 반영된다.</div>
      </Card>

      <Dialog isOpen={browserOpen} onClose={() => setBrowserOpen(false)} title="Orbit Browser" style={{ width: "min(920px, 92vw)" }}>
        <div className="bp6-dialog-body orbit-browser-dialog__body">
          <div className="orbit-track-browser-toolbar">
            <InputGroup
              value={browserQuery}
              leftIcon="search"
              placeholder="이름, NORAD, OBJECT_ID, orbit"
              onChange={(event) => setBrowserQuery(event.target.value)}
            />
          </div>
          <div className="orbit-track-browser orbit-browser-dialog__list">
            {groupedEntries.map((group) => (
              <div key={group.key} className="orbit-track-group">
                <div className="orbit-track-group__header">
                  <strong>{group.label}</strong>
                  <span>{group.items.length}</span>
                </div>
                <div className="orbit-track-group__list">
                  {group.items.map((entry) => (
                    <button
                      key={entry.norad}
                      type="button"
                      className={`orbit-track-browser__item ${entry.norad === selectedNorad ? "is-active" : ""}`}
                      onClick={() => handleBrowserSelect(entry.norad)}
                    >
                      <div>
                        <strong className="orbit-track-entry-title">{entry.englishName}</strong>
                        <span>{entry.domesticName ?? entry.name}</span>
                        <span>
                          NORAD {entry.norad} · {entry.orbitLabel} · {entry.objectType ?? "-"}
                        </span>
                      </div>
                      <div className="orbit-track-browser__meta">
                        <span>{formatAltitude(entry.current.altitudeKm)}</span>
                        <span>{getOrbitGroupLabel(entry.orbitClass)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groupedEntries.length === 0 ? <div className="orbit-track-empty">필터에 맞는 위성이 없다.</div> : null}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
