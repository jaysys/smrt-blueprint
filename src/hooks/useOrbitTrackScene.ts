import { useEffect, useMemo, useState } from "react";
import { getOrbitTrackKoreanLive, getOrbitTrackLeoBackdrop } from "../lib/sattieApi";
import { buildOrbitTrackEntries, type OrbitTrackClass } from "../lib/orbitTrack";
import type {
  OrbitBackdropPoint,
  OrbitTrackKoreanLiveResponse,
  OrbitTrackLeoBackdropResponse,
  Satellite,
} from "../sattie-types";

const EXCLUDED_ORBIT_TRACK_NORADS = new Set(["39068"]);

interface UseOrbitTrackSceneOptions {
  orbitFilter?: "all" | OrbitTrackClass;
  showGeoTracks?: boolean;
}

export function useOrbitTrackScene(
  satellites: Satellite[],
  options: UseOrbitTrackSceneOptions = {},
) {
  const { orbitFilter = "all", showGeoTracks = true } = options;
  const [clock, setClock] = useState(() => Date.now());
  const [leoBackdrop, setLeoBackdrop] = useState<OrbitTrackLeoBackdropResponse | null>(null);
  const [koreanLive, setKoreanLive] = useState<OrbitTrackKoreanLiveResponse | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshOrbitLayers() {
      try {
        const [leoResponse, koreanResponse] = await Promise.all([
          getOrbitTrackLeoBackdrop(),
          getOrbitTrackKoreanLive(),
        ]);
        if (!cancelled) {
          setLeoBackdrop(leoResponse);
          setKoreanLive(koreanResponse);
        }
      } catch {
        if (!cancelled) {
          setLeoBackdrop(null);
          setKoreanLive(null);
        }
      }
    }

    void refreshOrbitLayers();
    const timer = window.setInterval(() => {
      void refreshOrbitLayers();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const entries = useMemo(() => {
    const baseEntries = buildOrbitTrackEntries(satellites, new Date(clock));
    const liveByNorad = new Map((koreanLive?.entries ?? []).map((entry) => [entry.norad, entry]));
    return baseEntries
      .map((entry) => {
        const live = liveByNorad.get(entry.norad);
        if (!live) {
          return entry;
        }

        return {
          ...entry,
          englishName: live.english_name ?? entry.englishName,
          domesticName: live.domestic_name ?? entry.domesticName,
          orbitLabel: live.orbit_label ?? entry.orbitLabel,
          periodMinutes: live.period_minutes,
          current: live.current,
          track: live.track,
        };
      })
      .filter((entry) => !EXCLUDED_ORBIT_TRACK_NORADS.has(entry.norad));
  }, [clock, koreanLive, satellites]);

  const koreanNorads = useMemo(() => new Set(entries.map((entry) => entry.norad)), [entries]);

  const orbitFilteredEntries = useMemo(() => {
    return entries.filter((entry) => orbitFilter === "all" || entry.orbitClass === orbitFilter);
  }, [entries, orbitFilter]);

  const visibleLeoBackdropPoints = useMemo(() => {
    if (!leoBackdrop || (orbitFilter !== "all" && orbitFilter !== "leo")) {
      return [] as OrbitBackdropPoint[];
    }

    return leoBackdrop.points.filter((point) => !koreanNorads.has(point.norad));
  }, [koreanNorads, leoBackdrop, orbitFilter]);

  const visibleEntries = useMemo(
    () => orbitFilteredEntries.filter((entry) => entry.trackable && (showGeoTracks || entry.orbitClass !== "geo")),
    [orbitFilteredEntries, showGeoTracks],
  );

  const summary = useMemo(() => {
    const orbitCounts = {
      leo: entries.filter((entry) => entry.orbitClass === "leo").length,
      geo: entries.filter((entry) => entry.orbitClass === "geo").length,
      meo: entries.filter((entry) => entry.orbitClass === "meo").length,
      cislunar: entries.filter((entry) => entry.orbitClass === "cislunar").length,
    };
    return {
      total: entries.length,
      trackable: entries.filter((entry) => entry.trackable).length,
      hidden: entries.filter((entry) => !entry.trackable).length,
      orbitCounts,
      koreanLiveCount: koreanLive?.entries.length ?? entries.length,
    };
  }, [entries, koreanLive]);

  return {
    clock,
    entries,
    orbitFilteredEntries,
    visibleEntries,
    visibleLeoBackdropPoints,
    summary,
  };
}
